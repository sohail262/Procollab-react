import {
    useEffect,
    useState,
    useCallback,
    useRef,
    useMemo,
} from 'react'
import {
    Tldraw,
    Editor,
    TLRecord,
    TLStoreEventInfo,
    TLUserPreferences,
    useTldrawUser,
    InstancePresenceRecordType,
    TLInstancePresence,
} from 'tldraw'
import 'tldraw/tldraw.css'
import { Card } from '@/components/ui/card'
import { useParams } from 'react-router-dom'
import {
    doc,
    setDoc,
    getDoc,
    serverTimestamp,
} from 'firebase/firestore'
import {
    ref,
    onValue,
    set,
    push,
    remove,
    onDisconnect,
    off,
    get,
    query,
    orderByChild,
    startAt,
    onChildAdded,
} from 'firebase/database'
import { db, database } from '@/lib/firebase'
import { useAuth } from '@/hooks/use-auth'

// ─── Constants ────────────────────────────────────────────────────────────────
const SNAPSHOT_INTERVAL_MS = 30_000
const CHANGE_BATCH_MS = 50
const PRESENCE_THROTTLE_MS = 80
const MAX_CHANGE_QUEUE = 200
const PRESENCE_TIMEOUT_MS = 20_000
const CHANGES_TTL_MS = 60_000

const CURSOR_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#82E0AA',
    '#F8C471', '#85C1E9', '#F1948A', '#D2B4DE',
]

// ─── Types ────────────────────────────────────────────────────────────────────
interface WhiteboardProps {
    readOnly?: boolean
}

interface ChangePayload {
    records?: Record<string, TLRecord>
    removedIds?: string[]
    userId: string
    timestamp: number
}

interface PresencePayload extends TLInstancePresence {
    userId: string
    userName: string
    color: string
    lastActive: number
}

interface ActiveUser {
    userId: string
    userName: string
    color: string
    lastActive: number
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

// ─── Utilities ────────────────────────────────────────────────────────────────
function getUserColor(userId: string): string {
    let hash = 0
    for (let i = 0; i < userId.length; i++) {
        hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0
    }
    return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length]
}

function sanitizeForFirebase<T>(value: T): T {
    return JSON.parse(
        JSON.stringify(value, (_key, val) =>
            val === undefined ? null : val
        )
    ) as T
}

function sanitizeRecord<T extends Record<string, any>>(record: T): T {
    if (!record) return record
    const needsMeta = ['shape', 'binding', 'asset', 'page', 'camera', 'document']
    if (needsMeta.includes(record.typeName) && !record.meta) {
        return { ...record, meta: {} }
    }
    return record
}

function sanitizeRecords(records: any[]): TLRecord[] {
    return records.map(sanitizeRecord) as TLRecord[]
}

// ─── Component ────────────────────────────────────────────────────────────────
export function Whiteboard({ readOnly = false }: WhiteboardProps) {
    const { id: projectId } = useParams<{ id: string }>()
    const { user } = useAuth()

    const [editor, setEditor] = useState<Editor | null>(null)
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')
    const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([])
    const [initialLoadDone, setInitialLoadDone] = useState(false)

    // ── Stable refs ───────────────────────────────────────────────────────────
    const editorRef = useRef<Editor | null>(null)
    const userRef = useRef(user)
    const canvasWrapperRef = useRef<HTMLDivElement>(null)   // ← NEW: raw DOM ref
    const isApplyingRemoteRef = useRef(false)
    const changeQueueRef = useRef<ChangePayload[]>([])
    const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const snapshotTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const lastPresenceUpdateRef = useRef(0)
    const joinTimestampRef = useRef(0)

    useEffect(() => { userRef.current = user }, [user])

    // ─── User Preferences ─────────────────────────────────────────────────────
    const [userPreferences, setUserPreferences] = useState<TLUserPreferences>(() => ({
        id: user?.uid ?? `anon-${Date.now()}`,
        name: user?.displayName ?? 'Anonymous',
        color: user?.uid ? getUserColor(user.uid) : CURSOR_COLORS[0],
        colorScheme: 'system' as const,
    }))

    useEffect(() => {
        if (!user) return
        setUserPreferences(prev => ({
            ...prev,
            id: user.uid,
            name: user.displayName ?? 'Anonymous',
            color: getUserColor(user.uid),
        }))
    }, [user?.uid, user?.displayName])

    const tldrawUser = useTldrawUser({ userPreferences, setUserPreferences })

    // ─── Firebase Paths ───────────────────────────────────────────────────────
    const paths = useMemo(() => {
        if (!projectId) return null
        const base = `whiteboards/${projectId}`
        return {
            changes: `${base}/changes`,
            presence: `${base}/presence`,
            snapshot: `${base}/snapshot`,
        } as const
    }, [projectId])

    // ─── Editor Mount ─────────────────────────────────────────────────────────
    const handleMount = useCallback((instance: Editor) => {
        editorRef.current = instance
        setEditor(instance)
        if (readOnly) instance.updateInstanceState({ isReadonly: true })
    }, [readOnly])

    // ─── Touch Fix 1: Lock body scroll while mounted ──────────────────────────
    useEffect(() => {
        const prev = {
            overflow: document.body.style.overflow,
            touchAction: document.body.style.touchAction,
        }
        document.body.style.overflow = 'hidden'
        document.body.style.touchAction = 'none'
        return () => {
            document.body.style.overflow = prev.overflow
            document.body.style.touchAction = prev.touchAction
        }
    }, [])

    // ─── Touch Fix 2: Non-passive listeners via raw DOM ref ───────────────────
    //
    // React attaches ALL synthetic touch listeners to the root as passive:true.
    // Calling e.preventDefault() inside React's onTouchStart/onTouchMove is
    // silently ignored by the browser. We bypass React entirely here by
    // attaching directly to the wrapper <div> with { passive: false }.
    //
    useEffect(() => {
        const el = canvasWrapperRef.current
        if (!el) return

        const prevent = (e: TouchEvent) => {
            // Only block multi-touch or if tldraw is the target
            // Single-finger scrolling is blocked intentionally — tldraw
            // needs full control of all touch input on the canvas
            if (e.cancelable) e.preventDefault()
        }

        el.addEventListener('touchstart', prevent, { passive: false })
        el.addEventListener('touchmove', prevent, { passive: false })

        return () => {
            el.removeEventListener('touchstart', prevent)
            el.removeEventListener('touchmove', prevent)
        }
    }, [])   // empty dep array — el never changes after mount

    // ─── Firebase Connection Monitor ──────────────────────────────────────────
    useEffect(() => {
        const connRef = ref(database, '.info/connected')
        const unsub = onValue(connRef, snap => {
            if (snap.val() === true) {
                setConnectionStatus(prev =>
                    prev === 'connecting' ? 'connecting' : 'connected'
                )
            } else {
                setConnectionStatus(prev =>
                    prev === 'connecting' ? 'connecting' : 'disconnected'
                )
            }
        })
        return () => off(connRef)
    }, [])

    // ─── 1. Load Initial Snapshot ─────────────────────────────────────────────
    useEffect(() => {
        if (!projectId || !editor || !paths || initialLoadDone) return

        let cancelled = false

        const load = async () => {
            try {
                setConnectionStatus('connecting')

                // a) Firestore (source of truth)
                const fsRef = doc(db, 'projects', projectId, 'whiteboard', 'main')
                const fsSnap = await getDoc(fsRef)
                let fsTimestamp = 0

                if (fsSnap.exists()) {
                    const data = fsSnap.data()
                    fsTimestamp = data.updatedAt?.toMillis?.() ?? 0

                    if (data.storeSnapshot?.store) {
                        const store = data.storeSnapshot.store as Record<string, any>
                        Object.keys(store).forEach(k => {
                            store[k] = sanitizeRecord(store[k])
                        })
                        try {
                            editor.store.loadStoreSnapshot(data.storeSnapshot)
                        } catch (err) {
                            console.warn('loadStoreSnapshot failed, falling back:', err)
                            const records = sanitizeRecords(Object.values(store))
                            if (records.length) {
                                editor.store.mergeRemoteChanges(() => {
                                    editor.store.put(records)
                                })
                            }
                        }
                    }
                } else if (!readOnly) {
                    await setDoc(fsRef, {
                        records: {},
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    }, { merge: true })
                }

                if (cancelled) return

                // b) RTDB snapshot — apply only if newer than Firestore
                const rtdbSnapRef = ref(database, paths.snapshot)
                const rtdbSnapshot = await get(rtdbSnapRef)

                if (rtdbSnapshot.exists()) {
                    const rtdbData = rtdbSnapshot.val() as {
                        timestamp: number
                        records: Record<string, any>
                    }
                    if (rtdbData.timestamp > fsTimestamp && rtdbData.records) {
                        const records = sanitizeRecords(Object.values(rtdbData.records))
                        if (records.length) {
                            editor.store.mergeRemoteChanges(() => {
                                editor.store.put(records)
                            })
                        }
                    }
                }

                if (cancelled) return

                // Stamp join time BEFORE subscribing — prevents onChildAdded
                // from replaying all historical change nodes
                joinTimestampRef.current = Date.now()

                setConnectionStatus('connected')
                setInitialLoadDone(true)
            } catch (err) {
                console.error('Failed to load whiteboard:', err)
                if (!cancelled) setConnectionStatus('error')
            }
        }

        load()
        return () => { cancelled = true }
    }, [projectId, editor, paths, initialLoadDone, readOnly])

    // ─── 2. Receive Remote Changes ────────────────────────────────────────────
    useEffect(() => {
        if (!paths || !editor || !initialLoadDone) return

        const changesRef = ref(database, paths.changes)

        // ↓ The index on "timestamp" (database.rules.json) makes this fast
        const newChangesQuery = query(
            changesRef,
            orderByChild('timestamp'),
            startAt(joinTimestampRef.current)
        )

        const applyChange = (snap: any) => {
            const change = snap.val() as ChangePayload | null
            if (!change) return
            if (change.userId === userRef.current?.uid) return  // skip own echo

            try {
                isApplyingRemoteRef.current = true
                editor.store.mergeRemoteChanges(() => {
                    if (change.records) {
                        const records = sanitizeRecords(Object.values(change.records))
                        if (records.length) editor.store.put(records)
                    }
                    if (change.removedIds?.length) {
                        const existingIds = new Set(
                            editor.store.allRecords().map(r => r.id)
                        )
                        const valid = change.removedIds.filter(id =>
                            existingIds.has(id as TLRecord['id'])
                        ) as TLRecord['id'][]
                        if (valid.length) editor.store.remove(valid)
                    }
                })
            } catch (err) {
                console.error('Error applying remote change:', err)
            } finally {
                isApplyingRemoteRef.current = false
            }
        }

        const unsub = onChildAdded(newChangesQuery, applyChange)
        return () => unsub()
    }, [paths, editor, initialLoadDone])

    // ─── 3. Broadcast Local Changes ───────────────────────────────────────────
    useEffect(() => {
        if (!paths || !editor || !initialLoadDone || readOnly) return

        const changesRef = ref(database, paths.changes)

        const flush = () => {
            if (!changeQueueRef.current.length) return

            const batch = changeQueueRef.current.splice(0)
            const mergedRecords: Record<string, TLRecord> = {}
            const mergedRemovedIds: Set<string> = new Set()

            for (const item of batch) {
                if (item.records) Object.assign(mergedRecords, item.records)
                if (item.removedIds) {
                    for (const id of item.removedIds) {
                        mergedRemovedIds.add(id)
                        delete mergedRecords[id]
                    }
                }
            }
            for (const id of Object.keys(mergedRecords)) {
                mergedRemovedIds.delete(id)
            }

            const hasRecords = Object.keys(mergedRecords).length > 0
            const hasRemovals = mergedRemovedIds.size > 0
            if (!hasRecords && !hasRemovals) return

            const uid = userRef.current?.uid
            if (!uid) return

            const payload: ChangePayload = {
                userId: uid,
                timestamp: Date.now(),
                ...(hasRecords && { records: mergedRecords }),
                ...(hasRemovals && { removedIds: Array.from(mergedRemovedIds) }),
            }

            push(changesRef, sanitizeForFirebase(payload)).catch(err =>
                console.error('Error broadcasting change:', err)
            )
        }

        const scheduleFlush = () => {
            if (batchTimerRef.current) clearTimeout(batchTimerRef.current)
            batchTimerRef.current = setTimeout(flush, CHANGE_BATCH_MS)
        }

        const unsubscribeStore = editor.store.listen(
            (entry: TLStoreEventInfo) => {
                if (isApplyingRemoteRef.current) return

                const { added, updated, removed } = entry.changes
                const records: Record<string, TLRecord> = {}
                const removedIds: string[] = []

                for (const record of Object.values(added)) records[record.id] = record
                for (const [, to] of Object.values(updated)) records[to.id] = to
                for (const id of Object.keys(removed)) removedIds.push(id)

                if (!Object.keys(records).length && !removedIds.length) return

                changeQueueRef.current.push({
                    userId: userRef.current?.uid ?? 'anon',
                    timestamp: Date.now(),
                    ...(Object.keys(records).length && { records }),
                    ...(removedIds.length && { removedIds }),
                })

                if (changeQueueRef.current.length >= MAX_CHANGE_QUEUE) {
                    if (batchTimerRef.current) {
                        clearTimeout(batchTimerRef.current)
                        batchTimerRef.current = null
                    }
                    flush()
                } else {
                    scheduleFlush()
                }
            },
            { source: 'user', scope: 'document' }
        )

        return () => {
            unsubscribeStore()
            if (batchTimerRef.current) {
                clearTimeout(batchTimerRef.current)
                batchTimerRef.current = null
            }
            flush()
        }
    }, [paths, editor, initialLoadDone, readOnly])

    // ─── 4. Periodic Snapshot ─────────────────────────────────────────────────
    useEffect(() => {
        if (!projectId || !editor || !initialLoadDone || readOnly || !paths) return

        const saveSnapshot = async () => {
            try {
                const snapshot = editor.store.getStoreSnapshot('document')
                const serialized = editor.store.serialize('document')
                const now = Date.now()

                const fsRef = doc(db, 'projects', projectId, 'whiteboard', 'main')
                await setDoc(fsRef, {
                    storeSnapshot: sanitizeForFirebase(snapshot),
                    updatedAt: serverTimestamp(),
                }, { merge: true })

                await set(ref(database, paths.snapshot), sanitizeForFirebase({
                    records: serialized,
                    timestamp: now,
                }))

                // Prune stale change nodes individually (never wipe the whole node)
                const changesRef = ref(database, paths.changes)
                const changesSnap = await get(changesRef)
                if (changesSnap.exists()) {
                    const cutoff = now - CHANGES_TTL_MS
                    const deletions: Promise<void>[] = []
                    changesSnap.forEach(child => {
                        if ((child.val() as ChangePayload).timestamp < cutoff) {
                            deletions.push(remove(child.ref))
                        }
                    })
                    await Promise.all(deletions)
                }
            } catch (err) {
                console.error('Snapshot save error:', err)
            }
        }

        snapshotTimerRef.current = setInterval(saveSnapshot, SNAPSHOT_INTERVAL_MS)
        window.addEventListener('beforeunload', saveSnapshot)

        return () => {
            if (snapshotTimerRef.current) clearInterval(snapshotTimerRef.current)
            window.removeEventListener('beforeunload', saveSnapshot)
            saveSnapshot()
        }
    }, [projectId, editor, initialLoadDone, readOnly, paths])

    // ─── 5. Presence ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (!paths || !editor || !initialLoadDone || !user || readOnly) return

        const myPresenceRef = ref(database, `${paths.presence}/${user.uid}`)
        const allPresenceRef = ref(database, paths.presence)

        onDisconnect(myPresenceRef).remove()

        const publishPresence = () => {
            const now = Date.now()
            if (now - lastPresenceUpdateRef.current < PRESENCE_THROTTLE_MS) return
            lastPresenceUpdateRef.current = now

            const myRecord = editor.store
                .allRecords()
                .find(
                    (r): r is TLInstancePresence =>
                        r.typeName === 'instance_presence' &&
                        (r as TLInstancePresence).userId === editor.store.id
                ) as TLInstancePresence | undefined

            const payload: PresencePayload = {
                ...(myRecord ?? {}),
                id: InstancePresenceRecordType.createId(user.uid),
                typeName: 'instance_presence',
                userId: user.uid,
                userName: user.displayName ?? 'Anonymous',
                color: getUserColor(user.uid),
                lastActive: now,
                cursor: myRecord?.cursor ?? { x: 0, y: 0, type: 'default', rotation: 0 },
                currentPageId: editor.getCurrentPageId(),
            } as PresencePayload

            set(myPresenceRef, sanitizeForFirebase(payload)).catch(() => { })
        }

        publishPresence()

        const unsubLocal = editor.store.listen(
            () => { if (!isApplyingRemoteRef.current) publishPresence() },
            { source: 'user', scope: 'presence' }
        )

        const unsubAll = onValue(allPresenceRef, snap => {
            const raw = snap.val() as Record<string, PresencePayload> | null
            if (!raw) { setActiveUsers([]); return }

            const now = Date.now()
            const remoteList = Object.values(raw).filter(
                p => p &&
                    p.userId !== user.uid &&
                    (now - (p.lastActive ?? now)) < PRESENCE_TIMEOUT_MS
            )

            try {
                isApplyingRemoteRef.current = true
                editor.store.mergeRemoteChanges(() => {
                    const remoteIds = new Set(remoteList.map(p => p.id))
                    const stale = editor.store
                        .allRecords()
                        .filter(
                            r =>
                                r.typeName === 'instance_presence' &&
                                (r as TLInstancePresence).userId !== user.uid &&
                                !remoteIds.has(r.id)
                        )
                        .map(r => r.id) as TLRecord['id'][]

                    if (stale.length) editor.store.remove(stale)
                    if (remoteList.length) editor.store.put(remoteList as any)
                })
            } catch (err) {
                console.error('Error applying presence:', err)
            } finally {
                isApplyingRemoteRef.current = false
            }

            setActiveUsers(remoteList.map(p => ({
                userId: p.userId,
                userName: p.userName,
                color: p.color,
                lastActive: p.lastActive,
            })))
        })

        return () => {
            unsubLocal()
            off(allPresenceRef)
            remove(myPresenceRef)
        }
    }, [paths, editor, initialLoadDone, user, readOnly])

    // ─── Derived UI state ─────────────────────────────────────────────────────
    const statusConfig = useMemo(() => ({
        connecting: { color: 'bg-yellow-400', pulse: true, label: 'Connecting…' },
        connected: {
            color: 'bg-emerald-400',
            pulse: false,
            label: activeUsers.length > 0
                ? `Connected · ${activeUsers.length + 1} online`
                : 'Connected',
        },
        disconnected: { color: 'bg-gray-400', pulse: true, label: 'Reconnecting…' },
        error: { color: 'bg-red-400', pulse: true, label: 'Connection error' },
    }[connectionStatus]), [connectionStatus, activeUsers.length])

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <Card
            className="relative h-[calc(100vh-12rem)] w-full overflow-hidden border bg-background"
            style={{ touchAction: 'none', userSelect: 'none' }}
        >
            {/* HUD */}
            <div className="absolute right-3 top-3 z-[1000] flex items-center gap-2">
                {activeUsers.length > 0 && (
                    <div className="flex items-center -space-x-2 mr-1">
                        {activeUsers.slice(0, 5).map(u => (
                            <div
                                key={u.userId}
                                title={u.userName}
                                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow-sm transition-transform hover:z-10 hover:scale-110 dark:border-gray-900"
                                style={{ backgroundColor: u.color }}
                            >
                                {u.userName.charAt(0).toUpperCase()}
                            </div>
                        ))}
                        {activeUsers.length > 5 && (
                            <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-gray-500 text-[10px] font-bold text-white shadow-sm dark:border-gray-900">
                                +{activeUsers.length - 5}
                            </div>
                        )}
                    </div>
                )}
                <div className="flex items-center gap-1.5 rounded-full border border-gray-200/50 bg-white/90 px-3 py-1.5 shadow-lg backdrop-blur-sm dark:border-gray-700/50 dark:bg-gray-900/90">
                    <span className="relative flex h-2 w-2">
                        <span className={`absolute inline-flex h-full w-full rounded-full ${statusConfig.color} opacity-75 ${statusConfig.pulse ? 'animate-ping' : ''}`} />
                        <span className={`relative inline-flex h-2 w-2 rounded-full ${statusConfig.color}`} />
                    </span>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                        {statusConfig.label}
                    </span>
                </div>
            </div>

            {/* Read-only badge */}
            {readOnly && (
                <div className="absolute left-3 top-3 z-[1000] rounded-full bg-amber-500/90 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-sm">
                    View Only
                </div>
            )}

            {/*
                Canvas wrapper
                ─────────────
                - ref={canvasWrapperRef}   → raw DOM node for non-passive listeners
                - touch-none               → CSS touch-action: none
                - select-none              → no text selection during gestures
                - NO onTouchStart/onTouchMove here — React would register them
                  as passive and preventDefault() would be ignored.
                  Touch handling is done in the useEffect above via raw DOM APIs.
            */}
            <div
                ref={canvasWrapperRef}
                className="h-full w-full touch-none select-none overflow-hidden"
                onContextMenu={e => e.preventDefault()}
            >
                <Tldraw
                    onMount={handleMount}
                    user={tldrawUser}
                    persistenceKey={undefined}
                />
            </div>
        </Card>
    )
}
import { useEffect, useState } from 'react'
import { Tldraw, Editor, TLRecord } from '@tldraw/tldraw'
import '@tldraw/tldraw/tldraw.css'
import { Card } from '@/components/ui/card'
import { useParams } from 'react-router-dom'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/hooks/use-auth'

interface WhiteboardProps {
    readOnly?: boolean
}

export function Whiteboard({ readOnly = false }: WhiteboardProps) {
    const { id: projectId } = useParams()
    const { user } = useAuth()
    const [editor, setEditor] = useState<Editor | null>(null)
    const [isOneTimeLoadComplete, setIsOneTimeLoadComplete] = useState(false)

    // Handle editor mounting
    const handleMount = (editorInstance: Editor) => {
        setEditor(editorInstance)
        // Set initial user info if available
        if (user) {
            editorInstance.user.updateUserPreferences({
                name: user.displayName || 'Anonymous',
            })
        }

        // Set read-only mode if needed
        if (readOnly) {
            editorInstance.updateInstanceState({ isReadonly: true })
        }
    }

    // Subscribe to Firestore changes (Downstream)
    useEffect(() => {
        if (!projectId || !editor) return

        const docRef = doc(db, 'projects', projectId, 'whiteboard', 'main')

        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data()
                const records = data.records || {}

                // Convert map to array of records
                const recordsArray = Object.values(records) as TLRecord[]

                if (recordsArray.length > 0) {
                    // Use mergeRemoteChanges to avoid triggering listeners
                    editor.store.mergeRemoteChanges(() => {
                        editor.store.put(recordsArray)
                    })
                }
            } else {
                // Initialize if empty (only if not read-only)
                if (!isOneTimeLoadComplete && !readOnly) {
                    setDoc(docRef, { records: {} }, { merge: true })
                }
            }
            setIsOneTimeLoadComplete(true)
        })

        return () => unsubscribe()
    }, [projectId, editor, readOnly])

    // Save full snapshot periodically (Upstream) - only if not read-only
    useEffect(() => {
        if (!projectId || !editor || !isOneTimeLoadComplete || readOnly) return

        const saveSnapshot = async () => {
            // In Tldraw 2.0+, serialize returns the store content
            const snapshot = editor.store.serialize()

            try {
                const docRef = doc(db, 'projects', projectId, 'whiteboard', 'main')
                // Serialize returns an object where keys are IDs and values are records
                // We save this directly to the 'records' field
                // Wait, serialize returns { [id: string]: TLRecord }?
                // Depending on version, it might return { records: ... }
                // Let's assume standard object map for now based on docs.

                let recordsToSave = snapshot
                if ('records' in snapshot) {
                    recordsToSave = (snapshot as any).records
                }

                await setDoc(docRef, { records: recordsToSave }, { merge: true })
            } catch (e) {
                console.error("Error saving whiteboard:", e)
            }
        }

        let timeout: ReturnType<typeof setTimeout>

        const cleanup = editor.store.listen((update) => {
            if (update.source === 'remote') return

            // Debounce save (2 seconds)
            clearTimeout(timeout)
            timeout = setTimeout(() => {
                saveSnapshot()
            }, 2000)
        })

        return () => {
            cleanup()
            clearTimeout(timeout)
        }
    }, [projectId, editor, isOneTimeLoadComplete, readOnly])

    return (
        <Card className="h-[calc(100vh-12rem)] w-full overflow-hidden border bg-background">
            <div className="h-full w-full relative">
                <Tldraw
                    onMount={handleMount}
                    persistenceKey={undefined} // Disable local persistence to avoid conflicts
                />
            </div>
        </Card>
    )
}


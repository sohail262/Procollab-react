import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/hooks/use-auth'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PermissionSet {
    read:  boolean
    write: boolean
}

export interface MemberPermissions {
    dashboard:  PermissionSet
    tasks:      PermissionSet
    gantt:      PermissionSet
    calendar:   PermissionSet
    whiteboard: PermissionSet
    files:      PermissionSet
    settings:   PermissionSet
    chat:       PermissionSet
}

interface UsePermissionsReturn {
    permissions: MemberPermissions | null
    loading:     boolean
    isOwner:     boolean
    isAdmin:     boolean
    canRead:     (feature: keyof MemberPermissions) => boolean
    canWrite:    (feature: keyof MemberPermissions) => boolean
}

// ─── Permission presets ───────────────────────────────────────────────────────
export const FULL_PERMISSIONS: MemberPermissions = {
    dashboard:  { read: true, write: true },
    tasks:      { read: true, write: true },
    gantt:      { read: true, write: true },
    calendar:   { read: true, write: true },
    whiteboard: { read: true, write: true },
    files:      { read: true, write: true },
    settings:   { read: true, write: true },
    chat:       { read: true, write: true },
}

// Members who exist in teamMembers but have no explicit permissions set
// get full read access to everything by default
export const DEFAULT_MEMBER_PERMISSIONS: MemberPermissions = {
    dashboard:  { read: true,  write: false },
    tasks:      { read: true,  write: true  },
    gantt:      { read: true,  write: false },
    calendar:   { read: true,  write: false },
    whiteboard: { read: true,  write: true  },
    files:      { read: true,  write: true  },
    settings:   { read: false, write: false },
    chat:       { read: true,  write: true  },
}

export const EMPTY_MEMBER_PERMISSIONS: MemberPermissions = {
    dashboard:  { read: false, write: false },
    tasks:      { read: false, write: false },
    gantt:      { read: false, write: false },
    calendar:   { read: false, write: false },
    whiteboard: { read: false, write: false },
    files:      { read: false, write: false },
    settings:   { read: false, write: false },
    chat:       { read: false, write: false },
}

// ─── Module-level cache ───────────────────────────────────────────────────────
interface CacheEntry {
    isOwner:     boolean
    isAdmin:     boolean
    permissions: MemberPermissions
    ts:          number
    // Track if this was a successful resolution (not a fallback)
    resolved:    boolean
}

const permCache = new Map<string, CacheEntry>()
const CACHE_TTL         = 5 * 60 * 1000   // 5 min for successful resolutions
const FAILED_CACHE_TTL  = 30 * 1000       // 30 sec for failed/empty resolutions

export function invalidatePermissionsCache(projectId: string, userId: string) {
    permCache.delete(`${projectId}:${userId}`)
}

export function invalidateAllPermissionsCache() {
    permCache.clear()
}

// ─── Validate permissions object has correct shape ────────────────────────────
function isValidPermissions(p: any): p is MemberPermissions {
    if (!p || typeof p !== 'object') return false
    const keys: (keyof MemberPermissions)[] = [
        'dashboard', 'tasks', 'gantt', 'calendar',
        'whiteboard', 'files', 'settings', 'chat',
    ]
    return keys.every(k =>
        p[k] !== undefined &&
        typeof p[k].read  === 'boolean' &&
        typeof p[k].write === 'boolean'
    )
}

// ─────────────────────────────────────────────────────────────────────────────
export function usePermissions(): UsePermissionsReturn {

    // ALL hooks unconditionally at the top
    const { id: projectId }              = useParams()
    const { user, loading: authLoading } = useAuth()

    const [permissions, setPermissions] = useState<MemberPermissions | null>(null)
    const [loading,     setLoading]     = useState(true)
    const [isOwner,     setIsOwner]     = useState(false)
    const [isAdmin,     setIsAdmin]     = useState(false)

    const mountedRef = useRef(true)
    useEffect(() => {
        mountedRef.current = true
        return () => { mountedRef.current = false }
    }, [])

    useEffect(() => {
        if (authLoading) return
        if (!projectId || !user) {
            setLoading(false)
            return
        }

        const cacheKey = `${projectId}:${user.uid}`
        const cached   = permCache.get(cacheKey)

        if (cached) {
            // Use different TTL depending on whether it was a real resolution
            const ttl = cached.resolved ? CACHE_TTL : FAILED_CACHE_TTL
            if (Date.now() - cached.ts < ttl) {
                if (mountedRef.current) {
                    setIsOwner(cached.isOwner)
                    setIsAdmin(cached.isAdmin)
                    setPermissions(cached.permissions)
                    setLoading(false)
                }
                return
            }
            // Cache expired — delete and re-fetch
            permCache.delete(cacheKey)
        }

        let active = true

        const fetchPermissions = async () => {
            try {
                // ── Step 1: Read project doc ──────────────────────────────────
                // /projects has allow read: if true — ALWAYS succeeds
                const projectSnap = await getDoc(doc(db, 'projects', projectId))

                if (!active || !mountedRef.current) return

                if (!projectSnap.exists()) {
                    setPermissions(EMPTY_MEMBER_PERMISSIONS)
                    setLoading(false)
                    return
                }

                const projectData = projectSnap.data()

                // ── Step 2: Are they the creator/owner? ───────────────────────
                if (projectData.createdBy === user.uid) {
                    console.log('✅ usePermissions: user is OWNER')
                    const entry: CacheEntry = {
                        isOwner:     true,
                        isAdmin:     true,
                        permissions: FULL_PERMISSIONS,
                        ts:          Date.now(),
                        resolved:    true,
                    }
                    permCache.set(cacheKey, entry)
                    if (active && mountedRef.current) {
                        setIsOwner(true)
                        setIsAdmin(true)
                        setPermissions(FULL_PERMISSIONS)
                        setLoading(false)
                    }
                    return
                }

                // ── Step 3: Are they in teamMembers map? ──────────────────────
                const memberEntry = projectData.teamMembers?.[user.uid]

                console.log('🔍 usePermissions: teamMembers entry =', memberEntry)

                if (!memberEntry) {
                    // Genuinely not a member
                    console.log('❌ usePermissions: user NOT in teamMembers')
                    const entry: CacheEntry = {
                        isOwner:     false,
                        isAdmin:     false,
                        permissions: EMPTY_MEMBER_PERMISSIONS,
                        ts:          Date.now(),
                        resolved:    false,   // short TTL — might join soon
                    }
                    permCache.set(cacheKey, entry)
                    if (active && mountedRef.current) {
                        setIsOwner(false)
                        setIsAdmin(false)
                        setPermissions(EMPTY_MEMBER_PERMISSIONS)
                        setLoading(false)
                    }
                    return
                }

                // ── Step 4: What is their role? ───────────────────────────────
                const role = (memberEntry.role ?? '').toLowerCase()
                console.log('🔍 usePermissions: role =', role)

                if (role === 'owner' || role === 'admin') {
                    console.log('✅ usePermissions: user is ADMIN/LEAD')
                    const entry: CacheEntry = {
                        isOwner:     false,
                        isAdmin:     true,
                        permissions: FULL_PERMISSIONS,
                        ts:          Date.now(),
                        resolved:    true,
                    }
                    permCache.set(cacheKey, entry)
                    if (active && mountedRef.current) {
                        setIsOwner(false)
                        setIsAdmin(true)
                        setPermissions(FULL_PERMISSIONS)
                        setLoading(false)
                    }
                    return
                }

                // ── Step 5: Plain member ──────────────────────────────────────
                // Resolution priority:
                //   A) /members/{uid} sub-doc permissions field (ManageTeam saves here)
                //   B) teamMembers[uid].permissions field
                //   C) DEFAULT_MEMBER_PERMISSIONS (member exists → give read access)
                //
                // NEVER fall back to EMPTY_MEMBER_PERMISSIONS for a confirmed member
                // because that locks them out completely

                let resolvedPermissions: MemberPermissions = DEFAULT_MEMBER_PERMISSIONS
                let source = 'default'

                try {
                    const memberDocSnap = await getDoc(
                        doc(db, 'projects', projectId, 'members', user.uid)
                    )

                    if (!active || !mountedRef.current) return

                    console.log('🔍 usePermissions: /members doc exists =',
                        memberDocSnap.exists(),
                        memberDocSnap.exists() ? memberDocSnap.data() : 'no doc'
                    )

                    if (memberDocSnap.exists()) {
                        const memberDocData = memberDocSnap.data()

                        if (isValidPermissions(memberDocData.permissions)) {
                            // ✅ Best source — ManageTeam saves here
                            resolvedPermissions = memberDocData.permissions
                            source = '/members sub-doc'
                        } else if (isValidPermissions(memberEntry.permissions)) {
                            // ✅ Second best — on teamMembers map
                            resolvedPermissions = memberEntry.permissions
                            source = 'teamMembers map'
                        } else {
                            // Member doc exists but has no valid permissions
                            // → use DEFAULT (member is confirmed, give read access)
                            resolvedPermissions = DEFAULT_MEMBER_PERMISSIONS
                            source = 'default (member doc no permissions)'
                        }
                    } else {
                        // No member sub-doc at all
                        if (isValidPermissions(memberEntry.permissions)) {
                            resolvedPermissions = memberEntry.permissions
                            source = 'teamMembers map (no sub-doc)'
                        } else {
                            // Member is confirmed in teamMembers → DEFAULT not EMPTY
                            resolvedPermissions = DEFAULT_MEMBER_PERMISSIONS
                            source = 'default (no sub-doc, no map permissions)'
                        }
                    }
                } catch (memberErr) {
                    console.warn('⚠️ usePermissions: /members read failed', memberErr)
                    // Even on failure — member IS confirmed in teamMembers map
                    // so give DEFAULT permissions, never EMPTY
                    if (isValidPermissions(memberEntry.permissions)) {
                        resolvedPermissions = memberEntry.permissions
                        source = 'teamMembers map (sub-doc read failed)'
                    } else {
                        resolvedPermissions = DEFAULT_MEMBER_PERMISSIONS
                        source = 'default (sub-doc read failed)'
                    }
                }

                console.log(`✅ usePermissions: resolved as MEMBER via [${source}]`,
                    resolvedPermissions)

                if (!active || !mountedRef.current) return

                const entry: CacheEntry = {
                    isOwner:     false,
                    isAdmin:     false,
                    permissions: resolvedPermissions,
                    ts:          Date.now(),
                    resolved:    true,
                }
                permCache.set(cacheKey, entry)

                setIsOwner(false)
                setIsAdmin(false)
                setPermissions(resolvedPermissions)

            } catch (error) {
                console.error('Error loading permissions:', error)
                if (active && mountedRef.current) {
                    // On unexpected error — give DEFAULT not EMPTY
                    // so a confirmed member isn't locked out
                    setPermissions(DEFAULT_MEMBER_PERMISSIONS)
                }
            } finally {
                if (active && mountedRef.current) {
                    setLoading(false)
                }
            }
        }

        fetchPermissions()

        return () => { active = false }

    }, [projectId, user?.uid, authLoading])

    const canRead = (feature: keyof MemberPermissions): boolean => {
        if (isOwner || isAdmin) return true
        return permissions?.[feature]?.read ?? false
    }

    const canWrite = (feature: keyof MemberPermissions): boolean => {
        if (isOwner || isAdmin) return true
        return permissions?.[feature]?.write ?? false
    }

    return { permissions, loading, isOwner, isAdmin, canRead, canWrite }
}
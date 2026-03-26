import { useState, useEffect, useRef } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/hooks/use-auth'
import { useParams } from 'react-router-dom'

export type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer'

interface ProjectPermissions {
    role:             ProjectRole | null
    canEdit:          boolean
    canManageTeam:    boolean
    canDeleteProject: boolean
    loading:          boolean
}

export function useProjectRole(): ProjectPermissions {

    // !! ALL HOOKS UNCONDITIONALLY AT TOP !!
    const { id: projectId }              = useParams()
    const { user, loading: authLoading } = useAuth()

    const [role,    setRole]    = useState<ProjectRole | null>(null)
    const [loading, setLoading] = useState(true)

    const mountedRef = useRef(true)
    useEffect(() => {
        mountedRef.current = true
        return () => { mountedRef.current = false }
    }, [])

    useEffect(() => {
        // Guards INSIDE effect — never before hooks
        if (authLoading) return
        if (!projectId || !user) {
            setLoading(false)
            return
        }

        let active = true

        const fetchRole = async () => {
            try {
                // Project doc is public read — never fails
                const projectSnap = await getDoc(doc(db, 'projects', projectId))

                if (!active || !mountedRef.current) return

                if (!projectSnap.exists()) {
                    setRole(null)
                    setLoading(false)
                    return
                }

                const data = projectSnap.data()

                // ── Owner? ────────────────────────────────────────────────────
                if (data.createdBy === user.uid) {
                    if (active && mountedRef.current) {
                        setRole('owner')
                        setLoading(false)
                    }
                    return
                }

                // ── In teamMembers map? ───────────────────────────────────────
                const memberEntry = data.teamMembers?.[user.uid]

                if (memberEntry) {
                    const r = (memberEntry.role ?? '').toLowerCase()
                    let resolvedRole: ProjectRole = 'member'

                    if (r === 'owner' || r === 'admin') {
                        resolvedRole = 'admin'
                    } else if (r === 'viewer') {
                        resolvedRole = 'viewer'
                    } else {
                        resolvedRole = 'member'
                    }

                    if (active && mountedRef.current) {
                        setRole(resolvedRole)
                        setLoading(false)
                    }
                    return
                }

                // ── Not a member ──────────────────────────────────────────────
                if (active && mountedRef.current) {
                    setRole(null)
                    setLoading(false)
                }

            } catch (error) {
                console.error('Error fetching project role:', error)
                if (active && mountedRef.current) {
                    setRole(null)
                    setLoading(false)
                }
            }
        }

        fetchRole()

        return () => { active = false }

    }, [projectId, user?.uid, authLoading])
    //          ^^^^^^^^^^
    // user?.uid — stable primitive, not object reference

    const canEdit          = role === 'owner' || role === 'admin' || role === 'member'
    const canManageTeam    = role === 'owner' || role === 'admin'
    const canDeleteProject = role === 'owner'

    return { role, canEdit, canManageTeam, canDeleteProject, loading }
}
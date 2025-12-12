import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/hooks/use-auth'
import { useParams } from 'react-router-dom'

export type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer'

interface ProjectPermissions {
    role: ProjectRole | null
    canEdit: boolean
    canManageTeam: boolean
    canDeleteProject: boolean
    loading: boolean
}

export function useProjectRole(): ProjectPermissions {
    const { id: projectId } = useParams()
    const { user } = useAuth()
    const [role, setRole] = useState<ProjectRole | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!projectId || !user) {
            setLoading(false)
            return
        }

        // First check if user is the project owner (from project doc)
        const projectUnsub = onSnapshot(doc(db, 'projects', projectId), (snapshot) => {
            if (snapshot.exists() && snapshot.data().createdBy === user.uid) {
                setRole('owner')
                setLoading(false)
            } else {
                // If not owner, check members subcollection
                const memberUnsub = onSnapshot(doc(db, 'projects', projectId, 'members', user.uid), (memberSnap) => {
                    if (memberSnap.exists()) {
                        setRole(memberSnap.data().role as ProjectRole)
                    } else {
                        setRole(null)
                    }
                    setLoading(false)
                }, (error) => {
                    console.error("Error fetching member role:", error)
                    setLoading(false)
                })

                return () => memberUnsub()
            }
        }, (error) => {
            console.error("Error fetching project:", error)
            setLoading(false)
        })

        return () => projectUnsub()
    }, [projectId, user])

    const canEdit = role === 'owner' || role === 'admin' || role === 'member'
    const canManageTeam = role === 'owner' || role === 'admin'
    const canDeleteProject = role === 'owner'

    return {
        role,
        canEdit,
        canManageTeam,
        canDeleteProject,
        loading
    }
}

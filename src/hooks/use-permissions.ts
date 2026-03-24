import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'

export interface MemberPermissions {
    dashboard: { read: boolean; write: boolean }
    tasks: { read: boolean; write: boolean }
    whiteboard: { read: boolean; write: boolean }
    files: { read: boolean; write: boolean }
    chat: { read: boolean; write: boolean }
    calendar: { read: boolean; write: boolean }
    gantt: { read: boolean; write: boolean }
    settings: { read: boolean; write: boolean }
}

interface UsePermissionsReturn {
    permissions: MemberPermissions | null
    loading: boolean
    isOwner: boolean
    isAdmin: boolean
    canRead: (feature: keyof MemberPermissions) => boolean
    canWrite: (feature: keyof MemberPermissions) => boolean
}

// Default full permissions for owner/admin
const FULL_PERMISSIONS: MemberPermissions = {
    dashboard: { read: true, write: true },
    tasks: { read: true, write: true },
    whiteboard: { read: true, write: true },
    files: { read: true, write: true },
    chat: { read: true, write: true },
    calendar: { read: true, write: true },
    gantt: { read: true, write: true },
    settings: { read: true, write: true }
}

// Default minimal permissions (fallback)
const MINIMAL_PERMISSIONS: MemberPermissions = {
    dashboard: { read: true, write: false },
    tasks: { read: false, write: false },
    whiteboard: { read: false, write: false },
    files: { read: false, write: false },
    chat: { read: false, write: false },
    calendar: { read: false, write: false },
    gantt: { read: false, write: false },
    settings: { read: false, write: false }
}

/** New members start with everything off until the owner enables access in Manage Team */
export const EMPTY_MEMBER_PERMISSIONS: MemberPermissions = {
    dashboard: { read: false, write: false },
    tasks: { read: false, write: false },
    whiteboard: { read: false, write: false },
    files: { read: false, write: false },
    chat: { read: false, write: false },
    calendar: { read: false, write: false },
    gantt: { read: false, write: false },
    settings: { read: false, write: false }
}

export function usePermissions(): UsePermissionsReturn {
    const { id: projectId } = useParams()
    const [permissions, setPermissions] = useState<MemberPermissions | null>(null)
    const [loading, setLoading] = useState(true)
    const [isOwner, setIsOwner] = useState(false)
    const [isAdmin, setIsAdmin] = useState(false)

    useEffect(() => {
        if (projectId && auth.currentUser) {
            loadPermissions()
        } else {
            setLoading(false)
        }
    }, [projectId, auth.currentUser])

    const loadPermissions = async () => {
        if (!projectId || !auth.currentUser) {
            setLoading(false)
            return
        }

        try {
            const userId = auth.currentUser.uid

            // First check if user is the project owner
            const projectDoc = await getDoc(doc(db, 'projects', projectId))
            if (projectDoc.exists()) {
                const projectData = projectDoc.data()
                if (projectData.createdBy === userId) {
                    setIsOwner(true)
                    setIsAdmin(true)
                    setPermissions(FULL_PERMISSIONS)
                    setLoading(false)
                    return
                }
            }

            // Check member permissions from the members subcollection
            const membersRef = collection(db, 'projects', projectId, 'members')
            const memberQuery = query(membersRef, where('uid', '==', userId))
            const memberSnapshot = await getDocs(memberQuery)

            if (!memberSnapshot.empty) {
                const memberData = memberSnapshot.docs[0].data()
                const role = memberData.role

                // Check if admin
                if (role === 'admin' || role === 'owner') {
                    setIsAdmin(true)
                    setPermissions(FULL_PERMISSIONS)
                } else if (memberData.permissions) {
                    // Use custom permissions if set
                    setPermissions(memberData.permissions as MemberPermissions)
                } else {
                    if (role === 'member') {
                        setPermissions(EMPTY_MEMBER_PERMISSIONS)
                    } else {
                        setPermissions(MINIMAL_PERMISSIONS)
                    }
                }
            } else {
                // Not a member - give minimal permissions (read-only dashboard)
                setPermissions(MINIMAL_PERMISSIONS)
            }
        } catch (error) {
            console.error('Error loading permissions:', error)
            setPermissions(MINIMAL_PERMISSIONS)
        } finally {
            setLoading(false)
        }
    }

    const canRead = (feature: keyof MemberPermissions): boolean => {
        if (isOwner || isAdmin) return true
        if (!permissions) return false
        return permissions[feature]?.read ?? false
    }

    const canWrite = (feature: keyof MemberPermissions): boolean => {
        if (isOwner || isAdmin) return true
        if (!permissions) return false
        return permissions[feature]?.write ?? false
    }

    return {
        permissions,
        loading,
        isOwner,
        isAdmin,
        canRead,
        canWrite
    }
}

import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { cachedGetDoc } from '@/lib/queryUtils'

interface UseAdminReturn {
    isAdmin: boolean
    loading: boolean
    adminLevel?: 'admin' | 'super-admin' | 'moderator'
    permissions?: string[]
}

/**
 * Custom hook to check if the current user has admin privileges.
 * Uses real-time listener for immediate updates and caching for performance.
 */
export function useAdmin(): UseAdminReturn {
    const { user } = useAuth()
    const [isAdmin, setIsAdmin] = useState(false)
    const [adminLevel, setAdminLevel] = useState<'admin' | 'super-admin' | 'moderator'>()
    const [permissions, setPermissions] = useState<string[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!user) {
            setIsAdmin(false)
            setAdminLevel(undefined)
            setPermissions([])
            setLoading(false)
            return
        }

        // Use real-time listener for immediate admin status updates
        const unsubscribe = onSnapshot(
            doc(db, 'users', user.uid),
            (doc) => {
                try {
                    if (doc.exists()) {
                        const userData = doc.data()
                        const role = userData.role
                        const userPermissions = userData.permissions || []
                        
                        // Check multiple admin roles
                        const adminRoles = ['admin', 'super-admin', 'moderator']
                        const isUserAdmin = adminRoles.includes(role)
                        
                        setIsAdmin(isUserAdmin)
                        setAdminLevel(isUserAdmin ? role : undefined)
                        setPermissions(userPermissions)
                        
                        // Additional security check - verify admin status with server
                        if (isUserAdmin) {
                            verifyAdminWithServer(user.uid)
                        }
                    } else {
                        setIsAdmin(false)
                        setAdminLevel(undefined)
                        setPermissions([])
                    }
                } catch (error) {
                    console.error('Error checking admin status:', error)
                    setIsAdmin(false)
                    setAdminLevel(undefined)
                    setPermissions([])
                } finally {
                    setLoading(false)
                }
            },
            (error) => {
                console.error('Admin status listener error:', error)
                setIsAdmin(false)
                setAdminLevel(undefined)
                setPermissions([])
                setLoading(false)
            }
        )

        return () => unsubscribe()
    }, [user])

    return { isAdmin, loading, adminLevel, permissions }
}

/**
 * Verify admin status with server-side validation
 * In production, this should call a Cloud Function for security
 */
async function verifyAdminWithServer(userId: string): Promise<boolean> {
    try {
        // TODO: Replace with Cloud Function call in production
        // const response = await fetch('/api/verify-admin', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ userId, role })
        // })
        // return response.ok
        
        // Temporary client-side verification (not secure for production)
        const userDoc = await cachedGetDoc(doc(db, 'users', userId), {
            userId,
            ttl: 60000 // 1 minute cache
        })
        
        if (!userDoc.exists()) return false
        
        const userData = userDoc.data()
        const adminRoles = ['admin', 'super-admin', 'moderator']
        
        return adminRoles.includes(userData.role) && !userData.disabled
    } catch (error) {
        console.error('Server admin verification failed:', error)
        return false
    }
}

/**
 * Check if user has specific permission
 */
export function usePermission(permission: string): boolean {
    const { isAdmin, permissions, adminLevel } = useAdmin()
    
    if (!isAdmin) return false
    
    // Super admins have all permissions
    if (adminLevel === 'super-admin') return true
    
    // Check specific permissions
    return permissions?.includes(permission) || false
}

/**
 * Admin permissions constants
 */
export const ADMIN_PERMISSIONS = {
    MANAGE_USERS: 'manage_users',
    MANAGE_PROJECTS: 'manage_projects',
    MODERATE_CONTENT: 'moderate_content',
    VIEW_ANALYTICS: 'view_analytics',
    MANAGE_ANNOUNCEMENTS: 'manage_announcements',
    SYSTEM_SETTINGS: 'system_settings',
    DELETE_DATA: 'delete_data',
    EXPORT_DATA: 'export_data'
} as const

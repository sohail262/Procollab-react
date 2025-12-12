import { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'

interface UseAdminReturn {
    isAdmin: boolean
    loading: boolean
}

/**
 * Custom hook to check if the current user has admin privileges.
 * Checks the 'role' field in the user's Firestore document.
 */
export function useAdmin(): UseAdminReturn {
    const { user } = useAuth()
    const [isAdmin, setIsAdmin] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function checkAdminStatus() {
            if (!user) {
                setIsAdmin(false)
                setLoading(false)
                return
            }

            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid))
                if (userDoc.exists()) {
                    const userData = userDoc.data()
                    setIsAdmin(userData.role === 'admin')
                } else {
                    setIsAdmin(false)
                }
            } catch (error) {
                console.error('Error checking admin status:', error)
                setIsAdmin(false)
            } finally {
                setLoading(false)
            }
        }

        checkAdminStatus()
    }, [user])

    return { isAdmin, loading }
}

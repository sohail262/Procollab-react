import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useAdmin } from '@/hooks/useAdmin'
import { Loader2, ShieldX } from 'lucide-react'

interface AdminRouteProps {
    children: React.ReactNode
}

/**
 * Protected route component that only allows admin users.
 * Redirects to dashboard if user is not an admin.
 */
export function AdminRoute({ children }: AdminRouteProps) {
    const { user, loading: authLoading } = useAuth()
    const { isAdmin, loading: adminLoading } = useAdmin()

    // Show loading while checking auth and admin status
    if (authLoading || adminLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">Verifying access...</p>
                </div>
            </div>
        )
    }

    // Redirect to login if not authenticated
    if (!user) {
        return <Navigate to="/login?redirect=/admin" replace />
    }

    // Show access denied if not admin
    if (!isAdmin) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
                <div className="text-center max-w-md mx-auto p-8">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                        <ShieldX className="h-8 w-8 text-red-600 dark:text-red-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        Access Denied
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        You don't have permission to access the admin dashboard.
                        This area is restricted to platform administrators only.
                    </p>
                    <a
                        href="/dashboard"
                        className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Go to Dashboard
                    </a>
                </div>
            </div>
        )
    }

    return <>{children}</>
}

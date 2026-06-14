/**
 * usePageTracking.ts
 * ------------------
 * Fires a `page_view` analytics event on every route change.
 * Drop this into App.tsx inside the Router context.
 */
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { trackPageView } from '@/services/analyticsService'

export function usePageTracking() {
    const location = useLocation()
    const { user } = useAuth()

    useEffect(() => {
        trackPageView(location.pathname, user?.uid)
    }, [location.pathname, user?.uid])
}

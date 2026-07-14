import { useEffect, useContext } from 'react'
import { useLocation } from 'react-router-dom'
import { AuthContext } from '@/contexts/AuthContext'
import { trackPageView } from '@/services/analyticsService'

export function usePageTracking() {
    const location = useLocation()
    const auth = useContext(AuthContext)
    const user = auth?.user

    useEffect(() => {
        trackPageView(location.pathname, user?.uid)
    }, [location.pathname, user?.uid])
}

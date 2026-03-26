/**
 * useFCM Hook
 *
 * Manages FCM lifecycle:
 * 1. Does NOT auto-request permission on mount
 *    → Permission is requested via NotificationPermissionPrompt
 * 2. Initializes foreground listener if permission already granted
 * 3. Handles token refresh
 * 4. Cleans up on logout
 */

import { useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    registerFCMToken,
    unregisterFCMToken,
    initForegroundMessaging,
    cleanupForegroundMessaging,
    refreshFCMTokenIfNeeded,
    type FCMNotificationPayload,
} from '@/services/fcmService'
import { useToast } from '@/hooks/use-toast'

interface UseFCMOptions {
    userId: string | null
}

export function useFCM({ userId }: UseFCMOptions) {
    const { toast } = useToast()
    const navigate = useNavigate()
    const initializedRef = useRef(false)
    const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
        null
    )
    const visibilityCleanupRef = useRef<(() => void) | null>(null)

    // ─── Foreground notification handler ─────────────────
    const handleForegroundNotification = useCallback(
        (payload: FCMNotificationPayload) => {
            // ✅ In-app toast only — no browser push shown in foreground
            toast({
                title: payload.title,
                description: payload.body,
                variant: getToastVariant(payload.type),
            })

            // Navigate if URL provided and user clicks
            // Note: toast action handled separately if your
            // toast component supports it
        },
        [toast]
    )

    // ─── Initialize FCM ───────────────────────────────────
    useEffect(() => {
        if (!userId) return

        // ✅ StrictMode guard — prevents double initialization
        if (initializedRef.current) return
        initializedRef.current = true

        let mounted = true

        const init = async () => {
            try {
                // ✅ Only proceed if permission already granted
                // If not granted, NotificationPermissionPrompt
                // will call requestPermissionAndRegister() separately
                if (Notification.permission === 'granted') {
                    await registerFCMToken(userId)
                    if (!mounted) return
                    initForegroundMessaging(
                        userId,
                        handleForegroundNotification
                    )
                } else {
                    // Still set up foreground listener for when
                    // permission gets granted later
                    initForegroundMessaging(
                        userId,
                        handleForegroundNotification
                    )
                }

                // ✅ Periodic token refresh — every 6 hours
                refreshIntervalRef.current = setInterval(() => {
                    if (mounted && Notification.permission === 'granted') {
                        refreshFCMTokenIfNeeded(userId)
                    }
                }, 6 * 60 * 60 * 1000)

                // ✅ Refresh token on tab focus
                const handleVisibility = () => {
                    if (
                        !document.hidden &&
                        mounted &&
                        Notification.permission === 'granted'
                    ) {
                        refreshFCMTokenIfNeeded(userId)
                    }
                }
                document.addEventListener('visibilitychange', handleVisibility)
                visibilityCleanupRef.current = () => {
                    document.removeEventListener(
                        'visibilitychange',
                        handleVisibility
                    )
                }

                console.log('[useFCM] Initialized for user:', userId)
            } catch (error) {
                console.error('[useFCM] Init error:', error)
            }
        }

        init()

        return () => {
            mounted = false
            initializedRef.current = false
            cleanupForegroundMessaging()

            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current)
                refreshIntervalRef.current = null
            }

            visibilityCleanupRef.current?.()
            visibilityCleanupRef.current = null

            console.log('[useFCM] Cleaned up for user:', userId)
        }
    }, [userId, handleForegroundNotification])

    // ─── Logout handler ───────────────────────────────────
    const handleLogout = useCallback(async () => {
        if (!userId) return
        try {
            await unregisterFCMToken(userId)
        } catch (error) {
            console.error('[useFCM] Logout cleanup error:', error)
        }
        cleanupForegroundMessaging()
        initializedRef.current = false
    }, [userId])

    return { handleLogout }
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function getToastVariant(
    type: string
): 'default' | 'success' | 'warning' | 'destructive' {
    switch (type) {
        case 'success':
        case 'connection_accepted':
            return 'success'
        case 'warning':
        case 'connection_rejected':
        case 'connection_withdrawn':
            return 'warning'
        case 'error':
            return 'destructive'
        default:
            return 'default'
    }
}
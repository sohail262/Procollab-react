/**
 * Controls when to show the notification permission prompt.
 *
 * Rules:
 * - Already granted/denied → never show
 * - Dismissed → don't show again for 7 days
 * - First visit → show after 4 seconds (let page settle)
 * - Not logged in → never show
 */

import { useState, useEffect } from 'react'
import { requestPermissionAndRegister } from '@/services/fcmService'

const STORAGE_KEY = 'procollab_notif_dismissed_at'
const DISMISS_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days in ms
const SHOW_DELAY_MS = 4000 // 4 seconds after login

export function useNotificationPrompt(userId: string | null) {
    const [showPrompt, setShowPrompt] = useState(false)

    useEffect(() => {
        if (!userId) {
            setShowPrompt(false)
            return
        }

        // Not supported
        if (!('Notification' in window)) return

        // Already decided by browser
        if (
            Notification.permission === 'granted' ||
            Notification.permission === 'denied'
        ) return

        // Check recent dismissal
        const dismissedAt = localStorage.getItem(STORAGE_KEY)
        if (dismissedAt) {
            const elapsed = Date.now() - parseInt(dismissedAt, 10)
            if (elapsed < DISMISS_TTL) return
        }

        // Show after delay
        const timer = setTimeout(() => {
            setShowPrompt(true)
        }, SHOW_DELAY_MS)

        return () => clearTimeout(timer)
    }, [userId])

    const handleDismiss = () => {
        setShowPrompt(false)
        localStorage.setItem(STORAGE_KEY, Date.now().toString())
    }

    const handleAccept = async (userId: string): Promise<void> => {
        const success = await requestPermissionAndRegister(userId)
        if (success) {
            localStorage.removeItem(STORAGE_KEY)
            setShowPrompt(false)
        }
    }

    return { showPrompt, handleDismiss, handleAccept }
}
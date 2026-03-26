/**
 * FCM Service — Token management + foreground message handling
 *
 * DUPLICATE PREVENTION ARCHITECTURE:
 * ─────────────────────────────────────────────────────────
 * FOREGROUND: onMessage() fires here → show in-app toast only
 *             SW does NOT show browser push (FCM suppresses it)
 *
 * BACKGROUND: SW fires → shows ONE browser push
 *             onMessage() does NOT fire
 *
 * RESULT: Exactly ONE notification in ALL scenarios
 *
 * 401 FIX:
 * - Register SW explicitly before calling getToken()
 * - Pass serviceWorkerRegistration to getToken()
 * - This ensures FCM uses OUR SW, not a default one
 */

import {
    getMessaging,
    getToken,
    onMessage,
    deleteToken,
    isSupported,
    type MessagePayload,
} from 'firebase/messaging'
import {
    doc,
    collection,
    query,
    where,
    getDocs,
    setDoc,
    deleteDoc,
    updateDoc,
    serverTimestamp,
    writeBatch,
    Timestamp,
} from 'firebase/firestore'
import { app, db } from '@/lib/firebase'

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

// ✅ VAPID key from Firebase Console → Project Settings
//    → Cloud Messaging → Web Push certificates
const VAPID_KEY =
    'BOhnhTBouqFbYv78EDTBCU6AUdhN_DGnXb3xzJ9BlhPOD3LWOQVaDz4-CmodBfIcfy6IHWyeUR5GBH9VvfCR1oA'

const SW_PATH = '/firebase-messaging-sw.js'
const TOKEN_REFRESH_INTERVAL = 7 * 24 * 60 * 60 * 1000 // 7 days
const MAX_TOKENS_PER_USER = 5

// ─────────────────────────────────────────────────────────
// Module-level singletons
// ─────────────────────────────────────────────────────────

let foregroundUnsubscribe: (() => void) | null = null
let currentUserId: string | null = null
let messagingInstance: ReturnType<typeof getMessaging> | null = null
let swRegistration: ServiceWorkerRegistration | null = null

// ─────────────────────────────────────────────────────────
// Service Worker Registration
// ─────────────────────────────────────────────────────────

/**
 * Register and cache the Firebase Messaging Service Worker.
 *
 * ✅ ROOT CAUSE FIX for 401:
 * getToken() must receive the SW registration explicitly.
 * Without it, the browser tries to use a default SW scope
 * that doesn't have Firebase initialized → 401 Unauthorized.
 */
async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
    // Return cached registration if available
    if (swRegistration) return swRegistration

    if (!('serviceWorker' in navigator)) {
        console.warn('[FCM] Service Worker not supported')
        return null
    }

    try {
        // ✅ Check if SW is already registered (avoid double registration)
        const registrations = await navigator.serviceWorker.getRegistrations()
        const existing = registrations.find(r =>
            r.active?.scriptURL.includes('firebase-messaging-sw.js') ||
            r.installing?.scriptURL.includes('firebase-messaging-sw.js') ||
            r.waiting?.scriptURL.includes('firebase-messaging-sw.js')
        )

        if (existing) {
            swRegistration = existing
            console.log('[FCM] Using existing SW registration')
            return swRegistration
        }

        // Register fresh
        swRegistration = await navigator.serviceWorker.register(SW_PATH, {
            scope: '/',
        })

        // Wait for the SW to be active before proceeding
        if (swRegistration.installing) {
            await new Promise<void>((resolve) => {
                const sw = swRegistration!.installing!
                sw.addEventListener('statechange', () => {
                    if (sw.state === 'activated') resolve()
                })
                // If already activated by the time we listen
                if (sw.state === 'activated') resolve()
            })
        }

        console.log('[FCM] SW registered successfully:', swRegistration.scope)
        return swRegistration

    } catch (error) {
        console.error('[FCM] SW registration failed:', error)
        return null
    }
}

// ─────────────────────────────────────────────────────────
// Messaging Instance
// ─────────────────────────────────────────────────────────

async function getMessagingInstance() {
    if (messagingInstance) return messagingInstance

    try {
        const supported = await isSupported()
        if (!supported) {
            console.log('[FCM] Not supported in this browser')
            return null
        }
        messagingInstance = getMessaging(app)
        return messagingInstance
    } catch (error) {
        console.error('[FCM] Error getting messaging instance:', error)
        return null
    }
}

// ─────────────────────────────────────────────────────────
// Token Registration
// ─────────────────────────────────────────────────────────

/**
 * Register this device for push notifications.
 *
 * Steps:
 * 1. Check browser support
 * 2. Register Service Worker explicitly
 * 3. Request notification permission
 * 4. Get FCM token — passing SW registration (fixes 401)
 * 5. Save to Firestore with deduplication
 */
export async function registerFCMToken(
    userId: string
): Promise<string | null> {
    try {
        const messaging = await getMessagingInstance()
        if (!messaging) return null

        // ✅ Step 1: Register SW first — required for getToken()
        const swReg = await getServiceWorkerRegistration()
        if (!swReg) {
            console.warn('[FCM] No SW registration — cannot get token')
            return null
        }

        // ✅ Step 2: Check current permission state
        // Do NOT call requestPermission() here —
        // permission should be requested via the UI prompt
        // (NotificationPermissionPrompt component)
        // This function is called AFTER user clicks "Enable"
        if (Notification.permission !== 'granted') {
            console.log('[FCM] Permission not granted:', Notification.permission)
            return null
        }

        // ✅ Step 3: Get token — pass BOTH vapidKey AND serviceWorkerRegistration
        // This is the key fix for the 401 error
        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: swReg,
        })

        if (!token) {
            console.warn('[FCM] No token returned from getToken()')
            return null
        }

        console.log('[FCM] Token obtained successfully')

        // ✅ Step 4: Save with deduplication
        await saveTokenToFirestore(userId, token)
        return token

    } catch (error: any) {
        // Provide specific error messages for common failures
        if (error?.code === 'messaging/token-subscribe-failed') {
            console.error(
                '[FCM] Token subscribe failed — check VAPID key and SW registration'
            )
        } else if (error?.code === 'messaging/permission-blocked') {
            console.warn('[FCM] Notifications blocked by user')
        } else {
            console.error('[FCM] Error registering token:', error)
        }
        return null
    }
}

/**
 * Request permission AND register token.
 * Call this when user clicks "Enable Notifications" in the prompt.
 */
export async function requestPermissionAndRegister(
    userId: string
): Promise<boolean> {
    try {
        // ✅ Register SW first before asking for permission
        // Some browsers need SW active before permission grant
        await getServiceWorkerRegistration()

        const permission = await Notification.requestPermission()

        if (permission !== 'granted') {
            console.log('[FCM] Permission not granted:', permission)
            return false
        }

        const token = await registerFCMToken(userId)
        return token !== null

    } catch (error) {
        console.error('[FCM] Error requesting permission:', error)
        return false
    }
}

// ─────────────────────────────────────────────────────────
// Token Storage (Firestore)
// ─────────────────────────────────────────────────────────

async function saveTokenToFirestore(
    userId: string,
    token: string
): Promise<void> {
    const tokensRef = collection(db, 'users', userId, 'fcmTokens')

    // ✅ Check exact token exists — skip write if so
    const existingSnap = await getDocs(
        query(tokensRef, where('token', '==', token))
    )

    if (!existingSnap.empty) {
        await updateDoc(existingSnap.docs[0].ref, {
            lastUsed: serverTimestamp(),
        })
        console.log('[FCM] Token exists — updated lastUsed')
        return
    }

    // Check token count
    const allSnap = await getDocs(tokensRef)

    // ✅ Enforce max tokens — remove oldest if at limit
    if (allSnap.docs.length >= MAX_TOKENS_PER_USER) {
        const sorted = [...allSnap.docs].sort((a, b) => {
            const aTime = (a.data().lastUsed as Timestamp)?.toMillis() || 0
            const bTime = (b.data().lastUsed as Timestamp)?.toMillis() || 0
            return aTime - bTime
        })
        await deleteDoc(sorted[0].ref)
        console.log('[FCM] Removed oldest token')
    }

    // ✅ Use deterministic doc ID based on token
    // Provides natural dedup at Firestore document level
    const tokenDocId = btoa(token)
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 20)

    await setDoc(doc(tokensRef, tokenDocId), {
        token,
        createdAt: serverTimestamp(),
        lastUsed: serverTimestamp(),
        userAgent: navigator.userAgent,
        platform: navigator.platform,
    })

    console.log('[FCM] New token saved:', tokenDocId)
}

// ─────────────────────────────────────────────────────────
// Token Unregistration (Logout)
// ─────────────────────────────────────────────────────────

export async function unregisterFCMToken(userId: string): Promise<void> {
    try {
        const messaging = await getMessagingInstance()
        if (!messaging) return

        const swReg = await getServiceWorkerRegistration()

        // Get current token to find and delete it
        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: swReg ?? undefined,
        }).catch(() => null)

        if (token) {
            // Remove from Firestore
            const tokensRef = collection(db, 'users', userId, 'fcmTokens')
            const snap = await getDocs(
                query(tokensRef, where('token', '==', token))
            )
            if (!snap.empty) {
                const batch = writeBatch(db)
                snap.docs.forEach(d => batch.delete(d.ref))
                await batch.commit()
            }

            // Delete from FCM
            await deleteToken(messaging)
        }

        // Clear cached SW registration
        swRegistration = null
        console.log('[FCM] Token unregistered successfully')

    } catch (error) {
        console.error('[FCM] Error unregistering token:', error)
    }
}

// ─────────────────────────────────────────────────────────
// Foreground Message Handler
// ─────────────────────────────────────────────────────────

/**
 * Listen for messages when app is in FOREGROUND.
 *
 * FCM behaviour:
 * - Foreground: this fires, SW does NOT show push → 1 notification
 * - Background: SW fires, this does NOT fire → 1 notification
 *
 * We only register ONE listener via the singleton guard below.
 */
export function initForegroundMessaging(
    userId: string,
    onNotification: (payload: FCMNotificationPayload) => void
): void {
    // ✅ Always clean up before re-registering
    if (foregroundUnsubscribe) {
        foregroundUnsubscribe()
        foregroundUnsubscribe = null
        console.log('[FCM] Cleaned up previous foreground listener')
    }

    // ✅ Skip if same user already has active listener
    if (currentUserId === userId && foregroundUnsubscribe) {
        console.log('[FCM] Listener already active for user:', userId)
        return
    }

    getMessagingInstance().then(messaging => {
        if (!messaging) return

        foregroundUnsubscribe = onMessage(
            messaging,
            (payload: MessagePayload) => {
                console.log('[FCM] Foreground message:', payload)

                const notifPayload: FCMNotificationPayload = {
                    title:
                        payload.notification?.title ||
                        payload.data?.title ||
                        'ProCollab',
                    body:
                        payload.notification?.body ||
                        payload.data?.body ||
                        'You have a new notification',
                    icon:
                        payload.data?.icon ||
                        payload.notification?.icon ||
                        null,
                    url: payload.data?.url || '/',
                    type: (payload.data?.type as any) || 'info',
                    projectId: payload.data?.projectId || null,
                    notificationId: payload.data?.notificationId || null,
                }

                onNotification(notifPayload)
            }
        )

        currentUserId = userId
        console.log('[FCM] Foreground listener active for:', userId)
    })
}

export function cleanupForegroundMessaging(): void {
    if (foregroundUnsubscribe) {
        foregroundUnsubscribe()
        foregroundUnsubscribe = null
        currentUserId = null
        console.log('[FCM] Foreground listener removed')
    }
}

// ─────────────────────────────────────────────────────────
// Token Refresh
// ─────────────────────────────────────────────────────────

export async function refreshFCMTokenIfNeeded(
    userId: string
): Promise<void> {
    try {
        // Only refresh if permission is still granted
        if (Notification.permission !== 'granted') return

        const tokensRef = collection(db, 'users', userId, 'fcmTokens')
        const snap = await getDocs(tokensRef)

        if (snap.empty) {
            await registerFCMToken(userId)
            return
        }

        const now = Date.now()
        const needsRefresh = snap.docs.some(d => {
            const lastUsed =
                (d.data().lastUsed as Timestamp)?.toMillis() || 0
            return now - lastUsed > TOKEN_REFRESH_INTERVAL
        })

        if (needsRefresh) {
            console.log('[FCM] Refreshing stale token')
            await registerFCMToken(userId)
        }
    } catch (error) {
        console.error('[FCM] Token refresh error:', error)
    }
}

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface FCMNotificationPayload {
    title: string
    body: string
    icon?: string | null
    url?: string
    type:
        | 'info'
        | 'success'
        | 'warning'
        | 'error'
        | 'connection_request'
        | 'connection_accepted'
        | 'connection_rejected'
        | 'connection_withdrawn'
        | string
    projectId?: string | null
    notificationId?: string | null
}
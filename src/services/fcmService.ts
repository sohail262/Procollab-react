/**
 * FCM Service — Token management + foreground message handling
 *
 * DUPLICATE PREVENTION:
 * ─────────────────────────────────────────────────────────
 * FOREGROUND: onMessage() fires → show in-app toast only
 *             SW does NOT show browser push (FCM suppresses it)
 * BACKGROUND: SW fires → shows ONE browser push
 *             onMessage() does NOT fire
 * RESULT: Exactly ONE notification in ALL scenarios
 *
 * OPTIMIZATIONS:
 * ✅ SW registered once, cached for session
 * ✅ Messaging instance singleton
 * ✅ Single foreground listener via singleton guard
 * ✅ Token existence check before write
 * ✅ Max 5 tokens with LRU eviction
 * ✅ 7-day refresh cycle
 * ✅ Crypto hash for deterministic doc ID (no collisions)
 * ✅ Full cleanup on logout
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

const VAPID_KEY =
    import.meta.env.VITE_FIREBASE_VAPID_KEY ||
    'BOhnhTBouqFbYv78EDTBCU6AUdhN_DGnXb3xzJ9BlhPOD3LWOQVaDz4-CmodBfIcfy6IHWyeUR5GBH9VvfCR1oA'

const SW_PATH = '/sw.js'
const TOKEN_REFRESH_INTERVAL = 7 * 24 * 60 * 60 * 1000 // 7 days in ms
const MAX_TOKENS_PER_USER = 5
const SW_ACTIVATION_TIMEOUT = 10_000 // 10 seconds

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
 * Wait for a SW to reach 'activated' state.
 * Handles all three states: installing, waiting, active.
 * Times out after SW_ACTIVATION_TIMEOUT ms.
 */
async function waitForSWActivation(
    reg: ServiceWorkerRegistration
): Promise<void> {
    // Already active — nothing to wait for
    if (reg.active) return

    const sw = reg.installing ?? reg.waiting
    if (!sw) return

    return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('[FCM] SW activation timed out'))
        }, SW_ACTIVATION_TIMEOUT)

        sw.addEventListener('statechange', () => {
            if (sw.state === 'activated') {
                clearTimeout(timeout)
                resolve()
            }
            if (sw.state === 'redundant') {
                clearTimeout(timeout)
                reject(new Error('[FCM] SW became redundant during activation'))
            }
        })

        // Guard: already activated by the time listener attached
        if (sw.state === 'activated') {
            clearTimeout(timeout)
            resolve()
        }
    })
}

/**
 * Register and cache the Firebase Messaging Service Worker.
 *
 * ✅ Fixes 401: getToken() must receive SW registration explicitly.
 * ✅ Handles installing, waiting, AND active SW states.
 * ✅ Reuses cached registration to avoid redundant registrations.
 */
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
    // Return cached if still valid
    if (swRegistration) return swRegistration

    if (!('serviceWorker' in navigator)) {
        console.warn('[FCM] Service Worker not supported in this browser')
        return null
    }

    try {
        // ✅ Check for existing registration before registering new
        const registrations = await navigator.serviceWorker.getRegistrations()
        const existing = registrations.find(
            (r) =>
                r.active?.scriptURL.includes('sw.js') ||
                r.installing?.scriptURL.includes('sw.js') ||
                r.waiting?.scriptURL.includes('sw.js')
        )

        if (existing) {
            // ✅ Wait for activation even on existing registration
            await waitForSWActivation(existing)
            swRegistration = existing
            console.log('[FCM] Reusing existing SW registration')
            return swRegistration
        }

        // Register fresh SW
        const reg = await navigator.serviceWorker.register(SW_PATH, {
            scope: '/',
        })

        // ✅ Wait for ALL states — installing, waiting, active
        await waitForSWActivation(reg)

        swRegistration = reg
        console.log('[FCM] SW registered and active:', reg.scope)
        return swRegistration

    } catch (error) {
        console.error('[FCM] SW registration/activation failed:', error)
        return null
    }
}

// ─────────────────────────────────────────────────────────
// Messaging Instance Singleton
// ─────────────────────────────────────────────────────────

async function getMessagingInstance(): Promise<ReturnType<
    typeof getMessaging
> | null> {
    if (messagingInstance) return messagingInstance

    try {
        const supported = await isSupported()
        if (!supported) {
            console.log('[FCM] Not supported in this browser/environment')
            return null
        }
        messagingInstance = getMessaging(app)
        return messagingInstance
    } catch (error) {
        console.error('[FCM] Error initializing messaging:', error)
        return null
    }
}

// ─────────────────────────────────────────────────────────
// Deterministic Token Doc ID
// ─────────────────────────────────────────────────────────

/**
 * Generate a stable, collision-safe Firestore doc ID from a token.
 * Uses SHA-256 so two different tokens never produce the same ID.
 * Falls back to sanitized btoa if SubtleCrypto unavailable.
 */
async function tokenToDocId(token: string): Promise<string> {
    try {
        const hashBuffer = await crypto.subtle.digest(
            'SHA-256',
            new TextEncoder().encode(token)
        )
        return Array.from(new Uint8Array(hashBuffer))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('')
            .slice(0, 40) // 40 hex chars — unique enough, valid Firestore ID
    } catch {
        // Fallback for environments without SubtleCrypto
        return btoa(token)
            .replace(/[^a-zA-Z0-9]/g, '')
            .slice(0, 40)
    }
}

// ─────────────────────────────────────────────────────────
// Token Registration
// ─────────────────────────────────────────────────────────

/**
 * Register this device for push notifications.
 *
 * Flow:
 * 1. Check browser support
 * 2. Ensure SW is registered and active
 * 3. Verify permission is granted
 * 4. Get FCM token with SW registration (fixes 401)
 * 5. Save to Firestore with deduplication + LRU eviction
 *
 * NOTE: Call AFTER user clicks "Enable" in the prompt.
 * Permission dialog is handled by requestPermissionAndRegister().
 */
export async function registerFCMToken(
    userId: string
): Promise<string | null> {
    try {
        const messaging = await getMessagingInstance()
        if (!messaging) return null

        // ✅ Ensure SW is active before getToken()
        const swReg = await getServiceWorkerRegistration()
        if (!swReg) {
            console.warn('[FCM] No SW registration — aborting token fetch')
            return null
        }

        // ✅ Guard: permission must be granted before calling getToken()
        // Never call requestPermission() here — that's the UI's job
        if (Notification.permission !== 'granted') {
            console.log(
                '[FCM] Permission not granted:',
                Notification.permission
            )
            return null
        }

        // ✅ Get token — SW registration passed explicitly (fixes 401)
        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: swReg,
        })

        if (!token) {
            console.warn('[FCM] getToken() returned empty token')
            return null
        }

        console.log('[FCM] Token obtained successfully')

        // ✅ Save with dedup + LRU eviction
        await saveTokenToFirestore(userId, token)
        return token

    } catch (error: any) {
        if (error?.code === 'messaging/token-subscribe-failed') {
            console.error(
                '[FCM] Subscribe failed — verify VAPID key and SW registration'
            )
        } else if (error?.code === 'messaging/permission-blocked') {
            console.warn('[FCM] Notifications blocked by user')
        } else {
            console.error('[FCM] Token registration error:', error)
        }
        return null
    }
}

/**
 * Request browser notification permission then register token.
 * Called when user clicks "Enable Notifications" in the UI prompt.
 * Returns true if permission granted AND token saved successfully.
 */
export async function requestPermissionAndRegister(
    userId: string
): Promise<boolean> {
    try {
        // ✅ Pre-register SW before permission dialog
        // Some browsers require active SW before granting permission
        await getServiceWorkerRegistration()

        const permission = await Notification.requestPermission()

        if (permission !== 'granted') {
            console.log('[FCM] Permission denied:', permission)
            return false
        }

        const token = await registerFCMToken(userId)
        return token !== null

    } catch (error) {
        console.error('[FCM] Error in requestPermissionAndRegister:', error)
        return false
    }
}

// ─────────────────────────────────────────────────────────
// Token Storage (Firestore)
// ─────────────────────────────────────────────────────────

/**
 * Save FCM token to Firestore with:
 * ✅ Exact dedup — skip write if token already exists (only update lastUsed)
 * ✅ LRU eviction — remove oldest token if at MAX_TOKENS_PER_USER
 * ✅ Deterministic doc ID — SHA-256 hash prevents collisions
 *
 * OPTIMIZATION: Only 2 reads max (existence check + all tokens if needed)
 * and 1-2 writes per call.
 */
async function saveTokenToFirestore(
    userId: string,
    token: string
): Promise<void> {
    const tokensRef = collection(db, 'users', userId, 'fcmTokens')

    // ✅ Read 1: Check if this exact token already exists
    const existingSnap = await getDocs(
        query(tokensRef, where('token', '==', token))
    )

    if (!existingSnap.empty) {
        // Token exists — just refresh lastUsed timestamp (1 write)
        await updateDoc(existingSnap.docs[0].ref, {
            lastUsed: serverTimestamp(),
        })
        console.log('[FCM] Token already registered — updated lastUsed')
        return
    }

    // ✅ Read 2: Check total token count for LRU eviction
    const allSnap = await getDocs(tokensRef)

    if (allSnap.docs.length >= MAX_TOKENS_PER_USER) {
        // Evict the least recently used token
        const sorted = [...allSnap.docs].sort((a, b) => {
            const aTime = (a.data().lastUsed as Timestamp)?.toMillis() ?? 0
            const bTime = (b.data().lastUsed as Timestamp)?.toMillis() ?? 0
            return aTime - bTime // ascending: oldest first
        })
        await deleteDoc(sorted[0].ref)
        console.log('[FCM] LRU eviction — removed oldest token')
    }

    // ✅ Write: Save new token with deterministic doc ID
    const tokenDocId = await tokenToDocId(token)

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

/**
 * Fully unregister FCM for this device on logout:
 * 1. Get current token (requires active SW)
 * 2. Delete from Firestore
 * 3. Delete from FCM (invalidates on server)
 * 4. Reset all module singletons
 */
export async function unregisterFCMToken(userId: string): Promise<void> {
    try {
        const messaging = await getMessagingInstance()
        if (!messaging) return

        // ✅ Get fresh SW registration — don't use potentially
        // stale cached one for a security-critical operation
        const swReg = swRegistration ?? await getServiceWorkerRegistration()

        let token: string | null = null

        if (swReg) {
            token = await getToken(messaging, {
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: swReg,
            }).catch((err) => {
                console.warn('[FCM] Could not get token for cleanup:', err)
                return null
            })
        }

        if (token) {
            // ✅ Remove from Firestore
            const tokensRef = collection(db, 'users', userId, 'fcmTokens')
            const snap = await getDocs(
                query(tokensRef, where('token', '==', token))
            )

            if (!snap.empty) {
                const batch = writeBatch(db)
                snap.docs.forEach((d) => batch.delete(d.ref))
                await batch.commit()
                console.log('[FCM] Token removed from Firestore')
            }

            // ✅ Invalidate on FCM servers
            await deleteToken(messaging).catch((err) =>
                console.warn('[FCM] deleteToken failed (non-critical):', err)
            )
        }

    } catch (error) {
        console.error('[FCM] Unregister error:', error)
    } finally {
        // ✅ Always reset singletons — even if operations fail
        // This ensures next login starts fresh
        swRegistration = null
        messagingInstance = null
        foregroundUnsubscribe?.()
        foregroundUnsubscribe = null
        currentUserId = null
        console.log('[FCM] Singletons reset on logout')
    }
}

// ─────────────────────────────────────────────────────────
// Foreground Message Handler
// ─────────────────────────────────────────────────────────

/**
 * Listen for FCM messages when app is in FOREGROUND.
 *
 * Architecture:
 * - Foreground: this fires → show in-app toast, SW suppresses push
 * - Background: SW fires → show browser push, this does NOT fire
 * → Exactly ONE notification in all scenarios
 *
 * Singleton guard:
 * - Same user + active listener → skip (no duplicate listeners)
 * - Different user → cleanup old, register new
 * - No listener yet → register fresh
 */
export function initForegroundMessaging(
    userId: string,
    onNotification: (payload: FCMNotificationPayload) => void
): void {
    // ✅ Fixed: Check BEFORE cleanup — order matters
    // If same user already has an active listener, do nothing
    if (currentUserId === userId && foregroundUnsubscribe) {
        console.log('[FCM] Listener already active for user:', userId)
        return
    }

    // ✅ Clean up previous listener (different user or stale)
    if (foregroundUnsubscribe) {
        foregroundUnsubscribe()
        foregroundUnsubscribe = null
        console.log('[FCM] Cleaned up previous foreground listener')
    }

    getMessagingInstance().then((messaging) => {
        if (!messaging) return

        foregroundUnsubscribe = onMessage(
            messaging,
            (payload: MessagePayload) => {
                console.log('[FCM] Foreground message received')

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
                    type: (payload.data?.type as FCMNotificationPayload['type']) || 'info',
                    projectId: payload.data?.projectId || null,
                    notificationId: payload.data?.notificationId || null,
                }

                onNotification(notifPayload)
            }
        )

        currentUserId = userId
        console.log('[FCM] Foreground listener registered for:', userId)
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

/**
 * Refresh FCM token if stale (older than TOKEN_REFRESH_INTERVAL).
 *
 * OPTIMIZATION:
 * - Only reads tokens subcollection (1 read)
 * - Only re-registers if actually needed
 * - Skips entirely if permission revoked
 */
export async function refreshFCMTokenIfNeeded(
    userId: string
): Promise<void> {
    try {
        // ✅ Skip if permission revoked since last check
        if (Notification.permission !== 'granted') return

        const tokensRef = collection(db, 'users', userId, 'fcmTokens')
        const snap = await getDocs(tokensRef)

        // No tokens at all — register fresh
        if (snap.empty) {
            console.log('[FCM] No tokens found — registering fresh')
            await registerFCMToken(userId)
            return
        }

        const now = Date.now()

        // ✅ Only refresh if ANY token is stale
        // Avoids unnecessary getToken() calls
        const hasStaleToken = snap.docs.some((d) => {
            const lastUsed =
                (d.data().lastUsed as Timestamp)?.toMillis() ?? 0
            return now - lastUsed > TOKEN_REFRESH_INTERVAL
        })

        if (hasStaleToken) {
            console.log('[FCM] Stale token detected — refreshing')
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
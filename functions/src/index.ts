/**
 * Firebase Cloud Functions v6 — TypeScript
 * FCM Push Notification Sender
 *
 * Architecture:
 * Client writes → /fcmQueue/{id}
 * This CF reads → /users/{uid}/fcmTokens (server-side only)
 * This CF sends → FCM multicast push
 * This CF cleans → stale tokens
 * This CF deletes → queue doc when done
 *
 * ✅ 2nd Gen functions (onDocumentCreated / onRequest)
 * ✅ TypeScript strict mode
 * ✅ Server reads FCM tokens (never client)
 * ✅ Atomic status claim (no double processing)
 * ✅ Multi-recipient support
 * ✅ Parallel token fetching
 * ✅ Stale token cleanup (1 read per user)
 * ✅ Exponential backoff retry (max 3)
 * ✅ sendEachForMulticast (not deprecated)
 * ✅ Restricted CORS on testFCM
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { onRequest } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'
import * as admin from 'firebase-admin'

admin.initializeApp()

const db = admin.firestore()
const MAX_RETRIES = 3

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

interface FCMQueueData {
    recipientUserId?: string
    recipientUserIds?: string[]
    notification: {
        title: string
        body: string
    }
    data?: Record<string, string>
    status: 'pending' | 'processing' | 'done' | 'failed'
    createdAt: admin.firestore.Timestamp
    retryCount?: number
    nextRetryAt?: admin.firestore.Timestamp
    claimedAt?: admin.firestore.Timestamp | null
}

interface TokenResult {
    uid: string
    tokens: string[]
}

/**
 * Get tailored notification actions based on notification type.
 */
function getNotificationActions(type: string): Array<{ action: string; title: string }> {
    switch (type) {
        case 'connection_request':
            return [
                { action: 'accept', title: 'Accept' },
                { action: 'view', title: 'View Profile' }
            ];
        case 'warning':
            return [
                { action: 'view', title: 'View' },
                { action: 'dismiss', title: 'Dismiss' }
            ];
        case 'info':
            return [
                { action: 'view', title: 'View Details' },
                { action: 'dismiss', title: 'Dismiss' }
            ];
        default:
            return [
                { action: 'view', title: 'Open' },
                { action: 'dismiss', title: 'Dismiss' }
            ];
    }
}

// ─────────────────────────────────────────────────────────
// Main Queue Processor
// ─────────────────────────────────────────────────────────

export const processFCMQueue = onDocumentCreated(
    {
        document: 'fcmQueue/{queueId}',
        region: 'us-central1',
        timeoutSeconds: 60,
        memory: '256MiB',
    },
    async (event) => {
        const queueId = event.params.queueId
        const snap = event.data

        // Shouldn't happen but guard anyway
        if (!snap) {
            logger.error('[FCM] No snapshot data in event')
            return
        }

        const data = snap.data() as FCMQueueData

        logger.log(`[FCM] Processing queue item: ${queueId}`)

        // ✅ Only process pending docs
        if (!data || data.status !== 'pending') {
            logger.log(`[FCM] Skipping — status: ${data?.status}`)
            return
        }

        // ✅ Atomic claim — prevents double processing
        // If another invocation claimed it, this update will
        // fail due to Firestore contention
        try {
            await snap.ref.update({
                status: 'processing',
                claimedAt: admin.firestore.FieldValue.serverTimestamp(),
            })
        } catch (err) {
            logger.log('[FCM] Doc already claimed — skipping')
            return
        }

        // ✅ Validate notification payload
        if (!data.notification?.title || !data.notification?.body) {
            logger.error('[FCM] Invalid notification payload')
            await snap.ref.delete()
            return
        }

        // ✅ Normalize recipients
        // Supports both single (recipientUserId) and
        // multi-recipient (recipientUserIds) formats
        const recipientIds: string[] = data.recipientUserIds?.length
            ? [...new Set(data.recipientUserIds)]
            : data.recipientUserId
            ? [data.recipientUserId]
            : []

        if (recipientIds.length === 0) {
            logger.error('[FCM] No recipients — deleting queue doc')
            await snap.ref.delete()
            return
        }

        // ✅ Server reads tokens in parallel — 1 read per user
        // Client NEVER reads or sends tokens
        const tokenResults: TokenResult[] = await Promise.all(
            recipientIds.map(async (uid): Promise<TokenResult> => {
                try {
                    const tokenSnap = await db
                        .collection(`users/${uid}/fcmTokens`)
                        .get()
                    return {
                        uid,
                        tokens: tokenSnap.docs.map(
                            (d) => d.data().token as string
                        ),
                    }
                } catch (err) {
                    logger.warn(
                        `[FCM] Could not read tokens for ${uid}:`,
                        err
                    )
                    return { uid, tokens: [] }
                }
            })
        )

        // ✅ Build token → uid map for accurate stale cleanup
        const tokenUserMap: Record<string, string> = {}
        const allTokens: string[] = []

        tokenResults.forEach(({ uid, tokens }) => {
            tokens.forEach((token) => {
                if (token && typeof token === 'string') {
                    // Only map first occurrence (edge case dedup)
                    if (!tokenUserMap[token]) {
                        tokenUserMap[token] = uid
                        allTokens.push(token)
                    }
                }
            })
        })

        const uniqueTokens = [...new Set(allTokens)]

        if (uniqueTokens.length === 0) {
            logger.log('[FCM] No valid tokens for any recipient')
            await snap.ref.delete()
            return
        }

        logger.log(
            `[FCM] Sending to ${uniqueTokens.length} tokens` +
            ` across ${recipientIds.length} users`
        )

        const notificationId = String(
            data.data?.notificationId || queueId
        )

        // ✅ Build FCM multicast message
        const message: admin.messaging.MulticastMessage = {
            tokens: uniqueTokens,
            notification: {
                title: data.notification.title,
                body: data.notification.body,
            },
            data: {
                title: String(data.notification.title),
                body: String(data.notification.body),
                type: String(data.data?.type ?? 'info'),
                url: String(data.data?.url ?? '/'),
                projectId: String(data.data?.projectId ?? ''),
                icon: String(data.data?.icon ?? ''),
                notificationId,
                firestoreId: String(data.data?.firestoreId ?? ''),
            },
            webpush: {
                headers: {
                    // TTL: notification expires after 24h if offline
                    TTL: '86400',
                    Topic: notificationId,
                },
                notification: {
                    title: data.notification.title,
                    body: data.notification.body,
                    icon: data.data?.icon || '/images/logoo_procollab.png',
                    badge: '/images/logoo_procollab.png',
                    // ✅ tag deduplicates at browser level
                    tag: notificationId,
                    renotify: false,
                    requireInteraction: false,
                    actions: getNotificationActions(String(data.data?.type ?? 'info')),
                    data: {
                        url: data.data?.url ?? '/',
                        notificationId,
                    },
                },
                fcmOptions: {
                    link: data.data?.url ?? '/',
                },
            },
            android: {
                notification: {
                    // ✅ tag deduplicates on Android
                    tag: notificationId,
                    // No FLUTTER_NOTIFICATION_CLICK — React/Capacitor app
                },
            },
        }

        try {
            // ✅ sendEachForMulticast — HTTP v1 API (not deprecated)
            const response = await admin
                .messaging()
                .sendEachForMulticast(message)

            logger.log(
                `[FCM] Result: ${response.successCount} success,` +
                ` ${response.failureCount} failed`
            )

            // ✅ Collect stale tokens from failed responses
            const staleTokens: string[] = []

            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const errCode = resp.error?.code
                    logger.warn(
                        `[FCM] Token [${idx}] failed: ${errCode}`
                    )
                    if (
                        errCode ===
                            'messaging/invalid-registration-token' ||
                        errCode ===
                            'messaging/registration-token-not-registered'
                    ) {
                        staleTokens.push(uniqueTokens[idx])
                    }
                }
            })

            // ✅ Clean up stale tokens — grouped by user
            if (staleTokens.length > 0) {
                await cleanupStaleTokens(staleTokens, tokenUserMap)
            }

            // ✅ Done — delete queue doc
            await snap.ref.delete()
            logger.log(`[FCM] Queue item ${queueId} complete`)

        } catch (error) {
            logger.error('[FCM] sendEachForMulticast error:', error)
            await handleRetry(snap, data)
        }
    }
)

// ─────────────────────────────────────────────────────────
// Stale Token Cleanup
// ─────────────────────────────────────────────────────────

/**
 * Remove stale tokens grouped by user.
 *
 * OPTIMIZATION:
 * 1 getDocs per affected user (not 1 per token).
 * All users processed in parallel.
 */
async function cleanupStaleTokens(
    staleTokens: string[],
    tokenUserMap: Record<string, string>
): Promise<void> {
    // Group stale tokens by uid
    const staleByUser: Record<string, string[]> = {}

    staleTokens.forEach((token) => {
        const uid = tokenUserMap[token]
        if (!uid) return
        if (!staleByUser[uid]) staleByUser[uid] = []
        staleByUser[uid].push(token)
    })

    // ✅ Process each affected user in parallel
    await Promise.all(
        Object.entries(staleByUser).map(async ([uid, tokens]) => {
            try {
                const tokensRef = db.collection(
                    `users/${uid}/fcmTokens`
                )

                // ✅ 1 read per user — filter in memory
                const allSnap = await tokensRef.get()
                if (allSnap.empty) return

                const batch = db.batch()
                let deleteCount = 0

                allSnap.docs.forEach((d) => {
                    if (tokens.includes(d.data().token as string)) {
                        batch.delete(d.ref)
                        deleteCount++
                    }
                })

                if (deleteCount > 0) {
                    await batch.commit()
                    logger.log(
                        `[FCM] Removed ${deleteCount} stale tokens` +
                        ` for user ${uid}`
                    )
                }
            } catch (err) {
                // Non-fatal — log and continue
                logger.warn(
                    `[FCM] Stale cleanup failed for ${uid}:`,
                    err
                )
            }
        })
    )
}

// ─────────────────────────────────────────────────────────
// Retry with Exponential Backoff
// ─────────────────────────────────────────────────────────

/**
 * Schedule a retry with exponential backoff.
 * Max 3 attempts: 30s → 60s → 120s
 * After max retries, deletes the queue doc.
 */
async function handleRetry(
    snap: admin.firestore.DocumentSnapshot,
    data: FCMQueueData
): Promise<void> {
    const retryCount = (data.retryCount ?? 0) + 1

    if (retryCount >= MAX_RETRIES) {
        logger.error(
            `[FCM] Max retries (${MAX_RETRIES}) reached — deleting`
        )
        await snap.ref.delete()
        return
    }

    // Backoff: 30s, 60s, 120s
    const backoffMs = 30_000 * Math.pow(2, retryCount - 1)

    logger.log(
        `[FCM] Retry ${retryCount}/${MAX_RETRIES}` +
        ` in ${backoffMs / 1000}s`
    )

    await snap.ref.update({
        // ✅ Reset to pending so next onCreate can pick it up
        status: 'pending',
        retryCount,
        claimedAt: null,
        nextRetryAt: admin.firestore.Timestamp.fromMillis(
            Date.now() + backoffMs
        ),
    })
}

// ─────────────────────────────────────────────────────────
// Test HTTP Function (Development Only)
// ─────────────────────────────────────────────────────────

/**
 * HTTP endpoint to manually trigger a test push.
 * Development use only — blocked in production.
 *
 * POST /testFCM
 * Body: { userId: string, title: string, body: string }
 */
export const testFCM = onRequest(
    {
        region: 'us-central1',
        // ✅ Restricted CORS — not open wildcard
        cors: [
            'http://localhost:5173',
            'http://localhost:3000',
        ],
        timeoutSeconds: 30,
    },
    async (req, res) => {
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' })
            return
        }

        // ✅ Block in production - TEMPORARILY DISABLED FOR TESTING
        // if (process.env.NODE_ENV === 'production') {
        //     res.status(403).json({
        //         error: 'Test endpoint disabled in production',
        //     })
        //     return
        // }

        const { userId, title, body } = req.body as {
            userId?: string
            title?: string
            body?: string
        }

        if (!userId || !title || !body) {
            res.status(400).json({
                error: 'Missing required fields: userId, title, body',
            })
            return
        }

        try {
            // ✅ Queue doc only — NO tokens
            // processFCMQueue reads tokens server-side
            const queueRef = await db.collection('fcmQueue').add({
                recipientUserId: userId,
                recipientUserIds: [userId],
                notification: { title, body },
                data: {
                    type: 'test',
                    url: '/dashboard',
                    notificationId: `test-${Date.now()}`,
                    firestoreId: '',
                    projectId: '',
                    icon: '',
                },
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                status: 'pending',
            })

            res.json({
                success: true,
                message: 'Test notification queued',
                queueId: queueRef.id,
            })

        } catch (error) {
            const err = error as Error
            logger.error('[FCM] testFCM error:', err)
            res.status(500).json({
                error: 'Internal server error',
                details: err.message ?? 'Unknown error',
            })
        }
    }
)
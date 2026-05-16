/**
 * Notification Trigger Service
 *
 * Coordinates in-app notification + FCM push in ONE operation.
 * Client never reads FCM tokens — Cloud Function handles that.
 *
 * ARCHITECTURE:
 * ─────────────────────────────────────────────────────────
 * Client writes:
 *   1. /users/{uid}/notifications/{id}  ← in-app notification
 *   2. /fcmQueue/{id}                   ← triggers Cloud Function
 *
 * Cloud Function:
 *   1. Reads /users/{uid}/fcmTokens     ← server-side only
 *   2. Sends FCM push to all tokens
 *   3. Cleans up stale tokens
 *   4. Deletes queue doc
 *
 * OPTIMIZATIONS:
 * ✅ In-app + queue written in ONE batch (2 writes, 1 commit)
 * ✅ Client NEVER reads FCM tokens (security + saves reads)
 * ✅ Multi-recipient: 1 queue doc for N users
 * ✅ notificationId shared between in-app + push (dedup)
 * ✅ Push failure never blocks in-app delivery
 */

import {
    collection,
    doc,
    setDoc,
    writeBatch,
    serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
    buildNotificationDoc,
    type NotificationPayload,
} from './notificationService'

// ─────────────────────────────────────────────────────────
// Single Recipient — In-App + Push in One Batch
// ─────────────────────────────────────────────────────────

/**
 * Send in-app notification AND queue push — atomically.
 *
 * Uses a single batch write:
 * - Write 1: /users/{uid}/notifications/{id}
 * - Write 2: /fcmQueue/{id}
 *
 * Cost: 1 batch commit (2 Firestore writes total)
 * The Cloud Function handles token reads server-side.
 */
export async function sendNotificationWithPush(
    recipientUserId: string,
    payload: NotificationPayload
): Promise<void> {
    try {
        const batch = writeBatch(db)

        // ✅ Write 1: In-app notification
        const notifId = buildNotificationDoc(batch, recipientUserId, payload)

        // ✅ Write 2: FCM queue doc
        const queueRef = doc(collection(db, 'fcmQueue'))
        batch.set(queueRef, {
            recipientUserId,
            recipientUserIds: [recipientUserId],
            notification: {
                title: payload.title,
                body: payload.body,
            },
            data: {
                title: payload.title,
                body: payload.body,
                type: payload.type,
                url: payload.url ?? '/',
                projectId: payload.projectId ?? '',
                icon: payload.icon ?? '',
                notificationId: notifId,
                firestoreId: notifId,
            },
            createdAt: serverTimestamp(),
            status: 'pending',
        })

        await batch.commit()
        console.log('[NotifTrigger] In-app + push queued for:', recipientUserId)

    } catch (batchError: any) {
        console.warn('[NotifTrigger] Batch write failed, falling back to separate writes:', batchError?.code)

        // Fallback: write in-app notification and fcmQueue separately
        // so a rules failure on one doesn't block the other
        try {
            const notifBatch = writeBatch(db)
            const notifId = buildNotificationDoc(notifBatch, recipientUserId, payload)
            await notifBatch.commit()
            console.log('[NotifTrigger] In-app notification written for:', recipientUserId)

            try {
                const queueRef = doc(collection(db, 'fcmQueue'))
                await setDoc(queueRef, {
                    recipientUserId,
                    recipientUserIds: [recipientUserId],
                    notification: {
                        title: payload.title,
                        body: payload.body,
                    },
                    data: {
                        title: payload.title,
                        body: payload.body,
                        type: payload.type,
                        url: payload.url ?? '/',
                        projectId: payload.projectId ?? '',
                        icon: payload.icon ?? '',
                        notificationId: notifId,
                        firestoreId: notifId,
                    },
                    createdAt: serverTimestamp(),
                    status: 'pending',
                })
                console.log('[NotifTrigger] FCM queue written for:', recipientUserId)
            } catch (fcmError: any) {
                console.warn('[NotifTrigger] FCM queue write failed (push skipped):', fcmError?.code)
            }
        } catch (notifError: any) {
            console.error('[NotifTrigger] In-app notification write failed:', notifError?.code, notifError)
        }
    }
}

// ─────────────────────────────────────────────────────────
// Multiple Recipients — Batched In-App + Single Push Queue
// ─────────────────────────────────────────────────────────

const BATCH_LIMIT = 498 // 500 max - 1 queue doc - 1 buffer = 498

/**
 * Send in-app notifications to MULTIPLE users + queue ONE push.
 *
 * OPTIMIZATION:
 * Instead of N queue docs (one per user), we write ONE queue doc
 * with all recipient UIDs. Cloud Function fetches all their tokens
 * server-side and sends in a single multicast call.
 *
 * Cost: ceil(n/498) batch commits (each includes notifications + 1 queue doc)
 *
 * Example: 10 users = 1 batch commit (10 notification writes + 1 queue write)
 * Example: 600 users = 2 batch commits
 */
export async function sendNotificationToManyWithPush(
    recipientUserIds: string[],
    payload: NotificationPayload
): Promise<void> {
    if (recipientUserIds.length === 0) return

    // ✅ Deduplicate recipients
    const uniqueIds = [...new Set(recipientUserIds)]

    try {
        for (let i = 0; i < uniqueIds.length; i += BATCH_LIMIT) {
            const chunk = uniqueIds.slice(i, i + BATCH_LIMIT)
            const batch = writeBatch(db)

            // ✅ In-app notifications for this chunk
            // All share different notif IDs (one per user)
            // But push uses a shared notificationId for the group
            const firstNotifId = buildNotificationDoc(
                batch,
                chunk[0],
                payload
            )
            chunk.slice(1).forEach((uid) =>
                buildNotificationDoc(batch, uid, payload)
            )

            // ✅ ONE queue doc per chunk — CF handles all token lookups
            const queueRef = doc(collection(db, 'fcmQueue'))
            batch.set(queueRef, {
                recipientUserIds: chunk,
                notification: {
                    title: payload.title,
                    body: payload.body,
                },
                data: {
                    title: payload.title,
                    body: payload.body,
                    type: payload.type,
                    url: payload.url ?? '/',
                    projectId: payload.projectId ?? '',
                    icon: payload.icon ?? '',
                    // ✅ Use first notif ID as the push tag
                    notificationId: firstNotifId,
                    firestoreId: firstNotifId,
                },
                createdAt: serverTimestamp(),
                status: 'pending',
            })

            await batch.commit()
            console.log(
                '[NotifTrigger] Chunk',
                Math.floor(i / BATCH_LIMIT) + 1,
                '— notified',
                chunk.length,
                'users'
            )
        }
    } catch (error) {
        console.error('[NotifTrigger] Error in bulk send:', error)
    }
}

// ─────────────────────────────────────────────────────────
// Push Only (no in-app notification)
// ─────────────────────────────────────────────────────────

/**
 * Queue a push notification WITHOUT writing an in-app notification.
 * Use for: silent background syncs, reminders, system alerts.
 *
 * Cost: 1 Firestore write
 */
export async function queuePushOnly(
    recipientUserIds: string | string[],
    payload: NotificationPayload,
    firestoreNotifId?: string
): Promise<void> {
    try {
        const userIds = Array.isArray(recipientUserIds)
            ? [...new Set(recipientUserIds)]
            : [recipientUserIds]

        if (userIds.length === 0) return

        const queueRef = doc(collection(db, 'fcmQueue'))

        await setDoc(queueRef, {
            recipientUserId: userIds[0],
            recipientUserIds: userIds,
            notification: {
                title: payload.title,
                body: payload.body,
            },
            data: {
                title: payload.title,
                body: payload.body,
                type: payload.type,
                url: payload.url ?? '/',
                projectId: payload.projectId ?? '',
                icon: payload.icon ?? '',
                notificationId: firestoreNotifId ?? queueRef.id,
                firestoreId: firestoreNotifId ?? '',
            },
            createdAt: serverTimestamp(),
            status: 'pending',
        })

        console.log(
            '[NotifTrigger] Push-only queued for',
            userIds.length,
            'users'
        )
    } catch (error) {
        console.error('[NotifTrigger] Push-only error:', error)
    }
}
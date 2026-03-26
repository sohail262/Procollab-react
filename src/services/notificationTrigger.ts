/**
 * Notification Trigger Service
 *
 * Since you're using FCM HTTP v1 API, push notifications
 * need to be triggered server-side ideally (Cloud Functions).
 *
 * This file provides a client-callable function that
 * triggers FCM via your backend OR via a Firebase Extension.
 *
 * For now this writes a special Firestore document that
 * a Cloud Function watches to trigger FCM push.
 * This keeps your client-side code clean and secure.
 */

import {
    collection,
    doc,
    setDoc,
    serverTimestamp,
    getDocs,
    query,
    where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { NotificationPayload } from './notificationService'

/**
 * Queue a push notification to be sent by Cloud Function.
 * Writes to /fcmQueue/{docId} which triggers the Cloud Function.
 *
 * The Cloud Function:
 * 1. Reads the user's fcmTokens
 * 2. Sends FCM push to all their tokens
 * 3. Deletes this queue document
 */
export async function queuePushNotification(
    recipientUserId: string,
    payload: NotificationPayload,
    firestoreNotifId?: string
): Promise<void> {
    try {
        // Get recipient's FCM tokens
        const tokensSnap = await getDocs(
            collection(db, 'users', recipientUserId, 'fcmTokens')
        )

        if (tokensSnap.empty) {
            console.log('[PushTrigger] No FCM tokens for user:', recipientUserId)
            return
        }

        const tokens = tokensSnap.docs.map(d => d.data().token as string)

        // Write to fcmQueue — Cloud Function picks this up
        const queueRef = doc(collection(db, 'fcmQueue'))
        await setDoc(queueRef, {
            recipientUserId,
            tokens,
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
                // ✅ Pass firestoreId so SW can use as notification tag
                notificationId: firestoreNotifId ?? queueRef.id,
                firestoreId: firestoreNotifId ?? '',
            },
            createdAt: serverTimestamp(),
            status: 'pending',
        })

        console.log('[PushTrigger] Push queued for:', recipientUserId)
    } catch (error) {
        console.error('[PushTrigger] Error queuing push:', error)
        // Don't throw — push failure shouldn't break in-app notification
    }
}
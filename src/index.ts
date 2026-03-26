/**
 * Firebase Cloud Function — FCM Push Sender
 *
 * Watches /fcmQueue collection and sends FCM pushes.
 * This runs server-side so your FCM service account
 * credentials are never exposed to the client.
 *
 * Deploy: firebase deploy --only functions
 */

import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

admin.initializeApp()

export const sendFCMNotification = functions.firestore
    .document('fcmQueue/{docId}')
    .onCreate(async (snap, context) => {
        const data = snap.data()
        if (!data || data.status !== 'pending') return

        const { tokens, notification, data: msgData } = data

        if (!tokens || tokens.length === 0) {
            await snap.ref.delete()
            return
        }

        // ✅ Deduplicate tokens
        const uniqueTokens: string[] = [...new Set(tokens as string[])]

        // FCM HTTP v1 API — send to each token
        // (multicast via sendEachForMulticast)
        const message: admin.messaging.MulticastMessage = {
            tokens: uniqueTokens,
            notification: {
                title: notification.title,
                body: notification.body,
            },
            data: {
                ...msgData,
                // Ensure all values are strings (FCM requirement)
                projectId: String(msgData.projectId || ''),
                url: String(msgData.url || '/'),
                type: String(msgData.type || 'info'),
                notificationId: String(msgData.notificationId || snap.id),
            },
            webpush: {
                headers: {
                    // ✅ TTL: notification expires after 24 hours
                    // if device is offline
                    TTL: '86400',
                    // ✅ Use notificationId as tag to prevent
                    // browser-level duplicates
                    Topic: String(msgData.notificationId || snap.id),
                },
                notification: {
                    title: notification.title,
                    body: notification.body,
                    icon: msgData.icon || '/icons/icon-192x192.png',
                    badge: '/icons/badge-72x72.png',
                    // ✅ tag prevents duplicate browser notifications
                    tag: String(msgData.notificationId || snap.id),
                    renotify: false,
                    requireInteraction: false,
                    data: {
                        url: msgData.url || '/',
                        notificationId: String(
                            msgData.notificationId || snap.id
                        ),
                    },
                },
                fcmOptions: {
                    link: msgData.url || '/',
                },
            },
            android: {
                notification: {
                    // Android also deduped by tag
                    tag: String(msgData.notificationId || snap.id),
                    clickAction: 'FLUTTER_NOTIFICATION_CLICK',
                },
            },
        }

        try {
            const response = await admin
                .messaging()
                .sendEachForMulticast(message)

            console.log(
                `[FCM] Sent: ${response.successCount} success,`,
                `${response.failureCount} failed`
            )

            // ✅ Remove stale tokens that returned errors
            const staleTokens: string[] = []
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const errCode = resp.error?.code
                    if (
                        errCode === 'messaging/invalid-registration-token' ||
                        errCode === 'messaging/registration-token-not-registered'
                    ) {
                        staleTokens.push(uniqueTokens[idx])
                    }
                }
            })

            // Clean up stale tokens from Firestore
            if (staleTokens.length > 0) {
                const recipientUid = data.recipientUserId
                const tokensRef = admin
                    .firestore()
                    .collection(`users/${recipientUid}/fcmTokens`)
                const tokenSnap = await tokensRef.get()
                const batch = admin.firestore().batch()
                tokenSnap.docs.forEach(d => {
                    if (staleTokens.includes(d.data().token)) {
                        batch.delete(d.ref)
                    }
                })
                await batch.commit()
                console.log('[FCM] Removed stale tokens:', staleTokens.length)
            }

        } catch (error) {
            console.error('[FCM] Send error:', error)
        } finally {
            // Always delete the queue document
            await snap.ref.delete()
        }
    })
/**
 * Unified Notification Service
 *
 * Single source of truth for writing notifications.
 * Every notification write goes through here — ensures:
 * ✅ Consistent schema (title, body, url — never message/link)
 * ✅ Firestore in-app notification written
 * ✅ FCM data payload attached (for push delivery)
 * ✅ No duplicates — dedup via notificationId
 * ✅ Batched writes for multiple recipients
 * ✅ Admin UID caching (5 min TTL)
 */

import {
    collection,
    doc,
    writeBatch,
    query,
    where,
    getDocs,
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export type NotificationType =
    | 'info'
    | 'success'
    | 'warning'
    | 'error'
    | 'connection_request'
    | 'connection_accepted'
    | 'connection_rejected'
    | 'connection_withdrawn'

export interface NotificationPayload {
    title: string
    body: string
    type: NotificationType
    url?: string
    projectId?: string
    icon?: string | null
    data?: {
        fromUserId?: string
        fromUserName?: string
        [key: string]: unknown
    }
}

// ─────────────────────────────────────────────────────────
// Admin UID Cache (module-level, persists across renders)
// ─────────────────────────────────────────────────────────

let cachedAdminUids: string[] | null = null
let adminCacheExpiry = 0
const ADMIN_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function getAdminUids(): Promise<string[]> {
    const now = Date.now()
    if (cachedAdminUids && now < adminCacheExpiry) {
        return cachedAdminUids
    }
    const snap = await getDocs(
        query(collection(db, 'users'), where('role', '==', 'admin'))
    )
    cachedAdminUids = snap.docs.map(d => d.id)
    adminCacheExpiry = now + ADMIN_CACHE_TTL
    console.log('[NotifService] Admin UIDs cached:', cachedAdminUids.length)
    return cachedAdminUids
}

/** Invalidate admin cache (call when an admin is added/removed) */
export function invalidateAdminCache(): void {
    cachedAdminUids = null
    adminCacheExpiry = 0
}

// ─────────────────────────────────────────────────────────
// Core Write Function
// ─────────────────────────────────────────────────────────

/**
 * Write a notification to one user's sub-collection.
 * Returns the notification document ID.
 * 
 * The same notificationId is stored in `data` so the
 * Service Worker can use it as the push `tag` to prevent
 * browser-level duplicates.
 */
export function buildNotificationDoc(
    batch: ReturnType<typeof writeBatch>,
    userId: string,
    payload: NotificationPayload
): string {
    const notifRef = doc(
        collection(db, 'users', userId, 'notifications')
    )

    batch.set(notifRef, {
        title: payload.title,
        body: payload.body,
        type: payload.type,
        read: false,
        timestamp: serverTimestamp(),
        icon: payload.icon ?? null,
        url: payload.url ?? null,
        projectId: payload.projectId ?? null,
        data: {
            ...payload.data,
            // ✅ Embed notif ID so SW can use it as push tag
            notificationId: notifRef.id,
        },
    })

    return notifRef.id
}

// ─────────────────────────────────────────────────────────
// Single Recipient
// ─────────────────────────────────────────────────────────

/**
 * Send notification to ONE user.
 */
export async function sendNotification(
    userId: string,
    payload: NotificationPayload
): Promise<void> {
    const batch = writeBatch(db)
    buildNotificationDoc(batch, userId, payload)
    await batch.commit()
}

// ─────────────────────────────────────────────────────────
// Multiple Recipients (batched)
// ─────────────────────────────────────────────────────────

const BATCH_LIMIT = 499

/**
 * Send notifications to multiple users.
 * Auto-chunks to respect Firestore 500-doc batch limit.
 */
export async function sendNotificationToMany(
    userIds: string[],
    payload: NotificationPayload
): Promise<void> {
    if (userIds.length === 0) return

    // Remove duplicates
    const uniqueIds = [...new Set(userIds)]

    for (let i = 0; i < uniqueIds.length; i += BATCH_LIMIT) {
        const chunk = uniqueIds.slice(i, i + BATCH_LIMIT)
        const batch = writeBatch(db)
        chunk.forEach(uid => buildNotificationDoc(batch, uid, payload))
        await batch.commit()
    }
}

// ─────────────────────────────────────────────────────────
// Notify All Admins (cached)
// ─────────────────────────────────────────────────────────

/**
 * Send notification to all admins.
 * Uses cached admin UIDs — max 1 Firestore read per 5 minutes.
 */
export async function notifyAdmins(
    payload: NotificationPayload
): Promise<void> {
    const adminUids = await getAdminUids()
    if (adminUids.length === 0) return
    await sendNotificationToMany(adminUids, payload)
}

// ─────────────────────────────────────────────────────────
// Pre-built notification helpers (connection events)
// ─────────────────────────────────────────────────────────

export const buildConnectionAcceptedNotif = (
    acceptorName: string,
    acceptorUid: string,
    acceptorPhotoURL?: string | null
): NotificationPayload => ({
    title: 'Connection Accepted',
    body: `${acceptorName} accepted your connection request!`,
    type: 'connection_accepted',
    url: `/profile/${acceptorUid}`,
    icon: acceptorPhotoURL ?? null,
    data: {
        fromUserId: acceptorUid,
        fromUserName: acceptorName,
    },
})

export const buildConnectionRejectedNotif = (
    rejectorName: string,
    rejectorUid: string
): NotificationPayload => ({
    title: 'Connection Request Declined',
    body: `${rejectorName} declined your connection request.`,
    type: 'connection_rejected',
    url: `/profile/${rejectorUid}`,
    data: {
        fromUserId: rejectorUid,
        fromUserName: rejectorName,
    },
})

export const buildConnectionWithdrawnNotif = (
    senderName: string,
    senderUid: string
): NotificationPayload => ({
    title: 'Connection Request Withdrawn',
    body: `${senderName} withdrew their connection request.`,
    type: 'connection_withdrawn',
    data: {
        fromUserId: senderUid,
        fromUserName: senderName,
    },
})

export const buildReportOwnerNotif = (
    projectTitle: string,
    projectId: string,
    reason: string
): NotificationPayload => ({
    title: 'Your Project Was Reported',
    body: `Your project "${projectTitle}" was reported for: ${reason}`,
    type: 'warning',
    url: `/project/${projectId}`,
    projectId,
})

export const buildReportAdminNotif = (
    projectTitle: string,
    projectId: string,
    reason: string
): NotificationPayload => ({
    title: 'Project Report Received',
    body: `Project "${projectTitle}" was reported. Reason: ${reason}`,
    type: 'error',
    url: `/project/${projectId}`,
    projectId,
})
// Add this alongside the other buildConnection*Notif helpers

export const buildConnectionRequestNotif = (
    senderName: string,
    senderUid: string,
    senderPhotoURL?: string | null
): NotificationPayload => ({
    title: 'New Connection Request',
    body: `${senderName} wants to connect with you!`,
    type: 'connection_request',
    url: `/profile/${senderUid}`,
    icon: senderPhotoURL ?? null,
    data: {
        fromUserId: senderUid,
        fromUserName: senderName,
    },
})
export const buildWithdrawOwnerNotif = (
    projectTitle: string,
    projectId: string
): NotificationPayload => ({
    title: 'Application Withdrawn',
    body: `An applicant withdrew their application from "${projectTitle}".`,
    type: 'info',
    url: `/project/${projectId}`,
    projectId,
})
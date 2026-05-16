/**
 * Unified Notification Service
 *
 * Single source of truth for ALL in-app notification writes.
 * Every write goes through here — guarantees:
 *
 * ✅ Consistent schema (title/body/url — never message/link)
 * ✅ Firestore in-app notification written
 * ✅ notificationId embedded for SW push dedup
 * ✅ Batched writes — multiple recipients in one commit
 * ✅ 499-doc chunk limit respected
 * ✅ Admin UID cache — 5-min TTL, covers all privileged roles
 * ✅ No redundant reads — cache-first admin lookup
 *
 * OPTIMIZATION:
 * - buildNotificationDoc() never reads — write only
 * - sendNotification() = 1 batch commit (1 write)
 * - sendNotificationToMany() = ceil(n/499) batch commits
 * - notifyAdmins() = 1 read (cached) + ceil(n/499) writes
 */

import {
    collection,
    doc,
    writeBatch,
    query,
    where,
    getDocs,
    serverTimestamp,
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
// Admin UID Cache
// ─────────────────────────────────────────────────────────

interface AdminCache {
    uids: string[]
    expiry: number
}

let adminCache: AdminCache | null = null
const ADMIN_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Fetch UIDs for ALL privileged roles.
 * Cached for 5 minutes to minimize Firestore reads.
 *
 * OPTIMIZATION: 3 parallel queries (one per role) instead of
 * a single query that Firestore can't do with OR on same field.
 * Results merged and deduplicated.
 */
async function getAdminUids(): Promise<string[]> {
    const now = Date.now()

    // ✅ Return cached result if still valid
    if (adminCache && now < adminCache.expiry) {
        return adminCache.uids
    }

    // ✅ Query all privileged roles in parallel (3 reads total)
    // Firestore doesn't support OR on the same field in one query
    const privilegedRoles = ['admin', 'super-admin', 'moderator'] as const

    const snaps = await Promise.all(
        privilegedRoles.map((role) =>
            getDocs(
                query(
                    collection(db, 'users'),
                    where('role', '==', role)
                )
            )
        )
    )

    // Merge all UIDs, deduplicate via Set
    const uidSet = new Set<string>()
    snaps.forEach((snap) =>
        snap.docs.forEach((d) => uidSet.add(d.id))
    )

    adminCache = {
        uids: [...uidSet],
        expiry: now + ADMIN_CACHE_TTL,
    }

    console.log(
        '[NotifService] Admin UIDs cached:',
        adminCache.uids.length
    )
    return adminCache.uids
}

/** Invalidate admin cache — call when a user's role changes */
export function invalidateAdminCache(): void {
    adminCache = null
    console.log('[NotifService] Admin cache invalidated')
}

// ─────────────────────────────────────────────────────────
// Core Write Function
// ─────────────────────────────────────────────────────────

/**
 * Add a notification write operation to an existing batch.
 * PURE WRITE — no reads performed here.
 *
 * The notificationId is embedded in data so the Service Worker
 * can use it as the push notification `tag` to prevent
 * browser-level duplicates.
 *
 * Returns the generated notification document ID.
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
            // ✅ Embed ID so SW uses it as push tag (dedup)
            notificationId: notifRef.id,
        },
    })

    return notifRef.id
}

// ─────────────────────────────────────────────────────────
// Single Recipient
// ─────────────────────────────────────────────────────────

/**
 * Send in-app notification to ONE user.
 * Cost: 1 batch commit (1 Firestore write)
 */
export async function sendNotification(
    userId: string,
    payload: NotificationPayload
): Promise<string> {
    const batch = writeBatch(db)
    const notifId = buildNotificationDoc(batch, userId, payload)
    await batch.commit()
    return notifId // ✅ Return ID for use in push trigger
}

// ─────────────────────────────────────────────────────────
// Multiple Recipients
// ─────────────────────────────────────────────────────────

const BATCH_LIMIT = 499 // Firestore max is 500, keep 1 buffer

/**
 * Send in-app notifications to MULTIPLE users.
 * Auto-chunks to respect Firestore 500-op batch limit.
 * Cost: ceil(n / 499) batch commits
 */
export async function sendNotificationToMany(
    userIds: string[],
    payload: NotificationPayload
): Promise<void> {
    if (userIds.length === 0) return

    // ✅ Deduplicate recipients
    const uniqueIds = [...new Set(userIds)]

    for (let i = 0; i < uniqueIds.length; i += BATCH_LIMIT) {
        const chunk = uniqueIds.slice(i, i + BATCH_LIMIT)
        const batch = writeBatch(db)
        chunk.forEach((uid) => buildNotificationDoc(batch, uid, payload))
        await batch.commit()
    }
}

// ─────────────────────────────────────────────────────────
// Notify All Admins
// ─────────────────────────────────────────────────────────

/**
 * Send notification to ALL privileged users (admin, super-admin, moderator).
 * Uses cached admin UIDs — at most 1 set of Firestore reads per 5 minutes.
 */
export async function notifyAdmins(
    payload: NotificationPayload
): Promise<void> {
    const adminUids = await getAdminUids()
    if (adminUids.length === 0) {
        console.log('[NotifService] No admins found to notify')
        return
    }
    await sendNotificationToMany(adminUids, payload)
}

// ─────────────────────────────────────────────────────────
// Pre-built Notification Helpers
// ─────────────────────────────────────────────────────────

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
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    updateDoc,
    addDoc,
    serverTimestamp,
    orderBy,
    limit,
    getDoc,
    writeBatch,
    Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface AdminNotificationPayload {
    title: string
    body: string
    type: 'info' | 'success' | 'warning' | 'error'
    url?: string
    projectId?: string
}

// ─────────────────────────────────────────────────────────
// User Management
// ─────────────────────────────────────────────────────────

/**
 * Fetch all users with optional role filter
 */
export async function getAllUsers(roleFilter?: string) {
    const usersRef = collection(db, 'users')
    const q = roleFilter
        ? query(usersRef, where('role', '==', roleFilter))
        : query(usersRef, orderBy('createdAt', 'desc'), limit(100))

    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

/**
 * Disable or enable a user account
 */
export async function setUserDisabled(userId: string, disabled: boolean): Promise<void> {
    await updateDoc(doc(db, 'users', userId), { disabled })
}

/**
 * Update a user's admin role
 */
export async function setUserRole(
    userId: string,
    role: 'admin' | 'super-admin' | 'moderator' | null
): Promise<void> {
    await updateDoc(doc(db, 'users', userId), { role: role ?? null })
}

// ─────────────────────────────────────────────────────────
// Project Moderation
// ─────────────────────────────────────────────────────────

/**
 * Fetch all projects pending moderation review
 */
export async function getPendingModerationProjects() {
    const q = query(
        collection(db, 'projects'),
        where('moderationStatus', '==', 'pending'),
        orderBy('createdAt', 'desc')
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

/**
 * Approve a project — updates project + clears moderation queue entry
 */
export async function approveProject(
    projectId: string,
    reviewerId: string
): Promise<void> {
    const batch = writeBatch(db)

    batch.update(doc(db, 'projects', projectId), {
        moderationStatus: 'approved',
        status: 'recruiting',
        disabled: false,
    })

    // Update moderation queue if entry exists
    const queueQuery = query(
        collection(db, 'moderationQueue'),
        where('projectId', '==', projectId)
    )
    const queueSnap = await getDocs(queueQuery)
    queueSnap.docs.forEach(d => {
        batch.update(d.ref, {
            status: 'approved',
            reviewedAt: serverTimestamp(),
            reviewerId,
        })
    })

    await batch.commit()
}

/**
 * Reject a project — notifies the project owner
 */
export async function rejectProject(
    projectId: string,
    reviewerId: string,
    reviewNotes: string
): Promise<void> {
    // 1. Get project data to notify owner
    const projectSnap = await getDoc(doc(db, 'projects', projectId))
    if (!projectSnap.exists()) throw new Error('Project not found')
    const projectData = projectSnap.data()

    const batch = writeBatch(db)

    // 2. Update project status
    batch.update(doc(db, 'projects', projectId), {
        moderationStatus: 'rejected',
        status: 'rejected',
        disabled: true,
    })

    // 3. Update moderation queue
    const queueQuery = query(
        collection(db, 'moderationQueue'),
        where('projectId', '==', projectId)
    )
    const queueSnap = await getDocs(queueQuery)
    queueSnap.docs.forEach(d => {
        batch.update(d.ref, {
            status: 'rejected',
            reviewedAt: serverTimestamp(),
            reviewerId,
            reviewNotes,
        })
    })

    // 4. Notify project owner — ✅ correct schema fields
    const notifRef = doc(collection(db, 'users', projectData.createdBy, 'notifications'))
    batch.set(notifRef, {
        title: 'Project Rejected',
        body: `Your project "${projectData.title}" was rejected. Reason: ${reviewNotes}`,
        type: 'error',
        read: false,
        timestamp: serverTimestamp(),
        projectId,
        url: `/project/${projectId}`,
    })

    await batch.commit()
}

// ─────────────────────────────────────────────────────────
// Reports Management
// ─────────────────────────────────────────────────────────

/**
 * Fetch all pending reports
 */
export async function getPendingReports() {
    const q = query(
        collection(db, 'reports'),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

/**
 * Resolve or dismiss a report
 */
export async function resolveReport(
    reportId: string,
    reviewerId: string,
    resolution: 'resolved' | 'dismissed',
    notes?: string
): Promise<void> {
    await updateDoc(doc(db, 'reports', reportId), {
        status: resolution,
        reviewedBy: reviewerId,
        reviewedAt: serverTimestamp(),
        resolution: notes ?? '',
    })
}

// ─────────────────────────────────────────────────────────
// Announcements
// ─────────────────────────────────────────────────────────

/**
 * Create a platform-wide announcement
 */
export async function createAnnouncement(payload: {
    title: string
    message: string
    type: 'info' | 'warning' | 'success' | 'error'
    expiresAt?: Timestamp
    targetAudience?: string[]
    createdBy: string
}): Promise<void> {
    await addDoc(collection(db, 'announcements'), {
        ...payload,
        active: true,
        createdAt: serverTimestamp(),
    })
}

/**
 * Deactivate an announcement
 */
export async function deactivateAnnouncement(announcementId: string): Promise<void> {
    await updateDoc(doc(db, 'announcements', announcementId), {
        active: false,
        updatedAt: serverTimestamp(),
    })
}

// ─────────────────────────────────────────────────────────
// Bulk Notifications (Admin → All Users)
// ─────────────────────────────────────────────────────────

/**
 * Send a notification to all users (batched to respect Firestore 500-doc limit)
 */
export async function notifyAllUsers(
    payload: AdminNotificationPayload
): Promise<void> {
    const usersSnap = await getDocs(collection(db, 'users'))
    const userIds = usersSnap.docs.map(d => d.id)

    const BATCH_LIMIT = 499
    for (let i = 0; i < userIds.length; i += BATCH_LIMIT) {
        const chunk = userIds.slice(i, i + BATCH_LIMIT)
        const batch = writeBatch(db)
        chunk.forEach(uid => {
            const notifRef = doc(collection(db, 'users', uid, 'notifications'))
            batch.set(notifRef, {
                ...payload,
                read: false,
                timestamp: serverTimestamp(),
            })
        })
        await batch.commit()
    }
}

// ─────────────────────────────────────────────────────────
// Admin Audit Logging
// ─────────────────────────────────────────────────────────

/**
 * Log an admin action for audit trail
 */
export async function logAdminAction(payload: {
    adminId: string
    action: string
    targetType?: string
    targetId?: string
    details?: Record<string, unknown>
    ipAddress?: string
}): Promise<void> {
    await addDoc(collection(db, 'adminLogs'), {
        ...payload,
        timestamp: serverTimestamp(),
    })
}
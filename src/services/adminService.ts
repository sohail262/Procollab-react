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
    deleteDoc,
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

export interface PlatformStats {
    totalUsers: number
    totalProjects: number
    activeUsers: number
    featuredProjects: number
    newSignups: number
}

export interface UserData {
    id: string
    email?: string
    displayName?: string
    firstName?: string
    lastName?: string
    photoURL?: string
    role?: string
    discipline?: string
    disabled?: boolean
    createdAt?: any
}

export interface ProjectData {
    id: string
    title: string
    creatorName?: string
    primaryDiscipline?: string
    status: string
    featured?: boolean
    createdAt?: any
}

export interface Announcement {
    id: string
    title: string
    message: string
    type: 'info' | 'success' | 'warning' | 'error'
    active: boolean
    createdAt: any
}

export interface GrowthDataPoint {
    date: string
    users: number
    projects: number
}

export interface ActivityLog {
    id: string
    action: string
    userName: string
    targetType: string
    targetName: string
    details?: string
    timestamp: any
}

export interface ModerationItem {
    id: string
    projectId: string
    projectTitle: string
    projectDescription?: string
    creatorName: string
    riskScore: number
    flags: Array<{
        type: string
        severity: 'low' | 'medium' | 'high'
        confidence: number
        details?: string
    }>
    createdAt: any
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
export async function logAdminAction(
    action: string,
    adminId: string,
    adminName: string,
    targetType: string,
    targetId: string,
    targetName: string,
    details?: string
): Promise<void> {
    await addDoc(collection(db, 'adminLogs'), {
        action,
        adminId,
        userName: adminName,
        targetType,
        targetId,
        targetName,
        details,
        timestamp: serverTimestamp(),
    })
}

// ─────────────────────────────────────────────────────────
// Additional Admin Functions for AdminDashboard
// ─────────────────────────────────────────────────────────

/**
 * Load platform statistics
 */
export async function loadPlatformStats(): Promise<PlatformStats> {
    try {
        const [usersSnap, projectsSnap] = await Promise.all([
            getDocs(collection(db, 'users')),
            getDocs(collection(db, 'projects'))
        ])

        const users = usersSnap.docs.map(d => d.data())
        const projects = projectsSnap.docs.map(d => d.data())

        // Calculate stats
        const totalUsers = users.length
        const totalProjects = projects.length
        const activeUsers = users.filter(u => !u.disabled).length
        const featuredProjects = projects.filter(p => p.featured).length
        
        // New signups in last 30 days
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const newSignups = users.filter(u => {
            if (!u.createdAt) return false
            const createdDate = u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt)
            return createdDate > thirtyDaysAgo
        }).length

        return {
            totalUsers,
            totalProjects,
            activeUsers,
            featuredProjects,
            newSignups
        }
    } catch (error) {
        console.error('Error loading platform stats:', error)
        return {
            totalUsers: 0,
            totalProjects: 0,
            activeUsers: 0,
            featuredProjects: 0,
            newSignups: 0
        }
    }
}

/**
 * Load all users
 */
export async function loadAllUsers(): Promise<UserData[]> {
    try {
        const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(1000))
        const snap = await getDocs(q)
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as UserData))
    } catch (error) {
        console.error('Error loading users:', error)
        return []
    }
}

/**
 * Load all projects
 */
export async function loadAllProjects(): Promise<ProjectData[]> {
    try {
        const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'), limit(1000))
        const snap = await getDocs(q)
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as ProjectData))
    } catch (error) {
        console.error('Error loading projects:', error)
        return []
    }
}

/**
 * Load announcements
 */
export async function loadAnnouncements(): Promise<Announcement[]> {
    try {
        const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'))
        const snap = await getDocs(q)
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement))
    } catch (error) {
        console.error('Error loading announcements:', error)
        return []
    }
}

/**
 * Load growth data for the last N days
 */
export async function loadGrowthData(days: number): Promise<GrowthDataPoint[]> {
    try {
        // Query daily aggregated stats from a dedicated collection
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - days)
        
        const q = query(
            collection(db, 'dailyStats'),
            where('date', '>=', startDate),
            where('date', '<=', endDate),
            orderBy('date', 'asc')
        )
        
        const snap = await getDocs(q)
        const existingData = snap.docs.map(d => d.data() as GrowthDataPoint)
        
        // If no aggregated data exists, fall back to calculating from raw data
        if (existingData.length === 0) {
            return await calculateGrowthDataFromRaw(days)
        }
        
        return existingData
    } catch (error) {
        console.error('Error loading growth data:', error)
        // Fallback to calculating from raw data
        return await calculateGrowthDataFromRaw(days)
    }
}

/**
 * Calculate growth data from raw user/project data (fallback method)
 */
async function calculateGrowthDataFromRaw(days: number): Promise<GrowthDataPoint[]> {
    try {
        const [usersSnap, projectsSnap] = await Promise.all([
            getDocs(collection(db, 'users')),
            getDocs(collection(db, 'projects'))
        ])
        
        const users = usersSnap.docs.map(d => d.data())
        const projects = projectsSnap.docs.map(d => d.data())
        
        const data: GrowthDataPoint[] = []
        const today = new Date()
        
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today)
            date.setDate(date.getDate() - i)
            const dateStr = date.toISOString().split('T')[0]
            
            // Count users created on this day
            const dayUsers = users.filter(u => {
                if (!u.createdAt) return false
                const createdDate = u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt)
                return createdDate.toDateString() === date.toDateString()
            }).length
            
            // Count projects created on this day
            const dayProjects = projects.filter(p => {
                if (!p.createdAt) return false
                const createdDate = p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt)
                return createdDate.toDateString() === date.toDateString()
            }).length
            
            data.push({
                date: dateStr,
                users: dayUsers,
                projects: dayProjects
            })
        }
        
        return data
    } catch (error) {
        console.error('Error calculating growth data from raw data:', error)
        return []
    }
}

/**
 * Load admin activity logs
 */
export async function loadAdminLogs(): Promise<ActivityLog[]> {
    try {
        const q = query(collection(db, 'adminLogs'), orderBy('timestamp', 'desc'), limit(100))
        const snap = await getDocs(q)
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityLog))
    } catch (error) {
        console.error('Error loading admin logs:', error)
        return []
    }
}

/**
 * Update user role
 */
export async function updateUserRole(userId: string, role: string): Promise<void> {
    await updateDoc(doc(db, 'users', userId), { role })
}

/**
 * Toggle user disabled status
 */
export async function toggleUserDisabled(userId: string, disabled: boolean): Promise<void> {
    await updateDoc(doc(db, 'users', userId), { disabled })
}

/**
 * Delete user
 */
export async function deleteUser(userId: string): Promise<void> {
    await deleteDoc(doc(db, 'users', userId))
}

/**
 * Update project status
 */
export async function updateProjectStatus(projectId: string, status: string): Promise<void> {
    await updateDoc(doc(db, 'projects', projectId), { status })
}

/**
 * Toggle project featured status
 */
export async function toggleProjectFeatured(projectId: string, featured: boolean): Promise<void> {
    await updateDoc(doc(db, 'projects', projectId), { featured })
}

/**
 * Delete project
 */
export async function deleteProject(projectId: string): Promise<void> {
    await deleteDoc(doc(db, 'projects', projectId))
}

/**
 * Create announcement (updated signature to match AdminDashboard usage)
 */
export async function createAnnouncement(
    title: string,
    message: string,
    type: 'info' | 'success' | 'warning' | 'error',
    expiresAt: Timestamp | null,
    createdBy: string
): Promise<void> {
    await addDoc(collection(db, 'announcements'), {
        title,
        message,
        type,
        expiresAt,
        createdBy,
        active: true,
        createdAt: serverTimestamp(),
    })
}

/**
 * Update announcement
 */
export async function updateAnnouncement(announcementId: string, updates: any): Promise<void> {
    await updateDoc(doc(db, 'announcements', announcementId), {
        ...updates,
        updatedAt: serverTimestamp()
    })
}

/**
 * Delete announcement
 */
export async function deleteAnnouncement(announcementId: string): Promise<void> {
    await deleteDoc(doc(db, 'announcements', announcementId))
}

/**
 * Load moderation queue
 */
export async function loadModerationQueue(): Promise<ModerationItem[]> {
    try {
        const q = query(
            collection(db, 'moderationQueue'),
            where('status', '==', 'pending'),
            orderBy('createdAt', 'desc')
        )
        const snap = await getDocs(q)
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as ModerationItem))
    } catch (error) {
        console.error('Error loading moderation queue:', error)
        return []
    }
}

/**
 * Review moderation item
 */
export async function reviewModerationItem(
    itemId: string,
    projectId: string,
    decision: 'approved' | 'rejected',
    reviewerId: string,
    notes?: string
): Promise<void> {
    const batch = writeBatch(db)

    // Update moderation queue item
    batch.update(doc(db, 'moderationQueue', itemId), {
        status: decision,
        reviewedAt: serverTimestamp(),
        reviewerId,
        reviewNotes: notes || null
    })

    // Update project status
    batch.update(doc(db, 'projects', projectId), {
        moderationStatus: decision,
        status: decision === 'approved' ? 'recruiting' : 'rejected',
        disabled: decision === 'rejected'
    })

    await batch.commit()
}

// ─────────────────────────────────────────────────────────
// Daily Stats Aggregation (for real growth data)
// ─────────────────────────────────────────────────────────

/**
 * Aggregate daily statistics (should be run daily via scheduled function)
 * This creates the real data that replaces the mock data
 */
export async function aggregateDailyStats(date?: Date): Promise<void> {
    const targetDate = date || new Date()
    const dateStr = targetDate.toISOString().split('T')[0]
    
    try {
        // Get start and end of the day
        const startOfDay = new Date(targetDate)
        startOfDay.setHours(0, 0, 0, 0)
        
        const endOfDay = new Date(targetDate)
        endOfDay.setHours(23, 59, 59, 999)
        
        // Count new users created on this day
        const usersQuery = query(
            collection(db, 'users'),
            where('createdAt', '>=', startOfDay),
            where('createdAt', '<=', endOfDay)
        )
        const usersSnap = await getDocs(usersQuery)
        const newUsers = usersSnap.size
        
        // Count new projects created on this day
        const projectsQuery = query(
            collection(db, 'projects'),
            where('createdAt', '>=', startOfDay),
            where('createdAt', '<=', endOfDay)
        )
        const projectsSnap = await getDocs(projectsQuery)
        const newProjects = projectsSnap.size
        
        // Store the aggregated data
        await addDoc(collection(db, 'dailyStats'), {
            date: dateStr,
            users: newUsers,
            projects: newProjects,
            aggregatedAt: serverTimestamp()
        })
        
        console.log(`Daily stats aggregated for ${dateStr}: ${newUsers} users, ${newProjects} projects`)
    } catch (error) {
        console.error('Error aggregating daily stats:', error)
        throw error
    }
}

/**
 * Backfill daily stats for the last N days (one-time setup)
 */
export async function backfillDailyStats(days: number = 30): Promise<void> {
    const today = new Date()
    
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today)
        date.setDate(date.getDate() - i)
        
        try {
            await aggregateDailyStats(date)
        } catch (error) {
            console.error(`Failed to backfill stats for ${date.toISOString().split('T')[0]}:`, error)
        }
    }
}
import {
    collection,
    query,
    where,
    getDocs,
    getDoc,
    doc,
    updateDoc,
    deleteDoc,
    orderBy,
    limit,
    Timestamp,
    addDoc,
    serverTimestamp,
    writeBatch,
    getCountFromServer
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

// Types
export interface PlatformStats {
    totalUsers: number
    totalProjects: number
    activeUsers: number
    newSignups: number
    totalApplications: number
    pendingApplications: number
    featuredProjects: number
    activeAnnouncements: number
}

export interface UserData {
    id: string
    email: string
    displayName?: string
    firstName?: string
    lastName?: string
    role?: string
    discipline?: string
    photoURL?: string
    createdAt?: Timestamp
    lastLogin?: Timestamp
    disabled?: boolean
}

export interface ProjectData {
    id: string
    title: string
    description?: string
    status: string
    createdBy: string
    creatorName?: string
    creatorEmail?: string
    primaryDiscipline?: string
    teamSize?: number
    createdAt?: Timestamp
    updatedAt?: Timestamp
    featured?: boolean
}

export interface Announcement {
    id: string
    title: string
    message: string
    type: 'info' | 'warning' | 'success' | 'error'
    active: boolean
    createdAt: Timestamp
    expiresAt?: Timestamp
    createdBy: string
}

export interface GrowthDataPoint {
    date: string
    users: number
    projects: number
}

export interface ActivityLog {
    id: string
    action: string
    userId?: string
    userName?: string
    targetType?: string
    targetId?: string
    targetName?: string
    timestamp: Timestamp
    details?: string
}

export interface ModerationItem {
    id: string
    projectId: string
    userId: string
    flags: Array<{
        type: string
        matches?: string[]
        message?: string
        severity: 'high' | 'medium' | 'low'
    }>
    riskScore: number
    status: 'pending' | 'approved' | 'rejected'
    createdAt: Timestamp
    reviewedAt?: Timestamp
    reviewerId?: string
    reviewerNotes?: string
    projectTitle?: string
    projectDescription?: string
    creatorName?: string
    creatorEmail?: string
}

// Platform Statistics
export async function loadPlatformStats(): Promise<PlatformStats> {
    try {
        // Get total users
        const usersSnapshot = await getCountFromServer(collection(db, 'users'))
        const totalUsers = usersSnapshot.data().count

        // Get total projects
        const projectsSnapshot = await getCountFromServer(collection(db, 'projects'))
        const totalProjects = projectsSnapshot.data().count

        // Get active users (last 7 days)
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        const activeUsersQuery = query(
            collection(db, 'users'),
            where('lastLogin', '>=', Timestamp.fromDate(sevenDaysAgo))
        )
        const activeUsersSnapshot = await getDocs(activeUsersQuery)
        const activeUsers = activeUsersSnapshot.size

        // Get new signups (last 30 days)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const newSignupsQuery = query(
            collection(db, 'users'),
            where('createdAt', '>=', Timestamp.fromDate(thirtyDaysAgo))
        )
        const newSignupsSnapshot = await getDocs(newSignupsQuery)
        const newSignups = newSignupsSnapshot.size

        // Get featured projects count
        const featuredQuery = query(
            collection(db, 'projects'),
            where('featured', '==', true)
        )
        const featuredSnapshot = await getDocs(featuredQuery)
        const featuredProjects = featuredSnapshot.size

        // Get active announcements count
        const now = Timestamp.now()
        const announcementsQuery = query(
            collection(db, 'announcements'),
            where('active', '==', true)
        )
        const announcementsSnapshot = await getDocs(announcementsQuery)
        const activeAnnouncements = announcementsSnapshot.docs.filter(doc => {
            const data = doc.data()
            return !data.expiresAt || data.expiresAt.toDate() > now.toDate()
        }).length

        return {
            totalUsers,
            totalProjects,
            activeUsers,
            newSignups,
            totalApplications: 0, // Would require collection group query
            pendingApplications: 0,
            featuredProjects,
            activeAnnouncements
        }
    } catch (error) {
        console.error('Error loading platform stats:', error)
        return {
            totalUsers: 0,
            totalProjects: 0,
            activeUsers: 0,
            newSignups: 0,
            totalApplications: 0,
            pendingApplications: 0,
            featuredProjects: 0,
            activeAnnouncements: 0
        }
    }
}

// User Management
export async function loadAllUsers(limitCount = 100): Promise<UserData[]> {
    try {
        const usersQuery = query(
            collection(db, 'users'),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        )
        const snapshot = await getDocs(usersQuery)
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as UserData[]
    } catch (error) {
        console.error('Error loading users:', error)
        return []
    }
}

export async function updateUserRole(userId: string, role: string): Promise<void> {
    try {
        await updateDoc(doc(db, 'users', userId), {
            role,
            updatedAt: serverTimestamp()
        })
    } catch (error) {
        console.error('Error updating user role:', error)
        throw error
    }
}

export async function toggleUserDisabled(userId: string, disabled: boolean): Promise<void> {
    try {
        await updateDoc(doc(db, 'users', userId), {
            disabled,
            updatedAt: serverTimestamp()
        })
    } catch (error) {
        console.error('Error toggling user disabled status:', error)
        throw error
    }
}

export async function deleteUser(userId: string): Promise<void> {
    try {
        // Note: This only deletes the Firestore document.
        // Firebase Auth user would need to be deleted via Cloud Functions
        await deleteDoc(doc(db, 'users', userId))
    } catch (error) {
        console.error('Error deleting user:', error)
        throw error
    }
}

// Project Management
export async function loadAllProjects(limitCount = 100): Promise<ProjectData[]> {
    try {
        const projectsQuery = query(
            collection(db, 'projects'),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        )
        const snapshot = await getDocs(projectsQuery)

        // Get creator info for each project
        const projects = await Promise.all(snapshot.docs.map(async (projectDoc) => {
            const data = projectDoc.data()
            let creatorName = 'Unknown'
            let creatorEmail = ''

            if (data.createdBy) {
                try {
                    const userDoc = await getDoc(doc(db, 'users', data.createdBy))
                    if (userDoc.exists()) {
                        const userData = userDoc.data()
                        creatorName = userData.displayName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.email
                        creatorEmail = userData.email
                    }
                } catch (e) {
                    // Ignore user fetch errors
                }
            }

            return {
                id: projectDoc.id,
                ...data,
                creatorName,
                creatorEmail
            } as ProjectData
        }))

        return projects
    } catch (error) {
        console.error('Error loading projects:', error)
        return []
    }
}

export async function updateProjectStatus(projectId: string, status: string): Promise<void> {
    try {
        await updateDoc(doc(db, 'projects', projectId), {
            status,
            updatedAt: serverTimestamp()
        })
    } catch (error) {
        console.error('Error updating project status:', error)
        throw error
    }
}

export async function toggleProjectFeatured(projectId: string, featured: boolean): Promise<void> {
    try {
        await updateDoc(doc(db, 'projects', projectId), {
            featured,
            updatedAt: serverTimestamp()
        })
    } catch (error) {
        console.error('Error toggling project featured status:', error)
        throw error
    }
}

export async function deleteProject(projectId: string): Promise<void> {
    try {
        // Delete project document
        await deleteDoc(doc(db, 'projects', projectId))
        // Note: Subcollections (tasks, members, etc.) would need Cloud Functions to delete
    } catch (error) {
        console.error('Error deleting project:', error)
        throw error
    }
}

// Announcements
export async function loadAnnouncements(): Promise<Announcement[]> {
    try {
        const announcementsQuery = query(
            collection(db, 'announcements'),
            orderBy('createdAt', 'desc'),
            limit(50)
        )
        const snapshot = await getDocs(announcementsQuery)
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Announcement[]
    } catch (error) {
        console.error('Error loading announcements:', error)
        return []
    }
}

export async function createAnnouncement(
    title: string,
    message: string,
    type: 'info' | 'warning' | 'success' | 'error',
    expiresAt: Date | null,
    createdBy: string
): Promise<string> {
    try {
        const docRef = await addDoc(collection(db, 'announcements'), {
            title,
            message,
            type,
            active: true,
            createdAt: serverTimestamp(),
            expiresAt: expiresAt ? Timestamp.fromDate(expiresAt) : null,
            createdBy
        })
        return docRef.id
    } catch (error) {
        console.error('Error creating announcement:', error)
        throw error
    }
}

export async function updateAnnouncement(
    announcementId: string,
    updates: Partial<Omit<Announcement, 'id' | 'createdAt' | 'createdBy'>>
): Promise<void> {
    try {
        await updateDoc(doc(db, 'announcements', announcementId), {
            ...updates,
            updatedAt: serverTimestamp()
        })
    } catch (error) {
        console.error('Error updating announcement:', error)
        throw error
    }
}

export async function deleteAnnouncement(announcementId: string): Promise<void> {
    try {
        await deleteDoc(doc(db, 'announcements', announcementId))
    } catch (error) {
        console.error('Error deleting announcement:', error)
        throw error
    }
}

// Featured Projects
export async function loadFeaturedProjects(): Promise<ProjectData[]> {
    try {
        const featuredQuery = query(
            collection(db, 'projects'),
            where('featured', '==', true),
            orderBy('updatedAt', 'desc')
        )
        const snapshot = await getDocs(featuredQuery)
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as ProjectData[]
    } catch (error) {
        console.error('Error loading featured projects:', error)
        return []
    }
}

// Activity Logs (for admin actions)
export async function logAdminAction(
    action: string,
    userId: string,
    userName: string,
    targetType?: string,
    targetId?: string,
    targetName?: string,
    details?: string
): Promise<void> {
    try {
        // Build the log object, only including defined values
        const logData: Record<string, any> = {
            action,
            userId,
            userName,
            timestamp: serverTimestamp()
        }

        // Only add optional fields if they have values
        if (targetType) logData.targetType = targetType
        if (targetId) logData.targetId = targetId
        if (targetName) logData.targetName = targetName
        if (details) logData.details = details

        await addDoc(collection(db, 'adminLogs'), logData)
    } catch (error) {
        console.error('Error logging admin action:', error)
    }
}

export async function loadAdminLogs(limitCount = 50): Promise<ActivityLog[]> {
    try {
        const logsQuery = query(
            collection(db, 'adminLogs'),
            orderBy('timestamp', 'desc'),
            limit(limitCount)
        )
        const snapshot = await getDocs(logsQuery)
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as ActivityLog[]
    } catch (error) {
        console.error('Error loading admin logs:', error)
        return []
    }
}

// Growth Data for Charts
export async function loadGrowthData(days = 30): Promise<GrowthDataPoint[]> {
    try {
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - days)

        // Get users created in the period
        const usersQuery = query(
            collection(db, 'users'),
            where('createdAt', '>=', Timestamp.fromDate(startDate)),
            orderBy('createdAt', 'asc')
        )
        const usersSnapshot = await getDocs(usersQuery)

        // Get projects created in the period
        const projectsQuery = query(
            collection(db, 'projects'),
            where('createdAt', '>=', Timestamp.fromDate(startDate)),
            orderBy('createdAt', 'asc')
        )
        const projectsSnapshot = await getDocs(projectsQuery)

        // Group by date
        const dataMap = new Map<string, { users: number; projects: number }>()

        // Initialize all dates
        for (let i = 0; i <= days; i++) {
            const date = new Date()
            date.setDate(date.getDate() - (days - i))
            const dateStr = date.toISOString().split('T')[0]
            dataMap.set(dateStr, { users: 0, projects: 0 })
        }

        // Count users by date
        usersSnapshot.docs.forEach(doc => {
            const data = doc.data()
            if (data.createdAt) {
                const dateStr = data.createdAt.toDate().toISOString().split('T')[0]
                const existing = dataMap.get(dateStr)
                if (existing) {
                    existing.users++
                }
            }
        })

        // Count projects by date
        projectsSnapshot.docs.forEach(doc => {
            const data = doc.data()
            if (data.createdAt) {
                const dateStr = data.createdAt.toDate().toISOString().split('T')[0]
                const existing = dataMap.get(dateStr)
                if (existing) {
                    existing.projects++
                }
            }
        })

        // Convert to array
        const result: GrowthDataPoint[] = []
        dataMap.forEach((value, date) => {
            result.push({
                date,
                users: value.users,
                projects: value.projects
            })
        })

        return result.sort((a, b) => a.date.localeCompare(b.date))
    } catch (error) {
        console.error('Error loading growth data:', error)
        return []
    }
}

// Bulk Operations
export async function bulkUpdateProjectStatus(projectIds: string[], status: string): Promise<void> {
    try {
        const batch = writeBatch(db)
        projectIds.forEach(id => {
            batch.update(doc(db, 'projects', id), {
                status,
                updatedAt: serverTimestamp()
            })
        })
        await batch.commit()
    } catch (error) {
        console.error('Error bulk updating project status:', error)
        throw error
    }
}

export async function bulkDeleteProjects(projectIds: string[]): Promise<void> {
    try {
        const batch = writeBatch(db)
        projectIds.forEach(id => {
            batch.delete(doc(db, 'projects', id))
        })
        await batch.commit()
    } catch (error) {
        console.error('Error bulk deleting projects:', error)
        throw error
    }
}

// ============ MODERATION FUNCTIONS ============

// Load moderation queue (projects pending review)
export async function loadModerationQueue(): Promise<ModerationItem[]> {
    try {
        const q = query(
            collection(db, 'moderationQueue'),
            where('status', '==', 'pending'),
            orderBy('createdAt', 'desc')
        )
        const snapshot = await getDocs(q)

        const items: ModerationItem[] = []

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data()

            // Fetch project details
            let projectTitle = 'Unknown Project'
            let projectDescription = ''
            let creatorName = 'Unknown'
            let creatorEmail = ''

            try {
                const projectDoc = await getDoc(doc(db, 'projects', data.projectId))
                if (projectDoc.exists()) {
                    const projectData = projectDoc.data()
                    projectTitle = projectData.title || 'Untitled'
                    projectDescription = projectData.description || ''

                    // Fetch creator info
                    const userDoc = await getDoc(doc(db, 'users', projectData.createdBy))
                    if (userDoc.exists()) {
                        const userData = userDoc.data()
                        creatorName = userData.displayName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.email
                        creatorEmail = userData.email || ''
                    }
                }
            } catch (err) {
                console.error('Error fetching project/user details:', err)
            }

            items.push({
                id: docSnap.id,
                projectId: data.projectId,
                userId: data.userId,
                flags: data.flags || [],
                riskScore: data.riskScore || 0,
                status: data.status,
                createdAt: data.createdAt,
                reviewedAt: data.reviewedAt,
                reviewerId: data.reviewerId,
                reviewerNotes: data.reviewerNotes,
                projectTitle,
                projectDescription,
                creatorName,
                creatorEmail
            })
        }

        return items
    } catch (error) {
        console.error('Error loading moderation queue:', error)
        return []
    }
}

// Review a moderation item (approve or reject)
export async function reviewModerationItem(
    moderationId: string,
    projectId: string,
    decision: 'approved' | 'rejected',
    reviewerId: string,
    reviewerNotes?: string
): Promise<void> {
    try {
        // Update moderation queue item
        await updateDoc(doc(db, 'moderationQueue', moderationId), {
            status: decision,
            reviewerId,
            reviewedAt: serverTimestamp(),
            reviewerNotes: reviewerNotes || null
        })

        // Update the project status based on decision
        const projectRef = doc(db, 'projects', projectId)

        if (decision === 'approved') {
            await updateDoc(projectRef, {
                status: 'recruiting', // Set to active recruiting status
                moderationStatus: 'approved',
                updatedAt: serverTimestamp()
            })
        } else {
            // If rejected, either delete or mark as rejected
            await updateDoc(projectRef, {
                status: 'rejected',
                moderationStatus: 'rejected',
                moderationNotes: reviewerNotes || 'Rejected by moderator',
                updatedAt: serverTimestamp()
            })
        }

        // Create notification for the project creator
        const projectDoc = await getDoc(projectRef)
        if (projectDoc.exists()) {
            const projectData = projectDoc.data()
            await addDoc(collection(db, 'users', projectData.createdBy, 'notifications'), {
                title: decision === 'approved' ? 'Project Approved!' : 'Project Rejected',
                body: decision === 'approved'
                    ? `Your project "${projectData.title}" has been approved and is now visible to others.`
                    : `Your project "${projectData.title}" was rejected. ${reviewerNotes || 'Please review our guidelines.'}`,
                type: decision === 'approved' ? 'project_approved' : 'project_rejected',
                url: `/project/${projectId}`,
                read: false,
                timestamp: serverTimestamp()
            })
        }
    } catch (error) {
        console.error('Error reviewing moderation item:', error)
        throw error
    }
}

// Get moderation statistics
export async function getModerationStats(): Promise<{
    pending: number
    approvedToday: number
    rejectedToday: number
}> {
    try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayTimestamp = Timestamp.fromDate(today)

        // Count pending items
        const pendingSnapshot = await getCountFromServer(
            query(collection(db, 'moderationQueue'), where('status', '==', 'pending'))
        )

        // Count approved today
        const approvedSnapshot = await getCountFromServer(
            query(
                collection(db, 'moderationQueue'),
                where('status', '==', 'approved'),
                where('reviewedAt', '>=', todayTimestamp)
            )
        )

        // Count rejected today
        const rejectedSnapshot = await getCountFromServer(
            query(
                collection(db, 'moderationQueue'),
                where('status', '==', 'rejected'),
                where('reviewedAt', '>=', todayTimestamp)
            )
        )

        return {
            pending: pendingSnapshot.data().count,
            approvedToday: approvedSnapshot.data().count,
            rejectedToday: rejectedSnapshot.data().count
        }
    } catch (error) {
        console.error('Error getting moderation stats:', error)
        return { pending: 0, approvedToday: 0, rejectedToday: 0 }
    }
}

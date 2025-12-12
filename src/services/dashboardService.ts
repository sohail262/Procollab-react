import { collection, query, where, getDocs, orderBy, limit, doc, getDoc, onSnapshot, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface DashboardStats {
    myProjects: number
    applications: number
    notifications: number
    savedProjects: number
}

export interface Activity {
    id: string
    type: 'application' | 'project_update' | 'team_invite' | 'message'
    message: string
    timestamp: Date
    projectId?: string
    projectTitle?: string
}

export interface Project {
    id: string
    title: string
    description: string
    summary?: string
    status: 'active' | 'recruiting' | 'completed' | 'on-hold'
    createdBy: string
    createdAt: Date
    primaryDiscipline?: string
    teamMembers?: Record<string, any>
    teamSize?: number
    maxTeamSize?: number
    applications?: number
    tags?: string[]
}

export interface Application {
    id: string
    projectId: string
    projectTitle?: string
    status: 'pending' | 'accepted' | 'rejected'
    appliedAt: Date
    message?: string
    project?: Project
}

export interface Notification {
    id: string
    type: 'info' | 'success' | 'warning' | 'error'
    message: string
    read: boolean
    timestamp: Date
    projectId?: string
    link?: string
}

// Load dashboard statistics
export async function loadDashboardStats(userId: string): Promise<DashboardStats> {
    try {
        const [projectsSnap, applicationsSnap, notificationsSnap, savedSnap] = await Promise.all([
            getDocs(query(collection(db, 'projects'), where('createdBy', '==', userId))),
            getDocs(query(collection(db, 'users', userId, 'applications'))),
            getDocs(query(collection(db, 'users', userId, 'notifications'), where('read', '==', false))),
            getDocs(query(collection(db, 'users', userId, 'savedProjects')))
        ])

        return {
            myProjects: projectsSnap.size,
            applications: applicationsSnap.size,
            notifications: notificationsSnap.size,
            savedProjects: savedSnap.size
        }
    } catch (error) {
        console.error('Error loading dashboard stats:', error)
        return {
            myProjects: 0,
            applications: 0,
            notifications: 0,
            savedProjects: 0
        }
    }
}

// Load recent activity
export async function loadRecentActivity(userId: string): Promise<Activity[]> {
    try {
        const activities: Activity[] = []

        // Get user's activity from notifications
        const notificationsSnap = await getDocs(
            query(
                collection(db, 'users', userId, 'notifications'),
                orderBy('timestamp', 'desc'),
                limit(10)
            )
        )

        notificationsSnap.forEach(doc => {
            const data = doc.data()
            activities.push({
                id: doc.id,
                type: data.type || 'project_update',
                message: data.message,
                timestamp: data.timestamp?.toDate() || new Date(),
                projectId: data.projectId,
                projectTitle: data.projectTitle
            })
        })

        // Get recent applications
        const applicationsSnap = await getDocs(
            query(
                collection(db, 'users', userId, 'applications'),
                orderBy('appliedAt', 'desc'),
                limit(5)
            )
        )

        for (const appDoc of applicationsSnap.docs) {
            const appData = appDoc.data()
            const projectDoc = await getDoc(doc(db, 'projects', appData.projectId))

            if (projectDoc.exists()) {
                activities.push({
                    id: appDoc.id,
                    type: 'application',
                    message: `Applied to "${projectDoc.data().title}"`,
                    timestamp: appData.appliedAt?.toDate() || new Date(),
                    projectId: appData.projectId,
                    projectTitle: projectDoc.data().title
                })
            }
        }

        // Sort by timestamp
        activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

        return activities.slice(0, 8)
    } catch (error) {
        console.error('Error loading recent activity:', error)
        return []
    }
}

// Load recommended projects based on user's skills, discipline, and interests
export async function loadRecommendedProjects(userId: string): Promise<Project[]> {
    try {
        // Get user profile to match skills, interests, and discipline
        const userDoc = await getDoc(doc(db, 'users', userId))
        if (!userDoc.exists()) return []

        const userData = userDoc.data()
        const userSkills: string[] = (userData.skills || []).map((s: string) => s.toLowerCase().trim())
        const userDiscipline = userData.discipline?.toLowerCase() || ''
        const userBio = userData.bio?.toLowerCase() || ''
        const userInterests = extractKeywords(userBio)

        // Get user's applied projects to exclude them
        const appliedProjectsSnap = await getDocs(collection(db, 'users', userId, 'applications'))
        const appliedProjectIds = new Set(appliedProjectsSnap.docs.map(d => d.data().projectId))

        // Get active/recruiting projects (excluding user's own)
        const projectsSnap = await getDocs(
            query(
                collection(db, 'projects'),
                where('status', 'in', ['active', 'recruiting']),
                where('createdBy', '!=', userId),
                limit(50) // Fetch more for better filtering
            )
        )

        const projects: (Project & {
            requiredSkills?: string[]
            openRoles?: string[]
        })[] = []

        projectsSnap.forEach(docSnap => {
            const data = docSnap.data()
            // Skip projects user already applied to or is a member of
            if (appliedProjectIds.has(docSnap.id)) return
            if (data.teamMembers && data.teamMembers[userId]) return

            projects.push({
                id: docSnap.id,
                title: data.title,
                description: data.description,
                summary: data.summary,
                status: data.status,
                createdBy: data.createdBy,
                createdAt: data.createdAt?.toDate() || new Date(),
                primaryDiscipline: data.primaryDiscipline,
                teamMembers: data.teamMembers,
                teamSize: data.teamSize,
                maxTeamSize: data.maxTeamSize,
                tags: data.tags,
                requiredSkills: data.requiredSkills,
                openRoles: data.openRoles
            })
        })

        // Score projects based on multiple factors
        const scoredProjects = projects.map(project => {
            let score = 0
            const matchReasons: string[] = []

            // 1. DISCIPLINE MATCH (High Priority - up to 25 points)
            if (project.primaryDiscipline) {
                const projectDiscipline = project.primaryDiscipline.toLowerCase()
                if (projectDiscipline === userDiscipline) {
                    score += 25
                    matchReasons.push('discipline')
                } else if (projectDiscipline.includes(userDiscipline) || userDiscipline.includes(projectDiscipline)) {
                    score += 15
                    matchReasons.push('related-discipline')
                }
            }

            // 2. SKILL MATCH (High Priority - up to 30 points)
            const projectTags = (project.tags || []).map(t => t.toLowerCase())
            const requiredSkills = (project.requiredSkills || []).map(s => s.toLowerCase())
            const allProjectSkills = [...projectTags, ...requiredSkills]

            let skillMatchCount = 0
            for (const userSkill of userSkills) {
                for (const projectSkill of allProjectSkills) {
                    if (fuzzyMatch(userSkill, projectSkill)) {
                        skillMatchCount++
                        break
                    }
                }
            }
            if (skillMatchCount > 0) {
                score += Math.min(skillMatchCount * 6, 30)
                matchReasons.push(`${skillMatchCount}-skills`)
            }

            // 3. OPEN ROLES MATCH (Medium Priority - up to 20 points)
            const openRoles = (project.openRoles || []).map(r => r.toLowerCase())
            for (const userSkill of userSkills) {
                for (const role of openRoles) {
                    if (fuzzyMatch(userSkill, role)) {
                        score += 10
                        matchReasons.push('role-match')
                        break
                    }
                }
            }
            score = Math.min(score, score > 20 ? score : score) // Cap role bonus at 20

            // 4. INTEREST/BIO KEYWORD MATCH (Medium Priority - up to 15 points)
            const projectDescription = (project.description || '').toLowerCase()
            const projectTitle = (project.title || '').toLowerCase()
            let interestMatches = 0
            for (const interest of userInterests) {
                if (projectDescription.includes(interest) || projectTitle.includes(interest) || projectTags.some(t => t.includes(interest))) {
                    interestMatches++
                }
            }
            if (interestMatches > 0) {
                score += Math.min(interestMatches * 5, 15)
                matchReasons.push('interests')
            }

            // 5. RECENCY BOOST (Low Priority - up to 10 points)
            const daysSinceCreation = Math.floor((Date.now() - project.createdAt.getTime()) / (1000 * 60 * 60 * 24))
            if (daysSinceCreation <= 7) {
                score += 10
                matchReasons.push('new')
            } else if (daysSinceCreation <= 30) {
                score += 5
                matchReasons.push('recent')
            }

            // 6. TEAM AVAILABILITY BOOST (Low Priority - up to 5 points)
            const currentTeamSize = project.teamMembers ? Object.keys(project.teamMembers).length : 1
            const maxSize = project.maxTeamSize || project.teamSize || 5
            const availableSpots = maxSize - currentTeamSize
            if (availableSpots > 2) {
                score += 5
            } else if (availableSpots > 0) {
                score += 2
            }

            return {
                project,
                score,
                matchReasons
            }
        })

        // Sort by score (descending), then by recency as tiebreaker
        scoredProjects.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score
            return b.project.createdAt.getTime() - a.project.createdAt.getTime()
        })

        // Return top 6 recommendations (increased from 3)
        return scoredProjects
            .filter(item => item.score >= 10) // Only include projects with meaningful match
            .slice(0, 6)
            .map(item => item.project)
    } catch (error) {
        console.error('Error loading recommended projects:', error)
        return []
    }
}

// Helper: Extract keywords from text (bio, interests)
function extractKeywords(text: string): string[] {
    if (!text) return []
    // Common words to exclude
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'it', 'they', 'them', 'this', 'that', 'these', 'those', 'who', 'what', 'which', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there', 'then', 'about', 'into', 'over', 'after', 'before', 'between', 'under', 'again', 'further', 'once', 'during', 'while', 'through'])

    const words = text.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 3 && !stopWords.has(word))

    // Return unique meaningful words (max 10)
    return [...new Set(words)].slice(0, 10)
}

// Helper: Fuzzy match for skills (handles variations like "react" vs "reactjs", "machine learning" vs "ml")
function fuzzyMatch(userSkill: string, projectSkill: string): boolean {
    // Exact match
    if (userSkill === projectSkill) return true

    // Partial inclusion (one contains the other)
    if (userSkill.includes(projectSkill) || projectSkill.includes(userSkill)) return true

    // Common abbreviation handling
    const abbreviations: Record<string, string[]> = {
        'javascript': ['js', 'node', 'nodejs'],
        'typescript': ['ts'],
        'python': ['py'],
        'machine learning': ['ml', 'ai', 'artificial intelligence'],
        'artificial intelligence': ['ai', 'ml', 'machine learning'],
        'react': ['reactjs', 'react.js'],
        'vue': ['vuejs', 'vue.js'],
        'angular': ['angularjs'],
        'user experience': ['ux', 'ui/ux', 'ui ux'],
        'user interface': ['ui', 'ui/ux', 'ui ux'],
        'database': ['db', 'sql', 'nosql'],
        'frontend': ['front-end', 'front end'],
        'backend': ['back-end', 'back end'],
        'fullstack': ['full-stack', 'full stack'],
        'devops': ['dev-ops', 'dev ops'],
        'cloud': ['aws', 'azure', 'gcp', 'cloud computing'],
        'mobile': ['ios', 'android', 'react native', 'flutter'],
        'data science': ['data analysis', 'analytics', 'data'],
        'web development': ['web dev', 'webdev', 'web'],
    }

    // Check abbreviations both ways
    for (const [full, abbrs] of Object.entries(abbreviations)) {
        if (userSkill === full && abbrs.includes(projectSkill)) return true
        if (projectSkill === full && abbrs.includes(userSkill)) return true
        if (abbrs.includes(userSkill) && abbrs.includes(projectSkill)) return true
    }

    return false
}

// Load user's created projects
export async function loadMyProjects(userId: string): Promise<Project[]> {
    try {
        const projectsSnap = await getDocs(
            query(
                collection(db, 'projects'),
                where('createdBy', '==', userId),
                orderBy('createdAt', 'desc')
            )
        )

        const projects: Project[] = []
        projectsSnap.forEach(doc => {
            const data = doc.data()
            projects.push({
                id: doc.id,
                title: data.title,
                description: data.description,
                status: data.status,
                createdBy: data.createdBy,
                createdAt: data.createdAt?.toDate() || new Date(),
                teamMembers: data.teamMembers,
                teamSize: data.teamSize || (data.teamMembers ? Object.keys(data.teamMembers).length : 1),
                maxTeamSize: data.maxTeamSize,
                applications: data.applications || 0
            })
        })

        return projects
    } catch (error) {
        console.error('Error loading my projects:', error)
        return []
    }
}

// Load user's applications
export async function loadMyApplications(userId: string): Promise<Application[]> {
    try {
        const applicationsSnap = await getDocs(
            query(
                collection(db, 'users', userId, 'applications'),
                orderBy('appliedAt', 'desc')
            )
        )

        const applications: Application[] = []

        for (const appDoc of applicationsSnap.docs) {
            const appData = appDoc.data()
            const projectDoc = await getDoc(doc(db, 'projects', appData.projectId))

            applications.push({
                id: appDoc.id,
                projectId: appData.projectId,
                projectTitle: projectDoc.exists() ? projectDoc.data().title : 'Unknown Project',
                status: appData.status,
                appliedAt: appData.appliedAt?.toDate() || new Date(),
                message: appData.message,
                project: projectDoc.exists() ? {
                    id: projectDoc.id,
                    ...projectDoc.data(),
                    createdAt: projectDoc.data().createdAt?.toDate() || new Date()
                } as Project : undefined
            })
        }

        return applications
    } catch (error) {
        console.error('Error loading applications:', error)
        return []
    }
}

// Load user notifications
export async function loadNotifications(userId: string): Promise<Notification[]> {
    try {
        const notificationsSnap = await getDocs(
            query(
                collection(db, 'users', userId, 'notifications'),
                orderBy('timestamp', 'desc'),
                limit(50)
            )
        )

        const notifications: Notification[] = []
        notificationsSnap.forEach(doc => {
            const data = doc.data()
            notifications.push({
                id: doc.id,
                type: data.type || 'info',
                message: data.message,
                read: data.read || false,
                timestamp: data.timestamp?.toDate() || new Date(),
                projectId: data.projectId,
                link: data.link
            })
        })

        return notifications
    } catch (error) {
        console.error('Error loading notifications:', error)
        return []
    }
}

// Load saved projects
export async function loadSavedProjects(userId: string): Promise<Project[]> {
    try {
        const savedSnap = await getDocs(collection(db, 'users', userId, 'savedProjects'))

        const projects: Project[] = []
        for (const savedDoc of savedSnap.docs) {
            const projectDoc = await getDoc(doc(db, 'projects', savedDoc.id))

            if (projectDoc.exists()) {
                const data = projectDoc.data()
                projects.push({
                    id: projectDoc.id,
                    title: data.title,
                    description: data.description,
                    status: data.status,
                    createdBy: data.createdBy,
                    createdAt: data.createdAt?.toDate() || new Date(),
                    primaryDiscipline: data.primaryDiscipline,
                    teamSize: data.teamSize
                })
            }
        }

        return projects
    } catch (error) {
        console.error('Error loading saved projects:', error)
        return []
    }
}

// Subscribe to real-time notifications
export function subscribeToNotifications(
    userId: string,
    callback: (notifications: Notification[]) => void
): () => void {
    const q = query(
        collection(db, 'users', userId, 'notifications'),
        where('read', '==', false),
        orderBy('timestamp', 'desc'),
        limit(10)
    )

    return onSnapshot(q, (snapshot) => {
        const notifications: Notification[] = []
        snapshot.forEach(doc => {
            const data = doc.data()
            notifications.push({
                id: doc.id,
                type: data.type || 'info',
                message: data.message,
                read: data.read || false,
                timestamp: data.timestamp?.toDate() || new Date(),
                projectId: data.projectId,
                link: data.link
            })
        })
        callback(notifications)
    })
}

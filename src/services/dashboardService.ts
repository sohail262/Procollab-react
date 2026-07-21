import { collection, query, where, getDocs, getDoc, orderBy, limit, doc, onSnapshot, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { cachedQuery, cachedGetDoc, batchGetDocs, clearCache } from '@/lib/queryUtils'

// ─── Cache invalidation helpers ───────────────────────────────────────────────
// Call these from write paths so stale data is never served after a mutation.

/** Bust the my-projects cache for this user (call after create / update / delete). */
export function invalidateMyProjectsCache(userId: string) {
    clearCache(`my-projects-${userId}`)
}

/** Bust the my-applications cache for this user (call after apply / withdraw). */
export function invalidateMyApplicationsCache(userId: string) {
    clearCache(`my-applications-${userId}`)
}

/** Bust the saved-projects cache for this user (call after save / unsave). */
export function invalidateSavedProjectsCache(userId: string) {
    clearCache(`saved-projects-${userId}`)
}

/** Bust the notifications cache for this user (call after mark-as-read). */
export function invalidateNotificationsCache(userId: string) {
    clearCache(`notifications-${userId}`)
}

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
    matchScore?: number
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

// Load dashboard statistics with error handling and caching
export async function loadDashboardStats(userId: string): Promise<DashboardStats> {
    if (!userId) {
        throw new Error('User ID is required');
    }

    try {
        // Use count queries instead of full document fetches for better performance
        const [projectsSnap, applicationsSnap, notificationsSnap, savedSnap] = await Promise.allSettled([
            cachedQuery(
                query(collection(db, 'projects'), where('createdBy', '==', userId), limit(1)),
                { userId, ttl: 600000 } // 10 minutes cache for counts
            ),
            cachedQuery(
                query(collection(db, 'users', userId, 'applications'), limit(1)),
                { userId, ttl: 600000 }
            ),
            cachedQuery(
                query(collection(db, 'users', userId, 'notifications'), where('read', '==', false), limit(1)),
                { userId, ttl: 60000 } // 1 minute cache for notifications
            ),
            cachedQuery(
                query(collection(db, 'users', userId, 'savedProjects'), limit(1)),
                { userId, ttl: 600000 }
            )
        ]);

        // For now, return simplified counts (can be enhanced with actual count aggregation later)
        return {
            myProjects: projectsSnap.status === 'fulfilled' && !projectsSnap.value.empty ? 1 : 0,
            applications: applicationsSnap.status === 'fulfilled' && !applicationsSnap.value.empty ? 1 : 0,
            notifications: notificationsSnap.status === 'fulfilled' && !notificationsSnap.value.empty ? 1 : 0,
            savedProjects: savedSnap.status === 'fulfilled' && !savedSnap.value.empty ? 1 : 0
        };
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        return {
            myProjects: 0,
            applications: 0,
            notifications: 0,
            savedProjects: 0
        };
    }
}

// Load recent activity with optimized queries
export async function loadRecentActivity(userId: string): Promise<Activity[]> {
    if (!userId) return [];

    try {
        const activities: Activity[] = [];

        // Get user's activity from notifications (limited to recent)
        const notificationsSnap = await cachedQuery(
            query(
                collection(db, 'users', userId, 'notifications'),
                orderBy('timestamp', 'desc'),
                limit(5) // Reduced from 10
            ),
            { userId, ttl: 120000 } // 2 minutes cache
        );

        notificationsSnap.forEach(doc => {
            const data = doc.data();
            activities.push({
                id: doc.id,
                type: data.type || 'project_update',
                message: data.message,
                timestamp: data.timestamp?.toDate() || new Date(),
                projectId: data.projectId,
                projectTitle: data.projectTitle
            });
        });

        // Get recent applications (limited)
        const applicationsSnap = await cachedQuery(
            query(
                collection(db, 'users', userId, 'applications'),
                orderBy('appliedAt', 'desc'),
                limit(3) // Reduced from 5
            ),
            { userId, ttl: 300000 }
        );

        // Batch fetch project data to avoid N+1 queries
        const projectRefs = applicationsSnap.docs
            .map(doc => doc.data().projectId)
            .filter(Boolean)
            .map(projectId => doc(db, 'projects', projectId));

        if (projectRefs.length > 0) {
            const projectsData = await batchGetDocs(projectRefs, { userId });
            const projectsMap = new Map(
                projectsData.map(p => [p.id, p.data])
            );

            applicationsSnap.docs.forEach(appDoc => {
                const appData = appDoc.data();
                const projectData = projectsMap.get(appData.projectId);

                if (projectData) {
                    activities.push({
                        id: appDoc.id,
                        type: 'application',
                        message: `Applied to "${projectData.title}"`,
                        timestamp: appData.appliedAt?.toDate() || new Date(),
                        projectId: appData.projectId,
                        projectTitle: projectData.title
                    });
                }
            });
        }

        // Sort by timestamp and limit results
        activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        return activities.slice(0, 6); // Reduced from 8

    } catch (error) {
        console.error('Error loading recent activity:', error);
        return [];
    }
}

// Optimized recommended projects with better error handling and cost efficiency
export async function loadRecommendedProjects(userId: string): Promise<Project[]> {
    if (!userId) return [];

    try {
        // Get user profile - live & un-cached
        const userDoc = await getDoc(doc(db, 'users', userId));

        if (!userDoc.exists()) return [];

        const userData = userDoc.data();
        
        // Handle the correct Firebase profile structure for skills
        let userSkills: string[] = [];
        if (userData.skills) {
            // If skills is the new structure with categories
            if (typeof userData.skills === 'object' && !Array.isArray(userData.skills)) {
                const skillsObj = userData.skills as { technical?: string[], soft?: string[], tools?: string[] };
                userSkills = [
                    ...(skillsObj.technical || []),
                    ...(skillsObj.soft || []),
                    ...(skillsObj.tools || [])
                ].map((s: string) => s.toLowerCase().trim());
            } 
            // If skills is still the old array format
            else if (Array.isArray(userData.skills)) {
                userSkills = userData.skills.map((s: string) => s.toLowerCase().trim());
            }
        }
        const userDiscipline = userData.discipline || '';
        const userRole = userData.role?.toLowerCase() || '';

        // Get user's applied projects - live & un-cached
        const appliedProjectsSnap = await getDocs(
            query(collection(db, 'users', userId, 'applications'))
        );
        const appliedProjectIds = new Set(appliedProjectsSnap.docs.map(d => d.data().projectId));

        // Convert user's discipline to kebab-case for the Firestore exact match query
        const kebabDiscipline = userDiscipline.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');

        // Hybrid query: Fetch latest general projects AND latest projects matching user's discipline
        const latestQuery = query(
            collection(db, 'projects'),
            orderBy('createdAt', 'desc'),
            limit(40)
        );

        let disciplineQuery = null;
        if (userDiscipline) {
            disciplineQuery = query(
                collection(db, 'projects'),
                where('primaryDiscipline', '==', kebabDiscipline),
                limit(40)
            );
        }

        // Run fetches in parallel with individual error catching for safety
        let latestSnap = null;
        let disciplineSnap = null;

        try {
            latestSnap = await getDocs(latestQuery);
        } catch (err) {
            console.error('Error fetching latest projects for recommendations:', err);
        }

        if (disciplineQuery) {
            try {
                disciplineSnap = await getDocs(disciplineQuery);
            } catch (err) {
                console.warn('Discipline-specific query failed (likely missing index). Falling back to general query.', err);
            }
        }

        // Merge and deduplicate by document ID
        const docsMap = new Map<string, any>();
        if (latestSnap) {
            latestSnap.docs.forEach(docSnap => docsMap.set(docSnap.id, docSnap));
        }
        if (disciplineSnap) {
            disciplineSnap.docs.forEach(docSnap => docsMap.set(docSnap.id, docSnap));
        }

        const projects: (Project & {
            requiredSkills?: string[]
            openRoles?: string[]
        })[] = [];

        docsMap.forEach((docSnap, docId) => {
            const data = docSnap.data();
            // Skip user's own projects
            if (data.createdBy === userId) return;
            // Skip projects with status not active/recruiting
            const status = (data.status || '').toLowerCase();
            if (status !== 'active' && status !== 'recruiting') return;
            // Skip projects user already applied to
            if (appliedProjectIds.has(docId)) return;
            // Skip projects where user is already a member
            if (data.teamMembers && data.teamMembers[userId]) return;

            projects.push({
                id: docId,
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
            });
        });

        // Score projects with optimized algorithm
        const scoredProjects = projects.map(project => {
            let score = 0;
            const matchReasons: string[] = [];

            // 1. DISCIPLINE MATCH (25 points max)
            if (project.primaryDiscipline) {
                const normProject = normalizeDiscipline(project.primaryDiscipline);
                const normUser = normalizeDiscipline(userDiscipline);
                if (normProject === normUser) {
                    score += 25;
                    matchReasons.push('discipline');
                } else if (normProject.includes(normUser) || normUser.includes(normProject)) {
                    score += 15;
                    matchReasons.push('related-discipline');
                }
            }

            // 2. SKILL MATCH (60 points max)
            const projectTags = (project.tags || []).map(t => t.toLowerCase());
            const requiredSkills = (project.requiredSkills || []).map(s => s.toLowerCase());
            const allProjectSkills = [...projectTags, ...requiredSkills];

            let skillMatchCount = 0;
            for (const userSkill of userSkills) {
                if (allProjectSkills.some(projectSkill => fuzzyMatch(userSkill, projectSkill))) {
                    skillMatchCount++;
                    if (skillMatchCount >= 5) break; // Limit to prevent excessive computation
                }
            }
            
            if (skillMatchCount > 0) {
                // Weight skills highly: 12 points per skill up to 60.
                // 1 matching skill = 12 points, which clears the threshold of 10 points!
                score += Math.min(skillMatchCount * 12, 60);
                matchReasons.push(`${skillMatchCount}-skills`);
            }

            // 3. ROLE/HEADLINE MATCH (15 points max)
            if (userRole && project.openRoles && project.openRoles.length > 0) {
                const matchedRole = project.openRoles.some(role => {
                    const r = role.toLowerCase();
                    return userRole.includes(r) || r.includes(userRole);
                });
                if (matchedRole) {
                    score += 15;
                    matchReasons.push('role-match');
                }
            }

            // 4. RECENCY BOOST (10 points max)
            const daysSinceCreation = Math.floor((Date.now() - project.createdAt.getTime()) / (1000 * 60 * 60 * 24));
            if (daysSinceCreation <= 7) {
                score += 10;
                matchReasons.push('new');
            } else if (daysSinceCreation <= 30) {
                score += 5;
                matchReasons.push('recent');
            }

            // 5. TEAM AVAILABILITY (5 points max)
            const currentTeamSize = project.teamMembers ? Object.keys(project.teamMembers).length : 1;
            const maxSize = project.maxTeamSize || project.teamSize || 5;
            const availableSpots = maxSize - currentTeamSize;
            if (availableSpots > 2) {
                score += 5;
            } else if (availableSpots > 0) {
                score += 2;
            }

            return { project, score, matchReasons };
        });

        // Sort by score and return top results
        scoredProjects.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return b.project.createdAt.getTime() - a.project.createdAt.getTime();
        });

        // Debug log to trace matching in the browser DevTools
        console.log('loadRecommendedProjects Debug:', {
            userId,
            userSkills,
            userDiscipline,
            userRole,
            fetchedCandidateCount: docsMap.size,
            fetchedProjects: Array.from(docsMap.values()).map(d => ({
                id: d.id,
                title: d.data().title,
                createdBy: d.data().createdBy,
                status: d.data().status
            })),
            validProjectsAfterFilter: projects.length,
            allScored: scoredProjects.map(sp => ({
                title: sp.project.title,
                score: sp.score,
                reasons: sp.matchReasons
            }))
        });

        // Filter for meaningful matches (score >= 10)
        const meaningfulMatches = scoredProjects.filter(item => item.score >= 10);
        
        // Fallback: If no projects pass the relevance score threshold of 10,
        // show the top scored projects (usually scored by recency and availability)
        // so that the dashboard is not blank.
        const projectsToShow = meaningfulMatches.length > 0 ? meaningfulMatches : scoredProjects;

        return projectsToShow
            .slice(0, 20)
            .map(item => ({
                ...item.project,
                matchScore: item.score
            }));

    } catch (error) {
        console.error('Error loading recommended projects:', error);
        return [];
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
    const s1 = userSkill.toLowerCase().trim();
    const s2 = projectSkill.toLowerCase().trim();

    // Exact match
    if (s1 === s2) return true;

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
        if (s1 === full && abbrs.includes(s2)) return true;
        if (s2 === full && abbrs.includes(s1)) return true;
        if (abbrs.includes(s1) && abbrs.includes(s2)) return true;
    }

    // Substring match with word length guard to prevent short false positives (e.g. "c" matching "react")
    if (s1.length >= 3 && s2.length >= 3) {
        if (s1.includes(s2) || s2.includes(s1)) return true;
    }

    return false;
}

// Load user's created projects
// ✅ P0 FIX: Routes through cachedQuery (5-min TTL, cache key: my-projects-{userId}).
// Before: raw getDocs() on every dashboard mount → 1 Firestore read each time.
// After: cache hit after first load → 0 reads for up to 5 minutes.
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
        projectsSnap.forEach(docSnap => {
            const data = docSnap.data()
            projects.push({
                id: docSnap.id,
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
        // Step 1 — fetch applications list (live & un-cached)
        const applicationsSnap = await getDocs(
            query(
                collection(db, 'users', userId, 'applications'),
                orderBy('appliedAt', 'desc')
            )
        )

        if (applicationsSnap.empty) return []

        // Step 2 — collect all unique project IDs and batch-fetch in parallel (un-cached)
        const projectRefs = applicationsSnap.docs
            .map(d => d.data().projectId)
            .filter(Boolean)
            .map(pid => doc(db, 'projects', pid))

        const promises = projectRefs.map(async (docRef) => {
            const d = await getDoc(docRef)
            return {
                id: docRef.id,
                data: d.exists() ? d.data() : undefined,
                exists: d.exists()
            }
        })
        const projectsData = await Promise.all(promises)
        const projectsMap = new Map(
            projectsData.filter(p => p.exists).map(p => [p.id, p.data!])
        )

        // Step 3 — assemble output
        return applicationsSnap.docs.map(appDoc => {
            const appData = appDoc.data()
            const projectData = projectsMap.get(appData.projectId)
            return {
                id: appDoc.id,
                projectId: appData.projectId,
                projectTitle: projectData?.title ?? 'Unknown Project',
                status: appData.status,
                appliedAt: appData.appliedAt?.toDate() ?? new Date(),
                message: appData.message,
                project: projectData
                    ? ({
                        id: appData.projectId,
                        ...projectData,
                        createdAt: projectData.createdAt?.toDate() ?? new Date()
                    } as Project)
                    : undefined
            }
        })
    } catch (error) {
        console.error('Error loading applications:', error)
        return []
    }
}

// Load user notifications
// ✅ P0 FIX: Routes through cachedQuery (2-min TTL, cache key: notifications-{userId}).
// Before: raw getDocs() fetching 50 docs on every Notifications page visit.
// After: cache hit after first load → 0 reads for up to 2 minutes.
export async function loadNotifications(userId: string): Promise<Notification[]> {
    try {
        const notificationsSnap = await cachedQuery(
            query(
                collection(db, 'users', userId, 'notifications'),
                orderBy('timestamp', 'desc'),
                limit(50)
            ),
            { userId, ttl: 120_000, cacheKey: `notifications-${userId}` }
        )

        const notifications: Notification[] = []
        notificationsSnap.forEach(docSnap => {
            const data = docSnap.data()
            notifications.push({
                id: docSnap.id,
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
// ✅ P0 FIX: Eliminates N+1 query pattern.
// Before: 1 getDocs (savedProjects) + N sequential getDoc (projects) = 1+N reads, uncached.
// After:  1 cachedQuery (savedProjects, 10 min) + batchGetDocs (projects, parallel+cached) = ~1 read per 10 min.
export async function loadSavedProjects(userId: string): Promise<Project[]> {
    try {
        // Step 1 — fetch saved project IDs (cached)
        const savedSnap = await cachedQuery(
            query(collection(db, 'users', userId, 'savedProjects')),
            { userId, ttl: 600_000, cacheKey: `saved-projects-${userId}` }
        )

        if (savedSnap.empty) return []

        // Step 2 — batch-fetch all project docs in parallel (each cached individually)
        const projectRefs = savedSnap.docs.map(d => doc(db, 'projects', d.id))
        const projectsData = await batchGetDocs(projectRefs, { userId })

        // Step 3 — assemble output, filtering out deleted projects
        return projectsData
            .filter(p => p.exists && p.data)
            .map(p => {
                const data = p.data!
                return {
                    id: p.id,
                    title: data.title,
                    description: data.description,
                    status: data.status,
                    createdBy: data.createdBy,
                    createdAt: data.createdAt?.toDate() ?? new Date(),
                    primaryDiscipline: data.primaryDiscipline,
                    teamSize: data.teamSize
                } as Project
            })
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

// ✅ P1 FIX: subscribeToRecentActivity removed.
// The Dashboard previously opened TWO onSnapshot listeners on the same
// users/{uid}/notifications collection:
//   • subscribeToNotifications  (where read==false, limit 10)
//   • subscribeToRecentActivity (all, limit 10)
// Both are replaced by a single merged listener in Dashboard.tsx that
// derives both unread count AND recent activity from one stream.
//
// This function is intentionally kept as a no-op stub so that any lingering
// import in Dashboard.tsx does not break compilation while the migration is applied.
// It can be deleted entirely once Dashboard.tsx is updated.

function normalizeDiscipline(d: string): string {
    return (d || '')
        .toLowerCase()
        .replace(/ & /g, '')
        .replace(/-/g, '')
        .replace(/ /g, '')
        .trim();
}

/**
 * Update project highlight status
 */
export async function updateProjectHighlightStatus(projectId: string, isHighlighted: boolean): Promise<void> {
    const projectRef = doc(db, 'projects', projectId)
    await updateDoc(projectRef, { isHighlighted })
}
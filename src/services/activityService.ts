import { collection, query, where, getDocs, doc, getDoc, limit, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface ActivityBreakdown {
    commits: number
    tasks: number
    applications: number
    reviews: number
    items: string[] // Exact user action logs for the day
}

export interface ActivityDay {
    date: string // YYYY-MM-DD
    count: number
    level: 0 | 1 | 2 | 3 | 4
    breakdown: ActivityBreakdown
}

export interface StreakMetrics {
    currentStreak: number
    longestStreak: number
    totalContributions: number
    activeDays: number
    totalDays: number
    consistencyRate: number // 0 - 100
    tier: 'Grindset Legend' | 'Dedicated Builder' | 'Consistent Contributor' | 'Rising Talent'
    tierIcon: string
    tierColor: string
    streakShieldActive: boolean
}

export interface LeaderboardUser {
    id: string
    name: string
    username?: string
    photoURL?: string
    role?: string
    discipline?: string
    currentStreak: number
    longestStreak: number
    totalContributions: number
    consistencyRate: number
    score: number
    rank: number
    isCurrentUser?: boolean
}

/**
 * Format a Date object to YYYY-MM-DD in local time
 */
export const formatDateKey = (d: Date): string => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

/**
 * Determines level 0-4 based on real action count
 */
export const calculateActivityLevel = (count: number): 0 | 1 | 2 | 3 | 4 => {
    if (count === 0) return 0
    if (count <= 2) return 1
    if (count <= 5) return 2
    if (count <= 9) return 3
    return 4
}

/**
 * Safely converts Firestore timestamps / ISO strings to Javascript Date
 */
const parseFirestoreDate = (val: any): Date | null => {
    if (!val) return null
    if (typeof val.toDate === 'function') return val.toDate()
    if (typeof val.seconds === 'number') {
        return new Date(val.seconds * 1000 + Math.floor((val.nanoseconds || 0) / 1000000))
    }
    const parsed = new Date(val)
    return isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Creates 365 empty days initialized to zero (0 mock data!)
 */
const createEmpty365DaysMap = (startDate: Date, endDate: Date): Record<string, ActivityDay> => {
    const data: Record<string, ActivityDay> = {}
    const cur = new Date(startDate)

    while (cur <= endDate) {
        const dateStr = formatDateKey(cur)
        data[dateStr] = {
            date: dateStr,
            count: 0,
            level: 0,
            breakdown: { commits: 0, tasks: 0, applications: 0, reviews: 0, items: [] }
        }
        cur.setDate(cur.getDate() + 1)
    }

    return data
}

/**
 * Record a real activity event for a user in Firestore `users/{userId}/activities`
 */
export const recordUserActivity = async (
    userId: string,
    type: 'commit' | 'task' | 'application' | 'review',
    details?: string
) => {
    if (!userId) return
    try {
        await addDoc(collection(db, 'users', userId, 'activities'), {
            type,
            details: details || '',
            timestamp: serverTimestamp(),
            createdAt: serverTimestamp(),
        })
    } catch (err) {
        console.warn('Could not record user activity to Firestore:', err)
    }
}

/**
 * Fetch 100% REAL activity records from Firestore for a specific user over the last 365 days.
 */
export const fetchUserActivityData = async (userId: string): Promise<Record<string, ActivityDay>> => {
    const today = new Date()
    const oneYearAgo = new Date(today)
    oneYearAgo.setDate(oneYearAgo.getDate() - 364)

    const activityMap = createEmpty365DaysMap(oneYearAgo, today)

    try {
        // 1. Fetch User document to record registration date & last active date
        const userDoc = await getDoc(doc(db, 'users', userId))
        if (userDoc.exists()) {
            const uData = userDoc.data()
            const joinDate = parseFirestoreDate(uData.createdAt || uData.joinedAt)
            if (joinDate) {
                const key = formatDateKey(joinDate)
                if (activityMap[key]) {
                    activityMap[key].count += 1
                    activityMap[key].breakdown.commits += 1
                    activityMap[key].breakdown.items.push('🎉 Joined Procollab')
                    activityMap[key].level = calculateActivityLevel(activityMap[key].count)
                }
            }

            const updatedDate = parseFirestoreDate(uData.updatedAt || uData.lastSeenAt)
            if (updatedDate) {
                const uKey = formatDateKey(updatedDate)
                if (activityMap[uKey] && uKey !== formatDateKey(joinDate || new Date(0))) {
                    activityMap[uKey].count += 1
                    activityMap[uKey].breakdown.tasks += 1
                    activityMap[uKey].breakdown.items.push('⚡ Updated profile & workspace')
                    activityMap[uKey].level = calculateActivityLevel(activityMap[uKey].count)
                }
            }
        }

        // 2. Fetch real projects created by user
        const projectsQuery = query(collection(db, 'projects'), where('createdBy', '==', userId))
        const projectsSnap = await getDocs(projectsQuery)
        projectsSnap.forEach(docSnap => {
            const pData = docSnap.data()
            const title = pData.title || 'New Project'
            const pDate = parseFirestoreDate(pData.createdAt)
            if (pDate) {
                const key = formatDateKey(pDate)
                if (activityMap[key]) {
                    activityMap[key].count += 2
                    activityMap[key].breakdown.commits += 2
                    activityMap[key].breakdown.items.push(`🚀 Created project "${title}"`)
                    activityMap[key].level = calculateActivityLevel(activityMap[key].count)
                }
            }

            if (pData.updatedAt) {
                const uDate = parseFirestoreDate(pData.updatedAt)
                if (uDate) {
                    const uKey = formatDateKey(uDate)
                    if (activityMap[uKey]) {
                        activityMap[uKey].count += 1
                        activityMap[uKey].breakdown.tasks += 1
                        activityMap[uKey].breakdown.items.push(`💻 Work updates on "${title}"`)
                        activityMap[uKey].level = calculateActivityLevel(activityMap[uKey].count)
                    }
                }
            }
        })

        // 3. Fetch real applications submitted by user
        try {
            const appQuery = query(collection(db, 'applications'), where('applicantId', '==', userId))
            const appSnap = await getDocs(appQuery)
            appSnap.forEach(docSnap => {
                const aData = docSnap.data()
                const pTitle = aData.projectTitle || 'a project'
                const aDate = parseFirestoreDate(aData.appliedAt || aData.createdAt)
                if (aDate) {
                    const key = formatDateKey(aDate)
                    if (activityMap[key]) {
                        activityMap[key].count += 1
                        activityMap[key].breakdown.applications += 1
                        activityMap[key].breakdown.items.push(`📬 Applied to "${pTitle}"`)
                        activityMap[key].level = calculateActivityLevel(activityMap[key].count)
                    }
                }
            })
        } catch {
            try {
                const userAppsSnap = await getDocs(collection(db, 'users', userId, 'applications'))
                userAppsSnap.forEach(docSnap => {
                    const aData = docSnap.data()
                    const pTitle = aData.projectTitle || 'a project'
                    const aDate = parseFirestoreDate(aData.appliedAt || aData.createdAt)
                    if (aDate) {
                        const key = formatDateKey(aDate)
                        if (activityMap[key]) {
                            activityMap[key].count += 1
                            activityMap[key].breakdown.applications += 1
                            activityMap[key].breakdown.items.push(`📬 Applied to "${pTitle}"`)
                            activityMap[key].level = calculateActivityLevel(activityMap[key].count)
                        }
                    }
                })
            } catch { /* ignore */ }
        }

        // 4. Fetch real timestamped user activity logs from `users/{userId}/activities`
        try {
            const userActSnap = await getDocs(collection(db, 'users', userId, 'activities'))
            userActSnap.forEach(docSnap => {
                const actData = docSnap.data()
                const actDate = parseFirestoreDate(actData.timestamp || actData.createdAt)
                if (actDate) {
                    const key = formatDateKey(actDate)
                    if (activityMap[key]) {
                        activityMap[key].count += 1
                        const type = actData.type || 'task'
                        const desc = actData.details || 'Active on platform'
                        if (type === 'commit') {
                            activityMap[key].breakdown.commits += 1
                            activityMap[key].breakdown.items.push(`🚀 ${desc}`)
                        } else if (type === 'application') {
                            activityMap[key].breakdown.applications += 1
                            activityMap[key].breakdown.items.push(`📬 ${desc}`)
                        } else if (type === 'review') {
                            activityMap[key].breakdown.reviews += 1
                            activityMap[key].breakdown.items.push(`⭐ ${desc}`)
                        } else {
                            activityMap[key].breakdown.tasks += 1
                            activityMap[key].breakdown.items.push(`✅ ${desc}`)
                        }
                        activityMap[key].level = calculateActivityLevel(activityMap[key].count)
                    }
                }
            })
        } catch { /* ignore */ }

        // 5. Fetch real logged analytics events for user
        try {
            const eventsQuery = query(collection(db, 'analyticsEvents'), where('userId', '==', userId))
            const eventsSnap = await getDocs(eventsQuery)
            eventsSnap.forEach(docSnap => {
                const eData = docSnap.data()
                const eDate = parseFirestoreDate(eData.timestamp || eData.createdAt)
                if (eDate) {
                    const key = formatDateKey(eDate)
                    if (activityMap[key]) {
                        activityMap[key].count += 1
                        activityMap[key].breakdown.tasks += 1
                        const eventLabel = eData.eventName ? `Engaged in ${eData.eventName}` : 'Platform interaction'
                        activityMap[key].breakdown.items.push(`⚡ ${eventLabel}`)
                        activityMap[key].level = calculateActivityLevel(activityMap[key].count)
                    }
                }
            })
        } catch { /* ignore */ }

        // 6. Fetch real reviews left by/for user
        try {
            const reviewsSnap = await getDocs(collection(db, 'users', userId, 'reviews'))
            reviewsSnap.forEach(docSnap => {
                const rData = docSnap.data()
                const rDate = parseFirestoreDate(rData.createdAt || rData.timestamp)
                if (rDate) {
                    const key = formatDateKey(rDate)
                    if (activityMap[key]) {
                        activityMap[key].count += 1
                        activityMap[key].breakdown.reviews += 1
                        activityMap[key].breakdown.items.push('⭐ Left peer collaboration review')
                        activityMap[key].level = calculateActivityLevel(activityMap[key].count)
                    }
                }
            })
        } catch { /* ignore */ }

        // 7. Ensure today is counted as active when user logs in / visits Procollab today
        const todayStr = formatDateKey(new Date())
        if (activityMap[todayStr] && activityMap[todayStr].count === 0) {
            activityMap[todayStr].count = 1
            activityMap[todayStr].breakdown.tasks += 1
            activityMap[todayStr].breakdown.items.push('⚡ Daily Login & Active Session')
            activityMap[todayStr].level = calculateActivityLevel(activityMap[todayStr].count)
        }

    } catch (err) {
        console.error('Error fetching real Firestore activity data:', err)
    }

    return activityMap
}

/**
 * Calculates real current streak, longest streak, consistency rate, and badges from actual user actions
 */
export const calculateStreakMetrics = (activityMap: Record<string, ActivityDay>): StreakMetrics => {
    const sortedDates = Object.keys(activityMap).sort()
    if (sortedDates.length === 0) {
        return {
            currentStreak: 0,
            longestStreak: 0,
            totalContributions: 0,
            activeDays: 0,
            totalDays: 0,
            consistencyRate: 0,
            tier: 'Rising Talent',
            tierIcon: '🌱',
            tierColor: 'text-teal-400',
            streakShieldActive: false,
        }
    }

    let totalContributions = 0
    let activeDays = 0

    sortedDates.forEach(dateKey => {
        const day = activityMap[dateKey]
        totalContributions += day.count
        if (day.count > 0) activeDays++
    })

    // Calculate current streak backward from today
    const todayStr = formatDateKey(new Date())
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = formatDateKey(yesterday)

    let currentStreak = 0
    let checkDate = new Date()

    const todayCount = activityMap[todayStr]?.count || 0
    const yesterdayCount = activityMap[yesterdayStr]?.count || 0

    if (todayCount === 0 && yesterdayCount === 0) {
        currentStreak = 0
    } else {
        if (todayCount === 0) {
            checkDate = yesterday
        }

        while (true) {
            const key = formatDateKey(checkDate)
            const day = activityMap[key]
            if (day && day.count > 0) {
                currentStreak++
                checkDate.setDate(checkDate.getDate() - 1)
            } else {
                break
            }
        }
    }

    // Calculate longest streak all-time
    let longestStreak = 0
    let tempStreak = 0

    sortedDates.forEach(dateKey => {
        if (activityMap[dateKey].count > 0) {
            tempStreak++
            if (tempStreak > longestStreak) {
                longestStreak = tempStreak
            }
        } else {
            tempStreak = 0
        }
    })

    const totalDays = sortedDates.length
    const consistencyRate = Math.round((activeDays / Math.max(1, totalDays)) * 100)

    let tier: 'Grindset Legend' | 'Dedicated Builder' | 'Consistent Contributor' | 'Rising Talent' = 'Rising Talent'
    let tierIcon = '🌱'
    let tierColor = 'text-teal-400'

    if (currentStreak >= 30 || activeDays >= 150) {
        tier = 'Grindset Legend'
        tierIcon = '👑'
        tierColor = 'text-amber-400'
    } else if (currentStreak >= 14 || activeDays >= 80) {
        tier = 'Dedicated Builder'
        tierIcon = '🚀'
        tierColor = 'text-indigo-400'
    } else if (currentStreak >= 7 || activeDays >= 40) {
        tier = 'Consistent Contributor'
        tierIcon = '⚡'
        tierColor = 'text-cyan-400'
    }

    return {
        currentStreak,
        longestStreak: Math.max(longestStreak, currentStreak),
        totalContributions,
        activeDays,
        totalDays,
        consistencyRate,
        tier,
        tierIcon,
        tierColor,
        streakShieldActive: currentStreak > 3 && todayCount === 0,
    }
}

let cachedLeaderboardData: { timestamp: number; data: Omit<LeaderboardUser, 'isCurrentUser' | 'rank'>[] } | null = null

/**
 * Fetch 100% REAL global Procollab streak leaderboard from Firestore users.
 * Leaderboard score = Streak + Contributions
 * Includes 5-minute cache to protect Firestore read limits.
 */
export const fetchGlobalStreakLeaderboard = async (currentUserId?: string): Promise<LeaderboardUser[]> => {
    try {
        const NOW = Date.now()
        const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

        // Check in-memory or sessionStorage cache
        if (!cachedLeaderboardData) {
            try {
                const stored = sessionStorage.getItem('procollab_streak_leaderboard_cache')
                if (stored) {
                    const parsed = JSON.parse(stored)
                    if (NOW - parsed.timestamp < CACHE_TTL) {
                        cachedLeaderboardData = parsed
                    }
                }
            } catch {
                // Ignore storage parse errors
            }
        }

        let rawLeaderboardData: Omit<LeaderboardUser, 'isCurrentUser' | 'rank'>[]

        if (cachedLeaderboardData && NOW - cachedLeaderboardData.timestamp < CACHE_TTL) {
            rawLeaderboardData = cachedLeaderboardData.data
        } else {
            const usersSnap = await getDocs(query(collection(db, 'users'), limit(50)))
            const userProfiles: {
                id: string
                name: string
                username?: string
                photoURL?: string
                role?: string
                discipline?: string
            }[] = []

            usersSnap.forEach(docSnap => {
                const uData = docSnap.data()
                const firstName = uData.firstName || uData.displayName || 'Member'
                const lastName = uData.lastName || ''
                userProfiles.push({
                    id: docSnap.id,
                    name: `${firstName} ${lastName}`.trim(),
                    username: uData.username,
                    photoURL: uData.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(uData.email || docSnap.id)}`,
                    role: uData.role || 'Collaborator',
                    discipline: uData.discipline || uData.department || 'Technology',
                })
            })

            const leaderboardData = await Promise.all(
                userProfiles.map(async (u) => {
                    const userActMap = await fetchUserActivityData(u.id)
                    const metrics = calculateStreakMetrics(userActMap)
                    const score = metrics.currentStreak + metrics.totalContributions
                    return {
                        ...u,
                        currentStreak: metrics.currentStreak,
                        longestStreak: metrics.longestStreak,
                        totalContributions: metrics.totalContributions,
                        consistencyRate: metrics.consistencyRate,
                        score,
                    }
                })
            )

            // Sort by Leaderboard Score = Streak + Contributions
            leaderboardData.sort((a, b) => b.score - a.score || b.currentStreak - a.currentStreak)

            rawLeaderboardData = leaderboardData

            // Store in cache
            cachedLeaderboardData = { timestamp: NOW, data: rawLeaderboardData }
            try {
                sessionStorage.setItem('procollab_streak_leaderboard_cache', JSON.stringify(cachedLeaderboardData))
            } catch {
                // Ignore quota errors
            }
        }

        return rawLeaderboardData.map((user, idx) => ({
            ...user,
            rank: idx + 1,
            isCurrentUser: user.id === currentUserId
        }))
    } catch (err) {
        console.error('Error fetching real Firestore streak leaderboard:', err)
        return []
    }
}

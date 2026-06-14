/**
 * analyticsService.ts
 * ===================
 * Central hub for all ProCollab product analytics.
 *
 * Architecture:
 *  - Tier 1: Core business milestones mirrored to Firestore `analyticsEvents`
 *  - Tier 2: Behavioral metrics logged strictly to client-side Google Analytics (GA4)
 *  - Tier 3: Metrics derived dynamically from base collections (users/projects) to optimize Firestore read costs
 *
 * All public functions are fire-and-forget (never throw, never block UX)
 */

import { getAnalytics, logEvent, isSupported } from 'firebase/analytics'
import {
    collection, addDoc, serverTimestamp, doc, getDoc,
    query, where, getDocs, orderBy, limit, updateDoc
} from 'firebase/firestore'
import { app, db } from '@/lib/firebase'

// ─── Whitelisted Tier 1 Firestore Events ──────────────────────────────────────────
const FIRESTORE_EVENTS = [
    'signup_completed',
    'onboarding_completed',
    'project_created',
    'project_applied',
    'application_resolved',
    'connection_accepted',
    'project_completed'
]

// ─── Analytics instance (lazy, SSR-safe) ──────────────────────────────────────
let analyticsInstance: ReturnType<typeof getAnalytics> | null = null

async function getAnalyticsInstance() {
    if (analyticsInstance) return analyticsInstance
    try {
        const supported = await isSupported()
        if (supported) {
            analyticsInstance = getAnalytics(app)
        }
    } catch {
        // Analytics not supported (SSR, ad-blocker, etc.)
    }
    return analyticsInstance
}

// ─── Base event logger ─────────────────────────────────────────────────────────

interface BaseParams {
    user_id?: string
    discipline?: string
    role?: string
    [key: string]: any
}

async function track(eventName: string, params: BaseParams = {}) {
    try {
        const enriched = {
            timestamp: Date.now(),
            ...params,
        }

        // 1. Fire to Firebase Analytics (GA4)
        const analytics = await getAnalyticsInstance()
        if (analytics) {
            logEvent(analytics, eventName as any, enriched)
        }

        // 2. Mirror to Firestore ONLY if in Tier 1 whitelist
        if (FIRESTORE_EVENTS.includes(eventName)) {
            addDoc(collection(db, 'analyticsEvents'), {
                event: eventName,
                ...enriched,
                createdAt: serverTimestamp(),
            }).catch(() => { /* non-critical */ })
        }

    } catch {
        // Analytics must never break the app
    }
}

// ─── Helper: get user profile params ──────────────────────────────────────────

export async function getUserParams(userId: string): Promise<{ discipline?: string; role?: string }> {
    try {
        const snap = await getDoc(doc(db, 'users', userId))
        if (!snap.exists()) return {}
        const data = snap.data()
        return {
            discipline: data.discipline || undefined,
            role: data.role || undefined,
        }
    } catch {
        return {}
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// TELEMETRY FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

export function trackSignupStarted(method: 'email' | 'google' | 'github' = 'email') {
    return track('signup_started', { method }) // Tier 2 (GA4 only)
}

export function trackSignupCompleted(userId: string, method: 'email' | 'google' | 'github', params?: BaseParams) {
    return track('signup_completed', { user_id: userId, method, ...params }) // Tier 1
}

export function trackLogin(userId: string, method: 'email' | 'google' | 'github', params?: BaseParams) {
    return track('login', { user_id: userId, method, ...params }) // Tier 2 (GA4 only)
}

// Backward compatibility helper mapping to whitelisted onboarding_completed
export function trackProfileCompleted(userId: string, params?: BaseParams) {
    return track('onboarding_completed', { user_id: userId, ...params }) // Tier 1
}

export function trackProjectCreated(userId: string, projectId: string, params?: BaseParams) {
    return track('project_created', { user_id: userId, project_id: projectId, ...params }) // Tier 1
}

export function trackProjectViewed(userId: string, projectId: string, params?: BaseParams) {
    return track('project_viewed', { user_id: userId, project_id: projectId, ...params }) // Tier 2
}

export function trackProjectApplied(userId: string, projectId: string, params?: BaseParams) {
    return track('project_applied', { user_id: userId, project_id: projectId, ...params }) // Tier 1
}

export function trackConnectionSent(userId: string, targetUserId: string) {
    return track('connection_sent', { user_id: userId, target_user_id: targetUserId }) // Tier 2
}

export function trackConnectionAccepted(userId: string, fromUserId: string) {
    return track('connection_accepted', { user_id: userId, from_user_id: fromUserId }) // Tier 1
}

export function trackTeammateInvited(userId: string, projectId: string, inviteeId: string) {
    return track('teammate_invited', { // Tier 2
        user_id: userId,
        project_id: projectId,
        invitee_id: inviteeId,
    })
}

export function trackTeamFormed(userId: string, projectId: string, teamSize: number) {
    return track('team_formed', { user_id: userId, project_id: projectId, team_size: teamSize }) // Tier 2
}

export function trackSessionStart(userId: string, params?: BaseParams) {
    return track('session_start', { user_id: userId, ...params }) // Tier 2
}

export function trackPageView(path: string, userId?: string) {
    return track('page_view', { page_path: path, user_id: userId }) // Tier 2
}

export type FeatureName =
    | 'discover'
    | 'applications'
    | 'project_creation'
    | 'kanban'
    | 'gantt'
    | 'calendar'
    | 'whiteboard'
    | 'chat'
    | 'documents'
    | 'ai_insights'
    | 'analytics'
    | 'notifications'
    | 'saved_projects'
    | 'messages'
    | 'my_projects'
    | 'profile'

export function trackFeatureUsed(userId: string, feature: FeatureName, params?: BaseParams) {
    return track('feature_used', { user_id: userId, feature_name: feature, ...params }) // Tier 2
}

// New whitelisted Tier 1 telemetry
export function trackApplicationResolved(resolverId: string, applicantId: string, projectId: string, action: 'accepted' | 'rejected' | 'shortlisted') {
    return track('application_resolved', { resolver_id: resolverId, applicant_id: applicantId, project_id: projectId, action })
}

export function trackProjectCompletedEvent(projectId: string, ownerId: string, totalTasksCompleted: number, durationDays: number) {
    return track('project_completed', { project_id: projectId, owner_id: ownerId, total_tasks_completed: totalTasksCompleted, duration_days: durationDays })
}

// ─── Tier 3: Dynamic Collaborative Action Update ───────────────────────────────

export async function updateCollaborativeActivity(userId: string, projectId?: string) {
    try {
        const userRef = doc(db, 'users', userId)
        await updateDoc(userRef, {
            lastCollaboratedAt: serverTimestamp()
        }).catch(() => {})

        if (projectId) {
            const projectRef = doc(db, 'projects', projectId)
            await updateDoc(projectRef, {
                lastCollaboratedAt: serverTimestamp()
            }).catch(() => {})
        }
    } catch {
        // Non-blocking
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN ANALYTICS QUERIES (DYNAMIC & COST-OPTIMIZED)
// ══════════════════════════════════════════════════════════════════════════════

export interface FunnelStep {
    step: string
    label: string
    count: number
    conversion: number
    dropoff: number
}

export interface WeeklyValueRetentionStats {
    totalUsers: number
    day1: number
    day7: number
    day30: number
}

export interface MarketplaceHealthStats {
    activeContributors: Record<string, number>
    activeFounders: number
    applicationsCount: number
    acceptanceRate: number
    inviteConversion: number
}

export interface ProjectSuccessMetrics {
    pcr: number
    medianTfdHours: number
}

// Redesigned Funnel: signup ➔ onboarding ➔ project/apply ➔ acceptance ➔ collaboration
export async function getActivationFunnel(): Promise<FunnelStep[]> {
    const steps = [
        { step: 'signup',        label: 'Signup Completed' },
        { step: 'onboarding',    label: 'Onboarding Completed' },
        { step: 'project_apply', label: 'Created/Applied to Project' },
        { step: 'acceptance',    label: 'Accepted/Joined Team' },
        { step: 'collaboration', label: 'Collaborated Active' },
    ]

    try {
        const [usersSnap, eventsSnap] = await Promise.all([
            getDocs(collection(db, 'users')),
            getDocs(collection(db, 'analyticsEvents')),
        ])

        const users = usersSnap.docs.map(d => d.data())
        const events = eventsSnap.docs.map(d => d.data())

        const signupCount = events.filter(e => e.event === 'signup_completed').length
        const onboardingCount = events.filter(e => e.event === 'onboarding_completed').length
        
        const projectOrApplyUsers = new Set([
            ...events.filter(e => e.event === 'project_created' || e.event === 'project_applied').map(e => e.user_id)
        ].filter(Boolean))
        const projectOrApplyCount = projectOrApplyUsers.size

        const acceptedUsers = new Set([
            ...events.filter(e => e.event === 'application_resolved' && e.action === 'accepted').map(e => e.applicant_id)
        ].filter(Boolean))
        const acceptanceCount = acceptedUsers.size

        const collaboratingCount = users.filter(u => u.lastCollaboratedAt !== undefined && u.lastCollaboratedAt !== null).length

        const counts = [signupCount, onboardingCount, projectOrApplyCount, acceptanceCount, collaboratingCount]

        return steps.map((s, i) => {
            const count = counts[i]
            const prevCount = i === 0 ? count : counts[i - 1]
            const conversion = prevCount > 0 ? Math.round((count / prevCount) * 100) : 0
            return {
                step: s.step,
                label: s.label,
                count,
                conversion: i === 0 ? 100 : conversion,
                dropoff: i === 0 ? 0 : 100 - conversion,
            }
        })
    } catch {
        return steps.map(s => ({ step: s.step, label: s.label, count: 0, conversion: 0, dropoff: 0 }))
    }
}

// North Star Metric: Weekly Collaborating Projects (WCP)
export async function getWeeklyCollaboratingProjectsCount(): Promise<number> {
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
        const q = query(
            collection(db, 'projects'),
            where('lastCollaboratedAt', '>=', sevenDaysAgo)
        )
        const snap = await getDocs(q)
        const active = snap.docs.filter(d => {
            const data = d.data()
            const count = data.currentMembers || (data.members?.length || 1)
            return count >= 2
        })
        return active.length
    } catch (e) {
        console.error('Error fetching WCP:', e)
        return 0
    }
}

// Activation Metric: First Value Exchange (FVE) Rate
export async function getFirstValueExchangeRate(): Promise<number> {
    try {
        const usersSnap = await getDocs(collection(db, 'users'))
        const members = usersSnap.docs.map(d => d.data()).filter(u => u.role !== 'admin')
        if (members.length === 0) return 0
        const activated = members.filter(u => u.activated === true).length
        return Math.round((activated / members.length) * 100)
    } catch {
        return 0
    }
}

// Retention Metric: Weekly Value Retention (WVR) D1/D7/D30
export async function getWeeklyValueRetention(): Promise<WeeklyValueRetentionStats> {
    const now = Date.now()
    const DAY = 86400000
    try {
        const usersSnap = await getDocs(collection(db, 'users'))
        const users = usersSnap.docs.map(d => d.data()).filter(u => u.role !== 'admin')
        
        let totalUsers = users.length
        let day1 = 0, day7 = 0, day30 = 0

        for (const u of users) {
            const createdAt = u.createdAt?.toDate?.()?.getTime() ?? 0
            const lastCollab = u.lastCollaboratedAt?.toDate?.()?.getTime() ?? 0

            if (!createdAt || !lastCollab) continue

            const ageDays = (now - createdAt) / DAY
            if (ageDays >= 1 && lastCollab > createdAt + DAY * 0.5) day1++
            if (ageDays >= 7 && lastCollab > createdAt + DAY * 1.0) day7++
            if (ageDays >= 30 && lastCollab > createdAt + DAY * 2.0) day30++
        }

        return {
            totalUsers,
            day1: totalUsers > 0 ? Math.round((day1 / totalUsers) * 100) : 0,
            day7: totalUsers > 0 ? Math.round((day7 / totalUsers) * 100) : 0,
            day30: totalUsers > 0 ? Math.round((day30 / totalUsers) * 100) : 0
        }
    } catch {
        return { totalUsers: 0, day1: 0, day7: 0, day30: 0 }
    }
}

// Marketplace Health Redesign
export async function getMarketplaceHealthStats(): Promise<MarketplaceHealthStats> {
    try {
        const [usersSnap, projectsSnap, eventsSnap] = await Promise.all([
            getDocs(collection(db, 'users')),
            getDocs(collection(db, 'projects')),
            getDocs(collection(db, 'analyticsEvents')),
        ])
        
        const users = usersSnap.docs.map(d => d.data())
        const projects = projectsSnap.docs.map(d => d.data())
        
        const activeContributors: Record<string, number> = {}
        users.forEach(u => {
            if (u.role !== 'admin') {
                const disc = u.discipline || 'Other'
                activeContributors[disc] = (activeContributors[disc] || 0) + 1
            }
        })

        const founderUids = new Set(projects.map(p => p.createdBy).filter(Boolean))
        const activeFounders = founderUids.size

        const events = eventsSnap.docs.map(d => d.data())
        const applicationsCount = events.filter(e => e.event === 'project_applied').length

        const resolutions = events.filter(e => e.event === 'application_resolved')
        const resolvedAppsCount = resolutions.length
        const acceptedAppsCount = resolutions.filter(r => r.action === 'accepted').length
        const acceptanceRate = resolvedAppsCount > 0 ? Math.round((acceptedAppsCount / resolvedAppsCount) * 100) : 0

        const inviteTokensSnap = await getDocs(collection(db, 'inviteTokens'))
        const inviteTokens = inviteTokensSnap.docs.map(d => d.data())
        const totalInvites = inviteTokens.length
        const acceptedInvites = inviteTokens.filter(t => t.status === 'accepted').length
        const inviteConversion = totalInvites > 0 ? Math.round((acceptedInvites / totalInvites) * 100) : 0

        return {
            activeContributors,
            activeFounders,
            applicationsCount,
            acceptanceRate,
            inviteConversion
        }
    } catch {
        return {
            activeContributors: {},
            activeFounders: 0,
            applicationsCount: 0,
            acceptanceRate: 0,
            inviteConversion: 0
        }
    }
}

// Project Success (PCR & Median TFD)
export async function getProjectSuccessMetrics(): Promise<ProjectSuccessMetrics> {
    try {
        const projectsSnap = await getDocs(collection(db, 'projects'))
        const projects = projectsSnap.docs.map(d => d.data())

        const total = projects.length
        if (total === 0) return { pcr: 0, medianTfdHours: 0 }

        const completed = projects.filter(p => p.status === 'completed').length
        const pcr = Math.round((completed / total) * 100)

        const tfdDurations: number[] = []
        projects.forEach(p => {
            const createdAt = p.createdAt?.toDate?.()?.getTime() ?? 0
            const functionalDuoAt = p.functionalDuoAt?.toDate?.()?.getTime() ?? 0
            if (createdAt && functionalDuoAt && functionalDuoAt > createdAt) {
                tfdDurations.push((functionalDuoAt - createdAt) / 3600000)
            }
        })

        tfdDurations.sort((a, b) => a - b)
        let medianTfdHours = 0
        if (tfdDurations.length > 0) {
            const mid = Math.floor(tfdDurations.length / 2)
            medianTfdHours = tfdDurations.length % 2 !== 0 
                ? tfdDurations[mid]
                : (tfdDurations[mid - 1] + tfdDurations[mid]) / 2
        }

        return {
            pcr,
            medianTfdHours: Math.round(medianTfdHours * 10) / 10
        }
    } catch {
        return { pcr: 0, medianTfdHours: 0 }
    }
}

export interface FeatureUsageStat {
    feature: string;
    count: number;
}

// Placeholder to support legacy metrics component load
export async function getFeatureUsageStats(): Promise<FeatureUsageStat[]> {
    return []
}

export async function getRetentionStats() {
    return { totalUsers: 0, day1: 0, day7: 0, day30: 0, powerUsers: 0, returningUsers: 0, dormantUsers: 0 }
}

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Loader2, MapPin, Link as LinkIcon, Github, Linkedin, Twitter,
    Mail, Calendar, UserPlus, Check, BookOpen, Trash2,
    LayoutDashboard, FileText, Users, ImageIcon, X, Award, Star,
} from 'lucide-react'
import {
    doc, getDoc, collection, query, where,
    getDocs, deleteDoc, onSnapshot, updateDoc,
    addDoc, serverTimestamp, orderBy,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { cachedGetDoc, cachedQuery } from '@/lib/queryUtils'
import { useToast } from '@/hooks/use-toast'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
    sendConnectionRequest,
    acceptConnectionRequest,
    rejectConnectionRequest,
    withdrawConnectionRequest,
    getConnectionStatus,
} from '@/services/connectionService'
import { BANNER_PRESETS, DEFAULT_BANNER, type BannerPreset } from '@/components/BannerPresets'
import { InviteToProjectDropdown, InviteButton } from '@/components/InviteToProjectDropdown'
import { sendNotificationWithPush } from '@/services/notificationTrigger'

// ── Types ─────────────────────────────────────────────────────────────────────
interface UserProfile {
    id: string
    firstName: string
    lastName: string
    email: string
    photoURL?: string
    bio?: string
    role?: string
    discipline?: string
    skills?: string[]
    location?: string
    website?: string
    github?: string
    linkedin?: string
    twitter?: string
    joinedAt?: any
    bannerStyle?: string
    portfolioURL?: string
    isOpenToWork?: boolean
    availabilityHours?: number
    timezone?: string
    preferredRoles?: string[]
    pastProjectsShowcase?: {
        title: string
        description: string
        outcome: string
        screenshotURL?: string
    }[]
    reputation?: {
        collaborationScore: number
        reliabilityScore: number
        communicationScore: number
        completionScore: number
        totalReviews: number
    }
}
interface Project {
    id: string
    title: string
    description: string
    status: string
    primaryDiscipline: string
    tags: string[]
}
interface Application {
    id: string
    projectId: string
    projectTitle: string
    status: string
    appliedAt: any
}
interface NetworkFriend {
    uid: string
    displayName: string
    photoURL?: string
}

export default function Profile() {
    const { id } = useParams()
    const { user: currentUser, logout } = useAuth()
    const navigate = useNavigate()
    const { toast } = useToast()

    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [projects, setProjects] = useState<Project[]>([])
    const [applications, setApplications] = useState<Application[]>([])
    const [reviews, setReviews] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [connectionStatus, setConnectionStatus] = useState<
        'none' | 'pending_out' | 'pending_in' | 'connected'
    >('none')
    const [actionLoading, setActionLoading] = useState(false)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [networkFriends, setNetworkFriends] = useState<NetworkFriend[]>([])
    const [showAllNetwork, setShowAllNetwork] = useState(false)
    const [showBannerPicker, setShowBannerPicker] = useState(false)
    const [savingBanner, setSavingBanner] = useState(false)

    // Invite-to-project state
    const [myProjects, setMyProjects] = useState<{ id: string; title: string }[]>([])
    const [inviteDropdownOpen, setInviteDropdownOpen] = useState(false)
    const [sentInvites, setSentInvites] = useState<Set<string>>(new Set())

    const NETWORK_LIMIT = 15

    const currentBanner = BANNER_PRESETS.find(p => p.id === profile?.bannerStyle) || DEFAULT_BANNER

    const handleBannerSelect = async (preset: BannerPreset) => {
        if (!currentUser || !isOwnProfile) return
        setSavingBanner(true)
        try {
            await updateDoc(doc(db, 'users', currentUser.uid), { bannerStyle: preset.id })
            setProfile(prev => prev ? { ...prev, bannerStyle: preset.id } : prev)
            setShowBannerPicker(false)
            toast({ title: 'Banner updated!' })
        } catch {
            toast({ title: 'Could not save banner', variant: 'destructive' })
        } finally {
            setSavingBanner(false)
        }
    }

        const isOwnProfile = !id || (currentUser && id === currentUser.uid)
    const profileId = id || currentUser?.uid

    // Profile Strength Calculation
    const getProfileStrength = useCallback(() => {
        if (!profile) return { score: 0, suggestions: [] }
        
        let score = 0
        const suggestions = []
        
        // 1. Photo (15%)
        if (profile.photoURL) {
            score += 15
        } else {
            suggestions.push({
                label: 'Add a profile photo',
                help: 'Build trust with potential teammates (adds 15%).'
            })
        }
        
        // 2. Bio (15%)
        if (profile.bio && profile.bio.trim().length > 0) {
            score += 15
        } else {
            suggestions.push({
                label: 'Write an About section',
                help: 'Introduce yourself, your background, and interests (adds 15%).'
            })
        }
        
        // 3. Skills (20%)
        if (profile.skills && profile.skills.length > 0) {
            score += 20
        } else {
            suggestions.push({
                label: 'List your skills',
                help: 'Add at least 3 skills to make your profile searchable (adds 20%).'
            })
        }
        
        // 4. Social / Portfolio (20%)
        const hasSocial = !!(profile.github || profile.linkedin || profile.twitter || profile.website || profile.portfolioURL)
        if (hasSocial) {
            score += 20
        } else {
            suggestions.push({
                label: 'Add social or portfolio links',
                help: 'Connect your GitHub, LinkedIn, or Portfolio URL (adds 20%).'
            })
        }
        
        // 5. Work preferences (15%)
        const hasPreferences = !!(profile.isOpenToWork || profile.availabilityHours || profile.timezone || (profile.preferredRoles && profile.preferredRoles.length > 0))
        if (hasPreferences) {
            score += 15
        } else {
            suggestions.push({
                label: 'Set collaboration preferences',
                help: 'Add your availability, timezone, and preferred roles (adds 15%).'
            })
        }
        
        // 6. Portfolio Showcase (15%)
        if (profile.pastProjectsShowcase && profile.pastProjectsShowcase.length > 0) {
            score += 15
        } else {
            suggestions.push({
                label: 'Add a showcase project',
                help: 'Feature an outcome-based project you worked on (adds 15%).'
            })
        }
        
        return { score, suggestions }
    }, [profile])

    const { score: profileStrengthScore, suggestions: profileStrengthSuggestions } = getProfileStrength()

    // Compute reputation dynamically based on Firestore reviews subcollection
    const computedReputation = (() => {
        if (!reviews || reviews.length === 0) {
            if (profile?.reputation) {
                const rep = profile.reputation
                const coop = typeof rep.collaborationScore === 'number' ? rep.collaborationScore : 100
                const rel = typeof rep.reliabilityScore === 'number' ? rep.reliabilityScore : 100
                const comm = typeof rep.communicationScore === 'number' ? rep.communicationScore : 100
                const comp = typeof rep.completionScore === 'number' ? rep.completionScore : 100
                const total = typeof rep.totalReviews === 'number' ? rep.totalReviews : 1
                return {
                    totalReviews: total,
                    collaborationScore: coop,
                    reliabilityScore: rel,
                    communicationScore: comm,
                    completionScore: comp,
                    overallRating: ((coop + rel + comm + comp) / 4) / 20
                }
            }
            return null
        }
        
        const total = reviews.length
        let coopSum = 0
        let relSum = 0
        let commSum = 0
        let skillSum = 0

        reviews.forEach(r => {
            coopSum += typeof r.cooperation === 'number' ? r.cooperation : 5
            relSum += typeof r.reliability === 'number' ? r.reliability : 5
            commSum += typeof r.communication === 'number' ? r.communication : 5
            skillSum += typeof r.skill === 'number' ? r.skill : 5
        })

        const collaborationScore = Math.round((coopSum / total) * 20)
        const reliabilityScore = Math.round((relSum / total) * 20)
        const communicationScore = Math.round((commSum / total) * 20)
        const completionScore = Math.round((skillSum / total) * 20)
        const overallRating = ((coopSum + relSum + commSum + skillSum) / (total * 4))

        return {
            totalReviews: total,
            collaborationScore,
            reliabilityScore,
            communicationScore,
            completionScore,
            overallRating,
        }
    })()

    // ── Re-derive connection status from Firestore ────────────────────────────
    const refreshConnectionStatus = useCallback(async () => {
        if (!currentUser || !profileId || isOwnProfile) return
        const status = await getConnectionStatus(currentUser.uid, profileId)
        setConnectionStatus(status)
    }, [currentUser, profileId, isOwnProfile])

    // ── Load profile + real-time friends listener ─────────────────────────────
    useEffect(() => {
        if (currentUser) {
            loadMyProjects()
        }
    }, [currentUser])

    const loadMyProjects = async () => {
        if (!currentUser) return
        try {
            // ── FIX: Use cachedQuery (shared key with dashboardService) ──
            const snap = await cachedQuery(
                query(collection(db, 'projects'), where('createdBy', '==', currentUser.uid)),
                { ttl: 300_000, cacheKey: `my-projects-${currentUser.uid}` }
            )
            const projects = snap.docs.map(d => ({ id: d.id, title: d.data().title || 'Untitled' }))
            setMyProjects(projects)
        } catch (err) {
            console.error('Failed to load own projects for invite:', err)
        }
    }

    const handleInvite = async (projectId: string, projectTitle: string, message?: string) => {
        if (!currentUser || !profile) return
        const key = `${profile.id}_${projectId}`
        if (sentInvites.has(key)) return

        try {
            await addDoc(collection(db, 'projects', projectId, 'invitations'), {
                email: '',
                userId: profile.id,
                invitedBy: currentUser.uid,
                projectId,
                projectTitle,
                status: 'pending',
                message: message || '',
                createdAt: serverTimestamp(),
            })

            const body = message 
                ? `You've been invited to join "${projectTitle}". Message: "${message}"`
                : `You've been invited to join "${projectTitle}".`

            await sendNotificationWithPush(profile.id, {
                title: '📬 Project Invitation',
                body,
                type: 'info',
                url: `/project/${projectId}`,
                projectId,
            })

            setSentInvites(prev => new Set([...prev, key]))
            setInviteDropdownOpen(false)
            toast({ title: 'Invitation sent!', description: `Invited to "${projectTitle}"` })
        } catch (err) {
            console.error('Error sending project invite:', err)
            toast({ title: 'Failed to send invitation', variant: 'destructive' })
        }
    }

    // ── Load profile + real-time friends listener ─────────────────────────────
    useEffect(() => {
        if (!profileId) return

        let unsubFriends: (() => void) | null = null

        async function loadProfile() {
            try {
                setLoading(true)

                // ── FIX: Try sessionStorage for own profile (instant revisit) ──
                const ssKey = `profile_${profileId}`
                const SS_TTL = 3 * 60_000 // 3 min
                if (isOwnProfile) {
                    try {
                        const raw = sessionStorage.getItem(ssKey)
                        if (raw) {
                            const { profileData, projectsData, applicationsData, ts } = JSON.parse(raw)
                            if (Date.now() - ts < SS_TTL) {
                                setProfile(profileData)
                                setProjects(projectsData)
                                setApplications(applicationsData)
                                setLoading(false)
                                // Still refresh connection status in bg
                                if (!isOwnProfile && currentUser) refreshConnectionStatus()
                                // Set up real-time friends listener only
                                unsubFriends = onSnapshot(
                                    collection(db, 'users', profileId!, 'friends'),
                                    snap => {
                                        const list = snap.docs.map(fd => {
                                            const uid = fd.id
                                            const fdata = fd.data() as any
                                            return {
                                                uid,
                                                displayName: (typeof fdata.name === 'string' && fdata.name.trim()) ||
                                                    (typeof fdata.displayName === 'string' && fdata.displayName.trim()) || 'Member',
                                                photoURL: fdata.photoURL ?? undefined,
                                            } as NetworkFriend
                                        })
                                        setNetworkFriends(list)
                                    }
                                )
                                return
                            }
                        }
                    } catch { /* ignore */ }
                }

                // ── FIX: Parallel fetch instead of 4 sequential awaits ──
                const basePromises: Promise<any>[] = [
                    // 1. User document (cached)
                    cachedGetDoc(doc(db, 'users', profileId!), { ttl: 300_000 }),
                    // 2. Projects created by this user (cached)
                    cachedQuery(
                        query(collection(db, 'projects'), where('createdBy', '==', profileId)),
                        { ttl: 300_000, cacheKey: `profile-projects-${profileId}` }
                    ),
                    // 3. Reviews (cached)
                    cachedQuery(
                        query(collection(db, 'users', profileId!, 'reviews'), orderBy('createdAt', 'desc')),
                        { ttl: 300_000, cacheKey: `profile-reviews-${profileId}` }
                    )
                ]

                // 4. Applications — own profile only (cached)
                if (isOwnProfile) {
                    basePromises.push(
                        cachedQuery(
                            collection(db, 'users', profileId!, 'applications') as any,
                            { ttl: 120_000, cacheKey: `profile-apps-${profileId}` }
                        )
                    )
                }

                const [userDoc, projectsSnap, reviewsSnap, appsSnap] = await Promise.all(basePromises)

                let profileData: UserProfile | null = null
                if (userDoc.exists()) {
                    profileData = { id: userDoc.id, ...userDoc.data() } as UserProfile
                    setProfile(profileData)
                }

                const projectsData = projectsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })) as Project[]
                setProjects(projectsData)

                const reviewsData = reviewsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }))
                setReviews(reviewsData)

                let applicationsData: Application[] = []
                if (isOwnProfile && appsSnap) {
                    applicationsData = appsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })) as Application[]
                    setApplications(applicationsData)
                }

                // Persist own profile to sessionStorage
                if (isOwnProfile && profileData) {
                    try {
                        sessionStorage.setItem(ssKey, JSON.stringify({
                            profileData,
                            projectsData,
                            applicationsData,
                            ts: Date.now()
                        }))
                    } catch { /* quota */ }
                }

                // Real-time friends listener (optimised — uses denormalised data, 0 extra reads)
                unsubFriends = onSnapshot(
                    collection(db, 'users', profileId!, 'friends'),
                    async snap => {
                        const list = snap.docs.map(fd => {
                            const uid = fd.id
                            const fdata = fd.data() as any
                            const displayName =
                                (typeof fdata.name === 'string' && fdata.name.trim()) ||
                                (typeof fdata.displayName === 'string' && fdata.displayName.trim()) ||
                                'Member'
                            return { uid, displayName, photoURL: fdata.photoURL ?? undefined } as NetworkFriend
                        })
                        setNetworkFriends(list)

                        if (!isOwnProfile && currentUser) {
                            await refreshConnectionStatus()
                        }
                    }
                )

                // Initial connection status
                if (!isOwnProfile && currentUser) {
                    await refreshConnectionStatus()
                }
            } catch (error) {
                console.error('Error loading profile:', error)
            } finally {
                setLoading(false)
            }
        }

        loadProfile()
        return () => { unsubFriends?.() }
    }, [profileId, currentUser, isOwnProfile, refreshConnectionStatus])

    // ✅ Real-time listeners on both connectionRequest docs so
    // the button flips instantly when a request is sent or deleted
    useEffect(() => {
        if (!currentUser || !profileId || isOwnProfile) return

        // Their request TO me (pending_in)
        const unsubIncoming = onSnapshot(
            doc(db, 'users', currentUser.uid, 'connectionRequests', profileId),
            () => { refreshConnectionStatus() }
        )

        // My request TO them (pending_out)
        const unsubOutgoing = onSnapshot(
            doc(db, 'users', profileId, 'connectionRequests', currentUser.uid),
            () => { refreshConnectionStatus() }
        )

        return () => {
            unsubIncoming()
            unsubOutgoing()
        }
    }, [currentUser, profileId, isOwnProfile, refreshConnectionStatus])

    // ── Action handlers ───────────────────────────────────────────────────────
    const handleConnect = async () => {
        if (!currentUser || !profile || isOwnProfile) return
        try {
            setActionLoading(true)
            await sendConnectionRequest(currentUser.uid, profile.id)
            await refreshConnectionStatus()
            toast({ title: 'Request sent!' })
        } catch (error) {
            console.error('Error sending connection request:', error)
            toast({ title: 'Could not send request', variant: 'destructive' })
        } finally {
            setActionLoading(false)
        }
    }

    const handleWithdraw = async () => {
        if (!currentUser || !profile) return
        try {
            setActionLoading(true)
            await withdrawConnectionRequest(currentUser.uid, profile.id)
            await refreshConnectionStatus()
            toast({ title: 'Request withdrawn' })
        } catch (error) {
            console.error(error)
            toast({ title: 'Could not withdraw', variant: 'destructive' })
        } finally {
            setActionLoading(false)
        }
    }

    const handleAcceptIncomingOnProfile = useCallback(async () => {
        if (!currentUser || !profile) return
        try {
            setActionLoading(true)
            await acceptConnectionRequest(currentUser.uid, profile.id)
            await refreshConnectionStatus()
            toast({ title: 'Connected!', description: 'You are now collaborators.' })
        } catch (e) {
            console.error(e)
            toast({ title: 'Could not accept', variant: 'destructive' })
        } finally {
            setActionLoading(false)
        }
    }, [currentUser, profile, refreshConnectionStatus, toast])

    // ✅ Auto-accept connection request if query param is set
    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search)
        const actionParam = searchParams.get('action')
        if (actionParam === 'accept' && connectionStatus === 'pending_in' && !actionLoading && profile) {
            handleAcceptIncomingOnProfile()
            // Clean up the URL parameter
            navigate(window.location.pathname, { replace: true })
        }
    }, [connectionStatus, actionLoading, profile, handleAcceptIncomingOnProfile, navigate])

    const handleRejectIncomingOnProfile = async () => {
        if (!currentUser || !profile) return
        try {
            setActionLoading(true)
            await rejectConnectionRequest(currentUser.uid, profile.id)
            await refreshConnectionStatus()
            toast({ title: 'Request declined' })
        } catch (e) {
            console.error(e)
            toast({ title: 'Could not decline', variant: 'destructive' })
        } finally {
            setActionLoading(false)
        }
    }

    const handleDeleteAccount = async () => {
        if (!currentUser || !isOwnProfile) return
        if (
            confirm(
                'Are you sure you want to delete your account? This action cannot be undone.'
            )
        ) {
            try {
                setActionLoading(true)
                await deleteDoc(doc(db, 'users', currentUser.uid))
                await currentUser.delete()
                navigate('/')
            } catch (error) {
                console.error('Error deleting account:', error)
                toast({
                    title: 'Delete Failed',
                    description: 'Failed to delete account. You may need to re-login first.',
                    variant: 'destructive',
                })
            } finally {
                setActionLoading(false)
            }
        }
    }

    // ── Connection button ─────────────────────────────────────────────────────
    const renderConnectionButton = () => {
        if (isOwnProfile) return null

        if (connectionStatus === 'connected') {
            return (
                <Button
                    variant="outline"
                    className="text-green-600 border-green-200 bg-green-50"
                    disabled
                >
                    <Check className="h-4 w-4 mr-2" />
                    Connected
                </Button>
            )
        }

        if (connectionStatus === 'pending_out') {
            return (
                <Button
                    variant="outline"
                    onClick={handleWithdraw}
                    disabled={actionLoading}
                >
                    {actionLoading
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : 'Withdraw Request'
                    }
                </Button>
            )
        }

        if (connectionStatus === 'pending_in') {
            return (
                <div className="flex gap-2">
                    <Button
                        className="bg-green-600 hover:bg-green-700"
                        onClick={handleAcceptIncomingOnProfile}
                        disabled={actionLoading}
                    >
                        {actionLoading
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <><Check className="h-4 w-4 mr-2" />Accept</>
                        }
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleRejectIncomingOnProfile}
                        disabled={actionLoading}
                    >
                        Decline
                    </Button>
                </div>
            )
        }

        // 'none'
        return (
            <Button onClick={handleConnect} disabled={actionLoading}>
                {actionLoading
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <><UserPlus className="h-4 w-4 mr-2" />Connect</>
                }
            </Button>
        )
    }

    // ── Loading / not found ───────────────────────────────────────────────────
    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
            </DashboardLayout>
        )
    }

    if (!profile) {
        return (
            <DashboardLayout>
                <div className="text-center py-12">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        User not found
                    </h2>
                    <Button onClick={() => navigate('/discover')} className="mt-4">
                        Go to Discover
                    </Button>
                </div>
            </DashboardLayout>
        )
    }

    // ── Main render ───────────────────────────────────────────────────────────
    return (
        <DashboardLayout>
            <div className="max-w-5xl mx-auto">

                {/* Profile Header */}
                <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-visible mb-6">
                    {/* Banner */}
                    <div
                        className="relative h-36 sm:h-44 overflow-hidden cursor-pointer group rounded-t-xl"
                        onClick={() => isOwnProfile && setShowBannerPicker(true)}
                    >
                        {/* Render the chosen SVG banner */}
                        {currentBanner.render()}

                        {/* Change banner hint — own profile only */}
                        {isOwnProfile && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 z-10">
                                <div className="flex items-center gap-2 bg-black/50 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
                                    <ImageIcon className="h-3.5 w-3.5" />
                                    Change banner
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Banner picker overlay */}
                    {showBannerPicker && (
                        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-4 w-full max-w-2xl">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-semibold text-sm">Choose a banner</h3>
                                    <button
                                        onClick={() => setShowBannerPicker(false)}
                                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-[60vh] overflow-y-auto pr-1">
                                    {BANNER_PRESETS.map(preset => (
                                        <button
                                            key={preset.id}
                                            onClick={() => handleBannerSelect(preset)}
                                            disabled={savingBanner}
                                            className={`relative h-16 sm:h-20 rounded-lg overflow-hidden ring-2 transition-all hover:scale-105 ${
                                                currentBanner.id === preset.id
                                                    ? 'ring-blue-500 scale-105'
                                                    : 'ring-transparent hover:ring-gray-300 dark:hover:ring-gray-600'
                                            }`}
                                        >
                                            {preset.render()}
                                            {currentBanner.id === preset.id && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                                    <Check className="h-5 w-5 text-white drop-shadow" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="px-4 sm:px-6 pb-5">
                        {/* Avatar + actions row */}
                        <div className="flex flex-wrap justify-between items-start gap-3 -mt-10 sm:-mt-12 mb-3">
                            {/* Avatar with ring */}
                            <div className="relative shrink-0">
                                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full ring-4 ring-white dark:ring-gray-900 overflow-hidden bg-white dark:bg-gray-900 shadow-md">
                                    <img
                                        src={
                                            profile.photoURL ||
                                            `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(profile.email)}`
                                        }
                                        alt={`${profile.firstName} ${profile.lastName}`}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            </div>

                            {/* Action buttons — pushed to top-right */}
                            <div className="flex flex-wrap gap-2 mt-12 sm:mt-14">
                                {isOwnProfile ? (
                                    <>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 text-xs"
                                            onClick={() => navigate('/dashboard')}
                                        >
                                            <LayoutDashboard className="h-3.5 w-3.5 mr-1.5" />
                                            Dashboard
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="h-8 text-xs"
                                            onClick={() => navigate('/settings/profile')}
                                        >
                                            Edit Profile
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => setIsDeleteModalOpen(true)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        {renderConnectionButton()}
                                        <div className="relative">
                                            <InviteButton
                                                isOpen={inviteDropdownOpen}
                                                onClick={() => setInviteDropdownOpen(!inviteDropdownOpen)}
                                            />
                                            {inviteDropdownOpen && (
                                                <InviteToProjectDropdown
                                                    targetUserId={profile.id}
                                                    projects={myProjects}
                                                    sentInvites={sentInvites}
                                                    onInvite={handleInvite}
                                                    onClose={() => setInviteDropdownOpen(false)}
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Name + role */}
                        <div className="mb-3">
                            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white leading-tight">
                                {profile.firstName} {profile.lastName}
                            </h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                {profile.role || 'Member'}
                                {profile.discipline && (
                                    <span className="text-gray-400 dark:text-gray-500"> · {profile.discipline}</span>
                                )}
                            </p>
                        </div>

                        {/* Stats row */}
                        <div className="flex items-center gap-4 sm:gap-6 mb-3 pb-3 border-b border-gray-100 dark:border-gray-800">
                            <div className="text-center">
                                <p className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">{projects.length}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Projects</p>
                            </div>
                            <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />
                            <div className="text-center">
                                <p className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">{networkFriends.length}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Connections</p>
                            </div>
                            {isOwnProfile && applications.length > 0 && (
                                <>
                                    <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />
                                    <div className="text-center">
                                        <p className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">{applications.length}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Applications</p>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Meta + social row */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500 dark:text-gray-400">
                            {profile.location && (
                                <span className="flex items-center gap-1">
                                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                                    {profile.location}
                                </span>
                            )}
                            {profile.email && (
                                <span className="flex items-center gap-1 min-w-0">
                                    <Mail className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate max-w-[180px]">{profile.email}</span>
                                </span>
                            )}
                            {profile.joinedAt && (
                                <span className="flex items-center gap-1">
                                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                                    Joined {new Date(profile.joinedAt.toDate()).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                                </span>
                            )}

                            {/* Social links as small pill buttons */}
                            {(profile.github || profile.linkedin || profile.twitter || profile.website || profile.portfolioURL) && (
                                <div className="flex items-center gap-1.5 ml-auto">
                                    {profile.portfolioURL && (
                                        <a href={profile.portfolioURL} target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-indigo-600 dark:text-indigo-400 font-semibold">
                                            <LinkIcon className="h-3.5 w-3.5" />
                                            <span className="hidden sm:inline text-[10px] font-semibold">Portfolio</span>
                                        </a>
                                    )}
                                    {profile.github && (
                                        <a href={profile.github} target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-300">
                                            <Github className="h-3.5 w-3.5" />
                                            <span className="hidden sm:inline text-[10px] font-medium">GitHub</span>
                                        </a>
                                    )}
                                    {profile.linkedin && (
                                        <a href={profile.linkedin} target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 transition-colors text-gray-600 dark:text-gray-300">
                                            <Linkedin className="h-3.5 w-3.5" />
                                            <span className="hidden sm:inline text-[10px] font-medium">LinkedIn</span>
                                        </a>
                                    )}
                                    {profile.twitter && (
                                        <a href={profile.twitter} target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-sky-100 dark:hover:bg-sky-900/30 hover:text-sky-500 transition-colors text-gray-600 dark:text-gray-300">
                                            <Twitter className="h-3.5 w-3.5" />
                                            <span className="hidden sm:inline text-[10px] font-medium">Twitter</span>
                                        </a>
                                    )}
                                    {profile.website && (
                                        <a href={profile.website} target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-300">
                                            <LinkIcon className="h-3.5 w-3.5" />
                                            <span className="hidden sm:inline text-[10px] font-medium">Website</span>
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {isOwnProfile && false && null /* connection hint removed */}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Left Column */}
                    <div className="space-y-6">

                        {/* Profile Strength Card (Own Profile only) */}
                        {isOwnProfile && (
                            <Card className="relative overflow-hidden border border-indigo-100 dark:border-indigo-900/30">
                                <CardContent className="pt-6">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                                            <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                                            Profile Strength
                                        </h3>
                                        <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                                            {profileStrengthScore}%
                                        </span>
                                    </div>
                                    
                                    {/* Progress Bar */}
                                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden mb-4">
                                        <div 
                                            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-500" 
                                            style={{ width: `${profileStrengthScore}%` }}
                                        />
                                    </div>

                                    {/* Suggestions list */}
                                    {profileStrengthSuggestions.length > 0 ? (
                                        <div className="space-y-2.5">
                                            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Suggested actions</p>
                                            {profileStrengthSuggestions.map((suggestion, index) => (
                                                <div key={index} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300">
                                                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold mt-0.5">
                                                        +
                                                    </span>
                                                    <div className="flex-1">
                                                        <span className="font-medium text-gray-700 dark:text-gray-200">{suggestion.label}</span>
                                                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{suggestion.help}</p>
                                                    </div>
                                                </div>
                                            ))}
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="w-full text-xs mt-2 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 dark:border-indigo-900/30 dark:hover:bg-indigo-950/30 dark:hover:text-indigo-400 transition-colors"
                                                onClick={() => navigate('/settings/profile')}
                                            >
                                                Update Profile
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="text-center py-2">
                                            <p className="text-xs text-green-600 dark:text-green-400 font-medium">Your profile is complete and optimized.</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Collaboration Preferences Card */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-bold flex items-center justify-between">
                                    <span>Collaboration Preferences</span>
                                    {profile.isOpenToWork ? (
                                        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 font-semibold text-[10px] py-0.5">
                                            ● Open to Work
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-gray-400 dark:text-gray-500 text-[10px] py-0.5">
                                            Not Active
                                        </Badge>
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                                        <span className="text-gray-400 dark:text-gray-500 block mb-0.5 text-[10px]">Availability</span>
                                        <span className="font-semibold text-gray-800 dark:text-gray-200 text-xs">
                                            {profile.availabilityHours ? `${profile.availabilityHours} hrs/week` : 'Not specified'}
                                        </span>
                                    </div>
                                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                                        <span className="text-gray-400 dark:text-gray-500 block mb-0.5 text-[10px]">Timezone</span>
                                        <span className="font-semibold text-gray-800 dark:text-gray-200 text-xs truncate block">
                                            {profile.timezone || 'Not specified'}
                                        </span>
                                    </div>
                                </div>

                                {profile.preferredRoles && profile.preferredRoles.length > 0 && (
                                    <div>
                                        <span className="text-[10px] text-gray-400 dark:text-gray-500 block mb-2 font-semibold uppercase tracking-wider">Preferred Roles</span>
                                        <div className="flex flex-wrap gap-1.5">
                                            {profile.preferredRoles.map((role, i) => (
                                                <Badge key={i} variant="outline" className="bg-blue-50/50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-200/50 dark:border-blue-900/30 text-[10px]">
                                                    {role}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* About */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">About</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                                    {profile.bio || 'No bio available.'}
                                </p>
                            </CardContent>
                        </Card>

                        {/* Network */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    Network
                                    {networkFriends.length > 0 && (
                                        <span className="text-sm font-normal text-muted-foreground ml-1">
                                            ({networkFriends.length})
                                        </span>
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {networkFriends.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        {isOwnProfile
                                            ? 'Accepted collaborators appear here. Send requests from Discover or profiles.'
                                            : 'No public connections to show.'}
                                    </p>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                                            {(showAllNetwork
                                                ? networkFriends
                                                : networkFriends.slice(0, NETWORK_LIMIT)
                                            ).map(f => (
                                                <button
                                                    key={f.uid}
                                                    type="button"
                                                    onClick={() => navigate(`/profile/${f.uid}`)}
                                                    className="flex flex-col items-center gap-1 group"
                                                >
                                                    <img
                                                        src={
                                                            f.photoURL ||
                                                            `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(f.uid)}`
                                                        }
                                                        alt=""
                                                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-border object-cover group-hover:border-primary transition-colors"
                                                    />
                                                    <span className="text-[10px] sm:text-xs text-center line-clamp-2 w-full group-hover:text-primary leading-tight">
                                                        {f.displayName}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                        {networkFriends.length > NETWORK_LIMIT && (
                                            <button
                                                onClick={() => setShowAllNetwork(v => !v)}
                                                className="mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline w-full text-center"
                                            >
                                                {showAllNetwork
                                                    ? 'Show less'
                                                    : `View all ${networkFriends.length} connections`}
                                            </button>
                                        )}
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {/* Reputation & Reviews */}
                        {computedReputation && computedReputation.totalReviews > 0 && (
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-bold flex items-center justify-between">
                                        <span>Reputation & Feedback</span>
                                        <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 font-semibold text-[10px] py-0.5">
                                            {computedReputation.totalReviews} Peer Review{computedReputation.totalReviews > 1 ? 's' : ''}
                                        </Badge>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {typeof computedReputation.overallRating === 'number' && (
                                        <div className="flex items-center gap-3 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/15 dark:border-amber-500/20 rounded-lg p-3">
                                            <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">
                                                {computedReputation.overallRating.toFixed(1)}
                                            </div>
                                            <div className="space-y-0.5">
                                                <div className="flex gap-0.5">
                                                    {[1, 2, 3, 4, 5].map((star) => {
                                                        const isFilled = star <= Math.round(computedReputation.overallRating)
                                                        return (
                                                            <Star 
                                                                key={star} 
                                                                className={`h-3.5 w-3.5 ${isFilled ? 'fill-amber-400 text-amber-400' : 'text-zinc-300 dark:text-zinc-700'}`} 
                                                            />
                                                        )
                                                    })}
                                                </div>
                                                <p className="text-[10px] text-gray-505 dark:text-gray-400 font-semibold">
                                                    Overall Peer Rating
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                    <div className="space-y-2.5">
                                        {[
                                            { label: 'Cooperation & Teamwork', score: computedReputation.collaborationScore },
                                            { label: 'Reliability & Sprints', score: computedReputation.reliabilityScore },
                                            { label: 'Communication', score: computedReputation.communicationScore },
                                            { label: 'Technical Contribution', score: computedReputation.completionScore },
                                        ].map((rep, idx) => (
                                            <div key={idx} className="space-y-1">
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-gray-500 dark:text-gray-400 font-medium">{rep.label}</span>
                                                    <span className="font-semibold text-gray-800 dark:text-gray-200">{Math.round(rep.score / 20 * 10) / 10} / 5</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-amber-500 rounded-full transition-all duration-300"
                                                        style={{ width: `${rep.score}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Skills */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Skills</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-2">
                                    {profile.skills && profile.skills.length > 0 ? (
                                        profile.skills.map((skill, i) => (
                                            <Badge key={i} variant="secondary">
                                                {skill}
                                            </Badge>
                                        ))
                                    ) : (
                                        <p className="text-gray-500 text-sm italic">
                                            No skills listed
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                    </div>{/* end left column */}

                    {/* Right Column */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Projects */}
                        <div>
                            <h2 className="text-xl font-bold mb-4">Projects</h2>
                            {projects.length > 0 ? (
                                <div className="space-y-4">
                                    {projects.map(project => (
                                        <Card
                                            key={project.id}
                                            className="hover:shadow-md transition-shadow cursor-pointer"
                                            onClick={() => navigate(`/project/${project.id}`)}
                                        >
                                            <CardContent className="p-6">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h3 className="font-semibold text-lg text-blue-600 dark:text-blue-400 mb-1">
                                                            {project.title}
                                                        </h3>
                                                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                                                            {project.primaryDiscipline}
                                                        </p>
                                                    </div>
                                                    <Badge
                                                        variant={
                                                            project.status === 'recruiting'
                                                                ? 'default'
                                                                : 'secondary'
                                                        }
                                                    >
                                                        {project.status}
                                                    </Badge>
                                                </div>
                                                <p className="text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
                                                    {project.description}
                                                </p>
                                                <div className="flex flex-wrap gap-2">
                                                    {project.tags?.slice(0, 3).map((tag, i) => (
                                                        <Badge
                                                            key={i}
                                                            variant="outline"
                                                            className="text-xs"
                                                        >
                                                            {tag}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <Card>
                                    <CardContent className="p-8 text-center text-gray-500">
                                        <BookOpen className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                                        <p>No projects yet</p>
                                    </CardContent>
                                </Card>
                            )}
                        </div>

                        {/* Teammate Endorsements */}
                        {reviews.length > 0 && (
                            <div>
                                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    <Award className="h-5 w-5 text-amber-500" />
                                    Teammate Endorsements
                                </h2>
                                <div className="space-y-4">
                                    {reviews.map((rev) => (
                                        <Card key={rev.id}>
                                            <CardContent className="p-5">
                                                <div className="flex items-start gap-3">
                                                    <Avatar className="h-9 w-9">
                                                        <AvatarImage src={rev.reviewerAvatar} />
                                                        <AvatarFallback className="text-xs">
                                                            {(rev.reviewerName || 'Anonymous').charAt(0).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-baseline justify-between gap-2">
                                                            <h4 className="text-sm font-semibold text-gray-900 dark:text-zinc-150 truncate">
                                                                {rev.reviewerName || 'Anonymous'}
                                                            </h4>
                                                            <span className="text-[10px] text-gray-400 dark:text-zinc-500 shrink-0 italic">
                                                                on {rev.projectName}
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-0.5">
                                                            Cooperated: {rev.cooperation}/5 · Reliable: {rev.reliability}/5 · Comm: {rev.communication}/5
                                                        </p>
                                                        {rev.comment && (
                                                            <blockquote className="mt-3 text-xs text-gray-600 dark:text-gray-300 border-l-2 border-zinc-200 dark:border-zinc-800 pl-3 italic leading-relaxed">
                                                                "{rev.comment}"
                                                            </blockquote>
                                                        )}
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Portfolio Showcase */}
                        <div>
                            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                <ImageIcon className="h-5 w-5 text-indigo-500" />
                                Project Showcase
                            </h2>
                            {profile.pastProjectsShowcase && profile.pastProjectsShowcase.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {profile.pastProjectsShowcase.map((proj, idx) => (
                                        <Card key={idx} className="overflow-hidden border border-gray-200 dark:border-gray-800 hover:shadow-lg transition-all duration-300 flex flex-col">
                                            {proj.screenshotURL && (
                                                <div className="h-40 w-full overflow-hidden bg-gray-100 dark:bg-gray-800 relative">
                                                    <img 
                                                        src={proj.screenshotURL} 
                                                        alt={proj.title}
                                                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                                                        onError={(e) => {
                                                            (e.target as HTMLElement).style.display = 'none';
                                                        }}
                                                    />
                                                </div>
                                            )}
                                            <CardContent className="p-5 flex-1 flex flex-col justify-between">
                                                <div>
                                                    <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-2">{proj.title}</h3>
                                                    <p className="text-xs text-gray-600 dark:text-gray-300 mb-4 line-clamp-3 leading-relaxed">{proj.description}</p>
                                                </div>
                                                {proj.outcome && (
                                                    <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-800/60">
                                                        <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Impact / Outcome</span>
                                                        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 mt-0.5 leading-relaxed">{proj.outcome}</p>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <Card className="border-dashed border-2">
                                    <CardContent className="p-8 text-center text-gray-500">
                                        <ImageIcon className="h-10 w-10 mx-auto mb-3 text-gray-300 dark:text-gray-700" />
                                        <p className="text-sm font-medium mb-1">No showcase projects yet</p>
                                        {isOwnProfile && (
                                            <p className="text-xs text-gray-400 mb-4">Add projects you've worked on outside of ProCollab to build credibility.</p>
                                        )}
                                        {isOwnProfile && (
                                            <Button 
                                                size="sm" 
                                                variant="outline"
                                                onClick={() => navigate('/settings/profile')}
                                            >
                                                Add Project
                                            </Button>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </div>

                        {/* Applications — own profile only */}
                        {isOwnProfile && (
                            <div>
                                <h2 className="text-xl font-bold mb-4">
                                    Project Applications
                                </h2>
                                {applications.length > 0 ? (
                                    <div className="space-y-4">
                                        {applications.map(app => (
                                            <Card key={app.id}>
                                                <CardContent className="p-4 flex justify-between items-center">
                                                    <div className="flex items-center gap-3">
                                                        <FileText className="h-8 w-8 text-blue-500 p-1.5 bg-blue-50 rounded-lg" />
                                                        <div>
                                                            <h3 className="font-medium">
                                                                {app.projectTitle}
                                                            </h3>
                                                            <p className="text-xs text-gray-500">
                                                                Applied on{' '}
                                                                {new Date(
                                                                    app.appliedAt?.toDate()
                                                                ).toLocaleDateString()}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <Badge
                                                        variant={
                                                            (app.status || 'applied') === 'accepted'
                                                                ? 'default'
                                                                : (app.status || 'applied') === 'rejected'
                                                                    ? 'destructive'
                                                                    : 'secondary'
                                                        }
                                                    >
                                                        {app.status.charAt(0).toUpperCase() +
                                                            app.status.slice(1)}
                                                    </Badge>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                ) : (
                                    <Card>
                                        <CardContent className="p-8 text-center text-gray-500">
                                            <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                                            <p>No applications sent yet</p>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Delete Account Modal */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full p-6">
                        <h2 className="text-xl font-bold text-red-600 mb-4">
                            Delete Account
                        </h2>
                        <p className="text-gray-600 dark:text-gray-300 mb-6">
                            Are you sure you want to delete your account? This action is
                            permanent and cannot be undone. All your data will be lost.
                        </p>
                        <div className="flex justify-end gap-3">
                            <Button
                                variant="outline"
                                onClick={() => setIsDeleteModalOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={handleDeleteAccount}
                                disabled={actionLoading}
                            >
                                {actionLoading ? 'Deleting...' : 'Delete Account'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    )
}
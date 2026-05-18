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
    LayoutDashboard, FileText, Users, ImageIcon, X,
} from 'lucide-react'
import {
    doc, getDoc, collection, query, where,
    getDocs, deleteDoc, onSnapshot, updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useToast } from '@/hooks/use-toast'
import {
    sendConnectionRequest,
    acceptConnectionRequest,
    rejectConnectionRequest,
    withdrawConnectionRequest,
    getConnectionStatus,
} from '@/services/connectionService'
import { BANNER_PRESETS, DEFAULT_BANNER, type BannerPreset } from '@/components/BannerPresets'

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

    // ── Re-derive connection status from Firestore ────────────────────────────
    const refreshConnectionStatus = useCallback(async () => {
        if (!currentUser || !profileId || isOwnProfile) return
        const status = await getConnectionStatus(currentUser.uid, profileId)
        setConnectionStatus(status)
    }, [currentUser, profileId, isOwnProfile])

    // ── Load profile + real-time friends listener ─────────────────────────────
    useEffect(() => {
        if (!profileId) return

        let unsubFriends: (() => void) | null = null

        async function loadProfile() {
            try {
                setLoading(true)

                // User document
                const userDoc = await getDoc(doc(db, 'users', profileId!))
                if (userDoc.exists()) {
                    setProfile({ id: userDoc.id, ...userDoc.data() } as UserProfile)
                }

                // Projects created by this user
                const projectsSnapshot = await getDocs(
                    query(
                        collection(db, 'projects'),
                        where('createdBy', '==', profileId)
                    )
                )
                setProjects(
                    projectsSnapshot.docs.map(d => ({
                        id: d.id,
                        ...d.data(),
                    })) as Project[]
                )

                // Applications (own profile only)
                if (isOwnProfile) {
                    const appsSnapshot = await getDocs(
                        collection(db, 'users', profileId!, 'applications')
                    )
                    setApplications(
                        appsSnapshot.docs.map(d => ({
                            id: d.id,
                            ...d.data(),
                        })) as Application[]
                    )
                }

                // ✅ Real-time listener on friends sub-collection
                // Fires whenever anyone is added/removed as a friend,
                // which also triggers a connection status re-check
                unsubFriends = onSnapshot(
                    collection(db, 'users', profileId!, 'friends'),
                    async snap => {
                        const list = await Promise.all(
                            snap.docs.map(async fd => {
                                const uid = fd.id
                                const fdata = fd.data()
                                const us = await getDoc(doc(db, 'users', uid))
                                const u = us.exists() ? (us.data() as any) : {}
                                const displayName =
                                    (typeof fdata.name === 'string' && fdata.name.trim()) ||
                                    `${u.firstName || ''} ${u.lastName || ''}`.trim() ||
                                    u.email ||
                                    'Member'
                                return {
                                    uid,
                                    displayName,
                                    photoURL: u.photoURL,
                                } as NetworkFriend
                            })
                        )
                        setNetworkFriends(list)

                        // Re-check status whenever friends list changes
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

    const handleAcceptIncomingOnProfile = async () => {
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
    }

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
                        <div className="absolute inset-0 z-20 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 rounded-xl">
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
                                ) : renderConnectionButton()}
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
                            {(profile.github || profile.linkedin || profile.twitter || profile.website) && (
                                <div className="flex items-center gap-1.5 ml-auto">
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
                                                            app.status === 'accepted'
                                                                ? 'default'
                                                                : app.status === 'rejected'
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
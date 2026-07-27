import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
    Loader2, MapPin, Link as LinkIcon, Github, Linkedin, Twitter,
    Mail, Calendar, UserPlus, Check, BookOpen, Trash2,
    LayoutDashboard, FileText, Users, ImageIcon, X, Award, Star,
    Zap, CheckCircle, ShieldAlert, Crown, Heart, Code2, Compass, Shield, Sparkles,
    ShieldCheck, Clock, GitBranch, Layers, Briefcase, BarChart3, Share2, Search,
    Lock, Upload, Info, MoreVertical
} from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { updateProjectHighlightStatus } from '@/services/dashboardService'
import {
    doc, getDoc, collection, query, where,
    getDocs, deleteDoc, onSnapshot, updateDoc,
    addDoc, serverTimestamp, orderBy,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import { cachedGetDoc, cachedQuery } from '@/lib/queryUtils'
import { BADGE_IMAGES } from '@/lib/badgeImages'
import { useToast } from '@/hooks/use-toast'
import { getTagColorClass } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
    sendConnectionRequest,
    acceptConnectionRequest,
    rejectConnectionRequest,
    withdrawConnectionRequest,
    getConnectionStatus,
    updateConnectionRequestNote,
    removeConnection,
} from '@/services/connectionService'
import { BANNER_PRESETS, DEFAULT_BANNER, type BannerPreset } from '@/components/BannerPresets'
import { InviteToProjectDropdown, InviteButton } from '@/components/InviteToProjectDropdown'
import { sendNotificationWithPush } from '@/services/notificationTrigger'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { ResumeBuilder } from '@/components/profile/ResumeBuilder'
import { ActivityHeatmap } from '@/components/profile/ActivityHeatmap'
import { StreakCard } from '@/components/profile/StreakCard'
import { StreakLeaderboard } from '@/components/profile/StreakLeaderboard'
import { ShareFlexModal } from '@/components/profile/ShareFlexModal'
import {
    fetchUserActivityData,
    calculateStreakMetrics,
    ActivityDay,
    StreakMetrics,
} from '@/services/activityService'

// ── Types ─────────────────────────────────────────────────────────────────────
interface UserProfile {
    id: string
    firstName: string
    lastName: string
    email: string
    username?: string
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
    highlightedProjectIds?: string[]
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
        trustScore?: number
        overallRating?: number
    }
}
interface Project {
    id: string
    title: string
    description: string
    status: string
    primaryDiscipline: string
    tags: string[]
    activityVerified?: boolean
    metrics?: {
        completedTasks?: number
        totalTasks?: number
        memberIds?: string[]
    }
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

const toDate = (val: any): Date => {
    if (!val) return new Date()
    if (typeof val.toDate === 'function') return val.toDate()
    if (typeof val.seconds === 'number') {
        return new Date(val.seconds * 1000 + Math.floor((val.nanoseconds || 0) / 1000000))
    }
    return new Date(val)
}

const ICON_MAP: Record<string, React.ComponentType<any>> = {
    Award,
    Star,
    Zap,
    Users,
    CheckCircle,
    ShieldAlert,
    Crown,
    Heart,
    Code2,
    Compass,
    Shield,
    ShieldCheck,
    Clock,
    GitBranch,
    Layers,
    Briefcase,
    BarChart3,
    BookOpen,
    FileText
}

const compressImage = (file: File, quality: number = 0.75): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            const img = new Image()
            img.onload = () => {
                const canvas = document.createElement('canvas')
                canvas.width = img.naturalWidth
                canvas.height = img.naturalHeight
                const ctx = canvas.getContext('2d')
                if (!ctx) {
                    reject(new Error('Failed to get 2D canvas context'))
                    return
                }
                ctx.drawImage(img, 0, 0)
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob)
                        } else {
                            reject(new Error('Image compression returned null blob'))
                        }
                    },
                    'image/jpeg',
                    quality
                )
            }
            img.onerror = (err) => reject(err)
            img.src = e.target?.result as string
        }
        reader.onerror = (err) => reject(err)
        reader.readAsDataURL(file)
    })
}

const compressAvatar = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            const img = new Image()
            img.onload = () => {
                const canvas = document.createElement('canvas')
                const size = 400
                canvas.width = size
                canvas.height = size
                const ctx = canvas.getContext('2d')
                if (!ctx) {
                    reject(new Error('Failed to get 2D canvas context'))
                    return
                }

                // Draw image centered and cropped to square
                const minSide = Math.min(img.naturalWidth, img.naturalHeight)
                const sx = (img.naturalWidth - minSide) / 2
                const sy = (img.naturalHeight - minSide) / 2

                ctx.drawImage(
                    img,
                    sx, sy, minSide, minSide,
                    0, 0, size, size
                )

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob)
                        } else {
                            reject(new Error('Avatar compression returned null blob'))
                        }
                    },
                    'image/jpeg',
                    0.85
                )
            }
            img.onerror = (err) => reject(err)
            img.src = e.target?.result as string
        }
        reader.onerror = (err) => reject(err)
        reader.readAsDataURL(file)
    })
}

export default function Profile() {
    const { id, username: usernameParam } = useParams<{ id?: string; username?: string }>()
    const { user: currentUser, logout } = useAuth()
    const navigate = useNavigate()
    const { toast } = useToast()
    // If accessed via /u/:username, we resolve the uid here
    const [resolvedId, setResolvedId] = useState<string | undefined>(id)

    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [projects, setProjects] = useState<Project[]>([])
    const [applications, setApplications] = useState<Application[]>([])
    const [reviews, setReviews] = useState<any[]>([])
    const [badges, setBadges] = useState<any[]>([])
    const [projectFilter, setProjectFilter] = useState<'active' | 'completed'>('active')
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
    const [savingAvatar, setSavingAvatar] = useState(false)
    const [connectionsSearch, setConnectionsSearch] = useState('')

    // Activity & Streak states
    const [activityData, setActivityData] = useState<Record<string, ActivityDay>>({})
    const [streakMetrics, setStreakMetrics] = useState<StreakMetrics | null>(null)
    const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false)
    const [isShareModalOpen, setIsShareModalOpen] = useState(false)


    const handleToggleProjectHighlight = async (e: React.MouseEvent, projectId: string, currentHighlighted: boolean) => {
        e.stopPropagation()
        try {
            const nextStatus = !currentHighlighted

            // 1. Attempt updating project document in Firestore
            try {
                await updateProjectHighlightStatus(projectId, nextStatus)
            } catch (projErr) {
                console.warn('Could not update project doc directly:', projErr)
            }

            // 2. Also save to user document's highlightedProjectIds list (fallback & user-level profile persistence)
            if (currentUser) {
                const userRef = doc(db, 'users', currentUser.uid)
                const currentHighlights: string[] = profile?.highlightedProjectIds || []
                const updatedHighlights = nextStatus
                    ? Array.from(new Set([...currentHighlights, projectId]))
                    : currentHighlights.filter(id => id !== projectId)

                await updateDoc(userRef, { highlightedProjectIds: updatedHighlights })
                setProfile(prev => prev ? { ...prev, highlightedProjectIds: updatedHighlights } : prev)
            }

            // 3. Update local projects state
            setProjects(prev => prev.map(p => p.id === projectId ? { ...p, isHighlighted: nextStatus } : p))
            try { sessionStorage.removeItem(`profile_${currentUser?.uid}`) } catch {}

            toast({
                title: nextStatus ? 'Added to Highlights' : 'Removed from Highlight',
                description: nextStatus ? 'Project is now highlighted on your profile.' : 'Project removed from highlights.',
            })
        } catch (error) {
            console.error('Error toggling project highlight:', error)
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to update highlight status.',
            })
        }
    }


    // Invite-to-project state
    const [myProjects, setMyProjects] = useState<{ id: string; title: string }[]>([])
    const [inviteDropdownOpen, setInviteDropdownOpen] = useState(false)
    const [sentInvites, setSentInvites] = useState<Set<string>>(new Set())

    const NETWORK_LIMIT = 15
    const BADGES_LIMIT = 8
    const [showAllBadges, setShowAllBadges] = useState(false)

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

    const handleCustomBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !currentUser || !isOwnProfile) return

        setSavingBanner(true)
        try {
            // Compress the image before upload (keeping dimensions, lowering quality to 0.75)
            const compressedBlob = await compressImage(file, 0.75)

            // 1. Delete previous custom banner from Firebase Storage if it exists to avoid orphaned files
            if (profile?.bannerStyle?.startsWith('http')) {
                try {
                    const oldRef = ref(storage, profile.bannerStyle)
                    await deleteObject(oldRef)
                } catch (deleteErr) {
                    console.warn('Could not delete old banner from storage:', deleteErr)
                }
            }

            // 2. Upload compressed image to Firebase Storage
            const uniqueFileName = `users/${currentUser.uid}/banners/banner_${Date.now()}.jpg`
            const storageRef = ref(storage, uniqueFileName)
            await uploadBytes(storageRef, compressedBlob)
            
            // 3. Get the public download URL
            const downloadURL = await getDownloadURL(storageRef)

            // 4. Update user document in Firestore
            await updateDoc(doc(db, 'users', currentUser.uid), { bannerStyle: downloadURL })
            setProfile(prev => prev ? { ...prev, bannerStyle: downloadURL } : prev)
            
            // 5. Clear session cache so settings and other cached views get updated
            try { sessionStorage.removeItem(`profile_${currentUser.uid}`) } catch { /* ignore */ }

            setShowBannerPicker(false)
            toast({ title: 'Custom banner uploaded!' })
        } catch (err) {
            console.error('Error uploading custom banner:', err)
            toast({ title: 'Could not upload custom banner', variant: 'destructive' })
        } finally {
            setSavingBanner(false)
            // Reset the input value so the user can re-upload the same file if needed
            e.target.value = ''
        }
    }

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !currentUser || !isOwnProfile) return

        setSavingAvatar(true)
        try {
            // Compress and crop the avatar image before upload
            const compressedBlob = await compressAvatar(file)

            // 1. Delete previous custom avatar from Firebase Storage if it exists to avoid orphaned files
            if (profile?.photoURL?.includes('firebasestorage.googleapis.com')) {
                try {
                    const oldRef = ref(storage, profile.photoURL)
                    await deleteObject(oldRef)
                } catch (deleteErr) {
                    console.warn('Could not delete old avatar from storage:', deleteErr)
                }
            }

            // 2. Upload compressed image to Firebase Storage
            const uniqueFileName = `users/${currentUser.uid}/avatar/avatar_${Date.now()}.jpg`
            const storageRef = ref(storage, uniqueFileName)
            await uploadBytes(storageRef, compressedBlob)
            
            // 3. Get the public download URL
            const downloadURL = await getDownloadURL(storageRef)

            // 4. Update user document in Firestore
            await updateDoc(doc(db, 'users', currentUser.uid), { photoURL: downloadURL })
            setProfile(prev => prev ? { ...prev, photoURL: downloadURL } : prev)
            
            // 5. Clear session cache so settings and other cached views get updated
            try { sessionStorage.removeItem(`profile_${currentUser.uid}`) } catch { /* ignore */ }

            toast({ title: 'Profile picture updated!' })
        } catch (err) {
            console.error('Error uploading custom avatar:', err)
            toast({ title: 'Could not upload profile picture', variant: 'destructive' })
        } finally {
            setSavingAvatar(false)
            // Reset the input value so the user can re-upload the same file if needed
            e.target.value = ''
        }
    }

        const isOwnProfile = Boolean(!resolvedId || (currentUser && resolvedId === currentUser.uid))

    const profileId = resolvedId || currentUser?.uid

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

    // Compute reputation dynamically based on Firestore reviews subcollection or pre-aggregated map
    const computedReputation = (() => {
        if (profile?.reputation) {
            const rep = profile.reputation
            const coop = typeof rep.collaborationScore === 'number' ? rep.collaborationScore : 80
            const rel = typeof rep.reliabilityScore === 'number' ? rep.reliabilityScore : 80
            const comm = typeof rep.communicationScore === 'number' ? rep.communicationScore : 80
            const comp = typeof rep.completionScore === 'number' ? rep.completionScore : 80
            const trust = typeof rep.trustScore === 'number' ? rep.trustScore : 80
            const total = typeof rep.totalReviews === 'number' ? rep.totalReviews : 0
            const overall = typeof rep.overallRating === 'number' ? rep.overallRating : 4.0
            return {
                totalReviews: total,
                collaborationScore: coop,
                reliabilityScore: rel,
                communicationScore: comm,
                completionScore: comp,
                overallRating: overall,
                trustScore: trust
            }
        }

        const revealedReviews = reviews?.filter((r: any) => r.status === 'revealed' || !r.status) || []
        if (revealedReviews.length === 0) {
            return null
        }
        
        const total = revealedReviews.length
        let coopSum = 0
        let relSum = 0
        let commSum = 0
        let skillSum = 0

        revealedReviews.forEach(r => {
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
            trustScore: Math.min(100, Math.max(0, Math.round(80 + (overallRating - 4.0) * 10 + Math.min(10, total * 2))))
        }
    })()

    const groupedBadges = useMemo(() => {
        if (!badges) return []
        const groups: Record<string, { badgeType: string; count: number; instances: any[] }> = {}
        badges.forEach(b => {
            if (!groups[b.badgeType]) {
                groups[b.badgeType] = { badgeType: b.badgeType, count: 0, instances: [] }
            }
            groups[b.badgeType].count += 1
            groups[b.badgeType].instances.push(b)
        })
        return Object.values(groups).map(g => {
            const latestInstance = [...g.instances].sort((a, b) => {
                const dateA = a.issuedAt?.toDate ? a.issuedAt.toDate() : new Date(a.issuedAt || 0)
                const dateB = b.issuedAt?.toDate ? b.issuedAt.toDate() : new Date(b.issuedAt || 0)
                return dateB.getTime() - dateA.getTime()
            })[0]
            return {
                ...latestInstance,
                count: g.count,
                instances: g.instances
            }
        })
    }, [badges])

    // ── Re-derive connection status from Firestore ────────────────────────────
    const refreshConnectionStatus = useCallback(async () => {
        if (!currentUser || !profileId || isOwnProfile) return
        const status = await getConnectionStatus(currentUser.uid, profileId)
        setConnectionStatus(status)
    }, [currentUser, profileId, isOwnProfile])

    // ── Resolve username → uid if accessed via /u/:username ─────────────────
    useEffect(() => {
        if (usernameParam && !id) {
            // Resolve the username to a Firebase uid
            import('firebase/firestore').then(({ collection, query, where, getDocs }) => {
                getDocs(query(collection(db, 'users'), where('username', '==', usernameParam.toLowerCase())))
                    .then(snap => {
                        if (!snap.empty) {
                            setResolvedId(snap.docs[0].id)
                        } else {
                            setResolvedId(undefined)
                        }
                    })
                    .catch(err => {
                        console.error('Username lookup failed', err)
                        setResolvedId(undefined)
                    })
            })
        } else {
            setResolvedId(id)
        }
    }, [usernameParam, id])

    // ── Share profile ─────────────────────────────────────────────────────────
    const handleShareProfile = useCallback(() => {
        const profileUrl = profile?.username
            ? `${window.location.origin}/u/${profile.username}`
            : `${window.location.origin}/profile/${profileId}`
        navigator.clipboard.writeText(profileUrl).then(() => {
            toast({ title: 'Link copied!', description: 'Profile URL copied to clipboard.' })
        }).catch(() => {
            toast({ title: 'Copy failed', description: 'Could not copy link.', variant: 'destructive' })
        })
    }, [profile, profileId, toast])

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

    // ── Load Activity & Streak Metrics ───────────────────────────────────────
    useEffect(() => {
        if (!profileId) return
        let isMounted = true

        fetchUserActivityData(profileId).then(data => {
            if (!isMounted) return
            setActivityData(data)
            setStreakMetrics(calculateStreakMetrics(data))
        }).catch(err => {
            console.error('Error fetching activity data:', err)
        })

        return () => { isMounted = false }
    }, [profileId])

    // ── Load profile + real-time friends listener ─────────────────────────────
    useEffect(() => {

        if (!profileId) return

        let unsubFriends: (() => void) | null = null

        async function loadProfile() {
            try {
                setLoading(true)

                // ── Try sessionStorage for own profile (instant revisit) ──
                const ssKey = `profile_${profileId}`
                const SS_TTL = 3 * 60_000 // 3 min
                if (isOwnProfile) {
                    try {
                        const raw = sessionStorage.getItem(ssKey)
                        if (raw) {
                            const { profileData, projectsData, applicationsData, badgesData, ts } = JSON.parse(raw)
                            if (Date.now() - ts < SS_TTL) {
                                setProfile(profileData)
                                setProjects(projectsData)
                                setApplications(applicationsData)
                                setBadges(badgesData || [])
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

                const wrapPromise = (p: Promise<any>, name: string) => p.catch(err => {
                    console.error(`Promise failed: ${name}`, err);
                    throw err;
                });

                // ── Parallel fetch instead of sequential awaits ──
                const basePromises: Promise<any>[] = [
                    // 1. User document (cached)
                    wrapPromise(cachedGetDoc(doc(db, 'users', profileId!), { ttl: 300_000 }), '1. userDoc'),
                    // 2. Projects created by this user (cached)
                    wrapPromise(cachedQuery(
                        query(collection(db, 'projects'), where('createdBy', '==', profileId)),
                        { ttl: 300_000, cacheKey: `profile-projects-${profileId}` }
                    ), '2. projectsCreated'),
                    // 3. Reviews (cached)
                    wrapPromise(cachedQuery(
                        query(collection(db, 'users', profileId!, 'reviews'), where('status', '==', 'revealed')),
                        { ttl: 300_000, cacheKey: `profile-reviews-${profileId}` }
                    ), '3. reviews'),
                    // 4. Badges (cached)
                    wrapPromise(cachedQuery(
                        collection(db, 'users', profileId!, 'badges'),
                        { ttl: 300_000, cacheKey: `profile-badges-${profileId}` }
                    ), '4. badges'),
                    // 5. Joined project IDs (cached)
                    wrapPromise(cachedQuery(
                        collection(db, 'users', profileId!, 'joinedProjects'),
                        { ttl: 300_000, cacheKey: `profile-joined-${profileId}` }
                    ), '5. joinedProjects')
                ]

                // 6. Applications — own profile only (cached)
                if (isOwnProfile) {
                    basePromises.push(
                        wrapPromise(cachedQuery(
                            collection(db, 'users', profileId!, 'applications') as any,
                            { ttl: 120_000, cacheKey: `profile-apps-${profileId}` }
                        ), '6. applications')
                    )
                }

                const [userDoc, projectsSnap, reviewsSnap, badgesSnap, joinedProjectsSnap, appsSnap] = await Promise.all(basePromises)

                let profileData: UserProfile | null = null
                if (userDoc.exists()) {
                    profileData = { id: userDoc.id, ...userDoc.data() } as UserProfile
                    setProfile(profileData)
                }

                // Parse badges
                const badgesData = badgesSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }))
                setBadges(badgesData)

                // Parse created projects
                const createdProjects = projectsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })) as Project[]

                // Parse joined projects (fetch documents in parallel)
                const joinedIds = joinedProjectsSnap.docs.map((d: any) => d.id)
                const joinedDocs = await Promise.all(
                    joinedIds.map((pId: string) => cachedGetDoc(doc(db, 'projects', pId), { ttl: 300_000 }))
                )
                const joinedProjects = joinedDocs
                    .map((d: any) => d.exists() ? { id: d.id, ...d.data() } as Project : null)
                    .filter(Boolean) as Project[]

                // Combine both created and joined projects
                const combinedProjects = [...createdProjects, ...joinedProjects]
                // De-duplicate projects by ID (just in case)
                const uniqueProjectsMap: Record<string, Project> = {}
                combinedProjects.forEach(p => {
                    if (p) uniqueProjectsMap[p.id] = p
                })
                const projectsData = Object.values(uniqueProjectsMap)
                setProjects(projectsData)

                const reviewsData = reviewsSnap.docs
                    .map((d: any) => ({ id: d.id, ...d.data() }))
                    .filter((r: any) => r.status === 'revealed')
                    .sort((a: any, b: any) => {
                        const dateA = toDate(a.createdAt)
                        const dateB = toDate(b.createdAt)
                        return dateB.getTime() - dateA.getTime()
                    })
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
                            badgesData,
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
    const handleConnectClick = async () => {
        if (!currentUser || !profile || isOwnProfile) return
        const prevStatus = connectionStatus
        try {
            setActionLoading(true)
            setConnectionStatus('pending_out') // Optimistic update
            await sendConnectionRequest(currentUser.uid, profile.id)
            await refreshConnectionStatus()
            toast({ title: 'Request sent!' })
        } catch (error) {
            setConnectionStatus(prevStatus) // Revert on error
            console.error('Error sending connection request:', error)
            toast({ title: 'Could not send request', variant: 'destructive' })
        } finally {
            setActionLoading(false)
        }
    }



    const handleWithdraw = async () => {
        if (!currentUser || !profile) return
        const prevStatus = connectionStatus
        try {
            setActionLoading(true)
            setConnectionStatus('none') // Optimistic update
            await withdrawConnectionRequest(currentUser.uid, profile.id)
            await refreshConnectionStatus()
            toast({ title: 'Request withdrawn' })
        } catch (error) {
            setConnectionStatus(prevStatus) // Revert on error
            console.error(error)
            toast({ title: 'Could not withdraw', variant: 'destructive' })
        } finally {
            setActionLoading(false)
        }
    }

    const handleDisconnect = async () => {
        if (!currentUser || !profile) return
        const prevStatus = connectionStatus
        try {
            setActionLoading(true)
            setConnectionStatus('none') // Optimistic update
            await removeConnection(currentUser.uid, profile.id)
            await refreshConnectionStatus()
            toast({ title: 'Connection removed' })
        } catch (error) {
            setConnectionStatus(prevStatus) // Revert on error
            console.error('Error removing connection:', error)
            toast({ title: 'Could not remove connection', variant: 'destructive' })
        } finally {
            setActionLoading(false)
        }
    }

    const handleAcceptIncomingOnProfile = useCallback(async () => {
        if (!currentUser || !profile) return
        const prevStatus = connectionStatus
        try {
            setActionLoading(true)
            setConnectionStatus('connected') // Optimistic update
            await acceptConnectionRequest(currentUser.uid, profile.id)
            await refreshConnectionStatus()
            toast({ title: 'Connected!', description: 'You are now collaborators.' })
        } catch (e) {
            setConnectionStatus(prevStatus) // Revert on error
            console.error(e)
            toast({ title: 'Could not accept', variant: 'destructive' })
        } finally {
            setActionLoading(false)
        }
    }, [currentUser, profile, connectionStatus, refreshConnectionStatus, toast])

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
        const prevStatus = connectionStatus
        try {
            setActionLoading(true)
            setConnectionStatus('none') // Optimistic update
            await rejectConnectionRequest(currentUser.uid, profile.id)
            await refreshConnectionStatus()
            toast({ title: 'Request declined' })
        } catch (e) {
            setConnectionStatus(prevStatus) // Revert on error
            console.error(e)
            toast({ title: 'Could not decline', variant: 'destructive' })
        } finally {
            setActionLoading(false)
        }
    }

    const handleDeleteAccount = async () => {
        if (!currentUser || !isOwnProfile) return
        try {
            setActionLoading(true)
            await deleteDoc(doc(db, 'users', currentUser.uid))
            await currentUser.delete()
            setIsDeleteModalOpen(false)
            navigate('/')
        } catch (error: any) {
            console.error('Error deleting account:', error)
            const isRecentLoginError = error?.code === 'auth/requires-recent-login'
            toast({
                title: 'Delete Failed',
                description: isRecentLoginError
                    ? 'Security requirement: Please log out and log back in before deleting your account.'
                    : 'Failed to delete account. Please try again or re-login.',
                variant: 'destructive',
            })
        } finally {
            setActionLoading(false)
        }
    }

    // ── Connection button ─────────────────────────────────────────────────────
    const renderConnectionButton = () => {
        if (isOwnProfile) return null

        if (connectionStatus === 'connected') {
            return (
                <Button
                    variant="outline"
                    className="text-green-655 dark:text-green-400 border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-950/20 hover:text-red-500 hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30 group transition-all duration-200"
                    onClick={() => {
                        if (profile && confirm(`Are you sure you want to disconnect from ${profile.firstName}?`)) {
                            handleDisconnect()
                        }
                    }}
                    disabled={actionLoading}
                >
                    <Check className="h-4 w-4 mr-2 group-hover:hidden" />
                    <span className="group-hover:hidden">Connected</span>
                    <span className="hidden group-hover:inline">Disconnect</span>
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
            <Button onClick={handleConnectClick} disabled={actionLoading}>
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
            <main aria-label="User profile" className="max-w-5xl mx-auto">

                {/* Profile Header */}
                <div className="relative bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/80 rounded-xl overflow-visible mb-6">
                    {/* Banner */}
                    <div
                        className="relative h-36 sm:h-44 overflow-hidden cursor-pointer group rounded-t-xl"
                        onClick={() => isOwnProfile && setShowBannerPicker(true)}
                    >
                        {/* Render the chosen SVG banner or custom image */}
                        {profile?.bannerStyle?.startsWith('http') ? (
                            <img
                                src={profile.bannerStyle}
                                alt="Profile Banner"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            currentBanner.render()
                        )}

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



                    <div className="px-4 sm:px-6 pb-5">
                        {/* Avatar + actions row */}
                        <div className="flex flex-wrap justify-between items-start gap-3 -mt-10 sm:-mt-12 mb-3">
                            {/* Avatar with ring */}
                            <div className="relative shrink-0 group">
                                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full ring-4 ring-zinc-950 overflow-hidden bg-zinc-950 shadow-md relative">
                                    <img
                                        src={
                                            profile.photoURL ||
                                            `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(profile.email)}`
                                        }
                                        alt={`${profile.firstName} ${profile.lastName}`}
                                        className="w-full h-full object-cover"
                                    />
                                    {isOwnProfile && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer">
                                            {savingAvatar ? (
                                                <div className="flex flex-col items-center gap-1">
                                                    <Loader2 className="h-4.5 w-4.5 text-white animate-spin" />
                                                    <span className="text-[9px] text-zinc-300 font-medium">Uploading</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <Upload className="h-4.5 w-4.5 text-white mb-0.5" />
                                                    <span className="text-[10px] text-white font-semibold">Change</span>
                                                </>
                                            )}
                                            <label htmlFor="profile-avatar-upload" className="sr-only">Upload profile picture</label>
                                            <input
                                                id="profile-avatar-upload"
                                                type="file"
                                                accept="image/*"
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                onChange={handleAvatarUpload}
                                                disabled={savingAvatar}
                                            />
                                        </div>
                                    )}
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
                                            variant="outline"
                                            size="sm"
                                            className="h-8 text-xs"
                                            onClick={handleShareProfile}
                                        >
                                            <Share2 className="h-3.5 w-3.5 mr-1.5" />
                                            Share
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            className="h-8 w-8"
                                            title="Delete account"
                                            aria-label="Delete account"
                                            onClick={() => setIsDeleteModalOpen(true)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                        </Button>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        {renderConnectionButton()}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 text-xs"
                                            onClick={handleShareProfile}
                                        >
                                            <Share2 className="h-3.5 w-3.5 mr-1.5" />
                                            Share
                                        </Button>
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
                                <p className="text-base sm:text-lg font-bold text-gray-950 dark:text-white">{projects.length}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Projects</p>
                            </div>
                            {isOwnProfile && networkFriends.length > 0 && (
                                <>
                                    <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />
                                    <div className="text-center">
                                        <p className="text-base sm:text-lg font-bold text-gray-955 dark:text-white">{networkFriends.length}</p>
                                        <p className="text-xs text-gray-600 dark:text-slate-400">Connections</p>
                                    </div>
                                </>
                            )}
                            {isOwnProfile && applications.length > 0 && (
                                <>
                                    <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />
                                    <div className="text-center">
                                        <p className="text-base sm:text-lg font-bold text-gray-955 dark:text-white">{applications.length}</p>
                                        <p className="text-xs text-gray-600 dark:text-slate-400">Applications</p>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Meta + social row */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-600 dark:text-slate-400">
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
                                    Joined {toDate(profile.joinedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
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
                                            className="flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-sky-100 dark:hover:bg-sky-900/30 hover:text-sky-505 transition-colors text-gray-600 dark:text-gray-300">
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

                {/* ── Activity Heatmap & Streak Consistency Section ── */}
                {streakMetrics && (
                    <div className="space-y-6 mb-6">
                        <StreakCard
                            metrics={streakMetrics}
                            userName={profile.firstName}
                            isOwnProfile={isOwnProfile}
                            onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
                            onOpenShareModal={() => setIsShareModalOpen(true)}
                        />
                        <ActivityHeatmap
                            activityData={activityData}
                            userName={profile.firstName}
                            isOwnProfile={isOwnProfile}
                        />
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Left Column */}
                    <div className="space-y-6">

                        {/* Profile Strength Card — hidden once score reaches 100% */}
                        {isOwnProfile && profileStrengthScore < 100 && (
                            <Card className="relative overflow-hidden border border-zinc-800 bg-zinc-900/60 backdrop-blur-xl shadow-xl hover:border-amber-500/30 transition-all rounded-2xl">
                                <CardContent className="p-5">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="font-bold text-sm text-white flex items-center gap-2">
                                            <Sparkles className="h-4 w-4 text-amber-400 animate-pulse" />
                                            Profile Strength
                                        </h3>
                                        <span className="text-xs font-mono font-extrabold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                                            {profileStrengthScore}%
                                        </span>
                                    </div>
                                    
                                    {/* Progress Bar */}
                                    <div className="w-full h-2.5 bg-zinc-950/80 rounded-full border border-zinc-800/80 p-0.5 overflow-hidden mb-4">
                                        <div 
                                            className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500 transition-all duration-700 shadow-[0_0_10px_rgba(245,158,11,0.3)]" 
                                            style={{ width: `${profileStrengthScore}%` }}
                                        />
                                    </div>

                                    {/* Suggestions list */}
                                    {profileStrengthSuggestions.length > 0 ? (
                                        <div className="space-y-2.5">
                                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Suggested Actions</p>
                                            <div className="space-y-2">
                                                {profileStrengthSuggestions.map((suggestion, index) => (
                                                    <div 
                                                        key={index} 
                                                        onClick={() => navigate('/settings/profile')}
                                                        className="flex items-start gap-2.5 p-2.5 rounded-xl bg-zinc-950/40 border border-zinc-800/60 hover:border-amber-500/30 hover:bg-zinc-900/80 transition-all cursor-pointer group"
                                                    >
                                                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                                                            +
                                                        </span>
                                                        <div className="flex-1 min-w-0">
                                                            <span className="font-semibold text-xs text-zinc-200 group-hover:text-white transition-colors">{suggestion.label}</span>
                                                            <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">{suggestion.help}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <Button 
                                                size="sm" 
                                                className="w-full text-xs mt-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-zinc-950 font-bold shadow-md shadow-amber-500/10 border-0 transition-all h-9"
                                                onClick={() => navigate('/settings/profile')}
                                            >
                                                Complete Profile
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="text-center py-2">
                                            <p className="text-xs text-emerald-400 font-semibold flex items-center justify-center gap-1.5">
                                                <CheckCircle className="h-4 w-4 text-emerald-400" />
                                                Your profile is complete and optimized.
                                            </p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Collaboration Preferences Card removed */}

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



                        {/* Reputation & Reviews */}
                        {computedReputation && computedReputation.totalReviews > 0 && (
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-bold flex items-center justify-between">
                                        <span>Reputation & Feedback</span>
                                        <Badge className="bg-amber-505/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 font-semibold text-[10px] py-0.5">
                                            {computedReputation.totalReviews} Peer Review{computedReputation.totalReviews > 1 ? 's' : ''}
                                        </Badge>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {/* Trust Score Header Indicator */}
                                    {computedReputation.trustScore && (
                                        <div className="flex items-center justify-between text-xs border-b border-gray-100 dark:border-gray-800 pb-3 mb-2">
                                            <span className="flex items-center gap-1.5 font-semibold text-gray-700 dark:text-gray-300">
                                                <Award className="h-4 w-4 text-indigo-500" />
                                                Reputation Trust Score
                                            </span>
                                            <span className="font-extrabold text-indigo-650 dark:text-indigo-400 text-sm">{computedReputation.trustScore}%</span>
                                        </div>
                                    )}

                                    {typeof computedReputation.overallRating === 'number' && (
                                        <div className="flex items-center gap-3 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/15 dark:border-amber-500/20 rounded-lg p-3">
                                            <div className="text-3xl font-extrabold text-amber-606 dark:text-amber-400">
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
                                                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold">
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
                                                    <span className="font-semibold text-gray-700 dark:text-gray-300">{rep.score}%</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-550 rounded-full transition-all duration-500"
                                                        style={{ width: `${rep.score}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Verified Badges Section */}
                        {groupedBadges && groupedBadges.length > 0 && (
                            <Card className="mt-4">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                                        <Award className="h-4 w-4 text-indigo-505" />
                                        Verified Trust Credentials
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-2">
                                    <TooltipProvider>
                                        <div className="grid grid-cols-4 gap-y-4 gap-x-2">
                                            {(showAllBadges ? groupedBadges : groupedBadges.slice(0, BADGES_LIMIT)).map((badge) => {
                                                const BADGE_DESIGNS: Record<string, { title: string; desc: string }> = {
                                                    verified_collaborator: {
                                                        title: 'Verified Collaborator',
                                                        desc: 'Established complete profile setup to build community trust.'
                                                    },
                                                    trusted_teammate: {
                                                        title: 'Trusted Teammate',
                                                        desc: 'Maintained outstanding cooperation ratings across multiple team deliverables.'
                                                    },
                                                    reliable_contributor: {
                                                        title: 'Reliable Contributor',
                                                        desc: 'Successfully shipped 10+ tasks on or before schedule with high reliability.'
                                                    },
                                                    proven_professional: {
                                                        title: 'Proven Professional',
                                                        desc: 'Maintained exceptional quality and reviews across a substantial project history.'
                                                    },
                                                    project_finisher: {
                                                        title: 'Project Finisher',
                                                        desc: 'Successfully completed project milestones and delivered assigned tasks.'
                                                    },
                                                    project_veteran: {
                                                        title: 'Project Veteran',
                                                        desc: 'Successfully completed 5 verified projects on the platform.'
                                                    },
                                                    project_master: {
                                                        title: 'Project Master',
                                                        desc: 'Successfully completed 10 verified projects with outstanding completion rates.'
                                                    },
                                                    verified_deliverer: {
                                                        title: 'Verified Deliverer',
                                                        desc: 'Completed projects with verified team activity levels.'
                                                    },
                                                    team_builder: {
                                                        title: 'Team Builder',
                                                        desc: 'Exhibited exceptional team coordination and alignment on project deliverables.'
                                                    },
                                                    outstanding_collaborator: {
                                                        title: 'Outstanding Collaborator',
                                                        desc: 'Consistently praised by teammates for cooperation and communication.'
                                                    },
                                                    cross_functional_dev: {
                                                        title: 'Cross-Functional Contributor',
                                                        desc: 'Demonstrated versatile capabilities across multiple project disciplines.'
                                                    },
                                                    project_leader: {
                                                        title: 'Project Leader',
                                                        desc: 'Demonstrated outstanding project leadership, coordination, and team direction.'
                                                    },
                                                    delivery_manager: {
                                                        title: 'Delivery Manager',
                                                        desc: 'Consistently delivered milestones and managed timeline goals for product teams.'
                                                    },
                                                    top_rated: {
                                                        title: 'Top Rated',
                                                        desc: 'Maintained an overall peer rating of 4.8+ stars across a large project history.'
                                                    },
                                                    community_trusted: {
                                                        title: 'Community Trusted',
                                                        desc: 'Achieved legendary reputation with exceptional ratings across 20+ peer evaluations.'
                                                    },
                                                    verified_mentor: {
                                                        title: 'Verified Mentor',
                                                        desc: 'Recognized for exceptional guidance and mentorship of project teams.'
                                                    },
                                                    knowledge_contributor: {
                                                        title: 'Knowledge Contributor',
                                                        desc: 'Outstanding contributions to community documentation, wiki, or research.'
                                                    }
                                                }

                                                const design = BADGE_DESIGNS[badge.badgeType] || {
                                                    title: badge.title || 'Special Contributor',
                                                    desc: badge.description || 'Verified delivery credential.'
                                                }

                                                const IconComponent = ICON_MAP[badge.icon] || Award

                                                return (
                                                    <div key={badge.id || badge.badgeType} className="flex flex-col items-center text-center gap-1.5 min-w-0">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <div className="relative">
                                                                    <div className="h-14 w-14 shrink-0 flex items-center justify-center overflow-hidden rounded-full cursor-pointer hover:scale-105 transition-transform border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shadow-sm">
                                                                        {BADGE_IMAGES[badge.badgeType] ? (
                                                                            <img
                                                                                src={BADGE_IMAGES[badge.badgeType]}
                                                                                alt={design.title}
                                                                                className="h-14 w-14 object-contain scale-[1.45] -translate-y-[9px]"
                                                                                draggable={false}
                                                                            />
                                                                        ) : (
                                                                            <IconComponent className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                                                                        )}
                                                                    </div>
                                                                    {badge.count > 1 && (
                                                                        <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded-full border border-white dark:border-slate-900 shadow-sm z-10 pointer-events-none">
                                                                            *{badge.count}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent className="p-3 max-w-xs space-y-1 bg-slate-900 text-white border border-slate-800 rounded-lg shadow-md">
                                                                <h4 className="text-xs font-bold flex items-center gap-1.5">
                                                                    {design.title}
                                                                </h4>
                                                                <p className="text-[10px] text-slate-300 leading-snug">
                                                                    {design.desc}
                                                                </p>
                                                                {badge.evidence?.reason && (
                                                                    <p className="text-[9px] text-slate-400 border-t border-slate-800 pt-1 mt-1 italic">
                                                                        Reason: {badge.evidence.reason}
                                                                    </p>
                                                                )}
                                                            </TooltipContent>
                                                        </Tooltip>
                                                        <span className="text-[10px] font-semibold text-slate-750 dark:text-slate-350 tracking-tight leading-tight max-w-[64px] line-clamp-2">
                                                            {design.title}
                                                        </span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </TooltipProvider>

                                    {groupedBadges.length > BADGES_LIMIT && (
                                        <button
                                            type="button"
                                            onClick={() => setShowAllBadges(v => !v)}
                                            className="mt-4 text-xs text-blue-600 dark:text-blue-400 hover:underline w-full text-center font-medium"
                                        >
                                            {showAllBadges
                                                ? 'Show less'
                                                : `View all ${groupedBadges.length} credentials`}
                                        </button>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Skills */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Skills</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-1.5">
                                    {profile.skills && profile.skills.length > 0 ? (
                                        profile.skills.map((skill, i) => (
                                            <Badge key={i} className={`border-0 font-semibold text-xs px-3.5 py-1.5 rounded-md transition-colors ${getTagColorClass(skill)}`}>
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

                        {/* Tools Section */}
                        {isOwnProfile && (
                            <Card className="border border-white/[0.06] bg-[#0c0c0e]">
                                <CardHeader className="pb-3 pt-4 px-4">
                                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-white/80">
                                        <Layers className="h-4 w-4 text-indigo-400 shrink-0" />
                                        Tools
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="px-4 pb-4 pt-0 space-y-3">
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-indigo-500/10 rounded-md">
                                                <FileText className="h-4.5 w-4.5 text-indigo-400" />
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold text-white">Resume Builder</h4>
                                                <p className="text-[10px] text-white/40">Create & download a LaTeX-style resume</p>
                                            </div>
                                        </div>
                                        <Button 
                                            size="sm" 
                                            disabled 
                                            className="h-8 font-mono text-[10px] uppercase tracking-wider bg-white/5 border border-white/[0.06] text-white/30 cursor-not-allowed rounded-none flex items-center gap-1"
                                        >
                                            <Lock className="h-3 w-3 text-white/30" />
                                            Build
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* My Connections — own profile only */}
                        {isOwnProfile && (
                            <Card className="border border-white/[0.06]">
                                <CardHeader className="pb-2 pt-4 px-4">
                                    <CardTitle className="text-sm font-semibold flex items-center justify-between gap-2">
                                        <span className="flex items-center gap-2 text-white/80">
                                            <Users className="h-4 w-4 text-blue-400 shrink-0" />
                                            My Connections
                                        </span>
                                        {networkFriends.length > 0 && (
                                            <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/[0.06]">
                                                {networkFriends.length}
                                            </span>
                                        )}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="px-2 pb-3 pt-0">
                                    {networkFriends.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
                                            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                                                <Users className="h-4 w-4 text-white/20" />
                                            </div>
                                            <p className="text-xs text-white/30">No connections yet</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="space-y-0.5">
                                                {networkFriends.slice(0, 5).map((friend) => (
                                                    <div
                                                        key={friend.uid}
                                                        className="flex items-center gap-2.5 px-2 py-2 rounded-lg group hover:bg-white/[0.04] transition-colors cursor-pointer"
                                                        onClick={() => navigate(`/profile/${friend.uid}`)}
                                                    >
                                                        <img
                                                            src={
                                                                friend.photoURL ||
                                                                `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(friend.uid)}`
                                                            }
                                                            alt={friend.displayName}
                                                            className="w-7 h-7 rounded-full border border-white/10 shrink-0 group-hover:border-blue-400/40 transition-colors"
                                                        />
                                                        <span className="text-sm text-white/70 group-hover:text-white flex-1 truncate transition-colors">
                                                            {friend.displayName}
                                                        </span>
                                                        <button
                                                            className="text-[10px] text-red-405/60 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0 px-1.5 py-0.5 rounded hover:bg-red-500/10"
                                                            onClick={async (e) => {
                                                                e.stopPropagation()
                                                                if (!currentUser) return
                                                                if (confirm(`Disconnect from ${friend.displayName}?`)) {
                                                                    try {
                                                                        await removeConnection(currentUser.uid, friend.uid)
                                                                        toast({ title: 'Connection removed' })
                                                                    } catch {
                                                                        toast({ title: 'Could not remove', variant: 'destructive' })
                                                                    }
                                                                }
                                                            }}
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>

                                            {networkFriends.length > 5 && (
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            className="w-full text-xs text-blue-450 hover:text-blue-300 hover:bg-white/5 mt-2 h-8"
                                                        >
                                                            View All {networkFriends.length} Connections
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="max-w-md bg-zinc-950 border-zinc-800 text-white">
                                                        <DialogHeader>
                                                            <DialogTitle className="flex items-center gap-2 text-base font-bold">
                                                                <Users className="h-5 w-5 text-blue-400" />
                                                                My Connections ({networkFriends.length})
                                                            </DialogTitle>
                                                        </DialogHeader>
                                                        <div className="relative my-2">
                                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                                                            <Input
                                                                type="text"
                                                                placeholder="Search connections..."
                                                                className="pl-9 bg-zinc-900 border-zinc-800 text-white"
                                                                value={connectionsSearch}
                                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConnectionsSearch(e.target.value)}
                                                            />
                                                        </div>
                                                        <div className="max-h-[300px] overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                                                            {networkFriends
                                                                .filter(f => f.displayName.toLowerCase().includes(connectionsSearch.toLowerCase()))
                                                                .map(friend => (
                                                                    <div
                                                                        key={friend.uid}
                                                                        className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 cursor-pointer"
                                                                        onClick={() => navigate(`/profile/${friend.uid}`)}
                                                                    >
                                                                        <img
                                                                            src={friend.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.uid}`}
                                                                            alt={friend.displayName}
                                                                            className="w-8 h-8 rounded-full border border-white/10"
                                                                        />
                                                                        <span className="text-sm font-medium flex-1 truncate">{friend.displayName}</span>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7"
                                                                            onClick={async (e) => {
                                                                                e.stopPropagation()
                                                                                if (!currentUser) return
                                                                                if (confirm(`Disconnect from ${friend.displayName}?`)) {
                                                                                    try {
                                                                                        await removeConnection(currentUser.uid, friend.uid)
                                                                                        toast({ title: 'Connection removed' })
                                                                                    } catch {
                                                                                        toast({ title: 'Could not remove', variant: 'destructive' })
                                                                                    }
                                                                                }
                                                                            }}
                                                                        >
                                                                            Remove
                                                                        </Button>
                                                                    </div>
                                                                ))
                                                            }
                                                        </div>
                                                    </DialogContent>
                                                </Dialog>
                                            )}
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                    </div>{/* end left column */}

                    {/* Right Column */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Projects */}
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold">Projects</h2>
                                <div className="flex gap-1 bg-zinc-900/60 p-0.5 rounded-lg border border-zinc-800">
                                    <button
                                        type="button"
                                        onClick={() => setProjectFilter('active')}
                                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${projectFilter === 'active' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                                    >
                                        Active
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setProjectFilter('completed')}
                                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${projectFilter === 'completed' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                                    >
                                        Completed
                                    </button>
                                </div>
                            </div>

                            {(() => {
                                const isProjectHighlighted = (p: any) => !!p.isHighlighted || (profile?.highlightedProjectIds?.includes(p.id) ?? false)
                                const filtered = projects
                                    .filter(p => projectFilter === 'completed' ? p.status === 'completed' : p.status !== 'completed')
                                    .sort((a, b) => {
                                        const aHigh = isProjectHighlighted(a) ? 1 : 0
                                        const bHigh = isProjectHighlighted(b) ? 1 : 0
                                        return bHigh - aHigh
                                    })
                                if (filtered.length > 0) {
                                    return (
                                        <div className="space-y-4">
                                            {filtered.map((project: any) => {
                                                const isHighlighted = !!project.isHighlighted || (profile?.highlightedProjectIds?.includes(project.id) ?? false)
                                                return (
                                                <Card
                                                    key={project.id}
                                                    className={`hover:shadow-md transition-all cursor-pointer relative ${isHighlighted ? 'border-amber-500/40 bg-amber-500/[0.02]' : ''}`}
                                                    onClick={() => navigate(`/project/${project.id}`)}
                                                >
                                                        <CardContent className="p-6">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <div>
                                                                    <h3 className="font-semibold text-lg text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-1.5 flex-wrap">
                                                                        {project.title}
                                                                        {isHighlighted && (
                                                                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20 uppercase tracking-wide">
                                                                                <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                                                                                Highlighted
                                                                            </span>
                                                                        )}
                                                                        {project.status === 'completed' && project.activityVerified && (
                                                                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/45 text-emerald-755 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-900/50 uppercase tracking-wide">
                                                                                <Check className="h-2.5 w-2.5" />
                                                                                Verified Work
                                                                            </span>
                                                                        )}
                                                                    </h3>
                                                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                                                                        {project.primaryDiscipline}
                                                                    </p>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <Badge
                                                                        variant={
                                                                            project.status === 'recruiting'
                                                                                ? 'default'
                                                                                : 'secondary'
                                                                        }
                                                                    >
                                                                        {project.status}
                                                                    </Badge>

                                                                    {isOwnProfile && (
                                                                        <DropdownMenu>
                                                                            <DropdownMenuTrigger asChild>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={e => e.stopPropagation()}
                                                                                    className="p-1 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                                                                                    aria-label={`Options for ${project.title}`}
                                                                                >
                                                                                    <MoreVertical className="h-4 w-4" aria-hidden="true" />
                                                                                </button>
                                                                            </DropdownMenuTrigger>
                                                                            <DropdownMenuContent align="end" onClick={e => e.stopPropagation()} className="w-48 bg-zinc-950 border border-zinc-800 text-white z-50">
                                                                                <DropdownMenuItem
                                                                                    onClick={(e) => handleToggleProjectHighlight(e, project.id, isHighlighted)}
                                                                                    className="cursor-pointer hover:bg-zinc-900 focus:bg-zinc-900 text-xs py-2 flex items-center gap-2"
                                                                                >
                                                                                    <Star className={`h-3.5 w-3.5 ${isHighlighted ? 'fill-yellow-400 text-yellow-400' : 'text-zinc-400'}`} />
                                                                                    {isHighlighted ? 'Remove from Highlight' : 'Add to Highlights'}
                                                                                </DropdownMenuItem>
                                                                            </DropdownMenuContent>
                                                                        </DropdownMenu>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        <p className="text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
                                                            {project.description}
                                                        </p>
                                                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                                                            <div className="flex flex-wrap gap-2">
                                                                {project.tags?.slice(0, 3).map((tag: string, i: number) => (

                                                                    <Badge
                                                                        key={i}
                                                                        className="border-0 bg-white/5 text-white/85 text-xs px-2.5 py-0.5 rounded-md"
                                                                    >
                                                                        {tag}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                            {project.status === 'completed' && project.metrics && (
                                                                <span className="text-[10px] font-medium text-slate-400">
                                                                    {project.metrics.completedTasks || 0} tasks delivered
                                                                </span>
                                                            )}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            )
                                        })}
                                    </div>
                                    )
                                } else {
                                    return (
                                        <Card>
                                            <CardContent className="p-8 text-center text-gray-500">
                                                <BookOpen className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                                                <p>No {projectFilter} projects yet</p>
                                            </CardContent>
                                        </Card>
                                    )
                                }
                            })()}
                        </div>

                        {/* Teammate Endorsements */}
                        {reviews.length > 0 && (
                            <div>
                                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    <Award className="h-5 w-5 text-amber-505" />
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
                                                            <blockquote className="mt-3 text-xs text-gray-600 dark:text-gray-355 border-l-2 border-zinc-205 dark:border-zinc-800 pl-3 italic leading-relaxed">
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
                                                                {toDate(app.appliedAt).toLocaleDateString()}
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
            </main>

            {/* Delete Account Modal */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg shadow-xl max-w-md w-full p-6">
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

            {/* Banner picker overlay (moved to page root to avoid container-bound z-index issues) */}
            {showBannerPicker && (() => {
                const isCustom = !!profile?.bannerStyle?.startsWith('http')
                const selectedPresetId = isCustom ? null : (profile?.bannerStyle || DEFAULT_BANNER.id)
                return (
                    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl p-6 w-full max-w-2xl">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-base text-white">Choose profile banner</h3>
                                <button
                                    onClick={() => setShowBannerPicker(false)}
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="flex flex-col gap-4">
                                {/* Custom Upload Section */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="border border-dashed border-zinc-800 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:border-zinc-700 transition-colors cursor-pointer relative min-h-[140px] bg-zinc-900/20">
                                        {savingBanner ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
                                                <span className="text-xs text-zinc-400">Processing & uploading...</span>
                                            </div>
                                        ) : (
                                            <>
                                                <Upload className="h-6 w-6 text-zinc-400" />
                                                <span className="text-sm font-medium text-zinc-200">Upload custom banner</span>
                                                <span className="text-xs text-zinc-500 text-center">PNG, JPG or JPEG up to 10MB</span>
                                                <input 
                                                    type="file" 
                                                    accept="image/*" 
                                                    className="absolute inset-0 opacity-0 cursor-pointer" 
                                                    onChange={handleCustomBannerUpload}
                                                    disabled={savingBanner}
                                                />
                                            </>
                                        )}
                                    </div>

                                    {/* Canva Instructions Box */}
                                    <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-center">
                                        <div className="flex items-start gap-2.5">
                                            <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                                            <div className="space-y-1">
                                                <h4 className="text-xs font-semibold text-zinc-200">Design Instructions:</h4>
                                                <p className="text-[11px] leading-relaxed text-zinc-400">
                                                    For best results, go to <a href="https://canva.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Canva.com</a>, create a design with custom dimensions <strong className="text-zinc-200">2048 × 352 px</strong>, export it as PNG or JPG, and upload here.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Current Custom Banner Preview if active */}
                                {isCustom && profile?.bannerStyle && (
                                    <div className="mt-1">
                                        <h4 className="text-xs font-medium text-zinc-400 mb-2">Current Custom Banner</h4>
                                        <div className="relative h-20 w-full rounded-lg overflow-hidden border border-zinc-800 ring-2 ring-blue-500">
                                            <img src={profile.bannerStyle} className="w-full h-full object-cover" alt="Custom Banner" />
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                                <Check className="h-5 w-5 text-white drop-shadow" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Separator */}
                                <div className="flex items-center gap-2 my-1">
                                    <div className="h-[1px] bg-zinc-800 flex-1" />
                                    <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Or choose a preset</span>
                                    <div className="h-[1px] bg-zinc-800 flex-1" />
                                </div>

                                {/* Presets Grid */}
                                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-[30vh] overflow-y-auto pr-1">
                                    {BANNER_PRESETS.map(preset => {
                                        const isSelected = selectedPresetId === preset.id
                                        return (
                                            <button
                                                key={preset.id}
                                                onClick={() => handleBannerSelect(preset)}
                                                disabled={savingBanner}
                                                className={`relative h-16 sm:h-20 rounded-lg overflow-hidden ring-2 transition-all hover:scale-105 ${
                                                    isSelected
                                                        ? 'ring-blue-500 scale-105'
                                                        : 'ring-transparent hover:ring-gray-300 dark:hover:ring-gray-600'
                                                }`}
                                            >
                                                {preset.render()}
                                                {isSelected && (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                                        <Check className="h-5 w-5 text-white drop-shadow" />
                                                    </div>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })()}

            {/* Modals for Streak Leaderboard & Share Flex Card */}
            {streakMetrics && profile && (
                <>
                    <StreakLeaderboard
                        isOpen={isLeaderboardOpen}
                        onClose={() => setIsLeaderboardOpen(false)}
                        currentUserId={profile.id}
                    />
                    <ShareFlexModal
                        isOpen={isShareModalOpen}
                        onClose={() => setIsShareModalOpen(false)}
                        metrics={streakMetrics}
                        activityData={activityData}
                        userName={`${profile.firstName} ${profile.lastName}`}
                        userHandle={profile.username ? `@${profile.username}` : `@${profile.firstName.toLowerCase()}_grind`}
                        userPhoto={profile.photoURL || currentUser?.photoURL || undefined}

                    />
                </>
            )}

        </DashboardLayout>
    )
}
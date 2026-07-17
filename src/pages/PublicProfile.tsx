import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { SEOHead, buildPersonSchema, buildBreadcrumbSchema } from '@/components/seo/SEOHead'
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    limit, 
    doc, 
    getDoc,
    serverTimestamp,
    addDoc
} from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { getConnectionStatus, sendConnectionRequest } from '@/services/connectionService'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { getTagColorClass } from '@/lib/utils'
import { 
    User, Briefcase, MapPin, Calendar, Clock, Star, 
    Award, Shield, CheckCircle, Flame, ExternalLink, 
    Twitter, Linkedin, Link2, Lock, ArrowLeft, Loader2, Sparkles, AlertCircle
} from 'lucide-react'

interface BadgesDoc {
    id: string
    title: string
    description: string
    icon: string
    badgeType: string
}

interface ReviewDoc {
    id: string
    reviewerName?: string
    reviewerAvatar?: string
    projectName?: string
    rating?: number
    cooperation?: number
    reliability?: number
    communication?: number
    skill?: number
    comment?: string
    isVerified?: boolean
    createdAt?: any
}

interface ProjectHistoryDoc {
    id: string
    title: string
    description: string
    status: string
    primaryDiscipline: string
    slug?: string
}

export default function PublicProfile() {
    const { username } = useParams<{ username: string }>()
    const navigate = useNavigate()
    const { toast } = useToast()

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [profileUser, setProfileUser] = useState<any | null>(null)
    
    // Privacy States
    const [isRestricted, setIsRestricted] = useState(false)
    const [restrictionType, setRestrictionType] = useState<'connections_only' | 'private' | null>(null)
    const [connectionState, setConnectionState] = useState<'none' | 'pending_out' | 'pending_in' | 'connected'>('none')
    const [isConnecting, setIsConnecting] = useState(false)

    // Profile Details States
    const [badges, setBadges] = useState<BadgesDoc[]>([])
    const [reviews, setReviews] = useState<ReviewDoc[]>([])
    const [projects, setProjects] = useState<ProjectHistoryDoc[]>([])

    // Share Modal
    const [shareOpen, setShareOpen] = useState(false)

    useEffect(() => {
        if (!username) return
        fetchProfile()
    }, [username])

    const fetchProfile = async () => {
        try {
            setLoading(true)
            setError(null)
            setIsRestricted(false)
            setRestrictionType(null)

            // 1. Query user by username
            const usersRef = collection(db, 'users')
            const q = query(usersRef, where('username', '==', username!.toLowerCase()), limit(1))
            const querySnap = await getDocs(q)

            if (querySnap.empty) {
                setError('Profile not found.')
                setLoading(false)
                return
            }

            const userDoc = querySnap.docs[0]
            const userData = { id: userDoc.id, ...userDoc.data() } as any
            
            // 2. Validate Privacy Controls
            const visitorUid = auth.currentUser?.uid
            const isOwner = visitorUid === userData.id
            const visibility = userData.profileVisibility || 'public'

            if (!isOwner) {
                if (visibility === 'private') {
                    setIsRestricted(true)
                    setRestrictionType('private')
                    setProfileUser({ id: userData.id, firstName: userData.firstName, lastName: userData.lastName, displayName: userData.displayName })
                    setLoading(false)
                    return
                }

                if (visibility === 'connections_only') {
                    if (!visitorUid) {
                        // Guest user
                        setIsRestricted(true)
                        setRestrictionType('connections_only')
                        setProfileUser({ id: userData.id, firstName: userData.firstName, lastName: userData.lastName, displayName: userData.displayName })
                        setLoading(false)
                        return
                    }

                    // Check connection status
                    const status = await getConnectionStatus(visitorUid, userData.id)
                    setConnectionState(status)

                    if (status !== 'connected') {
                        setIsRestricted(true)
                        setRestrictionType('connections_only')
                        setProfileUser({ id: userData.id, firstName: userData.firstName, lastName: userData.lastName, displayName: userData.displayName, photoURL: userData.photoURL, avatarStyle: userData.avatarStyle, avatarSeed: userData.avatarSeed })
                        setLoading(false)
                        return
                    }
                }
            }

            if (visitorUid && visitorUid !== userData.id) {
                const status = await getConnectionStatus(visitorUid, userData.id)
                setConnectionState(status)
            }

            setProfileUser(userData)

            // 3. Parallel fetch sub-collections (Badges, Reviews, Projects)
            const [badgesSnap, reviewsSnap, projectsSnap] = await Promise.all([
                getDocs(collection(db, 'users', userData.id, 'badges')),
                getDocs(query(collection(db, 'users', userData.id, 'reviews'), where('status', '==', 'revealed'))),
                getDocs(query(collection(db, 'projects'), where('createdBy', '==', userData.id)))
            ])

            // Parse Badges
            const badgesList = badgesSnap.docs.map(d => ({
                id: d.id,
                ...d.data()
            })) as BadgesDoc[]
            setBadges(badgesList)

            // Parse Reviews
            const reviewsList = reviewsSnap.docs.map(d => ({
                id: d.id,
                ...d.data()
            })) as ReviewDoc[]
            setReviews(reviewsList)

            // Parse Projects History (Created or Team Member)
            const projectsList = projectsSnap.docs.map(d => {
                const p = d.data()
                return {
                    id: d.id,
                    title: p.title || 'Untitled',
                    description: p.description || '',
                    status: p.status || 'active',
                    primaryDiscipline: p.primaryDiscipline || '',
                    slug: p.slug
                } as ProjectHistoryDoc
            })

            // Also check projects where member
            const memberProjectsQuery = query(
                collection(db, 'projects'),
                where(`teamMembers.${userData.id}.role`, '!=', null)
            )
            try {
                const memberProjectsSnap = await getDocs(memberProjectsQuery)
                memberProjectsSnap.forEach(d => {
                    if (!projectsList.some(p => p.id === d.id)) {
                        const p = d.data()
                        projectsList.push({
                            id: d.id,
                            title: p.title || 'Untitled',
                            description: p.description || '',
                            status: p.status || 'active',
                            primaryDiscipline: p.primaryDiscipline || '',
                            slug: p.slug
                        })
                    }
                })
            } catch (err) {
                console.warn('Could not query member project history:', err)
            }

            setProjects(projectsList)

        } catch (err) {
            console.error('Error fetching profile:', err)
            setError('Could not retrieve profile data.')
        } finally {
            setLoading(false)
        }
    }

    const handleConnect = async () => {
        if (!auth.currentUser) {
            toast({
                title: 'Sign Up Required',
                description: 'You need an account to connect with collaborators.',
                variant: 'destructive'
            })
            navigate('/register')
            return
        }

        if (!profileUser) return

        setIsConnecting(true)
        const prevStatus = connectionState
        setConnectionState('pending_out') // Optimistic update
        try {
            await sendConnectionRequest(auth.currentUser.uid, profileUser.id)
            toast({
                title: 'Request Sent',
                description: `Connection request sent to ${profileUser.displayName || 'user'}.`,
                variant: 'success'
            })
        } catch (err) {
            setConnectionState(prevStatus) // Revert on error
            console.error('Failed to send connection request:', err)
            toast({
                title: 'Request Failed',
                description: 'Could not send connection request.',
                variant: 'destructive'
            })
        } finally {
            setIsConnecting(false)
        }
    }

    const copyShareLink = () => {
        const url = `${window.location.origin}/u/${username}`
        navigator.clipboard.writeText(url)
        toast({
            title: 'Link Copied',
            description: 'Public profile URL copied to clipboard!',
            variant: 'success'
        })
        setShareOpen(false)
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white">
                <Loader2 className="h-10 w-10 animate-spin text-blue-500 mb-4" />
                <p className="text-sm font-mono tracking-widest text-slate-400">LOADING DIGITAL DOSSIER...</p>
            </div>
        )
    }

    if (error || !profileUser) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white px-4 text-center">
                <AlertCircle className="h-14 w-14 text-red-500 mb-4" />
                <h2 className="text-2xl font-bold mb-2">Dossier Unavailable</h2>
                <p className="text-sm text-slate-400 max-w-sm mb-6">{error || 'This profile details are currently unreachable.'}</p>
                <Button variant="outline" className="border-slate-800 text-slate-300 hover:text-white" onClick={() => navigate('/')}>
                    Return Home
                </Button>
            </div>
        )
    }

    // Check if Restricted View
    if (isRestricted) {
        const initials = ((profileUser.displayName || `${profileUser.firstName || ''} ${profileUser.lastName || ''}`) || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase()
        return (
            <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center px-4">
                <SEOHead
                    title="Restricted Profile"
                    noIndex
                />
                
                <Card className="max-w-md w-full bg-slate-900/60 border-slate-800 backdrop-blur-xl p-6 text-center space-y-6">
                    <div className="flex flex-col items-center">
                        <Avatar className="h-20 w-20 border-2 border-slate-800 mb-3 bg-slate-850">
                            <AvatarFallback className="text-xl text-slate-400 font-bold">{initials}</AvatarFallback>
                        </Avatar>
                        <h2 className="text-xl font-bold text-white">{profileUser.displayName || 'Collaborator'}</h2>
                        <p className="text-xs font-mono text-muted-foreground mt-1">@ {username}</p>
                    </div>

                    <div className="border border-slate-800 bg-slate-950/40 p-4 rounded-lg flex flex-col items-center space-y-2.5">
                        <Lock className="h-6 w-6 text-blue-500" />
                        <h3 className="font-semibold text-sm text-slate-200">Restricted Profile</h3>
                        <p className="text-xs text-slate-400">
                            {restrictionType === 'connections_only'
                                ? 'This profile is configured to only accept views from verified connections.'
                                : 'This profile is set to private by the owner.'}
                        </p>
                    </div>

                    <div className="flex flex-col gap-2 pt-2">
                        {restrictionType === 'connections_only' && (
                            <>
                                {connectionState === 'none' && (
                                    <Button onClick={handleConnect} disabled={isConnecting} className="w-full">
                                        {isConnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <User className="h-4 w-4 mr-2" />}
                                        Send Connection Request
                                    </Button>
                                )}
                                {connectionState === 'pending_out' && (
                                    <Button disabled className="w-full bg-slate-800 text-slate-400 border border-slate-700">
                                        Connection Request Pending
                                    </Button>
                                )}
                            </>
                        )}
                        <Button variant="ghost" onClick={() => navigate(-1)} className="text-slate-400 hover:text-white">
                            <ArrowLeft className="h-4 w-4 mr-2" /> Back
                        </Button>
                    </div>
                </Card>
            </div>
        )
    }

    // Process variables for full view
    const avatarUrl = profileUser.photoURL || `https://api.dicebear.com/7.x/${profileUser.avatarStyle || 'avataaars'}/svg?seed=${encodeURIComponent(profileUser.avatarSeed || profileUser.email || profileUser.id)}`
    const ratingRep = profileUser.reputation || { overallRating: 4.0, trustScore: 80, totalReviews: 0, collaborationScore: 80, reliabilityScore: 80, communicationScore: 80, completionScore: 80 }
    const repStats = profileUser.reputationStats || { totalTasksAssigned: 0, totalTasksCompleted: 0, totalTasksCompletedOnTime: 0, projectsCompleted: 0 }
    const verifiedProjectsCount = badges.filter(b => b.badgeType === 'verified_deliverer').length || reviews.filter(r => r.isVerified).length

    const taskRate = repStats.totalTasksAssigned > 0 
        ? Math.round((repStats.totalTasksCompleted / repStats.totalTasksAssigned) * 100) 
        : 100

    const initials = (profileUser.displayName || 'Collaborator').split(' ').map((n: string) => n[0]).join('').toUpperCase()

    // Structured JSON-LD Data for SEO
    const structuredData = {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": profileUser.displayName || `${profileUser.firstName || ''} ${profileUser.lastName || ''}`,
        "description": profileUser.bio || 'Product Designer & Engineering Collaborator',
        "image": avatarUrl,
        "jobTitle": profileUser.role || 'Collaborator',
        "address": profileUser.location ? {
            "@type": "PostalAddress",
            "addressLocality": profileUser.location
        } : undefined,
        "knowsAbout": profileUser.skills || []
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8 font-sans selection:bg-blue-600/40">
            <SEOHead
                title={`${profileUser.displayName || 'Collaborator'} — Student Developer Profile`}
                description={profileUser.bio || `View ${profileUser.displayName}'s developer portfolio, skills, project collaborations, badges and ratings on ProCollab — the student project platform.`}
                keywords={[
                    ...(profileUser.skills || []),
                    profileUser.discipline || '',
                    profileUser.role || 'student developer',
                    'student developer profile',
                    'project collaborator',
                    'developer portfolio',
                    'student portfolio',
                    'engineering student',
                ].filter(Boolean) as string[]}
                canonical={`https://procollab.in/u/${username}`}
                image={avatarUrl || undefined}
                type="profile"
                author={profileUser.displayName}
                structuredData={[
                    buildPersonSchema({
                        name: profileUser.displayName || `${profileUser.firstName || ''} ${profileUser.lastName || ''}`,
                        username: username || '',
                        bio: profileUser.bio,
                        image: avatarUrl || undefined,
                        skills: profileUser.skills,
                    }),
                    buildBreadcrumbSchema([
                        { name: 'Home', url: '/' },
                        { name: 'Discover', url: '/discover' },
                        { name: profileUser.displayName || 'Profile', url: `/u/${username}` },
                    ]),
                ]}
            />

            <div className="max-w-6xl mx-auto space-y-8">
                
                {/* Back / Navigation Bar */}
                <div className="flex justify-between items-center">
                    <Button variant="ghost" className="text-slate-400 hover:text-white" onClick={() => navigate('/discover')}>
                        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Discover
                    </Button>

                    <div className="flex gap-2">
                        <Button variant="outline" className="border-slate-800 text-slate-300 hover:text-white" onClick={() => setShareOpen(true)}>
                            <Link2 className="h-4 w-4 mr-2" /> Share Link
                        </Button>
                        
                        {auth.currentUser?.uid !== profileUser.id && (
                            <>
                                {connectionState === 'none' && (
                                    <Button onClick={handleConnect} disabled={isConnecting}>
                                        {isConnecting ? <Loader2 className="h-4.5 w-4.5 animate-spin mr-1.5" /> : <User className="h-4 w-4 mr-1.5" />}
                                        Connect
                                    </Button>
                                )}
                                {connectionState === 'pending_out' && (
                                    <Button disabled className="bg-slate-800 text-slate-400 border border-slate-700">
                                        Pending
                                    </Button>
                                )}
                                {connectionState === 'connected' && (
                                    <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold">
                                        Connected
                                    </Badge>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Hero Header Dossier Card */}
                <div className="relative border border-border bg-card/40 backdrop-blur-xl rounded-2xl p-6 sm:p-8 overflow-hidden shadow-2xl">
                    <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
                    
                    <div className="flex flex-col md:flex-row gap-6 items-start">
                        <Avatar className="h-28 w-28 border-4 border-slate-800 bg-slate-950 shrink-0">
                            <AvatarImage src={avatarUrl} />
                            <AvatarFallback className="text-2xl font-bold bg-slate-900">{initials}</AvatarFallback>
                        </Avatar>

                        <div className="space-y-3 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-3">
                                <h1 className="text-3xl font-extrabold tracking-tight text-white">{profileUser.displayName}</h1>
                                
                                {profileUser.isOpenToWork && (
                                    <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold px-2.5 py-0.5 animate-pulse">
                                        Open to Work
                                    </Badge>
                                )}
                            </div>

                            <p className="text-lg font-medium text-slate-300 leading-snug">{profileUser.role || 'Collaborator & Team Member'}</p>
                            
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-400">
                                {profileUser.discipline && (
                                    <span className="flex items-center gap-1.5">
                                        <Briefcase className="h-4 w-4 text-blue-500" />
                                        {profileUser.discipline}
                                    </span>
                                )}
                                {profileUser.location && (
                                    <span className="flex items-center gap-1.5">
                                        <MapPin className="h-4 w-4 text-blue-500" />
                                        {profileUser.location}
                                    </span>
                                )}
                                {profileUser.availabilityHours && (
                                    <span className="flex items-center gap-1.5">
                                        <Clock className="h-4 w-4 text-blue-500" />
                                        {profileUser.availabilityHours} hrs/week
                                    </span>
                                )}
                            </div>

                            {profileUser.bio && (
                                <p className="text-sm text-slate-400 max-w-3xl leading-relaxed pt-2 border-t border-slate-800/60 mt-2">
                                    {profileUser.bio}
                                </p>
                            )}

                            {/* Social & portfolio links */}
                            <div className="flex flex-wrap gap-2.5 pt-3">
                                {profileUser.portfolioURL && (
                                    <a href={profileUser.portfolioURL} target="_blank" rel="noopener noreferrer" className="text-xs font-mono flex items-center gap-1 bg-slate-950 border border-slate-800 px-3 py-1.5 text-slate-300 hover:text-white rounded transition-all">
                                        <Sparkles className="h-3 w-3 text-blue-500" /> Portfolio <ExternalLink className="h-2.5 w-2.5" />
                                    </a>
                                )}
                                {profileUser.github && (
                                    <a href={profileUser.github} target="_blank" rel="noopener noreferrer" className="text-xs font-mono flex items-center gap-1 bg-slate-950 border border-slate-800 px-3 py-1.5 text-slate-300 hover:text-white rounded transition-all">
                                        <Award className="h-3 w-3 text-blue-500" /> GitHub <ExternalLink className="h-2.5 w-2.5" />
                                    </a>
                                )}
                                {profileUser.linkedin && (
                                    <a href={profileUser.linkedin} target="_blank" rel="noopener noreferrer" className="text-xs font-mono flex items-center gap-1 bg-slate-950 border border-slate-800 px-3 py-1.5 text-slate-300 hover:text-white rounded transition-all">
                                        <Linkedin className="h-3 w-3 text-blue-500" /> LinkedIn <ExternalLink className="h-2.5 w-2.5" />
                                    </a>
                                )}
                                {profileUser.website && (
                                    <a href={profileUser.website} target="_blank" rel="noopener noreferrer" className="text-xs font-mono flex items-center gap-1 bg-slate-950 border border-slate-800 px-3 py-1.5 text-slate-300 hover:text-white rounded transition-all">
                                        <Link2 className="h-3 w-3 text-blue-500" /> Website <ExternalLink className="h-2.5 w-2.5" />
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Analytical Stats Panel */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Overall Star Rating', value: `${ratingRep.overallRating.toFixed(1)} / 5.0`, sub: `${ratingRep.totalReviews} total teammate reviews`, icon: Star, color: 'text-yellow-500' },
                        { label: 'Projects Completed', value: repStats.projectsCompleted || projects.length, sub: 'Verified shipped outcomes', icon: CheckCircle, color: 'text-emerald-400' },
                        { label: 'Task Completion Rate', value: `${taskRate}%`, sub: `${repStats.totalTasksCompleted} completed on time`, icon: Flame, color: 'text-orange-500' },
                        { label: 'Verified Deliverers', value: verifiedProjectsCount, sub: 'Team activity verified', icon: Shield, color: 'text-blue-500' }
                    ].map((stat, i) => {
                        const Icon = stat.icon
                        return (
                            <div key={i} className="border border-slate-800 bg-slate-900/30 rounded-xl p-5 shadow-lg space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</span>
                                    <Icon className={`h-4.5 w-4.5 ${stat.color}`} />
                                </div>
                                <p className="text-2xl font-bold text-white leading-none">{stat.value}</p>
                                <p className="text-[10px] text-slate-400">{stat.sub}</p>
                            </div>
                        )
                    })}
                </div>

                {/* Bayesian Reputation Breakdown */}
                {ratingRep.totalReviews > 0 && (
                    <Card className="border-slate-800 bg-slate-900/20 backdrop-blur-xl">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-400">Collaboration Index</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                            {[
                                { score: ratingRep.collaborationScore, label: 'Cooperation & Support', desc: 'Working with others effectively' },
                                { score: ratingRep.reliabilityScore, label: 'Reliability & Dependability', desc: 'Delivering work on time' },
                                { score: ratingRep.communicationScore, label: 'Communication & Clarity', desc: 'Exchanging feedback clearly' },
                                { score: ratingRep.completionScore, label: 'Technical Quality', desc: 'Shipped quality benchmark' },
                            ].map((s, idx) => (
                                <div key={idx} className="bg-slate-950/40 p-4 border border-slate-800/40 rounded-lg flex flex-col space-y-2">
                                    <span className="text-xs text-slate-400 font-semibold">{s.label}</span>
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-3xl font-extrabold text-white">{s.score}</span>
                                        <span className="text-xs text-slate-500 font-bold">/100</span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 leading-tight">{s.desc}</p>
                                    <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden mt-1">
                                        <div className="h-full bg-primary rounded-full" style={{ width: `${s.score}%` }} />
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}

                {/* Proven Skills Section */}
                <div className="space-y-4">
                    <h2 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Award className="h-5 w-5 text-primary" /> Proven Skills
                    </h2>
                    <div className="flex flex-wrap gap-2">
                        {profileUser.skills && profileUser.skills.length > 0 ? (
                            profileUser.skills.map((skill: string, index: number) => (
                                <Badge 
                                    key={index}
                                    className={`border-0 font-semibold text-xs px-3.5 py-1.5 rounded-md transition-colors ${getTagColorClass(skill)}`}
                                >
                                    <CheckCircle className="h-3.5 w-3.5 text-primary mr-1.5 shrink-0" />
                                    {skill}
                                </Badge>
                            ))
                        ) : (
                            <span className="text-sm italic text-slate-500">No skills declared.</span>
                        )}
                    </div>
                </div>

                {/* Badges Collection */}
                <div className="space-y-4">
                    <h2 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Award className="h-5 w-5 text-primary" /> Badges Earned
                    </h2>
                    {badges.length === 0 ? (
                        <p className="text-sm italic text-slate-500">No badges awarded yet.</p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {badges.map((badge) => (
                                <div key={badge.id} className="border border-slate-800 bg-slate-900/20 backdrop-blur-xl rounded-xl p-4 flex gap-3.5 items-start">
                                    <div className="p-2.5 rounded bg-primary/10 border border-primary/20 text-primary">
                                        <Award className="h-5 w-5" />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="font-bold text-sm text-white">{badge.title}</h4>
                                        <p className="text-xs text-slate-400 leading-relaxed">{badge.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Portfolio & Showcase Projects */}
                <div className="space-y-4">
                    <h2 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-blue-500" /> Portfolio Showcase
                    </h2>
                    {!profileUser.pastProjectsShowcase || profileUser.pastProjectsShowcase.length === 0 ? (
                        <p className="text-sm italic text-slate-500">No showcase projects added to the portfolio.</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {profileUser.pastProjectsShowcase.map((p: any, index: number) => (
                                <Card key={index} className="border-slate-800 bg-slate-900/20 backdrop-blur-xl overflow-hidden shadow-lg flex flex-col">
                                    {p.screenshotURL && (
                                        <div className="h-44 w-full bg-slate-950 overflow-hidden relative border-b border-slate-800">
                                            <img 
                                                src={p.screenshotURL} 
                                                alt={p.title} 
                                                className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" 
                                            />
                                        </div>
                                    )}
                                    <CardContent className="p-5 flex-1 flex flex-col justify-between">
                                        <div className="space-y-2">
                                            <h4 className="font-bold text-base text-white">{p.title}</h4>
                                            <p className="text-xs text-slate-400 leading-relaxed">{p.description}</p>
                                        </div>
                                        {p.outcome && (
                                            <div className="mt-4 pt-3 border-t border-slate-850 flex flex-col space-y-1">
                                                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Outcome</span>
                                                <p className="text-xs text-emerald-400 font-medium">{p.outcome}</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>

                {/* Project History */}
                <div className="space-y-4">
                    <h2 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Briefcase className="h-5 w-5 text-blue-500" /> Project History
                    </h2>
                    {projects.length === 0 ? (
                        <p className="text-sm italic text-slate-500">No active or completed projects found in database.</p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {projects.map((proj) => (
                                <Link 
                                    key={proj.id} 
                                    to={proj.slug ? `/projects/${proj.slug}` : `/project/public/${proj.id}`} 
                                    className="border border-slate-850 bg-slate-900/10 hover:bg-slate-900/30 backdrop-blur-xl rounded-xl p-4 flex justify-between items-center transition-all group"
                                >
                                    <div className="space-y-1 min-w-0">
                                        <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded">
                                            {proj.primaryDiscipline || 'Discipline'}
                                        </span>
                                        <h4 className="font-bold text-sm text-slate-200 group-hover:text-white truncate mt-1">
                                            {proj.title}
                                        </h4>
                                        <p className="text-[10px] text-slate-450 truncate">{proj.description}</p>
                                    </div>
                                    <Badge className="bg-slate-900 border-slate-800 text-slate-400 uppercase text-[9px] shrink-0">
                                        {proj.status}
                                    </Badge>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* Teammate Peer Reviews */}
                <div className="space-y-4">
                    <h2 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Star className="h-5 w-5 text-blue-500" /> Peer Reviews
                    </h2>
                    {reviews.length === 0 ? (
                        <p className="text-sm italic text-slate-500">No peer reviews revealed yet.</p>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {reviews.map((review) => (
                                <div key={review.id} className="border border-slate-800/80 bg-slate-900/20 backdrop-blur-xl rounded-xl p-5 space-y-3 shadow-lg">
                                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-850/60 pb-3">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8 border border-slate-800">
                                                <AvatarImage src={review.reviewerAvatar} />
                                                <AvatarFallback className="text-xs bg-slate-900">{(review.reviewerName || 'R').charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0">
                                                <h4 className="font-semibold text-xs text-white">{review.reviewerName || 'Teammate'}</h4>
                                                <p className="text-[10px] text-slate-500 italic">Project: {review.projectName || 'Collaboration'}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {review.isVerified && (
                                                <Badge className="bg-primary/15 text-primary border border-primary/20 uppercase text-[9px] font-bold">
                                                    Activity Verified
                                                </Badge>
                                            )}
                                            
                                            <div className="flex gap-0.5">
                                                {Array.from({ length: 5 }).map((_, starIdx) => (
                                                    <Star 
                                                        key={starIdx} 
                                                        className={`h-3 w-3 ${starIdx < (review.rating || 5) ? 'fill-yellow-500 text-yellow-500' : 'text-slate-700'}`} 
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {review.comment && (
                                        <p className="text-xs text-slate-300 leading-relaxed italic">
                                            "{review.comment}"
                                        </p>
                                    )}

                                    {/* Sub category ratings breakdown */}
                                    <div className="flex flex-wrap gap-x-6 gap-y-1.5 pt-1.5 text-[10px] text-slate-500">
                                        <span>Cooperation: <strong className="text-slate-350">{review.cooperation || 5}/5</strong></span>
                                        <span>Reliability: <strong className="text-slate-350">{review.reliability || 5}/5</strong></span>
                                        <span>Communication: <strong className="text-slate-350">{review.communication || 5}/5</strong></span>
                                        <span>Skill: <strong className="text-slate-350">{review.skill || 5}/5</strong></span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>

            {/* Share Modal Dialog */}
            {shareOpen && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in zoom-in-95">
                    <Card className="max-w-md w-full bg-slate-900 border-slate-800 shadow-2xl">
                        <CardHeader>
                            <CardTitle className="text-lg text-white">Share Profile Dossier</CardTitle>
                            <CardDescription className="text-slate-450">Generate social links or copy the profile's public address.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="bg-slate-950 border border-slate-850 p-3 rounded font-mono text-xs text-primary select-all truncate">
                                {window.location.origin}/u/{username}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <a 
                                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out my collaborator dossier on ProCollab! ${window.location.origin}/u/${username}`)}`}
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="flex items-center justify-center gap-2 bg-slate-950 hover:bg-slate-850 text-slate-200 py-2.5 rounded border border-slate-800 text-xs font-semibold"
                                >
                                    <Twitter className="h-4 w-4" /> Share Twitter
                                </a>
                                <a 
                                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${window.location.origin}/u/${username}`)}`}
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="flex items-center justify-center gap-2 bg-slate-950 hover:bg-slate-850 text-slate-200 py-2.5 rounded border border-slate-800 text-xs font-semibold"
                                >
                                    <Linkedin className="h-4 w-4" /> Share LinkedIn
                                </a>
                            </div>

                            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-850">
                                <Button variant="ghost" className="text-slate-400 hover:text-white" onClick={() => setShareOpen(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={copyShareLink}>
                                    Copy Link
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

        </div>
    )
}

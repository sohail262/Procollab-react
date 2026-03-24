import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Loader2,
    MapPin,
    Link as LinkIcon,
    Github,
    Linkedin,
    Twitter,
    Mail,
    Calendar,
    UserPlus,
    Check,
    BookOpen,
    Trash2,
    LayoutDashboard,
    Activity,
    FileText,
    Users,
} from 'lucide-react'
import { doc, getDoc, collection, query, where, getDocs, setDoc, serverTimestamp, addDoc, deleteDoc } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { useToast } from '@/hooks/use-toast'
import {
    acceptConnectionRequest,
    rejectConnectionRequest,
} from '@/services/connectionService'

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

    const isOwnProfile = !id || (currentUser && id === currentUser.uid)
    const profileId = id || currentUser?.uid

    useEffect(() => {
        async function loadProfile() {
            if (!profileId) return

            try {
                setLoading(true)

                // Load user data
                const userDoc = await getDoc(doc(db, 'users', profileId))
                if (userDoc.exists()) {
                    setProfile({ id: userDoc.id, ...userDoc.data() } as UserProfile)
                }

                // Load user's projects
                const projectsQuery = query(
                    collection(db, 'projects'),
                    where('createdBy', '==', profileId)
                )
                const projectsSnapshot = await getDocs(projectsQuery)
                const projectsData = projectsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Project[]
                setProjects(projectsData)

                setNetworkFriends([])
                const friendsSnap = await getDocs(collection(db, 'users', profileId, 'friends'))
                const networkList = await Promise.all(
                    friendsSnap.docs.map(async (fd) => {
                        const uid = fd.id
                        const fdata = fd.data()
                        const us = await getDoc(doc(db, 'users', uid))
                        const u = us.exists() ? us.data() : {}
                        const displayName =
                            (typeof fdata.name === 'string' && fdata.name.trim()) ||
                            `${(u as { firstName?: string }).firstName || ''} ${(u as { lastName?: string }).lastName || ''}`.trim() ||
                            (u as { email?: string }).email ||
                            'Member'
                        return {
                            uid,
                            displayName,
                            photoURL: (u as { photoURL?: string }).photoURL,
                        } as NetworkFriend
                    })
                )
                setNetworkFriends(networkList)

                // Load applications if own profile
                if (isOwnProfile) {
                    const appsQuery = query(
                        collection(db, 'users', profileId, 'applications')
                    )
                    const appsSnapshot = await getDocs(appsQuery)
                    const appsData = appsSnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    })) as Application[]
                    setApplications(appsData)
                }

                // Check connection status if viewing someone else
                if (!isOwnProfile && currentUser) {
                    const friendDoc = await getDoc(doc(db, 'users', currentUser.uid, 'friends', profileId))
                    if (friendDoc.exists()) {
                        setConnectionStatus('connected')
                    } else {
                        const outgoingRef = doc(
                            db,
                            'users',
                            profileId,
                            'connectionRequests',
                            currentUser.uid
                        )
                        const outgoingSnap = await getDoc(outgoingRef)
                        if (outgoingSnap.exists()) {
                            setConnectionStatus('pending_out')
                        } else {
                            const incomingRef = doc(
                                db,
                                'users',
                                currentUser.uid,
                                'connectionRequests',
                                profileId
                            )
                            const incomingSnap = await getDoc(incomingRef)
                            if (incomingSnap.exists()) {
                                setConnectionStatus('pending_in')
                            } else {
                                setConnectionStatus('none')
                            }
                        }
                    }
                }

            } catch (error) {
                console.error('Error loading profile:', error)
            } finally {
                setLoading(false)
            }
        }

        loadProfile()
    }, [profileId, currentUser, isOwnProfile])

    const handleConnect = async () => {
        if (!currentUser || !profile || isOwnProfile) return

        try {
            setActionLoading(true)
            const targetUserRef = doc(db, 'users', profile.id)
            const requestRef = doc(targetUserRef, 'connectionRequests', currentUser.uid)

            // Get current user data
            const currentUserDoc = await getDoc(doc(db, 'users', currentUser.uid))
            const currentUserData = currentUserDoc.data()
            const currentUserName = currentUserData ? `${currentUserData.firstName} ${currentUserData.lastName}` : currentUser.email

            // Create connection request
            await setDoc(requestRef, {
                from: currentUser.uid,
                fromName: currentUserName,
                fromEmail: currentUser.email,
                sentAt: serverTimestamp(),
                status: 'pending'
            })

            // Create notification
            await addDoc(collection(targetUserRef, 'notifications'), {
                title: 'New Connection Request',
                body: `${currentUserName} wants to connect with you!`,
                icon: currentUserData?.photoURL || null,
                url: `/profile/${currentUser.uid}`,
                timestamp: serverTimestamp(),
                read: false,
                type: 'connection_request',
                data: {
                    fromUserId: currentUser.uid,
                    fromUserName: currentUserName
                }
            })

            setConnectionStatus('pending_out')
        } catch (error) {
            console.error('Error sending connection request:', error)
        } finally {
            setActionLoading(false)
        }
    }

    const handleAcceptIncomingOnProfile = async () => {
        if (!currentUser || !profile || !id) return
        try {
            setActionLoading(true)
            await acceptConnectionRequest(currentUser.uid, profile.id)
            setConnectionStatus('connected')
            toast({ title: 'Connected', description: 'You are now collaborators.' })
        } catch (e) {
            console.error(e)
            toast({ title: 'Could not accept', variant: 'destructive' })
        } finally {
            setActionLoading(false)
        }
    }

    const handleRejectIncomingOnProfile = async () => {
        if (!currentUser || !profile || !id) return
        try {
            setActionLoading(true)
            await rejectConnectionRequest(currentUser.uid, profile.id)
            setConnectionStatus('none')
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

        if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
            try {
                setActionLoading(true)
                // In a real app, you'd use a cloud function to recursively delete all user data
                // Here we just delete the user document and auth
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
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">User not found</h2>
                    <Button onClick={() => navigate('/discover')} className="mt-4">
                        Go to Discover
                    </Button>
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            <div className="max-w-5xl mx-auto">
                {/* Profile Header */}
                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden mb-6">
                    <div className="h-32 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
                    <div className="px-6 pb-6">
                        <div className="relative flex justify-between items-end -mt-12 mb-6">
                            <img
                                src={profile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(profile.email)}`}
                                alt={`${profile.firstName} ${profile.lastName}`}
                                className="w-24 h-24 rounded-full border-4 border-white dark:border-gray-900 bg-white dark:bg-gray-900"
                            />
                            <div className="flex gap-2 mb-1">
                                {!isOwnProfile ? (
                                    connectionStatus === 'connected' ? (
                                        <Button variant="outline" className="text-green-600 border-green-200 bg-green-50" disabled>
                                            <Check className="h-4 w-4 mr-2" />
                                            Connected
                                        </Button>
                                    ) : connectionStatus === 'pending_out' ? (
                                        <Button variant="outline" disabled>
                                            <Check className="h-4 w-4 mr-2" />
                                            Request sent
                                        </Button>
                                    ) : connectionStatus === 'pending_in' ? (
                                        <div className="flex gap-2">
                                            <Button
                                                className="bg-green-600 hover:bg-green-700"
                                                onClick={handleAcceptIncomingOnProfile}
                                                disabled={actionLoading}
                                            >
                                                {actionLoading ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <>
                                                        <Check className="h-4 w-4 mr-2" />
                                                        Accept
                                                    </>
                                                )}
                                            </Button>
                                            <Button variant="outline" onClick={handleRejectIncomingOnProfile} disabled={actionLoading}>
                                                Decline
                                            </Button>
                                        </div>
                                    ) : (
                                        <Button onClick={handleConnect} disabled={actionLoading}>
                                            {actionLoading ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <>
                                                    <UserPlus className="h-4 w-4 mr-2" />
                                                    Connect
                                                </>
                                            )}
                                        </Button>
                                    )
                                ) : (
                                    <>
                                        <Button variant="outline" onClick={() => navigate('/dashboard')}>
                                            <LayoutDashboard className="h-4 w-4 mr-2" />
                                            Dashboard
                                        </Button>
                                        <Button variant="outline" onClick={() => navigate('/settings/profile')}>
                                            Edit Profile
                                        </Button>
                                        <Button variant="destructive" size="icon" onClick={() => setIsDeleteModalOpen(true)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                {profile.firstName} {profile.lastName}
                            </h1>
                            <p className="text-gray-500 dark:text-gray-400 font-medium">
                                {profile.role || 'Member'} • {profile.discipline || 'No discipline listed'}
                            </p>

                            <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-600 dark:text-gray-400">
                                {profile.location && (
                                    <div className="flex items-center gap-1">
                                        <MapPin className="h-4 w-4" />
                                        {profile.location}
                                    </div>
                                )}
                                {profile.joinedAt && (
                                    <div className="flex items-center gap-1">
                                        <Calendar className="h-4 w-4" />
                                        Joined {new Date(profile.joinedAt.toDate()).toLocaleDateString()}
                                    </div>
                                )}
                                {profile.email && (
                                    <div className="flex items-center gap-1">
                                        <Mail className="h-4 w-4" />
                                        {profile.email}
                                    </div>
                                )}
                            </div>

                            {/* Social Links */}
                            <div className="flex gap-3 mt-4">
                                {profile.github && (
                                    <a href={profile.github} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                                        <Github className="h-5 w-5" />
                                    </a>
                                )}
                                {profile.linkedin && (
                                    <a href={profile.linkedin} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 transition-colors">
                                        <Linkedin className="h-5 w-5" />
                                    </a>
                                )}
                                {profile.twitter && (
                                    <a href={profile.twitter} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-400 transition-colors">
                                        <Twitter className="h-5 w-5" />
                                    </a>
                                )}
                                {profile.website && (
                                    <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                                        <LinkIcon className="h-5 w-5" />
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {isOwnProfile && (
                    <p className="text-sm text-muted-foreground mb-4">
                        Connection invites you send or receive are in the header under the{' '}
                        <span className="font-medium text-foreground">connections</span> icon (incoming and sent, including withdraw).
                    </p>
                )}

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

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    Network
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
                                    <div className="flex flex-wrap gap-4">
                                        {networkFriends.map((f) => (
                                            <button
                                                key={f.uid}
                                                type="button"
                                                onClick={() => navigate(`/profile/${f.uid}`)}
                                                className="flex flex-col items-center gap-1.5 w-[76px] group"
                                            >
                                                <img
                                                    src={
                                                        f.photoURL ||
                                                        `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(f.uid)}`
                                                    }
                                                    alt=""
                                                    className="w-14 h-14 rounded-full border border-border object-cover group-hover:border-primary transition-colors"
                                                />
                                                <span className="text-xs text-center line-clamp-2 w-full group-hover:text-primary">
                                                    {f.displayName}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
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
                                        profile.skills.map((skill, index) => (
                                            <Badge key={index} variant="secondary">
                                                {skill}
                                            </Badge>
                                        ))
                                    ) : (
                                        <p className="text-gray-500 text-sm italic">No skills listed</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Recent Activity (Placeholder) */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Activity className="h-4 w-4" />
                                    Recent Activity
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-sm text-gray-500 italic">
                                    No recent activity to show.
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column - Projects & Applications */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Projects */}
                        <div>
                            <h2 className="text-xl font-bold mb-4">Projects</h2>
                            {projects.length > 0 ? (
                                <div className="space-y-4">
                                    {projects.map((project) => (
                                        <Card key={project.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/project/${project.id}`)}>
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
                                                    <Badge variant={project.status === 'recruiting' ? 'default' : 'secondary'}>
                                                        {project.status}
                                                    </Badge>
                                                </div>
                                                <p className="text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
                                                    {project.description}
                                                </p>
                                                <div className="flex flex-wrap gap-2">
                                                    {project.tags?.slice(0, 3).map((tag, i) => (
                                                        <Badge key={i} variant="outline" className="text-xs">
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

                        {/* Applications (Only visible to owner) */}
                        {isOwnProfile && (
                            <div>
                                <h2 className="text-xl font-bold mb-4">Project Applications</h2>
                                {applications.length > 0 ? (
                                    <div className="space-y-4">
                                        {applications.map((app) => (
                                            <Card key={app.id}>
                                                <CardContent className="p-4 flex justify-between items-center">
                                                    <div className="flex items-center gap-3">
                                                        <FileText className="h-8 w-8 text-blue-500 p-1.5 bg-blue-50 rounded-lg" />
                                                        <div>
                                                            <h3 className="font-medium">{app.projectTitle}</h3>
                                                            <p className="text-xs text-gray-500">
                                                                Applied on {new Date(app.appliedAt?.toDate()).toLocaleDateString()}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <Badge variant={
                                                        app.status === 'accepted' ? 'default' :
                                                            app.status === 'rejected' ? 'destructive' : 'secondary'
                                                    }>
                                                        {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
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
                        <h2 className="text-xl font-bold text-red-600 mb-4">Delete Account</h2>
                        <p className="text-gray-600 dark:text-gray-300 mb-6">
                            Are you sure you want to delete your account? This action is permanent and cannot be undone. All your data will be lost.
                        </p>
                        <div className="flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
                            <Button variant="destructive" onClick={handleDeleteAccount} disabled={actionLoading}>
                                {actionLoading ? 'Deleting...' : 'Delete Account'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    )
}

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    ArrowLeft, Mail, Trash2, Check, X, UserPlus, Users,
    ClipboardList, Settings, Shield, Kanban, FileText,
    MessageSquare, Calendar, LayoutDashboard, Pencil, Eye
} from 'lucide-react'
import {
    doc,
    getDoc,
    getDocs,
    collection,
    query,
    where,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    arrayUnion,
    arrayRemove,
    serverTimestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { useProjectRole } from '@/hooks/use-project-role'

interface TeamMember {
    id: string
    uid: string
    name: string
    email: string
    avatar?: string
    role: 'owner' | 'admin' | 'member' | 'viewer'
    joinedAt: Date
    permissions?: MemberPermissions
}

interface MemberPermissions {
    dashboard: { read: boolean; write: boolean }
    tasks: { read: boolean; write: boolean }
    whiteboard: { read: boolean; write: boolean }
    files: { read: boolean; write: boolean }
    chat: { read: boolean; write: boolean }
    calendar: { read: boolean; write: boolean }
    gantt: { read: boolean; write: boolean }
    settings: { read: boolean; write: boolean }
}

interface Invitation {
    id: string
    email: string
    role: 'member' | 'viewer'
    invitedBy: string
    invitedAt: Date
    status: 'pending'
}

interface JoinRequest {
    id: string
    userId: string
    userEmail: string
    position: string
    skills: string
    experience: string
    motivation: string
    timeCommitment: string
    appliedAt: Date
    status: 'pending' | 'accepted' | 'rejected'
    // User info (fetched separately)
    userName?: string
    userAvatar?: string
}

// Default permissions based on role
const getDefaultPermissions = (role: string): MemberPermissions => {
    switch (role) {
        case 'owner':
        case 'admin':
            return {
                dashboard: { read: true, write: true },
                tasks: { read: true, write: true },
                whiteboard: { read: true, write: true },
                files: { read: true, write: true },
                chat: { read: true, write: true },
                calendar: { read: true, write: true },
                gantt: { read: true, write: true },
                settings: { read: true, write: true }
            }
        case 'member':
            return {
                dashboard: { read: true, write: true },
                tasks: { read: true, write: true },
                whiteboard: { read: true, write: true },
                files: { read: true, write: true },
                chat: { read: true, write: true },
                calendar: { read: true, write: false },
                gantt: { read: true, write: false },
                settings: { read: true, write: false }
            }
        case 'viewer':
        default:
            return {
                dashboard: { read: true, write: false },
                tasks: { read: true, write: false },
                whiteboard: { read: true, write: false },
                files: { read: true, write: false },
                chat: { read: true, write: false },
                calendar: { read: true, write: false },
                gantt: { read: true, write: false },
                settings: { read: false, write: false }
            }
    }
}

const PERMISSION_TABS = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'tasks', label: 'Tasks', icon: Kanban },
    { key: 'whiteboard', label: 'Whiteboard', icon: Pencil },
    { key: 'files', label: 'Files', icon: FileText },
    { key: 'chat', label: 'Chat', icon: MessageSquare },
    { key: 'calendar', label: 'Calendar', icon: Calendar },
    { key: 'gantt', label: 'Gantt Chart', icon: ClipboardList },
    { key: 'settings', label: 'Settings', icon: Settings },
]

export function ManageTeam() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()
    const { toast } = useToast()
    const { canManageTeam, loading: roleLoading } = useProjectRole()

    const [project, setProject] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteRole, setInviteRole] = useState<'member' | 'viewer'>('member')
    const [members, setMembers] = useState<TeamMember[]>([])
    const [invitations, setInvitations] = useState<Invitation[]>([])
    const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([])
    const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
    const [activeTab, setActiveTab] = useState('members')

    useEffect(() => {
        if (id) {
            loadProject()
            loadTeamMembers()
            loadInvitations()
            loadJoinRequests()
        }
    }, [id])

    const loadProject = async () => {
        if (!id) return
        try {
            const docRef = doc(db, 'projects', id)
            const unsubscribe = onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    setProject({ id: docSnap.id, ...docSnap.data() })
                }
                setLoading(false)
            })
            return unsubscribe
        } catch (error) {
            console.error('Error loading project:', error)
            setLoading(false)
        }
    }

    const loadTeamMembers = () => {
        if (!id) return

        const q = query(collection(db, 'projects', id, 'members'))
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const membersData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                joinedAt: doc.data().joinedAt?.toDate() || new Date(),
                permissions: doc.data().permissions || getDefaultPermissions(doc.data().role)
            })) as TeamMember[]
            setMembers(membersData)
        })

        return unsubscribe
    }

    const loadInvitations = () => {
        if (!id) return

        const q = query(
            collection(db, 'projects', id, 'invitations'),
            where('status', '==', 'pending')
        )
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const invitationsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                invitedAt: doc.data().invitedAt?.toDate() || new Date()
            })) as Invitation[]
            setInvitations(invitationsData)
        })

        return unsubscribe
    }

    const loadJoinRequests = () => {
        if (!id) return

        const q = query(
            collection(db, 'projects', id, 'applications'),
            where('status', '==', 'pending')
        )
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const requestsData: JoinRequest[] = []

            for (const docSnap of snapshot.docs) {
                const data = docSnap.data()

                // Fetch user info for display
                let userName = 'Unknown User'
                let userAvatar = ''

                try {
                    const userDoc = await getDoc(doc(db, 'users', data.userId))
                    if (userDoc.exists()) {
                        const userData = userDoc.data()
                        userName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.email || 'Unknown'
                        userAvatar = userData.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.userId}`
                    }
                } catch (err) {
                    console.error('Error fetching user info:', err)
                }

                requestsData.push({
                    id: docSnap.id,
                    userId: data.userId,
                    userEmail: data.userEmail,
                    position: data.position || '',
                    skills: data.skills || '',
                    experience: data.experience || '',
                    motivation: data.motivation || '',
                    timeCommitment: data.timeCommitment || '',
                    appliedAt: data.appliedAt?.toDate() || new Date(),
                    status: data.status,
                    userName,
                    userAvatar
                })
            }

            setJoinRequests(requestsData)
        })

        return unsubscribe
    }

    const handleInvite = async () => {
        if (!id || !user || !inviteEmail) return

        try {
            await addDoc(collection(db, 'projects', id, 'invitations'), {
                email: inviteEmail,
                role: inviteRole,
                invitedBy: user.uid,
                invitedAt: serverTimestamp(),
                status: 'pending'
            })

            toast({
                title: "Invitation sent",
                description: `Invitation sent to ${inviteEmail}`
            })

            setInviteEmail('')
        } catch (error) {
            console.error('Error sending invitation:', error)
            toast({
                title: "Error",
                description: "Failed to send invitation",
                variant: "destructive"
            })
        }
    }

    const handleCancelInvite = async (inviteId: string) => {
        if (!id) return

        try {
            await deleteDoc(doc(db, 'projects', id, 'invitations', inviteId))
            toast({
                title: "Invitation cancelled",
                description: "The invitation has been cancelled"
            })
        } catch (error) {
            console.error('Error cancelling invitation:', error)
        }
    }

    const handleRemoveMember = async (memberId: string, memberUid: string) => {
        if (!id) return

        try {
            // Remove from members subcollection
            await deleteDoc(doc(db, 'projects', id, 'members', memberId))

            // Remove from project members array
            await updateDoc(doc(db, 'projects', id), {
                members: arrayRemove(memberUid)
            })

            toast({
                title: "Member removed",
                description: "Team member has been removed from the project"
            })
            setSelectedMember(null)
        } catch (error) {
            console.error('Error removing member:', error)
            toast({
                title: "Error",
                description: "Failed to remove member",
                variant: "destructive"
            })
        }
    }

    const handleUpdateRole = async (memberId: string, newRole: string) => {
        if (!id) return

        try {
            const newPermissions = getDefaultPermissions(newRole)
            await updateDoc(doc(db, 'projects', id, 'members', memberId), {
                role: newRole,
                permissions: newPermissions
            })

            toast({
                title: "Role updated",
                description: "Member role and permissions have been updated"
            })
        } catch (error) {
            console.error('Error updating role:', error)
            toast({
                title: "Error",
                description: "Failed to update role",
                variant: "destructive"
            })
        }
    }

    const handleUpdatePermission = async (memberId: string, tabKey: string, permType: 'read' | 'write', value: boolean) => {
        if (!id || !selectedMember) return

        try {
            const currentPermissions = selectedMember.permissions || getDefaultPermissions(selectedMember.role)
            const updatedPermissions = {
                ...currentPermissions,
                [tabKey]: {
                    ...currentPermissions[tabKey as keyof MemberPermissions],
                    [permType]: value
                }
            }

            // If turning off read, also turn off write
            if (permType === 'read' && !value) {
                updatedPermissions[tabKey as keyof MemberPermissions].write = false
            }

            await updateDoc(doc(db, 'projects', id, 'members', memberId), {
                permissions: updatedPermissions
            })

            // Update local state
            setSelectedMember({
                ...selectedMember,
                permissions: updatedPermissions
            })

            toast({
                title: "Permission updated",
                description: `${tabKey} ${permType} access updated`
            })
        } catch (error) {
            console.error('Error updating permission:', error)
            toast({
                title: "Error",
                description: "Failed to update permission",
                variant: "destructive"
            })
        }
    }

    const handleAcceptRequest = async (request: JoinRequest) => {
        if (!id) return

        try {
            const defaultPerms = getDefaultPermissions('member')

            // Add to members
            await addDoc(collection(db, 'projects', id, 'members'), {
                uid: request.userId,
                name: request.userName || request.userEmail,
                email: request.userEmail,
                avatar: request.userAvatar,
                role: 'member',
                permissions: defaultPerms,
                joinedAt: serverTimestamp()
            })

            // Add to project members array
            await updateDoc(doc(db, 'projects', id), {
                members: arrayUnion(request.userId)
            })

            // Update application status
            await updateDoc(doc(db, 'projects', id, 'applications', request.id), {
                status: 'accepted'
            })

            // Update user's application status
            const userAppsRef = collection(db, 'users', request.userId, 'applications')
            const userAppsQuery = query(userAppsRef, where('projectId', '==', id))
            const userAppsSnap = await getDocs(userAppsQuery)
            for (const appDoc of userAppsSnap.docs) {
                await updateDoc(doc(db, 'users', request.userId, 'applications', appDoc.id), {
                    status: 'accepted'
                })
            }

            toast({
                title: "Application accepted",
                description: `${request.userName || request.userEmail} has been added to the team`
            })
        } catch (error) {
            console.error('Error accepting request:', error)
            toast({
                title: "Error",
                description: "Failed to accept application",
                variant: "destructive"
            })
        }
    }

    const handleRejectRequest = async (request: JoinRequest) => {
        if (!id) return

        try {
            await updateDoc(doc(db, 'projects', id, 'applications', request.id), {
                status: 'rejected'
            })

            // Update user's application status
            const userAppsRef = collection(db, 'users', request.userId, 'applications')
            const userAppsQuery = query(userAppsRef, where('projectId', '==', id))
            const userAppsSnap = await getDocs(userAppsQuery)
            for (const appDoc of userAppsSnap.docs) {
                await updateDoc(doc(db, 'users', request.userId, 'applications', appDoc.id), {
                    status: 'rejected'
                })
            }

            toast({
                title: "Application rejected",
                description: "The application has been rejected"
            })
        } catch (error) {
            console.error('Error rejecting request:', error)
        }
    }

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'owner': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
            case 'admin': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            case 'member': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            case 'viewer': return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
            default: return ''
        }
    }

    if (loading || roleLoading) return <div className="flex items-center justify-center h-screen">Loading...</div>

    if (!canManageTeam) {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] text-center">
                    <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
                    <p className="text-muted-foreground mb-4">You do not have permission to manage this team.</p>
                    <Button onClick={() => navigate(`/project/${id}/dashboard`)}>
                        Return to Dashboard
                    </Button>
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            <div className="max-w-6xl mx-auto space-y-6 p-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(`/project/${id}/dashboard`)}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold">Manage Team</h1>
                        <p className="text-muted-foreground">Manage members, roles, and permissions for {project?.title}</p>
                    </div>
                    {joinRequests.length > 0 && (
                        <Badge variant="destructive" className="px-3 py-1">
                            {joinRequests.length} Pending {joinRequests.length === 1 ? 'Application' : 'Applications'}
                        </Badge>
                    )}
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-6">
                        <TabsTrigger value="members" className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Team Members
                        </TabsTrigger>
                        <TabsTrigger value="applications" className="flex items-center gap-2">
                            <ClipboardList className="h-4 w-4" />
                            Applications
                            {joinRequests.length > 0 && (
                                <Badge variant="secondary" className="ml-1">{joinRequests.length}</Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="permissions" className="flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            Permissions
                        </TabsTrigger>
                    </TabsList>

                    {/* Team Members Tab */}
                    <TabsContent value="members" className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Invite Section */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Invite Members</CardTitle>
                                    <CardDescription>Add new people to your project</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Input
                                            type="email"
                                            placeholder="Email address"
                                            value={inviteEmail}
                                            onChange={e => setInviteEmail(e.target.value)}
                                        />
                                        <Select value={inviteRole} onValueChange={(val: 'member' | 'viewer') => setInviteRole(val)}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="member">Member</SelectItem>
                                                <SelectItem value="viewer">Viewer</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Button className="w-full" onClick={handleInvite} disabled={!inviteEmail}>
                                            <Mail className="h-4 w-4 mr-2" />
                                            Send Invitation
                                        </Button>
                                    </div>

                                    {invitations.length > 0 && (
                                        <div className="pt-4 border-t">
                                            <h4 className="text-sm font-medium mb-2">Pending Invites ({invitations.length})</h4>
                                            <div className="space-y-2">
                                                {invitations.map(invite => (
                                                    <div key={invite.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                                                        <div className="flex-1 truncate">
                                                            <span className="text-foreground">{invite.email}</span>
                                                            <Badge variant="outline" className="ml-2 text-xs">{invite.role}</Badge>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6"
                                                            onClick={() => handleCancelInvite(invite.id)}
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Team List */}
                            <Card className="lg:col-span-2">
                                <CardHeader>
                                    <CardTitle className="text-lg">Team Members ({members.length})</CardTitle>
                                    <CardDescription>Current members and their roles</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {members.length === 0 ? (
                                            <div className="text-center py-8 text-muted-foreground">
                                                <UserPlus className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                                <p>No team members yet</p>
                                                <p className="text-sm">Invite people to collaborate</p>
                                            </div>
                                        ) : (
                                            members.map((member) => (
                                                <div
                                                    key={member.id}
                                                    className={`flex items-center justify-between p-3 border rounded-lg transition-colors cursor-pointer ${selectedMember?.id === member.id
                                                        ? 'bg-primary/10 border-primary'
                                                        : 'hover:bg-accent/50'
                                                        }`}
                                                    onClick={() => setSelectedMember(member)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Avatar>
                                                            {member.avatar && <AvatarImage src={member.avatar} />}
                                                            <AvatarFallback>{member.name.charAt(0).toUpperCase()}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="font-medium">{member.name}</p>
                                                            <p className="text-xs text-muted-foreground">{member.email}</p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <Badge className={`${getRoleBadgeColor(member.role)} border-none`}>
                                                            {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                                                        </Badge>

                                                        <Select
                                                            value={member.role}
                                                            onValueChange={(val) => handleUpdateRole(member.id, val)}
                                                            disabled={member.role === 'owner' || member.uid === user?.uid}
                                                        >
                                                            <SelectTrigger className="w-[100px] h-8" onClick={(e) => e.stopPropagation()}>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="admin">Admin</SelectItem>
                                                                <SelectItem value="member">Member</SelectItem>
                                                                <SelectItem value="viewer">Viewer</SelectItem>
                                                            </SelectContent>
                                                        </Select>

                                                        {member.role !== 'owner' && member.uid !== user?.uid && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    handleRemoveMember(member.id, member.uid)
                                                                }}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* Applications Tab */}
                    <TabsContent value="applications">
                        <Card>
                            <CardHeader>
                                <CardTitle>Join Requests</CardTitle>
                                <CardDescription>Review applications from people who want to join this project</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {joinRequests.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                        <p className="text-lg font-medium">No pending applications</p>
                                        <p className="text-sm">When people apply to join your project, they'll appear here</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {joinRequests.map((request) => (
                                            <div key={request.id} className="flex items-start justify-between p-4 border rounded-lg bg-card">
                                                <div className="flex items-start gap-4">
                                                    <Avatar className="h-12 w-12">
                                                        {request.userAvatar && <AvatarImage src={request.userAvatar} />}
                                                        <AvatarFallback className="text-lg">
                                                            {(request.userName || request.userEmail || 'U').charAt(0).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="space-y-1 flex-1">
                                                        <h4 className="font-semibold text-lg">{request.userName || request.userEmail}</h4>
                                                        <p className="text-sm text-muted-foreground">{request.userEmail}</p>
                                                        <Badge variant="outline" className="mt-1">{request.position}</Badge>

                                                        {request.motivation && (
                                                            <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                                                                <p className="text-xs font-medium mb-1">Motivation:</p>
                                                                <p className="text-sm italic">"{request.motivation}"</p>
                                                            </div>
                                                        )}

                                                        <div className="flex flex-wrap gap-2 mt-2">
                                                            {request.skills && (
                                                                <div className="text-xs text-muted-foreground">
                                                                    <span className="font-medium">Skills:</span> {request.skills}
                                                                </div>
                                                            )}
                                                            {request.timeCommitment && (
                                                                <Badge variant="secondary" className="text-xs">
                                                                    {request.timeCommitment} hrs/week
                                                                </Badge>
                                                            )}
                                                        </div>

                                                        <p className="text-xs text-muted-foreground mt-2">
                                                            Applied {request.appliedAt.toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <Button
                                                        size="sm"
                                                        className="bg-green-600 hover:bg-green-700 text-white"
                                                        onClick={() => handleAcceptRequest(request)}
                                                    >
                                                        <Check className="h-4 w-4 mr-2" />
                                                        Accept
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                                        onClick={() => handleRejectRequest(request)}
                                                    >
                                                        <X className="h-4 w-4 mr-2" />
                                                        Reject
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Permissions Tab */}
                    <TabsContent value="permissions">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Member Selection */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Select Member</CardTitle>
                                    <CardDescription>Choose a member to configure permissions</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {members.map((member) => (
                                            <div
                                                key={member.id}
                                                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selectedMember?.id === member.id
                                                    ? 'bg-primary/10 border border-primary'
                                                    : 'hover:bg-muted border border-transparent'
                                                    }`}
                                                onClick={() => setSelectedMember(member)}
                                            >
                                                <Avatar className="h-10 w-10">
                                                    {member.avatar && <AvatarImage src={member.avatar} />}
                                                    <AvatarFallback>{member.name.charAt(0).toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium truncate">{member.name}</p>
                                                    <p className="text-xs text-muted-foreground truncate">{member.role}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Permissions Configuration */}
                            <Card className="lg:col-span-2">
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Shield className="h-5 w-5" />
                                        Access Permissions
                                    </CardTitle>
                                    <CardDescription>
                                        {selectedMember
                                            ? `Configure what ${selectedMember.name} can access and modify`
                                            : 'Select a member to configure their permissions'}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {selectedMember ? (
                                        <div className="space-y-4">
                                            {selectedMember.role === 'owner' ? (
                                                <div className="text-center py-8 text-muted-foreground">
                                                    <Shield className="h-12 w-12 mx-auto mb-4 text-purple-500" />
                                                    <p className="font-medium">Project Owner</p>
                                                    <p className="text-sm">Owners have full access to all features</p>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex items-center justify-between pb-4 border-b">
                                                        <div>
                                                            <p className="font-medium">{selectedMember.name}</p>
                                                            <Badge className={`${getRoleBadgeColor(selectedMember.role)} border-none mt-1`}>
                                                                {selectedMember.role}
                                                            </Badge>
                                                        </div>
                                                        <div className="flex items-center gap-4 text-sm">
                                                            <div className="flex items-center gap-1.5">
                                                                <Eye className="h-4 w-4 text-blue-500" />
                                                                <span>Read</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <Pencil className="h-4 w-4 text-green-500" />
                                                                <span>Write</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3">
                                                        {PERMISSION_TABS.map((tab) => {
                                                            const Icon = tab.icon
                                                            const perms = selectedMember.permissions?.[tab.key as keyof MemberPermissions]
                                                                || { read: false, write: false }

                                                            return (
                                                                <div
                                                                    key={tab.key}
                                                                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="p-2 rounded-lg bg-muted">
                                                                            <Icon className="h-4 w-4" />
                                                                        </div>
                                                                        <span className="font-medium">{tab.label}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-6">
                                                                        <div className="flex items-center gap-2">
                                                                            <Switch
                                                                                checked={perms.read}
                                                                                onCheckedChange={(val) =>
                                                                                    handleUpdatePermission(selectedMember.id, tab.key, 'read', val)
                                                                                }
                                                                                disabled={selectedMember.role === 'admin'}
                                                                            />
                                                                            <Eye className={`h-4 w-4 ${perms.read ? 'text-blue-500' : 'text-muted-foreground'}`} />
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <Switch
                                                                                checked={perms.write}
                                                                                onCheckedChange={(val) =>
                                                                                    handleUpdatePermission(selectedMember.id, tab.key, 'write', val)
                                                                                }
                                                                                disabled={!perms.read || selectedMember.role === 'admin'}
                                                                            />
                                                                            <Pencil className={`h-4 w-4 ${perms.write ? 'text-green-500' : 'text-muted-foreground'}`} />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>

                                                    <div className="pt-4 border-t">
                                                        <p className="text-xs text-muted-foreground">
                                                            <strong>Note:</strong> Admin role has full access and cannot be modified.
                                                            Change the role to Member or Viewer to customize permissions.
                                                        </p>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 text-muted-foreground">
                                            <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                            <p className="font-medium">No member selected</p>
                                            <p className="text-sm">Select a team member from the left to configure their permissions</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardLayout>
    )
}

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import {
    Card, CardContent, CardHeader,
    CardTitle, CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
    ArrowLeft, Mail, Trash2, Users, ClipboardList,
    Settings, Shield, Kanban, FileText, MessageSquare,
    Calendar, LayoutDashboard, Pencil, ExternalLink, X,
} from 'lucide-react'
import {
    doc, getDoc, getDocs, collection, query, where,
    onSnapshot, addDoc, setDoc, updateDoc, deleteDoc,
    arrayUnion, arrayRemove, serverTimestamp, increment,
    writeBatch, deleteField,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { useProjectRole } from '@/hooks/use-project-role'
import {
    type MemberPermissions,
} from '@/hooks/use-permissions'
import {
    buildInviteMailOptions,
    openMailClient,
    type MailClientOption,
} from '@/lib/sendInviteEmail'
import { sendNotificationWithPush } from '@/services/notificationTrigger'

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

interface TeamMember {
    id:           string
    uid:          string
    name:         string
    email:        string
    avatar?:      string
    role:         'owner' | 'admin' | 'member' | 'viewer'
    joinedAt:     Date
    permissions?: MemberPermissions
}

interface Invitation {
    id:              string
    email:           string
    role:            'member' | 'viewer'
    invitedBy:       string
    invitedByName?:  string
    invitedAt:       Date
    status:          'pending'
    token?:          string
    resolvedUserId?: string
}

interface JoinRequest {
    id:             string
    userId:         string
    userEmail:      string
    position:       string
    skills:         string
    experience:     string
    motivation:     string
    timeCommitment: string
    appliedAt:      Date
    status:         'pending' | 'accepted' | 'rejected'
    userName?:      string
    userAvatar?:    string
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

const getDefaultPermissions = (role: string): MemberPermissions => {
    switch (role) {
        case 'owner':
        case 'admin':
            return {
                dashboard:  { read: true,  write: true  },
                tasks:      { read: true,  write: true  },
                whiteboard: { read: true,  write: true  },
                files:      { read: true,  write: true  },
                chat:       { read: true,  write: true  },
                calendar:   { read: true,  write: true  },
                gantt:      { read: true,  write: true  },
                settings:   { read: true,  write: true  },
            }
        case 'viewer':
            return {
                dashboard:  { read: true,  write: false },
                tasks:      { read: true,  write: false },
                whiteboard: { read: false, write: false },
                files:      { read: true,  write: false },
                chat:       { read: true,  write: false },
                calendar:   { read: true,  write: false },
                gantt:      { read: true,  write: false },
                settings:   { read: false, write: false },
            }
        default: // 'member'
            return {
                dashboard:  { read: true,  write: true  },
                tasks:      { read: true,  write: true  },
                whiteboard: { read: true,  write: true  },
                files:      { read: true,  write: true  },
                chat:       { read: true,  write: true  },
                calendar:   { read: true,  write: true  },
                gantt:      { read: true,  write: false },
                settings:   { read: false, write: false },
            }
    }
}

const PERMISSION_TABS = [
    { key: 'dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
    { key: 'tasks',      label: 'Tasks',       icon: Kanban          },
    { key: 'whiteboard', label: 'Whiteboard',  icon: Pencil          },
    { key: 'files',      label: 'Files',       icon: FileText        },
    { key: 'chat',       label: 'Chat',        icon: MessageSquare   },
    { key: 'calendar',   label: 'Calendar',    icon: Calendar        },
    { key: 'gantt',      label: 'Gantt Chart', icon: ClipboardList   },
    { key: 'settings',   label: 'Settings',    icon: Settings        },
]

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────

export function ManageTeam() {
    const { id }      = useParams()
    const navigate    = useNavigate()
    const { user }    = useAuth()
    const { toast }   = useToast()
    const { canManageTeam, loading: roleLoading } = useProjectRole()

    const [project,       setProject]       = useState<any>(null)
    const [loading,       setLoading]       = useState(true)
    const [inviteEmail,   setInviteEmail]   = useState('')
    const [inviteRole,    setInviteRole]    = useState<'member' | 'viewer'>('member')
    const [inviteLoading, setInviteLoading] = useState(false)
    const [members,       setMembers]       = useState<TeamMember[]>([])
    const [invitations,   setInvitations]   = useState<Invitation[]>([])
    const [joinRequests,  setJoinRequests]  = useState<JoinRequest[]>([])
    const [selectedMember,setSelectedMember]= useState<TeamMember | null>(null)
    const [activeTab,     setActiveTab]     = useState('members')

    const [removeDialog, setRemoveDialog] = useState<{
        open:       boolean
        memberId:   string
        memberUid:  string
        memberName: string
    }>({ open: false, memberId: '', memberUid: '', memberName: '' })

    const [mailDialog, setMailDialog] = useState<{
        open:    boolean
        options: MailClientOption[]
    }>({ open: false, options: [] })

    // ── Real-time listeners ───────────────────────────────
    useEffect(() => {
        if (!id) return
        const unsubs: Array<() => void> = []

        // Project doc
        unsubs.push(
            onSnapshot(doc(db, 'projects', id), snap => {
                if (snap.exists()) setProject({ id: snap.id, ...snap.data() })
                setLoading(false)
            })
        )

        // Members subcollection
        // ✅ Filter out owner from members list display
        // Owner is managed separately via createdBy field
        unsubs.push(
            onSnapshot(
                collection(db, 'projects', id, 'members'),
                snap => {
                    setMembers(
                        snap.docs.map(d => ({
                            id:          d.id,
                            ...d.data(),
                            joinedAt:    d.data().joinedAt?.toDate() ?? new Date(),
                            permissions: d.data().permissions ??
                                         getDefaultPermissions(d.data().role),
                        })) as TeamMember[]
                    )
                }
            )
        )

        // Pending invitations
        unsubs.push(
            onSnapshot(
                query(
                    collection(db, 'projects', id, 'invitations'),
                    where('status', '==', 'pending')
                ),
                snap => {
                    setInvitations(
                        snap.docs.map(d => ({
                            id: d.id,
                            ...d.data(),
                            invitedAt: d.data().invitedAt?.toDate() ?? new Date(),
                        })) as Invitation[]
                    )
                }
            )
        )

        // Pending applications
        // ✅ Fetch user profiles in parallel (not sequential loop)
        unsubs.push(
            onSnapshot(
                query(
                    collection(db, 'projects', id, 'applications'),
                    where('status', '==', 'pending')
                ),
                async snap => {
                    if (snap.empty) {
                        setJoinRequests([])
                        return
                    }

                    // ✅ Batch fetch all user profiles in parallel
                    const userIds = [...new Set(
                        snap.docs.map(d => d.data().userId).filter(Boolean)
                    )]

                    const userProfiles: Record<string, any> = {}
                    await Promise.all(
                        userIds.map(async uid => {
                            try {
                                const uSnap = await getDoc(
                                    doc(db, 'users', uid)
                                )
                                if (uSnap.exists()) {
                                    userProfiles[uid] = uSnap.data()
                                }
                            } catch {
                                // non-fatal — user profile unavailable
                            }
                        })
                    )

                    const requests: JoinRequest[] = snap.docs.map(docSnap => {
                        const data    = docSnap.data()
                        const profile = userProfiles[data.userId]

                        const userName = profile
                            ? (`${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim()
                               || profile.displayName
                               || profile.email
                               || 'Unknown')
                            : 'Unknown User'

                        const userAvatar = profile?.photoURL
                            || `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.userId}`

                        return {
                            id:             docSnap.id,
                            userId:         data.userId,
                            userEmail:      data.userEmail || data.email || '',
                            position:       data.position       || '',
                            skills:         data.skills         || '',
                            experience:     data.experience     || '',
                            motivation:     data.motivation     || data.message || '',
                            timeCommitment: data.timeCommitment || '',
                            appliedAt:      data.appliedAt?.toDate() ?? new Date(),
                            status:         data.status,
                            userName,
                            userAvatar,
                        }
                    })

                    setJoinRequests(requests)
                }
            )
        )

        return () => unsubs.forEach(fn => fn())
    }, [id])

    // ── Invite ────────────────────────────────────────────
    const handleInvite = async () => {
        if (!id || !user || !inviteEmail.trim()) return
        setInviteLoading(true)

        try {
            const senderName   = user.displayName || user.email || 'Someone'
            const projectTitle = project?.title || 'a project'
            const email        = inviteEmail.trim().toLowerCase()

            // ✅ Check if user is already a member
            const existingMemberSnap = await getDocs(
                query(
                    collection(db, 'projects', id, 'members'),
                    where('email', '==', email)
                )
            )
            if (!existingMemberSnap.empty) {
                toast({
                    title:       'Already a member',
                    description: `${email} is already on this team.`,
                    variant:     'destructive',
                })
                setInviteLoading(false)
                return
            }

            // ✅ Check if invitation already pending
            const existingInviteSnap = await getDocs(
                query(
                    collection(db, 'projects', id, 'invitations'),
                    where('email', '==', email),
                    where('status', '==', 'pending')
                )
            )
            if (!existingInviteSnap.empty) {
                toast({
                    title:       'Already invited',
                    description: `A pending invitation already exists for ${email}.`,
                    variant:     'destructive',
                })
                setInviteLoading(false)
                return
            }

            // Generate secure random token
            const tokenArray = new Uint8Array(24)
            crypto.getRandomValues(tokenArray)
            const token = Array.from(tokenArray)
                .map(b => b.toString(16).padStart(2, '0'))
                .join('')

            // Look up invited user by email
            let targetUserId: string | null = null
            try {
                const usersSnap = await getDocs(
                    query(
                        collection(db, 'users'),
                        where('email', '==', email)
                    )
                )
                if (!usersSnap.empty) targetUserId = usersSnap.docs[0].id
            } catch { /* user may not exist yet */ }

            // Write invitation doc
            const inviteDocRef = await addDoc(
                collection(db, 'projects', id, 'invitations'),
                {
                    email,
                    role:          inviteRole,
                    invitedBy:     user.uid,
                    invitedByName: senderName,
                    invitedAt:     serverTimestamp(),
                    status:        'pending',
                    token,
                    ...(targetUserId ? { resolvedUserId: targetUserId } : {}),
                }
            )

            // Write global invite token doc
            await setDoc(doc(db, 'inviteTokens', token), {
                token,
                projectId:       id,
                projectTitle,
                role:            inviteRole,
                email,
                invitedBy:       user.uid,
                invitedByName:   senderName,
                invitationDocId: inviteDocRef.id,
                status:          'pending',
                createdAt:       serverTimestamp(),
                ...(targetUserId ? { resolvedUserId: targetUserId } : {}),
            })

            // Notify invited user if they have an account
            if (targetUserId) {
                await sendNotificationWithPush(targetUserId, {
                    title:     'Project Invitation',
                    body:      `${senderName} invited you to join "${projectTitle}" as a ${
                        inviteRole === 'viewer' ? 'Viewer' : 'Team Member'
                    }.`,
                    type:      'info',
                    url:       `/invite?token=${token}`,
                    projectId: id,
                })
            }

            // Open mail client dialog
            const mailOptions = buildInviteMailOptions({
                toEmail:      email,
                inviterName:  senderName,
                projectTitle,
                projectId:    id,
                role:         inviteRole,
                token,
            })
            setMailDialog({ open: true, options: mailOptions })

            toast({
                title:       'Invitation ready',
                description: `Invite prepared for ${email}.`,
            })
            setInviteEmail('')

        } catch (error) {
            console.error('Error preparing invitation:', error)
            toast({
                title:       'Error',
                description: 'Failed to prepare the invitation.',
                variant:     'destructive',
            })
        } finally {
            setInviteLoading(false)
        }
    }

    const handleCancelInvite = async (inviteId: string) => {
        if (!id) return
        try {
            const invDoc = invitations.find(i => i.id === inviteId)
            await deleteDoc(
                doc(db, 'projects', id, 'invitations', inviteId)
            )
            if (invDoc?.token) {
                await updateDoc(doc(db, 'inviteTokens', invDoc.token), {
                    status: 'cancelled',
                })
            }
            toast({ title: 'Invitation cancelled' })
        } catch (error) {
            console.error('Error cancelling invitation:', error)
            toast({
                title:       'Error',
                description: 'Failed to cancel invitation.',
                variant:     'destructive',
            })
        }
    }

    // ── Remove member ─────────────────────────────────────
    const confirmRemoveMember = (member: TeamMember) => {
        setRemoveDialog({
            open:       true,
            memberId:   member.id,
            memberUid:  member.uid,
            memberName: member.name,
        })
    }

    const handleRemoveMember = async () => {
        const { memberId, memberUid, memberName } = removeDialog
        if (!id || !memberId) return

        try {
            const batch = writeBatch(db)

            // ✅ Remove from members subcollection
            batch.delete(
                doc(db, 'projects', id, 'members', memberId)
            )

            // ✅ Remove from project root doc — all three fields
            batch.update(doc(db, 'projects', id), {
                [`teamMembers.${memberUid}`]: deleteField(),
                members:                      arrayRemove(memberUid),
                currentMembers:               increment(-1),
            })

            // ✅ Remove from user's joinedProjects
            batch.delete(
                doc(db, 'users', memberUid, 'joinedProjects', id)
            )

            await batch.commit()

            // ✅ Notify removed member
            await sendNotificationWithPush(memberUid, {
                title:     'Removed from Project',
                body:      `You have been removed from "${
                    project?.title ?? 'a project'
                }". Contact the project owner if you think this was a mistake.`,
                type:      'warning',
                url:       '/discover',
                projectId: id,
            })

            toast({
                title:       'Member removed',
                description: `${memberName} has been removed and notified.`,
            })

            if (selectedMember?.uid === memberUid) setSelectedMember(null)

        } catch (error) {
            console.error('Error removing member:', error)
            toast({
                title:       'Error',
                description: 'Failed to remove member.',
                variant:     'destructive',
            })
        } finally {
            setRemoveDialog({
                open: false, memberId: '', memberUid: '', memberName: '',
            })
        }
    }

    // ── Update role ───────────────────────────────────────
    const handleUpdateRole = async (
        memberId:  string,
        memberUid: string,
        newRole:   string
    ) => {
        if (!id) return
        try {
            const newPerms = getDefaultPermissions(newRole)
            const batch    = writeBatch(db)

            // ✅ Update members subcollection
            batch.update(
                doc(db, 'projects', id, 'members', memberId),
                { role: newRole, permissions: newPerms }
            )

            // ✅ Keep teamMembers map on root doc in sync
            // ✅ Always lowercase role
            batch.update(doc(db, 'projects', id), {
                [`teamMembers.${memberUid}.role`]:        newRole.toLowerCase(),
                [`teamMembers.${memberUid}.permissions`]: newPerms,
            })

            await batch.commit()

            // Update local selectedMember state if it's this member
            if (selectedMember?.id === memberId) {
                setSelectedMember(prev =>
                    prev ? { ...prev, role: newRole as TeamMember['role'], permissions: newPerms }
                         : null
                )
            }

            toast({
                title:       'Role updated',
                description: 'Member role and permissions updated.',
            })
        } catch (error) {
            console.error('Error updating role:', error)
            toast({
                title:       'Error',
                description: 'Failed to update role.',
                variant:     'destructive',
            })
        }
    }

    // ── Update permission ─────────────────────────────────
    const handleUpdatePermission = async (
        memberId: string,
        tabKey:   string,
        permType: 'read' | 'write',
        value:    boolean
    ) => {
        if (!id || !selectedMember) return
        try {
            const current = selectedMember.permissions ??
                            getDefaultPermissions(selectedMember.role)

            const updated: MemberPermissions = {
                ...current,
                [tabKey]: {
                    ...current[tabKey as keyof MemberPermissions],
                    [permType]: value,
                },
            }

            // Disabling read also disables write
            if (permType === 'read' && !value) {
                updated[tabKey as keyof MemberPermissions].write = false
            }

            await updateDoc(
                doc(db, 'projects', id, 'members', memberId),
                { permissions: updated }
            )

            setSelectedMember({ ...selectedMember, permissions: updated })

            toast({
                title:       'Permission updated',
                description: `${tabKey} ${permType} ${value ? 'enabled' : 'disabled'}.`,
            })
        } catch (error) {
            console.error('Error updating permission:', error)
            toast({
                title:       'Error',
                description: 'Failed to update permission.',
                variant:     'destructive',
            })
        }
    }

    // ── Accept application ────────────────────────────────
    const handleAcceptRequest = async (request: JoinRequest) => {
        if (!id) return

        // ✅ Guard: check if already a member (race condition prevention)
        const existingMemberSnap = await getDoc(
            doc(db, 'projects', id, 'members', request.userId)
        )
        if (existingMemberSnap.exists()) {
            toast({
                title:       'Already a member',
                description: `${request.userName || request.userEmail} is already on the team.`,
            })
            // Still mark application as accepted to clean up queue
            await updateDoc(
                doc(db, 'projects', id, 'applications', request.id),
                { status: 'accepted' }
            )
            return
        }

        try {
            const displayName  = request.userName || request.userEmail
            const defaultPerms = getDefaultPermissions('member')

            const batch = writeBatch(db)

            // ✅ Write to members subcollection
            batch.set(
                doc(db, 'projects', id, 'members', request.userId),
                {
                    uid:         request.userId,
                    name:        displayName,
                    email:       request.userEmail,
                    avatar:      request.userAvatar ?? '',
                    role:        'member',         // ✅ always lowercase
                    permissions: defaultPerms,
                    joinedAt:    serverTimestamp(),
                    joinedVia:   'application',
                }
            )

            // ✅ Update root project doc — all three fields
            // ✅ role lowercase in teamMembers map
            batch.update(doc(db, 'projects', id), {
                [`teamMembers.${request.userId}`]: {
                    role:        'member',         // ✅ lowercase (was 'Member')
                    joinedAt:    serverTimestamp(),
                    permissions: defaultPerms,
                },
                members:        arrayUnion(request.userId),
                currentMembers: increment(1),
            })

            // ✅ Write to user's joinedProjects
            batch.set(
                doc(db, 'users', request.userId, 'joinedProjects', id),
                {
                    projectId: id,
                    role:      'member',
                    joinedAt:  serverTimestamp(),
                    joinedVia: 'application',
                }
            )

            // ✅ Mark application accepted in project subcollection
            batch.update(
                doc(db, 'projects', id, 'applications', request.id),
                { status: 'accepted' }
            )

            await batch.commit()

            // ✅ Update user's own application docs
            // Do outside batch (different collection root)
            const userAppsSnap = await getDocs(
                query(
                    collection(db, 'users', request.userId, 'applications'),
                    where('projectId', '==', id)
                )
            )

            // ✅ Update ALL user application docs for this project
            // (handles edge case of multiple application attempts)
            await Promise.all(
                userAppsSnap.docs.map(appDoc =>
                    updateDoc(
                        doc(db, 'users', request.userId, 'applications', appDoc.id),
                        { status: 'accepted' }
                    )
                )
            )

            // ✅ Notify accepted member
            await sendNotificationWithPush(request.userId, {
                title:     'Application Accepted! 🎉',
                body:      `Your application to join "${
                    project?.title ?? 'a project'
                }" has been accepted! Welcome to the team.`,
                type:      'success',
                url:       `/project/${id}/dashboard`,
                projectId: id,
            })

            toast({
                title:       'Application accepted',
                description: `${displayName} added to the team.`,
            })

            // Auto-navigate to permissions tab for new member
            setActiveTab('permissions')
            setSelectedMember({
                id:          request.userId,
                uid:         request.userId,
                name:        displayName,
                email:       request.userEmail,
                avatar:      request.userAvatar,
                role:        'member',
                joinedAt:    new Date(),
                permissions: defaultPerms,
            })

        } catch (error) {
            console.error('Error accepting request:', error)
            toast({
                title:       'Error',
                description: 'Failed to accept application.',
                variant:     'destructive',
            })
        }
    }

    // ── Reject application ────────────────────────────────
    const handleRejectRequest = async (request: JoinRequest) => {
        if (!id) return
        try {
            const batch = writeBatch(db)

            // ✅ Mark rejected in project subcollection
            batch.update(
                doc(db, 'projects', id, 'applications', request.id),
                { status: 'rejected' }
            )

            await batch.commit()

            // ✅ Update user's own application docs in parallel
            const userAppsSnap = await getDocs(
                query(
                    collection(db, 'users', request.userId, 'applications'),
                    where('projectId', '==', id)
                )
            )

            await Promise.all(
                userAppsSnap.docs.map(appDoc =>
                    updateDoc(
                        doc(db, 'users', request.userId, 'applications', appDoc.id),
                        { status: 'rejected' }
                    )
                )
            )

            // ✅ Notify rejected applicant
            await sendNotificationWithPush(request.userId, {
                title:     'Application Update',
                body:      `Your application to join "${
                    project?.title ?? 'a project'
                }" was not accepted this time. Keep exploring other projects!`,
                type:      'info',
                url:       '/discover',
                projectId: id,
            })

            toast({
                title:       'Application rejected',
                description: `${request.userName || request.userEmail} notified.`,
            })
        } catch (error) {
            console.error('Error rejecting request:', error)
            toast({
                title:       'Error',
                description: 'Failed to reject application.',
                variant:     'destructive',
            })
        }
    }

    // ── Helpers ───────────────────────────────────────────
    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'owner':  return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
            case 'admin':  return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            case 'member': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            case 'viewer': return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
            default:       return ''
        }
    }

    // ── Guards ────────────────────────────────────────────
    if (loading || roleLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                Loading…
            </div>
        )
    }

    if (!canManageTeam) {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] text-center">
                    <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
                    <p className="text-muted-foreground mb-4">
                        You do not have permission to manage this team.
                    </p>
                    <Button onClick={() => navigate(`/project/${id}/dashboard`)}>
                        Return to Dashboard
                    </Button>
                </div>
            </DashboardLayout>
        )
    }

    // ── Render ────────────────────────────────────────────
    return (
        <DashboardLayout>

            {/* Remove member confirmation */}
            <AlertDialog
                open={removeDialog.open}
                onOpenChange={open =>
                    !open && setRemoveDialog(d => ({ ...d, open: false }))
                }
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove team member?</AlertDialogTitle>
                        <AlertDialogDescription>
                            <strong>{removeDialog.memberName}</strong> will immediately
                            lose access to this project and will be notified.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground"
                            onClick={handleRemoveMember}
                        >
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Mail client chooser */}
            <Dialog
                open={mailDialog.open}
                onOpenChange={open => setMailDialog(d => ({ ...d, open }))}
            >
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Mail className="h-5 w-5 text-primary" />
                            Send via your email app
                        </DialogTitle>
                        <DialogDescription>
                            Choose how you want to send the invitation email.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-2 pt-2">
                        {mailDialog.options.map(option => (
                            <Button
                                key={option.id}
                                variant={option.id === 'default' ? 'outline' : 'default'}
                                className="w-full justify-between"
                                onClick={() => {
                                    openMailClient(option)
                                    setTimeout(
                                        () => setMailDialog(d => ({ ...d, open: false })),
                                        300
                                    )
                                }}
                            >
                                <span>{option.label}</span>
                                <ExternalLink className="h-4 w-4 opacity-60" />
                            </Button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            <div className="max-w-6xl mx-auto space-y-6 p-6">

                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/project/${id}/dashboard`)}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold">Manage Team</h1>
                        <p className="text-muted-foreground">
                            Members, roles, and permissions for{' '}
                            <span className="font-medium text-foreground">
                                {project?.title}
                            </span>
                        </p>
                    </div>
                    <Badge variant="outline" className="text-sm">
                        {members.length} /{' '}
                        {project?.maxMembers || project?.teamSize || '∞'} members
                    </Badge>
                </div>

                <Tabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                    className="w-full"
                >
                    <TabsList className="grid w-full grid-cols-4 mb-6">
                        <TabsTrigger value="members" className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Members ({members.length})
                        </TabsTrigger>
                        <TabsTrigger value="invitations" className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            Invitations ({invitations.length})
                        </TabsTrigger>
                        <TabsTrigger value="applications" className="flex items-center gap-2">
                            <ClipboardList className="h-4 w-4" />
                            Applications ({joinRequests.length})
                        </TabsTrigger>
                        <TabsTrigger value="permissions" className="flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            Permissions
                        </TabsTrigger>
                    </TabsList>

                    {/* ── Members Tab ── */}
                    <TabsContent value="members" className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* Invite card */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Invite People</CardTitle>
                                    <CardDescription>
                                        Send an email invitation to join this project.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <Input
                                        type="email"
                                        placeholder="colleague@example.com"
                                        value={inviteEmail}
                                        onChange={e => setInviteEmail(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleInvite()}
                                    />
                                    <Select
                                        value={inviteRole}
                                        onValueChange={(v: 'member' | 'viewer') =>
                                            setInviteRole(v)
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="member">Member</SelectItem>
                                            <SelectItem value="viewer">Viewer</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        className="w-full"
                                        onClick={handleInvite}
                                        disabled={!inviteEmail.trim() || inviteLoading}
                                    >
                                        {inviteLoading ? (
                                            'Preparing…'
                                        ) : (
                                            <>
                                                <Mail className="h-4 w-4 mr-2" />
                                                Send Invitation
                                            </>
                                        )}
                                    </Button>
                                </CardContent>
                            </Card>

                            {/* Members list */}
                            <Card className="lg:col-span-2">
                                <CardHeader>
                                    <CardTitle className="text-lg">
                                        Team Members ({members.length})
                                    </CardTitle>
                                    <CardDescription>
                                        Click a member to edit their permissions.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {members.length === 0 ? (
                                            <p className="text-sm text-muted-foreground text-center py-8">
                                                No members yet. Invite people using the form.
                                            </p>
                                        ) : (
                                            members.map(member => (
                                                <div
                                                    key={member.id}
                                                    className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
                                                    onClick={() => {
                                                        setSelectedMember(member)
                                                        setActiveTab('permissions')
                                                    }}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Avatar>
                                                            {member.avatar && (
                                                                <AvatarImage src={member.avatar} />
                                                            )}
                                                            <AvatarFallback>
                                                                {member.name.charAt(0).toUpperCase()}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="font-medium">
                                                                {member.name}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {member.email}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {member.role !== 'owner' && (
                                                            <Select
                                                                value={member.role}
                                                                onValueChange={v =>
                                                                    handleUpdateRole(
                                                                        member.id,
                                                                        member.uid,
                                                                        v
                                                                    )
                                                                }
                                                            >
                                                                <SelectTrigger
                                                                    className="w-28 h-7 text-xs"
                                                                    onClick={e => e.stopPropagation()}
                                                                >
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="admin">
                                                                        Admin
                                                                    </SelectItem>
                                                                    <SelectItem value="member">
                                                                        Member
                                                                    </SelectItem>
                                                                    <SelectItem value="viewer">
                                                                        Viewer
                                                                    </SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        )}
                                                        <Badge
                                                            className={`${getRoleBadgeColor(member.role)} border-none`}
                                                        >
                                                            {member.role}
                                                        </Badge>
                                                        {member.role !== 'owner' && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={e => {
                                                                    e.stopPropagation()
                                                                    confirmRemoveMember(member)
                                                                }}
                                                            >
                                                                <Trash2 className="h-4 w-4 text-destructive" />
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

                    {/* ── Invitations Tab ── */}
                    <TabsContent value="invitations">
                        <Card>
                            <CardHeader>
                                <CardTitle>Pending Invitations</CardTitle>
                                <CardDescription>
                                    Invitations sent but not yet accepted.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {invitations.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <Mail className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                        <p>No pending invitations</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {invitations.map(inv => (
                                            <div
                                                key={inv.id}
                                                className="flex items-center justify-between p-3 border rounded-lg"
                                            >
                                                <div>
                                                    <p className="font-medium">{inv.email}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Invited as{' '}
                                                        <span className="capitalize">
                                                            {inv.role}
                                                        </span>
                                                        {' · '}
                                                        {inv.invitedAt.toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge
                                                        variant="outline"
                                                        className="capitalize"
                                                    >
                                                        {inv.role}
                                                    </Badge>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() =>
                                                            handleCancelInvite(inv.id)
                                                        }
                                                        title="Cancel invitation"
                                                    >
                                                        <X className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ── Applications Tab ── */}
                    <TabsContent value="applications">
                        <Card>
                            <CardHeader>
                                <CardTitle>Join Requests</CardTitle>
                                <CardDescription>
                                    Review and respond to pending applications.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {joinRequests.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                        <p>No pending applications</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {joinRequests.map(request => (
                                            <div
                                                key={request.id}
                                                className="border rounded-lg p-4 space-y-3"
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar>
                                                            {request.userAvatar && (
                                                                <AvatarImage
                                                                    src={request.userAvatar}
                                                                />
                                                            )}
                                                            <AvatarFallback>
                                                                {(
                                                                    request.userName ||
                                                                    request.userEmail
                                                                )
                                                                    .charAt(0)
                                                                    .toUpperCase()}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <h4 className="font-semibold">
                                                                {request.userName ||
                                                                    request.userEmail}
                                                            </h4>
                                                            <p className="text-sm text-muted-foreground">
                                                                {request.userEmail}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            size="sm"
                                                            onClick={() =>
                                                                handleAcceptRequest(request)
                                                            }
                                                        >
                                                            Accept
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() =>
                                                                handleRejectRequest(request)
                                                            }
                                                        >
                                                            Reject
                                                        </Button>
                                                    </div>
                                                </div>
                                                {request.motivation && (
                                                    <p className="text-sm text-muted-foreground bg-muted/50 rounded p-2">
                                                        "{request.motivation}"
                                                    </p>
                                                )}
                                                {request.position && (
                                                    <p className="text-xs text-muted-foreground">
                                                        Position: {request.position}
                                                    </p>
                                                )}
                                                {request.skills && (
                                                    <p className="text-xs text-muted-foreground">
                                                        Skills: {request.skills}
                                                    </p>
                                                )}
                                                {request.timeCommitment && (
                                                    <p className="text-xs text-muted-foreground">
                                                        Time commitment: {request.timeCommitment}
                                                    </p>
                                                )}
                                                <p className="text-xs text-muted-foreground">
                                                    Applied:{' '}
                                                    {request.appliedAt.toLocaleDateString()}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ── Permissions Tab ── */}
                    <TabsContent value="permissions">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* Member selector */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Select Member</CardTitle>
                                    <CardDescription>
                                        Choose a member to edit their permissions.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-1">
                                        {members.length === 0 ? (
                                            <p className="text-sm text-muted-foreground text-center py-4">
                                                No members yet.
                                            </p>
                                        ) : (
                                            members.map(member => (
                                                <div
                                                    key={member.id}
                                                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                                                        selectedMember?.id === member.id
                                                            ? 'bg-primary/10 text-primary'
                                                            : 'hover:bg-accent/50'
                                                    }`}
                                                    onClick={() => setSelectedMember(member)}
                                                >
                                                    <Avatar className="h-7 w-7">
                                                        {member.avatar && (
                                                            <AvatarImage src={member.avatar} />
                                                        )}
                                                        <AvatarFallback className="text-xs">
                                                            {member.name.charAt(0).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium truncate">
                                                            {member.name}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground capitalize">
                                                            {member.role}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Permission toggles */}
                            <Card className="lg:col-span-2">
                                <CardHeader>
                                    <CardTitle>
                                        {selectedMember
                                            ? `Permissions — ${selectedMember.name}`
                                            : 'Permissions'}
                                    </CardTitle>
                                    <CardDescription>
                                        {selectedMember
                                            ? 'Toggle read/write access per feature.'
                                            : 'Select a member from the left to edit permissions.'}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {!selectedMember ? (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <Shield className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                            <p>No member selected</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {/* Header row */}
                                            <div className="flex items-center justify-between px-3 pb-2 text-xs text-muted-foreground font-medium">
                                                <span>Feature</span>
                                                <div className="flex gap-8 pr-1">
                                                    <span>Read</span>
                                                    <span>Write</span>
                                                </div>
                                            </div>

                                            {PERMISSION_TABS.map(tab => {
                                                const perms =
                                                    selectedMember.permissions?.[
                                                        tab.key as keyof MemberPermissions
                                                    ] ?? { read: false, write: false }
                                                const Icon    = tab.icon
                                                const isOwner = selectedMember.role === 'owner'

                                                return (
                                                    <div
                                                        key={tab.key}
                                                        className="flex items-center justify-between p-3 border rounded-lg"
                                                    >
                                                        <div className="flex items-center gap-2 text-sm">
                                                            <Icon className="h-4 w-4 text-muted-foreground" />
                                                            {tab.label}
                                                        </div>
                                                        <div className="flex gap-8">
                                                            <Switch
                                                                checked={perms.read}
                                                                disabled={isOwner}
                                                                onCheckedChange={v =>
                                                                    handleUpdatePermission(
                                                                        selectedMember.id,
                                                                        tab.key,
                                                                        'read',
                                                                        v
                                                                    )
                                                                }
                                                            />
                                                            <Switch
                                                                checked={perms.write}
                                                                disabled={
                                                                    isOwner || !perms.read
                                                                }
                                                                onCheckedChange={v =>
                                                                    handleUpdatePermission(
                                                                        selectedMember.id,
                                                                        tab.key,
                                                                        'write',
                                                                        v
                                                                    )
                                                                }
                                                            />
                                                        </div>
                                                    </div>
                                                )
                                            })}
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
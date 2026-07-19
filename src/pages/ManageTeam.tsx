import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import {
    Card, CardContent, CardHeader,
    CardTitle, CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
    Clock, AlertTriangle, Zap, Loader2,
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
import { trackTeammateInvited, trackTeamFormed, trackApplicationResolved } from '@/services/analyticsService'

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
    coverLetter?:   string
    customMessage?: string
    timeCommitment: string
    appliedAt:      Date
    status:         'pending' | 'applied' | 'viewed' | 'shortlisted' | 'interviewing' | 'accepted' | 'rejected'
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
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
    const [members,       setMembers]       = useState<TeamMember[]>([])
    const [invitations,   setInvitations]   = useState<Invitation[]>([])
    const [joinRequests,  setJoinRequests]  = useState<JoinRequest[]>([])
    const [selectedMember,setSelectedMember]= useState<TeamMember | null>(null)
    const [searchParams] = useSearchParams()
    const initialTab = searchParams.get('tab') || 'members'
    const [activeTab,     setActiveTab]     = useState(initialTab)

    const [removeDialog, setRemoveDialog] = useState<{
        open:       boolean
        memberId:   string
        memberUid:  string
        memberName: string
    }>({ open: false, memberId: '', memberUid: '', memberName: '' })

    const [removalReason, setRemovalReason] = useState('')

    const [mailDialog, setMailDialog] = useState<{
        open:    boolean
        options: MailClientOption[]
    }>({ open: false, options: [] })

    const [emailPromptOpen, setEmailPromptOpen] = useState(false)
    const [pendingAction, setPendingAction] = useState<{
        type: 'status' | 'accept'
        request: JoinRequest
        newStatus?: 'shortlisted' | 'interviewing' | 'rejected'
    } | null>(null)

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

        // Pending/active applications list
        unsubs.push(
            onSnapshot(
                query(
                    collection(db, 'projects', id, 'applications'),
                    where('status', 'in', ['pending', 'applied', 'viewed', 'shortlisted', 'interviewing'])
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
                            coverLetter:    data.coverLetter    || '',
                            customMessage:  data.customMessage  || '',
                            timeCommitment: data.timeCommitment || '',
                            appliedAt:      data.appliedAt?.toDate() ?? new Date(),
                            status:         data.status,
                            statusHistory:  data.statusHistory  || [],
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

    // ✅ Auto-mark applications as viewed when owner views them
    useEffect(() => {
        if (!id || !user || activeTab !== 'applications' || joinRequests.length === 0) return

        const appliedRequests = joinRequests.filter(r => r.status === 'applied')
        if (appliedRequests.length === 0) return

        appliedRequests.forEach(async (request) => {
            try {
                const statusEntry = {
                    status: 'viewed',
                    timestamp: new Date(),
                    changedBy: user.uid
                }

                // Update project side
                await updateDoc(doc(db, 'projects', id, 'applications', request.id), {
                    status: 'viewed',
                    statusHistory: arrayUnion(statusEntry)
                })

                // Update applicant side
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
                            {
                                status: 'viewed',
                                statusHistory: arrayUnion(statusEntry)
                            }
                        )
                    )
                )
            } catch (err) {
                console.error('Error auto-marking application as viewed:', err)
            }
        })
    }, [activeTab, joinRequests, id, user])

    // ✅ Fire stale-application alerts when owner visits the Applications tab
    // Triggers for any application pending 5+ days that hasn't been alerted this session
    useEffect(() => {
        if (!id || !user || activeTab !== 'applications' || joinRequests.length === 0) return

        const STALE_DAYS = 5
        const SESSION_KEY = `stale-alerts-${id}`
        const alreadyAlerted = new Set<string>(
            JSON.parse(sessionStorage.getItem(SESSION_KEY) || '[]')
        )

        const staleRequests = joinRequests.filter(r => {
            const activeStatuses = ['applied', 'viewed', 'pending']
            if (!activeStatuses.includes(r.status)) return false
            const daysPending = Math.floor((Date.now() - r.appliedAt.getTime()) / (1000 * 60 * 60 * 24))
            return daysPending >= STALE_DAYS && !alreadyAlerted.has(r.id)
        })

        if (staleRequests.length === 0) return

        const newAlerted = [...alreadyAlerted]
        staleRequests.forEach(async (request) => {
            try {
                await import('@/services/notificationTrigger').then(({ triggerStaleApplicationAlert }) =>
                    triggerStaleApplicationAlert(user.uid, request.userId, id, request.id)
                )
                newAlerted.push(request.id)
            } catch (err) {
                console.warn('[ManageTeam] Failed to send stale alert for', request.id, err)
            }
        })

        // Persist alerted IDs for this session so we don't spam
        try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(newAlerted)) } catch { /* quota */ }
    }, [activeTab, joinRequests, id, user])

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
            trackTeammateInvited(user.uid, id, targetUserId || email)

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

        // ── Optimistic update: remove invitation card immediately ─────────────
        const previousInvitations = invitations
        setInvitations(prev => prev.filter(i => i.id !== inviteId))

        try {
            const invDoc = previousInvitations.find(i => i.id === inviteId)
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
            // ── Rollback ──────────────────────────────────────────────────────
            setInvitations(previousInvitations)
            console.error('Error cancelling invitation:', error)
            toast({
                title:       "Changes couldn't be saved.",
                description: 'Failed to cancel invitation. Please try again.',
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

        // ── Optimistic update: remove member row + decrement count instantly ──
        const previousMembers = members
        const previousProject = project
        setMembers(prev => prev.filter(m => m.id !== memberId))
        if (project) {
            setProject((prev: any) => prev
                ? { ...prev, currentMembers: Math.max(0, (prev.currentMembers ?? 1) - 1) }
                : prev
            )
        }
        if (selectedMember?.uid === memberUid) setSelectedMember(null)

        // Close dialog immediately so UX feels responsive
        setRemoveDialog({ open: false, memberId: '', memberUid: '', memberName: '' })
        setRemovalReason('')

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

            // ✅ Notify removed member (fire-and-forget, non-blocking)
            sendNotificationWithPush(memberUid, {
                title:     'Removed from Project',
                body:      `You have been removed from "${
                    project?.title ?? 'a project'
                }". Reason: "${removalReason.trim()}". Contact the project owner if you think this was a mistake.`,
                type:      'warning',
                url:       '/discover',
                projectId: id,
            }).catch(err => console.warn('[ManageTeam] notify removed member failed:', err))

            toast({
                title:       'Member removed',
                description: `${memberName} has been removed and notified.`,
            })

        } catch (error) {
            // ── Rollback ──────────────────────────────────────────────────────
            setMembers(previousMembers)
            setProject(previousProject)
            console.error('Error removing member:', error)
            toast({
                title:       "Changes couldn't be saved.",
                description: 'Failed to remove member. Please try again.',
                variant:     'destructive',
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

    const handleGrantAllPermissions = async (memberId: string, grantAll: boolean) => {
        if (!id || !selectedMember) return
        try {
            const updated: MemberPermissions = {} as MemberPermissions
            PERMISSION_TABS.forEach(tab => {
                updated[tab.key as keyof MemberPermissions] = {
                    read: grantAll,
                    write: grantAll
                }
            })

            await updateDoc(
                doc(db, 'projects', id, 'members', memberId),
                { permissions: updated }
            )

            setSelectedMember({ ...selectedMember, permissions: updated })

            toast({
                title:       'Permissions updated',
                description: grantAll ? 'Granted all read/write permissions.' : 'Revoked all permissions.',
            })
        } catch (error) {
            console.error('Error updating all permissions:', error)
            toast({
                title:       'Error',
                description: 'Failed to update permissions.',
                variant:     'destructive',
            })
        }
    }

    // ── Update status DB operations ──────────────────────────────────────
    const performStatusUpdate = async (
        request: JoinRequest, 
        newStatus: 'shortlisted' | 'interviewing' | 'rejected'
    ) => {
        if (!id || !user) return

        // ── Optimistic update: update applicant status badge instantly ────────
        const previousJoinRequests = joinRequests
        setJoinRequests(prev => prev.map(r =>
            r.id === request.id ? { ...r, status: newStatus } : r
        ))

        try {
            const statusEntry = {
                status: newStatus,
                timestamp: new Date(),
                changedBy: user.uid
            }

            // 1. Update project side
            await updateDoc(
                doc(db, 'projects', id, 'applications', request.id),
                {
                    status: newStatus,
                    statusHistory: arrayUnion(statusEntry)
                }
            )

            // Track application resolution
            trackApplicationResolved(user.uid, request.userId, id, newStatus)

            // 2. Update user side (fire-and-forget — applicant's own view)
            getDocs(query(
                collection(db, 'users', request.userId, 'applications'),
                where('projectId', '==', id)
            )).then(userAppsSnap =>
                Promise.all(userAppsSnap.docs.map(appDoc =>
                    updateDoc(
                        doc(db, 'users', request.userId, 'applications', appDoc.id),
                        { status: newStatus, statusHistory: arrayUnion(statusEntry) }
                    )
                ))
            ).catch(err => console.warn('[ManageTeam] user-side status sync failed:', err))

            // 3. Send notification (fire-and-forget)
            let title = 'Application Update'
            let body = `Your application to join "${project?.title || 'project'}" has been updated.`
            let type: 'info' | 'success' | 'warning' = 'info'
            
            if (newStatus === 'shortlisted') {
                title = '🎉 Application Shortlisted!'
                body = `Good news! Your application for "${project?.title}" has been shortlisted.`
                type = 'success'
            } else if (newStatus === 'interviewing') {
                title = '🤝 Interview Invited!'
                body = `The owner of "${project?.title}" wants to schedule an interview with you.`
                type = 'success'
            } else if (newStatus === 'rejected') {
                title = 'Application Update'
                body = `Your application to join "${project?.title}" was not accepted this time.`
                type = 'warning'
            }

            sendNotificationWithPush(request.userId, {
                title,
                body,
                type,
                url: '/dashboard/applications',
                projectId: id,
            }).catch(err => console.warn('[ManageTeam] notify status update failed:', err))

            toast({
                title: `Application ${newStatus}`,
                description: `${request.userName || request.userEmail} notified.`,
            })
        } catch (error) {
            // ── Rollback ──────────────────────────────────────────────────────
            setJoinRequests(previousJoinRequests)
            console.error(`Error updating application to ${newStatus}:`, error)
            toast({
                title: "Changes couldn't be saved.",
                description: 'Failed to update application status. Please try again.',
                variant: 'destructive',
            })
        }
    }

    const performAcceptRequest = async (request: JoinRequest) => {
        if (!id || !user) return

        // Guard: check if already a member (blocking — prevents duplicates)
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

        const displayName  = request.userName || request.userEmail
        const defaultPerms = getDefaultPermissions('member')
        const statusEntry  = {
            status:    'accepted',
            timestamp: new Date(),
            changedBy: user.uid
        }

        // ── Optimistic update: remove applicant from queue + add to members + increment count ──
        const previousJoinRequests = joinRequests
        const previousMembers      = members
        const previousProject      = project

        const optimisticMember: TeamMember = {
            id:          request.userId,
            uid:         request.userId,
            name:        displayName,
            email:       request.userEmail,
            avatar:      request.userAvatar,
            role:        'member',
            joinedAt:    new Date(),
            permissions: defaultPerms,
        }

        setJoinRequests(prev => prev.filter(r => r.id !== request.id))
        setMembers(prev => [...prev, optimisticMember])
        if (project) {
            setProject((prev: any) => prev
                ? { ...prev, currentMembers: (prev.currentMembers ?? 1) + 1 }
                : prev
            )
        }

        try {
            const batch = writeBatch(db)

            // 1. Write to members subcollection
            batch.set(
                doc(db, 'projects', id, 'members', request.userId),
                {
                    uid:         request.userId,
                    name:        displayName,
                    email:       request.userEmail,
                    avatar:      request.userAvatar ?? '',
                    role:        'member',
                    permissions: defaultPerms,
                    joinedAt:    serverTimestamp(),
                    joinedVia:   'application',
                }
            )

            // 2. Update root project doc
            batch.update(doc(db, 'projects', id), {
                [`teamMembers.${request.userId}`]: {
                    role:        'member',
                    joinedAt:    serverTimestamp(),
                    permissions: defaultPerms,
                },
                members:        arrayUnion(request.userId),
                currentMembers: increment(1),
            })

            // 3. Write to user's joinedProjects
            batch.set(
                doc(db, 'users', request.userId, 'joinedProjects', id),
                {
                    projectId: id,
                    role:      'member',
                    joinedAt:  serverTimestamp(),
                    joinedVia: 'application',
                }
            )

            // 4. Mark application accepted and update history
            batch.update(
                doc(db, 'projects', id, 'applications', request.id),
                { status: 'accepted', statusHistory: arrayUnion(statusEntry) }
            )

            await batch.commit()

            // Track application resolution
            trackApplicationResolved(user.uid, request.userId, id, 'accepted')

            // Track team formed event
            const newTeamSize = (previousProject?.currentMembers || 1) + 1
            if (newTeamSize >= 2) {
                trackTeamFormed(user.uid, id, newTeamSize)
                updateDoc(doc(db, 'projects', id), {
                    functionalDuoAt: serverTimestamp()
                }).catch(() => {})
            }

            // 5. Update user's applications subcollection (fire-and-forget)
            getDocs(query(
                collection(db, 'users', request.userId, 'applications'),
                where('projectId', '==', id)
            )).then(userAppsSnap =>
                Promise.all(userAppsSnap.docs.map(appDoc =>
                    updateDoc(
                        doc(db, 'users', request.userId, 'applications', appDoc.id),
                        { status: 'accepted', statusHistory: arrayUnion(statusEntry) }
                    )
                ))
            ).catch(err => console.warn('[ManageTeam] user-side accept sync failed:', err))

            // 6. Notify accepted member (fire-and-forget)
            sendNotificationWithPush(request.userId, {
                title:     'Application Accepted!',
                body:      `Your application to join "${
                    project?.title ?? 'a project'
                }" has been accepted! Welcome to the team.`,
                type:      'success',
                url:       `/project/${id}/dashboard`,
                projectId: id,
            }).catch(err => console.warn('[ManageTeam] notify accept failed:', err))

            toast({
                title:       'Application accepted',
                description: `${displayName} added to the team.`,
            })

            // Auto-navigate to permissions tab for new member
            setActiveTab('permissions')
            setSelectedMember(optimisticMember)

        } catch (error) {
            // ── Rollback all three slices ─────────────────────────────────────
            setJoinRequests(previousJoinRequests)
            setMembers(previousMembers)
            setProject(previousProject)
            console.error('Error accepting request:', error)
            toast({
                title:       "Changes couldn't be saved.",
                description: 'Failed to accept application. Please try again.',
                variant:     'destructive',
            })
        }
    }

    // ── Update status for shortlist/interview/reject ─────────────────────
    const handleUpdateStatus = (
        request: JoinRequest, 
        newStatus: 'shortlisted' | 'interviewing' | 'rejected'
    ) => {
        setPendingAction({ type: 'status', request, newStatus })
        setEmailPromptOpen(true)
    }

    // ── Accept application ────────────────────────────────
    const handleAcceptRequest = (request: JoinRequest) => {
        setPendingAction({ type: 'accept', request })
        setEmailPromptOpen(true)
    }

    const handleEmailChoice = async (client: 'gmail' | 'outlook' | 'default' | 'skip') => {
        if (!pendingAction) return
        const { type, request, newStatus } = pendingAction

        setActionLoadingId(request.id)

        // 1. First run the database updates
        if (type === 'status' && newStatus) {
            await performStatusUpdate(request, newStatus)
        } else if (type === 'accept') {
            await performAcceptRequest(request)
        }

        setActionLoadingId(null)

        // 2. Open email client if not skipped
        if (client !== 'skip') {
            const ownerName = user?.displayName || user?.email || 'Project Lead'
            const projectTitle = project?.title || 'our project'
            const recipientName = request.userName || 'Collaborator'
            let emailSubject = ''
            let emailBody = ''

            if (type === 'status' && newStatus) {
                if (newStatus === 'shortlisted') {
                    emailSubject = `Update on your application for ${projectTitle}`
                    emailBody = `Hi ${recipientName},\n\nWe have reviewed your application to join "${projectTitle}" and have shortlisted you for the team! We will be in touch soon with next steps.\n\nBest regards,\n${ownerName}\n${projectTitle} Team`
                } else if (newStatus === 'interviewing') {
                    emailSubject = `Invitation to interview for ${projectTitle}`
                    emailBody = `Hi ${recipientName},\n\nWe would love to invite you for an interview regarding your application to join "${projectTitle}".\n\nPlease let us know your availability over the next few days.\n\nBest regards,\n${ownerName}\n${projectTitle} Team`
                } else if (newStatus === 'rejected') {
                    emailSubject = `Update on your application for ${projectTitle}`
                    emailBody = `Hi ${recipientName},\n\nThank you for your interest in "${projectTitle}" and for taking the time to apply.\n\nUnfortunately, we have decided to go in a different direction for this role. We wish you the best of luck in your search.\n\nBest regards,\n${ownerName}\n${projectTitle} Team`
                }
            } else if (type === 'accept') {
                const displayName = request.userName || request.userEmail
                emailSubject = `Application Accepted: Welcome to ${projectTitle}!`
                emailBody = `Hi ${displayName},\n\nCongratulations! Your application to join "${projectTitle}" has been accepted. Welcome to the team!\n\nYou now have access to the project dashboard.\n\nBest regards,\n${ownerName}\n${projectTitle} Team`
            }

            if (emailSubject && emailBody) {
                let url = ''
                if (client === 'gmail') {
                    url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(request.userEmail)}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`
                } else if (client === 'outlook') {
                    url = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(request.userEmail)}&subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`
                } else {
                    url = `mailto:${request.userEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`
                }
                window.open(url, '_blank')
            }
        }

        // Close modal and clear pending action
        setEmailPromptOpen(false)
        setPendingAction(null)
    }


    // ── Helpers ───────────────────────────────────────────

    /** Returns how many calendar days ago this date was */
    const getDaysAgo = (date: Date): number =>
        Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))

    /** Color token for application age badge */
    const getAgeBadgeStyle = (days: number): string => {
        if (days <= 1) return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800'
        if (days <= 4) return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800'
        return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800'
    }

    const getAppStatusColor = (status: string) => {
        switch (status) {
            case 'applied':
            case 'pending':
                return 'bg-blue-50 text-blue-700 border-blue-250/30 dark:bg-blue-950/20 dark:text-blue-400'
            case 'viewed':
                return 'bg-purple-50 text-purple-700 border-purple-250/30 dark:bg-purple-950/20 dark:text-purple-400'
            case 'shortlisted':
                return 'bg-amber-50 text-amber-700 border-amber-250/30 dark:bg-amber-950/20 dark:text-amber-400'
            case 'interviewing':
                return 'bg-cyan-50 text-cyan-700 border-cyan-255/30 dark:bg-cyan-950/20 dark:text-cyan-400'
            default:
                return 'bg-gray-100 text-gray-750'
        }
    }

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

            {/* Email client selection prompt dialog */}
            <Dialog open={emailPromptOpen} onOpenChange={setEmailPromptOpen}>
                <DialogContent className="max-w-md bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-xl p-6">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="text-lg font-bold text-gray-900 dark:text-zinc-100">
                            Send Email Notification?
                        </DialogTitle>
                        <DialogDescription className="text-sm text-gray-500 dark:text-zinc-400">
                            Choose how you would like to send an email to{' '}
                            <span className="font-semibold text-gray-700 dark:text-zinc-300">
                                {pendingAction?.request?.userName || pendingAction?.request?.userEmail}
                            </span>{' '}
                            for this application update.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 gap-2.5">
                        <Button
                            variant="outline"
                            className="flex items-center gap-3.5 h-12 px-4 hover:bg-gray-50 dark:hover:bg-zinc-800 border-gray-200 dark:border-zinc-850 rounded-lg justify-between"
                            onClick={() => handleEmailChoice('gmail')}
                        >
                            <span className="flex items-center gap-3">
                                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M20 4H4C2.9 4 2.01 4.9 2.01 6L2 18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 8L12 13L4 8V6L12 11L20 6V8Z" fill="#EA4335" />
                                </svg>
                                <span className="font-medium text-sm text-gray-800 dark:text-zinc-200">Compose in Gmail (Web)</span>
                            </span>
                            <ExternalLink className="h-4 w-4 text-gray-400" />
                        </Button>

                        <Button
                            variant="outline"
                            className="flex items-center gap-3.5 h-12 px-4 hover:bg-gray-50 dark:hover:bg-zinc-800 border-gray-200 dark:border-zinc-850 rounded-lg justify-between"
                            onClick={() => handleEmailChoice('outlook')}
                        >
                            <span className="flex items-center gap-3">
                                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M20.5 2H3.5C2.67 2 2 2.67 2 3.5V20.5C2 21.33 2.67 22 3.5 22H20.5C21.33 22 22 21.33 22 20.5V3.5C22 2.67 21.33 2 20.5 2Z" fill="#0078D4"/>
                                    <path d="M17.5 7H6.5C5.67 7 5 7.67 5 8.5V15.5C5 16.33 5.67 17 6.5 17H17.5C18.33 17 19 16.33 19 15.5V8.5C19 7.67 18.33 7 17.5 7ZM17.5 10L12 13.5L6.5 10V8.5L12 12L17.5 8.5V10Z" fill="white"/>
                                </svg>
                                <span className="font-medium text-sm text-gray-800 dark:text-zinc-200">Compose in Outlook (Web)</span>
                            </span>
                            <ExternalLink className="h-4 w-4 text-gray-400" />
                        </Button>

                        <Button
                            variant="outline"
                            className="flex items-center gap-3.5 h-12 px-4 hover:bg-gray-50 dark:hover:bg-zinc-800 border-gray-200 dark:border-zinc-850 rounded-lg justify-between"
                            onClick={() => handleEmailChoice('default')}
                        >
                            <span className="flex items-center gap-3">
                                <Mail className="h-5 w-5 text-gray-550 dark:text-zinc-400" />
                                <span className="font-medium text-sm text-gray-800 dark:text-zinc-200">Open Default Mail Client</span>
                            </span>
                            <ExternalLink className="h-4 w-4 text-gray-400" />
                        </Button>

                        <div className="border-t border-gray-150 dark:border-zinc-800 my-2 pt-2.5 flex gap-2">
                            <Button
                                variant="ghost"
                                className="flex-1 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
                                onClick={() => handleEmailChoice('skip')}
                            >
                                Skip & Save Status
                            </Button>
                            <Button
                                variant="ghost"
                                className="text-red-500 hover:text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20"
                                onClick={() => {
                                    setEmailPromptOpen(false)
                                    setPendingAction(null)
                                }}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Remove member confirmation */}
            <Dialog
                open={removeDialog.open}
                onOpenChange={open => {
                    if (!open) {
                        setRemoveDialog(d => ({ ...d, open: false }))
                        setRemovalReason('')
                    }
                }}
            >
                <DialogContent className="max-w-md bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-xl p-6">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="text-lg font-bold text-gray-900 dark:text-zinc-105">
                            Remove team member?
                        </DialogTitle>
                        <DialogDescription className="text-sm text-gray-500 dark:text-zinc-400">
                            <strong>{removeDialog.memberName}</strong> will immediately
                            lose access to this project and will be notified.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                                Reason for removal <span className="text-red-500">*</span>
                            </label>
                            <Textarea
                                placeholder="Please explain why this team member is being removed..."
                                value={removalReason}
                                onChange={e => setRemovalReason(e.target.value)}
                                className="min-h-[100px] bg-zinc-50 dark:bg-zinc-950 border-gray-200 dark:border-zinc-850"
                                required
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-150 dark:border-zinc-800">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setRemoveDialog(d => ({ ...d, open: false }))
                                setRemovalReason('')
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleRemoveMember}
                            disabled={!removalReason.trim()}
                        >
                            Remove Member
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>


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
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
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
                    <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-6">
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
                                                                {(member.name || 'U').charAt(0).toUpperCase()}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <p className="font-medium">
                                                                    {member.name}
                                                                </p>
                                                                <Badge
                                                                    className={`${getRoleBadgeColor(member.role)} border-none text-[9px] px-1.5 py-0 font-semibold rounded-md capitalize shrink-0`}
                                                                >
                                                                    {member.role}
                                                                </Badge>
                                                            </div>
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
                                    Review and manage the status of project applications.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {/* ── Stale Application Nudge Banner ── */}
                                {(() => {
                                    const staleCount = joinRequests.filter(r => {
                                        const active = ['applied', 'viewed', 'pending']
                                        return active.includes(r.status) && getDaysAgo(r.appliedAt) >= 2
                                    }).length
                                    if (staleCount === 0) return null
                                    return (
                                        <div className="mb-4 flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                                            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                                                    {staleCount} application{staleCount > 1 ? 's' : ''} waiting for your response
                                                </p>
                                                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                                                    Applicants who wait longer than 48h are more likely to lose interest. Review now to keep your team forming fast.
                                                </p>
                                            </div>
                                            <Zap className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                        </div>
                                    )
                                })()}

                                {joinRequests.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                        <p>No active applications</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {joinRequests.map(request => {
                                            const status = request.status || 'applied'
                                            return (
                                                <div
                                                    key={request.id}
                                                    className="border rounded-xl p-4 space-y-4 bg-white dark:bg-zinc-900 shadow-sm"
                                                >
                                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                                        <div className="flex items-center gap-3">
                                                            <Avatar className="h-10 w-10">
                                                                {request.userAvatar && (
                                                                    <AvatarImage
                                                                        src={request.userAvatar}
                                                                    />
                                                                )}
                                                                <AvatarFallback>
                                                                    {(
                                                                        request.userName ||
                                                                        request.userEmail ||
                                                                        'U'
                                                                    )
                                                                        .charAt(0)
                                                                        .toUpperCase()}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div>
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <h4 className="font-semibold text-sm">
                                                                        {request.userName ||
                                                                            request.userEmail}
                                                                    </h4>
                                                                    <Badge
                                                                        variant="outline"
                                                                        className={`capitalize text-[10px] font-semibold px-2 py-0.5 border ${getAppStatusColor(status)}`}
                                                                    >
                                                                        {status}
                                                                    </Badge>
                                                                </div>
                                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                                    {request.userEmail}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            {/* Shortlist trigger */}
                                                            {(status === 'applied' || status === 'viewed' || status === 'pending') && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-8 text-xs border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                                                                    disabled={actionLoadingId === request.id}
                                                                    onClick={() => handleUpdateStatus(request, 'shortlisted')}
                                                                >
                                                                    {actionLoadingId === request.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Shortlist'}
                                                                </Button>
                                                            )}
                                                            {/* Interview trigger */}
                                                            {(status === 'applied' || status === 'viewed' || status === 'pending' || status === 'shortlisted') && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-8 text-xs border-cyan-200 text-cyan-700 hover:bg-cyan-50 hover:text-cyan-800"
                                                                    disabled={actionLoadingId === request.id}
                                                                    onClick={() => handleUpdateStatus(request, 'interviewing')}
                                                                >
                                                                    {actionLoadingId === request.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Invite to Interview'}
                                                                </Button>
                                                            )}
                                                            {/* Accept trigger */}
                                                            <Button
                                                                size="sm"
                                                                className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white font-medium"
                                                                disabled={actionLoadingId === request.id}
                                                                onClick={() => handleAcceptRequest(request)}
                                                            >
                                                                {actionLoadingId === request.id
                                                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                                                    : 'Accept'
                                                                }
                                                            </Button>
                                                            {/* Reject trigger */}
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-8 text-xs text-red-600 hover:bg-red-50 hover:text-red-750 border-red-200/50"
                                                                disabled={actionLoadingId === request.id}
                                                                onClick={() => handleUpdateStatus(request, 'rejected')}
                                                            >
                                                                {actionLoadingId === request.id
                                                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                                                    : 'Reject'
                                                                }
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    {/* Cover Letter & customMessage Details */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                                        {request.coverLetter && (
                                                            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/40 p-3 border">
                                                                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 block mb-1">Cover Letter</span>
                                                                <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                                                                    {request.coverLetter}
                                                                </p>
                                                            </div>
                                                        )}
                                                        {request.customMessage && (
                                                            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/40 p-3 border">
                                                                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 block mb-1">Message to Team</span>
                                                                <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                                                                    {request.customMessage}
                                                                </p>
                                                            </div>
                                                        )}
                                                        {!request.coverLetter && !request.customMessage && request.motivation && (
                                                            <div className="col-span-full rounded-lg bg-zinc-50 dark:bg-zinc-800/40 p-3 border">
                                                                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 block mb-1">Motivation Letter</span>
                                                                <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                                                                    {request.motivation}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-dashed flex-wrap gap-y-1">
                                                        <span>
                                                            Position: <strong className="text-foreground">{request.position || 'Any'}</strong>
                                                        </span>
                                                        {request.skills && (
                                                            <span className="truncate max-w-[40%]">
                                                                Skills: <strong className="text-foreground">{request.skills}</strong>
                                                            </span>
                                                        )}
                                                        {request.timeCommitment && (
                                                            <span>
                                                                Commitment: <strong className="text-foreground">{request.timeCommitment}</strong>
                                                            </span>
                                                        )}
                                                        {/* Application age badge */}
                                                        {(() => {
                                                            const days = getDaysAgo(request.appliedAt)
                                                            const isActive = ['applied', 'viewed', 'pending'].includes(status)
                                                            if (!isActive) return (
                                                                <span>Applied: {request.appliedAt.toLocaleDateString()}</span>
                                                            )
                                                            return (
                                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-semibold ${getAgeBadgeStyle(days)}`}>
                                                                    <Clock className="h-2.5 w-2.5" />
                                                                    {days === 0 ? 'Today' : days === 1 ? '1 day ago' : `${days} days pending`}
                                                                </span>
                                                            )
                                                        })()}
                                                    </div>
                                                </div>
                                            )
                                        })}
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
                                                            {(member.name || 'U').charAt(0).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <p className="text-sm font-medium truncate max-w-[100px]" title={member.name}>
                                                                {member.name}
                                                            </p>
                                                            <Badge
                                                                className={`${getRoleBadgeColor(member.role)} border-none text-[8px] px-1 py-0 font-semibold rounded-md capitalize shrink-0`}
                                                            >
                                                                {member.role}
                                                            </Badge>
                                                        </div>
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
                                            {/* All permissions row */}
                                            {selectedMember.role !== 'owner' && (
                                                <div className="flex items-center justify-between p-3 border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/10 dark:bg-indigo-950/10 rounded-lg mb-3">
                                                    <div className="flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400">
                                                        <Shield className="h-4 w-4" />
                                                        All Permissions (Read & Write)
                                                    </div>
                                                    <Switch
                                                        checked={PERMISSION_TABS.every(tab => {
                                                            const p = selectedMember.permissions?.[tab.key as keyof MemberPermissions]
                                                            return p?.read && p?.write
                                                        })}
                                                        onCheckedChange={v => handleGrantAllPermissions(selectedMember.id, v)}
                                                    />
                                                </div>
                                            )}

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
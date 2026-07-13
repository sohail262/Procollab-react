import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ApplicationModal } from '@/components/ApplicationModal'
import {
    Calendar, Users, Clock, MapPin, CheckCircle,
    MessageSquare, MessageCircle, Share2, Flag, ChevronLeft, Loader2,
    Check, X, FileText, Info, Copy, Twitter, Link, Mail
} from 'lucide-react'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    doc, getDoc, collection, query, where, limit,
    getDocs, addDoc, deleteDoc, serverTimestamp,
    updateDoc, increment, Timestamp, writeBatch,
    onSnapshot, arrayUnion,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getTagColorClass } from '@/lib/utils'
import { sendNotificationWithPush } from '@/services/notificationTrigger'
import {
    buildReportOwnerNotif,
    buildReportAdminNotif,
    notifyAdmins,
    buildWithdrawOwnerNotif,
} from '@/services/notificationService'
import { useToast } from '@/hooks/use-toast'
import { EMPTY_MEMBER_PERMISSIONS } from '@/hooks/use-permissions'
import { trackProjectViewed, trackProjectApplied, trackTeamFormed } from '@/services/analyticsService'

// ─────────────────────────────────────────────────────────
// Label maps
// ─────────────────────────────────────────────────────────

const disciplineLabels: Record<string, string> = {
    'computer-science': 'Computer Science',
    'engineering':      'Engineering',
    'medicine':         'Medicine & Health',
    'business':         'Business & Economics',
    'arts':             'Arts & Humanities',
    'social-sciences':  'Social Sciences',
    'natural-sciences': 'Natural Sciences',
    'education':        'Education',
    'other':            'Other',
}

const locationLabels: Record<string, string> = {
    'remote':    'Remote / Virtual',
    'in-person': 'In-Person',
    'hybrid':    'Hybrid',
}

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

interface Project {
    id:                string
    title:             string
    description:       string
    summary?:          string
    status:            string
    primaryDiscipline: string
    tags:              string[]
    createdBy:         string
    createdAt:         Timestamp | null
    teamSize?:         number
    maxMembers?:       number
    currentMembers?:   number
    members?:          string[]
    teamMembers?:      Record<string, any>
    duration?:         string
    durationValue?:    string
    durationUnit?:     string
    timeCommitment?:   string
    location?:         string
    locationDetails?:  string
    additionalNotes?:  string
    requiredSkills?:   string[]
    goals?:            string[]
    timeline?:         string
    openRoles?:        string[]
    methodology?:      string
}

interface ApplicationStatus {
    hasApplied:        boolean
    status:            string | null
    applicationId:     string | null
    userApplicationId: string | null
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function formatProjectDate(timestamp: Timestamp | null): string {
    if (!timestamp) return 'Unknown date'
    if (typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toLocaleDateString()
    }
    const secs = (timestamp as any).seconds
    if (secs) return new Date(secs * 1000).toLocaleDateString()
    return 'Unknown date'
}

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────

export function ProjectDetails() {
    const { id }                = useParams<{ id: string }>()
    const navigate              = useNavigate()
    const { toast }             = useToast()
    const { user: currentUser } = useAuth()

    const [project,           setProject]           = useState<Project | null>(null)
    const [loading,           setLoading]           = useState(true)
    const [isModalOpen,       setIsModalOpen]       = useState(false)
    const [creator,           setCreator]           = useState<any>(null)
    const [similarProjects,   setSimilarProjects]   = useState<Project[]>([])
    const [applicationStatus, setApplicationStatus] = useState<ApplicationStatus>({
        hasApplied:        false,
        status:            null,
        applicationId:     null,
        userApplicationId: null,
    })

    // ✅ Membership state — driven by real-time listener
    const [isMember,   setIsMember]   = useState(false)
    const [memberRole, setMemberRole] = useState<string | null>(null)

    const [withdrawing,      setWithdrawing]      = useState(false)
    const [shareDialogOpen,  setShareDialogOpen]  = useState(false)
    const [reportDialogOpen, setReportDialogOpen] = useState(false)
    const [reportReason,     setReportReason]     = useState('')
    const [reportDetails,    setReportDetails]    = useState('')
    const [submittingReport, setSubmittingReport] = useState(false)

    // Invitation Accept Flow States
    const [pendingInvitation, setPendingInvitation] = useState<any | null>(null)
    const [processingInvitation, setProcessingInvitation] = useState(false)

    // Active applications count state (for owner/creator view)
    const [activeApplicationsCount, setActiveApplicationsCount] = useState(0)

    // ── Load project + creator + similar ─────────────────
    useEffect(() => {
        if (id) loadProject(id)
    }, [id])

    // ── Real-time membership listener ─────────────────────
    // ✅ Uses onSnapshot so removal by B instantly updates A's UI
    // ✅ Only checks authoritative sources (teamMembers map + members subcollection)
    // ✅ Does NOT check joinedProjects (stale, not cleaned reliably)
    // ✅ Does NOT use application status for membership (decoupled)
    useEffect(() => {
        if (!id || !currentUser) return

        // Listen to project doc for teamMembers map changes
        const unsubscribe = onSnapshot(
            doc(db, 'projects', id),
            async (snap) => {
                if (!snap.exists()) {
                    setIsMember(false)
                    setMemberRole(null)
                    return
                }

                const data = snap.data()

                // ✅ Source 1: teamMembers map — updated by ManageTeam
                // This is the single source of truth for active membership
                const teamMembers: Record<string, any> = data.teamMembers || {}
                const memberEntry = teamMembers[currentUser.uid]

                if (memberEntry) {
                    const role = memberEntry.role?.toLowerCase()
                    // Guard against 'removed' role if ever used
                    if (role && role !== 'removed') {
                        setIsMember(true)
                        setMemberRole(role)
                        return
                    }
                }

                // ✅ Source 2: members subcollection
                // Fallback for cases where teamMembers map is not updated
                try {
                    const memberSnap = await getDoc(
                        doc(db, 'projects', id, 'members', currentUser.uid)
                    )
                    if (memberSnap.exists()) {
                        const mData = memberSnap.data()
                        if (mData.status !== 'removed') {
                            setIsMember(true)
                            setMemberRole(mData.role || 'member')
                            return
                        }
                    }
                } catch (err) {
                    console.error('[ProjectDetails] subcollection check failed:', err)
                }

                // ✅ Not found in any authoritative source → not a member
                setIsMember(false)
                setMemberRole(null)
            },
            (error) => {
                console.error('[ProjectDetails] membership listener error:', error)
                setIsMember(false)
                setMemberRole(null)
            }
        )

        return () => unsubscribe()
    }, [id, currentUser])

    // ── Application status check ──────────────────────────
    // ✅ Decoupled from membership — only shows pending/rejected states
    // 'accepted' + !isMember = "removed after acceptance" state
    useEffect(() => {
        if (id && currentUser) {
            checkApplicationStatus()
            trackProjectViewed(currentUser.uid, id)
        }
    }, [id, currentUser])


    // Load active applications count and user pending invitation
    useEffect(() => {
        if (!id || !currentUser) return
        
        // Listen to pending invitations for current user
        const qInvite = query(
            collection(db, 'projects', id, 'invitations'),
            where('userId', '==', currentUser.uid),
            where('status', '==', 'pending'),
            limit(1)
        )
        const unsubInvite = onSnapshot(qInvite, (snap) => {
            if (!snap.empty) {
                setPendingInvitation({ id: snap.docs[0].id, ...snap.docs[0].data() })
            } else {
                setPendingInvitation(null)
            }
        })

        return () => {
            unsubInvite()
        }
    }, [id, currentUser])

    // Load active applications count for owner
    useEffect(() => {
        if (!id || !currentUser || !project || project.createdBy !== currentUser.uid) {
            setActiveApplicationsCount(0)
            return
        }

        const qApps = query(
            collection(db, 'projects', id, 'applications'),
            where('status', 'in', ['pending', 'applied', 'viewed', 'shortlisted', 'interviewing'])
        )
        const unsubApps = onSnapshot(qApps, (snap) => {
            setActiveApplicationsCount(snap.size)
        }, (err) => {
            console.error('Error fetching applications count:', err)
        })

        return () => {
            unsubApps()
        }
    }, [id, currentUser, project])

    const checkApplicationStatus = async () => {
        if (!id || !currentUser) return
        try {
            const userAppsSnap = await getDocs(
                query(
                    collection(db, 'users', currentUser.uid, 'applications'),
                    where('projectId', '==', id)
                )
            )

            if (userAppsSnap.empty) return

            const appData = userAppsSnap.docs[0].data()
            let projectAppId: string | null = null

            try {
                const projectAppsSnap = await getDocs(
                    query(
                        collection(db, 'projects', id, 'applications'),
                        where('userId', '==', currentUser.uid)
                    )
                )
                if (!projectAppsSnap.empty) {
                    projectAppId = projectAppsSnap.docs[0].id
                }
            } catch (err) {
                console.error('Error checking project applications:', err)
            }

            setApplicationStatus({
                hasApplied:        true,
                status:            appData.status || 'pending',
                applicationId:     projectAppId,
                userApplicationId: userAppsSnap.docs[0].id,
            })
        } catch (error) {
            console.error('Error checking application status:', error)
        }
    }

    const handleAcceptInvitation = async () => {
        if (!id || !currentUser || !pendingInvitation || !project) return
        setProcessingInvitation(true)
        try {
            const displayName = currentUser.displayName || currentUser.email || 'Team Member'
            const role = pendingInvitation.role || 'member'
            
            const batch = writeBatch(db)
            
            // 1. Write member document
            batch.set(doc(db, 'projects', id, 'members', currentUser.uid), {
                uid:       currentUser.uid,
                name:      displayName,
                email:     currentUser.email ?? '',
                avatar:    currentUser.photoURL ?? '',
                role,
                permissions: EMPTY_MEMBER_PERMISSIONS,
                joinedAt:  serverTimestamp(),
                joinedVia: 'invitation',
            })

            // 2. Add uid to project.members array
            batch.update(doc(db, 'projects', id), {
                members: arrayUnion(currentUser.uid),
                [`teamMembers.${currentUser.uid}`]: {
                    role,
                    joinedAt: serverTimestamp(),
                    permissions: EMPTY_MEMBER_PERMISSIONS
                },
                currentMembers: increment(1)
            })

            // 3. Mark invitation doc in project sub-collection
            batch.update(
                doc(db, 'projects', id, 'invitations', pendingInvitation.id),
                {
                    status:     'accepted',
                    acceptedBy: currentUser.uid,
                    acceptedAt: serverTimestamp(),
                }
            )

            // 4. Mark invitation doc in global inviteTokens collection if token exists
            if (pendingInvitation.token) {
                batch.update(doc(db, 'inviteTokens', pendingInvitation.token), {
                    status:     'accepted',
                    acceptedBy: currentUser.uid,
                    acceptedAt: serverTimestamp(),
                })
            }

            // 5. Write to user's joinedProjects sub-collection
            batch.set(
                doc(db, 'users', currentUser.uid, 'joinedProjects', id),
                {
                    projectId: id,
                    role,
                    joinedAt:  serverTimestamp(),
                    joinedVia: 'invitation',
                }
            )

            await batch.commit()

            const newTeamSize = (project?.currentMembers || 1) + 1
            if (newTeamSize >= 2) {
                trackTeamFormed(currentUser.uid, id, newTeamSize)
                
                // Set functionalDuoAt if not set yet
                const projectRef = doc(db, 'projects', id)
                await updateDoc(projectRef, {
                    functionalDuoAt: serverTimestamp()
                }).catch(() => {})
            }



            // 6. Notify the project owner
            if (project.createdBy && project.createdBy !== currentUser.uid) {
                await sendNotificationWithPush(project.createdBy, {
                    type:      'success',
                    title:     'Invitation Accepted',
                    body:      `${displayName} accepted your invitation to join "${project.title}".`,
                    url:       `/project/${id}/manage-team`,
                    projectId: id,
                })
            }

            toast({
                title: 'Welcome to the team!',
                description: `You have successfully joined "${project.title}".`
            })
            
            setIsMember(true)
            setMemberRole(role)
            setPendingInvitation(null)
        } catch (err) {
            console.error('Error accepting invitation:', err)
            toast({
                title: 'Error',
                description: 'Failed to accept the invitation. Please try again.',
                variant: 'destructive'
            })
        } finally {
            setProcessingInvitation(false)
        }
    }

    const handleDeclineInvitation = async () => {
        if (!id || !currentUser || !pendingInvitation) return
        setProcessingInvitation(true)
        try {
            const batch = writeBatch(db)

            batch.update(
                doc(db, 'projects', id, 'invitations', pendingInvitation.id),
                { status: 'declined' }
            )

            if (pendingInvitation.token) {
                batch.update(doc(db, 'inviteTokens', pendingInvitation.token), {
                    status: 'declined'
                })
            }

            await batch.commit()
            toast({ title: 'Invitation declined' })
            setPendingInvitation(null)
        } catch (err) {
            console.error('Error declining invitation:', err)
            toast({
                title: 'Error',
                description: 'Failed to decline the invitation.',
                variant: 'destructive'
            })
        } finally {
            setProcessingInvitation(false)
        }
    }

    const loadProject = async (projectId: string) => {
        setLoading(true)
        try {
            const docSnap = await getDoc(doc(db, 'projects', projectId))
            if (!docSnap.exists()) return

            const projectData = { id: docSnap.id, ...docSnap.data() } as Project
            setProject(projectData)

            if (projectData.createdBy) {
                const userSnap = await getDoc(
                    doc(db, 'users', projectData.createdBy)
                )
                if (userSnap.exists()) setCreator(userSnap.data())
            }

            if (projectData.primaryDiscipline) {
                const similarSnap = await getDocs(
                    query(
                        collection(db, 'projects'),
                        where('primaryDiscipline', '==', projectData.primaryDiscipline),
                        where('status', 'in', ['recruiting', 'active']),
                        limit(6)
                    )
                )
                const similar = similarSnap.docs
                    .map(d => ({ id: d.id, ...d.data() } as Project))
                    .filter(p => p.id !== projectId)
                    .slice(0, 3)
                setSimilarProjects(similar)
            }
        } catch (error) {
            console.error('Error loading project:', error)
        } finally {
            setLoading(false)
        }
    }

    // ── Withdraw application ──────────────────────────────
    const handleWithdraw = async () => {
        if (!id || !currentUser || !project) return
        setWithdrawing(true)
        try {
            const batch = writeBatch(db)

            if (applicationStatus.userApplicationId) {
                batch.delete(doc(
                    db, 'users', currentUser.uid,
                    'applications', applicationStatus.userApplicationId
                ))
            }
            if (applicationStatus.applicationId) {
                batch.delete(doc(
                    db, 'projects', id,
                    'applications', applicationStatus.applicationId
                ))
            }

            await batch.commit()

            await sendNotificationWithPush(
                project.createdBy,
                buildWithdrawOwnerNotif(project.title, id)
            )

            setApplicationStatus({
                hasApplied:        false,
                status:            null,
                applicationId:     null,
                userApplicationId: null,
            })

            toast({
                title:       'Application withdrawn',
                description: 'Your application has been withdrawn successfully',
            })
        } catch (error) {
            console.error('Error withdrawing application:', error)
            toast({
                title:       'Error',
                description: 'Failed to withdraw application',
                variant:     'destructive',
            })
        } finally {
            setWithdrawing(false)
        }
    }

    const handleApplicationSuccess = () => {
        setIsModalOpen(false)
        checkApplicationStatus()
        if (currentUser && id) {
            trackProjectApplied(currentUser.uid, id)
        }
    }


    // ── Share handlers ────────────────────────────────────
    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href)
            toast({
                title:       'Link Copied!',
                description: 'Project link copied to clipboard.',
            })
        } catch {
            toast({
                title:       'Copy Failed',
                description: 'Could not copy link.',
                variant:     'destructive',
            })
        }
    }

    const handleShareTwitter = () => {
        const url  = encodeURIComponent(window.location.href)
        const text = encodeURIComponent(
            `Check out this project: "${project?.title}" on ProCollab!`
        )
        window.open(
            `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
            '_blank'
        )
    }

    const handleShareWhatsApp = () => {
        const text = encodeURIComponent(
            `Check out this project: "${project?.title}" on ProCollab! ${window.location.href}`
        )
        window.open(`https://wa.me/?text=${text}`, '_blank')
    }

    // ── Report handler ────────────────────────────────────
    const handleSubmitReport = async () => {
        if (!project || !currentUser) return
        if (!reportReason) {
            toast({
                title:       'Reason Required',
                description: 'Please select a reason.',
                variant:     'destructive',
            })
            return
        }

        setSubmittingReport(true)
        try {
            const existingSnap = await getDocs(
                query(
                    collection(db, 'reports'),
                    where('reportedBy', '==', currentUser.uid),
                    where('targetId', '==', project.id)
                )
            )
            if (!existingSnap.empty) {
                toast({
                    title:       'Already Reported',
                    description: 'You have already reported this project.',
                    variant:     'destructive',
                })
                setReportDialogOpen(false)
                return
            }

            await addDoc(collection(db, 'reports'), {
                projectId:     project.id,
                projectTitle:  project.title,
                reportedBy:    currentUser.uid,
                reporterEmail: currentUser.email,
                targetType:    'project',
                targetId:      project.id,
                reason:        reportReason,
                description:   reportDetails,
                status:        'pending',
                createdAt:     serverTimestamp(),
            })

            await updateDoc(doc(db, 'projects', project.id), {
                reportCount: increment(1),
            })

            await sendNotificationWithPush(
                project.createdBy,
                buildReportOwnerNotif(project.title, project.id, reportReason)
            )

            await notifyAdmins(
                buildReportAdminNotif(project.title, project.id, reportReason)
            )

            toast({
                title:       'Report Submitted',
                description: 'Your report has been submitted for review.',
            })

            setReportReason('')
            setReportDetails('')
            setReportDialogOpen(false)
        } catch (error) {
            console.error('Error submitting report:', error)
            toast({
                title:       'Report Failed',
                description: 'Failed to submit report. Please try again.',
                variant:     'destructive',
            })
        } finally {
            setSubmittingReport(false)
        }
    }

    // ── Loading / not found guards ────────────────────────
    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
                </div>
            </DashboardLayout>
        )
    }

    if (!project) {
        return (
            <DashboardLayout>
                <div className="text-center py-12">
                    <h2 className="text-2xl font-bold mb-4">Project not found</h2>
                    <Button onClick={() => navigate('/projects')}>
                        Back to Projects
                    </Button>
                </div>
            </DashboardLayout>
        )
    }

    // ── Derived state ─────────────────────────────────────
    const isOwner = !!currentUser && project.createdBy === currentUser.uid

    const actualMemberCount = (() => {
        const membersList = project.members || []
        const hasOwner = project.createdBy && membersList.includes(project.createdBy)
        const membersArrayCount = membersList.length + (hasOwner ? 0 : 1)

        if (project.teamMembers && typeof project.teamMembers === 'object') {
            const activeMembers = Object.entries(project.teamMembers).filter(
                ([, member]: [string, any]) => member && member.role !== 'removed'
            )
            const teamHasOwner = project.createdBy && project.teamMembers[project.createdBy] && project.teamMembers[project.createdBy].role !== 'removed'
            return activeMembers.length + (teamHasOwner ? 0 : 1)
        }
        return membersArrayCount
    })()

    const maxMembers = project.maxMembers || project.teamSize || 999
    const isTeamFull = actualMemberCount >= maxMembers

    const canApply =
        (project.status === 'planning' || project.status === 'recruiting' || project.status === 'active') &&
        !isTeamFull &&
        !isOwner &&
        !isMember

    const getApplyButtonLabel = (): string => {
        if (isTeamFull)                          return 'Team is Full'
        if (project.status === 'completed')      return 'Project Completed'
        if (project.status === 'on-hold')        return 'Project On Hold'
        if (project.status === 'pending_review') return 'Under Review'
        return 'Apply to Join'
    }

    // ── Action card ───────────────────────────────────────
    const renderActionCard = () => {
        // 1. Owner
        if (isOwner) {
            return (
                <div className="space-y-3">
                    <div className="text-center py-3 px-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            You are the owner of this project
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => navigate(`/project/${id}/manage-team`)}
                    >
                        Manage Team
                    </Button>
                    {activeApplicationsCount > 0 && (
                        <Button
                            className="w-full bg-amber-500 hover:bg-amber-600 text-white gap-2 font-semibold"
                            onClick={() => navigate(`/project/${id}/manage-team?tab=applications`)}
                        >
                            Review Applications
                            <Badge variant="secondary" className="bg-white/20 hover:bg-white/35 border-none text-white text-xs font-bold px-1.5 h-5 min-w-5 justify-center flex items-center">
                                {activeApplicationsCount}
                            </Badge>
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => navigate(`/edit-project/${id}`)}
                    >
                        Edit Project
                    </Button>
                </div>
            )
        }

        // 2. ✅ Active member — real-time confirmed
        if (isMember) {
            return (
                <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2 py-3 px-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
                        <Check className="h-5 w-5 text-green-600" />
                        <p className="text-sm font-medium text-green-700 dark:text-green-400">
                            You are a member
                            {memberRole ? ` (${memberRole})` : ''}
                        </p>
                    </div>
                    <Button
                        className="w-full"
                        onClick={() => navigate(`/project/${id}/dashboard`)}
                    >
                        Go to Project Dashboard
                    </Button>
                    {memberRole === 'admin' && (
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => navigate(`/project/${id}/manage-team`)}
                        >
                            Manage Team
                        </Button>
                    )}
                </div>
            )
        }

        // 3. Has applied
        if (applicationStatus.hasApplied) {

            // ✅ Accepted but NOT a member = removed after acceptance
            if (applicationStatus.status === 'accepted' && !isMember) {
                return (
                    <div className="space-y-3">
                        <div className="flex items-center justify-center gap-2 py-3 px-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                            <X className="h-5 w-5 text-gray-500" />
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                You are no longer a member of this project
                            </p>
                        </div>
                        {/* ✅ Allow re-apply if still recruiting */}
                        {canApply && (
                            <Button
                                className="w-full"
                                size="lg"
                                onClick={() => setIsModalOpen(true)}
                            >
                                Apply Again
                            </Button>
                        )}
                    </div>
                )
            }

            const activeStatuses = ['pending', 'applied', 'viewed', 'shortlisted', 'interviewing']
            if (activeStatuses.includes(applicationStatus.status || '')) {
                let statusLabel = 'Application Pending'
                let bgClass = 'bg-yellow-100 dark:bg-yellow-900/30'
                let textClass = 'text-yellow-700 dark:text-yellow-400'
                let iconColor = 'text-yellow-600'

                if (applicationStatus.status === 'viewed') {
                    statusLabel = 'Application Under Review'
                    bgClass = 'bg-purple-100 dark:bg-purple-900/30'
                    textClass = 'text-purple-700 dark:text-purple-400'
                    iconColor = 'text-purple-600'
                } else if (applicationStatus.status === 'shortlisted') {
                    statusLabel = 'Shortlisted'
                    bgClass = 'bg-amber-100 dark:bg-amber-900/30'
                    textClass = 'text-amber-700 dark:text-amber-400'
                    iconColor = 'text-amber-600'
                } else if (applicationStatus.status === 'interviewing') {
                    statusLabel = 'Interview Stage'
                    bgClass = 'bg-cyan-100 dark:bg-cyan-900/30'
                    textClass = 'text-cyan-700 dark:text-cyan-400'
                    iconColor = 'text-cyan-600'
                }

                return (
                    <div className="space-y-3">
                        <div className={`flex items-center justify-center gap-2 py-3 px-4 ${bgClass} rounded-lg`}>
                            <Clock className={`h-5 w-5 ${iconColor}`} />
                            <p className={`text-sm font-medium ${textClass}`}>
                                {statusLabel}
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            className="w-full text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
                            onClick={handleWithdraw}
                            disabled={withdrawing}
                        >
                            {withdrawing ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Withdrawing...
                                </>
                            ) : (
                                <>
                                    <X className="h-4 w-4 mr-2" />
                                    Withdraw Application
                                </>
                            )}
                        </Button>
                    </div>
                )
            }

            if (applicationStatus.status === 'rejected') {
                return (
                    <div className="flex items-center justify-center gap-2 py-3 px-4 bg-red-100 dark:bg-red-900/30 rounded-lg">
                        <X className="h-5 w-5 text-red-600" />
                        <p className="text-sm font-medium text-red-700 dark:text-red-400">
                            Application Not Accepted
                        </p>
                    </div>
                )
            }
        }

        // 4. Default apply button
        return (
            <Button
                className="w-full"
                size="lg"
                onClick={() => setIsModalOpen(true)}
                disabled={!canApply}
            >
                {getApplyButtonLabel()}
            </Button>
        )
    }

    // ── Main render ───────────────────────────────────────
    return (
        <DashboardLayout>
            <Button
                variant="ghost"
                className="mb-6 pl-0 hover:pl-2 transition-all"
                onClick={() => navigate(-1)}
            >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
            </Button>

            {pendingInvitation && (
                <div className="mb-6 p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                            <Mail className="h-5 w-5 animate-pulse" />
                        </div>
                        <div className="min-w-0">
                            <h4 className="font-bold text-sm text-gray-900 dark:text-white">Project Invitation</h4>
                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 leading-relaxed">
                                You have been invited to join this project as a <strong className="capitalize">{pendingInvitation.role || 'member'}</strong>!
                                {pendingInvitation.message && (
                                    <div className="mt-2 text-xs italic text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 rounded p-2 max-w-lg font-medium">
                                        Message: "{pendingInvitation.message}"
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button 
                            size="sm" 
                            className="font-medium text-xs h-8 px-4 shadow-sm"
                            onClick={handleAcceptInvitation}
                            disabled={processingInvitation}
                        >
                            {processingInvitation ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                'Accept'
                            )}
                        </Button>
                        <Button 
                            size="sm" 
                            variant="outline" 
                            className="border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium text-xs h-8 px-4"
                            onClick={handleDeclineInvitation}
                            disabled={processingInvitation}
                        >
                            Decline
                        </Button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* ── Main Content ── */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Header */}
                    <div>
                        <div className="flex justify-between items-start mb-4">
                            <Badge
                                className="mb-2"
                                variant={
                                    project.status === 'recruiting' ? 'secondary' :
                                    project.status === 'active'     ? 'default'   :
                                    'outline'
                                }
                            >
                                {project.status.toUpperCase()}
                            </Badge>
                            <span className="text-sm text-gray-500">
                                Posted {formatProjectDate(project.createdAt)}
                            </span>
                        </div>

                        <h1 className="text-2xl sm:text-4xl font-bold mb-4">{project.title}</h1>

                        <div className="flex flex-wrap gap-2 mb-6">
                            <Badge
                                className="border-0 bg-primary/10 text-primary font-semibold rounded-md px-2.5 py-0.5"
                            >
                                {disciplineLabels[project.primaryDiscipline] ||
                                    project.primaryDiscipline}
                            </Badge>
                            {project.tags?.map((tag, i) => (
                                <Badge key={i} className={`border-0 font-semibold px-2.5 py-0.5 rounded-md transition-colors ${getTagColorClass(tag)}`}>{tag}</Badge>
                            ))}
                        </div>
                    </div>

                    {/* Description */}
                    <Card>
                        <CardHeader><CardTitle>About the Project</CardTitle></CardHeader>
                        <CardContent className="prose dark:prose-invert max-w-none space-y-3">
                            {project.summary && (
                                <p className="text-base font-medium text-gray-700 dark:text-gray-300">
                                    {project.summary}
                                </p>
                            )}
                            <p className="whitespace-pre-wrap text-gray-600 dark:text-gray-400">
                                {project.description}
                            </p>
                        </CardContent>
                    </Card>

                    {/* Goals */}
                    {project.goals && project.goals.length > 0 && (
                        <Card>
                            <CardHeader><CardTitle>Project Goals</CardTitle></CardHeader>
                            <CardContent>
                                <ul className="space-y-2">
                                    {project.goals.map((goal, i) => (
                                        <li key={i} className="flex items-start gap-2">
                                            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>{goal}</span>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    )}

                    {/* Required Skills */}
                    {project.requiredSkills && project.requiredSkills.length > 0 && (
                        <Card>
                            <CardHeader><CardTitle>Required Skills</CardTitle></CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-2">
                                    {project.requiredSkills.map((skill, i) => (
                                        <Badge key={i} className={`border-0 font-semibold px-3 py-1 rounded-md transition-colors ${getTagColorClass(skill)}`}>
                                            {skill}
                                        </Badge>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Timeline */}
                    {project.timeline && (
                        <Card>
                            <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
                            <CardContent>
                                <p className="whitespace-pre-wrap">{project.timeline}</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Additional Notes */}
                    {project.additionalNotes && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Info className="h-5 w-5 text-gray-500" />
                                    Additional Notes
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                                    {project.additionalNotes}
                                </p>
                            </CardContent>
                        </Card>
                    )}


                </div>

                {/* ── Sidebar ── */}
                <div className="space-y-6">
                    {/* Action Card */}
                    <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-900/10 dark:border-blue-800">
                        <CardContent className="p-6 space-y-4">
                            {renderActionCard()}

                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => setShareDialogOpen(true)}
                                >
                                    <Share2 className="h-4 w-4 mr-2" />
                                    Share
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1 text-red-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200"
                                    onClick={() => {
                                        if (!currentUser) {
                                            toast({
                                                title:       'Login Required',
                                                description: 'Please log in to report a project.',
                                                variant:     'destructive',
                                            })
                                            return
                                        }
                                        if (isOwner) {
                                            toast({
                                                title:       'Cannot Report',
                                                description: 'You cannot report your own project.',
                                            })
                                            return
                                        }
                                        setReportDialogOpen(true)
                                    }}
                                >
                                    <Flag className="h-4 w-4 mr-2" />
                                    Report
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Project Details */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Project Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-gray-500 flex items-center gap-2">
                                    <Users className="h-4 w-4" /> Team Size
                                </span>
                                <span className="font-medium">
                                    {actualMemberCount}/
                                    {maxMembers === 999 ? '∞' : maxMembers}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-500 flex items-center gap-2">
                                    <Clock className="h-4 w-4" /> Duration
                                </span>
                                <span className="font-medium">
                                    {project.duration || 'Flexible'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-500 flex items-center gap-2">
                                    <Calendar className="h-4 w-4" /> Commitment
                                </span>
                                <span className="font-medium">
                                    {project.timeCommitment || 'Flexible'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-500 flex items-center gap-2">
                                    <MapPin className="h-4 w-4" /> Location
                                </span>
                                <span className="font-medium">
                                    {locationLabels[project.location || ''] ||
                                        project.location || 'Remote'}
                                </span>
                            </div>
                            {project.locationDetails && (
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-500 flex items-center gap-2">
                                        <MapPin className="h-4 w-4" /> City / Area
                                    </span>
                                    <span className="font-medium text-right max-w-[60%]">
                                        {project.locationDetails}
                                    </span>
                                </div>
                            )}
                            {project.methodology && (
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-500 flex items-center gap-2">
                                        <FileText className="h-4 w-4" /> Methodology
                                    </span>
                                    <span className="font-medium capitalize">
                                        {project.methodology}
                                    </span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Project Lead */}
                    {creator && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Project Lead</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div
                                    className="flex items-center gap-4 cursor-pointer"
                                    onClick={() => navigate(`/profile/${project.createdBy}`)}
                                >
                                    <img
                                        src={
                                            creator.photoURL ||
                                            `https://api.dicebear.com/7.x/avataaars/svg?seed=${creator.email}`
                                        }
                                        alt={creator.firstName}
                                        className="w-12 h-12 rounded-full object-cover"
                                    />
                                    <div>
                                        <h3 className="font-semibold hover:text-blue-600 transition-colors">
                                            {creator.firstName} {creator.lastName}
                                        </h3>
                                        <p className="text-sm text-gray-500">
                                            {disciplineLabels[creator.discipline] ||
                                                creator.discipline ||
                                                creator.role ||
                                                'Project Creator'}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Open Positions */}
                    {project.openRoles && project.openRoles.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Open Positions</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2">
                                    {project.openRoles.map((role, i) => (
                                        <li
                                            key={i}
                                            className="text-sm bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-md flex items-center gap-2"
                                        >
                                            <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                                            {role}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    )}

                    {/* Similar Projects */}
                    {similarProjects.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Similar Projects</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {similarProjects.map(p => (
                                    <div
                                        key={p.id}
                                        className="group cursor-pointer"
                                        onClick={() => navigate(`/project/${p.id}`)}
                                    >
                                        <h4 className="font-medium group-hover:text-blue-600 transition-colors line-clamp-1">
                                            {p.title}
                                        </h4>
                                        <p className="text-xs text-gray-500 line-clamp-2 mt-1">
                                            {p.description}
                                        </p>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* Share Dialog */}
            <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Share2 className="h-5 w-5" />
                            Share Project
                        </DialogTitle>
                        <DialogDescription>
                            Share "{project.title}" with others
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="relative flex items-center w-full">
                            <input
                                type="text"
                                readOnly
                                value={window.location.href}
                                className="w-full pr-20 pl-10 py-2.5 bg-gray-50 dark:bg-gray-800/60 border border-border rounded-lg text-sm truncate focus:outline-none select-all"
                            />
                            <Link className="absolute left-3 h-4 w-4 text-gray-500 pointer-events-none" />
                            <Button
                                size="sm"
                                variant="ghost"
                                className="absolute right-1.5 h-8 text-xs flex items-center gap-1 hover:bg-gray-200 dark:hover:bg-gray-700/80"
                                onClick={handleCopyLink}
                            >
                                <Copy className="h-3.5 w-3.5" />
                                Copy
                            </Button>
                        </div>
                        <p className="text-sm text-gray-500 text-center">or share via</p>
                        <div className="grid grid-cols-2 gap-3">
                            <Button variant="outline" className="w-full" onClick={handleShareTwitter}>
                                <Twitter className="h-4 w-4 mr-2 text-sky-500" />
                                Twitter / X
                            </Button>
                            <Button variant="outline" className="w-full" onClick={handleShareWhatsApp}>
                                <MessageCircle className="h-4 w-4 mr-2 text-green-500" />
                                WhatsApp
                            </Button>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShareDialogOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Report Dialog */}
            <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <Flag className="h-5 w-5" />
                            Report Project
                        </DialogTitle>
                        <DialogDescription>
                            Report "{project.title}" for review by our admin team.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Reason *</Label>
                            <Select
                                value={reportReason}
                                onValueChange={value => setReportReason(value)}
                            >
                                <SelectTrigger className="w-full bg-zinc-900 border-zinc-800 text-zinc-100 focus:ring-1 focus:ring-red-500">
                                    <SelectValue placeholder="Select a reason..." />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
                                    <SelectItem value="Spam or misleading">Spam or misleading</SelectItem>
                                    <SelectItem value="Inappropriate content">Inappropriate content</SelectItem>
                                    <SelectItem value="Fake or scam project">Fake or scam project</SelectItem>
                                    <SelectItem value="Plagiarism">Plagiarism</SelectItem>
                                    <SelectItem value="Harassment or abuse">Harassment or abuse</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>
                                Additional Details{' '}
                                <span className="text-gray-400 font-normal">(optional)</span>
                            </Label>
                            <Textarea
                                placeholder="Provide more context about the issue..."
                                value={reportDetails}
                                onChange={e => setReportDetails(e.target.value)}
                                rows={3}
                                className="resize-none"
                            />
                        </div>
                        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                            <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                                Your report will be reviewed by our admin team.
                                False reports may result in action against your account.
                            </p>
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setReportReason('')
                                setReportDetails('')
                                setReportDialogOpen(false)
                            }}
                            disabled={submittingReport}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleSubmitReport}
                            disabled={submittingReport || !reportReason}
                        >
                            {submittingReport ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                <>
                                    <Flag className="h-4 w-4 mr-2" />
                                    Submit Report
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Application Modal */}
            <ApplicationModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                project={project}
                onSuccess={handleApplicationSuccess}
            />
        </DashboardLayout>
    )
}
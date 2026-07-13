import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { usePermissions, MemberPermissions, invalidatePermissionsCache } from '@/hooks/use-permissions'

import {
    LayoutDashboard, KanbanSquare, GanttChartSquare,
    CalendarDays, Users, BarChart3, Settings,
    Plus, ArrowLeft, Loader2, Pencil, FileText, FolderOpen,
    DollarSign, Image, Lock, AlertTriangle, Video,
    Activity, CheckCircle2, XCircle, ChevronRight, MessageSquare, RefreshCw, Share2,
    Copy, Link2, MessageCircle, Twitter, Sparkles
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import {
    doc, getDoc, getDocs, updateDoc,
    collection, query, onSnapshot,
    addDoc, serverTimestamp, orderBy, limit, writeBatch, increment
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { cachedGetDoc } from '@/lib/queryUtils'
import { aggregateUserReputation } from '@/lib/reputationEngine'
import {
    ref as rtdbRef,
    onValue as rtdbOnValue,
    off as rtdbOff,
    query as rtdbQuery,
    limitToLast as rtdbLimitToLast
} from 'firebase/database'
import { database } from '@/lib/firebase'
import type { Task } from '@/types/project'
import { useAuth } from '@/hooks/use-auth'
import { useProjectRole } from '@/hooks/use-project-role'
import { ClipboardList, Star } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { formatDistanceToNow } from 'date-fns'
import { ProjectGuide } from '@/components/dashboard/ProjectGuide'
import { ProjectOnboardingModal, type OnboardingDecision } from '@/components/dashboard/ProjectOnboardingModal'
import { trackFeatureUsed, type FeatureName } from '@/services/analyticsService'

// ⚡ OPTIMIZATION: Lazy-load all dashboard tab components.
// Previously all 13 tabs (including tldraw ~2MB, recharts ~400KB) were bundled
// together into a single 2.3MB chunk loaded on every project dashboard visit.
// Now each tab loads its own chunk only when first rendered.
// Whiteboard alone saves ~2MB on initial load for users who never open that tab.
const KanbanBoard = lazy(() => import('@/components/dashboard/KanbanBoard').then(m => ({ default: m.KanbanBoard })))
const TaskDialog = lazy(() => import('@/components/dashboard/TaskDialog').then(m => ({ default: m.TaskDialog })))
const GanttChart = lazy(() => import('@/components/dashboard/GanttChart').then(m => ({ default: m.GanttChart })))
const ProjectCalendar = lazy(() => import('@/components/dashboard/ProjectCalendar').then(m => ({ default: m.ProjectCalendar })))
const ResourceManagement = lazy(() => import('@/components/dashboard/ResourceManagement').then(m => ({ default: m.ResourceManagement })))
const Analytics = lazy(() => import('@/components/dashboard/Analytics').then(m => ({ default: m.Analytics })))
const GoogleDocsPanel = lazy(() => import('@/components/dashboard/GoogleDocsPanel').then(m => ({ default: m.GoogleDocsPanel })))
const BudgetTracker = lazy(() => import('@/components/dashboard/BudgetTracker').then(m => ({ default: m.BudgetTracker })))
const GalleryView = lazy(() => import('@/components/dashboard/GalleryView').then(m => ({ default: m.GalleryView })))
const MeetingRoom = lazy(() => import('@/components/dashboard/MeetingRoom').then(m => ({ default: m.MeetingRoom })))
const MyTasksPanel = lazy(() => import('@/components/dashboard/MyTasksPanel').then(m => ({ default: m.MyTasksPanel })))
const TaskReviewPanel = lazy(() => import('@/components/dashboard/TaskReviewPanel').then(m => ({ default: m.TaskReviewPanel })))
const TemplateGallery = lazy(() => import('@/components/dashboard/TemplateGallery').then(m => ({ default: m.TemplateGallery })))
const TeamChat = lazy(() => import('@/components/dashboard/TeamChat').then(m => ({ default: m.TeamChat })))
import { ProjectCompletionModal } from '@/components/dashboard/ProjectCompletionModal'
import { ConfigureShowcaseModal } from '@/components/dashboard/ConfigureShowcaseModal'

// Shared tab loading placeholder
const TabLoader = () => (
    <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
)

// ─── Access denied ────────────────────────────────────────────────────────────
function AccessDenied({ feature }: { feature: string }) {
    return (
        <div className="flex flex-col items-center justify-center h-64 text-center">
            <Lock className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
            <p className="text-muted-foreground max-w-md">
                You don't have permission to access {feature}.
                Contact the project owner if you need access.
            </p>
        </div>
    )
}

// ─── Read-only notice ─────────────────────────────────────────────────────────
function ReadOnlyNotice() {
    return (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200
                        dark:border-yellow-800 rounded-lg p-3 mb-4
                        flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
                You have read-only access to this section. Editing is disabled.
            </p>
        </div>
    )
}



// ─── Tab permission map ───────────────────────────────────────────────────────
const TAB_PERMISSION_MAP: Record<string, keyof MemberPermissions> = {
    overview: 'dashboard',
    kanban: 'tasks',
    gantt: 'gantt',
    calendar: 'calendar',
    meetings: 'calendar',
    team: 'dashboard',
    analytics: 'dashboard',
    whiteboard: 'whiteboard',
    documents: 'files',
    budget: 'dashboard',
    gallery: 'files',
    mytasks: 'tasks',    // ← new
    reviews: 'tasks',    // ← new
    chat: 'chat',
}

// ─────────────────────────────────────────────────────────────────────────────
export function ProjectDashboard() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { user, loading: authLoading } = useAuth()
    const { canManageTeam } = useProjectRole()
    const { toast } = useToast()
    const [teamMembers, setTeamMembers] = useState<
        { uid: string; name: string; avatar?: string }[]
    >([])
    const {
        permissions,
        loading: permissionsLoading,
        canWrite,
        isOwner,
        isAdmin,
    } = usePermissions()

    const [loading, setLoading] = useState(true)
    const [project, setProject] = useState<any>(null)
    const [tasks, setTasks] = useState<Task[]>([])
    const [activities, setActivities] = useState<any[]>([])
    const [showAllActivity, setShowAllActivity] = useState(false)
    const [allActivities, setAllActivities] = useState<any[]>([])

    // ── Tab state synced with URL ──────────────────────────────────────────────
    const [searchParams, setSearchParams] = useSearchParams()
    const activeTab = searchParams.get('tab') || 'overview'

    // Tab → analytics feature name mapping
    const TAB_FEATURE_MAP: Record<string, FeatureName> = {
        kanban: 'kanban',
        gantt: 'gantt',
        calendar: 'calendar',
        whiteboard: 'whiteboard',
        documents: 'documents',
        analytics: 'analytics',
        chat: 'chat',
    }

    const setActiveTab = (tab: string) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev)
            next.set('tab', tab)
            return next
        }, { replace: true })
        // Fire feature_used for meaningful tabs
        const feature = TAB_FEATURE_MAP[tab]
        if (feature && user?.uid) {
            trackFeatureUsed(user.uid, feature, { project_id: id })
        }
    }

    const [showTemplates, setShowTemplates] = useState(false)
    const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false)
    const [editingTask, setEditingTask] = useState<Task | null>(null)
    const [onboardingDecision, setOnboardingDecision] = useState<OnboardingDecision | null | 'loading'>('loading')
    const [showOnboarding, setShowOnboarding] = useState(false)
    const [unreadCount, setUnreadCount] = useState(0)

    const [updatingStatus, setUpdatingStatus] = useState(false)
    const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false)
    const [isConfigureShowcaseOpen, setIsConfigureShowcaseOpen] = useState(false)
    const [shareDialogOpen, setShareDialogOpen] = useState(false)

    // ── Share handlers ────────────────────────────────────────────────────────
    const handleCopyLink = async () => {
        try {
            const shareUrl = project?.slug
                ? `${window.location.origin}/projects/${project.slug}`
                : `${window.location.origin}/project/public/${id}`
            await navigator.clipboard.writeText(shareUrl)
            toast({
                title: 'Link Copied!',
                description: 'Project link copied to clipboard.',
            })
        } catch {
            toast({
                title: 'Copy Failed',
                description: 'Could not copy link.',
                variant: 'destructive',
            })
        }
    }

    const handleShareTwitter = () => {
        const shareUrl = project?.slug
            ? `${window.location.origin}/projects/${project.slug}`
            : `${window.location.origin}/project/public/${id}`
        const url = encodeURIComponent(shareUrl)
        const text = encodeURIComponent(
            `Check out our project: "${project?.title}" on ProCollab!`
        )
        window.open(
            `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
            '_blank'
        )
    }

    const handleShareWhatsApp = () => {
        const shareUrl = project?.slug
            ? `${window.location.origin}/projects/${project.slug}`
            : `${window.location.origin}/project/public/${id}`
        const text = encodeURIComponent(
            `Check out our project: "${project?.title}" on ProCollab! ${shareUrl}`
        )
        window.open(`https://wa.me/?text=${text}`, '_blank')
    }

    const completionVotes = project?.completionVotes || {}
    const teamSize = teamMembers.length || 1
    const requiredVotes = teamSize <= 1 ? 1 : (teamSize <= 3 ? 2 : 3)
    const voteCount = Object.keys(completionVotes).filter(k => completionVotes[k] === true).length
    const hasVoted = user?.uid ? !!completionVotes[user.uid] : false
    const isMember = project?.teamMembers && user?.uid ? (user.uid in project.teamMembers) : false

    const handleCompleteProject = async () => {
        if (!id || !user?.uid) return
        if (hasVoted) {
            toast({
                title: 'Already Voted',
                description: 'You have already voted to complete this project.',
            })
            return
        }

        setUpdatingStatus(true)
        try {
            const updatedVotes = { ...completionVotes, [user.uid]: true }
            const newVoteCount = Object.keys(updatedVotes).filter(k => updatedVotes[k] === true).length

            if (newVoteCount >= requiredVotes) {
                // Activity verification check: at least 2 members and at least 10 completed tasks
                const doneCount = tasks.filter(t => t.status === 'done').length
                const uniqueMembersCount = teamMembers.length
                const activityVerified = uniqueMembersCount >= 2 && doneCount >= 10

                // Get all unique collaborators (owner + team members)
                const allCollaboratorUids = Array.from(new Set([
                    ...(teamMembers?.map(m => m.uid) || []),
                    ...(project?.createdBy ? [project.createdBy] : [])
                ])).filter(Boolean)

                await updateDoc(doc(db, 'projects', id), {
                    status: 'completed',
                    completedAt: serverTimestamp(),
                    completionVotes: updatedVotes,
                    activityVerified,
                    "metrics.totalTasks": tasks.length,
                    "metrics.completedTasks": doneCount,
                    "metrics.memberIds": allCollaboratorUids
                })

                // Batch-update users' reputation statistics
                const batch = writeBatch(db)
                allCollaboratorUids.forEach((collabUid) => {
                    const userTasks = tasks.filter(t => t.assigneeId === collabUid)
                    const userAssigned = userTasks.length
                    const userCompleted = userTasks.filter(t => t.status === 'done').length

                    const toDate = (val: any) => {
                        if (!val) return null
                        if (val.toDate && typeof val.toDate === 'function') return val.toDate()
                        return new Date(val)
                    }

                    const userOnTime = userTasks.filter(t => {
                        if (t.status !== 'done') return false
                        const due = toDate(t.dueDate)
                        return !due || due >= new Date()
                    }).length

                    const userRef = doc(db, 'users', collabUid)
                    batch.update(userRef, {
                        "reputationStats.totalTasksAssigned": increment(userAssigned),
                        "reputationStats.totalTasksCompleted": increment(userCompleted),
                        "reputationStats.totalTasksCompletedOnTime": increment(userOnTime),
                        "reputationStats.projectsCompleted": increment(1)
                    })
                })
                await batch.commit()

                // Recalculate reputation and check badges for all collaborators
                await Promise.all(allCollaboratorUids.map(uid => aggregateUserReputation(uid)))

                setProject((prev: any) => prev ? {
                    ...prev,
                    status: 'completed',
                    completionVotes: updatedVotes,
                    activityVerified,
                    metrics: {
                        totalTasks: tasks.length,
                        completedTasks: doneCount,
                        memberIds: allCollaboratorUids
                    }
                } : prev)

                setIsCompletionModalOpen(true)
                toast({
                    title: 'Project Completed!',
                    description: `Threshold reached (${newVoteCount}/${requiredVotes}). Resume and showcase materials generated.`,
                })
            } else {
                await updateDoc(doc(db, 'projects', id), {
                    completionVotes: updatedVotes,
                })
                setProject((prev: any) => prev ? { ...prev, completionVotes: updatedVotes } : prev)
                toast({
                    title: 'Vote Cast!',
                    description: `Your vote is saved. Currently at ${newVoteCount}/${requiredVotes} votes. ${requiredVotes - newVoteCount} more required.`,
                })
            }
        } catch (err) {
            console.error('Error in project completion vote:', err)
            toast({
                title: 'Error',
                description: 'Failed to record completion vote.',
                variant: 'destructive',
            })
        } finally {
            setUpdatingStatus(false)
        }
    }

    // Track active listener for cleanup
    const unsubscribeTasksRef = useRef<(() => void) | null>(null)

    // ── Effect 1: Load project doc ────────────────────────────────────────────
    // ✅ P1 FIX: Routes through cachedGetDoc (5-min TTL).
    // Before: raw getDoc() on every navigation to a project dashboard page.
    // After:  cache hit for 5 minutes = 0 Firestore reads per revisit.
    useEffect(() => {
        if (!id || !user?.uid) return

        const loadProject = async () => {
            try {
                // Use cachedGetDoc — same project doc is re-used within 5 minutes.
                // Cache key is derived automatically from the document reference.
                const docSnap = await cachedGetDoc(
                    doc(db, 'projects', id),
                    { userId: user.uid, ttl: 300_000 }
                )
                if (docSnap.exists()) {
                    const data = docSnap.data()
                    setProject({ id: docSnap.id, ...data })

                    // ── Onboarding decision ───────────────────────────────
                    const decision = data.onboardingDecision as OnboardingDecision | undefined
                    if (decision) {
                        setOnboardingDecision(decision)
                    } else {
                        setOnboardingDecision(null)
                    }

                    // Load team members from subcollection
                    try {
                        const membersSnap = await getDocs(collection(db, 'projects', id, 'members'))
                        const members = membersSnap.docs.map(docSnap => {
                            const m = docSnap.data()
                            return {
                                uid: docSnap.id,
                                name: m.name || m.displayName || docSnap.id,
                                avatar: m.avatar || m.photoURL || '',
                            }
                        })
                        if (members.length === 0) {
                            // Fallback to map if subcollection is empty
                            const memberEntries = Object.entries(data.teamMembers ?? {})
                            const fallbackMembers = memberEntries.map(([uid, entry]: [string, any]) => ({
                                uid,
                                name: entry.name ?? entry.displayName ?? uid,
                                avatar: entry.avatar ?? entry.photoURL ?? '',
                            }))
                            setTeamMembers(fallbackMembers)
                        } else {
                            setTeamMembers(members)
                        }
                    } catch (mErr) {
                        console.error('Error fetching members subcollection:', mErr)
                        // Fallback
                        const memberEntries = Object.entries(data.teamMembers ?? {})
                        const fallbackMembers = memberEntries.map(([uid, entry]: [string, any]) => ({
                            uid,
                            name: entry.name ?? entry.displayName ?? uid,
                            avatar: entry.avatar ?? entry.photoURL ?? '',
                        }))
                        setTeamMembers(fallbackMembers)
                    }

                    // Show onboarding modal if not yet decided
                    // (evaluated after the state sets above settle — but safe to
                    //  compute from local `data` which is synchronous here)
                    if (!data.onboardingDecision) {
                        setShowOnboarding(true)
                    }
                } else {
                    navigate('/dashboard/projects')
                }
            } catch (error) {
                console.error('Error loading project:', error)
            } finally {
                setLoading(false)
            }
        }

        loadProject()
    }, [id, user?.uid])
    //       ^^^^^^^^ stable primitive — not the whole user object

    // ── Effect 1.5: Unread Chat Messages Listener ─────────────────────────────
    useEffect(() => {
        if (!id || !user || !permissions) {
            setUnreadCount(0)
            return
        }

        const canReadChat = () => {
            if (isOwner || isAdmin) return true
            const permKey = TAB_PERMISSION_MAP['chat']
            if (!permKey || !permissions) return false
            return permissions[permKey]?.read ?? false
        }

        if (!canReadChat()) {
            setUnreadCount(0)
            return
        }

        const memberRef = rtdbRef(database, `projectMembers/${id}/${user.uid}`)
        let lastRead = 0

        const unsubMember = rtdbOnValue(memberRef, (snap) => {
            const val = snap.val()
            if (val && typeof val === 'object') {
                lastRead = val.lastReadTimestamp || 0
            } else if (typeof val === 'number') {
                lastRead = val
            }
            updateUnreadCount()
        })

        const chatsRef = rtdbQuery(rtdbRef(database, `chats/${id}`), rtdbLimitToLast(100))
        let chatMsgs: any[] = []

        const unsubChats = rtdbOnValue(chatsRef, (snap) => {
            const data = snap.val()
            if (data) {
                chatMsgs = Object.keys(data).map(k => ({
                    id: k,
                    ...data[k]
                }))
            } else {
                chatMsgs = []
            }
            updateUnreadCount()
        })

        const updateUnreadCount = () => {
            if (!user) return
            const count = chatMsgs.filter(m =>
                m.senderId !== user.uid &&
                m.timestamp > lastRead
            ).length
            setUnreadCount(count)
        }

        return () => {
            rtdbOff(memberRef)
            rtdbOff(chatsRef)
        }
    }, [id, user?.uid, permissions, isOwner, isAdmin])

    // ── Effect 2: Tasks listener ──────────────────────────────────────────────
    // CRITICAL: Only start AFTER permissions have resolved AND user is confirmed
    // as a member (isOwner, isAdmin, or has task read permission).
    // This prevents the listener from opening before Firestore can verify access.
    useEffect(() => {
        // ── Wait for everything to resolve first ──────────────────────────────
        if (!id || !user?.uid) return
        if (authLoading) return   // auth not ready
        if (permissionsLoading) return   // permissions not ready

        // ── Check if user has ANY access to this project ──────────────────────
        // isOwner/isAdmin → always allowed
        // Otherwise check if they have tasks read permission
        const hasTaskAccess =
            isOwner ||
            isAdmin ||
            (permissions?.tasks?.read ?? false)

        if (!hasTaskAccess) {
            // User is confirmed as having no access — stop here
            // Don't start the listener — it would just fail with permission error
            setTasks([])
            return
        }

        // ── Clean up any previous listener before starting a new one ──────────
        if (unsubscribeTasksRef.current) {
            unsubscribeTasksRef.current()
            unsubscribeTasksRef.current = null
        }

        // ── Start the listener — user is confirmed to have access ─────────────
        const q = query(collection(db, 'projects', id, 'tasks'))

        const unsubscribe = onSnapshot(
            q,
            snapshot => {
                setTasks(
                    snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Task)
                )
            },
            error => {
                // This should no longer fire since we gate on permissions above
                console.error('Error fetching tasks:', error)
            }
        )

        unsubscribeTasksRef.current = unsubscribe
        return () => {
            unsubscribe()
            unsubscribeTasksRef.current = null
        }

    }, [
        id,
        user?.uid,          // stable string
        authLoading,        // wait for auth
        permissionsLoading, // wait for permissions
        isOwner,            // re-run if role changes
        isAdmin,
        permissions?.tasks?.read,  // re-run if task permission changes
    ])

    // ── Effect 2.5: Auto-move overdue tasks to backlog ──────────────────────────
    useEffect(() => {
        if (!id || !user?.uid || !tasks || tasks.length === 0) return
        if (permissionsLoading || authLoading || loading) return

        // Only users with write access can perform the update
        if (!canWriteTab('kanban')) return

        const now = new Date()
        const overdueTasksToMove = tasks.filter(task => {
            if (!task.dueDate) return false
            if (task.status === 'done' || task.status === 'backlog') return false

            let due: Date
            if (task.dueDate instanceof Date) {
                due = task.dueDate
            } else if ((task.dueDate as any)?.toDate) {
                due = (task.dueDate as any).toDate()
            } else {
                due = new Date(task.dueDate as any)
            }

            if (isNaN(due.getTime())) return false
            return due < now
        })

        if (overdueTasksToMove.length === 0) return

        const moveOverdueTasks = async () => {
            for (const task of overdueTasksToMove) {
                try {
                    await updateDoc(doc(db, 'projects', id, 'tasks', task.id), {
                        status: 'backlog',
                        updatedAt: serverTimestamp()
                    })
                    console.log(`Auto-moved overdue task ${task.id} to backlog`)
                } catch (err) {
                    console.error(`Failed to auto-move task ${task.id}:`, err)
                }
            }
        }

        moveOverdueTasks()
    }, [tasks, id, user?.uid, permissionsLoading, authLoading, loading])

    // ── Effect 3: Activities listener ────────────────────────────────────
    useEffect(() => {
        if (!id || !user?.uid) return
        const q = query(
            collection(db, 'projects', id, 'activities'),
            orderBy('timestamp', 'desc'),
            limit(10)
        )
        const unsub = onSnapshot(q, snap => {
            setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        })
        return () => unsub()
    }, [id, user?.uid])

    // ── Methodology change handler removed — no longer applicable ─────────────

    // ── Save task ─────────────────────────────────────────────────────────────
    const handleSaveTask = async (taskData: Partial<Task>) => {
        if (!id || !user?.uid) return

        try {
            const { dueDate, assignee, assigneeId, ...rest } = taskData

            const firestorePayload: Record<string, any> = {
                ...rest,
                dueDate: dueDate instanceof Date && !isNaN(dueDate.getTime())
                    ? dueDate
                    : null,
                assigneeId: assigneeId || null,
                assignee: assigneeId && assignee
                    ? {
                        id: assignee.id,
                        name: assignee.name,
                        avatar: assignee.avatar ?? null,
                    }
                    : null,
            }

            if (editingTask) {
                await updateDoc(
                    doc(db, 'projects', id, 'tasks', editingTask.id),
                    { ...firestorePayload, updatedAt: serverTimestamp() }
                )
            } else {
                await addDoc(
                    collection(db, 'projects', id, 'tasks'),
                    {
                        ...firestorePayload,
                        projectId: id,
                        status: taskData.status || 'todo',
                        createdBy: user.uid,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    }
                )
            }
            setEditingTask(null)
        } catch (error) {
            console.error('Failed to save task:', error)
        }
    }

    const openNewTaskDialog = () => {
        setEditingTask(null)
        setIsTaskDialogOpen(true)
    }

    // ── Permission helpers ────────────────────────────────────────────────────
    const canViewTab = (tabKey: string): boolean => {
        if (isOwner || isAdmin) return true
        const permKey = TAB_PERMISSION_MAP[tabKey]
        if (!permKey || !permissions) return false
        return permissions[permKey]?.read ?? false
    }

    const canWriteTab = (tabKey: string): boolean => {
        if (isOwner || isAdmin) return true
        const permKey = TAB_PERMISSION_MAP[tabKey]
        if (!permKey || !permissions) return false
        return permissions[permKey]?.write ?? false
    }

    // ── Pending review count for badge ────────────────────────────────────────
    const pendingReviewCount = tasks.filter(t => (t as any).reviewStatus === 'pending_review').length

    // ── Loading — wait for ALL three to resolve ───────────────────────────────
    if (loading || authLoading || permissionsLoading) {
        return (
            <DashboardLayout>
                <div className="flex justify-center items-center h-[calc(100vh-100px)]">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
            </DashboardLayout>
        )
    }

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <DashboardLayout>
            <div className="h-full flex flex-col space-y-6">

                {/* ── Header ── */}
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="flex items-start gap-2 min-w-0">
                            <Button
                                variant="ghost" size="sm"
                                className="h-6 w-6 p-0 mt-1 shrink-0"
                                onClick={() => navigate('/dashboard/projects')}
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
                                        {project?.title}
                                    </h1>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${project?.status === 'active'
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                                            : project?.status === 'completed'
                                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100'
                                                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
                                        }`}>
                                        {project?.status}
                                    </span>
                                </div>
                                <p className="text-muted-foreground text-sm mt-0.5">
                                    {project?.summary || 'Manage your project tasks, team, and timeline.'}
                                </p>
                            </div>
                        </div>
                        <div className="shrink-0 sm:self-center flex items-center gap-2">
                            {canViewTab('chat') && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setActiveTab('chat')}
                                    className="border-primary/30 hover:border-primary/70 bg-primary/5 hover:bg-primary/10 transition-all font-medium text-xs py-1 h-8 flex items-center gap-1.5 relative"
                                >
                                    <MessageSquare className="h-3.5 w-3.5 text-primary" />
                                    <span>Team Chat</span>
                                    {activeTab !== 'chat' && unreadCount > 0 && (
                                        <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center animate-pulse">
                                            {unreadCount}
                                        </span>
                                    )}
                                </Button>
                            )}
                            <ProjectGuide />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {(isOwner || isAdmin) && (
                            <Button onClick={openNewTaskDialog} size="sm">
                                <Plus className="h-4 w-4 mr-1 sm:mr-2" />
                                <span className="hidden xs:inline">New Task</span>
                                <span className="xs:hidden">Task</span>
                            </Button>
                        )}


                        {/* Templates button: shown only if owner chose template AND hasn't applied yet */}
                        {(isOwner || isAdmin) &&
                            onboardingDecision === 'template' &&
                            !project?.templateAppliedAt && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowTemplates(true)}
                                >
                                    <span className="hidden sm:inline">Apply Template</span>
                                    <span className="sm:hidden">Template</span>
                                </Button>
                            )}

                        {(isOwner || isAdmin || isMember) && project?.status !== 'completed' && (
                            <Button
                                size="sm"
                                variant="outline"
                                className={`h-8 ${hasVoted
                                        ? 'border-zinc-300 dark:border-zinc-700 text-zinc-500 cursor-not-allowed bg-zinc-50 dark:bg-zinc-900/50'
                                        : 'border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-950/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50'
                                    }`}
                                onClick={handleCompleteProject}
                                disabled={updatingStatus || hasVoted}
                            >
                                {updatingStatus ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                        {hasVoted ? `Voted (${voteCount}/${requiredVotes})` : `Complete Project (${voteCount}/${requiredVotes})`}
                                    </>
                                )}
                            </Button>
                        )}

                        {project?.status === 'completed' && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 h-8"
                                onClick={() => setIsCompletionModalOpen(true)}
                            >
                                <Share2 className="h-4 w-4 mr-2" />
                                Showcase & Resume
                            </Button>
                        )}

                        {(isOwner || isAdmin || canManageTeam) && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="border-violet-300 dark:border-violet-700 bg-violet-50/50 dark:bg-violet-950/20 text-violet-750 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/50 h-8 flex items-center gap-1.5"
                                onClick={() => setIsConfigureShowcaseOpen(true)}
                                title="Configure recruiter showcase info"
                            >
                                <Sparkles className="h-4 w-4" />
                                <span className="hidden sm:inline">Public Showcase Info</span>
                                <span className="sm:hidden">Showcase</span>
                            </Button>
                        )}

                        {(isOwner || isAdmin || canManageTeam) && (
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => navigate(`/project/${id}/manage-team`)}
                                title="Project settings"
                            >
                                <Settings className="h-4 w-4 text-muted-foreground" />
                            </Button>
                        )}

                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setShareDialogOpen(true)}
                            title="Share project"
                        >
                            <Share2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    </div>
                </div>

                {/* ── Main Tabs ── */}
                <Tabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                    className="flex-1 flex flex-col"
                >
                    <div className="border-b overflow-x-auto pretty-scrollbar pb-1">
                        <TabsList className="w-full justify-start h-12 bg-transparent p-0 min-w-max">

                            {canViewTab('overview') && (
                                <TabsTrigger value="overview"
                                    className="data-[state=active]:bg-transparent
                                               data-[state=active]:border-b-2
                                               data-[state=active]:border-primary
                                               data-[state=active]:shadow-none
                                               rounded-none h-full px-3 sm:px-4">
                                    <LayoutDashboard className="h-4 w-4 sm:mr-2" />
                                    <span className="hidden sm:inline">Overview</span>
                                </TabsTrigger>
                            )}

                            {canViewTab('kanban') && (
                                <TabsTrigger value="kanban"
                                    className="data-[state=active]:bg-transparent
                                               data-[state=active]:border-b-2
                                               data-[state=active]:border-primary
                                               data-[state=active]:shadow-none
                                               rounded-none h-full px-3 sm:px-4">
                                    <KanbanSquare className="h-4 w-4 sm:mr-2" />
                                    <span className="hidden sm:inline">Kanban</span>
                                </TabsTrigger>
                            )}

                            {canViewTab('gantt') && (
                                <TabsTrigger value="gantt"
                                    className="data-[state=active]:bg-transparent
                                               data-[state=active]:border-b-2
                                               data-[state=active]:border-primary
                                               data-[state=active]:shadow-none
                                               rounded-none h-full px-3 sm:px-4">
                                    <GanttChartSquare className="h-4 w-4 sm:mr-2" />
                                    <span className="hidden sm:inline">Gantt</span>
                                </TabsTrigger>
                            )}

                            {canViewTab('calendar') && (
                                <TabsTrigger value="calendar"
                                    className="data-[state=active]:bg-transparent
                                               data-[state=active]:border-b-2
                                               data-[state=active]:border-primary
                                               data-[state=active]:shadow-none
                                               rounded-none h-full px-3 sm:px-4">
                                    <CalendarDays className="h-4 w-4 sm:mr-2" />
                                    <span className="hidden sm:inline">Calendar</span>
                                </TabsTrigger>
                            )}

                            {canViewTab('meetings') && (
                                <TabsTrigger value="meetings"
                                    className="data-[state=active]:bg-transparent
                                               data-[state=active]:border-b-2
                                               data-[state=active]:border-primary
                                               data-[state=active]:shadow-none
                                               rounded-none h-full px-3 sm:px-4">
                                    <Video className="h-4 w-4 sm:mr-2" />
                                    <span className="hidden sm:inline">Meetings</span>
                                </TabsTrigger>
                            )}

                            {canViewTab('team') && (
                                <TabsTrigger value="team"
                                    className="data-[state=active]:bg-transparent
                                               data-[state=active]:border-b-2
                                               data-[state=active]:border-primary
                                               data-[state=active]:shadow-none
                                               rounded-none h-full px-3 sm:px-4">
                                    <Users className="h-4 w-4 sm:mr-2" />
                                    <span className="hidden sm:inline">Team</span>
                                </TabsTrigger>
                            )}

                            {canViewTab('analytics') && (
                                <TabsTrigger value="analytics"
                                    className="data-[state=active]:bg-transparent
                                               data-[state=active]:border-b-2
                                               data-[state=active]:border-primary
                                               data-[state=active]:shadow-none
                                               rounded-none h-full px-3 sm:px-4">
                                    <BarChart3 className="h-4 w-4 sm:mr-2" />
                                    <span className="hidden sm:inline">Analytics</span>
                                </TabsTrigger>
                            )}



                            {canViewTab('documents') && (
                                <TabsTrigger value="documents"
                                    className="data-[state=active]:bg-transparent
                                               data-[state=active]:border-b-2
                                               data-[state=active]:border-primary
                                               data-[state=active]:shadow-none
                                               rounded-none h-full px-3 sm:px-4">
                                    <FolderOpen className="h-4 w-4 sm:mr-2" />
                                    <span className="hidden sm:inline">Drive Docs</span>
                                </TabsTrigger>
                            )}



                            {canViewTab('budget') && (
                                <TabsTrigger value="budget"
                                    className="data-[state=active]:bg-transparent
                                               data-[state=active]:border-b-2
                                               data-[state=active]:border-primary
                                               data-[state=active]:shadow-none
                                               rounded-none h-full px-3 sm:px-4">
                                    <BarChart3 className="h-4 w-4 sm:mr-2" />
                                    <span className="hidden sm:inline">Budget</span>
                                </TabsTrigger>
                            )}

                            {canViewTab('gallery') && (
                                <TabsTrigger value="gallery"
                                    className="data-[state=active]:bg-transparent
                                               data-[state=active]:border-b-2
                                               data-[state=active]:border-primary
                                               data-[state=active]:shadow-none
                                               rounded-none h-full px-3 sm:px-4">
                                    <Image className="h-4 w-4 sm:mr-2" />
                                    <span className="hidden sm:inline">Gallery</span>
                                </TabsTrigger>
                            )}

                            {/* For plain members — show "My Tasks" tab */}
                            {!isOwner && !isAdmin && canViewTab('mytasks') && (
                                <TabsTrigger value="mytasks"
                                    className="data-[state=active]:bg-transparent
                                               data-[state=active]:border-b-2
                                               data-[state=active]:border-primary
                                               data-[state=active]:shadow-none
                                               rounded-none h-full px-3 sm:px-4">
                                    <ClipboardList className="h-4 w-4 sm:mr-2" />
                                    <span className="hidden sm:inline">My Tasks</span>
                                </TabsTrigger>
                            )}

                            {/* For owner/admin — show "Reviews" tab with pending count badge */}
                            {(isOwner || isAdmin) && (
                                <TabsTrigger value="reviews"
                                    className="data-[state=active]:bg-transparent
                                               data-[state=active]:border-b-2
                                               data-[state=active]:border-primary
                                               data-[state=active]:shadow-none
                                               rounded-none h-full px-3 sm:px-4 relative">
                                    <Star className="h-4 w-4 sm:mr-2" />
                                    <span className="hidden sm:inline">Reviews</span>
                                    {pendingReviewCount > 0 && (
                                        <span className="ml-1.5 bg-destructive text-destructive-foreground
                                                         text-xs rounded-full h-4 w-4 flex items-center
                                                         justify-center font-bold">
                                            {pendingReviewCount}
                                        </span>
                                    )}
                                </TabsTrigger>
                            )}

                        </TabsList>
                    </div>

                    {/* ── Tab Content ── */}
                    <div className="flex-1 min-h-0">
                        <Suspense fallback={<TabLoader />}>

                            {/* Overview */}
                            <TabsContent value="overview" className="focus-visible:outline-none h-[calc(100vh-11rem)] overflow-y-auto space-y-4 px-1 pb-6">
                                {!canViewTab('overview') ? (
                                    <AccessDenied feature="the Overview" />
                                ) : (
                                    <>
                                        {!canWriteTab('overview') && <ReadOnlyNotice />}
                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">

                                            <Card>
                                                <CardHeader className="flex flex-row items-center
                                                                    justify-between space-y-0 pb-2">
                                                    <CardTitle className="text-sm font-medium">
                                                        Total Progress
                                                    </CardTitle>
                                                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                                                </CardHeader>
                                                <CardContent>
                                                    {(() => {
                                                        const total = tasks.length
                                                        const done = tasks.filter(t => t.status === 'done').length
                                                        const progress = total > 0
                                                            ? Math.round((done / total) * 100)
                                                            : 0
                                                        return (
                                                            <>
                                                                <div className="text-2xl font-bold">
                                                                    {progress}%
                                                                </div>
                                                                <Progress value={progress} className="mt-2" />
                                                                <p className="text-xs text-muted-foreground mt-2">
                                                                    {done} of {total} tasks completed
                                                                </p>
                                                            </>
                                                        )
                                                    })()}
                                                </CardContent>
                                            </Card>

                                            <Card>
                                                <CardHeader className="flex flex-row items-center
                                                                    justify-between space-y-0 pb-2">
                                                    <CardTitle className="text-sm font-medium">
                                                        Active Tasks
                                                    </CardTitle>
                                                    <KanbanSquare className="h-4 w-4 text-muted-foreground" />
                                                </CardHeader>
                                                <CardContent>
                                                    {(() => {
                                                        const active = tasks.filter(t =>
                                                            t.status === 'in-progress' ||
                                                            t.status === 'todo'
                                                        ).length
                                                        const high = tasks.filter(t =>
                                                            (t.status === 'in-progress' ||
                                                                t.status === 'todo') &&
                                                            (t.priority === 'high' ||
                                                                t.priority === 'urgent')
                                                        ).length
                                                        return (
                                                            <>
                                                                <div className="text-2xl font-bold">
                                                                    {active}
                                                                </div>
                                                                <p className="text-xs text-muted-foreground mt-1">
                                                                    {high} high priority
                                                                </p>
                                                            </>
                                                        )
                                                    })()}
                                                </CardContent>
                                            </Card>

                                            <Card>
                                                <CardHeader className="flex flex-row items-center
                                                                    justify-between space-y-0 pb-2">
                                                    <CardTitle className="text-sm font-medium">
                                                        Team Members
                                                    </CardTitle>
                                                    <Users className="h-4 w-4 text-muted-foreground" />
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="text-2xl font-bold">
                                                        {teamMembers.length}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {project?.maxMembers
                                                            ? `${Math.max(0, project.maxMembers - teamMembers.length)} spots remaining`
                                                            : 'Open for applications'
                                                        }
                                                    </p>
                                                </CardContent>
                                            </Card>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                            <Card className="col-span-1 lg:col-span-3">
                                                <CardHeader className="flex flex-row items-start
                                                                    justify-between gap-2">
                                                    <div>
                                                        <CardTitle className="flex items-center gap-2">
                                                            <Activity className="h-4 w-4" />
                                                            Recent Activity
                                                        </CardTitle>
                                                        <CardDescription className="mt-1">
                                                            Latest 10 updates from your team
                                                        </CardDescription>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <button
                                                            onClick={() => {
                                                                if (!id || !user?.uid) return
                                                                const q = query(
                                                                    collection(db, 'projects', id, 'activities'),
                                                                    orderBy('timestamp', 'desc'),
                                                                    limit(10)
                                                                )
                                                                onSnapshot(q, snap =>
                                                                    setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() })))
                                                                )
                                                            }}
                                                            title="Refresh activity"
                                                            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors active:scale-95"
                                                        >
                                                            <RefreshCw className="h-3.5 w-3.5" />
                                                        </button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="shrink-0 gap-1.5 h-7 text-xs"
                                                            onClick={() => {
                                                                // Load all activities when sheet opens
                                                                if (!id || !user?.uid) return
                                                                const q = query(
                                                                    collection(db, 'projects', id, 'activities'),
                                                                    orderBy('timestamp', 'desc')
                                                                )
                                                                onSnapshot(q, snap => {
                                                                    setAllActivities(
                                                                        snap.docs.map(d => ({ id: d.id, ...d.data() }))
                                                                    )
                                                                })
                                                                setShowAllActivity(true)
                                                            }}
                                                        >
                                                            View All
                                                            <ChevronRight className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>

                                                </CardHeader>
                                                <CardContent>
                                                    {activities.length === 0 ? (
                                                        <div className="flex flex-col items-center
                                                                    justify-center py-8
                                                                    text-muted-foreground gap-2">
                                                            <Activity className="h-8 w-8 opacity-30" />
                                                            <p className="text-sm">No activity yet</p>
                                                            <p className="text-xs opacity-60">
                                                                Activity will appear here as your team works
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-3">
                                                            {activities.map((activity, i) => {
                                                                const ts = activity.timestamp?.toDate
                                                                    ? activity.timestamp.toDate()
                                                                    : activity.timestamp
                                                                        ? new Date(activity.timestamp)
                                                                        : null
                                                                return (
                                                                    <div key={activity.id ?? i}
                                                                        className="flex items-start gap-3
                                                                               pb-3 border-b last:border-0">
                                                                        <div className="h-7 w-7 rounded-full
                                                                                    bg-primary/10 flex
                                                                                    items-center justify-center
                                                                                    shrink-0 mt-0.5">
                                                                            <Activity className="h-3.5 w-3.5 text-primary" />
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-sm
                                                                                       line-clamp-2 leading-snug">
                                                                                {activity.description || 'Activity'}
                                                                            </p>
                                                                            {ts && (
                                                                                <p className="text-xs
                                                                                           text-muted-foreground
                                                                                           mt-0.5">
                                                                                    {formatDistanceToNow(ts, { addSuffix: true })}
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </Card>

                                            {/* ── Full Activity Sheet ── */}
                                            <Sheet open={showAllActivity} onOpenChange={setShowAllActivity}>
                                                <SheetContent side="right" className="w-full sm:max-w-[480px] p-0">
                                                    <SheetHeader className="px-6 py-5 border-b">
                                                        <SheetTitle className="flex items-center gap-2">
                                                            <Activity className="h-5 w-5" />
                                                            All Activity
                                                        </SheetTitle>
                                                        <SheetDescription>
                                                            Complete history of project activity,
                                                            newest first
                                                        </SheetDescription>
                                                    </SheetHeader>
                                                    <ScrollArea className="h-[calc(100vh-120px)]">
                                                        <div className="px-6 py-4">
                                                            {allActivities.length === 0 ? (
                                                                <div className="flex flex-col items-center
                                                                            justify-center py-16
                                                                            text-muted-foreground gap-3">
                                                                    <Activity className="h-10 w-10 opacity-20" />
                                                                    <p className="text-sm">No activity yet</p>
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-1">
                                                                    {allActivities.map((activity, i) => {
                                                                        const ts = activity.timestamp?.toDate
                                                                            ? activity.timestamp.toDate()
                                                                            : activity.timestamp
                                                                                ? new Date(activity.timestamp)
                                                                                : null
                                                                        return (
                                                                            <div key={activity.id ?? i}
                                                                                className="flex items-start gap-3
                                                                                       py-3.5 border-b
                                                                                       last:border-0">
                                                                                <div className="h-8 w-8 rounded-full
                                                                                            bg-primary/10 flex
                                                                                            items-center justify-center
                                                                                            shrink-0 mt-0.5">
                                                                                    <Activity className="h-4 w-4 text-primary" />
                                                                                </div>
                                                                                <div className="flex-1 min-w-0">
                                                                                    <p className="text-sm leading-snug">
                                                                                        {activity.description || 'Activity'}
                                                                                    </p>
                                                                                    {ts && (
                                                                                        <p className="text-xs
                                                                                                   text-muted-foreground
                                                                                                   mt-1">
                                                                                            {ts.toLocaleDateString(
                                                                                                undefined,
                                                                                                { month: 'short', day: 'numeric', year: 'numeric' }
                                                                                            )}{' '}·{' '}
                                                                                            {ts.toLocaleTimeString(
                                                                                                undefined,
                                                                                                { hour: '2-digit', minute: '2-digit' }
                                                                                            )}
                                                                                        </p>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        )
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </ScrollArea>
                                                </SheetContent>
                                            </Sheet>
                                        </div>
                                    </>
                                )}
                            </TabsContent>

                            {/* Kanban */}
                            <TabsContent value="kanban" className="focus-visible:outline-none h-[calc(100vh-11rem)] overflow-hidden">
                                {!canViewTab('kanban') ? (
                                    <AccessDenied feature="Tasks/Kanban" />
                                ) : (
                                    <KanbanBoard
                                        readOnly={!canWriteTab('kanban')}
                                        tasks={tasks}
                                    />
                                )}
                            </TabsContent>

                            {/* Gantt */}
                            <TabsContent value="gantt" className="focus-visible:outline-none h-[calc(100vh-11rem)] overflow-hidden">
                                {!canViewTab('gantt') ? (
                                    <AccessDenied feature="Gantt Chart" />
                                ) : (
                                    <GanttChart
                                        readOnly={!canWriteTab('gantt')}
                                    />
                                )}
                            </TabsContent>

                            {/* Calendar */}
                            <TabsContent value="calendar" className="focus-visible:outline-none h-[calc(100vh-11rem)] overflow-y-auto">
                                {!canViewTab('calendar') ? (
                                    <AccessDenied feature="Calendar" />
                                ) : (
                                    <>
                                        {!canWriteTab('calendar') && <ReadOnlyNotice />}
                                        <ProjectCalendar readOnly={!canWriteTab('calendar')} />
                                    </>
                                )}
                            </TabsContent>

                            {/* Meetings */}
                            <TabsContent value="meetings" className="focus-visible:outline-none h-[calc(100vh-11rem)] overflow-y-auto">
                                {!canViewTab('meetings') ? (
                                    <AccessDenied feature="Meetings" />
                                ) : (
                                    <>
                                        {!canWriteTab('meetings') && <ReadOnlyNotice />}
                                        <MeetingRoom readOnly={!canWriteTab('meetings')} />
                                    </>
                                )}
                            </TabsContent>

                            {/* Team */}
                            <TabsContent value="team" className="focus-visible:outline-none h-[calc(100vh-11rem)] overflow-y-auto">
                                {!canViewTab('team') ? (
                                    <AccessDenied feature="Team" />
                                ) : (
                                    <ResourceManagement readOnly={!canWriteTab('team')} />
                                )}
                            </TabsContent>

                            {/* Analytics */}
                            <TabsContent value="analytics" className="focus-visible:outline-none h-[calc(100vh-11rem)] overflow-y-auto">
                                {!canViewTab('analytics') ? (
                                    <AccessDenied feature="Analytics" />
                                ) : (
                                    <Analytics />
                                )}
                            </TabsContent>



                            {/* Google Drive Docs */}
                            <TabsContent value="documents" className="focus-visible:outline-none h-[calc(100vh-11rem)] overflow-hidden">
                                {!canViewTab('documents') ? (
                                    <AccessDenied feature="Google Drive Documents" />
                                ) : (
                                    <Suspense fallback={<TabLoader />}>
                                        <GoogleDocsPanel />
                                    </Suspense>
                                )}
                            </TabsContent>

                            {/* Team Chat */}
                            <TabsContent value="chat" className="focus-visible:outline-none h-[calc(100vh-11rem)] overflow-hidden">
                                {!canViewTab('chat') ? (
                                    <AccessDenied feature="Team Chat" />
                                ) : (
                                    <Suspense fallback={<TabLoader />}>
                                        <TeamChat />
                                    </Suspense>
                                )}
                            </TabsContent>

                            {/* Budget */}
                            <TabsContent value="budget" className="focus-visible:outline-none h-[calc(100vh-11rem)] overflow-y-auto">
                                {!canViewTab('budget') ? (
                                    <AccessDenied feature="Budget" />
                                ) : (
                                    <>
                                        {!canWriteTab('budget') && <ReadOnlyNotice />}
                                        <BudgetTracker readOnly={!canWriteTab('budget')} />
                                    </>
                                )}
                            </TabsContent>

                            {/* Gallery */}
                            <TabsContent value="gallery" className="focus-visible:outline-none h-[calc(100vh-11rem)] overflow-y-auto">
                                {!canViewTab('gallery') ? (
                                    <AccessDenied feature="Gallery" />
                                ) : (
                                    <>
                                        {!canWriteTab('gallery') && <ReadOnlyNotice />}
                                        <GalleryView readOnly={!canWriteTab('gallery')} />
                                    </>
                                )}
                            </TabsContent>

                            {/* My Tasks — members only */}
                            <TabsContent value="mytasks" className="focus-visible:outline-none h-[calc(100vh-11rem)] overflow-y-auto">
                                <MyTasksPanel tasks={tasks} />
                            </TabsContent>

                            {/* Reviews — owner/admin only */}
                            <TabsContent value="reviews" className="focus-visible:outline-none h-[calc(100vh-11rem)] overflow-y-auto">
                                {(isOwner || isAdmin) ? (
                                    <TaskReviewPanel
                                        tasks={tasks}
                                        teamMembers={teamMembers}
                                    />
                                ) : (
                                    <AccessDenied feature="Reviews" />
                                )}
                            </TabsContent>

                        </Suspense>
                    </div>
                </Tabs>
            </div>

            {/* ── One-time project onboarding decision modal (owner only) ── */}
            {isOwner && showOnboarding && onboardingDecision === null && (
                <ProjectOnboardingModal
                    projectName={project?.title ?? 'this project'}
                    onDecide={async (decision) => {
                        setShowOnboarding(false)
                        setOnboardingDecision(decision)
                        // Persist to Firestore
                        try {
                            await updateDoc(doc(db, 'projects', id!), {
                                onboardingDecision: decision,
                                updatedAt: serverTimestamp(),
                            })
                        } catch (err) {
                            console.error('Failed to save onboarding decision:', err)
                        }
                        // If they chose template, open the gallery immediately
                        if (decision === 'template') {
                            setShowTemplates(true)
                        }
                    }}
                />
            )}

            {/* Templates */}
            {(isOwner || isAdmin) && onboardingDecision === 'template' && (
                <Suspense fallback={null}>
                    <TemplateGallery
                        open={showTemplates}
                        onClose={() => setShowTemplates(false)}
                        projectId={id!}
                        projectName={project?.title ?? ''}
                        onApplied={(updatedName: string) => {
                            setProject((prev: any) => ({
                                ...prev,
                                title: updatedName,
                                templateAppliedAt: new Date(), // mark locally so button hides
                            }))
                            setShowTemplates(false)
                            setActiveTab('kanban')
                        }}
                    />
                </Suspense>
            )}

            {/* Global task dialog */}
            <Suspense fallback={null}>
                <TaskDialog
                    open={isTaskDialogOpen}
                    onOpenChange={setIsTaskDialogOpen}
                    task={editingTask}
                    onSave={handleSaveTask}
                />
            </Suspense>

            {/* Project Completion Modal */}
            <ProjectCompletionModal
                open={isCompletionModalOpen}
                onOpenChange={setIsCompletionModalOpen}
                projectId={id!}
                projectTitle={project?.title || ''}
                projectSummary={project?.summary || ''}
                completedTaskCount={tasks.filter(t => t.status === 'done').length}
                teamMemberCount={teamMembers.length}
                onNavigateToReviews={() => setActiveTab('team')}
                onEditShowcase={() => setIsConfigureShowcaseOpen(true)}
                completedTasksList={tasks.filter(t => t.status === 'done' && t.assigneeId === user?.uid).map(t => t.title)}
                primaryDiscipline={project?.primaryDiscipline || 'Software Development'}
                tags={project?.tags || []}
                activityVerified={project?.activityVerified || false}
            />

            {/* Configure Recruiter Showcase Modal */}
            <ConfigureShowcaseModal
                open={isConfigureShowcaseOpen}
                onOpenChange={setIsConfigureShowcaseOpen}
                projectId={id!}
                onSaved={() => {
                    // Refetch project data from firestore to make sure page states refresh if needed
                    cachedGetDoc(doc(db, 'projects', id!)).then(snap => {
                        if (snap?.exists()) {
                            setProject(snap.data())
                        }
                    })
                }}
            />

            {/* Share Dialog */}
            <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
                <DialogContent className="max-w-md bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 text-white p-6">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                            <Share2 className="h-5 w-5 text-primary" />
                            Share Project
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            Share "{project?.title || 'this project'}" showcase details page with others.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-3">
                        <div className="relative flex items-center w-full">
                            <input
                                type="text"
                                readOnly
                                value={project?.slug ? `${window.location.origin}/projects/${project.slug}` : `${window.location.origin}/project/public/${id}`}
                                className="w-full pr-20 pl-10 py-2.5 bg-zinc-900/60 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-300 truncate focus:outline-none select-all"
                            />
                            <Link2 className="absolute left-3 h-4 w-4 text-zinc-500 pointer-events-none" />
                            <Button
                                size="sm"
                                variant="ghost"
                                className="absolute right-1.5 h-8 text-xs flex items-center gap-1 hover:bg-zinc-800 text-zinc-300 hover:text-white"
                                onClick={handleCopyLink}
                            >
                                <Copy className="h-3.5 w-3.5" />
                                Copy
                            </Button>
                        </div>
                        <p className="text-xs text-zinc-500 text-center font-medium">Or share via social networks</p>
                        <div className="grid grid-cols-2 gap-3">
                            <Button variant="outline" className="w-full text-xs h-9 border-zinc-800 bg-zinc-900 hover:bg-zinc-800 hover:text-white" onClick={handleShareTwitter}>
                                <Twitter className="h-3.5 w-3.5 mr-2 text-sky-400 fill-sky-400" />
                                Twitter / X
                            </Button>
                            <Button variant="outline" className="w-full text-xs h-9 border-zinc-800 bg-zinc-900 hover:bg-zinc-800 hover:text-white" onClick={handleShareWhatsApp}>
                                <MessageCircle className="h-3.5 w-3.5 mr-2 text-green-500" />
                                WhatsApp
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    )
}

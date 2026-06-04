import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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
    Activity, CheckCircle2, XCircle, ChevronRight,
} from 'lucide-react'
import {
    doc, getDoc, updateDoc,
    collection, query, onSnapshot,
    addDoc, serverTimestamp, orderBy, limit,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Task } from '@/types/project'
import { useAuth } from '@/hooks/use-auth'
import { useProjectRole } from '@/hooks/use-project-role'
import { ClipboardList, Star } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { formatDistanceToNow } from 'date-fns'

// ⚡ OPTIMIZATION: Lazy-load all dashboard tab components.
// Previously all 13 tabs (including tldraw ~2MB, recharts ~400KB) were bundled
// together into a single 2.3MB chunk loaded on every project dashboard visit.
// Now each tab loads its own chunk only when first rendered.
// Whiteboard alone saves ~2MB on initial load for users who never open that tab.
const KanbanBoard      = lazy(() => import('@/components/dashboard/KanbanBoard').then(m => ({ default: m.KanbanBoard })))
const TaskDialog       = lazy(() => import('@/components/dashboard/TaskDialog').then(m => ({ default: m.TaskDialog })))
const GanttChart       = lazy(() => import('@/components/dashboard/GanttChart').then(m => ({ default: m.GanttChart })))
const ProjectCalendar  = lazy(() => import('@/components/dashboard/ProjectCalendar').then(m => ({ default: m.ProjectCalendar })))
const ResourceManagement = lazy(() => import('@/components/dashboard/ResourceManagement').then(m => ({ default: m.ResourceManagement })))
const AIInsights       = lazy(() => import('@/components/dashboard/AIInsights').then(m => ({ default: m.AIInsights })))
const Analytics        = lazy(() => import('@/components/dashboard/Analytics').then(m => ({ default: m.Analytics })))
const Whiteboard       = lazy(() => import('@/components/dashboard/Whiteboard').then(m => ({ default: m.Whiteboard })))
const GoogleDocsPanel  = lazy(() => import('@/components/dashboard/GoogleDocsPanel').then(m => ({ default: m.GoogleDocsPanel })))
const BudgetTracker    = lazy(() => import('@/components/dashboard/BudgetTracker').then(m => ({ default: m.BudgetTracker })))
const GalleryView      = lazy(() => import('@/components/dashboard/GalleryView').then(m => ({ default: m.GalleryView })))
const MeetingRoom      = lazy(() => import('@/components/dashboard/MeetingRoom').then(m => ({ default: m.MeetingRoom })))
const MyTasksPanel     = lazy(() => import('@/components/dashboard/MyTasksPanel').then(m => ({ default: m.MyTasksPanel })))
const TaskReviewPanel  = lazy(() => import('@/components/dashboard/TaskReviewPanel').then(m => ({ default: m.TaskReviewPanel })))
const TemplateGallery  = lazy(() => import('@/components/dashboard/TemplateGallery').then(m => ({ default: m.TemplateGallery })))

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
    overview:   'dashboard',
    kanban:     'tasks',
    gantt:      'gantt',
    calendar:   'calendar',
    meetings:   'calendar',
    team:       'dashboard',
    analytics:  'dashboard',
    whiteboard: 'whiteboard',
    documents:  'files',
    budget:     'dashboard',
    gallery:    'files',
    mytasks:    'tasks',    // ← new
    reviews:    'tasks',    // ← new
}

// ─────────────────────────────────────────────────────────────────────────────
export function ProjectDashboard() {
    const { id }                         = useParams()
    const navigate                       = useNavigate()
    const { user, loading: authLoading } = useAuth()
    const { canManageTeam }              = useProjectRole()
    const { toast }                      = useToast()
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

    const [loading,          setLoading]          = useState(true)
    const [project,          setProject]          = useState<any>(null)
    const [tasks,            setTasks]            = useState<Task[]>([])
    const [activities,       setActivities]       = useState<any[]>([])
    const [showAllActivity,  setShowAllActivity]  = useState(false)
    const [allActivities,    setAllActivities]    = useState<any[]>([])
    const [activeTab,        setActiveTab]        = useState('overview')
    const [showTemplates,    setShowTemplates]    = useState(false)
    const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false)
    const [editingTask,      setEditingTask]      = useState<Task | null>(null)

    // Track active listener for cleanup
    const unsubscribeTasksRef = useRef<(() => void) | null>(null)

    // ── Effect 1: Load project doc ────────────────────────────────────────────
    // Runs once when we have a stable userId — project doc is public read
    useEffect(() => {
        if (!id || !user?.uid) return

        const loadProject = async () => {
            try {
                const docSnap = await getDoc(doc(db, 'projects', id))
                if (docSnap.exists()) {
                    const data = docSnap.data()
                    setProject({ id: docSnap.id, ...data })
                    
                    // Load team members
                    const memberEntries = Object.entries(data.teamMembers ?? {})
                    const members = memberEntries.map(([uid, entry]: [string, any]) => ({
                        uid,
                        name:   entry.name   ?? entry.displayName ?? uid,
                        avatar: entry.avatar ?? entry.photoURL    ?? '',
                    }))
                    setTeamMembers(members)
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

    // ── Effect 2: Tasks listener ──────────────────────────────────────────────
    // CRITICAL: Only start AFTER permissions have resolved AND user is confirmed
    // as a member (isOwner, isAdmin, or has task read permission).
    // This prevents the listener from opening before Firestore can verify access.
    useEffect(() => {
        // ── Wait for everything to resolve first ──────────────────────────────
        if (!id || !user?.uid)       return
        if (authLoading)             return   // auth not ready
        if (permissionsLoading)      return   // permissions not ready

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
                dueDate:    dueDate instanceof Date && !isNaN(dueDate.getTime())
                    ? dueDate
                    : null,
                assigneeId: assigneeId || null,
                assignee:   assigneeId && assignee
                    ? {
                        id:     assignee.id,
                        name:   assignee.name,
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
                        status:    taskData.status || 'todo',
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
                    <div className="flex items-start gap-2">
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
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                                    project?.status === 'active'
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

                    <div className="flex flex-wrap items-center gap-2">
                        {(isOwner || isAdmin) && (
                            <Button onClick={openNewTaskDialog} size="sm">
                                <Plus className="h-4 w-4 mr-1 sm:mr-2" />
                                <span className="hidden xs:inline">New Task</span>
                                <span className="xs:hidden">Task</span>
                            </Button>
                        )}

                        {(isOwner || isAdmin) && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowTemplates(true)}
                            >
                                📦 <span className="hidden sm:inline ml-1">Templates</span>
                            </Button>
                        )}

                        {(isOwner || isAdmin || canManageTeam) && (
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => navigate(`/project/${id}/manage-team`)}
                            >
                                <Settings className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>

                {/* ── Main Tabs ── */}
                <Tabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                    className="flex-1 flex flex-col"
                >
                    <div className="border-b overflow-x-auto">
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

                            {canViewTab('whiteboard') && (
                                <TabsTrigger value="whiteboard"
                                    className="data-[state=active]:bg-transparent
                                               data-[state=active]:border-b-2
                                               data-[state=active]:border-primary
                                               data-[state=active]:shadow-none
                                               rounded-none h-full px-3 sm:px-4">
                                    <Pencil className="h-4 w-4 sm:mr-2" />
                                    <span className="hidden sm:inline">Whiteboard</span>
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
                                    <DollarSign className="h-4 w-4 sm:mr-2" />
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
                    <div className="flex-1 py-4">
                    <Suspense fallback={<TabLoader />}>

                        {/* Overview */}
                        <TabsContent value="overview" className="space-y-4">
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
                                                    const total    = tasks.length
                                                    const done     = tasks.filter(t => t.status === 'done').length
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
                                        <Card className="col-span-1 lg:col-span-2">
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
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="shrink-0 gap-1.5"
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

                                        <AIInsights tasks={tasks} />
                                    </div>
                                </>
                            )}
                        </TabsContent>

                        {/* Kanban */}
                        <TabsContent value="kanban" className="h-[calc(100vh-250px)]">
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
                        <TabsContent value="gantt" className="h-[calc(100vh-250px)]">
                            {!canViewTab('gantt') ? (
                                <AccessDenied feature="Gantt Chart" />
                            ) : (
                                <GanttChart
                                    readOnly={!canWriteTab('gantt')}
                                />
                            )}
                        </TabsContent>

                        {/* Calendar */}
                        <TabsContent value="calendar" className="h-[calc(100vh-250px)]">
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
                        <TabsContent value="meetings"
                                     className="h-[calc(100vh-250px)] overflow-y-auto">
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
                        <TabsContent value="team">
                            {!canViewTab('team') ? (
                                <AccessDenied feature="Team" />
                            ) : (
                                <ResourceManagement readOnly={!canWriteTab('team')} />
                            )}
                        </TabsContent>

                        {/* Analytics */}
                        <TabsContent value="analytics">
                            {!canViewTab('analytics') ? (
                                <AccessDenied feature="Analytics" />
                            ) : (
                                <Analytics />
                            )}
                        </TabsContent>

                        {/* Whiteboard */}
                        <TabsContent value="whiteboard" className="h-[calc(100vh-200px)]">
                            {!canViewTab('whiteboard') ? (
                                <AccessDenied feature="Whiteboard" />
                            ) : (
                                <>
                                    {!canWriteTab('whiteboard') && <ReadOnlyNotice />}
                                    <Whiteboard readOnly={!canWriteTab('whiteboard')} />
                                </>
                            )}
                        </TabsContent>

                        {/* Google Drive Docs */}
                        <TabsContent value="documents" className="h-[calc(100vh-200px)] overflow-hidden">
                            {!canViewTab('documents') ? (
                                <AccessDenied feature="Google Drive Documents" />
                            ) : (
                                <Suspense fallback={<TabLoader />}>
                                    <GoogleDocsPanel />
                                </Suspense>
                            )}
                        </TabsContent>

                        {/* Budget */}
                        <TabsContent value="budget">
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
                        <TabsContent value="gallery" className="h-[calc(100vh-200px)]">
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
                        <TabsContent value="mytasks" className="h-[calc(100vh-250px)] overflow-y-auto">
                            <MyTasksPanel tasks={tasks} />
                        </TabsContent>

                        {/* Reviews — owner/admin only */}
                        <TabsContent value="reviews" className="h-[calc(100vh-250px)] overflow-y-auto">
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

            {/* Templates */}
            {(isOwner || isAdmin) && (
                <Suspense fallback={null}>
                    <TemplateGallery
                        open={showTemplates}
                        onClose={() => setShowTemplates(false)}
                        projectId={id!}
                        projectName={project?.title ?? ''}
                        onApplied={(updatedName: string) => {
                            setProject((prev: any) => ({ ...prev, title: updatedName }))
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
        </DashboardLayout>
    )
}

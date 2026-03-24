import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { TemplateGallery } from '@/components/dashboard/TemplateGallery'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
    LayoutDashboard,
    KanbanSquare,
    GanttChartSquare,
    CalendarDays,
    Clock,
    Users,
    BarChart3,
    Settings,
    Plus,
    ArrowLeft,
    Loader2,
    Pencil,
    FileText,
    DollarSign,
    Image,
    Lock,
    AlertTriangle
} from 'lucide-react'
import { doc, getDoc, updateDoc, collection, query, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { ProjectMethodology, Task } from '@/types/project'
import { KanbanBoard } from '@/components/dashboard/KanbanBoard'
import { GanttChart } from '@/components/dashboard/GanttChart'
import { ProjectCalendar } from '@/components/dashboard/ProjectCalendar'
import { ResourceManagement } from '@/components/dashboard/ResourceManagement'
import { AIInsights } from '@/components/dashboard/AIInsights'
import { Analytics } from '@/components/dashboard/Analytics'
import { Whiteboard } from '@/components/dashboard/Whiteboard'
import { Documents } from '@/components/dashboard/Documents'
import { BudgetTracker } from '@/components/dashboard/BudgetTracker'
import { GalleryView } from '@/components/dashboard/GalleryView'

import { useAuth } from '@/hooks/use-auth'
import { useProjectRole } from '@/hooks/use-project-role'
import { usePermissions, MemberPermissions } from '@/hooks/use-permissions'

// Access denied component
function AccessDenied({ feature }: { feature: string }) {
    return (
        <div className="flex flex-col items-center justify-center h-64 text-center">
            <Lock className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
            <p className="text-muted-foreground max-w-md">
                You don't have permission to access {feature}. Contact the project owner if you need access.
            </p>
        </div>
    )
}

// Read-only notice component
function ReadOnlyNotice() {
    return (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
                You have read-only access to this section. Editing is disabled.
            </p>
        </div>
    )
}

export function ProjectDashboard() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { user, loading: authLoading } = useAuth()
    const { canManageTeam } = useProjectRole()
    const { permissions, loading: permissionsLoading, canWrite, isOwner, isAdmin } = usePermissions()
    const [loading, setLoading] = useState(true)
    const [project, setProject] = useState<any>(null)
    const [tasks, setTasks] = useState<Task[]>([])
    const [activeTab, setActiveTab] = useState('overview')
    const [methodology, setMethodology] = useState<ProjectMethodology>('agile')
    const [showTemplates, setShowTemplates] = useState(false)

    useEffect(() => {
        if (id && user) {
            loadProject()

            // Load tasks for AI insights
            const q = query(collection(db, 'projects', id, 'tasks'))
            const unsubscribe = onSnapshot(q, (snapshot) => {
                setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)))
            }, (error) => {
                console.error("Error fetching tasks:", error)
            })
            return () => unsubscribe()
        }
    }, [id, user])

    const loadProject = async () => {
        if (!id) return
        try {
            const docRef = doc(db, 'projects', id)
            const docSnap = await getDoc(docRef)
            if (docSnap.exists()) {
                const data = docSnap.data()
                setProject({ id: docSnap.id, ...data })
                if (data.methodology) {
                    setMethodology(data.methodology)
                }
            } else {
                navigate('/my-projects')
            }
        } catch (error) {
            console.error('Error loading project:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleMethodologyChange = async (value: ProjectMethodology) => {
        setMethodology(value)
        if (id) {
            await updateDoc(doc(db, 'projects', id), {
                methodology: value
            })
        }
    }

    if (loading || authLoading || permissionsLoading) {
        return (
            <DashboardLayout>
                <div className="flex justify-center items-center h-[calc(100vh-100px)]">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
            </DashboardLayout>
        )
    }

    // Map tab names to permission keys
    const tabPermissionMap: Record<string, keyof MemberPermissions> = {
        overview: 'dashboard',
        kanban: 'tasks',
        gantt: 'gantt',
        calendar: 'calendar',
        team: 'dashboard', // Team view is part of dashboard
        analytics: 'dashboard', // Analytics is part of dashboard
        whiteboard: 'whiteboard',
        documents: 'files',
        budget: 'dashboard', // Budget is part of dashboard
        gallery: 'files' // Gallery is part of files
    }

    // Check if user can view a tab
    const canViewTab = (tabKey: string) => {
        if (isOwner || isAdmin) return true
        const permKey = tabPermissionMap[tabKey]
        if (!permKey || !permissions) return false
        return permissions[permKey]?.read ?? false
    }

    // Check if user can write in a tab
    const canWriteTab = (tabKey: string) => {
        if (isOwner || isAdmin) return true
        const permKey = tabPermissionMap[tabKey]
        if (!permKey || !permissions) return false
        return permissions[permKey]?.write ?? false
    }

    return (
        <DashboardLayout>
            <div className="h-full flex flex-col space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => navigate('/my-projects')}>
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <h1 className="text-2xl font-bold tracking-tight">{project?.title}</h1>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${project?.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' :
                                project?.status === 'completed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100' :
                                    'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
                                }`}>
                                {project?.status}
                            </span>
                        </div>
                        <p className="text-muted-foreground text-sm ml-8">
                            {project?.summary || 'Manage your project tasks, team, and timeline.'}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {(isOwner || isAdmin || canWrite('settings')) && (
                            <Select value={methodology} onValueChange={(v: any) => handleMethodologyChange(v)}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Select Methodology" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="agile">Agile</SelectItem>
                                    <SelectItem value="scrum">Scrum</SelectItem>
                                    <SelectItem value="kanban">Kanban</SelectItem>
                                    <SelectItem value="waterfall">Waterfall</SelectItem>
                                    <SelectItem value="hybrid">Hybrid</SelectItem>
                                </SelectContent>
                            </Select>
                        )}

                        {(isOwner || isAdmin || canWrite('tasks')) && (
                            <Button>
                                <Plus className="h-4 w-4 mr-2" />
                                New Task
                            </Button>
                        )}
                        <Button variant="outline" onClick={() => setShowTemplates(true)}>
                            📦 Templates
                        </Button>
                        {(isOwner || isAdmin || canManageTeam) && (
                            <Button variant="outline" size="icon" onClick={() => navigate(`/project/${id}/manage-team`)}>
                                <Settings className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>

                {/* Main Content */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                    <div className="border-b overflow-x-auto">
                        <TabsList className="w-full justify-start h-12 bg-transparent p-0">
                            {canViewTab('overview') && (
                                <TabsTrigger value="overview" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-full px-4">
                                    <LayoutDashboard className="h-4 w-4 mr-2" />
                                    Overview
                                </TabsTrigger>
                            )}
                            {canViewTab('kanban') && (
                                <TabsTrigger value="kanban" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-full px-4">
                                    <KanbanSquare className="h-4 w-4 mr-2" />
                                    Kanban
                                </TabsTrigger>
                            )}
                            {canViewTab('gantt') && (
                                <TabsTrigger value="gantt" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-full px-4">
                                    <GanttChartSquare className="h-4 w-4 mr-2" />
                                    Gantt
                                </TabsTrigger>
                            )}
                            {canViewTab('calendar') && (
                                <TabsTrigger value="calendar" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-full px-4">
                                    <CalendarDays className="h-4 w-4 mr-2" />
                                    Calendar
                                </TabsTrigger>
                            )}
                            {canViewTab('team') && (
                                <TabsTrigger value="team" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-full px-4">
                                    <Users className="h-4 w-4 mr-2" />
                                    Team
                                </TabsTrigger>
                            )}
                            {canViewTab('analytics') && (
                                <TabsTrigger value="analytics" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-full px-4">
                                    <BarChart3 className="h-4 w-4 mr-2" />
                                    Analytics
                                </TabsTrigger>
                            )}
                            {canViewTab('whiteboard') && (
                                <TabsTrigger value="whiteboard" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-full px-4">
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Whiteboard
                                </TabsTrigger>
                            )}
                            {canViewTab('documents') && (
                                <TabsTrigger value="documents" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-full px-4">
                                    <FileText className="h-4 w-4 mr-2" />
                                    Documents
                                </TabsTrigger>
                            )}
                            {canViewTab('budget') && (
                                <TabsTrigger value="budget" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-full px-4">
                                    <DollarSign className="h-4 w-4 mr-2" />
                                    Budget
                                </TabsTrigger>
                            )}
                            {canViewTab('gallery') && (
                                <TabsTrigger value="gallery" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-full px-4">
                                    <Image className="h-4 w-4 mr-2" />
                                    Gallery
                                </TabsTrigger>
                            )}
                        </TabsList>
                    </div>

                    <div className="flex-1 py-4">
                        <TabsContent value="overview" className="space-y-4">
                            {!canViewTab('overview') ? (
                                <AccessDenied feature="the Overview" />
                            ) : (
                                <>
                                    {!canWriteTab('overview') && <ReadOnlyNotice />}
                                    {/* Stats Overview */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <Card>
                                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                <CardTitle className="text-sm font-medium">Total Progress</CardTitle>
                                                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                                            </CardHeader>
                                            <CardContent>
                                                {(() => {
                                                    const totalTasks = tasks.length;
                                                    const completedTasks = tasks.filter(t => t.status === 'done').length;
                                                    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
                                                    return (
                                                        <>
                                                            <div className="text-2xl font-bold">{progress}%</div>
                                                            <Progress value={progress} className="mt-2" />
                                                            <p className="text-xs text-muted-foreground mt-2">
                                                                {completedTasks} of {totalTasks} tasks completed
                                                            </p>
                                                        </>
                                                    );
                                                })()}
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
                                                <KanbanSquare className="h-4 w-4 text-muted-foreground" />
                                            </CardHeader>
                                            <CardContent>
                                                {(() => {
                                                    const activeTasks = tasks.filter(t => t.status === 'in-progress' || t.status === 'todo').length;
                                                    const highPriority = tasks.filter(t => (t.status === 'in-progress' || t.status === 'todo') && (t.priority === 'high' || t.priority === 'urgent')).length;
                                                    return (
                                                        <>
                                                            <div className="text-2xl font-bold">{activeTasks}</div>
                                                            <p className="text-xs text-muted-foreground mt-1">
                                                                {highPriority} high priority
                                                            </p>
                                                        </>
                                                    );
                                                })()}
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                <CardTitle className="text-sm font-medium">Team Members</CardTitle>
                                                <Users className="h-4 w-4 text-muted-foreground" />
                                            </CardHeader>
                                            <CardContent>
                                                <div className="text-2xl font-bold">{project?.currentMembers || 0}</div>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {project?.maxMembers ? `${project.maxMembers - (project.currentMembers || 0)} spots remaining` : 'Open for applications'}
                                                </p>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                        {/* Recent Activity */}
                                        <Card className="col-span-1 lg:col-span-2">
                                            <CardHeader>
                                                <CardTitle>Recent Activity</CardTitle>
                                                <CardDescription>Latest updates from your team</CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="space-y-4">
                                                    {[1, 2, 3].map((_, i) => (
                                                        <div key={i} className="flex items-start gap-4 pb-4 border-b last:border-0">
                                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                                <Users className="h-4 w-4 text-primary" />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium">New task created</p>
                                                                <p className="text-xs text-muted-foreground">User X created "Implement authentication"</p>
                                                                <p className="text-xs text-muted-foreground mt-1">2 hours ago</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>

                                        {/* AI Insights */}
                                        <AIInsights tasks={tasks} methodology={methodology} />
                                    </div>
                                </>
                            )}
                        </TabsContent>

                        <TabsContent value="kanban" className="h-[calc(100vh-250px)]">
                            {!canViewTab('kanban') ? (
                                <AccessDenied feature="Tasks/Kanban" />
                            ) : (
                                <>
                                    {!canWriteTab('kanban') && <ReadOnlyNotice />}
                                    <KanbanBoard readOnly={!canWriteTab('kanban')} />
                                </>
                            )}
                        </TabsContent>

                        <TabsContent value="gantt" className="h-[calc(100vh-250px)]">
                            {!canViewTab('gantt') ? (
                                <AccessDenied feature="Gantt Chart" />
                            ) : (
                                <>
                                    {!canWriteTab('gantt') && <ReadOnlyNotice />}
                                    <GanttChart readOnly={!canWriteTab('gantt')} />
                                </>
                            )}
                        </TabsContent>

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

                        <TabsContent value="team">
                            {!canViewTab('team') ? (
                                <AccessDenied feature="Team" />
                            ) : (
                                <ResourceManagement readOnly={!canWriteTab('team')} />
                            )}
                        </TabsContent>

                        <TabsContent value="analytics">
                            {!canViewTab('analytics') ? (
                                <AccessDenied feature="Analytics" />
                            ) : (
                                <Analytics />
                            )}
                        </TabsContent>

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

                        <TabsContent value="documents" className="h-[calc(100vh-200px)]">
                            {!canViewTab('documents') ? (
                                <AccessDenied feature="Documents/Files" />
                            ) : (
                                <>
                                    {!canWriteTab('documents') && <ReadOnlyNotice />}
                                    <Documents readOnly={!canWriteTab('documents')} />
                                </>
                            )}
                        </TabsContent>

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
                    </div>
                </Tabs>
            </div>

            <TemplateGallery
                open={showTemplates}
                onClose={() => setShowTemplates(false)}
                projectId={id!}
                projectName={project?.title ?? ''}
                onApplied={(updatedName: string) => {
                    setProject((prev: any) => ({
                        ...prev,
                        title: updatedName   // updates header instantly
                    }))
                    setShowTemplates(false)
                    setActiveTab('kanban')   // jumps to board after applying
                }}
            />
        </DashboardLayout>
    )
}

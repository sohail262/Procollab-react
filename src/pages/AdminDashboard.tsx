import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    Users, FolderKanban, TrendingUp, Bell, Star, Shield, Activity,
    Megaphone, Settings2, RefreshCw, Trash2, Edit, Eye, Search,
    UserCog, BarChart3, AlertCircle, CheckCircle2, Clock, Plus,
    XCircle, Info, AlertTriangle, Flag
} from 'lucide-react'
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts'
import {
    loadPlatformStats, loadAllUsers, loadAllProjects, loadAnnouncements,
    loadGrowthData, loadAdminLogs, updateUserRole, toggleUserDisabled,
    deleteUser, updateProjectStatus, toggleProjectFeatured, deleteProject,
    createAnnouncement, updateAnnouncement, deleteAnnouncement, logAdminAction,
    loadModerationQueue, reviewModerationItem,
    type PlatformStats, type UserData, type ProjectData,
    type Announcement, type GrowthDataPoint, type ActivityLog, type ModerationItem
} from '@/services/adminService'
import { useToast } from '@/hooks/use-toast'
import { getFlagMessage } from '@/services/contentModerationService'
import { FCMTestPanel } from '@/components/FCMTestPanel'
import {
    collection, query, where, getDocs, orderBy,
    doc, updateDoc, serverTimestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
    getActivationFunnel,
    getWeeklyCollaboratingProjectsCount,
    getFirstValueExchangeRate,
    getWeeklyValueRetention,
    getMarketplaceHealthStats,
    getProjectSuccessMetrics,
    type FunnelStep,
    type WeeklyValueRetentionStats,
    type MarketplaceHealthStats,
    type ProjectSuccessMetrics,
} from '@/services/analyticsService'

// ─── Types ───────────────────────────────────────────────
interface Report {
    id: string
    projectId: string
    projectTitle: string
    reportedBy: string
    reporterEmail: string
    ownerId: string
    reason: string
    details?: string
    status: 'pending' | 'resolved' | 'dismissed'
    createdAt: any
    resolvedAt?: any
    resolvedBy?: string
}

export function AdminDashboard() {
    const { user } = useAuth()
    const { toast } = useToast()
    const [activeTab, setActiveTab] = useState('overview')
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    // Data states
    const [stats, setStats] = useState<PlatformStats | null>(null)
    const [users, setUsers] = useState<UserData[]>([])
    const [projects, setProjects] = useState<ProjectData[]>([])
    const [announcements, setAnnouncements] = useState<Announcement[]>([])
    const [growthData, setGrowthData] = useState<GrowthDataPoint[]>([])
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
    const [moderationQueue, setModerationQueue] = useState<ModerationItem[]>([])
    const [reports, setReports] = useState<Report[]>([])
    const [reviewNotes, setReviewNotes] = useState('')

    // Analytics states
    const [analyticsLoading, setAnalyticsLoading] = useState(false)
    const [funnelData, setFunnelData] = useState<FunnelStep[]>([])
    const [wcpCount, setWcpCount] = useState<number>(0)
    const [fveRate, setFveRate] = useState<number>(0)
    const [wvrStats, setWvrStats] = useState<WeeklyValueRetentionStats | null>(null)
    const [marketplaceHealth, setMarketplaceHealth] = useState<MarketplaceHealthStats | null>(null)
    const [projectSuccess, setProjectSuccess] = useState<ProjectSuccessMetrics | null>(null)

    // Filter states
    const [userSearch, setUserSearch] = useState('')
    const [projectSearch, setProjectSearch] = useState('')
    const [projectStatusFilter, setProjectStatusFilter] = useState('all')
    const [reportStatusFilter, setReportStatusFilter] = useState('all')

    // Dialog states
    const [announcementDialog, setAnnouncementDialog] = useState(false)
    const [deleteDialog, setDeleteDialog] = useState<{
        type: string
        id: string
        name: string
    } | null>(null)
    const [newAnnouncement, setNewAnnouncement] = useState({
        title: '',
        message: '',
        type: 'info' as const
    })

    useEffect(() => {
        loadData()
    }, [])

    // ─── Load all data ────────────────────────────────────
    const loadReports = async (): Promise<Report[]> => {
        try {
            const reportsRef = collection(db, 'reports')
            const q = query(reportsRef, orderBy('createdAt', 'desc'))
            const snap = await getDocs(q)
            return snap.docs.map(d => ({ id: d.id, ...d.data() } as Report))
        } catch (error) {
            console.error('Error loading reports:', error)
            return []
        }
    }

    const loadData = async () => {
        setLoading(true)
        try {
            const [
                statsData,
                usersData,
                projectsData,
                announcementsData,
                growthDataRes,
                logsData,
                moderationData,
                reportsData
            ] = await Promise.all([
                loadPlatformStats(),
                loadAllUsers(),
                loadAllProjects(),
                loadAnnouncements(),
                loadGrowthData(30),
                loadAdminLogs(),
                loadModerationQueue(),
                loadReports()
            ])
            setStats(statsData)
            setUsers(usersData)
            setProjects(projectsData)
            setAnnouncements(announcementsData)
            setGrowthData(growthDataRes)
            setActivityLogs(logsData)
            setModerationQueue(moderationData)
            setReports(reportsData)
        } catch (error) {
            console.error('Error loading admin data:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadAnalyticsData = async () => {
        setAnalyticsLoading(true)
        try {
            const [funnel, wcp, fve, wvr, health, success] = await Promise.all([
                getActivationFunnel(),
                getWeeklyCollaboratingProjectsCount(),
                getFirstValueExchangeRate(),
                getWeeklyValueRetention(),
                getMarketplaceHealthStats(),
                getProjectSuccessMetrics(),
            ])
            setFunnelData(funnel)
            setWcpCount(wcp)
            setFveRate(fve)
            setWvrStats(wvr)
            setMarketplaceHealth(health)
            setProjectSuccess(success)
        } catch (error) {
            console.error('Error loading analytics:', error)
        } finally {
            setAnalyticsLoading(false)
        }
    }

    const handleRefresh = async () => {
        setRefreshing(true)
        await loadData()
        setRefreshing(false)
    }

    // ─── Formatters ──────────────────────────────────────
    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'N/A'
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
        return date.toLocaleDateString()
    }

    const formatTimeAgo = (timestamp: any) => {
        if (!timestamp) return 'N/A'
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
        const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
        if (seconds < 60) return 'just now'
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
        return `${Math.floor(seconds / 86400)}d ago`
    }

    // ─── User actions ─────────────────────────────────────
    const handleUserRoleChange = async (
        userId: string,
        role: string,
        userName: string
    ) => {
        try {
            await updateUserRole(userId, role)
            await logAdminAction(
                'change_role', user!.uid, user!.displayName || user!.email || '',
                'user', userId, userName,
                `Changed role to ${role}`
            )
            setUsers(users.map(u => u.id === userId ? { ...u, role } : u))
            toast({
                title: 'Role Updated',
                description: `${userName}'s role updated to ${role}`,
                variant: 'success'
            })
        } catch (error) {
            console.error('Error updating role:', error)
            toast({
                title: 'Update Failed',
                description: 'Failed to update user role',
                variant: 'destructive'
            })
        }
    }

    const handleToggleUserDisabled = async (
        userId: string,
        disabled: boolean,
        userName: string
    ) => {
        try {
            await toggleUserDisabled(userId, disabled)
            await logAdminAction(
                disabled ? 'disable_user' : 'enable_user',
                user!.uid, user!.displayName || '',
                'user', userId, userName
            )
            setUsers(users.map(u => u.id === userId ? { ...u, disabled } : u))
            toast({
                title: disabled ? 'User Disabled' : 'User Enabled',
                description: `${userName} has been ${disabled ? 'disabled' : 'enabled'}`,
                variant: 'success'
            })
        } catch (error) {
            console.error('Error toggling user:', error)
            toast({
                title: 'Action Failed',
                description: 'Failed to update user status',
                variant: 'destructive'
            })
        }
    }

    // ─── Project actions ──────────────────────────────────
    const handleProjectStatusChange = async (
        projectId: string,
        status: string,
        projectTitle: string
    ) => {
        try {
            await updateProjectStatus(projectId, status)
            await logAdminAction(
                'change_status', user!.uid, user!.displayName || '',
                'project', projectId, projectTitle,
                `Changed status to ${status}`
            )
            setProjects(projects.map(p =>
                p.id === projectId ? { ...p, status } : p
            ))
        } catch (error) {
            console.error('Error updating status:', error)
        }
    }

    const handleToggleFeatured = async (
        projectId: string,
        featured: boolean,
        projectTitle: string
    ) => {
        try {
            await toggleProjectFeatured(projectId, featured)
            await logAdminAction(
                featured ? 'feature_project' : 'unfeature_project',
                user!.uid, user!.displayName || '',
                'project', projectId, projectTitle
            )
            setProjects(projects.map(p =>
                p.id === projectId ? { ...p, featured } : p
            ))
        } catch (error) {
            console.error('Error toggling featured:', error)
        }
    }

    // ─── Delete handler ───────────────────────────────────
    const handleDelete = async () => {
        if (!deleteDialog) return
        try {
            if (deleteDialog.type === 'user') {
                await deleteUser(deleteDialog.id)
                await logAdminAction(
                    'delete_user', user!.uid, user!.displayName || '',
                    'user', deleteDialog.id, deleteDialog.name
                )
                setUsers(users.filter(u => u.id !== deleteDialog.id))
            } else if (deleteDialog.type === 'project') {
                await deleteProject(deleteDialog.id)
                await logAdminAction(
                    'delete_project', user!.uid, user!.displayName || '',
                    'project', deleteDialog.id, deleteDialog.name
                )
                setProjects(projects.filter(p => p.id !== deleteDialog.id))
                // Also mark any reports for this project as resolved
                setReports(reports.map(r =>
                    r.projectId === deleteDialog.id
                        ? { ...r, status: 'resolved' }
                        : r
                ))
            } else if (deleteDialog.type === 'announcement') {
                await deleteAnnouncement(deleteDialog.id)
                setAnnouncements(announcements.filter(a => a.id !== deleteDialog.id))
            }
            toast({
                title: 'Deleted',
                description: `${deleteDialog.type} "${deleteDialog.name}" has been deleted`,
                variant: 'success'
            })
        } catch (error) {
            console.error('Error deleting:', error)
            toast({
                title: 'Delete Failed',
                description: `Failed to delete ${deleteDialog.type}`,
                variant: 'destructive'
            })
        } finally {
            setDeleteDialog(null)
        }
    }

    // ─── Announcement actions ─────────────────────────────
    const handleCreateAnnouncement = async () => {
        try {
            await createAnnouncement(
                newAnnouncement.title,
                newAnnouncement.message,
                newAnnouncement.type,
                null,
                user!.uid
            )
            await loadAnnouncements().then(setAnnouncements)
            setAnnouncementDialog(false)
            setNewAnnouncement({ title: '', message: '', type: 'info' })
            toast({
                title: 'Announcement Created',
                description: 'Your announcement has been published',
                variant: 'success'
            })
        } catch (error) {
            console.error('Error creating announcement:', error)
            toast({
                title: 'Creation Failed',
                description: 'Failed to create announcement',
                variant: 'destructive'
            })
        }
    }

    const handleToggleAnnouncement = async (id: string, active: boolean) => {
        try {
            await updateAnnouncement(id, { active })
            setAnnouncements(announcements.map(a =>
                a.id === id ? { ...a, active } : a
            ))
        } catch (error) {
            console.error('Error updating announcement:', error)
        }
    }

    // ─── Report actions ───────────────────────────────────
    const handleResolveReport = async (
        reportId: string,
        action: 'resolved' | 'dismissed'
    ) => {
        try {
            await updateDoc(doc(db, 'reports', reportId), {
                status: action,
                resolvedAt: serverTimestamp(),
                resolvedBy: user?.uid
            })
            setReports(prev =>
                prev.map(r =>
                    r.id === reportId ? { ...r, status: action } : r
                )
            )
            toast({
                title: action === 'resolved' ? 'Report Resolved' : 'Report Dismissed',
                description: `The report has been ${action}.`,
                variant: 'success'
            })
        } catch (error) {
            console.error('Error resolving report:', error)
            toast({
                title: 'Error',
                description: 'Failed to update report status.',
                variant: 'destructive'
            })
        }
    }

    // ─── Filtered data ────────────────────────────────────
    const filteredUsers = users.filter(u =>
        u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.displayName?.toLowerCase().includes(userSearch.toLowerCase()) ||
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(userSearch.toLowerCase())
    )

    const filteredProjects = projects.filter(p => {
        const matchesSearch =
            p.title?.toLowerCase().includes(projectSearch.toLowerCase()) ||
            p.creatorName?.toLowerCase().includes(projectSearch.toLowerCase())
        const matchesStatus =
            projectStatusFilter === 'all' || p.status === projectStatusFilter
        return matchesSearch && matchesStatus
    })

    const filteredReports = reports.filter(r =>
        reportStatusFilter === 'all' || r.status === reportStatusFilter
    )

    const pendingReportsCount = reports.filter(r => r.status === 'pending').length

    // ─── Helpers ──────────────────────────────────────────
    const statCards = [
        {
            title: 'Total Users',
            value: stats?.totalUsers || 0,
            icon: Users,
            color: 'blue',
            change: `+${stats?.newSignups || 0} this month`
        },
        {
            title: 'Total Projects',
            value: stats?.totalProjects || 0,
            icon: FolderKanban,
            color: 'green',
            change: ''
        },
        {
            title: 'Active Users',
            value: stats?.activeUsers || 0,
            icon: Activity,
            color: 'purple',
            change: 'Last 7 days'
        },
        {
            title: 'Featured',
            value: stats?.featuredProjects || 0,
            icon: Star,
            color: 'yellow',
            change: 'Projects'
        },
    ]

    const getAnnouncementIcon = (type: string) => {
        switch (type) {
            case 'warning':
                return <AlertTriangle className="h-4 w-4 text-yellow-500" />
            case 'error':
                return <XCircle className="h-4 w-4 text-red-500" />
            case 'success':
                return <CheckCircle2 className="h-4 w-4 text-green-500" />
            default:
                return <Info className="h-4 w-4 text-blue-500" />
        }
    }

    const getReportStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'border-l-red-500'
            case 'resolved': return 'border-l-green-500'
            case 'dismissed': return 'border-l-gray-400'
            default: return 'border-l-gray-300'
        }
    }

    const getReportBadgeVariant = (status: string) => {
        switch (status) {
            case 'pending': return 'destructive'
            case 'resolved': return 'default'
            default: return 'outline'
        }
    }

    // ─────────────────────────────────────────────────────
    return (
        <DashboardLayout>
            <div className="mb-6">
                <div className="flex flex-wrap justify-between items-start gap-3">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 sm:gap-3">
                            <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-red-600" />
                            Admin Dashboard
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Manage users, projects, and platform settings
                        </p>
                    </div>
                    <Button
                        onClick={handleRefresh}
                        variant="outline"
                        disabled={refreshing}
                        className="shrink-0"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-6 flex-wrap gap-1">
                    {/* Overview */}
                    <TabsTrigger value="overview">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Overview
                    </TabsTrigger>

                    {/* Moderation */}
                    <TabsTrigger value="moderation" className="relative">
                        <Shield className="h-4 w-4 mr-2" />
                        Moderation
                        {moderationQueue.length > 0 && (
                            <Badge
                                variant="destructive"
                                className="ml-2 h-5 min-w-[20px] px-1"
                            >
                                {moderationQueue.length}
                            </Badge>
                        )}
                    </TabsTrigger>

                    {/* Reports ✅ */}
                    <TabsTrigger value="reports" className="relative">
                        <Flag className="h-4 w-4 mr-2" />
                        Reports
                        {pendingReportsCount > 0 && (
                            <Badge
                                variant="destructive"
                                className="ml-2 h-5 min-w-[20px] px-1"
                            >
                                {pendingReportsCount}
                            </Badge>
                        )}
                    </TabsTrigger>

                    {/* Users */}
                    <TabsTrigger value="users">
                        <Users className="h-4 w-4 mr-2" />
                        Users
                    </TabsTrigger>

                    {/* Projects */}
                    <TabsTrigger value="projects">
                        <FolderKanban className="h-4 w-4 mr-2" />
                        Projects
                    </TabsTrigger>

                    {/* Announcements */}
                    <TabsTrigger value="announcements">
                        <Megaphone className="h-4 w-4 mr-2" />
                        Announcements
                    </TabsTrigger>

                    {/* Activity */}
                    <TabsTrigger value="activity">
                        <Activity className="h-4 w-4 mr-2" />
                        Activity
                    </TabsTrigger>

                    {/* Analytics */}
                    <TabsTrigger
                        value="product-analytics"
                        onClick={() => { if (!funnelData.length) loadAnalyticsData() }}
                    >
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Product Analytics
                    </TabsTrigger>
                </TabsList>

                {/* ══════════════════════════════════════════
                    OVERVIEW TAB
                ══════════════════════════════════════════ */}
                <TabsContent value="overview">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
                        {statCards.map((stat, i) => (
                            <Card key={i}>
                                <CardContent className="p-4 sm:p-6">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-xs sm:text-sm text-muted-foreground">
                                                {stat.title}
                                            </p>
                                            <h3 className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2">
                                                {loading ? '...' : stat.value}
                                            </h3>
                                            {stat.change && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {stat.change}
                                                </p>
                                            )}
                                        </div>
                                        <div className={`p-2 sm:p-3 rounded-lg bg-${stat.color}-100 dark:bg-${stat.color}-900/30 shrink-0`}>
                                            <stat.icon className={`h-5 w-5 sm:h-6 sm:w-6 text-${stat.color}-600`} />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Growth Trends (Last 30 Days)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={growthData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={(v) => v.slice(5)}
                                        />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Line
                                            type="monotone"
                                            dataKey="users"
                                            stroke="#3b82f6"
                                            name="New Users"
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="projects"
                                            stroke="#10b981"
                                            name="New Projects"
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ══════════════════════════════════════════
                    MODERATION TAB
                ══════════════════════════════════════════ */}
                <TabsContent value="moderation">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="h-5 w-5" />
                                Content Moderation Queue
                            </CardTitle>
                            <CardDescription>
                                Review projects flagged for potential issues before they go live.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {moderationQueue.length === 0 ? (
                                <div className="text-center py-12">
                                    <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
                                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                        All Clear!
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400">
                                        No projects pending review at this time.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {moderationQueue.map((item) => (
                                        <Card
                                            key={item.id}
                                            className="border-l-4 border-l-yellow-500"
                                        >
                                            <CardContent className="p-6">
                                                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <h3 className="text-lg font-semibold">
                                                                {item.projectTitle}
                                                            </h3>
                                                            <Badge
                                                                variant="outline"
                                                                className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                                            >
                                                                Risk Score: {item.riskScore}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                                                            {item.projectDescription || 'No description provided'}
                                                        </p>
                                                        <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                                                            <span>
                                                                Created by: <strong>{item.creatorName}</strong>
                                                            </span>
                                                            <span>•</span>
                                                            <span>{formatTimeAgo(item.createdAt)}</span>
                                                        </div>

                                                        {/* Flags */}
                                                        <div className="space-y-2">
                                                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                                Issues Found:
                                                            </p>
                                                            {item.flags.map((flag, idx) => (
                                                                <div
                                                                    key={idx}
                                                                    className={`flex items-start gap-2 text-sm p-2 rounded ${
                                                                        flag.severity === 'high'
                                                                            ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                                                                            : flag.severity === 'medium'
                                                                            ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
                                                                            : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                                                                    }`}
                                                                >
                                                                    <span>
                                                                        {flag.severity === 'high'
                                                                            ? '🔴'
                                                                            : flag.severity === 'medium'
                                                                            ? '🟡'
                                                                            : '🔵'}
                                                                    </span>
                                                                    <span>{getFlagMessage(flag)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex flex-col gap-2 lg:w-48">
                                                        <Textarea
                                                            placeholder="Add review notes (optional)..."
                                                            className="text-sm h-20"
                                                            value={reviewNotes}
                                                            onChange={(e) => setReviewNotes(e.target.value)}
                                                        />
                                                        <Button
                                                            variant="default"
                                                            className="bg-green-600 hover:bg-green-700"
                                                            onClick={async () => {
                                                                if (!user) return
                                                                try {
                                                                    await reviewModerationItem(
                                                                        item.id,
                                                                        item.projectId,
                                                                        'approved',
                                                                        user.uid,
                                                                        reviewNotes
                                                                    )
                                                                    toast({
                                                                        title: 'Approved',
                                                                        description: 'Project has been approved.',
                                                                        variant: 'success'
                                                                    })
                                                                    setReviewNotes('')
                                                                    loadData()
                                                                } catch {
                                                                    toast({
                                                                        title: 'Error',
                                                                        description: 'Failed to approve project.',
                                                                        variant: 'destructive'
                                                                    })
                                                                }
                                                            }}
                                                        >
                                                            <CheckCircle2 className="h-4 w-4 mr-2" />
                                                            Approve
                                                        </Button>
                                                        <Button
                                                            variant="destructive"
                                                            onClick={async () => {
                                                                if (!user) return
                                                                try {
                                                                    await reviewModerationItem(
                                                                        item.id,
                                                                        item.projectId,
                                                                        'rejected',
                                                                        user.uid,
                                                                        reviewNotes
                                                                    )
                                                                    toast({
                                                                        title: 'Rejected',
                                                                        description: 'Project has been rejected.',
                                                                        variant: 'success'
                                                                    })
                                                                    setReviewNotes('')
                                                                    loadData()
                                                                } catch {
                                                                    toast({
                                                                        title: 'Error',
                                                                        description: 'Failed to reject project.',
                                                                        variant: 'destructive'
                                                                    })
                                                                }
                                                            }}
                                                        >
                                                            <XCircle className="h-4 w-4 mr-2" />
                                                            Reject
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            onClick={() =>
                                                                window.open(
                                                                    `/project/${item.projectId}`,
                                                                    '_blank'
                                                                )
                                                            }
                                                        >
                                                            <Eye className="h-4 w-4 mr-2" />
                                                            View Project
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ══════════════════════════════════════════
                    REPORTS TAB ✅
                ══════════════════════════════════════════ */}
                <TabsContent value="reports">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center flex-wrap gap-4">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <Flag className="h-5 w-5 text-red-500" />
                                        Project Reports
                                    </CardTitle>
                                    <CardDescription className="mt-1">
                                        Review reports submitted by users about projects.
                                    </CardDescription>
                                </div>

                                {/* Status filter */}
                                <Select
                                    value={reportStatusFilter}
                                    onValueChange={setReportStatusFilter}
                                >
                                    <SelectTrigger className="w-36">
                                        <SelectValue placeholder="Filter" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Reports</SelectItem>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="resolved">Resolved</SelectItem>
                                        <SelectItem value="dismissed">Dismissed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardHeader>

                        <CardContent>
                            {filteredReports.length === 0 ? (
                                <div className="text-center py-12">
                                    <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
                                    <h3 className="text-xl font-semibold mb-2">No Reports</h3>
                                    <p className="text-muted-foreground">
                                        {reportStatusFilter === 'all'
                                            ? 'No project reports at this time.'
                                            : `No ${reportStatusFilter} reports.`}
                                    </p>
                                </div>
                            ) : (
                                <ScrollArea className="h-[600px]">
                                    <div className="space-y-4 pr-2">
                                        {filteredReports.map((report) => (
                                            <Card
                                                key={report.id}
                                                className={`border-l-4 ${getReportStatusColor(report.status)}`}
                                            >
                                                <CardContent className="p-5">
                                                    <div className="flex flex-col md:flex-row md:items-start gap-4">

                                                        {/* Info */}
                                                        <div className="flex-1 space-y-2">
                                                            {/* Title + badge */}
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <h3 className="font-semibold text-base">
                                                                    {report.projectTitle}
                                                                </h3>
                                                                <Badge
                                                                    variant={getReportBadgeVariant(report.status) as any}
                                                                    className="capitalize"
                                                                >
                                                                    {report.status}
                                                                </Badge>
                                                            </div>

                                                            {/* Reason */}
                                                            <div className="flex items-center gap-2 text-sm">
                                                                <span className="font-medium text-red-600 dark:text-red-400">
                                                                    Reason:
                                                                </span>
                                                                <span>{report.reason}</span>
                                                            </div>

                                                            {/* Details */}
                                                            {report.details && (
                                                                <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded">
                                                                    {report.details}
                                                                </p>
                                                            )}

                                                            {/* Meta */}
                                                            <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                                                                <span>
                                                                    Reported by:{' '}
                                                                    <strong>{report.reporterEmail}</strong>
                                                                </span>
                                                                <span>•</span>
                                                                <span>{formatTimeAgo(report.createdAt)}</span>
                                                                {report.resolvedAt && (
                                                                    <>
                                                                        <span>•</span>
                                                                        <span>
                                                                            {report.status === 'resolved'
                                                                                ? 'Resolved'
                                                                                : 'Dismissed'}{' '}
                                                                            {formatTimeAgo(report.resolvedAt)}
                                                                        </span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Actions */}
                                                        <div className="flex flex-col gap-2 md:w-44 flex-shrink-0">
                                                            {/* View project */}
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() =>
                                                                    window.open(
                                                                        `/project/${report.projectId}`,
                                                                        '_blank'
                                                                    )
                                                                }
                                                            >
                                                                <Eye className="h-4 w-4 mr-2" />
                                                                View Project
                                                            </Button>

                                                            {/* Only show action buttons for pending */}
                                                            {report.status === 'pending' && (
                                                                <>
                                                                    {/* Resolve */}
                                                                    <Button
                                                                        size="sm"
                                                                        className="bg-green-600 hover:bg-green-700 text-white"
                                                                        onClick={() =>
                                                                            handleResolveReport(report.id, 'resolved')
                                                                        }
                                                                    >
                                                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                                                        Mark Resolved
                                                                    </Button>

                                                                    {/* Dismiss */}
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="text-gray-600"
                                                                        onClick={() =>
                                                                            handleResolveReport(report.id, 'dismissed')
                                                                        }
                                                                    >
                                                                        <XCircle className="h-4 w-4 mr-2" />
                                                                        Dismiss
                                                                    </Button>

                                                                    {/* Delete project */}
                                                                    <Button
                                                                        size="sm"
                                                                        variant="destructive"
                                                                        onClick={() =>
                                                                            setDeleteDialog({
                                                                                type: 'project',
                                                                                id: report.projectId,
                                                                                name: report.projectTitle
                                                                            })
                                                                        }
                                                                    >
                                                                        <Trash2 className="h-4 w-4 mr-2" />
                                                                        Delete Project
                                                                    </Button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </ScrollArea>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ══════════════════════════════════════════
                    USERS TAB
                ══════════════════════════════════════════ */}
                <TabsContent value="users">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>User Management</CardTitle>
                                <div className="relative w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search users..."
                                        className="pl-9"
                                        value={userSearch}
                                        onChange={(e) => setUserSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[500px]">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>User</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead>Discipline</TableHead>
                                            <TableHead>Joined</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredUsers.map((u) => (
                                            <TableRow key={u.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarImage src={u.photoURL} />
                                                            <AvatarFallback>
                                                                {(u.firstName?.[0] || u.email?.[0] || 'U').toUpperCase()}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="font-medium">
                                                                {u.displayName ||
                                                                    `${u.firstName} ${u.lastName}` ||
                                                                    u.email}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {u.email}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Select
                                                        value={u.role || 'member'}
                                                        onValueChange={(v) =>
                                                            handleUserRoleChange(
                                                                u.id, v,
                                                                u.displayName || u.email || ''
                                                            )
                                                        }
                                                    >
                                                        <SelectTrigger className="w-24">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="admin">Admin</SelectItem>
                                                            <SelectItem value="member">Member</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell>{u.discipline || '-'}</TableCell>
                                                <TableCell>{formatDate(u.createdAt)}</TableCell>
                                                <TableCell>
                                                    <Switch
                                                        checked={!u.disabled}
                                                        onCheckedChange={(checked) =>
                                                            handleToggleUserDisabled(
                                                                u.id, !checked,
                                                                u.displayName || u.email || ''
                                                            )
                                                        }
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() =>
                                                            window.open(`/profile/${u.id}`, '_blank')
                                                        }
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-red-600"
                                                        onClick={() =>
                                                            setDeleteDialog({
                                                                type: 'user',
                                                                id: u.id,
                                                                name: u.displayName || u.email || ''
                                                            })
                                                        }
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ══════════════════════════════════════════
                    PROJECTS TAB
                ══════════════════════════════════════════ */}
                <TabsContent value="projects">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center gap-4 flex-wrap">
                                <CardTitle>Project Management</CardTitle>
                                <div className="flex gap-2">
                                    <div className="relative w-64">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search projects..."
                                            className="pl-9"
                                            value={projectSearch}
                                            onChange={(e) => setProjectSearch(e.target.value)}
                                        />
                                    </div>
                                    <Select
                                        value={projectStatusFilter}
                                        onValueChange={setProjectStatusFilter}
                                    >
                                        <SelectTrigger className="w-32">
                                            <SelectValue placeholder="Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All</SelectItem>
                                            <SelectItem value="recruiting">Recruiting</SelectItem>
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="completed">Completed</SelectItem>
                                            <SelectItem value="on-hold">On Hold</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[500px]">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Project</TableHead>
                                            <TableHead>Creator</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Featured</TableHead>
                                            <TableHead>Created</TableHead>
                                            <TableHead>Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredProjects.map((p) => (
                                            <TableRow key={p.id}>
                                                <TableCell>
                                                    <div>
                                                        <p className="font-medium">{p.title}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {p.primaryDiscipline}
                                                        </p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{p.creatorName}</TableCell>
                                                <TableCell>
                                                    <Select
                                                        value={p.status}
                                                        onValueChange={(v) =>
                                                            handleProjectStatusChange(p.id, v, p.title)
                                                        }
                                                    >
                                                        <SelectTrigger className="w-28">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="recruiting">Recruiting</SelectItem>
                                                            <SelectItem value="active">Active</SelectItem>
                                                            <SelectItem value="completed">Completed</SelectItem>
                                                            <SelectItem value="on-hold">On Hold</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell>
                                                    <Switch
                                                        checked={p.featured || false}
                                                        onCheckedChange={(checked) =>
                                                            handleToggleFeatured(p.id, checked, p.title)
                                                        }
                                                    />
                                                </TableCell>
                                                <TableCell>{formatDate(p.createdAt)}</TableCell>
                                                <TableCell>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() =>
                                                            window.open(`/project/${p.id}`, '_blank')
                                                        }
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-red-600"
                                                        onClick={() =>
                                                            setDeleteDialog({
                                                                type: 'project',
                                                                id: p.id,
                                                                name: p.title
                                                            })
                                                        }
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ══════════════════════════════════════════
                    ANNOUNCEMENTS TAB
                ══════════════════════════════════════════ */}
                <TabsContent value="announcements">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Platform Announcements</CardTitle>
                                <Dialog
                                    open={announcementDialog}
                                    onOpenChange={setAnnouncementDialog}
                                >
                                    <DialogTrigger asChild>
                                        <Button>
                                            <Plus className="h-4 w-4 mr-2" />
                                            New Announcement
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Create Announcement</DialogTitle>
                                        </DialogHeader>
                                        <div className="space-y-4 py-4">
                                            <div>
                                                <Label>Title</Label>
                                                <Input
                                                    value={newAnnouncement.title}
                                                    onChange={(e) =>
                                                        setNewAnnouncement({
                                                            ...newAnnouncement,
                                                            title: e.target.value
                                                        })
                                                    }
                                                />
                                            </div>
                                            <div>
                                                <Label>Message</Label>
                                                <Textarea
                                                    value={newAnnouncement.message}
                                                    onChange={(e) =>
                                                        setNewAnnouncement({
                                                            ...newAnnouncement,
                                                            message: e.target.value
                                                        })
                                                    }
                                                />
                                            </div>
                                            <div>
                                                <Label>Type</Label>
                                                <Select
                                                    value={newAnnouncement.type}
                                                    onValueChange={(v: any) =>
                                                        setNewAnnouncement({
                                                            ...newAnnouncement,
                                                            type: v
                                                        })
                                                    }
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="info">Info</SelectItem>
                                                        <SelectItem value="success">Success</SelectItem>
                                                        <SelectItem value="warning">Warning</SelectItem>
                                                        <SelectItem value="error">Error</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button onClick={handleCreateAnnouncement}>
                                                Create
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {announcements.map((a) => (
                                    <div
                                        key={a.id}
                                        className="flex items-center justify-between p-4 border rounded-lg"
                                    >
                                        <div className="flex items-center gap-3">
                                            {getAnnouncementIcon(a.type)}
                                            <div>
                                                <p className="font-medium">{a.title}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {a.message}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {formatTimeAgo(a.createdAt)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Switch
                                                checked={a.active}
                                                onCheckedChange={(checked) =>
                                                    handleToggleAnnouncement(a.id, checked)
                                                }
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-red-600"
                                                onClick={() =>
                                                    setDeleteDialog({
                                                        type: 'announcement',
                                                        id: a.id,
                                                        name: a.title
                                                    })
                                                }
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                {announcements.length === 0 && (
                                    <p className="text-center text-muted-foreground py-8">
                                        No announcements yet
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ══════════════════════════════════════════
                    ACTIVITY TAB
                ══════════════════════════════════════════ */}
                <TabsContent value="activity">
                    <Card>
                        <CardHeader>
                            <CardTitle>Admin Activity Log</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[500px]">
                                <div className="space-y-3">
                                    {activityLogs.map((log) => (
                                        <div
                                            key={log.id}
                                            className="flex items-start gap-3 p-3 border rounded-lg"
                                        >
                                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                                            <div>
                                                <p className="text-sm">
                                                    <span className="font-medium">{log.userName}</span>{' '}
                                                    {log.action.replace(/_/g, ' ')} {log.targetType}:{' '}
                                                    <span className="font-medium">{log.targetName}</span>
                                                </p>
                                                {log.details && (
                                                    <p className="text-xs text-muted-foreground">
                                                        {log.details}
                                                    </p>
                                                )}
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {formatTimeAgo(log.timestamp)}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                    {activityLogs.length === 0 && (
                                        <p className="text-center text-muted-foreground py-8">
                                            No activity logs yet
                                        </p>
                                    )}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ══════════════════════════════════════════
                    PRODUCT ANALYTICS TAB
                ══════════════════════════════════════════ */}
                <TabsContent value="product-analytics" className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold">Product Analytics</h2>
                            <p className="text-muted-foreground text-sm">Real-time activation, retention, and marketplace health KPIs</p>
                        </div>
                        <Button onClick={loadAnalyticsData} variant="outline" disabled={analyticsLoading} size="sm">
                            <RefreshCw className={`h-4 w-4 mr-2 ${analyticsLoading ? 'animate-spin' : ''}`} />
                            {analyticsLoading ? 'Loading...' : 'Refresh'}
                        </Button>
                    </div>

                    {analyticsLoading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-center">
                                <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
                                <p className="text-muted-foreground text-sm">Computing analytics...</p>
                            </div>
                        </div>
                    ) : (
                        <>
                        {/* SECTION 1: BUSINESS KPIS */}
                        <div>
                            <h3 className="font-semibold text-base mb-3">Core Business KPIs</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                                {/* WCP */}
                                <Card>
                                    <CardContent className="p-4 flex flex-col justify-between h-full">
                                        <div>
                                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Weekly Collab Projects</p>
                                            <p className="text-3xl font-bold mt-2 text-indigo-650">{wcpCount}</p>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-2">Projects with &gt;= 2 members active last 7d (North Star)</p>
                                    </CardContent>
                                </Card>

                                {/* FVE */}
                                <Card>
                                    <CardContent className="p-4 flex flex-col justify-between h-full">
                                        <div>
                                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">First Value Exchange</p>
                                            <p className="text-3xl font-bold mt-2 text-emerald-600">{fveRate}%</p>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-2">% of members activated through team collaboration</p>
                                    </CardContent>
                                </Card>

                                {/* WVR */}
                                <Card className="lg:col-span-1">
                                    <CardContent className="p-4 flex flex-col justify-between h-full">
                                        <div>
                                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Value Retention</p>
                                            <div className="mt-2 space-y-1">
                                                <div className="flex justify-between text-xs font-semibold">
                                                    <span>D1:</span> <span>{wvrStats?.day1 || 0}%</span>
                                                </div>
                                                <div className="flex justify-between text-xs font-semibold">
                                                    <span>D7:</span> <span>{wvrStats?.day7 || 0}%</span>
                                                </div>
                                                <div className="flex justify-between text-xs font-semibold">
                                                    <span>D30:</span> <span>{wvrStats?.day30 || 0}%</span>
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-2">Retention cohorts based on value actions</p>
                                    </CardContent>
                                </Card>

                                {/* PCR */}
                                <Card>
                                    <CardContent className="p-4 flex flex-col justify-between h-full">
                                        <div>
                                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Project Completion</p>
                                            <p className="text-3xl font-bold mt-2 text-blue-600">{projectSuccess?.pcr || 0}%</p>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-2">Completed projects vs total projects created</p>
                                    </CardContent>
                                </Card>

                                {/* Median TFD */}
                                <Card>
                                    <CardContent className="p-4 flex flex-col justify-between h-full">
                                        <div>
                                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Time to Duo (Median)</p>
                                            <p className="text-3xl font-bold mt-2 text-amber-600">{projectSuccess?.medianTfdHours || 0}h</p>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-2">Hours for project to recruit & begin collaboration</p>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

                        {/* SECTION 2: MARKETPLACE HEALTH */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Aggregates */}
                            <Card className="lg:col-span-1">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Marketplace Health Stats</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex justify-between items-center py-2 border-b">
                                        <span className="text-sm font-medium">Active Founders</span>
                                        <Badge variant="secondary" className="font-semibold text-sm">{marketplaceHealth?.activeFounders || 0}</Badge>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b">
                                        <span className="text-sm font-medium">Applications Submitted</span>
                                        <Badge variant="secondary" className="font-semibold text-sm">{marketplaceHealth?.applicationsCount || 0}</Badge>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b">
                                        <span className="text-sm font-medium">Application Acceptance Rate</span>
                                        <span className="text-sm font-bold text-green-600">{marketplaceHealth?.acceptanceRate || 0}%</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b">
                                        <span className="text-sm font-medium">Invite Conversion Rate</span>
                                        <span className="text-sm font-bold text-indigo-650">{marketplaceHealth?.inviteConversion || 0}%</span>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Discipline breakdown */}
                            <Card className="lg:col-span-2">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Active Contributors by Discipline</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {marketplaceHealth?.activeContributors && Object.keys(marketplaceHealth.activeContributors).length > 0 ? (
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                            {Object.entries(marketplaceHealth.activeContributors).map(([discipline, count]) => (
                                                <div key={discipline} className="p-3 border rounded-lg bg-muted/20 flex flex-col justify-center">
                                                    <span className="text-xs text-muted-foreground font-medium truncate">{discipline}</span>
                                                    <span className="text-xl font-bold mt-1">{count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground py-6 text-center">No active contributor discipline data available</p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* SECTION 3: ACTIVATION FUNNEL */}
                        {funnelData.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Activation Funnel</CardTitle>
                                    <CardDescription>User progression through key activation milestones (unique users)</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-[320px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={funnelData} layout="vertical">
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis type="number" />
                                                <YAxis dataKey="label" type="category" width={140} tick={{ fontSize: 12 }} />
                                                <Tooltip
                                                    formatter={(value, name) => [value, name === 'count' ? 'Users' : name]}
                                                    labelFormatter={(label) => label}
                                                    content={({ active, payload, label }) => {
                                                        if (!active || !payload?.length) return null
                                                        const step = funnelData.find(s => s.label === label)
                                                        return (
                                                            <div className="bg-background border rounded-lg p-3 shadow-lg text-sm">
                                                                <p className="font-semibold mb-1">{label}</p>
                                                                <p>Users: <span className="font-bold">{payload[0]?.value}</span></p>
                                                                {step && step.conversion < 100 && (
                                                                    <>
                                                                        <p>Conversion: <span className="text-green-600 font-medium">{step.conversion}%</span></p>
                                                                        <p>Drop-off: <span className="text-red-500 font-medium">{step.dropoff}%</span></p>
                                                                    </>
                                                                )}
                                                            </div>
                                                        )
                                                    }}
                                                />
                                                <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>

                                    {/* Conversion table */}
                                    <div className="mt-4 overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Step</TableHead>
                                                    <TableHead className="text-right">Users</TableHead>
                                                    <TableHead className="text-right">Conversion</TableHead>
                                                    <TableHead className="text-right">Drop-off</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {funnelData.map((step, i) => (
                                                    <TableRow key={i}>
                                                        <TableCell className="font-medium">{step.label}</TableCell>
                                                        <TableCell className="text-right">{step.count}</TableCell>
                                                        <TableCell className="text-right">
                                                            <span className={step.conversion >= 50 ? 'text-green-600' : 'text-amber-600'}>
                                                                {step.conversion}%
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {step.dropoff > 0 && (
                                                                <span className="text-red-500">-{step.dropoff}%</span>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {!funnelData.length && !wcpCount && (
                            <div className="text-center py-16 text-muted-foreground">
                                <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                <p className="text-lg font-medium">No analytics data yet</p>
                                <p className="text-sm mt-1">Analytics data will appear here as users interact with the platform.</p>
                                <Button onClick={loadAnalyticsData} className="mt-4" variant="outline">
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Load Analytics
                                </Button>
                            </div>
                        )}
                        </>
                    )}
                </TabsContent>
            </Tabs>

            {/* ══════════════════════════════════════════
                DELETE CONFIRMATION DIALOG
            ══════════════════════════════════════════ */}
            <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Deletion</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete {deleteDialog?.type}{' '}
                            "{deleteDialog?.name}"? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDialog(null)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDelete}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    )
}
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
    XCircle, Info, AlertTriangle
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts'
import {
    loadPlatformStats, loadAllUsers, loadAllProjects, loadAnnouncements,
    loadGrowthData, loadAdminLogs, updateUserRole, toggleUserDisabled,
    deleteUser, updateProjectStatus, toggleProjectFeatured, deleteProject,
    createAnnouncement, updateAnnouncement, deleteAnnouncement, logAdminAction,
    loadModerationQueue, reviewModerationItem,
    type PlatformStats, type UserData, type ProjectData, type Announcement, type GrowthDataPoint, type ActivityLog, type ModerationItem
} from '@/services/adminService'
import { useToast } from '@/hooks/use-toast'
import { getFlagMessage } from '@/services/contentModerationService'

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
    const [reviewNotes, setReviewNotes] = useState('')

    // Filter states
    const [userSearch, setUserSearch] = useState('')
    const [projectSearch, setProjectSearch] = useState('')
    const [projectStatusFilter, setProjectStatusFilter] = useState('all')

    // Dialog states
    const [announcementDialog, setAnnouncementDialog] = useState(false)
    const [deleteDialog, setDeleteDialog] = useState<{ type: string; id: string; name: string } | null>(null)
    const [newAnnouncement, setNewAnnouncement] = useState({ title: '', message: '', type: 'info' as const })

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setLoading(true)
        try {
            const [statsData, usersData, projectsData, announcementsData, growthDataRes, logsData, moderationData] = await Promise.all([
                loadPlatformStats(),
                loadAllUsers(),
                loadAllProjects(),
                loadAnnouncements(),
                loadGrowthData(30),
                loadAdminLogs(),
                loadModerationQueue()
            ])
            setStats(statsData)
            setUsers(usersData)
            setProjects(projectsData)
            setAnnouncements(announcementsData)
            setGrowthData(growthDataRes)
            setActivityLogs(logsData)
            setModerationQueue(moderationData)
        } catch (error) {
            console.error('Error loading admin data:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleRefresh = async () => {
        setRefreshing(true)
        await loadData()
        setRefreshing(false)
    }

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

    // User actions
    const handleUserRoleChange = async (userId: string, role: string, userName: string) => {
        try {
            await updateUserRole(userId, role)
            await logAdminAction('change_role', user!.uid, user!.displayName || user!.email || '', 'user', userId, userName, `Changed role to ${role}`)
            setUsers(users.map(u => u.id === userId ? { ...u, role } : u))
            toast({ title: 'Role Updated', description: `${userName}'s role updated to ${role}`, variant: 'success' })
        } catch (error) {
            console.error('Error updating role:', error)
            toast({ title: 'Update Failed', description: 'Failed to update user role', variant: 'destructive' })
        }
    }

    const handleToggleUserDisabled = async (userId: string, disabled: boolean, userName: string) => {
        try {
            await toggleUserDisabled(userId, disabled)
            await logAdminAction(disabled ? 'disable_user' : 'enable_user', user!.uid, user!.displayName || '', 'user', userId, userName)
            setUsers(users.map(u => u.id === userId ? { ...u, disabled } : u))
            toast({ title: disabled ? 'User Disabled' : 'User Enabled', description: `${userName} has been ${disabled ? 'disabled' : 'enabled'}`, variant: 'success' })
        } catch (error) {
            console.error('Error toggling user:', error)
            toast({ title: 'Action Failed', description: 'Failed to update user status', variant: 'destructive' })
        }
    }

    // Project actions
    const handleProjectStatusChange = async (projectId: string, status: string, projectTitle: string) => {
        try {
            await updateProjectStatus(projectId, status)
            await logAdminAction('change_status', user!.uid, user!.displayName || '', 'project', projectId, projectTitle, `Changed status to ${status}`)
            setProjects(projects.map(p => p.id === projectId ? { ...p, status } : p))
        } catch (error) {
            console.error('Error updating status:', error)
        }
    }

    const handleToggleFeatured = async (projectId: string, featured: boolean, projectTitle: string) => {
        try {
            await toggleProjectFeatured(projectId, featured)
            await logAdminAction(featured ? 'feature_project' : 'unfeature_project', user!.uid, user!.displayName || '', 'project', projectId, projectTitle)
            setProjects(projects.map(p => p.id === projectId ? { ...p, featured } : p))
        } catch (error) {
            console.error('Error toggling featured:', error)
        }
    }

    // Delete handlers
    const handleDelete = async () => {
        if (!deleteDialog) return
        try {
            if (deleteDialog.type === 'user') {
                await deleteUser(deleteDialog.id)
                await logAdminAction('delete_user', user!.uid, user!.displayName || '', 'user', deleteDialog.id, deleteDialog.name)
                setUsers(users.filter(u => u.id !== deleteDialog.id))
            } else if (deleteDialog.type === 'project') {
                await deleteProject(deleteDialog.id)
                await logAdminAction('delete_project', user!.uid, user!.displayName || '', 'project', deleteDialog.id, deleteDialog.name)
                setProjects(projects.filter(p => p.id !== deleteDialog.id))
            } else if (deleteDialog.type === 'announcement') {
                await deleteAnnouncement(deleteDialog.id)
                setAnnouncements(announcements.filter(a => a.id !== deleteDialog.id))
            }
            toast({ title: 'Deleted', description: `${deleteDialog.type} "${deleteDialog.name}" has been deleted`, variant: 'success' })
        } catch (error) {
            console.error('Error deleting:', error)
            toast({ title: 'Delete Failed', description: `Failed to delete ${deleteDialog.type}`, variant: 'destructive' })
        } finally {
            setDeleteDialog(null)
        }
    }

    // Announcement actions
    const handleCreateAnnouncement = async () => {
        try {
            const id = await createAnnouncement(newAnnouncement.title, newAnnouncement.message, newAnnouncement.type, null, user!.uid)
            await loadAnnouncements().then(setAnnouncements)
            setAnnouncementDialog(false)
            setNewAnnouncement({ title: '', message: '', type: 'info' })
            toast({ title: 'Announcement Created', description: 'Your announcement has been published', variant: 'success' })
        } catch (error) {
            console.error('Error creating announcement:', error)
            toast({ title: 'Creation Failed', description: 'Failed to create announcement', variant: 'destructive' })
        }
    }

    const handleToggleAnnouncement = async (id: string, active: boolean) => {
        try {
            await updateAnnouncement(id, { active })
            setAnnouncements(announcements.map(a => a.id === id ? { ...a, active } : a))
        } catch (error) {
            console.error('Error updating announcement:', error)
        }
    }

    // Filtered data
    const filteredUsers = users.filter(u =>
        u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.displayName?.toLowerCase().includes(userSearch.toLowerCase()) ||
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(userSearch.toLowerCase())
    )

    const filteredProjects = projects.filter(p => {
        const matchesSearch = p.title?.toLowerCase().includes(projectSearch.toLowerCase()) ||
            p.creatorName?.toLowerCase().includes(projectSearch.toLowerCase())
        const matchesStatus = projectStatusFilter === 'all' || p.status === projectStatusFilter
        return matchesSearch && matchesStatus
    })

    const statCards = [
        { title: 'Total Users', value: stats?.totalUsers || 0, icon: Users, color: 'blue', change: `+${stats?.newSignups || 0} this month` },
        { title: 'Total Projects', value: stats?.totalProjects || 0, icon: FolderKanban, color: 'green', change: '' },
        { title: 'Active Users', value: stats?.activeUsers || 0, icon: Activity, color: 'purple', change: 'Last 7 days' },
        { title: 'Featured', value: stats?.featuredProjects || 0, icon: Star, color: 'yellow', change: 'Projects' },
    ]

    const getAnnouncementIcon = (type: string) => {
        switch (type) {
            case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />
            case 'error': return <XCircle className="h-4 w-4 text-red-500" />
            case 'success': return <CheckCircle2 className="h-4 w-4 text-green-500" />
            default: return <Info className="h-4 w-4 text-blue-500" />
        }
    }

    return (
        <DashboardLayout>
            <div className="mb-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-3">
                            <Shield className="h-8 w-8 text-red-600" />
                            Admin Dashboard
                        </h1>
                        <p className="text-muted-foreground mt-1">Manage users, projects, and platform settings</p>
                    </div>
                    <Button onClick={handleRefresh} variant="outline" disabled={refreshing}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-6">
                    <TabsTrigger value="overview"><BarChart3 className="h-4 w-4 mr-2" />Overview</TabsTrigger>
                    <TabsTrigger value="moderation" className="relative">
                        <Shield className="h-4 w-4 mr-2" />Moderation
                        {moderationQueue.length > 0 && (
                            <Badge variant="destructive" className="ml-2 h-5 min-w-[20px] px-1">
                                {moderationQueue.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="users"><Users className="h-4 w-4 mr-2" />Users</TabsTrigger>
                    <TabsTrigger value="projects"><FolderKanban className="h-4 w-4 mr-2" />Projects</TabsTrigger>
                    <TabsTrigger value="announcements"><Megaphone className="h-4 w-4 mr-2" />Announcements</TabsTrigger>
                    <TabsTrigger value="activity"><Activity className="h-4 w-4 mr-2" />Activity</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        {statCards.map((stat, i) => (
                            <Card key={i}>
                                <CardContent className="p-6">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-sm text-muted-foreground">{stat.title}</p>
                                            <h3 className="text-3xl font-bold mt-2">{loading ? '...' : stat.value}</h3>
                                            {stat.change && <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>}
                                        </div>
                                        <div className={`p-3 rounded-lg bg-${stat.color}-100 dark:bg-${stat.color}-900/30`}>
                                            <stat.icon className={`h-6 w-6 text-${stat.color}-600`} />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                    <Card>
                        <CardHeader><CardTitle>Growth Trends (Last 30 Days)</CardTitle></CardHeader>
                        <CardContent>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={growthData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Line type="monotone" dataKey="users" stroke="#3b82f6" name="New Users" />
                                        <Line type="monotone" dataKey="projects" stroke="#10b981" name="New Projects" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Moderation Tab */}
                <TabsContent value="moderation">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="h-5 w-5" />
                                Content Moderation Queue
                            </CardTitle>
                            <CardDescription>
                                Review projects that have been flagged for potential issues before they go live.
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
                                        <Card key={item.id} className="border-l-4 border-l-yellow-500">
                                            <CardContent className="p-6">
                                                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <h3 className="text-lg font-semibold">{item.projectTitle}</h3>
                                                            <Badge variant="outline" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                                                                Risk Score: {item.riskScore}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                                                            {item.projectDescription || 'No description provided'}
                                                        </p>
                                                        <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                                                            <span>Created by: <strong>{item.creatorName}</strong></span>
                                                            <span>•</span>
                                                            <span>{formatTimeAgo(item.createdAt)}</span>
                                                        </div>

                                                        {/* Flags */}
                                                        <div className="space-y-2">
                                                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Issues Found:</p>
                                                            {item.flags.map((flag, idx) => (
                                                                <div key={idx} className={`flex items-start gap-2 text-sm p-2 rounded ${flag.severity === 'high' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' :
                                                                        flag.severity === 'medium' ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400' :
                                                                            'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                                                                    }`}>
                                                                    <span>
                                                                        {flag.severity === 'high' ? '🔴' : flag.severity === 'medium' ? '🟡' : '🔵'}
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
                                                                    await reviewModerationItem(item.id, item.projectId, 'approved', user.uid, reviewNotes)
                                                                    toast({ title: 'Approved', description: 'Project has been approved.', variant: 'success' })
                                                                    setReviewNotes('')
                                                                    loadData()
                                                                } catch (err) {
                                                                    toast({ title: 'Error', description: 'Failed to approve project.', variant: 'destructive' })
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
                                                                    await reviewModerationItem(item.id, item.projectId, 'rejected', user.uid, reviewNotes)
                                                                    toast({ title: 'Rejected', description: 'Project has been rejected.', variant: 'success' })
                                                                    setReviewNotes('')
                                                                    loadData()
                                                                } catch (err) {
                                                                    toast({ title: 'Error', description: 'Failed to reject project.', variant: 'destructive' })
                                                                }
                                                            }}
                                                        >
                                                            <XCircle className="h-4 w-4 mr-2" />
                                                            Reject
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            onClick={() => window.open(`/project/${item.projectId}`, '_blank')}
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

                {/* Users Tab */}
                <TabsContent value="users">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>User Management</CardTitle>
                                <div className="relative w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input placeholder="Search users..." className="pl-9" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
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
                                                            <AvatarFallback>{(u.firstName?.[0] || u.email?.[0] || 'U').toUpperCase()}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="font-medium">{u.displayName || `${u.firstName} ${u.lastName}` || u.email}</p>
                                                            <p className="text-xs text-muted-foreground">{u.email}</p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Select value={u.role || 'member'} onValueChange={(v) => handleUserRoleChange(u.id, v, u.displayName || u.email || '')}>
                                                        <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="admin">Admin</SelectItem>
                                                            <SelectItem value="member">Member</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell>{u.discipline || '-'}</TableCell>
                                                <TableCell>{formatDate(u.createdAt)}</TableCell>
                                                <TableCell>
                                                    <Switch checked={!u.disabled} onCheckedChange={(checked) => handleToggleUserDisabled(u.id, !checked, u.displayName || u.email || '')} />
                                                </TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" onClick={() => window.open(`/profile/${u.id}`, '_blank')}><Eye className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="text-red-600" onClick={() => setDeleteDialog({ type: 'user', id: u.id, name: u.displayName || u.email || '' })}><Trash2 className="h-4 w-4" /></Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Projects Tab */}
                <TabsContent value="projects">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center gap-4">
                                <CardTitle>Project Management</CardTitle>
                                <div className="flex gap-2">
                                    <div className="relative w-64">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input placeholder="Search projects..." className="pl-9" value={projectSearch} onChange={(e) => setProjectSearch(e.target.value)} />
                                    </div>
                                    <Select value={projectStatusFilter} onValueChange={setProjectStatusFilter}>
                                        <SelectTrigger className="w-32"><SelectValue placeholder="Status" /></SelectTrigger>
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
                                                        <p className="text-xs text-muted-foreground">{p.primaryDiscipline}</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{p.creatorName}</TableCell>
                                                <TableCell>
                                                    <Select value={p.status} onValueChange={(v) => handleProjectStatusChange(p.id, v, p.title)}>
                                                        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="recruiting">Recruiting</SelectItem>
                                                            <SelectItem value="active">Active</SelectItem>
                                                            <SelectItem value="completed">Completed</SelectItem>
                                                            <SelectItem value="on-hold">On Hold</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell>
                                                    <Switch checked={p.featured || false} onCheckedChange={(checked) => handleToggleFeatured(p.id, checked, p.title)} />
                                                </TableCell>
                                                <TableCell>{formatDate(p.createdAt)}</TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" onClick={() => window.open(`/project/${p.id}`, '_blank')}><Eye className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="text-red-600" onClick={() => setDeleteDialog({ type: 'project', id: p.id, name: p.title })}><Trash2 className="h-4 w-4" /></Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Announcements Tab */}
                <TabsContent value="announcements">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Platform Announcements</CardTitle>
                                <Dialog open={announcementDialog} onOpenChange={setAnnouncementDialog}>
                                    <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Announcement</Button></DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader><DialogTitle>Create Announcement</DialogTitle></DialogHeader>
                                        <div className="space-y-4 py-4">
                                            <div><Label>Title</Label><Input value={newAnnouncement.title} onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })} /></div>
                                            <div><Label>Message</Label><Textarea value={newAnnouncement.message} onChange={(e) => setNewAnnouncement({ ...newAnnouncement, message: e.target.value })} /></div>
                                            <div><Label>Type</Label>
                                                <Select value={newAnnouncement.type} onValueChange={(v: any) => setNewAnnouncement({ ...newAnnouncement, type: v })}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="info">Info</SelectItem>
                                                        <SelectItem value="success">Success</SelectItem>
                                                        <SelectItem value="warning">Warning</SelectItem>
                                                        <SelectItem value="error">Error</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <DialogFooter><Button onClick={handleCreateAnnouncement}>Create</Button></DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {announcements.map((a) => (
                                    <div key={a.id} className="flex items-center justify-between p-4 border rounded-lg">
                                        <div className="flex items-center gap-3">
                                            {getAnnouncementIcon(a.type)}
                                            <div>
                                                <p className="font-medium">{a.title}</p>
                                                <p className="text-sm text-muted-foreground">{a.message}</p>
                                                <p className="text-xs text-muted-foreground mt-1">{formatTimeAgo(a.createdAt)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Switch checked={a.active} onCheckedChange={(checked) => handleToggleAnnouncement(a.id, checked)} />
                                            <Button variant="ghost" size="icon" className="text-red-600" onClick={() => setDeleteDialog({ type: 'announcement', id: a.id, name: a.title })}><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                    </div>
                                ))}
                                {announcements.length === 0 && <p className="text-center text-muted-foreground py-8">No announcements yet</p>}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Activity Tab */}
                <TabsContent value="activity">
                    <Card>
                        <CardHeader><CardTitle>Admin Activity Log</CardTitle></CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[500px]">
                                <div className="space-y-3">
                                    {activityLogs.map((log) => (
                                        <div key={log.id} className="flex items-start gap-3 p-3 border rounded-lg">
                                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                                            <div>
                                                <p className="text-sm"><span className="font-medium">{log.userName}</span> {log.action.replace(/_/g, ' ')} {log.targetType}: <span className="font-medium">{log.targetName}</span></p>
                                                {log.details && <p className="text-xs text-muted-foreground">{log.details}</p>}
                                                <p className="text-xs text-muted-foreground mt-1">{formatTimeAgo(log.timestamp)}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {activityLogs.length === 0 && <p className="text-center text-muted-foreground py-8">No activity logs yet</p>}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Deletion</DialogTitle>
                        <DialogDescription>Are you sure you want to delete {deleteDialog?.type} "{deleteDialog?.name}"? This action cannot be undone.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    )
}

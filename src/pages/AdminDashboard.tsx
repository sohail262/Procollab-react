import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
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
    XCircle, Info, AlertTriangle, Flag, Award, BookOpen, Crown,
    Heart, Code2, Compass, ShieldAlert, CheckCircle, HelpCircle, Zap,
    ShieldCheck, GitBranch, Layers, Briefcase, FileText, ChevronDown
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
    loadModerationQueue, reviewModerationItem, grantUserBadge,
    getUserBadges, removeUserBadge,
    type PlatformStats, type UserData, type ProjectData,
    type Announcement, type GrowthDataPoint, type ActivityLog, type ModerationItem
} from '@/services/adminService'
import { loadFeedbacks, resolveFeedback, deleteFeedback, type FeedbackData } from '@/services/feedbackService'
import { useToast } from '@/hooks/use-toast'
import { getFlagMessage } from '@/services/contentModerationService'
import { FCMTestPanel } from '@/components/FCMTestPanel'
import {
    collection, query, where, getDocs, orderBy,
    doc, updateDoc, serverTimestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { BADGE_IMAGES } from '@/lib/badgeImages'
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
import { runSchemaMigration, type MigrationProgress } from '@/services/migrationRunner'

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

const SHOWCASE_BADGES = [
    {
        type: 'verified_collaborator',
        title: 'Verified Collaborator',
        desc: 'Established complete profile setup to build community trust.',
        icon: 'ShieldCheck',
        color: 'text-zinc-650 bg-zinc-50 border-zinc-200 dark:text-zinc-400 dark:bg-zinc-900/50 dark:border-zinc-800',
        bg: 'from-zinc-50 to-zinc-100/50 dark:from-zinc-900/40 dark:to-zinc-950/40',
        border: 'border-zinc-200 dark:border-zinc-800'
    },
    {
        type: 'trusted_teammate',
        title: 'Trusted Teammate',
        desc: 'Outstanding cooperation ratings across team deliverables.',
        icon: 'Users',
        color: 'text-cyan-600 bg-cyan-50 border-cyan-200 dark:text-cyan-400 dark:bg-cyan-950/20 dark:border-cyan-900',
        bg: 'from-cyan-50 to-teal-50/50 dark:from-cyan-950/30 dark:to-teal-950/30',
        border: 'border-cyan-200 dark:border-cyan-800'
    },
    {
        type: 'reliable_contributor',
        title: 'Reliable Contributor',
        desc: 'Shipped 10+ tasks on or before schedule with high reliability.',
        icon: 'Clock',
        color: 'text-amber-650 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/20 dark:border-amber-900',
        bg: 'from-amber-50 to-orange-50/50 dark:from-amber-950/30 dark:to-orange-950/30',
        border: 'border-amber-200 dark:border-amber-800'
    },
    {
        type: 'proven_professional',
        title: 'Proven Professional',
        desc: 'Exceptional reviews across a substantial project history.',
        icon: 'Shield',
        color: 'text-indigo-650 bg-indigo-50 border-indigo-200 dark:text-indigo-400 dark:bg-indigo-950/20 dark:border-indigo-900',
        bg: 'from-indigo-50 to-purple-50/50 dark:from-indigo-950/25 dark:to-purple-950/25',
        border: 'border-indigo-200 dark:border-indigo-800'
    },
    {
        type: 'project_finisher',
        title: 'Project Finisher',
        desc: 'Completed project milestones and delivered assigned tasks.',
        icon: 'CheckCircle',
        color: 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950/20 dark:border-green-900',
        bg: 'from-green-50 to-emerald-50/50 dark:from-green-950/30 dark:to-emerald-950/30',
        border: 'border-green-200 dark:border-green-800'
    },
    {
        type: 'project_veteran',
        title: 'Project Veteran',
        desc: 'Successfully completed 5 verified projects on the platform.',
        icon: 'Award',
        color: 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-450 dark:bg-yellow-950/20 dark:border-yellow-900',
        bg: 'from-yellow-50 to-amber-50/50 dark:from-yellow-950/30 dark:to-amber-950/30',
        border: 'border-yellow-200 dark:border-yellow-800'
    },
    {
        type: 'project_master',
        title: 'Project Master',
        desc: 'Completed 10 verified projects with outstanding completion rates.',
        icon: 'Crown',
        color: 'text-amber-650 bg-amber-50 border-amber-200 dark:text-amber-450 dark:bg-amber-950/20 dark:border-amber-900',
        bg: 'from-amber-50 to-yellow-50/50 dark:from-amber-950/35 dark:to-yellow-950/35',
        border: 'border-amber-200 dark:border-amber-800'
    },
    {
        type: 'verified_deliverer',
        title: 'Verified Deliverer',
        desc: 'Completed projects with verified team activity levels.',
        icon: 'GitBranch',
        color: 'text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-950/20 dark:border-purple-900',
        bg: 'from-purple-50 to-indigo-50/50 dark:from-purple-950/30 dark:to-indigo-950/30',
        border: 'border-purple-200 dark:border-purple-800'
    },
    {
        type: 'team_builder',
        title: 'Team Builder',
        desc: 'Exhibited exceptional team coordination and alignment.',
        icon: 'Users',
        color: 'text-sky-600 bg-sky-50 border-sky-200 dark:text-sky-400 dark:bg-sky-950/20 dark:border-sky-900',
        bg: 'from-sky-50 to-cyan-50/50 dark:from-sky-950/30 dark:to-cyan-950/30',
        border: 'border-sky-200 dark:border-sky-800'
    },
    {
        type: 'outstanding_collaborator',
        title: 'Outstanding Collaborator',
        desc: 'Praised by teammates for cooperation and communication.',
        icon: 'Heart',
        color: 'text-rose-600 bg-rose-50 border-rose-200 dark:text-rose-450 dark:bg-rose-950/20 dark:border-rose-900',
        bg: 'from-rose-50 to-pink-50/50 dark:from-rose-950/30 dark:to-pink-950/30',
        border: 'border-rose-200 dark:border-rose-800'
    },
    {
        type: 'cross_functional_dev',
        title: 'Cross-Functional Contributor',
        desc: 'Versatile capabilities across multiple project disciplines.',
        icon: 'Layers',
        color: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-450 dark:bg-emerald-950/20 dark:border-emerald-900',
        bg: 'from-emerald-50 to-teal-50/50 dark:from-emerald-950/30 dark:to-teal-950/30',
        border: 'border-emerald-200 dark:border-emerald-800'
    },
    {
        type: 'project_leader',
        title: 'Project Leader',
        desc: 'Outstanding project leadership, coordination, and team direction.',
        icon: 'Compass',
        color: 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/20 dark:border-blue-900',
        bg: 'from-blue-50 to-cyan-50/50 dark:from-blue-950/30 dark:to-cyan-950/30',
        border: 'border-blue-200 dark:border-blue-800'
    },
    {
        type: 'delivery_manager',
        title: 'Delivery Manager',
        desc: 'Delivered milestones and managed timeline goals for product teams.',
        icon: 'Briefcase',
        color: 'text-violet-650 bg-violet-50 border-violet-200 dark:text-violet-400 dark:bg-violet-950/20 dark:border-violet-900',
        bg: 'from-violet-50 to-fuchsia-50/50 dark:from-violet-950/30 dark:to-fuchsia-950/30',
        border: 'border-violet-200 dark:border-violet-850'
    },
    {
        type: 'top_rated',
        title: 'Top Rated',
        desc: 'Overall peer rating of 4.8+ stars across minimum 10 reviews.',
        icon: 'Star',
        color: 'text-amber-500 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/20 dark:border-amber-900',
        bg: 'from-amber-50 to-yellow-50/50 dark:from-amber-950/30 dark:to-yellow-950/30',
        border: 'border-amber-200 dark:border-amber-800'
    },
    {
        type: 'community_trusted',
        title: 'Community Trusted',
        desc: 'Exceptional ratings across 20+ peer evaluations.',
        icon: 'ShieldAlert',
        color: 'text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-450 dark:bg-orange-950/20 dark:border-orange-900',
        bg: 'from-orange-50 to-red-50/50 dark:from-orange-950/35 dark:to-red-950/35',
        border: 'border-orange-200 dark:border-orange-800'
    },
    {
        type: 'verified_mentor',
        title: 'Verified Mentor',
        desc: 'Exceptional guidance and mentorship of project teams.',
        icon: 'BookOpen',
        color: 'text-lime-650 bg-lime-50 border-lime-200 dark:text-lime-400 dark:bg-lime-950/20 dark:border-lime-900',
        bg: 'from-lime-50 to-emerald-50/50 dark:from-lime-950/30 dark:to-lime-950/30',
        border: 'border-lime-200 dark:border-lime-800'
    },
    {
        type: 'knowledge_contributor',
        title: 'Knowledge Contributor',
        desc: 'Contributions to community documentation, wiki, or research.',
        icon: 'FileText',
        color: 'text-pink-650 bg-pink-50 border-pink-200 dark:text-pink-400 dark:bg-pink-950/20 dark:border-pink-900',
        bg: 'from-pink-50 to-rose-50/50 dark:from-pink-950/30 dark:to-pink-950/30',
        border: 'border-pink-200 dark:border-pink-800'
    }
]

const renderBadgeIcon = (iconName: string, className = "h-5 w-5") => {
    const IconComp = (
        iconName === 'ShieldCheck' ? ShieldCheck :
        iconName === 'Users' ? Users :
        iconName === 'Clock' ? Clock :
        iconName === 'Shield' ? Shield :
        iconName === 'CheckCircle' ? CheckCircle :
        iconName === 'Award' ? Award :
        iconName === 'Crown' ? Crown :
        iconName === 'GitBranch' ? GitBranch :
        iconName === 'Heart' ? Heart :
        iconName === 'Layers' ? Layers :
        iconName === 'Compass' ? Compass :
        iconName === 'Briefcase' ? Briefcase :
        iconName === 'Code2' ? Code2 :
        iconName === 'BarChart3' ? BarChart3 :
        iconName === 'Star' ? Star :
        iconName === 'ShieldAlert' ? ShieldAlert :
        iconName === 'BookOpen' ? BookOpen :
        iconName === 'FileText' ? FileText :
        Award
    )
    return <IconComp className={className} />
}

export function AdminDashboard() {
    const { user } = useAuth()
    const { toast } = useToast()
    const [activeTab, setActiveTab] = useState('overview')
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [feedbacks, setFeedbacks] = useState<FeedbackData[]>([])
    const [feedbackFilter, setFeedbackFilter] = useState('all')
    const [viewingScreenshot, setViewingScreenshot] = useState<string | null>(null)

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

    // Migration states
    const [migrationLoading, setMigrationLoading] = useState(false)
    const [migrationResult, setMigrationResult] = useState<MigrationProgress | null>(null)

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

    // Badge Assignment States
    const [selectedUserForBadge, setSelectedUserForBadge] = useState<string>('')
    const [userDropdownSearch, setUserDropdownSearch] = useState('')
    const [userSearchOpen, setUserSearchOpen] = useState(false)
    const [badgeType, setBadgeType] = useState<string>('project_leader')
    const [selectedBadges, setSelectedBadges] = useState<string[]>([])
    const [badgeSearch, setBadgeSearch] = useState('')
    const [grantMode, setGrantMode] = useState<'predefined' | 'custom'>('predefined')
    const [customBadgeType, setCustomBadgeType] = useState<string>('')
    const [badgeTitle, setBadgeTitle] = useState<string>('Project Leader')
    const [badgeDescription, setBadgeDescription] = useState<string>('Demonstrated outstanding project leadership, coordination, and team direction.')
    const [badgeIcon, setBadgeIcon] = useState<string>('Compass')
    const [badgeEvidence, setBadgeEvidence] = useState<string>('')
    const [submittingBadge, setSubmittingBadge] = useState<boolean>(false)
    const [selectedUserBadges, setSelectedUserBadges] = useState<any[]>([])
    const [loadingUserBadges, setLoadingUserBadges] = useState<boolean>(false)

    const PREDEFINED_BADGES = [
        // Trust
        { type: 'verified_collaborator', title: 'Verified Collaborator', desc: 'Established complete profile setup to build community trust.', icon: 'ShieldCheck' },
        { type: 'trusted_teammate', title: 'Trusted Teammate', desc: 'Maintained outstanding cooperation ratings across multiple team deliverables.', icon: 'Users' },
        { type: 'reliable_contributor', title: 'Reliable Contributor', desc: 'Successfully shipped 10+ tasks on or before schedule with high reliability.', icon: 'Clock' },
        { type: 'proven_professional', title: 'Proven Professional', desc: 'Maintained exceptional quality and reviews across a substantial project history.', icon: 'Shield' },
        // Delivery
        { type: 'project_finisher', title: 'Project Finisher', desc: 'Successfully completed project milestones and delivered assigned tasks.', icon: 'CheckCircle' },
        { type: 'project_veteran', title: 'Project Veteran', desc: 'Successfully completed 5 verified projects on the platform.', icon: 'Award' },
        { type: 'project_master', title: 'Project Master', desc: 'Successfully completed 10 verified projects with outstanding completion rates.', icon: 'Crown' },
        { type: 'verified_deliverer', title: 'Verified Deliverer', desc: 'Completed projects with verified team activity levels.', icon: 'GitBranch' },
        // Collaboration
        { type: 'team_builder', title: 'Team Builder', desc: 'Exhibited exceptional team coordination and alignment on project deliverables.', icon: 'Users' },
        { type: 'outstanding_collaborator', title: 'Outstanding Collaborator', desc: 'Consistently praised by teammates for cooperation and communication.', icon: 'Heart' },
        { type: 'cross_functional_dev', title: 'Cross-Functional Contributor', desc: 'Demonstrated versatile capabilities across multiple project disciplines.', icon: 'Layers' },
        // Leadership (Admin Granted)
        { type: 'project_leader', title: 'Project Leader', desc: 'Demonstrated outstanding project leadership, coordination, and team direction.', icon: 'Compass' },
        { type: 'delivery_manager', title: 'Delivery Manager', desc: 'Consistently delivered milestones and managed timeline goals for product teams.', icon: 'Briefcase' },
        // Reputation
        { type: 'top_rated', title: 'Top Rated', desc: 'Maintained an overall peer rating of 4.8+ stars across a large project history.', icon: 'Star' },
        { type: 'community_trusted', title: 'Community Trusted', desc: 'Achieved legendary reputation with exceptional ratings across 20+ peer evaluations.', icon: 'ShieldAlert' },
        // Community (Admin Granted)
        { type: 'verified_mentor', title: 'Verified Mentor', desc: 'Recognized for exceptional guidance and mentorship of project teams.', icon: 'BookOpen' },
        { type: 'knowledge_contributor', title: 'Knowledge Contributor', desc: 'Outstanding contributions to community documentation, wiki, or research.', icon: 'FileText' }
    ]

    const filteredUsersForBadge = users.filter(u => {
        const fullName = `${u.firstName || ''} ${u.lastName || ''} ${u.displayName || ''}`.toLowerCase()
        const email = (u.email || '').toLowerCase()
        const query = userDropdownSearch.toLowerCase()
        return fullName.includes(query) || email.includes(query)
    })

    const filteredBadges = PREDEFINED_BADGES.filter(b => {
        const query = badgeSearch.toLowerCase()
        return b.title.toLowerCase().includes(query) || b.desc.toLowerCase().includes(query) || b.type.toLowerCase().includes(query)
    })

    const handleBadgeTypeChange = (value: string) => {
        setBadgeType(value)
        if (value === 'custom') {
            setCustomBadgeType('')
            setBadgeTitle('')
            setBadgeDescription('')
            setBadgeIcon('Award')
        } else {
            const found = PREDEFINED_BADGES.find(b => b.type === value)
            if (found) {
                setBadgeTitle(found.title)
                setBadgeDescription(found.desc)
                setBadgeIcon(found.icon)
            }
        }
    }

    const handleGrantBadge = async () => {
        if (!selectedUserForBadge) {
            toast({
                title: 'Error',
                description: 'Please select a user to award the badge.',
                variant: 'destructive'
            })
            return
        }

        setSubmittingBadge(true)
        try {
            const selectedUser = users.find(u => u.id === selectedUserForBadge)
            const userName = selectedUser
                ? (selectedUser.displayName || `${selectedUser.firstName} ${selectedUser.lastName}` || selectedUser.email || '')
                : 'Unknown User'

            if (grantMode === 'predefined') {
                if (selectedBadges.length === 0) {
                    toast({
                        title: 'Error',
                        description: 'Please select at least one badge.',
                        variant: 'destructive'
                    })
                    setSubmittingBadge(false)
                    return
                }

                // Grant each selected badge in parallel
                await Promise.all(selectedBadges.map(async (type) => {
                    const badgeInfo = PREDEFINED_BADGES.find(b => b.type === type)
                    if (!badgeInfo) return

                    await grantUserBadge(selectedUserForBadge, {
                        badgeType: type,
                        title: badgeInfo.title,
                        description: badgeInfo.desc,
                        icon: badgeInfo.icon,
                        evidence: {
                            assignedByAdmin: true,
                            assignedAt: new Date().toISOString(),
                            reason: badgeEvidence.trim() || 'Awarded by Administrator'
                        }
                    })

                    await logAdminAction(
                        'grant_badge',
                        user!.uid,
                        user!.displayName || user!.email || '',
                        'user',
                        selectedUserForBadge,
                        userName,
                        `Granted badge: ${badgeInfo.title} (${type})`
                    )
                }))

                toast({
                    title: 'Badges Granted Successfully',
                    description: `Successfully awarded ${selectedBadges.length} badges to ${userName}.`,
                    variant: 'success'
                })
                setSelectedBadges([])
            } else {
                // Custom badge mode
                const finalBadgeType = customBadgeType.trim().toLowerCase().replace(/\s+/g, '_')
                if (!finalBadgeType) {
                    toast({
                        title: 'Error',
                        description: 'Please specify a badge ID/type.',
                        variant: 'destructive'
                    })
                    setSubmittingBadge(false)
                    return
                }
                if (!badgeTitle.trim()) {
                    toast({
                        title: 'Error',
                        description: 'Please enter a badge title.',
                        variant: 'destructive'
                    })
                    setSubmittingBadge(false)
                    return
                }
                if (!badgeDescription.trim()) {
                    toast({
                        title: 'Error',
                        description: 'Please enter a badge description.',
                        variant: 'destructive'
                    })
                    setSubmittingBadge(false)
                    return
                }

                await grantUserBadge(selectedUserForBadge, {
                    badgeType: finalBadgeType,
                    title: badgeTitle.trim(),
                    description: badgeDescription.trim(),
                    icon: badgeIcon,
                    evidence: {
                        assignedByAdmin: true,
                        assignedAt: new Date().toISOString(),
                        reason: badgeEvidence.trim() || 'Awarded by Administrator'
                    }
                })

                await logAdminAction(
                    'grant_badge',
                    user!.uid,
                    user!.displayName || user!.email || '',
                    'user',
                    selectedUserForBadge,
                    userName,
                    `Granted custom badge: ${badgeTitle.trim()} (${finalBadgeType})`
                )

                toast({
                    title: 'Badge Granted Successfully',
                    description: `Successfully awarded the "${badgeTitle.trim()}" custom badge to ${userName}.`,
                    variant: 'success'
                })
                setCustomBadgeType('')
                setBadgeTitle('')
                setBadgeDescription('')
            }

            setBadgeEvidence('')
            loadData() // Refresh data/badges lists
            loadUserBadges(selectedUserForBadge) // Refresh current user's badges list
        } catch (error) {
            console.error('Error granting badge:', error)
            toast({
                title: 'Operation Failed',
                description: 'Failed to assign badge(s). Please try again.',
                variant: 'destructive'
            })
        } finally {
            setSubmittingBadge(false)
        }
    }

    const loadUserBadges = async (userId: string) => {
        if (!userId) {
            setSelectedUserBadges([])
            return
        }
        setLoadingUserBadges(true)
        try {
            const badges = await getUserBadges(userId)
            badges.sort((a, b) => {
                const timeA = a.issuedAt?.toDate ? a.issuedAt.toDate().getTime() : new Date(a.issuedAt || 0).getTime()
                const timeB = b.issuedAt?.toDate ? b.issuedAt.toDate().getTime() : new Date(b.issuedAt || 0).getTime()
                return timeB - timeA
            })
            setSelectedUserBadges(badges)
        } catch (error) {
            console.error('Error loading user badges:', error)
        } finally {
            setLoadingUserBadges(false)
        }
    }

    const handleRemoveBadge = async (badgeId: string, title: string) => {
        if (!selectedUserForBadge) return
        
        const selectedUser = users.find(u => u.id === selectedUserForBadge)
        const userName = selectedUser
            ? (selectedUser.displayName || `${selectedUser.firstName} ${selectedUser.lastName}` || selectedUser.email || '')
            : 'Unknown User'

        try {
            await removeUserBadge(selectedUserForBadge, badgeId)
            
            await logAdminAction(
                'remove_badge',
                user!.uid,
                user!.displayName || user!.email || '',
                'user',
                selectedUserForBadge,
                userName,
                `Removed badge: ${title} (${badgeId})`
            )

            toast({
                title: 'Badge Removed Successfully',
                description: `Successfully removed the "${title}" badge from ${userName}.`,
                variant: 'success'
            })
            
            loadUserBadges(selectedUserForBadge)
        } catch (error) {
            console.error('Error removing badge:', error)
            toast({
                title: 'Operation Failed',
                description: 'Failed to remove badge. Please try again.',
                variant: 'destructive'
            })
        }
    }

    useEffect(() => {
        loadUserBadges(selectedUserForBadge)
    }, [selectedUserForBadge])

    useEffect(() => {
        loadData()
    }, [])

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const tab = params.get('tab')
        if (tab) {
            setActiveTab(tab)
        }
    }, [])

    const loadFeedbacksLocal = async (): Promise<FeedbackData[]> => {
        try {
            return await loadFeedbacks()
        } catch (error) {
            console.error('Error loading feedbacks:', error)
            return []
        }
    }

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
                reportsData,
                feedbacksData
            ] = await Promise.all([
                loadPlatformStats(),
                loadAllUsers(),
                loadAllProjects(),
                loadAnnouncements(),
                loadGrowthData(30),
                loadAdminLogs(),
                loadModerationQueue(),
                loadReports(),
                loadFeedbacksLocal()
            ])
            setStats(statsData)
            setUsers(usersData)
            setProjects(projectsData)
            setAnnouncements(announcementsData)
            setGrowthData(growthDataRes)
            setActivityLogs(logsData)
            setModerationQueue(moderationData)
            setReports(reportsData)
            setFeedbacks(feedbacksData)
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

    // ─── Migration Actions ────────────────────────────────
    const handleRunMigration = async () => {
        setMigrationLoading(true)
        setMigrationResult(null)
        try {
            const res = await runSchemaMigration()
            setMigrationResult(res)
            toast({
                title: 'Migration Completed',
                description: `Successfully migrated ${res.usersUpdated} users and ${res.projectsUpdated} projects.`,
                variant: 'success'
            })
            if (user) {
                await logAdminAction(
                    'run_schema_migration',
                    user.uid,
                    user.displayName || 'Admin',
                    'system',
                    'schema',
                    'Firestore Schema',
                    `Migrated ${res.usersUpdated} users and ${res.projectsUpdated} projects.`
                )
            }
            handleRefresh()
        } catch (error: any) {
            console.error('Error running migration:', error)
            toast({
                title: 'Migration Failed',
                description: error.message || 'An unexpected error occurred.',
                variant: 'destructive'
            })
        } finally {
            setMigrationLoading(false)
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
                <TabsList className="mb-6 w-full justify-start overflow-x-auto flex-nowrap gap-1 scrollbar-none h-11">
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

                    {/* Feedback & Bugs */}
                    <TabsTrigger value="feedback" className="relative">
                        <HelpCircle className="h-4 w-4 mr-2" />
                        Feedback &amp; Bugs
                        {feedbacks.filter(f => !f.resolved).length > 0 && (
                            <Badge
                                variant="destructive"
                                className="ml-2 h-5 min-w-[20px] px-1"
                            >
                                {feedbacks.filter(f => !f.resolved).length}
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

                    {/* Badges & Reputation */}
                    <TabsTrigger value="badges">
                        <Award className="h-4 w-4 mr-2" />
                        Badges & Reputation
                    </TabsTrigger>

                    {/* Migrations */}
                    <TabsTrigger value="migrations">
                        <ShieldAlert className="h-4 w-4 mr-2" />
                        Migrations
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
                    FEEDBACK & BUGS TAB
                ══════════════════════════════════════════ */}
                <TabsContent value="feedback">
                    <Card className="border-white/10 bg-zinc-900/40 backdrop-blur-xl">
                        <CardHeader>
                            <div className="flex justify-between items-center flex-wrap gap-4">
                                <div>
                                    <CardTitle className="flex items-center gap-2 text-white">
                                        <HelpCircle className="h-5 w-5 text-primary" />
                                        User Feedback &amp; Bug Reports
                                    </CardTitle>
                                    <CardDescription className="text-white/60">
                                        Monitor issues, general feedback, and ideas submitted by users.
                                    </CardDescription>
                                </div>

                                {/* Filter & Refresh */}
                                <div className="flex items-center gap-3">
                                    <Select
                                        value={feedbackFilter}
                                        onValueChange={setFeedbackFilter}
                                    >
                                        <SelectTrigger className="w-40 bg-zinc-950/40 border-white/10 text-white">
                                            <SelectValue placeholder="Filter Status" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-zinc-900 border-white/10 text-white">
                                            <SelectItem value="all">All Feedback</SelectItem>
                                            <SelectItem value="pending">Pending</SelectItem>
                                            <SelectItem value="resolved">Resolved</SelectItem>
                                            <SelectItem value="bug">Bugs Only</SelectItem>
                                            <SelectItem value="feature_request">Feature Ideas</SelectItem>
                                            <SelectItem value="feedback">General Only</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent>
                            {feedbacks.length === 0 ? (
                                <div className="text-center py-12">
                                    <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
                                    <h3 className="text-xl font-semibold mb-2 text-white">All Clean!</h3>
                                    <p className="text-white/40">No feedbacks or bug reports submitted yet.</p>
                                </div>
                            ) : (
                                <ScrollArea className="h-[600px] pr-2">
                                    <div className="space-y-4">
                                        {feedbacks
                                            .filter(f => {
                                                if (feedbackFilter === 'pending') return !f.resolved
                                                if (feedbackFilter === 'resolved') return f.resolved
                                                if (feedbackFilter === 'bug') return f.type === 'bug'
                                                if (feedbackFilter === 'feature_request') return f.type === 'feature_request'
                                                if (feedbackFilter === 'feedback') return f.type === 'feedback'
                                                return true
                                            })
                                            .map((item) => (
                                                <Card 
                                                    key={item.id} 
                                                    className={`border-white/5 bg-white/[0.02] backdrop-blur-md border-l-4 ${
                                                        item.resolved 
                                                            ? 'border-l-green-500' 
                                                            : item.type === 'bug' 
                                                            ? 'border-l-red-500' 
                                                            : item.type === 'feature_request'
                                                            ? 'border-l-violet-500'
                                                            : 'border-l-amber-500'
                                                    }`}
                                                >
                                                    <CardContent className="p-5 flex flex-col md:flex-row md:items-start justify-between gap-4">
                                                        <div className="flex-1 space-y-2.5">
                                                            {/* Type & Status */}
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <Badge 
                                                                    className={`capitalize ${
                                                                        item.type === 'bug' 
                                                                            ? 'bg-red-500/20 text-red-400 border-red-500/30' 
                                                                            : item.type === 'feature_request'
                                                                            ? 'bg-violet-500/20 text-violet-400 border-violet-500/30'
                                                                            : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                                                    }`}
                                                                >
                                                                    {item.type === 'bug' ? 'Bug Report' : item.type === 'feature_request' ? 'Feature Idea' : 'General Feedback'}
                                                                </Badge>
                                                                {item.resolved ? (
                                                                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Resolved</Badge>
                                                                ) : (
                                                                    <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30">Pending</Badge>
                                                                )}
                                                            </div>

                                                            {/* Message */}
                                                            <p className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap">
                                                                {item.message}
                                                            </p>

                                                            {/* Screenshot Thumbnail */}
                                                            {item.screenshotURL && (
                                                                <div className="pt-2">
                                                                    <div 
                                                                        onClick={() => setViewingScreenshot(item.screenshotURL!)}
                                                                        className="relative inline-block group cursor-pointer rounded-lg overflow-hidden border border-white/10 h-20 w-36 bg-cover bg-center"
                                                                        style={{ backgroundImage: `url(${item.screenshotURL})` }}
                                                                    >
                                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                            <span className="text-[10px] font-semibold text-white">View Screenshot</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Metadata */}
                                                            <div className="flex items-center gap-3 text-xs text-white/40 flex-wrap">
                                                                <span>
                                                                    Submitted by:{' '}
                                                                    <strong className={item.submittedBy === 'anonymous' ? 'text-white/40 font-normal italic' : 'text-white/60'}>
                                                                        {item.submittedByName}
                                                                        {item.submittedByEmail && ` (${item.submittedByEmail})`}
                                                                    </strong>
                                                                </span>
                                                                <span>•</span>
                                                                <span>{formatTimeAgo(item.createdAt)}</span>
                                                                {item.resolvedAt && (
                                                                    <>
                                                                        <span>•</span>
                                                                        <span>Resolved {formatTimeAgo(item.resolvedAt)}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Action Buttons */}
                                                        <div className="flex flex-col gap-2 md:w-36 flex-shrink-0">
                                                            {!item.resolved ? (
                                                                <Button
                                                                    size="sm"
                                                                    className="bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg h-9 text-xs border-0"
                                                                    onClick={async () => {
                                                                        if (!user) return
                                                                        try {
                                                                            await resolveFeedback(item.id!, user.uid, true)
                                                                            setFeedbacks(prev =>
                                                                                prev.map(f => f.id === item.id ? { ...f, resolved: true } : f)
                                                                            )
                                                                            toast({
                                                                                title: 'Feedback Resolved',
                                                                                description: 'Marked feedback as resolved.',
                                                                                variant: 'success'
                                                                            })
                                                                        } catch (e) {
                                                                            console.error(e)
                                                                            toast({
                                                                                title: 'Action Failed',
                                                                                variant: 'destructive'
                                                                            })
                                                                        }
                                                                    }}
                                                                >
                                                                    <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                                                                    Resolve
                                                                </Button>
                                                            ) : (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="border-white/10 text-white hover:bg-white/5 font-semibold rounded-lg h-9 text-xs"
                                                                    onClick={async () => {
                                                                        if (!user) return
                                                                        try {
                                                                            await resolveFeedback(item.id!, user.uid, false)
                                                                            setFeedbacks(prev =>
                                                                                prev.map(f => f.id === item.id ? { ...f, resolved: false } : f)
                                                                            )
                                                                            toast({
                                                                                title: 'Feedback Reopened',
                                                                                description: 'Reopened the feedback report.',
                                                                            })
                                                                        } catch (e) {
                                                                            console.error(e)
                                                                            toast({
                                                                                title: 'Action Failed',
                                                                                variant: 'destructive'
                                                                            })
                                                                        }
                                                                    }}
                                                                >
                                                                    Reopen
                                                                </Button>
                                                            )}
                                                            <Button
                                                                size="sm"
                                                                variant="destructive"
                                                                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/30 font-semibold rounded-lg h-9 text-xs mt-1"
                                                                onClick={async () => {
                                                                    if (!window.confirm('Are you sure you want to permanently delete this report and its screenshot?')) return
                                                                    try {
                                                                        await deleteFeedback(item.id!, item.screenshotURL)
                                                                        setFeedbacks(prev => prev.filter(f => f.id !== item.id))
                                                                        toast({
                                                                            title: 'Feedback Deleted',
                                                                            description: 'The report and its screenshot were deleted permanently.',
                                                                            variant: 'success'
                                                                        })
                                                                    } catch (e) {
                                                                        console.error(e)
                                                                        toast({
                                                                            title: 'Delete Failed',
                                                                            variant: 'destructive'
                                                                        })
                                                                    }
                                                                }}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                                                Delete Report
                                                            </Button>
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

                {/* ══════════════════════════════════════════
                    BADGES & REPUTATION TAB
                ══════════════════════════════════════════ */}
                <TabsContent value="badges" className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold">Badges & Reputation Management</h2>
                            <p className="text-muted-foreground text-sm">Assign badges, view reputational criteria, and examine visual credentials.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* LEFT COLUMN: ASSIGN BADGES */}
                        <div className="lg:col-span-1 space-y-6">
                            <Card className="border border-slate-200 dark:border-slate-800 shadow-md">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Award className="h-5 w-5 text-indigo-500" />
                                        Grant User Badge
                                    </CardTitle>
                                    <CardDescription>Manually award standard, honorary, or custom credentials to members.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {/* User Selector */}
                                    <div className="space-y-2 relative">
                                        <Label htmlFor="user-select">Select User</Label>
                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={() => setUserSearchOpen(!userSearchOpen)}
                                                className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:ring-offset-slate-950 dark:focus:ring-slate-300 text-left text-slate-900 dark:text-white"
                                            >
                                                <span className="truncate">
                                                    {selectedUserForBadge ? (
                                                        (() => {
                                                            const u = users.find(usr => usr.id === selectedUserForBadge)
                                                            return u ? `${u.displayName || `${u.firstName || ''} ${u.lastName || ''}`} (${u.email || u.id.slice(0, 8)})` : 'Select a user...'
                                                        })()
                                                    ) : (
                                                        'Select a user...'
                                                    )}
                                                </span>
                                                <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                                            </button>

                                            {userSearchOpen && (
                                                <>
                                                    <div 
                                                        className="fixed inset-0 z-40" 
                                                        onClick={() => {
                                                            setUserSearchOpen(false)
                                                            setUserDropdownSearch('')
                                                        }} 
                                                    />
                                                    <div className="absolute z-50 mt-1 max-h-60 w-full overflow-hidden rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-950 dark:text-slate-50 shadow-md animate-in fade-in-0 zoom-in-95">
                                                        <div className="flex items-center border-b border-slate-200 dark:border-slate-800 px-3 py-2">
                                                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50 text-slate-500" />
                                                            <input
                                                                type="text"
                                                                placeholder="Search user by name or email..."
                                                                value={userDropdownSearch}
                                                                onChange={(e) => setUserDropdownSearch(e.target.value)}
                                                                className="flex h-8 w-full rounded-md bg-transparent py-2 text-sm outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50 text-slate-900 dark:text-white"
                                                                autoFocus
                                                            />
                                                        </div>
                                                        <ScrollArea className="h-[180px]">
                                                            <div className="p-1">
                                                                {filteredUsersForBadge.length === 0 ? (
                                                                    <div className="py-6 text-center text-sm text-slate-500">
                                                                        No users found.
                                                                    </div>
                                                                ) : (
                                                                    filteredUsersForBadge.map((u) => (
                                                                        <button
                                                                            key={u.id}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setSelectedUserForBadge(u.id)
                                                                                setUserSearchOpen(false)
                                                                                setUserDropdownSearch('')
                                                                            }}
                                                                            className={`flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer ${selectedUserForBadge === u.id ? 'bg-slate-100 dark:bg-slate-900 font-medium' : ''}`}
                                                                        >
                                                                            <div className="flex flex-col text-left min-w-0">
                                                                                <span className="font-medium truncate text-slate-900 dark:text-white">{u.displayName || `${u.firstName || ''} ${u.lastName || ''}`}</span>
                                                                                <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{u.email}</span>
                                                                            </div>
                                                                            {selectedUserForBadge === u.id && (
                                                                                <CheckCircle className="h-4 w-4 text-indigo-500 shrink-0 ml-2" />
                                                                            )}
                                                                        </button>
                                                                    ))
                                                                )}
                                                            </div>
                                                        </ScrollArea>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {selectedUserForBadge && (
                                        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                            <Label className="text-xs font-semibold text-slate-500">Current Badges ({selectedUserBadges.length})</Label>
                                            {loadingUserBadges ? (
                                                <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
                                                    <RefreshCw className="h-3 w-3 animate-spin text-indigo-500" />
                                                    <span>Loading credentials...</span>
                                                </div>
                                            ) : selectedUserBadges.length === 0 ? (
                                                <p className="text-xs text-slate-400 italic py-1">No badges awarded yet.</p>
                                            ) : (
                                                <div className="grid grid-cols-1 gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                                                    {selectedUserBadges.map((ub) => (
                                                        <div 
                                                            key={ub.id} 
                                                            className="flex items-center justify-between p-2 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-xs"
                                                        >
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <div className="flex-shrink-0 h-6 w-6 flex items-center justify-center rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 overflow-hidden">
                                                                    {BADGE_IMAGES[ub.badgeType] ? (
                                                                        <img
                                                                            src={BADGE_IMAGES[ub.badgeType]}
                                                                            alt={ub.title}
                                                                            className="h-6 w-6 object-contain"
                                                                            draggable={false}
                                                                        />
                                                                    ) : (
                                                                        <Award className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                                                                    )}
                                                                </div>
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="font-bold truncate text-slate-800 dark:text-slate-200">{ub.title}</span>
                                                                    {ub.evidence?.reason && (
                                                                        <span className="text-[9px] text-slate-405 dark:text-slate-500 truncate">{ub.evidence.reason}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                type="button"
                                                                className="h-6 w-6 text-red-500 hover:text-red-750 hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0"
                                                                onClick={() => handleRemoveBadge(ub.id, ub.title)}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Tabs Selector for Badge Type */}
                                    <Tabs value={grantMode} onValueChange={(val) => setGrantMode(val as 'predefined' | 'custom')} className="w-full">
                                        <TabsList className="grid w-full grid-cols-2 mb-4 bg-slate-100 dark:bg-slate-900">
                                            <TabsTrigger value="predefined">Predefined Badges</TabsTrigger>
                                            <TabsTrigger value="custom">Custom Badge</TabsTrigger>
                                        </TabsList>
                                        
                                        <TabsContent value="predefined" className="space-y-4 mt-0">
                                            {/* Search and Checkable Badge List */}
                                            <div className="space-y-2">
                                                <Label>Select Predefined Badges (Select multiple)</Label>
                                                <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-2 bg-white dark:bg-slate-950">
                                                    <Search className="h-4 w-4 opacity-50 shrink-0 text-slate-500" />
                                                    <input
                                                        type="text"
                                                        placeholder="Search badges by title or description..."
                                                        value={badgeSearch}
                                                        onChange={(e) => setBadgeSearch(e.target.value)}
                                                        className="flex h-6 w-full rounded-md bg-transparent text-sm outline-none placeholder:text-slate-500 text-slate-900 dark:text-white"
                                                    />
                                                    {badgeSearch && (
                                                        <button 
                                                            type="button" 
                                                            onClick={() => setBadgeSearch('')}
                                                            className="text-slate-400 hover:text-slate-200"
                                                        >
                                                            <XCircle className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                                
                                                <ScrollArea className="h-[240px] border border-slate-200 dark:border-slate-800 rounded-lg p-2 bg-slate-50 dark:bg-slate-950/40">
                                                    <div className="space-y-1">
                                                        {filteredBadges.length === 0 ? (
                                                            <div className="py-8 text-center text-sm text-slate-500">
                                                                No badges match search criteria.
                                                            </div>
                                                        ) : (
                                                            filteredBadges.map((b) => {
                                                                const isChecked = selectedBadges.includes(b.type)
                                                                return (
                                                                    <label
                                                                        key={b.type}
                                                                        className={`flex items-start gap-3 p-2 rounded-lg border transition-all cursor-pointer select-none ${isChecked ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/80' : 'bg-transparent border-transparent hover:bg-slate-100 dark:hover:bg-slate-900'}`}
                                                                    >
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={isChecked}
                                                                            onChange={() => {
                                                                                if (isChecked) {
                                                                                    setSelectedBadges(selectedBadges.filter(t => t !== b.type))
                                                                                } else {
                                                                                    setSelectedBadges([...selectedBadges, b.type])
                                                                                }
                                                                            }}
                                                                            className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 dark:border-slate-700 text-indigo-650 focus:ring-indigo-500 dark:bg-slate-950 dark:ring-offset-slate-950"
                                                                        />
                                                                        <div className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
                                                                            {BADGE_IMAGES[b.type] ? (
                                                                                <img
                                                                                    src={BADGE_IMAGES[b.type]}
                                                                                    alt={b.title}
                                                                                    className="h-8 w-8 object-contain"
                                                                                    draggable={false}
                                                                                />
                                                                            ) : (
                                                                                <Award className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                                                                            )}
                                                                        </div>
                                                                        <div className="space-y-0.5 flex-1 min-w-0">
                                                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-left">
                                                                                {b.title}
                                                                            </span>
                                                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug text-left">
                                                                                {b.desc}
                                                                            </p>
                                                                        </div>
                                                                    </label>
                                                                )
                                                            })
                                                        )}
                                                    </div>
                                                </ScrollArea>
                                                
                                                {selectedBadges.length > 0 && (
                                                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Selected ({selectedBadges.length}):</span>
                                                        {selectedBadges.map((type) => {
                                                            const b = PREDEFINED_BADGES.find(x => x.type === type)
                                                            return (
                                                                <Badge 
                                                                    key={type} 
                                                                    variant="secondary" 
                                                                    className="flex items-center gap-1 pl-2 pr-1 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-105 dark:border-indigo-900/50"
                                                                >
                                                                    <span className="text-[10px] font-medium">{b?.title || type}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setSelectedBadges(selectedBadges.filter(t => t !== type))}
                                                                        className="rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/80 p-0.5 focus:outline-none"
                                                                    >
                                                                        <XCircle className="h-3 w-3" />
                                                                    </button>
                                                                </Badge>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </TabsContent>
                                        
                                        <TabsContent value="custom" className="space-y-4 mt-0">
                                            {/* Custom Badge Form */}
                                            <div className="space-y-4 bg-slate-50/50 dark:bg-slate-900/10 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                                                <div className="space-y-1.5">
                                                    <Label htmlFor="custom-badge-id">Custom Badge ID (unique)</Label>
                                                    <Input
                                                        id="custom-badge-id"
                                                        placeholder="e.g. hackathon_winner"
                                                        value={customBadgeType}
                                                        onChange={(e) => setCustomBadgeType(e.target.value)}
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label htmlFor="custom-badge-icon">Icon</Label>
                                                    <Select value={badgeIcon} onValueChange={setBadgeIcon}>
                                                        <SelectTrigger id="custom-badge-icon">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Award">Award (Ribbon)</SelectItem>
                                                            <SelectItem value="Crown">Crown</SelectItem>
                                                            <SelectItem value="Heart">Heart</SelectItem>
                                                            <SelectItem value="Code2">Code Bracket</SelectItem>
                                                            <SelectItem value="Compass">Compass (Navigation)</SelectItem>
                                                            <SelectItem value="Zap">Lightning Zap</SelectItem>
                                                            <SelectItem value="Users">Users (Team)</SelectItem>
                                                            <SelectItem value="CheckCircle">Checkmark Circle</SelectItem>
                                                            <SelectItem value="ShieldAlert">Shield Warning</SelectItem>
                                                            <SelectItem value="Shield">Shield</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="badge-title">Badge Title</Label>
                                                    <Input
                                                        id="badge-title"
                                                        placeholder="e.g. Expert Mentor"
                                                        value={badgeTitle}
                                                        onChange={(e) => setBadgeTitle(e.target.value)}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="badge-desc">Badge Description</Label>
                                                    <Textarea
                                                        id="badge-desc"
                                                        placeholder="Briefly explain what criteria is represented by this badge."
                                                        value={badgeDescription}
                                                        onChange={(e) => setBadgeDescription(e.target.value)}
                                                        className="h-20"
                                                    />
                                                </div>
                                            </div>
                                        </TabsContent>
                                    </Tabs>

                                    <div className="space-y-2">
                                        <Label htmlFor="badge-evidence">Note / Evidence (optional)</Label>
                                        <Textarea
                                            id="badge-evidence"
                                            placeholder="e.g. Awarded for mentoring 5 teams in Q1 2026."
                                            value={badgeEvidence}
                                            onChange={(e) => setBadgeEvidence(e.target.value)}
                                            className="h-20"
                                        />
                                    </div>
                                </CardContent>
                                <CardFooter className="pt-2">
                                    <Button
                                        className="w-full bg-indigo-650 hover:bg-indigo-700 text-white"
                                        disabled={submittingBadge}
                                        onClick={handleGrantBadge}
                                    >
                                        {submittingBadge ? 'Awarding...' : 'Grant Badge'}
                                    </Button>
                                </CardFooter>
                            </Card>
                        </div>

                        {/* RIGHT COLUMNS: USER MANUAL & SHOWCASE */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* USER MANUAL & WIKI */}
                            <Card className="border border-slate-200 dark:border-slate-800 shadow-md">
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-md">
                                        <BookOpen className="h-5 w-5 text-indigo-500" />
                                        Platform Trust & Reputation System Wiki
                                    </CardTitle>
                                    <CardDescription>
                                        A comprehensive operations guide to peer scoring, automated mathematical checks, and anti-cheating mechanisms.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4 text-sm max-h-[350px] overflow-y-auto pr-2">
                                    <div>
                                        <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">1. Multidimensional Reputation Metric Architecture</h4>
                                        <p className="text-muted-foreground text-xs leading-relaxed">
                                            Rather than calculating a singular aggregated score, user profiles expose a multidimensional grid of four metrics, evaluated out of 100:
                                        </p>
                                        <ul className="list-disc pl-5 mt-1 text-xs text-muted-foreground space-y-1">
                                            <li><strong>Verified Collaborator</strong>: Setup profile photo, bio, and at least 3 custom skills.</li>
                                            <li><strong>Trusted Teammate</strong>: 3+ reviews with cooperation ratings of 4.5+ stars (85%+ score).</li>
                                            <li><strong>Reliable Contributor</strong>: Completed at least 10 tasks on or before deadline + reliability rating {'>='}85%.</li>
                                            <li><strong>Verified Deliverer</strong>: Completed projects with activity-verified team activity level.</li>
                                        </ul>
                                    </div>

                                    <div>
                                        <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">2. Bayesian Mathematical Stabilization</h4>
                                        <p className="text-muted-foreground text-xs leading-relaxed">
                                            To protect against outlier volatility, all incoming raw feedback points undergo Bayesian shrinkage math. New users without sufficient history are automatically modeled with a 4.0 network mean prior, ensuring fairness and stability until statistically significant review volumes are reached.
                                        </p>
                                    </div>

                                    <div>
                                        <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">3. Automated Reputation Credentials</h4>
                                        <p className="text-muted-foreground text-xs leading-relaxed">
                                            The system engine programmatically awards immutable badges (e.g. Proven Professional, Project Master) upon verification of project delivery milestones and verified team activity, functioning as universally recognized credentials of user trustworthiness.
                                        </p>
                                    </div>

                                    <div>
                                        <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">4. Anti-Gaming Mechanisms</h4>
                                        <p className="text-muted-foreground text-xs leading-relaxed">
                                            Reciprocal loops are managed by **Collusion Graph Analysis**—repeated reviews between the same members decay review influence coefficients. Sybil validation checks omit ratings submitted by unverified accounts to protect platform integrity.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* BADGES DESIGN SHOWCASE */}
                            <Card className="border border-slate-200 dark:border-slate-800 shadow-md">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-md">Badges Showcase & Design Preview</CardTitle>
                                    <CardDescription>Visual design preview of standard automatic credentials and honorary admin badges.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {SHOWCASE_BADGES.map((b) => (
                                            <div
                                                key={b.type}
                                                className={`flex items-center gap-3 p-3 rounded-xl border bg-gradient-to-br ${b.bg} ${b.border}`}
                                            >
                                                {/* Badge SVG image — fixed 48×48 */}
                                                <div className="flex-shrink-0 h-12 w-12 flex items-center justify-center">
                                                    {BADGE_IMAGES[b.type] ? (
                                                        <img
                                                            src={BADGE_IMAGES[b.type]}
                                                            alt={b.title}
                                                            className="h-12 w-12 object-contain"
                                                            draggable={false}
                                                        />
                                                    ) : (
                                                        <div className={`h-12 w-12 rounded-lg border flex items-center justify-center ${b.color}`}>
                                                            {renderBadgeIcon(b.icon, "h-6 w-6")}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="space-y-0.5 flex-1 min-w-0">
                                                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                                                        <span className="truncate">{b.title}</span>
                                                        {b.type.startsWith('verified_') || b.type === 'trusted_teammate' || b.type === 'reliable_contributor' || b.type === 'project_finisher' || b.type === 'project_veteran' || b.type === 'project_master' || b.type === 'verified_deliverer' || b.type === 'outstanding_collaborator' || b.type === 'top_rated' || b.type === 'community_trusted' ? (
                                                            <span className="shrink-0 text-[8px] bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 px-1.5 py-0.5 rounded font-normal uppercase tracking-wider">Auto</span>
                                                        ) : (
                                                            <span className="shrink-0 text-[8px] bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 px-1.5 py-0.5 rounded font-normal uppercase tracking-wider">Admin</span>
                                                        )}
                                                    </h4>
                                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                                                        {b.desc}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* ══════════════════════════════════════════
                    MIGRATIONS TAB
                ══════════════════════════════════════════ */}
                <TabsContent value="migrations" className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold">System Schema Migrations</h2>
                            <p className="text-muted-foreground text-sm">Retroactively populate unique identifiers and privacy levels for Phase 6.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Control Card */}
                        <div className="lg:col-span-1 space-y-6">
                            <Card className="border border-slate-200 dark:border-slate-800 shadow-md">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <ShieldAlert className="h-5 w-5 text-indigo-500" />
                                        Migration Runner
                                    </CardTitle>
                                    <CardDescription>
                                        Inspect and update users and projects in Firestore to comply with current data schema constraints.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4 text-sm">
                                    <div className="space-y-2 p-3 bg-indigo-50/55 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl">
                                        <h4 className="font-semibold text-indigo-900 dark:text-indigo-450 flex items-center gap-2">
                                            <Info className="h-4 w-4" />
                                            Scope of Changes
                                        </h4>
                                        <ul className="list-disc pl-4 text-xs text-slate-650 dark:text-slate-400 space-y-1 mt-1">
                                            <li>Generates unique fallback usernames for users missing `username`.</li>
                                            <li>Populates `profileVisibility: 'public'` for users missing visibility settings.</li>
                                            <li>Generates unique URL-safe slugs for projects missing `slug`.</li>
                                            <li>Populates `projectVisibility: 'public'` for projects missing visibility settings.</li>
                                        </ul>
                                    </div>
                                    
                                    <div className="text-xs text-muted-foreground bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 p-3 rounded-xl">
                                        <p className="font-medium text-amber-800 dark:text-amber-400 flex items-center gap-1.5 mb-1">
                                            <AlertTriangle className="h-3.5 w-3.5" />
                                            Precautionary Warning
                                        </p>
                                        This operation involves write-intensive batched operations to Firestore. Do not close or refresh the window while the migration is active.
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button 
                                        className="w-full bg-indigo-650 hover:bg-indigo-750 text-white font-medium"
                                        onClick={handleRunMigration}
                                        disabled={migrationLoading}
                                    >
                                        {migrationLoading ? (
                                            <>
                                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                                Migrating Database...
                                            </>
                                        ) : (
                                            <>
                                                <Zap className="h-4 w-4 mr-2" />
                                                Run Schema Migration
                                            </>
                                        )}
                                    </Button>
                                </CardFooter>
                            </Card>
                        </div>

                        {/* Results / Status Card */}
                        <div className="lg:col-span-2 space-y-6">
                            <Card className="border border-slate-200 dark:border-slate-800 shadow-md">
                                <CardHeader>
                                    <CardTitle>Migration Summary</CardTitle>
                                    <CardDescription>
                                        Detailed breakdown of the most recent migration run in this session.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {migrationResult ? (
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
                                                    <span className="text-xs text-muted-foreground block mb-1">Users Checked</span>
                                                    <span className="text-2xl font-bold">{migrationResult.usersChecked}</span>
                                                </div>
                                                <div className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/20 dark:bg-indigo-950/10">
                                                    <span className="text-xs text-indigo-650 dark:text-indigo-400 block mb-1">Users Updated</span>
                                                    <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{migrationResult.usersUpdated}</span>
                                                </div>
                                                <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
                                                    <span className="text-xs text-muted-foreground block mb-1">Projects Checked</span>
                                                    <span className="text-2xl font-bold">{migrationResult.projectsChecked}</span>
                                                </div>
                                                <div className="p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/10">
                                                    <span className="text-xs text-emerald-650 dark:text-emerald-450 block mb-1">Projects Updated</span>
                                                    <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-450">{migrationResult.projectsUpdated}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/25 border border-green-200 dark:border-green-900/50 rounded-xl text-green-700 dark:text-green-400 text-xs">
                                                <CheckCircle className="h-4 w-4 shrink-0" />
                                                <span>
                                                    Migration finished successfully. All existing accounts and projects have valid usernames, slugs, and visibility keys.
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                            <ShieldAlert className="h-12 w-12 opacity-20 mb-3" />
                                            <p className="font-medium">No migration run history</p>
                                            <p className="text-xs text-center max-w-xs mt-1">
                                                Trigger a migration to inspect statistics and repair database fields.
                                            </p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
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

            {/* Screenshot Dialog */}
            <Dialog open={!!viewingScreenshot} onOpenChange={(open) => !open && setViewingScreenshot(null)}>
                <DialogContent className="max-w-4xl p-2 bg-zinc-950 border-white/10">
                    <DialogHeader className="p-2 flex-row justify-between items-center border-b border-white/5">
                        <DialogTitle className="text-white text-sm font-semibold">Screenshot Attachment</DialogTitle>
                    </DialogHeader>
                    {viewingScreenshot && (
                        <div className="w-full flex items-center justify-center p-1 rounded-lg overflow-hidden border border-white/5 bg-black">
                            <img 
                                src={viewingScreenshot} 
                                alt="Feedback Attachment" 
                                className="max-h-[70vh] w-auto object-contain rounded"
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    )
}
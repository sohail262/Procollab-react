import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    ClipboardList, ArrowLeft, Clock, Check, X, ExternalLink,
    AlertTriangle, Trash2, Eye, ChevronDown, ChevronUp,
    Search, Briefcase, UserCheck, Star, MessageSquare, TrendingUp,
    RefreshCw, ArrowRight
} from 'lucide-react'
import {
    doc,
    getDocs,
    collection,
    query,
    orderBy,
    deleteDoc,
    where,
    Timestamp,
} from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { cachedQuery } from '@/lib/queryUtils'
import { useToast } from '@/hooks/use-toast'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

// ── Types ────────────────────────────────────────────────────────────────────

type ApplicationStatus = 'applied' | 'viewed' | 'shortlisted' | 'interviewing' | 'accepted' | 'rejected' | 'pending'

interface StatusHistoryEntry {
    status: string
    timestamp: Date
    changedBy: string
}

interface Application {
    id: string
    projectId: string
    projectTitle: string
    position?: string
    status: ApplicationStatus
    appliedAt: Date
    statusHistory: StatusHistoryEntry[]
    coverLetter?: string
    customMessage?: string
}

// ── Status Configuration ─────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, {
    label: string
    color: string
    bgLight: string
    bgDark: string
    textLight: string
    textDark: string
    icon: React.ReactNode
    order: number
}> = {
    applied: {
        label: 'Applied', order: 0,
        color: 'blue',
        bgLight: 'bg-blue-100', bgDark: 'dark:bg-blue-900/30',
        textLight: 'text-blue-700', textDark: 'dark:text-blue-400',
        icon: <ClipboardList className="h-3 w-3 mr-1" />,
    },
    pending: {
        label: 'Applied', order: 0,
        color: 'blue',
        bgLight: 'bg-blue-100', bgDark: 'dark:bg-blue-900/30',
        textLight: 'text-blue-700', textDark: 'dark:text-blue-400',
        icon: <ClipboardList className="h-3 w-3 mr-1" />,
    },
    viewed: {
        label: 'Viewed', order: 1,
        color: 'violet',
        bgLight: 'bg-violet-100', bgDark: 'dark:bg-violet-900/30',
        textLight: 'text-violet-700', textDark: 'dark:text-violet-400',
        icon: <Eye className="h-3 w-3 mr-1" />,
    },
    shortlisted: {
        label: 'Shortlisted', order: 2,
        color: 'amber',
        bgLight: 'bg-amber-100', bgDark: 'dark:bg-amber-900/30',
        textLight: 'text-amber-700', textDark: 'dark:text-amber-400',
        icon: <Star className="h-3 w-3 mr-1" />,
    },
    interviewing: {
        label: 'Interviewing', order: 3,
        color: 'cyan',
        bgLight: 'bg-cyan-100', bgDark: 'dark:bg-cyan-900/30',
        textLight: 'text-cyan-700', textDark: 'dark:text-cyan-400',
        icon: <MessageSquare className="h-3 w-3 mr-1" />,
    },
    accepted: {
        label: 'Accepted', order: 4,
        color: 'green',
        bgLight: 'bg-green-100', bgDark: 'dark:bg-green-900/30',
        textLight: 'text-green-700', textDark: 'dark:text-green-400',
        icon: <Check className="h-3 w-3 mr-1" />,
    },
    rejected: {
        label: 'Rejected', order: 5,
        color: 'red',
        bgLight: 'bg-red-100', bgDark: 'dark:bg-red-900/30',
        textLight: 'text-red-700', textDark: 'dark:text-red-400',
        icon: <X className="h-3 w-3 mr-1" />,
    },
}

// ── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.applied
    return (
        <Badge className={`${cfg.bgLight} ${cfg.bgDark} ${cfg.textLight} ${cfg.textDark} border-none inline-flex items-center`}>
            {cfg.icon}
            {cfg.label}
        </Badge>
    )
}

// ── Application Timeline ──────────────────────────────────────────────────────

function ApplicationTimeline({ history }: { history: StatusHistoryEntry[] }) {
    if (!history || history.length === 0) return null

    const ordered = [...history].sort(
        (a, b) => (a.timestamp?.getTime?.() ?? 0) - (b.timestamp?.getTime?.() ?? 0)
    )

    return (
        <div className="mt-3 pt-3 border-t dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                Application Timeline
            </p>
            <ol className="relative border-l border-gray-200 dark:border-gray-700 ml-2 space-y-3">
                {ordered.map((entry, i) => {
                    const cfg = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.applied
                    const isLast = i === ordered.length - 1
                    return (
                        <li key={i} className="ml-4">
                            <span className={`absolute -left-1.5 flex h-3 w-3 items-center justify-center rounded-full ring-2 ring-white dark:ring-gray-900 ${
                                isLast ? `${cfg.bgLight} ${cfg.bgDark}` : 'bg-gray-200 dark:bg-gray-600'
                            }`} />
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs font-semibold ${isLast ? `${cfg.textLight} ${cfg.textDark}` : 'text-gray-600 dark:text-gray-400'}`}>
                                    {cfg.label}
                                </span>
                                <span className="text-[10px] text-gray-400">
                                    {entry.timestamp
                                        ? (typeof entry.timestamp === 'object' && 'toDate' in entry.timestamp
                                            ? (entry.timestamp as unknown as Timestamp).toDate()
                                            : entry.timestamp
                                        ).toLocaleDateString('en-US', {
                                            month: 'short', day: 'numeric', year: 'numeric',
                                            hour: '2-digit', minute: '2-digit'
                                        })
                                        : ''}
                                </span>
                            </div>
                        </li>
                    )
                })}
            </ol>
        </div>
    )
}

// ── Rejection Recovery Panel ──────────────────────────────────────────────────

function RejectionRecoveryPanel({ projectTitle }: { projectTitle: string }) {
    const navigate = useNavigate()
    return (
        <div className="mt-3 p-3 rounded-lg bg-gradient-to-r from-orange-50 to-rose-50 dark:from-orange-950/20 dark:to-rose-950/20 border border-orange-200 dark:border-orange-800">
            <div className="flex items-start gap-2.5">
                <TrendingUp className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-orange-800 dark:text-orange-300">
                        Don't give up — every rejection is a step forward
                    </p>
                    <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
                        Your skills are valuable. Explore similar projects or strengthen your profile.
                    </p>
                    <div className="flex gap-2 mt-2">
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] px-2 border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-900/20"
                            onClick={() => navigate('/projects')}
                        >
                            <Search className="h-2.5 w-2.5 mr-1" />
                            Browse Projects
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] px-2 border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-900/20"
                            onClick={() => navigate('/profile')}
                        >
                            <UserCheck className="h-2.5 w-2.5 mr-1" />
                            Improve Profile
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, count, icon, colorClass }: {
    label: string
    count: number
    icon: React.ReactNode
    colorClass: string
}) {
    return (
        <Card>
            <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">{label}</p>
                        <p className={`text-xl sm:text-2xl font-bold ${colorClass}`}>{count}</p>
                    </div>
                    <div className={`${colorClass} opacity-40`}>{icon}</div>
                </div>
            </CardContent>
        </Card>
    )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function Applications() {
    const navigate = useNavigate()
    const { toast } = useToast()
    const [applications, setApplications] = useState<Application[]>([])
    const [loading, setLoading] = useState(true)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [filterStatus, setFilterStatus] = useState<string>('all')

    useEffect(() => {
        loadApplications()
    }, [])

    const SS_APPS_TTL = 3 * 60_000 // 3 minutes

    const loadApplications = async (skipCache = false) => {
        if (!auth.currentUser) {
            setLoading(false)
            return
        }

        const uid = auth.currentUser.uid
        const ssKey = `apps_${uid}`

        // ── FIX: Try sessionStorage for instant revisit ──
        if (!skipCache) {
            try {
                const raw = sessionStorage.getItem(ssKey)
                if (raw) {
                    const { apps, ts } = JSON.parse(raw)
                    if (Date.now() - ts < SS_APPS_TTL && Array.isArray(apps) && apps.length > 0) {
                        setApplications(apps)
                        setLoading(false)
                        return
                    }
                }
            } catch { /* ignore */ }
        }

        try {
            // ── FIX: Route through cachedQuery (shared key with dashboardService) ──
            const snapshot = await cachedQuery(
                query(
                    collection(db, 'users', uid, 'applications'),
                    orderBy('appliedAt', 'desc')
                ),
                { ttl: 180_000, cacheKey: `my-applications-${uid}` }
            )

            const appsData: Application[] = []

            for (const docSnap of snapshot.docs) {
                const data = docSnap.data()
                const rawHistory: StatusHistoryEntry[] = (data.statusHistory || []).map((h: any) => ({
                    status: h.status,
                    changedBy: h.changedBy || '',
                    timestamp: h.timestamp?.toDate?.() ?? (h.timestamp instanceof Date ? h.timestamp : new Date()),
                }))

                const history: StatusHistoryEntry[] = rawHistory.length > 0
                    ? rawHistory
                    : [{
                        status: data.status || 'applied',
                        timestamp: data.appliedAt?.toDate?.() ?? new Date(),
                        changedBy: uid,
                    }]

                appsData.push({
                    id: docSnap.id,
                    projectId: data.projectId,
                    projectTitle: data.projectTitle || 'Unknown Project',
                    position: data.position,
                    status: (data.status || 'applied') as ApplicationStatus,
                    appliedAt: data.appliedAt?.toDate?.() ?? new Date(),
                    statusHistory: history,
                    coverLetter: data.coverLetter,
                    customMessage: data.customMessage,
                })
            }

            setApplications(appsData)

            // Persist to sessionStorage
            try {
                sessionStorage.setItem(ssKey, JSON.stringify({ apps: appsData, ts: Date.now() }))
            } catch { /* quota */ }
        } catch (error) {
            console.error('Error loading applications:', error)
            toast({
                title: "Error",
                description: "Failed to load applications",
                variant: "destructive"
            })
        } finally {
            setLoading(false)
        }
    }

    const handleWithdraw = async (application: Application) => {
        if (!auth.currentUser) return

        try {
            await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'applications', application.id))

            try {
                const projectAppsRef = collection(db, 'projects', application.projectId, 'applications')
                const projectAppsQuery = query(projectAppsRef, where('userId', '==', auth.currentUser.uid))
                const projectAppsSnap = await getDocs(projectAppsQuery)
                for (const appDoc of projectAppsSnap.docs) {
                    await deleteDoc(doc(db, 'projects', application.projectId, 'applications', appDoc.id))
                }
            } catch (err) {
                console.error('Error deleting from project applications:', err)
            }

            // Bust caches so next visit doesn't show the withdrawn application
            try { sessionStorage.removeItem(`apps_${auth.currentUser.uid}`) } catch { /* ignore */ }
            setApplications(prev => prev.filter(app => app.id !== application.id))
            toast({ title: "Application withdrawn", description: "Your application has been withdrawn successfully" })
        } catch (error) {
            console.error('Error withdrawing application:', error)
            toast({ title: "Error", description: "Failed to withdraw application", variant: "destructive" })
        }
    }

    // ── Counts ─────────────────────────────────────────────────────────────────
    const counts = {
        all: applications.length,
        applied: applications.filter(a => a.status === 'applied' || a.status === 'pending').length,
        viewed: applications.filter(a => a.status === 'viewed').length,
        shortlisted: applications.filter(a => a.status === 'shortlisted').length,
        interviewing: applications.filter(a => a.status === 'interviewing').length,
        accepted: applications.filter(a => a.status === 'accepted').length,
        rejected: applications.filter(a => a.status === 'rejected').length,
    }

    const filteredApps = filterStatus === 'all'
        ? applications
        : applications.filter(a => {
            if (filterStatus === 'applied') return a.status === 'applied' || a.status === 'pending'
            return a.status === filterStatus
        })

    // ── Filter tabs ────────────────────────────────────────────────────────────
    const filterTabs: { key: string; label: string; count: number }[] = [
        { key: 'all', label: 'All', count: counts.all },
        { key: 'applied', label: 'Applied', count: counts.applied },
        { key: 'viewed', label: 'Viewed', count: counts.viewed },
        { key: 'shortlisted', label: 'Shortlisted', count: counts.shortlisted },
        { key: 'interviewing', label: 'Interviewing', count: counts.interviewing },
        { key: 'accepted', label: 'Accepted', count: counts.accepted },
        { key: 'rejected', label: 'Rejected', count: counts.rejected },
    ]

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate('/dashboard')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl sm:text-2xl font-bold">My Applications</h1>
                        <p className="text-xs sm:text-sm text-muted-foreground">Track and manage your project applications</p>
                    </div>
                    <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={loadApplications}>
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Refresh</span>
                    </Button>
                </div>

                {/* Stats grid — 3 cols */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    <StatCard label="Applied" count={counts.applied} colorClass="text-blue-600" icon={<ClipboardList className="h-6 w-6" />} />
                    <StatCard label="Viewed" count={counts.viewed} colorClass="text-violet-600" icon={<Eye className="h-6 w-6" />} />
                    <StatCard label="Shortlisted" count={counts.shortlisted} colorClass="text-amber-600" icon={<Star className="h-6 w-6" />} />
                    <StatCard label="Interviewing" count={counts.interviewing} colorClass="text-cyan-600" icon={<MessageSquare className="h-6 w-6" />} />
                    <StatCard label="Accepted" count={counts.accepted} colorClass="text-green-600" icon={<Check className="h-6 w-6" />} />
                    <StatCard label="Rejected" count={counts.rejected} colorClass="text-red-600" icon={<X className="h-6 w-6" />} />
                </div>

                {/* Filter tabs */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                    {filterTabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setFilterStatus(tab.key)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
                                filterStatus === tab.key
                                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                    : 'bg-background border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground'
                            }`}
                        >
                            {tab.label}
                            {tab.count > 0 && (
                                <span className={`rounded-full text-[10px] px-1.5 py-0.5 ${
                                    filterStatus === tab.key
                                        ? 'bg-primary-foreground/20 text-primary-foreground'
                                        : 'bg-muted text-muted-foreground'
                                }`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Applications list */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base sm:text-lg">
                            {filterStatus === 'all' ? 'All Applications' : `${STATUS_CONFIG[filterStatus]?.label ?? filterStatus} Applications`}
                        </CardTitle>
                        <CardDescription className="text-xs sm:text-sm">
                            {filteredApps.length} application{filteredApps.length !== 1 ? 's' : ''}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="text-center py-12">
                                <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full mb-4" />
                                <p className="text-muted-foreground text-sm">Loading applications...</p>
                            </div>
                        ) : filteredApps.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p className="text-base font-medium">
                                    {filterStatus === 'all' ? 'No applications yet' : `No ${STATUS_CONFIG[filterStatus]?.label ?? filterStatus} applications`}
                                </p>
                                <p className="text-sm mb-4">
                                    {filterStatus === 'all'
                                        ? "You haven't applied to any projects yet"
                                        : 'Try a different filter above'}
                                </p>
                                {filterStatus === 'all' && (
                                    <Button size="sm" onClick={() => navigate('/projects')}>
                                        Browse Projects
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {filteredApps.map((application) => {
                                    const isExpanded = expandedId === application.id
                                    const canWithdraw = application.status === 'applied' || application.status === 'pending' || application.status === 'viewed'

                                    return (
                                        <div
                                            key={application.id}
                                            className="p-3 sm:p-4 border rounded-lg hover:bg-accent/20 transition-colors"
                                        >
                                            {/* Top row: title + status badge */}
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <h4 className="font-semibold text-sm truncate flex-1 min-w-0">{application.projectTitle}</h4>
                                                <StatusBadge status={application.status} />
                                            </div>

                                            {/* Position + date */}
                                            <div className="flex flex-wrap gap-x-3 mb-3">
                                                {application.position && (
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <Briefcase className="h-3 w-3" />
                                                        {application.position}
                                                    </p>
                                                )}
                                                <p className="text-xs text-muted-foreground">
                                                    Applied {application.appliedAt.toLocaleDateString()}
                                                </p>
                                            </div>

                                            {/* Actions row */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 text-xs px-2"
                                                    onClick={() => navigate(`/project/${application.projectId}`)}
                                                >
                                                    <Eye className="h-3 w-3 mr-1" />
                                                    View Project
                                                </Button>

                                                {/* Expand timeline toggle */}
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 text-xs px-2 text-muted-foreground"
                                                    onClick={() => setExpandedId(isExpanded ? null : application.id)}
                                                >
                                                    {isExpanded ? (
                                                        <><ChevronUp className="h-3 w-3 mr-1" />Hide Timeline</>
                                                    ) : (
                                                        <><ChevronDown className="h-3 w-3 mr-1" />Timeline</>
                                                    )}
                                                </Button>

                                                {canWithdraw && (
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-7 text-xs px-2 text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
                                                            >
                                                                <Trash2 className="h-3 w-3 mr-1" />
                                                                Withdraw
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Withdraw Application?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Are you sure you want to withdraw your application to "{application.projectTitle}"? This action cannot be undone.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction
                                                                    onClick={() => handleWithdraw(application)}
                                                                    className="bg-red-600 hover:bg-red-700"
                                                                >
                                                                    Withdraw
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                )}

                                                {application.status === 'accepted' && (
                                                    <Button
                                                        size="sm"
                                                        className="h-7 text-xs px-2"
                                                        onClick={() => navigate(`/project/${application.projectId}/dashboard`)}
                                                    >
                                                        <ExternalLink className="h-3 w-3 mr-1" />
                                                        Open Dashboard
                                                    </Button>
                                                )}
                                            </div>

                                            {/* Expanded: Timeline + Cover Letter snippet */}
                                            {isExpanded && (
                                                <div className="mt-1">
                                                    <ApplicationTimeline history={application.statusHistory} />

                                                    {application.coverLetter && (
                                                        <div className="mt-3 pt-3 border-t dark:border-gray-700">
                                                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Cover Letter</p>
                                                            <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-3">
                                                                {application.coverLetter}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Rejection recovery panel */}
                                            {application.status === 'rejected' && (
                                                <RejectionRecoveryPanel projectTitle={application.projectTitle} />
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Tips section — show when there are pending/applied apps */}
                {counts.applied > 0 && (
                    <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
                        <CardContent className="p-3 sm:p-5">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-sm text-blue-900 dark:text-blue-400">
                                        {counts.applied} Pending Application{counts.applied > 1 ? 's' : ''}
                                    </h4>
                                    <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300 mt-1">
                                        Project owners will review and notify you. Applications pending for 5+ days will trigger a follow-up reminder.
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="shrink-0 h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-400"
                                    onClick={() => navigate('/projects')}
                                >
                                    Browse More
                                    <ArrowRight className="h-3 w-3 ml-1" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </DashboardLayout>
    )
}

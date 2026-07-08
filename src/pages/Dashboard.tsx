import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
    FolderKanban,
    Send,
    Bell,
    Bookmark,
    Plus,
    User,
    Eye,
    Clock,
    TrendingUp,
    Sparkles,
    Users,
    Calendar,
    ArrowRight,
    CheckCircle2,
    XCircle,
    AlertCircle,
    AlertTriangle,
    RefreshCw,
    UserPlus,
    Check,
} from 'lucide-react';
import {
    loadDashboardStats,
    loadRecommendedProjects,
    loadMyProjects,
    loadMyApplications,
    type DashboardStats,
    type Activity,
    type Project,
    type Application,
} from '@/services/dashboardService'
import { collection, query, orderBy, limit, onSnapshot, doc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { cachedGetDoc, cachedQuery } from '@/lib/queryUtils'
import { OnboardingChecklist } from '@/components/dashboard/OnboardingChecklist'
import { PendingInvitesBanner } from '@/components/dashboard/PendingInvitesBanner'
import { motion } from 'framer-motion'

export function Dashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [stats, setStats] = useState<DashboardStats>({
        myProjects: 0,
        applications: 0,
        notifications: 0,
        savedProjects: 0,
    });
    const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
    const [recommendedProjects, setRecommendedProjects] = useState<Project[]>([]);
    const [myProjects, setMyProjects] = useState<Project[]>([]);
    const [applications, setApplications] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [profileData, setProfileData] = useState<any>(null);
    const [connectionsCount, setConnectionsCount] = useState<number>(0);
    const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);

    // Memoized data loading function with reduced initial load
    const loadData = useCallback(async () => {
        if (!user) return;

        try {
            setError(null);

            // ── FIX: Route all raw reads through cachedGetDoc / cachedQuery ──
            // Try sessionStorage first for instant revisit of profile/conn data
            let discipline = ''
            const ssProfKey = `dash_profile_${user.uid}`
            let connCountFromCache = -1

            try {
                const raw = sessionStorage.getItem(ssProfKey)
                if (raw) {
                    const { pData, connCount, ts } = JSON.parse(raw)
                    if (Date.now() - ts < 5 * 60_000) {
                        setProfileData(pData)
                        discipline = pData.discipline || ''
                        setConnectionsCount(connCount)
                        connCountFromCache = connCount
                    }
                }
            } catch { /* ignore */ }

            // Only hit Firestore if sessionStorage miss
            if (connCountFromCache === -1) {
                const [userDoc, friendsSnap] = await Promise.all([
                    cachedGetDoc(doc(db, 'users', user.uid), { ttl: 300_000 }),
                    cachedQuery(
                        query(collection(db, 'users', user.uid, 'friends')),
                        { ttl: 120_000, cacheKey: `dash-friends-${user.uid}` }
                    )
                ])

                if (userDoc.exists()) {
                    const pData = userDoc.data()
                    setProfileData(pData)
                    discipline = pData.discipline || ''
                }

                const connCount = friendsSnap.size
                setConnectionsCount(connCount)
                connCountFromCache = connCount

                // Persist for next visit
                try {
                    sessionStorage.setItem(ssProfKey, JSON.stringify({
                        pData: userDoc.exists() ? userDoc.data() : null,
                        connCount,
                        ts: Date.now()
                    }))
                } catch { /* quota */ }
            }

            // Load stats (uses cachedQuery internally in dashboardService)
            const statsData = await loadDashboardStats(user.uid);
            setStats(statsData);

            // Fetch suggested users if connections count is 0
            if (connCountFromCache === 0) {
                let uQuery = query(collection(db, 'users'), limit(15));
                if (discipline) {
                    uQuery = query(collection(db, 'users'), where('discipline', '==', discipline), limit(15));
                }
                const uSnap = await cachedQuery(uQuery, {
                    ttl: 300_000,
                    cacheKey: `dash-suggested-${user.uid}-${discipline}`
                })
                const list: any[] = [];
                uSnap.forEach(d => {
                    const dData = d.data();
                    if (d.id !== user.uid && dData.displayName) {
                        list.push({ id: d.id, ...dData });
                    }
                });
                setSuggestedUsers(list.slice(0, 3));
            }

            // Load non-critical data in background (small delay for perceived perf)
            // NOTE: loadRecentActivity is REMOVED — the onSnapshot listener already
            // derives recentActivity from the notifications stream (no double-fetch).
            setTimeout(async () => {
                const [recommendedData, projectsData, appsData] = await Promise.allSettled([
                    loadRecommendedProjects(user.uid),
                    loadMyProjects(user.uid),
                    loadMyApplications(user.uid),
                ]);

                setRecommendedProjects(recommendedData.status === 'fulfilled' ? recommendedData.value : []);
                setMyProjects(projectsData.status === 'fulfilled' ? projectsData.value.slice(0, 3) : []);
                setApplications(appsData.status === 'fulfilled' ? appsData.value.slice(0, 3) : []);

                [recommendedData, projectsData, appsData].forEach((result, index) => {
                    if (result.status === 'rejected') {
                        console.error(`Dashboard data load failed for section ${index}:`, result.reason);
                    }
                });
            }, 100);

        } catch (error) {
            console.error('Error loading dashboard data:', error);
            setError('Failed to load dashboard data. Please try refreshing.');
        }
    }, [user]);

    // Redirect if not authenticated
    useEffect(() => {
        if (!user) {
            navigate('/login?redirect=/dashboard');
            return;
        }
    }, [user, navigate]);

    // Load data on mount and when user changes
    useEffect(() => {
        let mounted = true;

        const loadInitialData = async () => {
            setLoading(true);
            await loadData();
            if (mounted) {
                setLoading(false);
            }
        };

        if (user) {
            loadInitialData();
        }

        return () => {
            mounted = false;
        };
    }, [user, loadData]);

    // ✅ P1 FIX: Single merged notification listener.
    // Previously two separate onSnapshot listeners both opened against
    // users/{uid}/notifications:
    //   • subscribeToNotifications  (where read==false, limit 10)
    //   • subscribeToRecentActivity (all, limit 10)
    // This was 2 persistent Firestore connections for the same collection.
    // Now one listener derives both unread count AND recent activity feed.
    // Read reduction: eliminates 1 persistent listener = ~50% of real-time read traffic.
    useEffect(() => {
        if (!user) return

        const q = query(
            collection(db, 'users', user.uid, 'notifications'),
            orderBy('timestamp', 'desc'),
            limit(20) // enough for both: badge count + 6-item activity feed
        )

        const unsub = onSnapshot(q, (snap) => {
            const allNotifications = snap.docs.map(d => ({
                id: d.id,
                ...d.data()
            })) as any[]

            // Derive unread badge count
            const unreadCount = allNotifications.filter(n => !n.read).length
            setStats(prev => ({ ...prev, notifications: unreadCount }))

            // Derive recent activity feed (newest 6)
            const activities: Activity[] = allNotifications.slice(0, 6).map(n => ({
                id: n.id,
                type: n.type || 'project_update',
                message: n.message,
                timestamp: n.timestamp?.toDate?.() ?? new Date(),
                projectId: n.projectId,
                projectTitle: n.projectTitle,
            }))
            setRecentActivity(activities)
        })

        return () => unsub()
    }, [user])

    const formatTimeAgo = useCallback((date: Date): string => {
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
        return date.toLocaleDateString();
    }, []);

    const getStatusBadge = useCallback((status: string) => {
        const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
            active: { variant: 'default', label: 'Active' },
            recruiting: { variant: 'secondary', label: 'Recruiting' },
            completed: { variant: 'outline', label: 'Completed' },
            'on-hold': { variant: 'destructive', label: 'On Hold' },
            pending: { variant: 'secondary', label: 'Pending' },
            accepted: { variant: 'default', label: 'Accepted' },
            rejected: { variant: 'destructive', label: 'Rejected' },
        };
        const cfg = variants[status] || variants.active;
        return <Badge variant={cfg.variant} className="text-xs">{cfg.label}</Badge>;
    }, []);

    if (!user) return null;

    const isNewUser = !loading && stats.myProjects === 0 && stats.applications === 0 && connectionsCount === 0;

    return (
        <ErrorBoundary>
            <DashboardLayout>
                {/* Header */}
                <motion.div
                    className="mb-6 sm:mb-8 flex justify-between items-center"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                            Welcome back, {user.displayName?.split(' ')[0] || 'there'}!
                        </h1>
                        <p className="text-muted-foreground mt-1 text-sm sm:text-base font-body">
                            {isNewUser ? "Let's launch your first project or collaboration" : "Here's what's happening with your projects today"}
                        </p>
                    </div>
                </motion.div>

                {/* Pending Invitations (In-App) */}
                <PendingInvitesBanner />

                {/* Onboarding Checklist */}
                {profileData && (
                    <OnboardingChecklist
                        userId={user.uid}
                        profileData={profileData}
                        stats={stats}
                        connectionsCount={connectionsCount}
                        onDismiss={() => {
                            setProfileData((prev: any) => ({
                                ...prev,
                                onboardingChecklist: {
                                    ...prev?.onboardingChecklist,
                                    checklistDismissed: true
                                }
                            }));
                        }}
                    />
                )}

                {/* Error Alert */}
                {error && (
                    <div className="mb-6 p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex flex-wrap items-start gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                        <span className="text-red-700 dark:text-red-300 text-sm flex-1">{error}</span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setError(null)}
                            className="shrink-0"
                        >
                            Dismiss
                        </Button>
                    </div>
                )}

                {/* Main Dashboard Layout Selection */}
                {isNewUser ? (
                    <div className="space-y-6">
                        {/* Welcome Banner */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-card border border-border/50 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden"
                        >
                            <div>
                                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                    <Sparkles className="h-5 w-5 text-muted-foreground" />
                                    Get Started in Minutes
                                </h3>
                                <p className="text-muted-foreground text-sm mt-1 max-w-xl">
                                    Create a project brief in seconds or apply to browse matching ideas. No empty stats, just pure building.
                                </p>
                            </div>
                            <div className="flex gap-3 shrink-0 w-full md:w-auto">
                                <Button className="flex-1 md:flex-none justify-center gap-2" onClick={() => navigate('/create-project')}>
                                    <Plus className="h-4 w-4" /> Create Project
                                </Button>
                                <Button variant="outline" className="flex-1 md:flex-none justify-center gap-2" onClick={() => navigate('/projects')}>
                                    Browse Projects
                                </Button>
                            </div>
                        </motion.div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Left Column — Suggested Projects and Collaborators */}
                            <div className="lg:col-span-2 space-y-6">
                                {/* Suggested Projects */}
                                <Card className="shadow-sm">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                                            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                                            Suggested Projects
                                        </CardTitle>
                                        <CardDescription className="text-xs sm:text-sm">Projects looking for your skills right now</CardDescription>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        {recommendedProjects.length === 0 ? (
                                            <p className="text-center py-6 text-muted-foreground text-sm">No suggested projects found yet. Finish your profile to match skills.</p>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {recommendedProjects.slice(0, 4).map((project) => (
                                                    <div 
                                                        key={project.id} 
                                                        className="p-4 rounded-xl border border-white/5 bg-white/3 hover:border-primary/30 hover:bg-primary/5 transition-all duration-200 cursor-pointer flex flex-col justify-between"
                                                        onClick={() => navigate(`/project/${project.id}`)}
                                                    >
                                                        <div>
                                                            <h4 className="font-bold text-sm text-white line-clamp-1 mb-1">{project.title}</h4>
                                                            <p className="text-xs text-white/50 mb-2 font-medium">{project.primaryDiscipline}</p>
                                                            <p className="text-xs text-white/60 line-clamp-3 mb-3">{project.summary || project.description}</p>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1 mt-auto pt-2 border-t border-white/5">
                                                            {project.tags?.slice(0, 2).map((tag, i) => (
                                                                <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0 border-white/10 text-white/65">{tag}</Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Suggested Collaborators */}
                                <Card className="shadow-sm border-white/5 bg-white/1">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-white">
                                            <Users className="h-4 w-4 sm:h-5 sm:w-5 text-white/50" />
                                            Suggested Collaborators
                                        </CardTitle>
                                        <CardDescription className="text-xs sm:text-sm text-white/45">People with matching skills and disciplines</CardDescription>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        {suggestedUsers.length === 0 ? (
                                            <p className="text-center py-6 text-white/50 text-sm">No suggested collaborators found.</p>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                {suggestedUsers.map((u) => (
                                                    <div 
                                                        key={u.id}
                                                        className="p-4 rounded-xl border border-white/5 bg-white/3 hover:border-primary/30 hover:bg-primary/5 transition-all duration-200 cursor-pointer flex flex-col items-center text-center"
                                                        onClick={() => navigate(`/profile/${u.id}`)}
                                                    >
                                                        <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-3 overflow-hidden">
                                                            {u.photoURL ? (
                                                                <img src={u.photoURL} alt={u.displayName} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <User className="h-6 w-6 text-white/40" />
                                                            )}
                                                        </div>
                                                        <h4 className="font-bold text-sm text-white line-clamp-1">{u.displayName}</h4>
                                                        <p className="text-[10px] text-white/50 font-medium mt-0.5">{u.role || u.discipline || 'Collaborator'}</p>
                                                        <div className="flex flex-wrap gap-1 justify-center mt-3">
                                                            {u.skills?.slice(0, 2).map((skill: string, i: number) => (
                                                                <Badge key={i} variant="outline" className="text-[9px] px-1 border-white/10 text-white/65">{skill}</Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Right Column — Suggested Actions */}
                            <div className="space-y-6">
                                {/* Suggested Next Actions */}
                                <Card className="shadow-sm border-slate-800 bg-slate-900/10">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                                            <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                                            Next Actions
                                        </CardTitle>
                                        <CardDescription className="text-xs sm:text-sm">Guided steps to get started</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-3 pt-0">
                                        <div 
                                            className="p-3 rounded-lg border border-white/5 bg-white/3 hover:border-primary/30 hover:bg-primary/5 transition-all duration-200 cursor-pointer flex justify-between items-center"
                                            onClick={() => navigate(`/profile/${user.uid}`)}
                                        >
                                            <div className="min-w-0">
                                                <h5 className="font-bold text-xs text-white">Complete your profile</h5>
                                                <p className="text-[10px] text-white/50 mt-0.5">Let others find you easily</p>
                                            </div>
                                            <ArrowRight className="h-3.5 w-3.5 text-white/40" />
                                        </div>
                                        <div 
                                            className="p-3 rounded-lg border border-white/5 bg-white/3 hover:border-primary/30 hover:bg-primary/5 transition-all duration-200 cursor-pointer flex justify-between items-center"
                                            onClick={() => navigate('/discover')}
                                        >
                                            <div className="min-w-0">
                                                <h5 className="font-bold text-xs text-white">Find collaborators</h5>
                                                <p className="text-[10px] text-white/50 mt-0.5">Browse active users on Discover</p>
                                            </div>
                                            <ArrowRight className="h-3.5 w-3.5 text-white/40" />
                                        </div>
                                        <div 
                                            className="p-3 rounded-lg border border-white/5 bg-white/3 hover:border-primary/30 hover:bg-primary/5 transition-all duration-200 cursor-pointer flex justify-between items-center"
                                            onClick={() => navigate('/create-project')}
                                        >
                                            <div className="min-w-0">
                                                <h5 className="font-bold text-xs text-white">Post a project</h5>
                                                <p className="text-[10px] text-white/50 mt-0.5">Start building your team today</p>
                                            </div>
                                            <ArrowRight className="h-3.5 w-3.5 text-white/40" />
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Quick Actions */}
                                <Card className="shadow-sm">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                                            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                                            Quick Actions
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button className="w-full justify-start gap-2 text-xs" onClick={() => navigate('/create-project')}>
                                                <Plus className="h-3.5 w-3.5 shrink-0" />
                                                <span className="truncate">New Project</span>
                                            </Button>
                                            <Button variant="outline" className="w-full justify-start gap-2 text-xs" onClick={() => navigate('/projects')}>
                                                <Eye className="h-3.5 w-3.5 shrink-0" />
                                                <span className="truncate">Browse</span>
                                            </Button>
                                            <Button variant="outline" className="w-full justify-start gap-2 text-xs" onClick={() => navigate(`/profile/${user.uid}`)}>
                                                <User className="h-3.5 w-3.5 shrink-0" />
                                                <span className="truncate">Edit Profile</span>
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="w-full justify-start gap-2 text-xs"
                                                onClick={() => navigate('/test/profile-redesign')}
                                            >
                                                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                                                <span className="truncate">New Profile</span>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Stats Grid - 2x2 on mobile, 4 cols on desktop */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
                            <Card className="glass-card border-primary/25 hover:border-primary/50 transition-all duration-300 cursor-pointer" onClick={() => navigate('/dashboard/projects')}>
                                <CardContent className="p-4 sm:p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs sm:text-sm font-medium text-white/50">My Projects</p>
                                            <h3 className="text-2xl sm:text-3xl font-bold text-white mt-1 sm:mt-2">{loading ? '...' : stats.myProjects}</h3>
                                        </div>
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                                            <FolderKanban className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="glass-card border-accent/25 hover:border-accent/50 transition-all duration-300 cursor-pointer" onClick={() => navigate('/dashboard/applications')}>
                                <CardContent className="p-4 sm:p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs sm:text-sm font-medium text-white/50">Applications</p>
                                            <h3 className="text-2xl sm:text-3xl font-bold text-white mt-1 sm:mt-2">{loading ? '...' : stats.applications}</h3>
                                        </div>
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-accent/10 rounded-lg flex items-center justify-center shrink-0">
                                            <Send className="h-5 w-5 sm:h-6 sm:w-6 text-accent" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="glass-card border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-300 cursor-pointer" onClick={() => navigate('/dashboard/notifications')}>
                                <CardContent className="p-4 sm:p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs sm:text-sm font-medium text-white/50">Notifications</p>
                                            <h3 className="text-2xl sm:text-3xl font-bold text-white mt-1 sm:mt-2">{loading ? '...' : stats.notifications}</h3>
                                        </div>
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center shrink-0">
                                            <Bell className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-400" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="glass-card border-primary/25 hover:border-primary/50 transition-all duration-300 cursor-pointer" onClick={() => navigate('/dashboard/saved')}>
                                <CardContent className="p-4 sm:p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs sm:text-sm font-medium text-white/50">Saved Projects</p>
                                            <h3 className="text-2xl sm:text-3xl font-bold text-white mt-1 sm:mt-2">{loading ? '...' : stats.savedProjects}</h3>
                                        </div>
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                                            <Bookmark className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Main Content Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                            {/* Right Column — shown first on mobile so Quick Actions is accessible */}
                            <div className="space-y-4 sm:space-y-6 lg:order-last">
                                {/* Quick Actions */}
                                <Card className="shadow-sm hover:shadow-md transition-shadow">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                                            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                                            Quick Actions
                                        </CardTitle>
                                        <CardDescription className="text-xs sm:text-sm">Get started with your projects</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-2 pt-0">
                                        {/* On mobile: 2-col grid for actions */}
                                        <div className="grid grid-cols-2 sm:grid-cols-1 gap-2">
                                            <Button className="w-full justify-start gap-2 text-sm" onClick={() => navigate('/create-project')}>
                                                <Plus className="h-4 w-4 shrink-0" />
                                                <span className="truncate">New Project</span>
                                            </Button>
                                            <Button variant="outline" className="w-full justify-start gap-2 text-sm" onClick={() => navigate('/projects')}>
                                                <Eye className="h-4 w-4 shrink-0" />
                                                <span className="truncate">Browse</span>
                                            </Button>
                                            <Button variant="outline" className="w-full justify-start gap-2 text-sm" onClick={() => navigate(`/profile/${user.uid}`)}>
                                                <User className="h-4 w-4 shrink-0" />
                                                <span className="truncate">Edit Profile</span>
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="w-full justify-start gap-2 text-sm"
                                                onClick={() => navigate('/test/profile-redesign')}
                                            >
                                                <Sparkles className="h-4 w-4 shrink-0" />
                                                <span className="truncate">New Profile</span>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Recommended Projects */}
                                <Card className="shadow-sm hover:shadow-md transition-shadow">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                                            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                                            Recommended
                                        </CardTitle>
                                        <CardDescription className="text-xs sm:text-sm">Projects matching your skills</CardDescription>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        {loading ? (
                                            <div className="space-y-3">
                                                {[1, 2, 3].map((i) => (
                                                    <div key={i} className="animate-pulse">
                                                        <div className="h-4 bg-white/10 rounded w-3/4 mb-2" />
                                                        <div className="h-3 bg-white/10 rounded w-1/2 mb-2" />
                                                        <div className="h-3 bg-white/10 rounded w-full" />
                                                    </div>
                                                ))}
                                            </div>
                                        ) : recommendedProjects.length === 0 ? (
                                            <p className="text-center py-4 text-white/50 text-xs sm:text-sm">Complete your profile to get personalized suggestions!</p>
                                        ) : (
                                            <div className="space-y-2 sm:space-y-3">
                                                {recommendedProjects.map((project) => (
                                                    <div key={project.id} className="p-3 rounded-lg border border-white/5 hover:border-primary/30 hover:bg-primary/5 transition-all duration-200 cursor-pointer" onClick={() => navigate(`/project/${project.id}`)}>
                                                        <h4 className="font-semibold text-xs sm:text-sm mb-0.5 text-white line-clamp-1">{project.title}</h4>
                                                        <p className="text-xs text-white/50 mb-1">{project.primaryDiscipline}</p>
                                                        <p className="text-xs text-white/60 line-clamp-2 mb-2">{project.summary || project.description}</p>
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            {project.tags?.slice(0, 2).map((tag, i) => (
                                                                <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0 bg-white/5 text-white border-0">{tag}</Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Left Column — main content */}
                            <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                                {/* My Projects */}
                                <Card className="shadow-sm hover:shadow-md transition-shadow">
                                    <CardHeader className="pb-3">
                                        <div className="flex justify-between items-center">
                                            <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-white">
                                                <FolderKanban className="h-4 w-4 sm:h-5 sm:w-5 text-white/50" />
                                                My Projects
                                            </CardTitle>
                                            <Button variant="ghost" size="sm" className="text-xs sm:text-sm h-8 px-2 sm:px-3 text-white/70 hover:text-white" onClick={() => navigate('/dashboard/projects')}>
                                                View All <ArrowRight className="ml-1 h-3 w-3 sm:h-4 sm:w-4" />
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        {loading ? (
                                            <div className="space-y-2">
                                                {[1, 2, 3].map(i => (
                                                    <div key={i} className="animate-pulse h-16 bg-white/10 rounded-lg" />
                                                ))}
                                            </div>
                                        ) : myProjects.length === 0 ? (
                                            <div className="text-center py-6 sm:py-8">
                                                <FolderKanban className="h-10 w-10 sm:h-12 sm:w-12 text-white/30 mx-auto mb-3" />
                                                <p className="text-white/50 text-sm mb-3">No projects yet</p>
                                                <Button size="sm" onClick={() => navigate('/create-project')}>
                                                    <Plus className="mr-2 h-4 w-4" />
                                                    Create Your First Project
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {myProjects.map((project) => (
                                                    <div
                                                        key={project.id}
                                                        className="flex items-center gap-3 p-3 rounded-lg border border-white/5 hover:border-primary/30 hover:bg-primary/5 transition-all duration-200 cursor-pointer"
                                                        onClick={() => navigate(`/project/${project.id}`)}
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                                <h4 className="font-semibold text-sm truncate text-white">{project.title}</h4>
                                                                {getStatusBadge(project.status)}
                                                            </div>
                                                            <p className="text-xs text-muted-foreground line-clamp-1">{project.description}</p>
                                                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                                                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{project.teamSize || 1}</span>
                                                                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatTimeAgo(project.createdAt)}</span>
                                                            </div>
                                                        </div>
                                                        <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Recent Applications */}
                                <Card className="shadow-sm hover:shadow-md transition-shadow">
                                    <CardHeader className="pb-3">
                                        <div className="flex justify-between items-center">
                                            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                                                <Send className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                                                Applications
                                            </CardTitle>
                                            <Button variant="ghost" size="sm" className="text-xs sm:text-sm h-8 px-2 sm:px-3" onClick={() => navigate('/dashboard/applications')}>
                                                View All <ArrowRight className="ml-1 h-3 w-3 sm:h-4 sm:w-4" />
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        {loading ? (
                                            <div className="space-y-2">
                                                {[1, 2, 3].map(i => (
                                                    <div key={i} className="animate-pulse h-14 bg-muted rounded-lg" />
                                                ))}
                                            </div>
                                        ) : applications.length === 0 ? (
                                            <div className="text-center py-6 sm:py-8">
                                                <Send className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-3" />
                                                <p className="text-muted-foreground text-sm mb-3">No applications yet</p>
                                                <Button size="sm" onClick={() => navigate('/projects')}>Browse Projects</Button>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {applications.map((app) => (
                                                    <div key={app.id} className="flex items-center gap-3 p-3 rounded-lg border border-white/5 hover:border-primary/30 hover:bg-primary/5 transition-all duration-200">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                                <h4 className="font-semibold text-sm truncate text-white">{app.projectTitle}</h4>
                                                                {getStatusBadge(app.status)}
                                                            </div>
                                                            <p className="text-xs text-white/50">Applied {formatTimeAgo(app.appliedAt)}</p>
                                                        </div>
                                                        <div className="shrink-0">
                                                            {app.status === 'pending' && <AlertCircle className="h-4 w-4 text-white/40" />}
                                                            {app.status === 'accepted' && <CheckCircle2 className="h-4 w-4 text-white" />}
                                                            {app.status === 'rejected' && <XCircle className="h-4 w-4 text-destructive" />}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Recent Activity */}
                                <Card className="shadow-sm hover:shadow-md transition-shadow">
                                    <CardHeader className="pb-3">
                                        <div className="flex justify-between items-center">
                                            <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-white">
                                                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-white/50" />
                                                Recent Activity
                                            </CardTitle>
                                            <button
                                                onClick={() => loadData()}
                                                title="Refresh"
                                                className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                                            >
                                                <RefreshCw className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        {loading ? (
                                            <div className="space-y-2">
                                                {[1, 2, 3].map(i => (
                                                    <div key={i} className="animate-pulse h-10 bg-white/10 rounded-lg" />
                                                ))}
                                            </div>
                                        ) : recentActivity.length === 0 ? (
                                            <p className="text-center py-4 text-white/50 text-sm">No recent activity</p>
                                        ) : (
                                            <div className="space-y-1">
                                                {recentActivity.map((activity) => (
                                                    <div key={activity.id} className="flex items-start gap-3 p-2 sm:p-3 rounded-lg hover:bg-white/5 transition-colors duration-200">
                                                        <div className="w-1.5 h-1.5 bg-white/40 rounded-full mt-2 flex-shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs sm:text-sm text-white">{activity.message}</p>
                                                            <p className="text-xs text-white/55 mt-0.5">{formatTimeAgo(activity.timestamp)}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </>
                )}
            </DashboardLayout>
        </ErrorBoundary>
    );
}
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
} from 'lucide-react';
import {
    loadDashboardStats,
    loadRecentActivity,
    loadRecommendedProjects,
    loadMyProjects,
    loadMyApplications,
    subscribeToNotifications,
    type DashboardStats,
    type Activity,
    type Project,
    type Application,
} from '@/services/dashboardService';

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

    // Memoized data loading function with reduced initial load
    const loadData = useCallback(async () => {
        if (!user) return;

        try {
            setError(null);
            
            // Load only essential data first (stats), defer others
            const statsData = await loadDashboardStats(user.uid);
            setStats(statsData);

            // Load other data with delay to improve perceived performance
            setTimeout(async () => {
                const [activityData, recommendedData, projectsData, appsData] = await Promise.allSettled([
                    loadRecentActivity(user.uid),
                    loadRecommendedProjects(user.uid),
                    loadMyProjects(user.uid),
                    loadMyApplications(user.uid),
                ]);

                setRecentActivity(activityData.status === 'fulfilled' ? activityData.value : []);
                setRecommendedProjects(recommendedData.status === 'fulfilled' ? recommendedData.value : []);
                setMyProjects(projectsData.status === 'fulfilled' ? projectsData.value.slice(0, 3) : []); // Reduced from 5 to 3
                setApplications(appsData.status === 'fulfilled' ? appsData.value.slice(0, 3) : []); // Reduced from 5 to 3

                // Log any errors for debugging
                [activityData, recommendedData, projectsData, appsData].forEach((result, index) => {
                    if (result.status === 'rejected') {
                        console.error(`Dashboard data load failed for section ${index}:`, result.reason);
                    }
                });
            }, 100); // Small delay to prioritize stats

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

    // Subscribe to notifications
    useEffect(() => {
        if (!user) return;

        const unsubscribe = subscribeToNotifications(user.uid, (notifications) => {
            setStats(prev => ({ ...prev, notifications: notifications.length }));
        });

        return () => unsubscribe();
    }, [user]);

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

    return (
        <ErrorBoundary>
            <DashboardLayout>
                {/* Header */}
                <div className="mb-6 sm:mb-8">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                        Welcome back, {user.displayName?.split(' ')[0] || 'there'}!
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm sm:text-base">
                        Here's what's happening with your projects today
                    </p>
                </div>

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

                {/* Stats Grid - 2x2 on mobile, 4 cols on desktop */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
                    <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-gray-900 border-blue-100 dark:border-blue-900/50" onClick={() => navigate('/dashboard/projects')}>
                        <CardContent className="p-4 sm:p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">My Projects</p>
                                    <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-1 sm:mt-2">{loading ? '...' : stats.myProjects}</h3>
                                </div>
                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center shrink-0">
                                    <FolderKanban className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-gray-900 border-green-100 dark:border-green-900/50" onClick={() => navigate('/dashboard/applications')}>
                        <CardContent className="p-4 sm:p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Applications</p>
                                    <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-1 sm:mt-2">{loading ? '...' : stats.applications}</h3>
                                </div>
                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center shrink-0">
                                    <Send className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-400" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer bg-gradient-to-br from-yellow-50 to-white dark:from-yellow-950/20 dark:to-gray-900 border-yellow-100 dark:border-yellow-900/50" onClick={() => navigate('/dashboard/notifications')}>
                        <CardContent className="p-4 sm:p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Notifications</p>
                                    <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-1 sm:mt-2">{loading ? '...' : stats.notifications}</h3>
                                </div>
                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl flex items-center justify-center shrink-0">
                                    <Bell className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600 dark:text-yellow-400" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-gray-900 border-purple-100 dark:border-purple-900/50" onClick={() => navigate('/dashboard/saved')}>
                        <CardContent className="p-4 sm:p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Saved Projects</p>
                                    <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-1 sm:mt-2">{loading ? '...' : stats.savedProjects}</h3>
                                </div>
                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center shrink-0">
                                    <Bookmark className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 dark:text-purple-400" />
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
                                <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" />
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
                                <Button variant="outline" className="w-full justify-start gap-2 text-sm" onClick={() => navigate('/profile')}>
                                    <User className="h-4 w-4 shrink-0" />
                                    <span className="truncate">Edit Profile</span>
                                </Button>
                                <Button 
                                    variant="outline" 
                                    className="w-full justify-start gap-2 text-sm bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border-blue-200 dark:from-blue-950/20 dark:to-indigo-950/20 dark:border-blue-800" 
                                    onClick={() => navigate('/test/profile-redesign')}
                                >
                                    <Sparkles className="h-4 w-4 text-blue-600 shrink-0" />
                                    <span className="text-blue-700 dark:text-blue-400 truncate">New Profile</span>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Recommended Projects */}
                    <Card className="shadow-sm hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                                Recommended
                            </CardTitle>
                            <CardDescription className="text-xs sm:text-sm">Projects matching your skills</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {loading ? (
                                <div className="space-y-3">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="animate-pulse">
                                            <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4 mb-2" />
                                            <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/2 mb-2" />
                                            <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-full" />
                                        </div>
                                    ))}
                                </div>
                            ) : recommendedProjects.length === 0 ? (
                                <p className="text-center py-4 text-gray-500 text-xs sm:text-sm">Complete your profile to get personalized suggestions!</p>
                            ) : (
                                <div className="space-y-2 sm:space-y-3">
                                    {recommendedProjects.map((project) => (
                                        <div key={project.id} className="p-3 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50/50 dark:hover:bg-purple-950/20 transition-all cursor-pointer" onClick={() => navigate(`/project/${project.id}`)}>
                                            <h4 className="font-semibold text-xs sm:text-sm mb-0.5 line-clamp-1">{project.title}</h4>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{project.primaryDiscipline}</p>
                                            <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2 mb-2">{project.summary || project.description}</p>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {project.tags?.slice(0, 2).map((tag, i) => (
                                                    <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
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
                                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                                    <FolderKanban className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                                    My Projects
                                </CardTitle>
                                <Button variant="ghost" size="sm" className="text-xs sm:text-sm h-8 px-2 sm:px-3" onClick={() => navigate('/dashboard/projects')}>
                                    View All <ArrowRight className="ml-1 h-3 w-3 sm:h-4 sm:w-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {loading ? (
                                <div className="space-y-2">
                                    {[1,2,3].map(i => (
                                        <div key={i} className="animate-pulse h-16 bg-gray-100 dark:bg-gray-800 rounded-lg" />
                                    ))}
                                </div>
                            ) : myProjects.length === 0 ? (
                                <div className="text-center py-6 sm:py-8">
                                    <FolderKanban className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-3" />
                                    <p className="text-gray-500 text-sm mb-3">No projects yet</p>
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
                                            className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all cursor-pointer"
                                            onClick={() => navigate(`/project/${project.id}`)}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                    <h4 className="font-semibold text-sm truncate">{project.title}</h4>
                                                    {getStatusBadge(project.status)}
                                                </div>
                                                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">{project.description}</p>
                                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{project.teamSize || 1}</span>
                                                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatTimeAgo(project.createdAt)}</span>
                                                </div>
                                            </div>
                                            <Eye className="h-4 w-4 text-gray-400 shrink-0" />
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
                                    <Send className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
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
                                    {[1,2,3].map(i => (
                                        <div key={i} className="animate-pulse h-14 bg-gray-100 dark:bg-gray-800 rounded-lg" />
                                    ))}
                                </div>
                            ) : applications.length === 0 ? (
                                <div className="text-center py-6 sm:py-8">
                                    <Send className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-3" />
                                    <p className="text-gray-500 text-sm mb-3">No applications yet</p>
                                    <Button size="sm" onClick={() => navigate('/projects')}>Browse Projects</Button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {applications.map((app) => (
                                        <div key={app.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-green-300 dark:hover:border-green-700 hover:bg-green-50/50 dark:hover:bg-green-950/20 transition-all">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                    <h4 className="font-semibold text-sm truncate">{app.projectTitle}</h4>
                                                    {getStatusBadge(app.status)}
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">Applied {formatTimeAgo(app.appliedAt)}</p>
                                            </div>
                                            <div className="shrink-0">
                                                {app.status === 'pending' && <AlertCircle className="h-4 w-4 text-yellow-500" />}
                                                {app.status === 'accepted' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                                                {app.status === 'rejected' && <XCircle className="h-4 w-4 text-red-500" />}
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
                            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" />
                                Recent Activity
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {loading ? (
                                <div className="space-y-2">
                                    {[1,2,3].map(i => (
                                        <div key={i} className="animate-pulse h-10 bg-gray-100 dark:bg-gray-800 rounded-lg" />
                                    ))}
                                </div>
                            ) : recentActivity.length === 0 ? (
                                <p className="text-center py-4 text-gray-500 text-sm">No recent activity</p>
                            ) : (
                                <div className="space-y-1">
                                    {recentActivity.map((activity) => (
                                        <div key={activity.id} className="flex items-start gap-3 p-2 sm:p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs sm:text-sm text-gray-900 dark:text-white">{activity.message}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{formatTimeAgo(activity.timestamp)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    </ErrorBoundary>
    );
}
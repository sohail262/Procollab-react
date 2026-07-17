import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Loader2, FolderKanban, Eye, Edit, Users, LayoutDashboard, Trash2 } from 'lucide-react'
import { collection, query, where, orderBy, deleteDoc, doc, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { cachedQuery } from '@/lib/queryUtils'

// ── sessionStorage cache ────────────────────────────────────────────────────────────────
const SS_MY_PROJECTS_TTL = 3 * 60 * 1000 // 3 minutes
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'
import { getTagColorClass } from '@/lib/utils'

interface Project {
    id: string
    title: string
    description: string
    summary?: string
    status: string
    tags: string[]
    createdAt: any
    duration?: string
    currentMembers?: number
    maxMembers?: number
    teamSize?: number
    createdBy: string
    primaryDiscipline?: string
    members?: string[]
}

export default function MyProjects() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const { toast } = useToast()
    const [createdProjects, setCreatedProjects] = useState<Project[]>([])
    const [joinedProjects, setJoinedProjects] = useState<Project[]>([])
    const [pastProjects, setPastProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'created' | 'joined' | 'past'>('created')

    useEffect(() => {
        if (user) {
            loadProjects()
        }
    }, [user])

    const loadProjects = async (skipCache = false) => {
        if (!user) return

        // ── FIX: Try sessionStorage for instant revisit ────────────────────────────
        const ssKey = `my_projects_${user.uid}`
        if (!skipCache) {
            try {
                const raw = sessionStorage.getItem(ssKey)
                if (raw) {
                    const { created, joined, past, ts } = JSON.parse(raw)
                    if (Date.now() - ts < SS_MY_PROJECTS_TTL) {
                        setCreatedProjects(created)
                        setJoinedProjects(joined)
                        setPastProjects(past)
                        setLoading(false)
                        return
                    }
                }
            } catch { /* ignore */ }
        }

        setLoading(true)
        try {
            // ── FIX: Two targeted queries instead of scanning ALL projects ──
            // 1. Projects this user created
            const [createdSnapshot, joinedSnapshot] = await Promise.all([
                cachedQuery(
                    query(
                        collection(db, 'projects'),
                        where('createdBy', '==', user.uid),
                        orderBy('createdAt', 'desc')
                    ),
                    { ttl: 300_000, cacheKey: `my-created-projects-${user.uid}` }
                ),
                // 2. Projects where user is a member (array-contains replaces full scan)
                cachedQuery(
                    query(
                        collection(db, 'projects'),
                        where('members', 'array-contains', user.uid)
                    ),
                    { ttl: 300_000, cacheKey: `my-joined-projects-${user.uid}` }
                )
            ])

            const created = createdSnapshot.docs.map(d => ({
                id: d.id,
                ...d.data(),
                createdAt: d.data().createdAt?.toDate() || new Date()
            })) as Project[]

            // Joined = member but not creator
            const joined = joinedSnapshot.docs
                .filter(d => d.data().createdBy !== user.uid)
                .map(d => ({
                    id: d.id,
                    ...d.data(),
                    createdAt: d.data().createdAt?.toDate() || new Date()
                })) as Project[]

            // Split active vs completed
            const activeCreated = created.filter(p => p.status !== 'completed')
            const activeJoined  = joined.filter(p => p.status !== 'completed')
            const completedAll  = [
                ...created.filter(p => p.status === 'completed'),
                ...joined.filter(p => p.status === 'completed'),
            ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

            setCreatedProjects(activeCreated)
            setJoinedProjects(activeJoined)
            setPastProjects(completedAll)

            // Persist to sessionStorage for instant revisit
            try {
                sessionStorage.setItem(ssKey, JSON.stringify({
                    created: activeCreated, joined: activeJoined, past: completedAll,
                    ts: Date.now()
                }))
            } catch { /* quota exceeded */ }
        } catch (error) {
            console.error('Error loading projects:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteProject = async (projectId: string) => {
        if (!confirm("Are you sure you want to delete this project? This action is permanent and cannot be undone.")) return

        // ── Optimistic update: remove card immediately ───────────────────────
        const previousCreated = createdProjects
        const previousJoined  = joinedProjects
        const previousPast    = pastProjects
        setCreatedProjects(prev => prev.filter(p => p.id !== projectId))
        setJoinedProjects(prev => prev.filter(p => p.id !== projectId))
        setPastProjects(prev => prev.filter(p => p.id !== projectId))

        try {
            await deleteDoc(doc(db, 'projects', projectId))
            // Bust caches so re-visits don't show deleted project
            if (user) {
                try { sessionStorage.removeItem(`my_projects_${user.uid}`) } catch { /* ignore */ }
            }
            toast({
                title: "Project Deleted",
                description: "The project has been permanently deleted.",
            })
        } catch (error) {
            // ── Rollback: restore all project lists ──────────────────────────
            setCreatedProjects(previousCreated)
            setJoinedProjects(previousJoined)
            setPastProjects(previousPast)
            console.error("Error deleting project:", error)
            toast({
                title: "Changes couldn't be saved.",
                description: "Failed to delete project. Please check your permissions.",
                variant: "destructive"
            })
        }
    }

    const formatDate = (raw: any) => {
        // Handle Firestore Timestamp, Date, number (ms), string
        let date: Date
        if (!raw) return ''
        if (raw?.toDate) {
            date = raw.toDate()
        } else if (raw instanceof Date) {
            date = raw
        } else {
            date = new Date(raw)
        }
        if (isNaN(date.getTime())) return ''
        const now = new Date()
        const diffTime = Math.abs(now.getTime() - date.getTime())
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

        if (diffDays === 0) return 'Today'
        if (diffDays === 1) return 'Yesterday'
        if (diffDays < 7) return `${diffDays} days ago`
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
        return `${Math.floor(diffDays / 365)} years ago`
    }

    const ProjectCard = ({ project, type }: { project: Project; type: 'created' | 'joined' | 'past' }) => {
        const membersList = project.members || []
        const hasOwner = project.createdBy && membersList.includes(project.createdBy)
        const currentMembers = membersList.length + (hasOwner ? 0 : 1)
        const maxMembers = project.maxMembers || project.teamSize || 5
        const isOwner = project.createdBy === user?.uid

        const getStatusStyle = (status: string) => {
            const s = status.toLowerCase()
            if (s === 'recruiting') {
                return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400 border'
            }
            if (s === 'active') {
                return 'border-orange-500/30 bg-orange-500/15 text-orange-400 border'
            }
            if (s === 'planning' || s === 'completed') {
                return 'border-primary/25 bg-primary/10 text-primary border'
            }
            return 'border-white/10 bg-white/5 text-white/70 border'
        }

        return (
            <Card className="glass-card hover:border-white/25 hover:bg-primary/5 transition-all duration-300 rounded-lg overflow-hidden h-full flex flex-col">
                <CardContent className="p-4 relative z-10 flex flex-col flex-1 h-full">
                    {/* Top row: status pill + date */}
                    <div className="flex items-center justify-between mb-2">
                        <span className={`inline-flex items-center text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${getStatusStyle(project.status)}`}>
                            {project.status}
                        </span>
                        <span className="text-[10px] text-white/40 shrink-0 ml-1">
                            {formatDate(project.createdAt)}
                        </span>
                    </div>

                    {/* Main Content Wrapper (title, description, tags) that will stretch */}
                    <div className="flex-grow flex flex-col justify-start mb-2">
                        {/* Title */}
                        <h3 className="font-semibold text-xs sm:text-sm text-white line-clamp-1 mb-1 font-sans">
                            {project.title}
                        </h3>

                        {/* Description */}
                        <p className="text-[10px] sm:text-xs text-white/60 line-clamp-2 mb-2">
                            {project.summary || project.description}
                        </p>

                        {/* Tags */}
                        {(project.primaryDiscipline || (project.tags?.length ?? 0) > 0) && (
                            <div className="flex flex-wrap gap-1 mt-auto">
                                {project.primaryDiscipline && (
                                    <span className="text-[9px] sm:text-[10px] px-2 py-0.5 rounded-md bg-gradient-to-r from-primary/10 to-primary/20 text-primary truncate max-w-full font-medium">
                                        {project.primaryDiscipline}
                                    </span>
                                )}
                                {project.tags?.slice(0, 2).map((tag, i) => (
                                    <span key={i} className={`text-[9px] sm:text-[10px] px-2 py-0.5 rounded-md truncate max-w-full font-semibold transition-all duration-300 ${getTagColorClass(tag)}`}>
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Members row */}
                    <div className="flex items-center gap-1.5 text-[10px] text-white/50 mb-3 mt-auto font-medium">
                        <Users className="h-3 w-3 shrink-0" />
                        <span>{currentMembers}/{maxMembers} Members</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 pt-2.5 border-t border-white/10 mt-auto">
                        {/* Primary: Dashboard */}
                        <Button
                            size="sm"
                            className="h-7 text-[10px] sm:text-xs flex-1 px-1"
                            onClick={() => navigate(`/dashboard/projects/${project.id}`)}
                        >
                            <LayoutDashboard className="h-3 w-3 mr-1 shrink-0" />
                            <span className="truncate">Dashboard</span>
                        </Button>

                        {/* Ghost icon actions */}
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 shrink-0 text-white/50 hover:text-white"
                            title="View project"
                            onClick={() => navigate(`/project/${project.id}`)}
                        >
                            <Eye className="h-3.5 w-3.5" />
                        </Button>

                        {isOwner && (
                            <>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 shrink-0 text-white/50 hover:text-white"
                                    title="Edit project"
                                    onClick={() => navigate(`/edit-project/${project.id}`)}
                                >
                                    <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 shrink-0 text-white/50 hover:text-white"
                                    title="Manage team"
                                    onClick={() => navigate(`/manage-team/${project.id}`)}
                                >
                                    <Users className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 shrink-0 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                                    title="Delete project"
                                    onClick={() => handleDeleteProject(project.id)}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <DashboardLayout>
            <div className="mb-6 sm:mb-8 flex flex-wrap justify-between items-start gap-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">
                        My Projects
                    </h1>
                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                        Manage your projects and track their progress
                    </p>
                </div>
                <Button onClick={() => navigate('/create-project')} className="shrink-0" size="sm">
                    <Plus className="h-4 w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Create New Project</span>
                    <span className="sm:hidden">New Project</span>
                </Button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 sm:gap-2 mb-6 border-b border-white/10 overflow-x-auto">
                <button
                    className={`px-3 sm:px-4 py-2 font-medium transition-colors border-b-2 whitespace-nowrap text-sm sm:text-base ${activeTab === 'created'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-white/50 hover:text-white'
                        }`}
                    onClick={() => setActiveTab('created')}
                >
                    Created Projects
                </button>
                <button
                    className={`px-3 sm:px-4 py-2 font-medium transition-colors border-b-2 whitespace-nowrap text-sm sm:text-base ${activeTab === 'joined'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-white/50 hover:text-white'
                        }`}
                    onClick={() => setActiveTab('joined')}
                >
                    Ongoing Projects
                </button>
                <button
                    className={`px-3 sm:px-4 py-2 font-medium transition-colors border-b-2 whitespace-nowrap text-sm sm:text-base ${activeTab === 'past'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-white/50 hover:text-white'
                        }`}
                    onClick={() => setActiveTab('past')}
                >
                    Past Projects / History
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <>
                    {/* Created Projects Tab */}
                    {activeTab === 'created' && (
                        <div>
                            {createdProjects.length === 0 ? (
                                <div className="text-center py-12 rounded-lg border border-white/10 bg-white/5">
                                    <FolderKanban className="h-12 w-12 mx-auto text-white/30 mb-4" />
                                    <h3 className="text-lg font-medium text-white mb-2">
                                        No projects created yet
                                    </h3>
                                    <p className="text-white/50 mb-6">
                                        Start your first project and find collaborators
                                    </p>
                                    <Button onClick={() => navigate('/create-project')}>
                                        Create your first project
                                    </Button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                    {createdProjects.map((project) => (
                                        <ProjectCard key={project.id} project={project} type="created" />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Joined Projects Tab */}
                    {activeTab === 'joined' && (
                        <div>
                            {joinedProjects.length === 0 ? (
                                <div className="text-center py-12 rounded-lg border border-white/10 bg-white/5">
                                    <FolderKanban className="h-12 w-12 mx-auto text-white/30 mb-4" />
                                    <h3 className="text-lg font-medium text-white mb-2">
                                        No ongoing projects yet
                                    </h3>
                                    <p className="text-white/50 mb-6">
                                        Discover projects and join teams
                                    </p>
                                    <Button onClick={() => navigate('/discover')}>
                                        Discover Projects
                                    </Button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                    {joinedProjects.map((project) => (
                                        <ProjectCard key={project.id} project={project} type="joined" />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Past Projects Tab */}
                    {activeTab === 'past' && (
                        <div>
                            {pastProjects.length === 0 ? (
                                <div className="text-center py-12 rounded-lg border border-white/10 bg-white/5">
                                    <FolderKanban className="h-12 w-12 mx-auto text-white/30 mb-4" />
                                    <h3 className="text-lg font-medium text-white mb-2">
                                        No past projects in history
                                    </h3>
                                    <p className="text-white/50 mb-6">
                                        Completed projects will be displayed here
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                    {pastProjects.map((project) => (
                                        <ProjectCard key={project.id} project={project} type="past" />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}


                </>
            )}
        </DashboardLayout>
    )
}

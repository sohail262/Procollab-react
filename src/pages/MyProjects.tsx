import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Loader2, FolderKanban, Eye, Edit, Users, LayoutDashboard } from 'lucide-react'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useNavigate } from 'react-router-dom'

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
}

export default function MyProjects() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [createdProjects, setCreatedProjects] = useState<Project[]>([])
    const [joinedProjects, setJoinedProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'created' | 'joined' | 'applications'>('created')

    useEffect(() => {
        if (user) {
            loadProjects()
        }
    }, [user])

    const loadProjects = async () => {
        if (!user) return
        setLoading(true)
        try {
            // Load created projects
            const createdQuery = query(
                collection(db, 'projects'),
                where('createdBy', '==', user.uid),
                orderBy('createdAt', 'desc')
            )
            const createdSnapshot = await getDocs(createdQuery)
            const created = createdSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate() || new Date()
            })) as Project[]
            setCreatedProjects(created)

            // Load joined projects (where user is a member but not creator)
            const allProjectsQuery = query(collection(db, 'projects'))
            const allSnapshot = await getDocs(allProjectsQuery)
            const joined = allSnapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate() || new Date()
                }))
                .filter((project: any) =>
                    project.members?.includes(user.uid) && project.createdBy !== user.uid
                ) as Project[]
            setJoinedProjects(joined)
        } catch (error) {
            console.error('Error loading projects:', error)
        } finally {
            setLoading(false)
        }
    }

    const formatDate = (date: Date) => {
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

    const ProjectCard = ({ project, type }: { project: Project; type: 'created' | 'joined' }) => {
        const currentMembers = project.currentMembers || 1
        const maxMembers = project.maxMembers || project.teamSize || 5

        const statusConfig: Record<string, { dot: string; text: string; bg: string }> = {
            recruiting: { dot: 'bg-amber-400', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
            active:     { dot: 'bg-emerald-400', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
            completed:  { dot: 'bg-blue-400', text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
            'on-hold':  { dot: 'bg-red-400', text: 'text-red-500 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
        }
        const sc = statusConfig[project.status] || { dot: 'bg-gray-400', text: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-800' }

        return (
            <Card className="group bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-md transition-all duration-200">
                <CardContent className="p-3">
                    {/* Top row: status pill + date */}
                    <div className="flex items-center justify-between mb-2">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sc.dot}`} />
                            <span className="truncate max-w-[60px]">{project.status.charAt(0).toUpperCase() + project.status.slice(1)}</span>
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0 ml-1">
                            {formatDate(project.createdAt)}
                        </span>
                    </div>

                    {/* Title */}
                    <h3 className="font-semibold text-xs sm:text-sm text-gray-900 dark:text-white line-clamp-1 mb-1">
                        {project.title}
                    </h3>

                    {/* Description */}
                    <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">
                        {project.summary || project.description}
                    </p>

                    {/* Tags */}
                    {(project.primaryDiscipline || (project.tags?.length ?? 0) > 0) && (
                        <div className="flex flex-wrap gap-1 mb-2">
                            {project.primaryDiscipline && (
                                <span className="text-[9px] sm:text-[10px] px-1 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800 truncate max-w-full">
                                    {project.primaryDiscipline}
                                </span>
                            )}
                            {project.tags?.slice(0, 1).map((tag, i) => (
                                <span key={i} className="text-[9px] sm:text-[10px] px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 truncate max-w-full">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Members row */}
                    <div className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 mb-3">
                        <Users className="h-2.5 w-2.5 shrink-0" />
                        <span>{currentMembers}/{maxMembers}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 pt-2.5 border-t border-gray-100 dark:border-gray-800">
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
                            className="h-7 w-7 p-0 shrink-0 text-gray-400 hover:text-gray-900 dark:hover:text-white"
                            title="View project"
                            onClick={() => navigate(`/project/${project.id}`)}
                        >
                            <Eye className="h-3 w-3" />
                        </Button>

                        {type === 'created' && (
                            <>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 shrink-0 text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                    title="Edit project"
                                    onClick={() => navigate(`/edit-project/${project.id}`)}
                                >
                                    <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 shrink-0 text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                    title="Manage team"
                                    onClick={() => navigate(`/manage-team/${project.id}`)}
                                >
                                    <Users className="h-3 w-3" />
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
            <div className="flex gap-1 sm:gap-2 mb-6 border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
                <button
                    className={`px-3 sm:px-4 py-2 font-medium transition-colors border-b-2 whitespace-nowrap text-sm sm:text-base ${activeTab === 'created'
                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    onClick={() => setActiveTab('created')}
                >
                    Created Projects
                </button>
                <button
                    className={`px-3 sm:px-4 py-2 font-medium transition-colors border-b-2 whitespace-nowrap text-sm sm:text-base ${activeTab === 'joined'
                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    onClick={() => setActiveTab('joined')}
                >
                    Joined Projects
                </button>
                <button
                    className={`px-3 sm:px-4 py-2 font-medium transition-colors border-b-2 whitespace-nowrap text-sm sm:text-base ${activeTab === 'applications'
                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    onClick={() => setActiveTab('applications')}
                >
                    My Applications
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
            ) : (
                <>
                    {/* Created Projects Tab */}
                    {activeTab === 'created' && (
                        <div>
                            {createdProjects.length === 0 ? (
                                <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
                                    <FolderKanban className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                        No projects created yet
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400 mb-6">
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
                                <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
                                    <FolderKanban className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                        You haven't joined any projects yet
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400 mb-6">
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

                    {/* Applications Tab */}
                    {activeTab === 'applications' && (
                        <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
                            <p className="text-gray-500">Applications view - See your profile page for application details</p>
                            <Button onClick={() => navigate('/profile')} className="mt-4">
                                View Profile
                            </Button>
                        </div>
                    )}
                </>
            )}
        </DashboardLayout>
    )
}

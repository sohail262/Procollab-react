import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

    const getStatusBadge = (status: string) => {
        const styles = {
            recruiting: 'bg-yellow-500 text-gray-900',
            active: 'bg-green-600 text-white',
            completed: 'bg-blue-600 text-white',
            'on-hold': 'bg-red-600 text-white',
            'needs-revision': 'bg-gray-700 text-white'
        }
        return styles[status as keyof typeof styles] || 'bg-gray-600 text-white'
    }

    const ProjectCard = ({ project, type }: { project: Project; type: 'created' | 'joined' }) => {
        const currentMembers = project.currentMembers || 1
        const maxMembers = project.maxMembers || project.teamSize || 5

        return (
            <Card className="bg-white dark:bg-[#0B1120] border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-all shadow-sm">
                <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <Badge className={`${getStatusBadge(project.status)} font-medium px-3 py-1`}>
                            {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                        </Badge>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            Created {formatDate(project.createdAt)}
                        </span>
                    </div>

                    <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white line-clamp-1">
                        {project.title}
                    </h3>

                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2 min-h-[2.5rem]">
                        {project.summary || project.description}
                    </p>

                    <div className="flex flex-wrap gap-2 mb-4">
                        {project.primaryDiscipline && (
                            <Badge variant="outline" className="text-xs bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500">
                                {project.primaryDiscipline}
                            </Badge>
                        )}
                        {project.tags?.slice(0, 2).map((tag, i) => (
                            <Badge key={i} variant="outline" className="text-xs bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700">
                                {tag}
                            </Badge>
                        ))}
                    </div>

                    <div className="flex justify-between items-center mb-4 text-sm text-gray-600 dark:text-gray-400">
                        <span>{currentMembers}/{maxMembers} members</span>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200 dark:border-gray-800">
                        <Button
                            size="sm"
                            variant="outline"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white border-none"
                            onClick={() => navigate(`/project/${project.id}`)}
                        >
                            <Eye className="h-3 w-3 mr-1" />
                            View
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="bg-purple-600 hover:bg-purple-700 text-white border-none"
                            onClick={() => navigate(`/dashboard/projects/${project.id}`)}
                        >
                            <LayoutDashboard className="h-3 w-3 mr-1" />
                            Dashboard
                        </Button>
                        {type === 'created' && (
                            <>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="bg-blue-600 hover:bg-blue-700 text-white border-none"
                                    onClick={() => navigate(`/edit-project/${project.id}`)}
                                >
                                    <Edit className="h-3 w-3 mr-1" />
                                    Edit
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="bg-green-600 hover:bg-green-700 text-white border-none"
                                    onClick={() => navigate(`/manage-team/${project.id}`)}
                                >
                                    <Users className="h-3 w-3 mr-1" />
                                    Team
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
            <div className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        My Projects
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Manage your projects and track their progress
                    </p>
                </div>
                <Button onClick={() => navigate('/create-project')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Project
                </Button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-800">
                <button
                    className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'created'
                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    onClick={() => setActiveTab('created')}
                >
                    Created Projects
                </button>
                <button
                    className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'joined'
                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    onClick={() => setActiveTab('joined')}
                >
                    Joined Projects
                </button>
                <button
                    className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === 'applications'
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
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProjectCard } from '@/components/ProjectCard'
import { ApplicationModal } from '@/components/ApplicationModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Search,
    FolderKanban,
    ChevronLeft,
    ChevronRight
} from 'lucide-react'
import { collection, query, getDocs, orderBy } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'

interface Project {
    id: string
    title: string
    description: string
    summary?: string
    primaryDiscipline: string
    status: string
    tags: string[]
    createdBy: string
    createdAt: Date
    teamSize?: number
    requiredSkills?: string[]
    duration?: string
    currentMembers?: number
    maxMembers?: number
    members?: any[]
}

export function Projects() {
    const navigate = useNavigate()
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)

    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [disciplineFilter, setDisciplineFilter] = useState('all')
    const [sortBy, setSortBy] = useState('newest')

    const [currentPage, setCurrentPage] = useState(1)
    const projectsPerPage = 9

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedProject, setSelectedProject] = useState<Project | null>(null)

    const disciplines = [
        'All Disciplines',
        'Computer Science',
        'Engineering',
        'Medicine & Health Sciences',
        'Business & Economics',
        'Arts & Humanities',
        'Social Sciences',
        'Natural Sciences',
        'Education',
        'Law'
    ]

    useEffect(() => {
        loadProjects()
    }, [])

    const loadProjects = async () => {
        setLoading(true)
        try {
            const projectsRef = collection(db, 'projects')
            let q = query(projectsRef, orderBy('createdAt', 'desc'))

            const snapshot = await getDocs(q)
            const projectsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                tags: doc.data().tags || [],
                createdAt: doc.data().createdAt?.toDate() || new Date()
            })) as Project[]

            setProjects(projectsData)
        } catch (error) {
            console.error('Error loading projects:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleApply = (project: Project) => {
        setSelectedProject(project)
        setIsModalOpen(true)
    }

    // Filter and sort projects
    const filteredProjects = projects
        .filter(project => {
            const matchesSearch = searchQuery === '' ||
                project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                project.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (project.tags || []).some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))

            const matchesStatus = statusFilter === 'all' || project.status === statusFilter

            const matchesDiscipline = disciplineFilter === 'all' ||
                project.primaryDiscipline.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-') === disciplineFilter

            // Filter out user's own projects
            const isNotOwnProject = !auth.currentUser || project.createdBy !== auth.currentUser.uid

            return matchesSearch && matchesStatus && matchesDiscipline && isNotOwnProject
        })
        .sort((a, b) => {
            switch (sortBy) {
                case 'newest':
                    return b.createdAt.getTime() - a.createdAt.getTime()
                case 'oldest':
                    return a.createdAt.getTime() - b.createdAt.getTime()
                case 'alphabetical':
                    return a.title.localeCompare(b.title)
                case 'popularity':
                    return (b.teamSize || 0) - (a.teamSize || 0)
                default:
                    return 0
            }
        })

    // Pagination
    const totalPages = Math.ceil(filteredProjects.length / projectsPerPage)
    const startIndex = (currentPage - 1) * projectsPerPage
    const endIndex = startIndex + projectsPerPage
    const currentProjects = filteredProjects.slice(startIndex, endIndex)

    const goToPage = (page: number) => {
        setCurrentPage(page)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    return (
        <DashboardLayout>
            {/* Filter Section */}
            <Card className="mb-8">
                <CardHeader>
                    <CardTitle>Filter Projects</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Status</label>
                            <select
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                                value={statusFilter}
                                onChange={(e) => {
                                    setStatusFilter(e.target.value)
                                    setCurrentPage(1)
                                }}
                            >
                                <option value="all">All Statuses</option>
                                <option value="active">Active</option>
                                <option value="recruiting">Recruiting</option>
                                <option value="completed">Completed</option>
                                <option value="on-hold">On Hold</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Discipline</label>
                            <select
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                                value={disciplineFilter}
                                onChange={(e) => {
                                    setDisciplineFilter(e.target.value)
                                    setCurrentPage(1)
                                }}
                            >
                                <option value="all">All Disciplines</option>
                                {disciplines.slice(1).map((discipline, index) => (
                                    <option key={index} value={discipline.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')}>
                                        {discipline}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Sort By</label>
                            <select
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                            >
                                <option value="newest">Newest First</option>
                                <option value="oldest">Oldest First</option>
                                <option value="popularity">Most Popular</option>
                                <option value="alphabetical">Alphabetical</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Search</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                                <Input
                                    type="text"
                                    placeholder="Search projects..."
                                    className="pl-10"
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value)
                                        setCurrentPage(1)
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Projects Grid */}
            <div className="mb-8">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">
                        {filteredProjects.length} {filteredProjects.length === 1 ? 'Project' : 'Projects'} Found
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        <div className="col-span-full text-center py-12">
                            <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
                            <p className="text-gray-500">Loading projects...</p>
                        </div>
                    ) : currentProjects.length === 0 ? (
                        <div className="col-span-full text-center py-12">
                            <FolderKanban className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold mb-2">No projects found</h3>
                            <p className="text-gray-500 mb-6">Try adjusting your filters or search query</p>
                            <Button onClick={() => {
                                setSearchQuery('')
                                setStatusFilter('all')
                                setDisciplineFilter('all')
                                setSortBy('newest')
                            }}>
                                Clear Filters
                            </Button>
                        </div>
                    ) : (
                        currentProjects.map((project) => (
                            <ProjectCard
                                key={project.id}
                                project={project}
                                onApply={() => handleApply(project)}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center">
                    <nav className="inline-flex rounded-md shadow">
                        <Button
                            variant="outline"
                            className="rounded-r-none"
                            onClick={() => goToPage(currentPage - 1)}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Previous
                        </Button>

                        {[...Array(totalPages)].map((_, index) => {
                            const page = index + 1
                            if (
                                page === 1 ||
                                page === totalPages ||
                                (page >= currentPage - 1 && page <= currentPage + 1)
                            ) {
                                return (
                                    <Button
                                        key={page}
                                        variant={currentPage === page ? 'default' : 'outline'}
                                        className="rounded-none border-l-0"
                                        onClick={() => goToPage(page)}
                                    >
                                        {page}
                                    </Button>
                                )
                            } else if (page === currentPage - 2 || page === currentPage + 2) {
                                return <span key={page} className="px-3 py-2 border border-l-0 border-gray-300 dark:border-gray-700">...</span>
                            }
                            return null
                        })}

                        <Button
                            variant="outline"
                            className="rounded-l-none border-l-0"
                            onClick={() => goToPage(currentPage + 1)}
                            disabled={currentPage === totalPages}
                        >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </nav>
                </div>
            )}

            <ApplicationModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                project={selectedProject}
            />
        </DashboardLayout>
    )
}

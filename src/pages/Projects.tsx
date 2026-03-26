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
import {
    collection, query, getDocs,
    orderBy, doc, getDoc
} from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { useAuth } from '@/hooks/use-auth'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Project {
    id:                string
    title:             string
    description:       string
    summary?:          string
    primaryDiscipline: string
    status:            string
    tags:              string[]
    createdBy:         string
    createdAt:         Date
    teamSize?:         number
    requiredSkills?:   string[]
    duration?:         string
    currentMembers?:   number
    maxMembers?:       number
    members?:          string[]
    openRoles?:        string[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DISCIPLINES = [
    'All Disciplines',
    'Computer Science',
    'Engineering',
    'Medicine & Health Sciences',
    'Business & Economics',
    'Arts & Humanities',
    'Social Sciences',
    'Natural Sciences',
    'Education',
    'Law',
]

const PROJECTS_PER_PAGE = 9

// ─── Component ────────────────────────────────────────────────────────────────

export function Projects() {
    const navigate                 = useNavigate()
    const { user }                 = useAuth()

    const [projects,          setProjects]          = useState<Project[]>([])
    const [loading,           setLoading]           = useState(true)
    const [joinedProjectIds,  setJoinedProjectIds]  = useState<Set<string>>(new Set())

    const [searchQuery,       setSearchQuery]       = useState('')
    const [statusFilter,      setStatusFilter]      = useState('all')
    const [disciplineFilter,  setDisciplineFilter]  = useState('all')
    const [sortBy,            setSortBy]            = useState('newest')
    const [currentPage,       setCurrentPage]       = useState(1)

    // Modal state
    const [isModalOpen,       setIsModalOpen]       = useState(false)
    const [selectedProject,   setSelectedProject]   = useState<Project | null>(null)

    // ── Load everything on mount ───────────────────────────────────────────
    useEffect(() => {
        loadProjects()
    }, [user])

    const loadProjects = async () => {
        setLoading(true)
        try {
            // 1. Load all projects
            const snapshot = await getDocs(
                query(collection(db, 'projects'), orderBy('createdAt', 'desc'))
            )
            const projectsData = snapshot.docs.map(d => ({
                id:       d.id,
                ...d.data(),
                tags:     d.data().tags     || [],
                members:  d.data().members  || [],
                createdAt: d.data().createdAt?.toDate() || new Date(),
            })) as Project[]

            setProjects(projectsData)

            // 2. Build a set of project IDs the current user has joined
            //    so we can hide "Apply to Join" on those cards
            if (user) {
                await loadJoinedProjectIds(projectsData)
            }
        } catch (error) {
            console.error('Error loading projects:', error)
        } finally {
            setLoading(false)
        }
    }

    /**
     * Builds the set of project IDs the current user is already a member of.
     * Checks three sources to cover all join paths:
     *   A. project.members array (fastest — in the already-fetched docs)
     *   B. users/{uid}/joinedProjects subcollection (invitation path)
     *   C. projects/{id}/members/{uid} doc (member subcollection)
     */
    const loadJoinedProjectIds = async (allProjects: Project[]) => {
        if (!user) return

        const joined = new Set<string>()

        // ── Source A: projects.members array ──────────────────────────────
        for (const p of allProjects) {
            if (p.members?.includes(user.uid)) {
                joined.add(p.id)
            }
        }

        // ── Source B: users/{uid}/joinedProjects subcollection ─────────────
        try {
            const jpSnap = await getDocs(
                collection(db, 'users', user.uid, 'joinedProjects')
            )
            jpSnap.docs.forEach(d => {
                const projectId = d.data().projectId || d.id
                if (projectId) joined.add(projectId)
            })
        } catch { /* subcollection may not exist yet */ }

        // ── Source C: check members subcollection for projects not yet found ─
        // Only check projects not already confirmed to avoid excess reads
        const unchecked = allProjects.filter(p => !joined.has(p.id) && p.createdBy !== user.uid)
        await Promise.allSettled(
            unchecked.map(async p => {
                try {
                    const memberDoc = await getDoc(
                        doc(db, 'projects', p.id, 'members', user.uid)
                    )
                    if (memberDoc.exists()) joined.add(p.id)
                } catch { /* non-fatal */ }
            })
        )

        setJoinedProjectIds(joined)
    }

    // ── Apply handler ─────────────────────────────────────────────────────
    const handleApply = (project: Project) => {
        setSelectedProject(project)
        setIsModalOpen(true)
    }

    // ── Filter + sort ─────────────────────────────────────────────────────
    const filteredProjects = projects
        .filter(project => {
            const matchesSearch =
                searchQuery === '' ||
                project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                project.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                project.tags.some(tag =>
                    tag.toLowerCase().includes(searchQuery.toLowerCase())
                )

            const matchesStatus =
                statusFilter === 'all' || project.status === statusFilter

            const matchesDiscipline =
                disciplineFilter === 'all' ||
                project.primaryDiscipline
                    .toLowerCase()
                    .replace(/ & /g, '-')
                    .replace(/ /g, '-') === disciplineFilter

            // Hide own projects
            const isNotOwnProject =
                !user || project.createdBy !== user.uid

            return matchesSearch && matchesStatus && matchesDiscipline && isNotOwnProject
        })
        .sort((a, b) => {
            switch (sortBy) {
                case 'newest':      return b.createdAt.getTime() - a.createdAt.getTime()
                case 'oldest':      return a.createdAt.getTime() - b.createdAt.getTime()
                case 'alphabetical':return a.title.localeCompare(b.title)
                case 'popularity':  return (b.teamSize || 0) - (a.teamSize || 0)
                default:            return 0
            }
        })

    // ── Pagination ────────────────────────────────────────────────────────
    const totalPages     = Math.ceil(filteredProjects.length / PROJECTS_PER_PAGE)
    const startIndex     = (currentPage - 1) * PROJECTS_PER_PAGE
    const currentProjects = filteredProjects.slice(startIndex, startIndex + PROJECTS_PER_PAGE)

    const goToPage = (page: number) => {
        setCurrentPage(page)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const clearFilters = () => {
        setSearchQuery('')
        setStatusFilter('all')
        setDisciplineFilter('all')
        setSortBy('newest')
        setCurrentPage(1)
    }

    // ─── Render ───────────────────────────────────────────────────────────

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
                            <label className="block text-sm font-medium mb-2">
                                Status
                            </label>
                            <select
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                                value={statusFilter}
                                onChange={e => {
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
                            <label className="block text-sm font-medium mb-2">
                                Discipline
                            </label>
                            <select
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                                value={disciplineFilter}
                                onChange={e => {
                                    setDisciplineFilter(e.target.value)
                                    setCurrentPage(1)
                                }}
                            >
                                <option value="all">All Disciplines</option>
                                {DISCIPLINES.slice(1).map((d, i) => (
                                    <option
                                        key={i}
                                        value={d.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')}
                                    >
                                        {d}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Sort By
                            </label>
                            <select
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                                value={sortBy}
                                onChange={e => setSortBy(e.target.value)}
                            >
                                <option value="newest">Newest First</option>
                                <option value="oldest">Oldest First</option>
                                <option value="popularity">Most Popular</option>
                                <option value="alphabetical">Alphabetical</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Search
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                                <Input
                                    type="text"
                                    placeholder="Search projects..."
                                    className="pl-10"
                                    value={searchQuery}
                                    onChange={e => {
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
                        {filteredProjects.length}{' '}
                        {filteredProjects.length === 1 ? 'Project' : 'Projects'} Found
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        <div className="col-span-full text-center py-12">
                            <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4" />
                            <p className="text-gray-500">Loading projects...</p>
                        </div>
                    ) : currentProjects.length === 0 ? (
                        <div className="col-span-full text-center py-12">
                            <FolderKanban className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold mb-2">
                                No projects found
                            </h3>
                            <p className="text-gray-500 mb-6">
                                Try adjusting your filters or search query
                            </p>
                            <Button onClick={clearFilters}>
                                Clear Filters
                            </Button>
                        </div>
                    ) : (
                        currentProjects.map(project => (
                            <ProjectCard
                                key={project.id}
                                project={project}
                                // Pass whether the user already joined this project.
                                // ProjectCard should use this to hide "Apply to Join"
                                // and show "View Project" or "Already a Member" instead.
                                isAlreadyMember={joinedProjectIds.has(project.id)}
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
                            } else if (
                                page === currentPage - 2 ||
                                page === currentPage + 2
                            ) {
                                return (
                                    <span
                                        key={page}
                                        className="px-3 py-2 border border-l-0 border-gray-300 dark:border-gray-700"
                                    >
                                        ...
                                    </span>
                                )
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
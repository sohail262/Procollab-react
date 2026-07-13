import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardContent } from '@/components/ui/card'
import { ProjectCard } from '@/components/ProjectCard'
import { ApplicationModal } from '@/components/ApplicationModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Search,
    FolderKanban,
    ChevronLeft,
    ChevronRight
} from 'lucide-react'
import {
    collection, query, getDocs,
    orderBy, doc, getDoc, where
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
    projectVisibility?: string
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
    const [appliedProjectIds, setAppliedProjectIds] = useState<Set<string>>(new Set())

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
                await loadAppliedProjectIds()
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


    const loadAppliedProjectIds = async () => {
        if (!user) return
        const applied = new Set<string>()
        try {
            const appsSnap = await getDocs(
                query(
                    collection(db, 'users', user.uid, 'applications'),
                    where('status', 'in', ['pending', 'applied', 'viewed', 'shortlisted', 'interviewing'])
                )
            )
            appsSnap.docs.forEach(d => {
                const projectId = d.data().projectId
                if (projectId) applied.add(projectId)
            })
        } catch (error) {
            console.error('Error loading applied project IDs:', error)
        }
        setAppliedProjectIds(applied)
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
                (project.primaryDiscipline || '')
                    .toLowerCase()
                    .replace(/ & /g, '-')
                    .replace(/ /g, '-') === disciplineFilter

            // Hide own projects
            const isNotOwnProject =
                !user || project.createdBy !== user.uid

            // Hide private projects
            const isVisible = project.projectVisibility !== 'private'

            // Hide if team is full
            const membersList = project.members || []
            const hasOwner = project.createdBy && membersList.includes(project.createdBy)
            const currentCount = membersList.length + (hasOwner ? 0 : 1)
            const maxCount = project.maxMembers || project.teamSize || 4
            const isNotFull = currentCount < maxCount

            // Hide if completed
            const isNotCompleted = project.status !== 'completed'

            return matchesSearch && matchesStatus && matchesDiscipline && isNotOwnProject && isVisible && isNotFull && isNotCompleted
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
            <Card className="glass-card mb-5 sm:mb-8 overflow-hidden rounded-lg">
                <span className="glass-sheen" style={{ display: 'none' }} />
                <CardContent className="p-3 sm:p-6 relative z-10">
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                        <div>
                            <label className="block text-xs sm:text-sm font-medium mb-1 sm:mb-2 text-white/80">
                                Status
                            </label>
                            <Select
                                value={statusFilter}
                                onValueChange={value => {
                                    setStatusFilter(value)
                                    setCurrentPage(1)
                                }}
                            >
                                <SelectTrigger className="w-full text-xs sm:text-sm border-white/10 hover:border-primary/30 bg-white/3 h-8 sm:h-10 rounded-lg transition-all duration-300">
                                    <SelectValue placeholder="All Statuses" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="recruiting">Recruiting</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="on-hold">On Hold</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <label className="block text-xs sm:text-sm font-medium mb-1 sm:mb-2 text-white/80">
                                Discipline
                            </label>
                            <Select
                                value={disciplineFilter}
                                onValueChange={value => {
                                    setDisciplineFilter(value)
                                    setCurrentPage(1)
                                }}
                            >
                                <SelectTrigger className="w-full text-xs sm:text-sm border-white/10 hover:border-primary/30 bg-white/3 h-8 sm:h-10 rounded-lg transition-all duration-300">
                                    <SelectValue placeholder="All Disciplines" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Disciplines</SelectItem>
                                    {DISCIPLINES.slice(1).map((d, i) => (
                                        <SelectItem
                                            key={i}
                                            value={d.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')}
                                        >
                                            {d}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <label className="block text-xs sm:text-sm font-medium mb-1 sm:mb-2 text-white/80">
                                Sort By
                            </label>
                            <Select
                                value={sortBy}
                                onValueChange={value => setSortBy(value)}
                            >
                                <SelectTrigger className="w-full text-xs sm:text-sm border-white/10 hover:border-primary/30 bg-white/3 h-8 sm:h-10 rounded-lg transition-all duration-300">
                                    <SelectValue placeholder="Newest First" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="newest">Newest First</SelectItem>
                                    <SelectItem value="oldest">Oldest First</SelectItem>
                                    <SelectItem value="popularity">Most Popular</SelectItem>
                                    <SelectItem value="alphabetical">Alphabetical</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <label className="block text-xs sm:text-sm font-medium mb-1 sm:mb-2 text-white/80">
                                Search
                            </label>
                            <div className="relative">
                                <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-white/50" />
                                <Input
                                    type="text"
                                    placeholder="Search..."
                                    className="pl-8 sm:pl-10 text-xs sm:text-sm h-8 sm:h-10 rounded-lg bg-white/3 border-white/10 hover:border-primary/30 focus-visible:ring-primary transition-all duration-300"
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
            <div className="mb-6 sm:mb-8">
                <div className="flex flex-wrap justify-between items-center gap-2 mb-3 sm:mb-5">
                    <h2 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white">
                        {filteredProjects.length}{' '}
                        {filteredProjects.length === 1 ? 'Project' : 'Projects'} Found
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                    {loading ? (
                        <div className="col-span-full text-center py-12">
                            <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full mb-4" />
                            <p className="text-gray-500">Loading projects...</p>
                        </div>
                    ) : currentProjects.length === 0 ? (
                        <div className="col-span-full text-center py-12">
                            <FolderKanban className="h-12 w-12 sm:h-16 sm:w-16 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg sm:text-xl font-semibold mb-2">
                                No projects found
                            </h3>
                            <p className="text-gray-500 text-sm mb-4 sm:mb-6">
                                Try adjusting your filters or search query
                            </p>
                            <Button size="sm" onClick={clearFilters}>
                                Clear Filters
                            </Button>
                        </div>
                    ) : (
                        currentProjects.map(project => (
                            <ProjectCard
                                key={project.id}
                                project={project}
                                isAlreadyMember={joinedProjectIds.has(project.id)}
                                hasApplied={appliedProjectIds.has(project.id)}
                                onApply={() => handleApply(project)}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center mb-4">
                    <nav className="flex items-center gap-1">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 sm:px-3"
                            onClick={() => goToPage(currentPage - 1)}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            <span className="hidden sm:inline ml-1">Prev</span>
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
                                        size="sm"
                                        className="h-8 w-8 p-0"
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
                                    <span key={page} className="px-1 text-gray-400 text-sm">
                                        …
                                    </span>
                                )
                            }
                            return null
                        })}

                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 sm:px-3"
                            onClick={() => goToPage(currentPage + 1)}
                            disabled={currentPage === totalPages}
                        >
                            <span className="hidden sm:inline mr-1">Next</span>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </nav>
                </div>
            )}

            <ApplicationModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={loadAppliedProjectIds}
                project={selectedProject}
            />
        </DashboardLayout>
    )
}
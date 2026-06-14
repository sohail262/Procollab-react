import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ProjectCard } from '@/components/ProjectCard'
import { ApplicationModal } from '@/components/ApplicationModal'
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { FolderKanban } from 'lucide-react'
import { Button } from '@/components/ui/button'

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

export function SavedProjects() {
    const navigate = useNavigate()
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedProject, setSelectedProject] = useState<Project | null>(null)
    const [joinedProjectIds, setJoinedProjectIds] = useState<Set<string>>(new Set())
    const [appliedProjectIds, setAppliedProjectIds] = useState<Set<string>>(new Set())

    useEffect(() => {
        loadSavedProjects()
        loadJoinedAndApplied()
    }, [])

    const loadSavedProjects = async () => {
        if (!auth.currentUser) return
        setLoading(true)
        try {
            const savedRef = collection(db, 'users', auth.currentUser.uid, 'savedProjects')
            const savedSnapshot = await getDocs(savedRef)

            const projectPromises = savedSnapshot.docs.map(async (savedDoc) => {
                const projectId = savedDoc.data().projectId
                const projectRef = doc(db, 'projects', projectId)
                const projectSnap = await getDoc(projectRef)

                if (projectSnap.exists()) {
                    return {
                        id: projectSnap.id,
                        ...projectSnap.data(),
                        tags: projectSnap.data().tags || [],
                        createdAt: projectSnap.data().createdAt?.toDate() || new Date()
                    } as Project
                }
                return null
            })

            const projectsData = (await Promise.all(projectPromises)).filter(p => p !== null) as Project[]
            setProjects(projectsData)
        } catch (error) {
            console.error('Error loading saved projects:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadJoinedAndApplied = async () => {
        if (!auth.currentUser) return
        const uid = auth.currentUser.uid

        // Joined
        const joined = new Set<string>()
        try {
            const jpSnap = await getDocs(collection(db, 'users', uid, 'joinedProjects'))
            jpSnap.docs.forEach(d => {
                const pId = d.data().projectId || d.id
                if (pId) joined.add(pId)
            })
        } catch {}
        setJoinedProjectIds(joined)

        // Applied
        const applied = new Set<string>()
        try {
            const appsSnap = await getDocs(
                query(
                    collection(db, 'users', uid, 'applications'),
                    where('status', 'in', ['pending', 'applied', 'viewed', 'shortlisted', 'interviewing'])
                )
            )
            appsSnap.docs.forEach(d => {
                const pId = d.data().projectId
                if (pId) applied.add(pId)
            })
        } catch {}
        setAppliedProjectIds(applied)
    }

    const handleApply = (project: Project) => {
        setSelectedProject(project)
        setIsModalOpen(true)
    }

    return (
        <DashboardLayout>
            <div className="mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    Saved Projects
                </h1>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                    Projects you have bookmarked for later
                </p>
            </div>

            {loading ? (
                <div className="text-center py-12">
                    <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
                    <p className="text-gray-500 text-sm">Loading saved projects...</p>
                </div>
            ) : projects.length === 0 ? (
                <div className="text-center py-12">
                    <FolderKanban className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No saved projects</h3>
                    <p className="text-gray-500 text-sm mb-4">Browse projects to find ones you're interested in</p>
                    <Button size="sm" onClick={() => navigate('/projects')}>
                        Browse Projects
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                    {projects.map((project) => (
                        <ProjectCard
                            key={project.id}
                            project={project}
                            isAlreadyMember={joinedProjectIds.has(project.id)}
                            hasApplied={appliedProjectIds.has(project.id)}
                            onApply={() => handleApply(project)}
                        />
                    ))}
                </div>
            )}

            <ApplicationModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={loadJoinedAndApplied}
                project={selectedProject}
            />
        </DashboardLayout>
    )
}

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ApplicationModal } from '@/components/ApplicationModal'
import {
    Calendar,
    Users,
    Clock,
    MapPin,
    CheckCircle,
    MessageSquare,
    Share2,
    Flag,
    ChevronLeft,
    Loader2,
    Check,
    X
} from 'lucide-react'
import { doc, getDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { useToast } from '@/hooks/use-toast'

interface Project {
    id: string
    title: string
    description: string
    summary?: string
    status: string
    primaryDiscipline: string
    tags: string[]
    createdBy: string
    createdAt: any
    teamSize?: number
    maxMembers?: number
    currentMembers?: number
    duration?: string
    timeCommitment?: string
    location?: string
    requiredSkills?: string[]
    goals?: string[]
    timeline?: string
    openRoles?: string[]
    members?: any[]
}

interface ApplicationStatus {
    hasApplied: boolean
    status: 'pending' | 'accepted' | 'rejected' | null
    applicationId: string | null
    userApplicationId: string | null
}

export function ProjectDetails() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { toast } = useToast()
    const [project, setProject] = useState<Project | null>(null)
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [creator, setCreator] = useState<any>(null)
    const [similarProjects, setSimilarProjects] = useState<Project[]>([])
    const [applicationStatus, setApplicationStatus] = useState<ApplicationStatus>({
        hasApplied: false,
        status: null,
        applicationId: null,
        userApplicationId: null
    })
    const [withdrawing, setWithdrawing] = useState(false)
    const currentUser = auth.currentUser

    useEffect(() => {
        if (id) {
            loadProject(id)
        }
    }, [id])

    useEffect(() => {
        if (id && currentUser) {
            checkApplicationStatus()
        }
    }, [id, currentUser])

    const checkApplicationStatus = async () => {
        if (!id || !currentUser) return

        try {
            // Check user's applications subcollection
            const userAppsRef = collection(db, 'users', currentUser.uid, 'applications')
            const userAppsQuery = query(userAppsRef, where('projectId', '==', id))
            const userAppsSnap = await getDocs(userAppsQuery)

            if (!userAppsSnap.empty) {
                const appData = userAppsSnap.docs[0].data()

                // Also get the project application id
                let projectAppId = null
                try {
                    const projectAppsRef = collection(db, 'projects', id, 'applications')
                    const projectAppsQuery = query(projectAppsRef, where('userId', '==', currentUser.uid))
                    const projectAppsSnap = await getDocs(projectAppsQuery)
                    if (!projectAppsSnap.empty) {
                        projectAppId = projectAppsSnap.docs[0].id
                    }
                } catch (err) {
                    console.error('Error checking project applications:', err)
                }

                setApplicationStatus({
                    hasApplied: true,
                    status: appData.status || 'pending',
                    applicationId: projectAppId,
                    userApplicationId: userAppsSnap.docs[0].id
                })
            }
        } catch (error) {
            console.error('Error checking application status:', error)
        }
    }

    const handleWithdraw = async () => {
        if (!id || !currentUser) return

        setWithdrawing(true)
        try {
            // Delete from user's applications
            if (applicationStatus.userApplicationId) {
                await deleteDoc(doc(db, 'users', currentUser.uid, 'applications', applicationStatus.userApplicationId))
            }

            // Delete from project's applications
            if (applicationStatus.applicationId) {
                await deleteDoc(doc(db, 'projects', id, 'applications', applicationStatus.applicationId))
            }

            setApplicationStatus({
                hasApplied: false,
                status: null,
                applicationId: null,
                userApplicationId: null
            })

            toast({
                title: "Application withdrawn",
                description: "Your application has been withdrawn successfully"
            })
        } catch (error) {
            console.error('Error withdrawing application:', error)
            toast({
                title: "Error",
                description: "Failed to withdraw application",
                variant: "destructive"
            })
        } finally {
            setWithdrawing(false)
        }
    }

    const handleApplicationSuccess = () => {
        setIsModalOpen(false)
        checkApplicationStatus()
    }

    const loadProject = async (projectId: string) => {
        setLoading(true)
        try {
            const docRef = doc(db, 'projects', projectId)
            const docSnap = await getDoc(docRef)

            if (docSnap.exists()) {
                const projectData = { id: docSnap.id, ...docSnap.data() } as Project
                setProject(projectData)

                // Load creator details
                if (projectData.createdBy) {
                    const userRef = doc(db, 'users', projectData.createdBy)
                    const userSnap = await getDoc(userRef)
                    if (userSnap.exists()) {
                        setCreator(userSnap.data())
                    }
                }

                // Load similar projects
                if (projectData.primaryDiscipline) {
                    const q = query(
                        collection(db, 'projects'),
                        where('primaryDiscipline', '==', projectData.primaryDiscipline),
                        where('status', '==', 'recruiting')
                    )
                    const querySnapshot = await getDocs(q)
                    const similar = querySnapshot.docs
                        .map(d => ({ id: d.id, ...d.data() } as Project))
                        .filter(p => p.id !== projectId)
                        .slice(0, 3)
                    setSimilarProjects(similar)
                }
            }
        } catch (error) {
            console.error('Error loading project:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
            </DashboardLayout>
        )
    }

    if (!project) {
        return (
            <DashboardLayout>
                <div className="text-center py-12">
                    <h2 className="text-2xl font-bold mb-4">Project not found</h2>
                    <Button onClick={() => navigate('/projects')}>Back to Projects</Button>
                </div>
            </DashboardLayout>
        )
    }

    const isTeamFull = (project.currentMembers || 0) >= (project.maxMembers || project.teamSize || 999)
    const isOwner = currentUser && project.createdBy === currentUser.uid
    const canApply = project.status === 'recruiting' && !isTeamFull && !isOwner

    return (
        <DashboardLayout>
            <Button
                variant="ghost"
                className="mb-6 pl-0 hover:pl-2 transition-all"
                onClick={() => navigate(-1)}
            >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
            </Button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Header */}
                    <div>
                        <div className="flex justify-between items-start mb-4">
                            <Badge className="mb-2" variant={
                                project.status === 'recruiting' ? 'secondary' :
                                    project.status === 'active' ? 'default' : 'outline'
                            }>
                                {project.status.toUpperCase()}
                            </Badge>
                            <span className="text-sm text-gray-500">
                                Posted {new Date(project.createdAt?.seconds * 1000 || Date.now()).toLocaleDateString()}
                            </span>
                        </div>
                        <h1 className="text-4xl font-bold mb-4">{project.title}</h1>
                        <div className="flex flex-wrap gap-2 mb-6">
                            <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                                {project.primaryDiscipline}
                            </Badge>
                            {project.tags?.map((tag, i) => (
                                <Badge key={i} variant="outline">{tag}</Badge>
                            ))}
                        </div>
                    </div>

                    {/* Description */}
                    <Card>
                        <CardHeader>
                            <CardTitle>About the Project</CardTitle>
                        </CardHeader>
                        <CardContent className="prose dark:prose-invert max-w-none">
                            <p className="whitespace-pre-wrap">{project.description}</p>
                        </CardContent>
                    </Card>

                    {/* Goals */}
                    {project.goals && project.goals.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Project Goals</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2">
                                    {project.goals.map((goal, i) => (
                                        <li key={i} className="flex items-start gap-2">
                                            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>{goal}</span>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    )}

                    {/* Required Skills */}
                    {project.requiredSkills && project.requiredSkills.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Required Skills</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-2">
                                    {project.requiredSkills.map((skill, i) => (
                                        <Badge key={i} variant="secondary" className="px-3 py-1">
                                            {skill}
                                        </Badge>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Timeline */}
                    {project.timeline && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Timeline</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="whitespace-pre-wrap">{project.timeline}</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Discussion Placeholder */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Discussion</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-center py-8 text-gray-500">
                                <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-20" />
                                <p>Join the project to participate in discussions.</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Action Card */}
                    <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-900/10 dark:border-blue-800">
                        <CardContent className="p-6 space-y-4">
                            {isOwner ? (
                                <div className="text-center py-3 px-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        You are the owner of this project
                                    </p>
                                </div>
                            ) : applicationStatus.hasApplied ? (
                                <div className="space-y-3">
                                    {applicationStatus.status === 'pending' && (
                                        <>
                                            <div className="flex items-center justify-center gap-2 py-3 px-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                                                <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
                                                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                                                    Application Pending
                                                </p>
                                            </div>
                                            <Button
                                                variant="outline"
                                                className="w-full text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
                                                onClick={handleWithdraw}
                                                disabled={withdrawing}
                                            >
                                                {withdrawing ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                        Withdrawing...
                                                    </>
                                                ) : (
                                                    <>
                                                        <X className="h-4 w-4 mr-2" />
                                                        Withdraw Application
                                                    </>
                                                )}
                                            </Button>
                                        </>
                                    )}
                                    {applicationStatus.status === 'accepted' && (
                                        <>
                                            <div className="flex items-center justify-center gap-2 py-3 px-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                                <Check className="h-5 w-5 text-green-600 dark:text-green-500" />
                                                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                                                    Application Accepted!
                                                </p>
                                            </div>
                                            <Button
                                                className="w-full"
                                                onClick={() => navigate(`/project/${id}/dashboard`)}
                                            >
                                                Go to Project Dashboard
                                            </Button>
                                        </>
                                    )}
                                    {applicationStatus.status === 'rejected' && (
                                        <div className="flex items-center justify-center gap-2 py-3 px-4 bg-red-100 dark:bg-red-900/30 rounded-lg">
                                            <X className="h-5 w-5 text-red-600 dark:text-red-500" />
                                            <p className="text-sm font-medium text-red-700 dark:text-red-400">
                                                Application Rejected
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <Button
                                    className="w-full"
                                    size="lg"
                                    onClick={() => setIsModalOpen(true)}
                                    disabled={!canApply}
                                >
                                    {project.status !== 'recruiting'
                                        ? 'Not Recruiting'
                                        : isTeamFull
                                            ? 'Team is Full'
                                            : 'Apply to Join'}
                                </Button>
                            )}
                            <div className="flex gap-2">
                                <Button variant="outline" className="flex-1">
                                    <Share2 className="h-4 w-4 mr-2" />
                                    Share
                                </Button>
                                <Button variant="outline" className="flex-1">
                                    <Flag className="h-4 w-4 mr-2" />
                                    Report
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Project Details Sidebar */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Project Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-gray-500 flex items-center gap-2">
                                    <Users className="h-4 w-4" /> Team Size
                                </span>
                                <span className="font-medium">{project.currentMembers || 1}/{project.maxMembers || project.teamSize || 4}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-500 flex items-center gap-2">
                                    <Clock className="h-4 w-4" /> Duration
                                </span>
                                <span className="font-medium">{project.duration || 'Flexible'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-500 flex items-center gap-2">
                                    <Calendar className="h-4 w-4" /> Commitment
                                </span>
                                <span className="font-medium">{project.timeCommitment || 'Medium'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-500 flex items-center gap-2">
                                    <MapPin className="h-4 w-4" /> Location
                                </span>
                                <span className="font-medium">{project.location || 'Remote'}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Project Lead */}
                    {creator && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Project Lead</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate(`/profile/${project.createdBy}`)}>
                                    <img
                                        src={creator.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${creator.email}`}
                                        alt={creator.firstName}
                                        className="w-12 h-12 rounded-full"
                                    />
                                    <div>
                                        <h3 className="font-semibold hover:text-blue-600 transition-colors">
                                            {creator.firstName} {creator.lastName}
                                        </h3>
                                        <p className="text-sm text-gray-500">{creator.role || 'Project Creator'}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Open Positions */}
                    {project.openRoles && project.openRoles.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Open Positions</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2">
                                    {project.openRoles.map((role, i) => (
                                        <li key={i} className="text-sm bg-gray-100 dark:bg-gray-800 p-2 rounded">
                                            {role}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    )}

                    {/* Similar Projects */}
                    {similarProjects.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Similar Projects</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {similarProjects.map((p) => (
                                    <div
                                        key={p.id}
                                        className="group cursor-pointer"
                                        onClick={() => navigate(`/project/${p.id}`)}
                                    >
                                        <h4 className="font-medium group-hover:text-blue-600 transition-colors line-clamp-1">
                                            {p.title}
                                        </h4>
                                        <p className="text-xs text-gray-500 line-clamp-2 mt-1">
                                            {p.description}
                                        </p>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            <ApplicationModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                project={project}
            />
        </DashboardLayout>
    )
}

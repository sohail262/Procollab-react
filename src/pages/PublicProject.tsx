import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    limit, 
    doc, 
    getDoc 
} from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { getConnectionStatus } from '@/services/connectionService'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { getTagColorClass } from '@/lib/utils'
import { 
    Briefcase, Calendar, CheckCircle, Clock, Users, 
    FileText, BarChart3, AlertCircle, ArrowLeft, Loader2, 
    Share2, Link2, Twitter, Linkedin, Lock, Flag, Award, HelpCircle
} from 'lucide-react'

interface TeamMember {
    uid: string
    name: string
    avatar?: string
    role: string
    contributionCount: number
}

interface ProjectData {
    id: string
    title: string
    description: string
    summary?: string
    status: string
    primaryDiscipline: string
    tags: string[]
    createdBy: string
    createdAt: any
    duration?: string
    teamSize?: number
    maxTeamSize?: number
    maxMembers?: number
    projectVisibility?: string
}

interface TaskData {
    id: string
    title: string
    description: string
    status: string
    priority: string
    assigneeId?: string
    assigneeName?: string
}

interface MilestoneData {
    id: string
    title: string
    description?: string
    status: 'pending' | 'completed' | 'overdue'
}

export default function PublicProject() {
    const { slug } = useParams<{ slug: string }>()
    const navigate = useNavigate()
    const { toast } = useToast()

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [project, setProject] = useState<ProjectData | null>(null)
    const [tasks, setTasks] = useState<TaskData[]>([])
    const [team, setTeam] = useState<TeamMember[]>([])
    const [milestones, setMilestones] = useState<MilestoneData[]>([])

    // Privacy States
    const [isRestricted, setIsRestricted] = useState(false)
    const [restrictionType, setRestrictionType] = useState<'connections_only' | 'private' | null>(null)
    const [shareOpen, setShareOpen] = useState(false)

    useEffect(() => {
        if (!slug) return
        fetchProjectData()
    }, [slug])

    const fetchProjectData = async () => {
        try {
            setLoading(true)
            setError(null)
            setIsRestricted(false)
            setRestrictionType(null)

            // 1. Fetch Project by Slug
            const projectsRef = collection(db, 'projects')
            const q = query(projectsRef, where('slug', '==', slug!.toLowerCase()), limit(1))
            const querySnap = await getDocs(q)

            if (querySnap.empty) {
                setError('Project not found.')
                setLoading(false)
                return
            }

            const projectDoc = querySnap.docs[0]
            const projData = { id: projectDoc.id, ...projectDoc.data() } as ProjectData

            // 2. Enforce Visibility Privacy settings
            const visitorUid = auth.currentUser?.uid
            const visibility = projData.projectVisibility || 'public'
            
            // Check if visitor is creator or team member
            const membersSnap = await getDocs(collection(db, 'projects', projData.id, 'members'))
            const memberMap: Record<string, any> = {}

            membersSnap.docs.forEach(docSnap => {
                const mData = docSnap.data()
                memberMap[docSnap.id] = {
                    name: mData.name || mData.displayName || 'Member',
                    avatar: mData.avatar || mData.photoURL || '',
                    role: mData.role || 'Member'
                }
            })

            const isTeamMember = visitorUid ? (projData.createdBy === visitorUid || !!memberMap[visitorUid]) : false

            if (!isTeamMember) {
                if (visibility === 'private') {
                    setIsRestricted(true)
                    setRestrictionType('private')
                    setLoading(false)
                    return
                }

                if (visibility === 'connections_only') {
                    if (!visitorUid) {
                        setIsRestricted(true)
                        setRestrictionType('connections_only')
                        setLoading(false)
                        return
                    }

                    // Check if visitor is a connection of the project creator
                    const connStatus = await getConnectionStatus(visitorUid, projData.createdBy)
                    if (connStatus !== 'connected') {
                        setIsRestricted(true)
                        setRestrictionType('connections_only')
                        setLoading(false)
                        return
                    }
                }
            }

            // 3. Fetch Tasks
            const tasksSnap = await getDocs(collection(db, 'projects', projData.id, 'tasks'))
            const tasksList = tasksSnap.docs.map(docSnap => {
                const data = docSnap.data()
                return {
                    id: docSnap.id,
                    title: data.title || '',
                    description: data.description || '',
                    status: data.status || 'todo',
                    priority: data.priority || 'medium',
                    assigneeId: data.assigneeId || '',
                    assigneeName: data.assignee?.name || memberMap[data.assigneeId]?.name || ''
                } as TaskData
            })

            // 4. Fetch Milestones
            const milestonesSnap = await getDocs(collection(db, 'projects', projData.id, 'milestones'))
            const milestonesList = milestonesSnap.docs.map(docSnap => {
                const data = docSnap.data()
                return {
                    id: docSnap.id,
                    title: data.title || '',
                    description: data.description || '',
                    status: data.status || 'pending'
                } as MilestoneData
            })

            // Compute contributions
            const teamList = Object.entries(memberMap).map(([uid, m]) => {
                const contributionCount = tasksList.filter(t => t.assigneeId === uid && t.status === 'done').length
                return {
                    uid,
                    name: m.name,
                    avatar: m.avatar,
                    role: m.role,
                    contributionCount
                } as TeamMember
            })

            setProject(projData)
            setTasks(tasksList)
            setMilestones(milestonesList)
            setTeam(teamList)

        } catch (err) {
            console.error('Error fetching project showcase:', err)
            setError('Could not retrieve project data.')
        } finally {
            setLoading(false)
        }
    }

    const copyShareLink = () => {
        const url = `${window.location.origin}/projects/${slug}`
        navigator.clipboard.writeText(url)
        toast({
            title: 'Link Copied',
            description: 'Public project URL copied to clipboard!',
            variant: 'success'
        })
        setShareOpen(false)
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white">
                <Loader2 className="h-10 w-10 animate-spin text-blue-500 mb-4" />
                <p className="text-sm font-mono tracking-widest text-slate-400">LOADING PROJECT METRICS...</p>
            </div>
        )
    }

    if (error || !project) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white px-4 text-center">
                <AlertCircle className="h-14 w-14 text-red-500 mb-4" />
                <h2 className="text-2xl font-bold mb-2">Project Showcase Unavailable</h2>
                <p className="text-sm text-slate-400 max-w-sm mb-6">{error || 'This project showcase is currently unreachable.'}</p>
                <Button variant="outline" className="border-slate-800 text-slate-300 hover:text-white" onClick={() => navigate('/discover')}>
                    Browse Collaborations
                </Button>
            </div>
        )
    }

    // Redirect completed projects to the recruiter-ready showcase layout
    if (project.status === 'completed') {
        navigate(`/project/public/${project.id}`, { replace: true })
        return null
    }

    // Check if Restricted View
    if (isRestricted) {
        return (
            <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center px-4">
                <Helmet>
                    <title>Restricted Project | ProCollab</title>
                </Helmet>
                
                <Card className="max-w-md w-full bg-slate-900/60 border-slate-800 backdrop-blur-xl p-6 text-center space-y-6">
                    <div className="flex flex-col items-center">
                        <Lock className="h-14 w-14 text-blue-500 mb-3" />
                        <h2 className="text-xl font-bold text-white">Restricted Project</h2>
                        <p className="text-xs text-slate-400 mt-1">
                            {restrictionType === 'connections_only'
                                ? 'This project is restricted to verified connections of the team.'
                                : 'This project has been set to private.'}
                        </p>
                    </div>

                    <div className="flex flex-col gap-2 pt-2">
                        <Button variant="ghost" onClick={() => navigate(-1)} className="text-slate-400 hover:text-white">
                            <ArrowLeft className="h-4 w-4 mr-2" /> Back
                        </Button>
                    </div>
                </Card>
            </div>
        )
    }

    const completedTasks = tasks.filter(t => t.status === 'done')
    const completionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0
    const createdDate = project.createdAt?.toDate ? project.createdAt.toDate() : new Date(project.createdAt)

    // Structured JSON-LD Data for SEO
    const structuredData = {
        "@context": "https://schema.org",
        "@type": "SoftwareSourceCode",
        "name": project.title,
        "description": project.description,
        "programmingLanguage": project.tags || [],
        "creativeWorkStatus": project.status,
        "dateCreated": createdDate.toISOString()
    }

    const getStatusStyle = (status: string) => {
        const s = status.toLowerCase()
        if (s === 'recruiting') {
            return 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
        }
        if (s === 'active') {
            return 'border border-orange-500/30 bg-orange-500/15 text-orange-400'
        }
        if (s === 'planning' || s === 'completed') {
            return 'border border-primary/25 bg-primary/10 text-primary'
        }
        return 'border border-white/10 bg-white/5 text-white/70'
    }

    return (
        <div className="min-h-screen bg-background text-foreground py-10 px-4 sm:px-6 lg:px-8 font-sans selection:bg-primary/30">
            <Helmet>
                <title>{`${project.title} | ProCollab Showcase`}</title>
                <meta name="description" content={project.summary || project.description.substring(0, 150)} />
                
                {/* Open Graph Tags */}
                <meta property="og:title" content={`${project.title} | ProCollab Showcase`} />
                <meta property="og:description" content={project.summary || project.description.substring(0, 150)} />
                <meta property="og:type" content="website" />
                <meta property="og:url" content={window.location.href} />
                
                {/* Structured JSON-LD */}
                <script type="application/ld+json">
                    {JSON.stringify(structuredData)}
                </script>
            </Helmet>

            <div className="max-w-5xl mx-auto space-y-8">
                
                {/* Back / Navigation Bar */}
                <div className="flex justify-between items-center">
                    <Button variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={() => navigate('/discover')}>
                        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Discover
                    </Button>

                    <div className="flex gap-2">
                        <Button variant="outline" className="border-border text-muted-foreground hover:text-foreground" onClick={() => setShareOpen(true)}>
                            <Share2 className="h-4 w-4 mr-2" /> Share Project
                        </Button>
                    </div>
                </div>

                {/* Main Header Project Showcase Card */}
                <div className="relative border border-border bg-card/40 backdrop-blur-xl rounded-2xl p-6 sm:p-8 overflow-hidden shadow-2xl space-y-6">
                    <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
                    
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="px-2.5 py-0.5 border border-primary/30 bg-primary/10 rounded text-xs font-semibold uppercase tracking-wider text-primary">
                                {project.primaryDiscipline || 'discipline'}
                            </span>
                            <Badge className={`uppercase text-[10px] font-bold ${getStatusStyle(project.status)}`}>
                                {project.status}
                            </Badge>
                        </div>

                        <h1 className="text-3xl font-extrabold tracking-tight text-white leading-tight">
                            {project.title}
                        </h1>

                        {project.summary && (
                            <p className="text-sm text-slate-350 italic max-w-4xl border-l-2 border-blue-500 pl-4 py-0.5">
                                "{project.summary}"
                            </p>
                        )}

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-400">
                            <span>Launched: {createdDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
                            {project.duration && (
                                <>
                                    <span className="text-slate-700">•</span>
                                    <span className="flex items-center gap-1">
                                        <Clock className="h-3.5 w-3.5 text-blue-500" />
                                        Duration: {project.duration}
                                    </span>
                                </>
                            )}
                            {project.maxMembers && (
                                <>
                                    <span className="text-slate-700">•</span>
                                    <span className="flex items-center gap-1">
                                        <Users className="h-3.5 w-3.5 text-blue-500" />
                                        Team Target: {project.maxMembers}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="border-t border-slate-800/60 pt-5 space-y-2">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Project brief & specifications</h3>
                        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap max-w-4xl">
                            {project.description}
                        </p>
                    </div>

                    {project.tags && project.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-2">
                            {project.tags.map((tag, i) => (
                                <Badge key={i} className={`border-0 font-semibold text-xs px-2.5 py-1 rounded-md transition-colors ${getTagColorClass(tag)}`}>
                                    {tag}
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>

                {/* Analytical Stats Panel */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Completion Rate', value: `${completionRate}%`, sub: `${completedTasks.length} / ${tasks.length} tasks completed`, icon: CheckCircle },
                        { label: 'Sprint Members', value: team.length || 1, sub: 'Active team collaborators', icon: Users },
                        { label: 'High Priority Deliverables', value: completedTasks.filter(t => t.priority === 'urgent' || t.priority === 'high').length, sub: 'High impact deliverables shipped', icon: Award },
                        { label: 'Task Backlog Items', value: tasks.length, sub: 'Total items logged', icon: FileText }
                    ].map((stat, i) => {
                        const Icon = stat.icon
                        return (
                            <div key={i} className="border border-slate-800 bg-slate-900/30 rounded-xl p-5 shadow-lg space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</span>
                                    <Icon className="h-4.5 w-4.5 text-blue-500" />
                                </div>
                                <p className="text-2xl font-bold text-white leading-none">{stat.value}</p>
                                <p className="text-[10px] text-slate-400">{stat.sub}</p>
                            </div>
                        )
                    })}
                </div>

                {/* Milestones & Timelines */}
                {milestones.length > 0 && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <Flag className="h-5 w-5 text-blue-500" /> Milestones Completed
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {milestones.map((ms) => (
                                <div key={ms.id} className="border border-slate-800 bg-slate-900/20 backdrop-blur-xl rounded-xl p-4 flex gap-3.5 items-start">
                                    <div className={`p-2 rounded ${ms.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-950 border border-slate-800 text-slate-400'}`}>
                                        <CheckCircle className="h-4 w-4" />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="font-bold text-sm text-slate-200">{ms.title}</h4>
                                        {ms.description && <p className="text-xs text-slate-400 leading-snug">{ms.description}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Detailed Contribution & Tasks Showcase */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Deliverables List */}
                    <div className="lg:col-span-2 space-y-4">
                        <h2 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <FileText className="h-5 w-5 text-blue-500" /> Shipped Deliverables
                        </h2>
                        <div className="border border-slate-800 bg-slate-900/20 backdrop-blur-xl rounded-xl overflow-hidden shadow-lg divide-y divide-slate-850">
                            {completedTasks.length === 0 ? (
                                <div className="p-8 text-center text-slate-500 italic">
                                    No completed deliverables logged yet.
                                </div>
                            ) : (
                                completedTasks.map((t) => (
                                    <div key={t.id} className="p-5 flex items-start gap-4">
                                        <div className="p-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mt-0.5">
                                            <CheckCircle className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-3">
                                                <h4 className="text-sm font-semibold text-slate-200 leading-snug">
                                                    {t.title}
                                                </h4>
                                                <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase border ${
                                                    t.priority === 'urgent' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                                                    t.priority === 'high' ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' :
                                                    'bg-slate-950 border-slate-800 text-slate-400'
                                                }`}>
                                                    {t.priority}
                                                </span>
                                            </div>
                                            {t.description && (
                                                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                                                    {t.description}
                                                </p>
                                            )}
                                            {t.assigneeName && (
                                                <p className="text-[10px] text-slate-500 mt-2 font-medium">
                                                    Delivered by: {t.assigneeName}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Team contribution showcase */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <Users className="h-5 w-5 text-blue-500" /> Contributions
                        </h2>
                        <div className="space-y-3">
                            {team.map((m) => (
                                <div key={m.uid} className="border border-slate-800 bg-slate-900/20 backdrop-blur-xl rounded-xl p-5 shadow-lg space-y-4">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-9 w-9 border border-slate-800 bg-slate-950">
                                            <AvatarImage src={m.avatar} />
                                            <AvatarFallback className="text-xs font-semibold bg-slate-900">
                                                {(m.name || 'U').charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0">
                                            <h4 className="font-semibold text-xs text-slate-200 truncate">
                                                {m.name || 'Member'}
                                            </h4>
                                            <p className="text-[10px] text-slate-500">
                                                {m.role}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="border-t border-slate-850/60 pt-3">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Deliverables Completed</span>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <div className="flex-1 h-1.5 bg-slate-950 border border-slate-850 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-primary rounded-full"
                                                    style={{ width: `${tasks.length > 0 ? (m.contributionCount / tasks.length) * 100 : 0}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-bold text-slate-300">
                                                {m.contributionCount}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

            </div>

            {/* Share Modal Dialog */}
            {shareOpen && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in zoom-in-95">
                    <Card className="max-w-md w-full bg-slate-900 border-slate-800 shadow-2xl">
                        <CardHeader>
                            <CardTitle className="text-lg text-white">Share Project Showcase</CardTitle>
                            <CardDescription className="text-slate-450">Generate social links or copy the project's public address.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="bg-slate-950 border border-slate-850 p-3 rounded font-mono text-xs text-blue-400 select-all truncate">
                                {window.location.origin}/projects/{slug}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <a 
                                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out this project on ProCollab! ${window.location.origin}/projects/${slug}`)}`}
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="flex items-center justify-center gap-2 bg-slate-950 hover:bg-slate-850 text-slate-200 py-2.5 rounded border border-slate-800 text-xs font-semibold"
                                >
                                    <Twitter className="h-4 w-4" /> Share Twitter
                                </a>
                                <a 
                                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${window.location.origin}/projects/${slug}`)}`}
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="flex items-center justify-center gap-2 bg-slate-950 hover:bg-slate-850 text-slate-200 py-2.5 rounded border border-slate-800 text-xs font-semibold"
                                >
                                    <Linkedin className="h-4 w-4" /> Share LinkedIn
                                </a>
                            </div>

                            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-850">
                                <Button variant="ghost" className="text-slate-400 hover:text-white" onClick={() => setShareOpen(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={copyShareLink}>
                                    Copy Link
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

        </div>
    )
}

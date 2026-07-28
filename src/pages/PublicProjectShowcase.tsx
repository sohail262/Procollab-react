import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { SEOHead, buildProjectSchema, buildBreadcrumbSchema } from '@/components/seo/SEOHead'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { doc, getDoc, collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
    CheckCircle2, Clock, Users, ArrowLeft, AlertCircle,
    Target, TrendingUp, Layers, Star, Zap, Code2,
    BarChart2, ExternalLink, CalendarDays, Trophy,
    ChevronRight, ShieldCheck, Flame
} from 'lucide-react'

interface TeamMember {
    uid: string
    name: string
    avatar?: string
    role: string
    contributionCount: number
    inProgressCount: number
    totalAssigned: number
}

interface ProjectData {
    id: string
    title: string
    description: string
    summary?: string
    status: string
    primaryDiscipline: string
    tags: string[]
    techStack?: string[]
    keyOutcomes?: string[]
    problemStatement?: string
    liveLink?: string
    githubLink?: string
    createdBy: string
    createdAt: any
    completedAt?: any
    duration?: string
    teamMembers?: Record<string, { role: string; name: string; avatar?: string }>
}

interface TaskData {
    id: string
    title: string
    description: string
    status: string
    priority: string
    assigneeId?: string
    assigneeName?: string
    category?: string
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
    urgent: { label: 'Urgent', color: 'text-red-400 bg-red-500/10 border-red-500/20', dot: 'bg-red-400' },
    high: { label: 'High', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20', dot: 'bg-orange-400' },
    medium: { label: 'Medium', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', dot: 'bg-yellow-400' },
    low: { label: 'Low', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20', dot: 'bg-slate-400' },
}

const DISCIPLINE_GRADIENTS: Record<string, string> = {
    'Computer Science': 'from-blue-600/20 via-violet-600/10 to-transparent',
    'Design': 'from-pink-600/20 via-rose-600/10 to-transparent',
    'Business': 'from-emerald-600/20 via-teal-600/10 to-transparent',
    'Engineering': 'from-orange-600/20 via-amber-600/10 to-transparent',
    'Marketing': 'from-purple-600/20 via-fuchsia-600/10 to-transparent',
}

function StatCard({ icon: Icon, label, value, sub, accent = false }: {
    icon: any, label: string, value: string | number, sub: string, accent?: boolean
}) {
    return (
        <div className={`relative rounded-2xl p-5 border overflow-hidden ${
            accent
                ? 'bg-gradient-to-br from-violet-600/20 to-blue-600/10 border-violet-500/20'
                : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
            <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-lg ${accent ? 'bg-violet-500/20' : 'bg-white/5'}`}>
                    <Icon className={`h-4 w-4 ${accent ? 'text-violet-400' : 'text-slate-400'}`} />
                </div>
            </div>
            <p className="text-3xl font-black tracking-tight leading-none text-white">{value}</p>
            <p className="text-[11px] font-semibold text-slate-400 mt-1 uppercase tracking-wider">{label}</p>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{sub}</p>
        </div>
    )
}

export default function PublicProjectShowcase() {
    const { projectId } = useParams<{ projectId: string }>()
    const navigate = useNavigate()

    const [loading, setLoading] = useState(true)
    const [project, setProject] = useState<ProjectData | null>(null)
    const [tasks, setTasks] = useState<TaskData[]>([])
    const [team, setTeam] = useState<TeamMember[]>([])
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!projectId) return

        async function fetchPublicData() {
            try {
                setLoading(true)
                // 1. Fetch Project Doc
                const projSnap = await getDoc(doc(db, 'projects', projectId!))
                if (!projSnap.exists()) {
                    setError('Project not found or is private.')
                    setLoading(false)
                    return
                }

                const projData = { id: projSnap.id, ...projSnap.data() } as ProjectData

                // 2. Fetch members subcollection
                const membersSnap = await getDocs(collection(db, 'projects', projectId!, 'members'))
                const memberMap: Record<string, any> = {}

                if (!membersSnap.empty) {
                    membersSnap.docs.forEach(docSnap => {
                        const mData = docSnap.data()
                        memberMap[docSnap.id] = {
                            name: mData.name || mData.displayName || 'Member',
                            avatar: mData.avatar || mData.photoURL || '',
                            role: mData.role || 'Member'
                        }
                    })
                } else {
                    // Fallback to project teamMembers map
                    const projMembers = projData.teamMembers || {}
                    Object.entries(projMembers).forEach(([uid, m]: [string, any]) => {
                        memberMap[uid] = {
                            name: m.name || 'Member',
                            avatar: m.avatar || '',
                            role: m.role || 'Member'
                        }
                    })
                }

                // 3. Fetch Tasks list
                const tasksSnap = await getDocs(collection(db, 'projects', projectId!, 'tasks'))
                const tasksList = tasksSnap.docs.map(docSnap => {
                    const data = docSnap.data()
                    return {
                        id: docSnap.id,
                        title: data.title || '',
                        description: data.description || '',
                        status: data.status || 'todo',
                        priority: data.priority || 'medium',
                        assigneeId: data.assigneeId || '',
                        assigneeName: data.assignee?.name || memberMap[data.assigneeId]?.name || '',
                        category: data.category || ''
                    } as TaskData
                })

                // Compute team member contribution counts with richer data
                const teamList = Object.entries(memberMap).map(([uid, m]) => {
                    const myTasks = tasksList.filter(t => t.assigneeId === uid)
                    return {
                        uid,
                        name: m.name,
                        avatar: m.avatar,
                        role: m.role,
                        contributionCount: myTasks.filter(t => t.status === 'done').length,
                        inProgressCount: myTasks.filter(t => t.status === 'inprogress').length,
                        totalAssigned: myTasks.length,
                    } as TeamMember
                }).sort((a, b) => b.contributionCount - a.contributionCount)

                setProject(projData)
                setTasks(tasksList)
                setTeam(teamList)
            } catch (err) {
                console.error('Error fetching showcase data:', err)
                setError('Could not load project showcase data.')
            } finally {
                setLoading(false)
            }
        }

        fetchPublicData()
    }, [projectId])

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0f] text-slate-400">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-violet-500/30 border-t-violet-400 mb-4" />
                <p className="text-sm font-medium tracking-wide">Loading showcase...</p>
            </div>
        )
    }

    if (error || !project) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0f] text-slate-400 px-4">
                <AlertCircle className="h-12 w-12 text-slate-600 mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">Showcase Unavailable</h2>
                <p className="text-sm text-slate-500 mb-8 text-center max-w-sm">{error || 'This project details are unavailable.'}</p>
                <Button variant="outline" className="border-white/10 text-slate-300 hover:bg-white/5 hover:text-white" onClick={() => navigate('/discover')}>
                    Browse Discover
                </Button>
            </div>
        )
    }

    const completedTasks = tasks.filter(t => t.status === 'done')
    const highImpactDelivered = completedTasks.filter(t => t.priority === 'urgent' || t.priority === 'high')
    const completionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0
    const createdDate = project.createdAt?.toDate ? project.createdAt.toDate() : new Date(project.createdAt || Date.now())
    const disciplineGradient = DISCIPLINE_GRADIENTS[project.primaryDiscipline] || 'from-slate-600/20 to-transparent'
    const urgentCompleted = completedTasks.filter(t => t.priority === 'urgent')
    const highCompleted = completedTasks.filter(t => t.priority === 'high')
    const keyDeliverables = [...urgentCompleted, ...highCompleted].slice(0, 6)
    const otherDeliverables = completedTasks.filter(t => t.priority !== 'urgent' && t.priority !== 'high')
    const techTags = project.techStack || project.tags || []

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-slate-200 font-sans">
            <SEOHead
                title={`${project.title} — Completed ${project.primaryDiscipline || 'Student'} Project Showcase`}
                description={`${project.summary || project.description?.substring(0, 200)} | Completed project built by ${team.length} collaborators on ProCollab. Tech: ${(project.techStack || project.tags || []).slice(0, 5).join(', ')}.`}
                keywords={[
                    ...(project.techStack || project.tags || []),
                    project.primaryDiscipline,
                    'completed project',
                    'student project showcase',
                    'project portfolio',
                    'final year project',
                    'engineering project showcase',
                    'project deliverables',
                ].filter(Boolean) as string[]}
                canonical={`https://procollab.in/project/public/${projectId}`}
                type="article"
                structuredData={[
                    buildProjectSchema({
                        title: project.title,
                        description: project.summary || project.description,
                        url: `https://procollab.in/project/public/${projectId}`,
                        tags: project.techStack || project.tags,
                        datePublished: createdDate.toISOString(),
                        status: 'completed',
                    }),
                    buildBreadcrumbSchema([
                        { name: 'Home', url: '/' },
                        { name: 'Discover', url: '/discover' },
                        { name: project.title, url: `/project/public/${projectId}` },
                    ]),
                ]}
            />
            <div className={`fixed inset-0 bg-gradient-to-br ${disciplineGradient} pointer-events-none`} />

            <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">

                {/* Top Nav */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => navigate('/discover')}
                        className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors group"
                    >
                        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                        Back to Discover
                    </button>
                    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-[10px] font-bold uppercase tracking-widest px-3 py-1">
                        ✦ Completed Portfolio
                    </Badge>
                </div>

                {/* Hero */}
                <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
                    <div className={`h-1 w-full bg-gradient-to-r ${
                        project.primaryDiscipline === 'Computer Science' ? 'from-blue-500 via-violet-500 to-purple-500' :
                        project.primaryDiscipline === 'Design' ? 'from-pink-500 via-rose-500 to-red-400' :
                        project.primaryDiscipline === 'Business' ? 'from-emerald-500 via-teal-500 to-cyan-500' :
                        'from-violet-500 via-blue-500 to-cyan-500'
                    }`} />

                    <div className="p-8 md:p-12">
                        <div className="flex flex-wrap gap-2 mb-5">
                            <Link to={`/discover?domain=${encodeURIComponent(project.primaryDiscipline.toLowerCase())}`} className="text-[10px] font-black uppercase tracking-[0.15em] px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-colors">
                                {project.primaryDiscipline}
                            </Link>
                            {techTags.slice(0, 5).map((tag, i) => (
                                <Link key={i} to={`/discover?domain=${encodeURIComponent(tag.toLowerCase())}`} className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 transition-colors">
                                    {tag}
                                </Link>
                            ))}
                        </div>

                        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-tight mb-3">
                            {project.title}
                        </h1>

                        {project.summary && (
                            <p className="text-lg text-slate-300 font-medium leading-relaxed max-w-3xl mb-6 italic">
                                &ldquo;{project.summary}&rdquo;
                            </p>
                        )}

                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500 mb-8">
                            <span className="flex items-center gap-1.5">
                                <CalendarDays className="h-3.5 w-3.5" />
                                Launched {createdDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                            </span>
                            {project.duration && (
                                <span className="flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5" />
                                    {project.duration} duration
                                </span>
                            )}
                            <span className="flex items-center gap-1.5">
                                <Users className="h-3.5 w-3.5" />
                                {team.length} collaborators
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-white/[0.05] pt-8">
                            <div>
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3 flex items-center gap-2">
                                    <Target className="h-3.5 w-3.5 text-violet-400" />
                                    Project Brief
                                </h3>
                                <p className="text-slate-300 leading-relaxed text-[15px] whitespace-pre-wrap">
                                    {project.description}
                                </p>
                            </div>
                            {project.problemStatement && (
                                <div>
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3 flex items-center gap-2">
                                        <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
                                        Problem Statement & Challenge
                                    </h3>
                                    <p className="text-slate-300 leading-relaxed text-[15px] whitespace-pre-wrap">
                                        {project.problemStatement}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Showcase Action Links (Github, Live URL) */}
                        {(project.liveLink || project.githubLink) && (
                            <div className="flex flex-wrap gap-3 mt-8 pt-6 border-t border-white/[0.03]">
                                {project.liveLink && (
                                    <a
                                        href={project.liveLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-all shadow-lg shadow-violet-600/20"
                                    >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        Live Demo
                                    </a>
                                )}
                                {project.githubLink && (
                                    <a
                                        href={project.githubLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold transition-all"
                                    >
                                        <Code2 className="h-3.5 w-3.5 text-slate-400" />
                                        GitHub Repository
                                    </a>
                                )}
                            </div>
                        )}

                        {project.keyOutcomes && project.keyOutcomes.length > 0 && (
                            <div className="mt-8 border-t border-white/[0.05] pt-8">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4 flex items-center gap-2">
                                    <Trophy className="h-3.5 w-3.5" />
                                    Key Outcomes
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {project.keyOutcomes.map((outcome, i) => (
                                        <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                                            <p className="text-sm text-slate-300 leading-snug">{outcome}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Impact Metrics */}
                <div>
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4 flex items-center gap-2">
                        <BarChart2 className="h-3.5 w-3.5" />
                        Impact at a Glance
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <StatCard icon={Trophy} label="Completion Rate" value={`${completionRate}%`} sub={`${completedTasks.length} of ${tasks.length} tasks closed`} accent={completionRate >= 70} />
                        <StatCard icon={Zap} label="High-Impact Deliverables" value={highImpactDelivered.length} sub="Urgent or high priority tasks shipped" />
                        <StatCard icon={Users} label="Team Size" value={team.length} sub="Cross-functional collaborators" />
                        <StatCard icon={Layers} label="Total Work Scoped" value={tasks.length} sub="Tasks across all sprint cycles" />
                    </div>
                </div>

                {/* Deliverables + Team */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-3 space-y-6">
                        {keyDeliverables.length > 0 && (
                            <div>
                                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4 flex items-center gap-2">
                                    <Flame className="h-3.5 w-3.5 text-orange-400" />
                                    High-Impact Deliverables
                                </h2>
                                <div className="space-y-2">
                                    {keyDeliverables.map((t) => {
                                        const pc = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.medium
                                        return (
                                            <div key={t.id} className="flex items-start gap-4 p-4 rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all">
                                                <div className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${pc.dot}`} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <h4 className="text-sm font-semibold text-white leading-snug">{t.title}</h4>
                                                        <span className={`flex-shrink-0 text-[9px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider ${pc.color}`}>
                                                            {pc.label}
                                                        </span>
                                                    </div>
                                                    {t.description && (
                                                        <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">{t.description}</p>
                                                    )}
                                                    {t.assigneeName && (
                                                        <p className="text-[10px] text-slate-600 mt-2 font-medium">
                                                            Shipped by <span className="text-slate-400">{t.assigneeName}</span>
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {otherDeliverables.length > 0 && (
                            <div>
                                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4 flex items-center gap-2">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                    Additional Deliverables
                                    <span className="ml-auto text-[9px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full normal-case tracking-normal text-slate-400 font-medium">
                                        {otherDeliverables.length} completed
                                    </span>
                                </h2>
                                <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] divide-y divide-white/[0.04] overflow-hidden">
                                    {otherDeliverables.map((t) => (
                                        <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors">
                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/50 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-slate-300 truncate">{t.title}</p>
                                                {t.assigneeName && <p className="text-[10px] text-slate-600">by {t.assigneeName}</p>}
                                            </div>
                                            <ChevronRight className="h-3 w-3 text-slate-700 flex-shrink-0" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {completedTasks.length === 0 && (
                            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-10 text-center">
                                <CheckCircle2 className="h-8 w-8 text-slate-700 mx-auto mb-3" />
                                <p className="text-slate-500 text-sm">No completed deliverables logged yet.</p>
                            </div>
                        )}
                    </div>

                    {/* Team Panel */}
                    <div className="lg:col-span-2 space-y-4">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4 flex items-center gap-2">
                            <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
                            Team &amp; Contributions
                        </h2>
                        <div className="space-y-3">
                            {team.map((m, idx) => {
                                const deliveryRate = m.totalAssigned > 0
                                    ? Math.round((m.contributionCount / m.totalAssigned) * 100)
                                    : 0
                                const isTopContributor = idx === 0 && m.contributionCount > 0
                                return (
                                    <div key={m.uid} className={`relative rounded-2xl border p-5 transition-all ${
                                        isTopContributor
                                            ? 'bg-gradient-to-br from-amber-500/8 to-transparent border-amber-500/20'
                                            : 'bg-white/[0.02] border-white/[0.05]'
                                    }`}>
                                        {isTopContributor && (
                                            <div className="absolute top-3 right-3 flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                                                <Star className="h-2.5 w-2.5 fill-current" />
                                                Top Contributor
                                            </div>
                                        )}
                                        <div className="flex items-center gap-3 mb-4">
                                            <Avatar className="h-10 w-10 ring-1 ring-white/10">
                                                <AvatarImage src={m.avatar} />
                                                <AvatarFallback className="bg-white/5 text-sm font-bold text-slate-300">
                                                    {(m.name || 'U').charAt(0).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0 flex-1">
                                                <h4 className="font-bold text-sm text-white truncate">{m.name || 'Member'}</h4>
                                                <p className="text-[11px] text-slate-500 font-medium">{m.role}</p>
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <div>
                                                <div className="flex justify-between text-[10px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                                                    <span>Delivery Rate</span>
                                                    <span className={deliveryRate >= 70 ? 'text-emerald-400' : 'text-slate-400'}>
                                                        {deliveryRate}%
                                                    </span>
                                                </div>
                                                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all ${
                                                            deliveryRate >= 70 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' :
                                                            deliveryRate >= 40 ? 'bg-gradient-to-r from-yellow-500 to-amber-400' :
                                                            'bg-slate-600'
                                                        }`}
                                                        style={{ width: `${deliveryRate}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 pt-1">
                                                {[
                                                    { label: 'Done', value: m.contributionCount, color: 'text-emerald-400' },
                                                    { label: 'Active', value: m.inProgressCount, color: 'text-blue-400' },
                                                    { label: 'Scoped', value: m.totalAssigned, color: 'text-slate-400' },
                                                ].map(stat => (
                                                    <div key={stat.label} className="text-center p-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                                                        <p className={`text-base font-black leading-none ${stat.color}`}>{stat.value}</p>
                                                        <p className="text-[9px] text-slate-600 mt-1 font-semibold uppercase tracking-wider">{stat.label}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {techTags.length > 0 && (
                            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3 flex items-center gap-2">
                                    <Code2 className="h-3.5 w-3.5 text-violet-400" />
                                    Skills &amp; Technologies
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {techTags.map((tag, i) => (
                                        <span key={i} className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4 flex items-center gap-2">
                                <TrendingUp className="h-3.5 w-3.5 text-blue-400" />
                                Work Breakdown
                            </h3>
                            {[
                                { label: 'Completed', count: completedTasks.length, color: 'bg-emerald-400', textColor: 'text-emerald-400' },
                                { label: 'In Progress', count: tasks.filter(t => t.status === 'inprogress').length, color: 'bg-blue-400', textColor: 'text-blue-400' },
                                { label: 'Backlog', count: tasks.filter(t => t.status === 'backlog' || t.status === 'todo').length, color: 'bg-slate-600', textColor: 'text-slate-500' },
                            ].map(item => (
                                <div key={item.label} className="flex items-center gap-3 mb-3 last:mb-0">
                                    <div className={`h-2 w-2 rounded-full flex-shrink-0 ${item.color}`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[11px] font-semibold text-slate-400">{item.label}</span>
                                            <span className={`text-[11px] font-black ${item.textColor}`}>{item.count}</span>
                                        </div>
                                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full ${item.color} rounded-full transition-all`}
                                                style={{ width: `${tasks.length > 0 ? (item.count / tasks.length) * 100 : 0}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-white/[0.05] pt-8 pb-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-[11px] text-slate-600">
                        <ShieldCheck className="h-3.5 w-3.5 text-slate-700" />
                        <span>Project data verified from Procollab workspace</span>
                    </div>
                    <button
                        onClick={() => navigate('/discover')}
                        className="text-[11px] text-slate-500 hover:text-white flex items-center gap-1.5 transition-colors"
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Explore more projects on Procollab
                    </button>
                </div>

            </div>
        </div>
    )
}

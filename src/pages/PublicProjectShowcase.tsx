import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { doc, getDoc, collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
    Briefcase, Calendar, CheckCircle, Clock,
    Users, FileText, BarChart3, AlertCircle, ArrowLeft
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
                        assigneeName: data.assignee?.name || memberMap[data.assigneeId]?.name || ''
                    } as TaskData
                })

                // Compute team member contribution counts
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
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-700 dark:border-slate-300 mb-2"></div>
                <p className="text-sm font-medium">Loading project showcase...</p>
            </div>
        )
    }

    if (error || !project) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 px-4">
                <AlertCircle className="h-12 w-12 text-slate-400 mb-3" />
                <h2 className="text-xl font-bold mb-2">Showcase Unavailable</h2>
                <p className="text-sm text-slate-500 mb-6 text-center max-w-sm">{error || 'This project details are unavailable.'}</p>
                <Button variant="outline" onClick={() => navigate('/discover')}>
                    Browse Discover Page
                </Button>
            </div>
        )
    }

    const completedTasks = tasks.filter(t => t.status === 'done')
    const completionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0
    const createdDate = project.createdAt?.toDate ? project.createdAt.toDate() : new Date(project.createdAt)

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-slate-200 dark:selection:bg-slate-800">
            <div className="max-w-5xl mx-auto space-y-8">
                
                {/* Back Link */}
                <div className="flex items-center">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1.5 p-0 hover:bg-transparent"
                        onClick={() => navigate('/discover')}
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Discover
                    </Button>
                </div>

                {/* Main Header Card */}
                <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm">
                    <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
                        <div className="space-y-2.5">
                            <div className="flex items-center gap-3">
                                <span className="px-2.5 py-0.5 border border-slate-300 dark:border-slate-700 rounded text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                    {project.primaryDiscipline}
                                </span>
                                <Badge variant="outline" className="border-green-300 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20 text-green-700 dark:text-green-400">
                                    Completed Portfolio
                                </Badge>
                            </div>
                            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
                                {project.title}
                            </h1>
                            {project.summary && (
                                <p className="text-sm text-slate-655 dark:text-slate-350 font-medium max-w-3xl mt-1.5 italic">
                                    "{project.summary}"
                                </p>
                            )}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 dark:text-slate-400 mt-2">
                                <span>Launched: {createdDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
                                {project.duration && (
                                    <>
                                        <span className="text-slate-300 dark:text-slate-700">•</span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="h-3.5 w-3.5" />
                                            Duration: {project.duration}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-6">
                        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Project Brief</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl whitespace-pre-wrap">
                            {project.description}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-5">
                        {project.tags.map((tag, i) => (
                            <Badge key={i} variant="secondary" className="bg-slate-100 dark:bg-slate-800 border-0 text-slate-700 dark:text-slate-300 text-xs">
                                {tag}
                            </Badge>
                        ))}
                    </div>
                </div>

                {/* Analytical Stats Panel */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Completion Rate', value: `${completionRate}%`, sub: `${completedTasks.length} / ${tasks.length} tasks completed`, icon: CheckCircle },
                        { label: 'Sprint Members', value: team.length, sub: 'Active collaborators', icon: Users },
                        { label: 'Major Deliverables', value: completedTasks.filter(t => t.priority === 'urgent' || t.priority === 'high').length, sub: 'High impact tasks delivered', icon: Briefcase },
                        { label: 'Work Breakdown', value: tasks.length, sub: 'Total items in backlog', icon: FileText },
                    ].map((stat, i) => {
                        const Icon = stat.icon
                        return (
                            <div key={i} className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-5 shadow-sm space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{stat.label}</span>
                                    <Icon className="h-4 w-4 text-slate-400 dark:text-slate-600" />
                                </div>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white leading-none">{stat.value}</p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">{stat.sub}</p>
                            </div>
                        )
                    })}
                </div>

                {/* Detailed Contribution & Tasks Showcase */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Deliverables List (Slate theme, utmost info) */}
                    <div className="lg:col-span-2 space-y-4">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wide">
                            Deliverables & Task Analysis
                        </h2>
                        <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
                            {completedTasks.length === 0 ? (
                                <div className="p-8 text-center text-slate-500">
                                    No completed deliverables logged.
                                </div>
                            ) : (
                                completedTasks.map((t) => (
                                    <div key={t.id} className="p-5 flex items-start gap-4">
                                        <div className="p-1 rounded bg-green-50 dark:bg-green-950/20 border border-green-200/30 text-green-700 dark:text-green-400 mt-0.5">
                                            <CheckCircle className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-3">
                                                <h4 className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">
                                                    {t.title}
                                                </h4>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider ${
                                                    t.priority === 'urgent' ? 'bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/20 dark:text-red-400' :
                                                    t.priority === 'high' ? 'bg-orange-50 border border-orange-200 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400' :
                                                    'bg-slate-100 text-slate-700 dark:bg-slate-850 dark:text-slate-400'
                                                }`}>
                                                    {t.priority}
                                                </span>
                                            </div>
                                            {t.description && (
                                                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                                                    {t.description}
                                                </p>
                                            )}
                                            {t.assigneeName && (
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 font-medium">
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
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wide">
                            Team Contributions
                        </h2>
                        <div className="space-y-3">
                            {team.map((m) => (
                                <div key={m.uid} className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-5 shadow-sm space-y-4">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10 border border-slate-200 dark:border-slate-850">
                                            <AvatarImage src={m.avatar} />
                                            <AvatarFallback className="text-xs font-semibold">
                                                {(m.name || 'U').charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0">
                                            <h4 className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                                                {m.name || 'Member'}
                                            </h4>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {m.role}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Deliverables Completed</span>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-slate-800 dark:bg-slate-300 rounded-full"
                                                    style={{ width: `${tasks.length > 0 ? (m.contributionCount / tasks.length) * 100 : 0}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
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
        </div>
    )
}

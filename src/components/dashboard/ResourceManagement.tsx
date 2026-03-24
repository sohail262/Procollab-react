// src/components/dashboard/ResourceManagement.tsx
import { useState, useEffect, useMemo } from 'react'
import {
    Card, CardContent, CardHeader,
    CardTitle, CardDescription,
} from '@/components/ui/card'
import { Progress }  from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge }     from '@/components/ui/badge'
import { Button }    from '@/components/ui/button'
import { Input }     from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Select, SelectContent,
    SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
    Tooltip, TooltipContent,
    TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
    BarChart, Bar, XAxis, YAxis,
    Tooltip as ReTooltip, ResponsiveContainer,
    Cell, RadarChart, Radar,
    PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    Legend, LineChart, Line,
} from 'recharts'
import {
    collection, query, onSnapshot,
    doc, getDoc, updateDoc,
    serverTimestamp,
} from 'firebase/firestore'
import { db }        from '@/lib/firebase'
import { useParams } from 'react-router-dom'
import { useAuth }   from '@/hooks/use-auth'
import { useToast }  from '@/hooks/use-toast'
import { useProjectRole } from '@/hooks/use-project-role'
import {
    Users, BarChart3, CheckCircle2,
    AlertTriangle, Search, Filter,
    ChevronDown, ChevronUp, Crown,
    Shield, User as UserIcon, BookOpen,
    Zap, Flame, Sparkles,
    TrendingUp, Target, Activity,
    Circle, Star, Award, ArrowRight,
    Tag,
} from 'lucide-react'
import { format, formatDistanceToNow, differenceInDays } from 'date-fns'
import type { Task } from '@/types/project'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeamMemberRole {
    role:     string
    joinedAt?: any
    skills?:  string[]
}

interface UserProfile {
    uid:         string
    displayName: string
    email:       string
    photoURL:    string
    role:        string
    joinedAt:    any
    skills:      string[]
    discipline:  string
    // computed
    tasks:             Task[]
    totalTasks:        number
    completedTasks:    number
    inProgressTasks:   number
    reviewTasks:       number
    backlogTasks:      number
    todoTasks:         number
    overdueTasks:      number
    completionRate:    number
    // velocity = tasks completed in last 7 days
    velocity:          number
    // contribution score 0-100
    contributionScore: number
    // health: 'healthy' | 'idle' | 'overloaded' | 'blocked'
    health:            'healthy' | 'idle' | 'overloaded' | 'blocked'
    // recent activity: last task update
    lastActiveAt:      Date | null
    // skill match: % of open tasks whose tags match member skills
    skillMatchPct:     number
    // streak: consecutive days with at least one task completed
    streak:            number
}

const ROLE_CONFIG: Record<string, {
    label: string; icon: any; color: string; badgeVariant: any
}> = {
    'Project Lead': {
        label: 'Project Lead', icon: Crown,
        color: 'text-yellow-500', badgeVariant: 'default',
    },
    'Admin': {
        label: 'Admin', icon: Shield,
        color: 'text-blue-500', badgeVariant: 'secondary',
    },
    'Member': {
        label: 'Member', icon: UserIcon,
        color: 'text-gray-500', badgeVariant: 'outline',
    },
    'Viewer': {
        label: 'Viewer', icon: BookOpen,
        color: 'text-purple-400', badgeVariant: 'outline',
    },
}

const STATUS_COLORS: Record<string, string> = {
    backlog:       '#94a3b8',
    todo:          '#64748b',
    'in-progress': '#3b82f6',
    review:        '#a855f7',
    done:          '#22c55e',
}

const PRIORITY_COLORS: Record<string, string> = {
    low:    '#22c55e',
    medium: '#3b82f6',
    high:   '#f97316',
    urgent: '#ef4444',
}

const HEALTH_CONFIG = {
    healthy:    { label: 'Healthy',    color: 'text-green-500',  bg: 'bg-green-100 dark:bg-green-900/20',  border: 'border-green-200',  icon: CheckCircle2 },
    idle:       { label: 'Idle',       color: 'text-gray-400',   bg: 'bg-gray-100 dark:bg-gray-800/40',    border: 'border-gray-200',   icon: Circle       },
    overloaded: { label: 'Overloaded', color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/20',border: 'border-orange-200', icon: Flame        },
    blocked:    { label: 'Blocked',    color: 'text-red-500',    bg: 'bg-red-100 dark:bg-red-900/20',      border: 'border-red-200',    icon: AlertTriangle},
}

// ─── Safe Timestamp → Date ────────────────────────────────────────────────────
const toDate = (val: any): Date | null => {
    if (!val) return null
    if (val instanceof Date) return val
    if (typeof val.toDate === 'function') return val.toDate()
    const d = new Date(val)
    return isNaN(d.getTime()) ? null : d
}

// ─── Compute contribution score (0–100) ──────────────────────────────────────
function computeScore(m: Partial<UserProfile>, totalTasks: number): number {
    if (!totalTasks) return 0
    const donePts       = ((m.completedTasks   ?? 0) / Math.max(totalTasks, 1)) * 40
    const activePts     = Math.min((m.inProgressTasks ?? 0) * 5, 20)
    const velocityPts   = Math.min((m.velocity ?? 0) * 8, 20)
    const skillPts      = ((m.skillMatchPct ?? 0) / 100) * 10
    const streakPts     = Math.min((m.streak ?? 0) * 2, 10)
    return Math.round(Math.min(donePts + activePts + velocityPts + skillPts + streakPts, 100))
}

// ─── Compute member health ────────────────────────────────────────────────────
function computeHealth(m: Partial<UserProfile>): UserProfile['health'] {
    if ((m.overdueTasks ?? 0) >= 2) return 'blocked'
    if ((m.inProgressTasks ?? 0) > 5) return 'overloaded'
    if (!m.lastActiveAt) return 'idle'
    const daysSinceActive = differenceInDays(new Date(), m.lastActiveAt)
    if (daysSinceActive > 5 && (m.completedTasks ?? 0) === 0) return 'idle'
    return 'healthy'
}

// ─── Member Card ──────────────────────────────────────────────────────────────
function MemberCard({
    member, onClick, isCurrentUser,
}: {
    member: UserProfile; onClick: () => void; isCurrentUser: boolean
}) {
    const RoleIcon    = ROLE_CONFIG[member.role]?.icon ?? UserIcon
    const healthConf  = HEALTH_CONFIG[member.health]
    const HealthIcon  = healthConf.icon

    return (
        <Card
            className={`cursor-pointer transition-all duration-200
                hover:shadow-lg hover:-translate-y-1 border-2 ${
                isCurrentUser ? 'border-primary/50' : 'border-transparent'
            } ${healthConf.border}`}
            onClick={onClick}
        >
            <CardContent className="p-4">

                {/* ── Header ── */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="relative">
                            <Avatar className="h-11 w-11 ring-2 ring-offset-2 ring-muted">
                                <AvatarImage src={member.photoURL} />
                                <AvatarFallback className="text-sm font-bold">
                                    {(member.displayName || '?').charAt(0).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            {isCurrentUser && (
                                <span className="absolute -bottom-1 -right-1
                                    bg-primary text-primary-foreground
                                    text-[9px] rounded-full px-1 font-bold leading-4">
                                    You
                                </span>
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="font-semibold text-sm truncate max-w-[130px]">
                                {member.displayName}
                            </p>
                            <div className="flex items-center gap-1 mt-0.5">
                                <RoleIcon className={`h-3 w-3 ${
                                    ROLE_CONFIG[member.role]?.color
                                }`} />
                                <span className="text-xs text-muted-foreground">
                                    {member.role}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Health badge */}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className={`flex items-center gap-1 px-2 py-1
                                    rounded-full text-xs font-medium ${healthConf.bg}
                                    ${healthConf.color}`}>
                                    <HealthIcon className="h-3 w-3" />
                                    {healthConf.label}
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>
                                    {member.health === 'blocked'
                                        ? `${member.overdueTasks} overdue tasks need attention`
                                        : member.health === 'overloaded'
                                        ? `${member.inProgressTasks} tasks in progress`
                                        : member.health === 'idle'
                                        ? 'No recent activity detected'
                                        : 'Member is on track'}
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>

                {/* ── Task stats ── */}
                <div className="grid grid-cols-4 gap-1.5 mb-3">
                    {[
                        { label: 'Total',    value: member.totalTasks,     color: 'bg-muted/60' },
                        { label: 'Active',   value: member.inProgressTasks, color: 'bg-blue-100 dark:bg-blue-900/20' },
                        { label: 'Review',   value: member.reviewTasks,     color: 'bg-purple-100 dark:bg-purple-900/20' },
                        { label: 'Done',     value: member.completedTasks,  color: 'bg-green-100 dark:bg-green-900/20' },
                    ].map(s => (
                        <div key={s.label}
                            className={`${s.color} rounded-lg p-1.5 text-center`}>
                            <p className="text-sm font-bold">{s.value}</p>
                            <p className="text-[10px] text-muted-foreground">
                                {s.label}
                            </p>
                        </div>
                    ))}
                </div>

                {/* ── Completion progress ── */}
                <div className="space-y-1 mb-3">
                    <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Completion</span>
                        <span className="font-medium">{member.completionRate}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${member.completionRate}%` }}
                        />
                    </div>
                </div>

                {/* ── Velocity + streak + score ── */}
                <div className="flex items-center gap-2 text-xs">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex items-center gap-1
                                    bg-muted/60 rounded px-2 py-1">
                                    <Zap className="h-3 w-3 text-yellow-500" />
                                    <span className="font-medium">
                                        {member.velocity}/7d
                                    </span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Tasks completed in last 7 days</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    {member.streak > 0 && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1
                                        bg-orange-100 dark:bg-orange-900/20
                                        rounded px-2 py-1">
                                        <Flame className="h-3 w-3 text-orange-500" />
                                        <span className="font-medium text-orange-600
                                            dark:text-orange-400">
                                            {member.streak}d
                                        </span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{member.streak}-day activity streak</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}

                    <div className="ml-auto flex items-center gap-1">
                        <Star className="h-3 w-3 text-amber-400" />
                        <span className="font-semibold text-sm">
                            {member.contributionScore}
                        </span>
                    </div>
                </div>

                {/* ── Skill match ── */}
                {member.skillMatchPct > 0 && (
                    <div className="mt-2 flex items-center gap-2 text-xs
                        text-muted-foreground">
                        <Tag className="h-3 w-3" />
                        <span>
                            {member.skillMatchPct}% skill match with open tasks
                        </span>
                    </div>
                )}

                {/* ── Skills ── */}
                {member.skills?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                        {member.skills.slice(0, 3).map(s => (
                            <Badge key={s} variant="secondary"
                                className="text-[10px] h-4 px-1.5">
                                {s}
                            </Badge>
                        ))}
                        {member.skills.length > 3 && (
                            <Badge variant="outline"
                                className="text-[10px] h-4 px-1.5">
                                +{member.skills.length - 3}
                            </Badge>
                        )}
                    </div>
                )}

                {/* ── Last active ── */}
                {member.lastActiveAt && (
                    <p className="mt-2 text-[10px] text-muted-foreground">
                        Active{' '}
                        {formatDistanceToNow(member.lastActiveAt, { addSuffix: true })}
                    </p>
                )}
            </CardContent>
        </Card>
    )
}

// ─── Member Detail Dialog ─────────────────────────────────────────────────────
function MemberDetailDialog({
    member, tasks, open, onClose,
    canEditRoles, projectId, onRoleChange,
}: {
    member:         UserProfile | null
    tasks:          Task[]
    open:           boolean
    onClose:        () => void
    /** Only the project owner may change member roles */
    canEditRoles:   boolean
    projectId:      string
    onRoleChange:   (uid: string, role: string) => void
}) {
    const [activeTab, setActiveTab] = useState('overview')

    if (!member) return null

    const RoleIcon = ROLE_CONFIG[member.role]?.icon ?? UserIcon

    // Radar data
    const radarData = [
        { subject: 'Done',     A: member.completedTasks  },
        { subject: 'Active',   A: member.inProgressTasks },
        { subject: 'Review',   A: member.reviewTasks     },
        { subject: 'Todo',     A: member.todoTasks       },
        { subject: 'Backlog',  A: member.backlogTasks    },
    ]

    // Priority breakdown
    const priorityData = ['urgent','high','medium','low'].map(p => ({
        name:  p.charAt(0).toUpperCase() + p.slice(1),
        value: member.tasks.filter(t => t.priority === p).length,
        color: PRIORITY_COLORS[p],
    })).filter(d => d.value > 0)

    // Activity timeline: group completed tasks by date
    const activityByDate = member.tasks
        .filter(t => t.status === 'done' && (t as any).updatedAt)
        .reduce((acc, t) => {
            const d = toDate((t as any).updatedAt)
            if (!d) return acc
            const key = format(d, 'MMM d')
            acc[key] = (acc[key] ?? 0) + 1
            return acc
        }, {} as Record<string, number>)

    const activityChartData = Object.entries(activityByDate)
        .map(([date, count]) => ({ date, count }))
        .slice(-10)

    // Skill match details
    const openTasks = tasks.filter(t =>
        t.assignee?.id === member.uid &&
        t.status !== 'done'
    )
    const matchedSkills = member.skills.filter(skill =>
        openTasks.some(t => (t.tags ?? []).some(tag =>
            tag.toLowerCase().includes(skill.toLowerCase())
        ))
    )

    // Score breakdown
    const scoreBreakdown = [
        {
            label: 'Completion',
            value: Math.min(Math.round((member.completedTasks / Math.max(member.totalTasks, 1)) * 40), 40),
            max:   40,
            color: '#22c55e',
        },
        {
            label: 'Activity',
            value: Math.min(member.inProgressTasks * 5, 20),
            max:   20,
            color: '#3b82f6',
        },
        {
            label: 'Velocity',
            value: Math.min(member.velocity * 8, 20),
            max:   20,
            color: '#f59e0b',
        },
        {
            label: 'Skill Match',
            value: Math.round((member.skillMatchPct / 100) * 10),
            max:   10,
            color: '#a855f7',
        },
        {
            label: 'Streak',
            value: Math.min(member.streak * 2, 10),
            max:   10,
            color: '#f97316',
        },
    ]

    const healthConf = HEALTH_CONFIG[member.health]
    const HealthIcon = healthConf.icon

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col
                p-0 gap-0 overflow-hidden">

                {/* ── Profile header ── */}
                <div className="p-5 border-b flex-shrink-0">
                    <div className="flex items-start gap-4">
                        <Avatar className="h-16 w-16 ring-2 ring-primary/20 ring-offset-2">
                            <AvatarImage src={member.photoURL} />
                            <AvatarFallback className="text-xl font-bold">
                                {member.displayName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                            <DialogTitle className="text-xl">
                                {member.displayName}
                            </DialogTitle>
                            <DialogDescription>{member.email}</DialogDescription>

                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                {/* Role selector */}
                                <div className="flex items-center gap-1.5">
                                    <RoleIcon className={`h-4 w-4 ${
                                        ROLE_CONFIG[member.role]?.color
                                    }`} />
                                    {canEditRoles ? (
                                        <Select
                                            value={member.role}
                                            onValueChange={v =>
                                                onRoleChange(member.uid, v)
                                            }
                                        >
                                            <SelectTrigger className="h-7 w-[140px] text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.keys(ROLE_CONFIG).map(r => (
                                                    <SelectItem key={r} value={r}>
                                                        {r}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <Badge variant={ROLE_CONFIG[member.role]?.badgeVariant}>
                                            {member.role}
                                        </Badge>
                                    )}
                                </div>

                                {/* Health */}
                                <div className={`flex items-center gap-1 px-2 py-0.5
                                    rounded-full text-xs font-medium ${healthConf.bg}
                                    ${healthConf.color}`}>
                                    <HealthIcon className="h-3 w-3" />
                                    {healthConf.label}
                                </div>

                                {member.discipline && (
                                    <Badge variant="outline" className="text-xs">
                                        {member.discipline}
                                    </Badge>
                                )}
                            </div>
                        </div>

                        {/* Contribution score */}
                        <div className="flex flex-col items-center bg-muted/50
                            rounded-xl px-4 py-3 border shrink-0">
                            <Star className="h-5 w-5 text-amber-400 mb-1" />
                            <p className="text-2xl font-bold">
                                {member.contributionScore}
                            </p>
                            <p className="text-xs text-muted-foreground">Score</p>
                        </div>
                    </div>
                </div>

                {/* ── Tabs ── */}
                <Tabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                    className="flex-1 flex flex-col min-h-0"
                >
                    <TabsList className="mx-5 mt-3 w-auto justify-start
                        flex-shrink-0">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="tasks">
                            Tasks ({member.totalTasks})
                        </TabsTrigger>
                        <TabsTrigger value="skills">Skills & Match</TabsTrigger>
                        <TabsTrigger value="score">Score</TabsTrigger>
                    </TabsList>

                    <div className="flex-1 overflow-y-auto p-5">

                        {/* ── Overview ── */}
                        <TabsContent value="overview" className="mt-0 space-y-4">

                            {/* Stat strip */}
                            <div className="grid grid-cols-4 gap-3">
                                {[
                                    { label: 'Total Tasks',   value: member.totalTasks,      color: 'text-foreground'  },
                                    { label: 'Completed',     value: member.completedTasks,   color: 'text-green-500'   },
                                    { label: '7-day Velocity',value: `${member.velocity}`,    color: 'text-blue-500'    },
                                    { label: 'Active Streak', value: `${member.streak}d`,     color: 'text-orange-500'  },
                                ].map(s => (
                                    <div key={s.label}
                                        className="bg-muted/50 rounded-lg p-3 text-center">
                                        <p className={`text-xl font-bold ${s.color}`}>
                                            {s.value}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {s.label}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            {/* Charts row */}
                            <div className="grid grid-cols-2 gap-4">
                                {/* Task radar */}
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">
                                            Task Breakdown
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="h-[200px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RadarChart data={radarData}>
                                                <PolarGrid />
                                                <PolarAngleAxis
                                                    dataKey="subject"
                                                    tick={{ fontSize: 11 }}
                                                />
                                                <PolarRadiusAxis tickCount={4}
                                                    tick={{ fontSize: 10 }} />
                                                <Radar dataKey="A"
                                                    stroke="#8884d8" fill="#8884d8"
                                                    fillOpacity={0.4} />
                                            </RadarChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>

                                {/* Priority bar */}
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">
                                            By Priority
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="h-[200px]">
                                        {priorityData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={priorityData}>
                                                    <XAxis dataKey="name"
                                                        tick={{ fontSize: 11 }} />
                                                    <YAxis allowDecimals={false}
                                                        tick={{ fontSize: 11 }} />
                                                    <ReTooltip />
                                                    <Bar dataKey="value"
                                                        radius={[4,4,0,0]}>
                                                        {priorityData.map((e, i) => (
                                                            <Cell key={i}
                                                                fill={e.color} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="flex items-center
                                                justify-center h-full
                                                text-muted-foreground text-sm">
                                                No tasks assigned
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Activity sparkline */}
                            {activityChartData.length > 0 && (
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">
                                            Completion Activity
                                        </CardTitle>
                                        <CardDescription className="text-xs">
                                            Tasks completed over time
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="h-[140px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={activityChartData}>
                                                <XAxis dataKey="date"
                                                    tick={{ fontSize: 10 }} />
                                                <YAxis allowDecimals={false}
                                                    tick={{ fontSize: 10 }} />
                                                <ReTooltip />
                                                <Line
                                                    type="monotone"
                                                    dataKey="count"
                                                    stroke="#22c55e"
                                                    strokeWidth={2}
                                                    dot={{ r: 3 }}
                                                    activeDot={{ r: 5 }}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>
                            )}
                        </TabsContent>

                        {/* ── Tasks tab ── */}
                        <TabsContent value="tasks" className="mt-0 space-y-2">
                            {/* Filter strip */}
                            <div className="flex flex-wrap gap-1.5 mb-3">
                                {['all','in-progress','review','todo','done','backlog'].map(s => (
                                    <Badge
                                        key={s}
                                        variant="outline"
                                        className="cursor-pointer capitalize text-xs"
                                        style={s !== 'all' ? {
                                            borderColor: STATUS_COLORS[s] + '80',
                                            color:       STATUS_COLORS[s],
                                        } : {}}
                                    >
                                        {s === 'all'
                                            ? `All (${member.totalTasks})`
                                            : `${s.replace('-',' ')} (${
                                                member.tasks.filter(t => t.status === s).length
                                            })`
                                        }
                                    </Badge>
                                ))}
                            </div>

                            {member.tasks.length === 0 ? (
                                <div className="text-center py-10
                                    text-muted-foreground text-sm">
                                    No tasks assigned yet.
                                </div>
                            ) : (
                                member.tasks.map(task => {
                                    const isOverdue = task.dueDate &&
                                        new Date() > (toDate(task.dueDate) ?? new Date()) &&
                                        task.status !== 'done'

                                    return (
                                        <div key={task.id}
                                            className={`border rounded-lg p-3
                                                flex items-start gap-3 ${
                                                isOverdue
                                                    ? 'border-destructive/40 bg-destructive/5'
                                                    : task.status === 'done'
                                                    ? 'opacity-60'
                                                    : ''
                                            }`}
                                        >
                                            <div
                                                className="w-2 h-2 rounded-full
                                                    mt-2 shrink-0"
                                                style={{
                                                    backgroundColor:
                                                        STATUS_COLORS[task.status] ?? '#94a3b8',
                                                }}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start
                                                    justify-between gap-2">
                                                    <p className={`text-sm font-medium
                                                        leading-tight ${
                                                        task.status === 'done'
                                                            ? 'line-through text-muted-foreground'
                                                            : ''
                                                    }`}>
                                                        {task.title}
                                                    </p>
                                                    <div className="flex items-center
                                                        gap-1.5 shrink-0">
                                                        {isOverdue && (
                                                            <Badge variant="destructive"
                                                                className="text-xs h-5">
                                                                Overdue
                                                            </Badge>
                                                        )}
                                                        <span
                                                            className="text-xs px-1.5
                                                                py-0.5 rounded font-medium"
                                                            style={{
                                                                backgroundColor:
                                                                    PRIORITY_COLORS[task.priority ?? 'medium'] + '20',
                                                                color:
                                                                    PRIORITY_COLORS[task.priority ?? 'medium'],
                                                            }}
                                                        >
                                                            {task.priority}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center
                                                    gap-3 mt-1 text-xs
                                                    text-muted-foreground">
                                                    <span
                                                        className="capitalize px-1.5
                                                            py-0.5 rounded text-xs font-medium"
                                                        style={{
                                                            backgroundColor:
                                                                STATUS_COLORS[task.status] + '20',
                                                            color: STATUS_COLORS[task.status],
                                                        }}
                                                    >
                                                        {task.status?.replace('-', ' ')}
                                                    </span>
                                                    {task.dueDate && (
                                                        <span>
                                                            Due{' '}
                                                            {format(
                                                                toDate(task.dueDate) ?? new Date(),
                                                                'MMM d'
                                                            )}
                                                        </span>
                                                    )}
                                                    {(task.tags ?? []).length > 0 && (
                                                        <div className="flex gap-1 flex-wrap">
                                                            {(task.tags ?? []).slice(0, 2).map(tag => (
                                                                <span key={tag}
                                                                    className="bg-muted
                                                                        px-1.5 py-0.5 rounded
                                                                        text-[10px]">
                                                                    {tag}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </TabsContent>

                        {/* ── Skills & Match ── */}
                        <TabsContent value="skills" className="mt-0 space-y-4">
                            {/* All skills */}
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">
                                        Skills
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        From user profile
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {member.skills.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {member.skills.map(skill => {
                                                const isMatched =
                                                    matchedSkills.includes(skill)
                                                return (
                                                    <Badge
                                                        key={skill}
                                                        variant={isMatched
                                                            ? 'default'
                                                            : 'secondary'}
                                                        className={`text-sm ${
                                                            isMatched
                                                                ? 'bg-green-600 hover:bg-green-700'
                                                                : ''
                                                        }`}
                                                    >
                                                        {isMatched && (
                                                            <CheckCircle2 className="h-3 w-3 mr-1" />
                                                        )}
                                                        {skill}
                                                    </Badge>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">
                                            No skills added to profile yet.
                                        </p>
                                    )}
                                    {matchedSkills.length > 0 && (
                                        <p className="text-xs text-green-600
                                            dark:text-green-400 mt-3 flex
                                            items-center gap-1">
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                            {matchedSkills.length} skill(s) directly
                                            match open task requirements
                                        </p>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Open tasks needing their skills */}
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">
                                        Best-Match Open Tasks
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        Unassigned tasks matching this member's skills
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {(() => {
                                        const unassigned = tasks.filter(t =>
                                            !t.assignee?.id &&
                                            t.status !== 'done' &&
                                            (t.tags ?? []).some(tag =>
                                                member.skills.some(s =>
                                                    s.toLowerCase().includes(
                                                        tag.toLowerCase()
                                                    )
                                                )
                                            )
                                        )
                                        if (unassigned.length === 0) {
                                            return (
                                                <p className="text-sm
                                                    text-muted-foreground">
                                                    No unassigned tasks match
                                                    this member's skills.
                                                </p>
                                            )
                                        }
                                        return unassigned.slice(0,5).map(task => (
                                            <div key={task.id}
                                                className="flex items-center
                                                    gap-3 border rounded-lg p-2.5">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm
                                                        font-medium truncate">
                                                        {task.title}
                                                    </p>
                                                    <div className="flex gap-1 mt-1">
                                                        {(task.tags ?? [])
                                                            .filter(tag =>
                                                                member.skills.some(s =>
                                                                    s.toLowerCase()
                                                                        .includes(tag.toLowerCase())
                                                                )
                                                            )
                                                            .map(tag => (
                                                                <Badge key={tag}
                                                                    className="text-[10px]
                                                                        h-4 bg-green-100
                                                                        text-green-700
                                                                        hover:bg-green-200">
                                                                    {tag}
                                                                </Badge>
                                                            ))
                                                        }
                                                    </div>
                                                </div>
                                                <ArrowRight className="h-4 w-4
                                                    text-muted-foreground shrink-0" />
                                            </div>
                                        ))
                                    })()}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* ── Score breakdown ── */}
                        <TabsContent value="score" className="mt-0 space-y-4">
                            <div className="text-center py-3">
                                <div className="inline-flex items-center justify-center
                                    w-20 h-20 rounded-full bg-amber-100
                                    dark:bg-amber-900/30 mb-3">
                                    <span className="text-3xl font-bold text-amber-600">
                                        {member.contributionScore}
                                    </span>
                                </div>
                                <p className="font-semibold text-lg">
                                    Contribution Score
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    Based on task completion, activity, velocity,
                                    skill match & streaks
                                </p>
                            </div>

                            <div className="space-y-3">
                                {scoreBreakdown.map(s => (
                                    <div key={s.label}>
                                        <div className="flex justify-between
                                            text-sm mb-1">
                                            <span className="font-medium">
                                                {s.label}
                                            </span>
                                            <span className="text-muted-foreground">
                                                {s.value} / {s.max} pts
                                            </span>
                                        </div>
                                        <div className="h-2.5 bg-muted rounded-full
                                            overflow-hidden">
                                            <div
                                                className="h-full rounded-full
                                                    transition-all duration-700"
                                                style={{
                                                    width: `${(s.value / s.max) * 100}%`,
                                                    backgroundColor: s.color,
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-muted/40 rounded-xl p-4 text-sm
                                space-y-1.5">
                                <p className="font-semibold mb-2">
                                    How to improve score:
                                </p>
                                {member.completedTasks === 0 && (
                                    <p className="text-muted-foreground flex
                                        items-center gap-2">
                                        <CheckCircle2 className="h-3.5 w-3.5
                                            text-green-500" />
                                        Complete at least one task
                                    </p>
                                )}
                                {member.velocity === 0 && (
                                    <p className="text-muted-foreground flex
                                        items-center gap-2">
                                        <Zap className="h-3.5 w-3.5 text-yellow-500" />
                                        Complete tasks this week for velocity points
                                    </p>
                                )}
                                {member.streak === 0 && (
                                    <p className="text-muted-foreground flex
                                        items-center gap-2">
                                        <Flame className="h-3.5 w-3.5 text-orange-500" />
                                        Stay active daily to build a streak
                                    </p>
                                )}
                                {member.skillMatchPct < 50 && (
                                    <p className="text-muted-foreground flex
                                        items-center gap-2">
                                        <Tag className="h-3.5 w-3.5 text-purple-500" />
                                        Update your profile skills for better matching
                                    </p>
                                )}
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface ResourceManagementProps {
    readOnly?: boolean
}

export function ResourceManagement({ readOnly = false }: ResourceManagementProps) {
    const { id: projectId } = useParams()
    const { user }          = useAuth()
    const { toast }         = useToast()
    const { role: myProjectRole } = useProjectRole()
    const canEditRoles = myProjectRole === 'owner' && !readOnly

    const [tasks,       setTasks]       = useState<Task[]>([])
    const [rawMembers,  setRawMembers]  = useState<Record<string, any>>({})
    const [profiles,    setProfiles]    = useState<Record<string, any>>({})
    const [loading,     setLoading]     = useState(true)
    const [activeView,  setActiveView]  = useState('grid')
    const [searchQuery, setSearchQuery] = useState('')
    const [sortBy,      setSortBy]      = useState<
        'name'|'tasks'|'score'|'velocity'|'completion'
    >('score')
    const [sortAsc,     setSortAsc]     = useState(false)
    const [filterRole,  setFilterRole]  = useState('all')
    const [filterHealth,setFilterHealth]= useState('all')
    const [selectedMember, setSelectedMember] = useState<UserProfile | null>(null)

    // ── Listeners ─────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!projectId || !user) return

        // Project doc → team members
        const projUnsub = onSnapshot(
            doc(db, 'projects', projectId),
            async snap => {
                if (!snap.exists()) { setLoading(false); return }
                const members = snap.data().teamMembers ?? {}
                setRawMembers(members)

                // Fetch user profiles
                const profileMap: Record<string, any> = {}
                await Promise.all(
                    Object.keys(members).map(async uid => {
                        try {
                            const uSnap = await getDoc(doc(db, 'users', uid))
                            profileMap[uid] = uSnap.exists()
                                ? { uid, ...uSnap.data() }
                                : { uid, displayName: 'Unknown', email: '', photoURL: '', skills: [] }
                        } catch {
                            profileMap[uid] = { uid, displayName: 'Unknown', email: '', photoURL: '', skills: [] }
                        }
                    })
                )
                setProfiles(profileMap)
                setLoading(false)
            },
            err => { console.error('Team listener:', err); setLoading(false) }
        )

        // Tasks
        const tasksUnsub = onSnapshot(
            query(collection(db, 'projects', projectId, 'tasks')),
            snap => setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)))
        )

        return () => { projUnsub(); tasksUnsub() }
    }, [projectId, user])

    // ── Build enriched profiles ───────────────────────────────────────────────
    const members: UserProfile[] = useMemo(() => {
        const now    = new Date()
        const week   = 7 * 24 * 60 * 60 * 1000
        const openTasks = tasks.filter(t => t.status !== 'done')

        return Object.entries(rawMembers).map(([uid, memberData]) => {
            const profile      = profiles[uid] ?? {}
            const memberTasks  = tasks.filter(t => t.assignee?.id === uid)

            const completedTasks  = memberTasks.filter(t => t.status === 'done').length
            const inProgressTasks = memberTasks.filter(t => t.status === 'in-progress').length
            const reviewTasks     = memberTasks.filter(t => t.status === 'review').length
            const backlogTasks    = memberTasks.filter(t => t.status === 'backlog').length
            const todoTasks       = memberTasks.filter(t => t.status === 'todo').length
            const overdueTasks    = memberTasks.filter(t =>
                t.dueDate &&
                now > (toDate(t.dueDate) ?? now) &&
                t.status !== 'done'
            ).length

            // Velocity: tasks completed in last 7 days
            const velocity = memberTasks.filter(t => {
                if (t.status !== 'done') return false
                const updated = toDate((t as any).updatedAt)
                return updated && now.getTime() - updated.getTime() < week
            }).length

            // Streak: count consecutive days with activity
            const doneByDay = memberTasks
                .filter(t => t.status === 'done' && (t as any).updatedAt)
                .map(t => {
                    const d = toDate((t as any).updatedAt)
                    return d ? format(d, 'yyyy-MM-dd') : null
                })
                .filter(Boolean) as string[]

            let streak = 0
            let checkDate = new Date()
            while (true) {
                const dateStr = format(checkDate, 'yyyy-MM-dd')
                if (!doneByDay.includes(dateStr)) break
                streak++
                checkDate.setDate(checkDate.getDate() - 1)
            }

            // Last active
            const lastActiveAt = memberTasks
                .map(t => toDate((t as any).updatedAt))
                .filter(Boolean)
                .sort((a, b) => (b?.getTime() ?? 0) - (a?.getTime() ?? 0))[0] ?? null

            // Skills
            const rawSkills = profile.skills
            const skills: string[] = Array.isArray(rawSkills)
                ? rawSkills
                : rawSkills
                ? [
                    ...(rawSkills.technical ?? []),
                    ...(rawSkills.soft      ?? []),
                    ...(rawSkills.tools     ?? []),
                  ]
                : []

            // Skill match % against open tasks
            const skillMatchPct = skills.length > 0 && openTasks.length > 0
                ? Math.round(
                    (openTasks.filter(t =>
                        (t.tags ?? []).some(tag =>
                            skills.some(s =>
                                s.toLowerCase().includes(tag.toLowerCase())
                            )
                        )
                    ).length / openTasks.length) * 100
                  )
                : 0

            const completionRate = memberTasks.length > 0
                ? Math.round((completedTasks / memberTasks.length) * 100)
                : 0

            const role = typeof memberData === 'string'
                ? memberData
                : memberData?.role ?? 'Member'

            const partial = {
                completedTasks, inProgressTasks, velocity,
                streak, skillMatchPct, totalTasks: memberTasks.length,
            }

            const contributionScore = computeScore(partial, tasks.length)
            const health            = computeHealth({
                ...partial, overdueTasks, lastActiveAt,
            })

            return {
                uid,
                displayName: profile.displayName ?? profile.name ?? 'Unknown',
                email:       profile.email    ?? '',
                photoURL:    profile.photoURL ?? profile.avatar ?? '',
                role,
                joinedAt:    typeof memberData === 'object' ? memberData?.joinedAt : null,
                skills,
                discipline:  profile.discipline ?? '',
                tasks:       memberTasks,
                totalTasks:  memberTasks.length,
                completedTasks,
                inProgressTasks,
                reviewTasks,
                backlogTasks,
                todoTasks,
                overdueTasks,
                completionRate,
                velocity,
                streak,
                lastActiveAt,
                skillMatchPct,
                contributionScore,
                health,
            } as UserProfile
        })
    }, [rawMembers, profiles, tasks])

    // ── Filtered + sorted ─────────────────────────────────────────────────────
    const filteredMembers = useMemo(() => {
        let list = members.filter(m => {
            const matchSearch =
                m.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                m.skills.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
            const matchRole   = filterRole   === 'all' || m.role   === filterRole
            const matchHealth = filterHealth === 'all' || m.health === filterHealth
            return matchSearch && matchRole && matchHealth
        })
        list.sort((a, b) => {
            let cmp = 0
            switch (sortBy) {
                case 'name':       cmp = a.displayName.localeCompare(b.displayName); break
                case 'tasks':      cmp = a.totalTasks - b.totalTasks;                break
                case 'score':      cmp = a.contributionScore - b.contributionScore;  break
                case 'velocity':   cmp = a.velocity - b.velocity;                   break
                case 'completion': cmp = a.completionRate - b.completionRate;        break
            }
            return sortAsc ? cmp : -cmp
        })
        return list
    }, [members, searchQuery, filterRole, filterHealth, sortBy, sortAsc])

    // ── Team aggregate stats ──────────────────────────────────────────────────
    const stats = useMemo(() => {
        const total       = members.length
        const totalTasks  = tasks.length
        const doneTasks   = tasks.filter(t => t.status === 'done').length
        const overdue     = tasks.filter(t =>
            t.dueDate &&
            new Date() > (toDate(t.dueDate) ?? new Date()) &&
            t.status !== 'done'
        ).length
        const avgScore    = members.length > 0
            ? Math.round(
                members.reduce((s, m) => s + m.contributionScore, 0) / members.length
              )
            : 0
        const topPerformer = [...members].sort(
            (a, b) => b.contributionScore - a.contributionScore
        )[0]
        const blocked = members.filter(m => m.health === 'blocked').length
        const idle    = members.filter(m => m.health === 'idle').length
        const unassigned = tasks.filter(t => !t.assignee?.id && t.status !== 'done').length

        return {
            total, totalTasks, doneTasks,
            overdue, avgScore, topPerformer,
            blocked, idle, unassigned,
        }
    }, [members, tasks])

    // ── Role change ───────────────────────────────────────────────────────────
    const handleRoleChange = async (uid: string, newRole: string) => {
        if (!projectId || myProjectRole !== 'owner') return
        try {
            await updateDoc(doc(db, 'projects', projectId), {
                [`teamMembers.${uid}.role`]: newRole,
                updatedAt: serverTimestamp(),
            })
            toast({ title: 'Role updated' })
            if (selectedMember?.uid === uid)
                setSelectedMember(p => p ? { ...p, role: newRole } : null)
        } catch {
            toast({ title: 'Error', description: 'Could not update role.', variant: 'destructive' })
        }
    }

    // ── Loading skeleton ──────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1,2,3].map(i => <Skeleton key={i} className="h-56" />)}
                </div>
            </div>
        )
    }

    // ── Chart data ────────────────────────────────────────────────────────────
    const chartData = filteredMembers.map(m => ({
        name:       m.displayName.split(' ')[0],
        fullName:   m.displayName,
        tasks:      m.totalTasks,
        done:       m.completedTasks,
        velocity:   m.velocity,
        score:      m.contributionScore,
        completion: m.completionRate,
    }))

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <TooltipProvider>
        <div className="space-y-5">

            {/* ── Top Stats ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    {
                        label: 'Team Members',
                        value: stats.total,
                        sub:   `${stats.idle} idle · ${stats.blocked} blocked`,
                        icon:  Users,
                        color: 'text-blue-500',
                        bg:    'bg-blue-50 dark:bg-blue-900/20',
                    },
                    {
                        label: 'Tasks Done',
                        value: `${stats.doneTasks}/${stats.totalTasks}`,
                        sub:   `${stats.unassigned} unassigned`,
                        icon:  CheckCircle2,
                        color: 'text-green-500',
                        bg:    'bg-green-50 dark:bg-green-900/20',
                    },
                    {
                        label: 'Avg Score',
                        value: stats.avgScore,
                        sub:   'Contribution score',
                        icon:  Star,
                        color: 'text-amber-500',
                        bg:    'bg-amber-50 dark:bg-amber-900/20',
                    },
                    {
                        label: 'Top Performer',
                        value: stats.topPerformer?.displayName.split(' ')[0] ?? '—',
                        sub:   stats.topPerformer
                            ? `Score: ${stats.topPerformer.contributionScore}`
                            : 'No data yet',
                        icon:  Award,
                        color: 'text-purple-500',
                        bg:    'bg-purple-50 dark:bg-purple-900/20',
                    },
                ].map(s => (
                    <Card key={s.label} className={`border-none ${s.bg}`}>
                        <CardContent className="pt-4 pb-3 flex items-start gap-3">
                            <div className={`p-2 rounded-lg bg-white/70 dark:bg-black/20 ${s.color}`}>
                                <s.icon className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{s.value}</p>
                                <p className="text-xs font-medium">{s.label}</p>
                                <p className="text-xs text-muted-foreground">{s.sub}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* ── Controls ── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name or skill…"
                        className="pl-9"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>

                <Select value={filterRole} onValueChange={setFilterRole}>
                    <SelectTrigger className="w-[140px]">
                        <Filter className="h-3.5 w-3.5 mr-2" />
                        <SelectValue placeholder="All roles" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        {Object.keys(ROLE_CONFIG).map(r => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={filterHealth} onValueChange={setFilterHealth}>
                    <SelectTrigger className="w-[140px]">
                        <Activity className="h-3.5 w-3.5 mr-2" />
                        <SelectValue placeholder="All health" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Health</SelectItem>
                        {Object.entries(                        HEALTH_CONFIG).map(([key, conf]) => (
                            <SelectItem key={key} value={key}>
                                {conf.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={v => setSortBy(v as any)}>
                    <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Sort by…" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="score">Contribution Score</SelectItem>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="tasks">Task Count</SelectItem>
                        <SelectItem value="velocity">Velocity</SelectItem>
                        <SelectItem value="completion">Completion Rate</SelectItem>
                    </SelectContent>
                </Select>

                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSortAsc(a => !a)}
                    title={sortAsc ? 'Ascending' : 'Descending'}
                >
                    {sortAsc
                        ? <ChevronUp   className="h-4 w-4" />
                        : <ChevronDown className="h-4 w-4" />}
                </Button>

                {/* View toggle */}
                <div className="flex bg-muted rounded-lg p-1 gap-1 ml-auto">
                    {[
                        { val: 'grid',  label: 'Cards'   },
                        { val: 'chart', label: 'Charts'  },
                        { val: 'table', label: 'Table'   },
                    ].map(v => (
                        <button
                            key={v.val}
                            onClick={() => setActiveView(v.val)}
                            className={`px-3 py-1 text-xs rounded-md
                                transition-colors font-medium ${
                                activeView === v.val
                                    ? 'bg-background shadow-sm text-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {v.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Alerts strip ── */}
            {(stats.blocked > 0 || stats.idle > 0 || stats.unassigned > 0) && (
                <div className="flex flex-wrap gap-2">
                    {stats.blocked > 0 && (
                        <div className="flex items-center gap-2 bg-red-50
                            dark:bg-red-900/20 border border-red-200
                            dark:border-red-800 rounded-lg px-3 py-2 text-sm">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            <span className="text-red-700 dark:text-red-400 font-medium">
                                {stats.blocked} member{stats.blocked > 1 ? 's' : ''} blocked
                                — overdue tasks need attention
                            </span>
                        </div>
                    )}
                    {stats.idle > 0 && (
                        <div className="flex items-center gap-2 bg-gray-50
                            dark:bg-gray-800/40 border border-gray-200
                            dark:border-gray-700 rounded-lg px-3 py-2 text-sm">
                            <Circle className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-600 dark:text-gray-400 font-medium">
                                {stats.idle} member{stats.idle > 1 ? 's' : ''} idle
                                — consider assigning tasks
                            </span>
                        </div>
                    )}
                    {stats.unassigned > 0 && (
                        <div className="flex items-center gap-2 bg-blue-50
                            dark:bg-blue-900/20 border border-blue-200
                            dark:border-blue-800 rounded-lg px-3 py-2 text-sm">
                            <Target className="h-4 w-4 text-blue-500" />
                            <span className="text-blue-700 dark:text-blue-400 font-medium">
                                {stats.unassigned} task{stats.unassigned > 1 ? 's' : ''} unassigned
                                — check skill matches to assign
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* ── Empty state ── */}
            {filteredMembers.length === 0 && !loading && (
                <div className="text-center py-16 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p className="font-medium">
                        {members.length === 0
                            ? 'No team members yet'
                            : 'No members match your filters'}
                    </p>
                    <p className="text-sm mt-1">
                        {members.length === 0
                            ? 'Add team members from the project settings.'
                            : 'Try adjusting your search or filters.'}
                    </p>
                </div>
            )}

            {/* ════ VIEW: Cards Grid ════ */}
            {activeView === 'grid' && filteredMembers.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredMembers.map(member => (
                        <MemberCard
                            key={member.uid}
                            member={member}
                            onClick={() => setSelectedMember(member)}
                            isCurrentUser={member.uid === user?.uid}
                        />
                    ))}
                </div>
            )}

            {/* ════ VIEW: Charts ════ */}
            {activeView === 'chart' && filteredMembers.length > 0 && (
                <div className="space-y-4">

                    {/* Contribution scores */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Contribution Scores</CardTitle>
                            <CardDescription>
                                Overall engagement score per member (0–100)
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="h-[280px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}
                                    margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                    <YAxis domain={[0, 100]}
                                        tick={{ fontSize: 12 }} />
                                    <ReTooltip
                                        formatter={(v, _n, p) => [
                                            v, p.payload.fullName,
                                        ]}
                                    />
                                    <Bar dataKey="score"
                                        name="Score"
                                        radius={[4,4,0,0]}>
                                        {chartData.map((entry, i) => (
                                            <Cell
                                                key={i}
                                                fill={
                                                    entry.score >= 70 ? '#22c55e' :
                                                    entry.score >= 40 ? '#f59e0b' :
                                                                        '#ef4444'
                                                }
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        {/* Tasks done vs total */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Tasks: Total vs Done</CardTitle>
                                <CardDescription>
                                    Completed tasks per member
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="h-[260px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData}
                                        layout="vertical"
                                        margin={{ left: 10 }}>
                                        <XAxis type="number"
                                            allowDecimals={false}
                                            tick={{ fontSize: 11 }} />
                                        <YAxis dataKey="name" type="category"
                                            width={80}
                                            tick={{ fontSize: 11 }} />
                                        <ReTooltip />
                                        <Legend />
                                        <Bar dataKey="tasks" name="Total"
                                            fill="#94a3b8"
                                            radius={[0,4,4,0]} />
                                        <Bar dataKey="done"  name="Done"
                                            fill="#22c55e"
                                            radius={[0,4,4,0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        {/* 7-day velocity */}
                        <Card>
                            <CardHeader>
                                <CardTitle>7-Day Velocity</CardTitle>
                                <CardDescription>
                                    Tasks completed in the last 7 days
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="h-[260px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData}
                                        margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                        <YAxis allowDecimals={false}
                                            tick={{ fontSize: 12 }} />
                                        <ReTooltip
                                            formatter={(v, _n, p) => [
                                                `${v} tasks`, p.payload.fullName,
                                            ]}
                                        />
                                        <Bar dataKey="velocity"
                                            name="Tasks / 7d"
                                            fill="#8884d8"
                                            radius={[4,4,0,0]}>
                                            {chartData.map((entry, i) => (
                                                <Cell
                                                    key={i}
                                                    fill={
                                                        entry.velocity >= 3 ? '#22c55e' :
                                                        entry.velocity >= 1 ? '#8884d8' :
                                                                              '#e2e8f0'
                                                    }
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Health overview */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Team Health Overview</CardTitle>
                            <CardDescription>
                                Member status at a glance
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {Object.entries(HEALTH_CONFIG).map(([key, conf]) => {
                                    const count = members.filter(
                                        m => m.health === key
                                    ).length
                                    const Icon = conf.icon
                                    return (
                                        <div key={key}
                                            className={`rounded-xl p-4 text-center
                                                border ${conf.bg} ${conf.border}`}>
                                            <Icon className={`h-6 w-6 mx-auto mb-2 ${conf.color}`} />
                                            <p className={`text-2xl font-bold ${conf.color}`}>
                                                {count}
                                            </p>
                                            <p className="text-sm font-medium mt-1">
                                                {conf.label}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {count === 1 ? 'member' : 'members'}
                                            </p>
                                        </div>
                                    )
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ════ VIEW: Table ════ */}
            {activeView === 'table' && filteredMembers.length > 0 && (
                <Card>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/40">
                                        {[
                                            'Member', 'Role', 'Health',
                                            'Tasks', 'Done', 'Active',
                                            'Overdue', 'Velocity',
                                            'Completion', 'Score',
                                        ].map(h => (
                                            <th key={h}
                                                className="text-left py-3 px-4
                                                    text-xs font-semibold
                                                    text-muted-foreground
                                                    whitespace-nowrap">
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredMembers.map((m, i) => {
                                        const RoleIcon =
                                            ROLE_CONFIG[m.role]?.icon ?? UserIcon
                                        const healthConf = HEALTH_CONFIG[m.health]
                                        const HIcon = healthConf.icon
                                        return (
                                            <tr
                                                key={m.uid}
                                                onClick={() => setSelectedMember(m)}
                                                className={`border-b last:border-0
                                                    hover:bg-muted/30 cursor-pointer
                                                    transition-colors ${
                                                    i % 2 === 0 ? '' : 'bg-muted/10'
                                                }`}
                                            >
                                                {/* Member */}
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-7 w-7">
                                                            <AvatarImage src={m.photoURL} />
                                                            <AvatarFallback className="text-xs">
                                                                {m.displayName.charAt(0)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="font-medium
                                                                max-w-[120px] truncate">
                                                                {m.displayName}
                                                            </p>
                                                            {m.uid === user?.uid && (
                                                                <span className="text-[10px]
                                                                    text-primary font-medium">
                                                                    You
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                {/* Role */}
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-1">
                                                        <RoleIcon className={`h-3.5 w-3.5 ${
                                                            ROLE_CONFIG[m.role]?.color
                                                        }`} />
                                                        <span className="text-xs">
                                                            {m.role}
                                                        </span>
                                                    </div>
                                                </td>
                                                {/* Health */}
                                                <td className="py-3 px-4">
                                                    <div className={`flex items-center
                                                        gap-1 px-2 py-0.5 rounded-full
                                                        text-xs font-medium w-fit
                                                        ${healthConf.bg} ${healthConf.color}`}>
                                                        <HIcon className="h-3 w-3" />
                                                        {healthConf.label}
                                                    </div>
                                                </td>
                                                {/* Tasks */}
                                                <td className="py-3 px-4 font-semibold">
                                                    {m.totalTasks}
                                                </td>
                                                {/* Done */}
                                                <td className="py-3 px-4 text-green-600 font-semibold">
                                                    {m.completedTasks}
                                                </td>
                                                {/* Active */}
                                                <td className="py-3 px-4 text-blue-600 font-semibold">
                                                    {m.inProgressTasks}
                                                </td>
                                                {/* Overdue */}
                                                <td className="py-3 px-4">
                                                    {m.overdueTasks > 0 ? (
                                                        <span className="text-destructive
                                                            font-semibold flex items-center gap-1">
                                                            <AlertTriangle className="h-3 w-3" />
                                                            {m.overdueTasks}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </td>
                                                {/* Velocity */}
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-1">
                                                        <Zap className={`h-3.5 w-3.5 ${
                                                            m.velocity >= 3 ? 'text-green-500' :
                                                            m.velocity >= 1 ? 'text-yellow-500' :
                                                                              'text-muted-foreground'
                                                        }`} />
                                                        <span className="font-medium">
                                                            {m.velocity}
                                                        </span>
                                                    </div>
                                                </td>
                                                {/* Completion */}
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-1.5 w-16
                                                            bg-muted rounded-full
                                                            overflow-hidden">
                                                            <div
                                                                className="h-full bg-green-500
                                                                    rounded-full"
                                                                style={{
                                                                    width: `${m.completionRate}%`,
                                                                }}
                                                            />
                                                        </div>
                                                        <span className="text-xs font-medium">
                                                            {m.completionRate}%
                                                        </span>
                                                    </div>
                                                </td>
                                                {/* Score */}
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-1">
                                                        <Star className="h-3.5 w-3.5 text-amber-400" />
                                                        <span className={`font-bold ${
                                                            m.contributionScore >= 70
                                                                ? 'text-green-600' :
                                                            m.contributionScore >= 40
                                                                ? 'text-amber-500' :
                                                                  'text-muted-foreground'
                                                        }`}>
                                                            {m.contributionScore}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Member Detail Dialog ── */}
            <MemberDetailDialog
                member={selectedMember}
                tasks={tasks}
                open={!!selectedMember}
                onClose={() => setSelectedMember(null)}
                canEditRoles={canEditRoles}
                projectId={projectId!}
                onRoleChange={handleRoleChange}
            />
        </div>
        </TooltipProvider>
    )
}
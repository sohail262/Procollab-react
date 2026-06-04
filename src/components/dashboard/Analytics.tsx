// Analytics.tsx — Task-based analytics. No sprint/methodology charts.
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { Task } from '@/types/project'
import {
    collection,
    query,
    onSnapshot,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useParams } from 'react-router-dom'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts'
import { useAuth } from '@/hooks/use-auth'
import { Skeleton } from '@/components/ui/skeleton'
import { isPast } from 'date-fns'
import {
    CheckCircle2, Clock, AlertTriangle, ListTodo,
    TrendingUp, Eye,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toDate(val: any): Date {
    if (!val) return new Date(0)
    if (val instanceof Date) return val
    if (typeof val.toDate === 'function') return val.toDate()
    return new Date(val)
}

// ─── Empty chart placeholder ──────────────────────────────────────────────────
function EmptyChart({ message }: { message: string }) {
    return (
        <div className="flex items-center justify-center h-full
                        text-muted-foreground text-sm text-center px-4">
            {message}
        </div>
    )
}

// ─── Component ────────────────────────────────────────────────────────────────
export function Analytics() {
    const { id: projectId } = useParams()
    const { user } = useAuth()

    const [tasks,   setTasks]   = useState<Task[]>([])
    const [loading, setLoading] = useState(true)

    // ── Tasks real-time listener ─────────────────────────────────────────────
    useEffect(() => {
        if (!projectId || !user) return

        const q = query(collection(db, 'projects', projectId, 'tasks'))
        const unsub = onSnapshot(
            q,
            snap => {
                setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)))
                setLoading(false)
            },
            err => {
                console.error('Analytics tasks listener error:', err)
                setLoading(false)
            }
        )
        return () => unsub()
    }, [projectId, user])

    // ── Derived metrics ──────────────────────────────────────────────────────
    const total      = tasks.length
    const done       = tasks.filter(t => t.status === 'done').length
    const inProgress = tasks.filter(t => t.status === 'in-progress').length
    const inReview   = tasks.filter(t => t.status === 'review').length
    const overdue    = tasks.filter(
        t => t.dueDate && isPast(toDate(t.dueDate)) && t.status !== 'done'
    ).length
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0

    // ── Chart data ───────────────────────────────────────────────────────────
    const statusData = [
        { name: 'Backlog',     value: tasks.filter(t => t.status === 'backlog').length,     color: '#64748b' },
        { name: 'To Do',       value: tasks.filter(t => t.status === 'todo').length,         color: '#3b82f6' },
        { name: 'In Progress', value: tasks.filter(t => t.status === 'in-progress').length,  color: '#f97316' },
        { name: 'Review',      value: tasks.filter(t => t.status === 'review').length,       color: '#a855f7' },
        { name: 'Done',        value: tasks.filter(t => t.status === 'done').length,         color: '#22c55e' },
    ].filter(d => d.value > 0)

    const priorityData = [
        { name: 'Low',    value: tasks.filter(t => t.priority === 'low').length,    fill: '#22c55e' },
        { name: 'Medium', value: tasks.filter(t => t.priority === 'medium').length, fill: '#3b82f6' },
        { name: 'High',   value: tasks.filter(t => t.priority === 'high').length,   fill: '#f97316' },
        { name: 'Urgent', value: tasks.filter(t => t.priority === 'urgent').length, fill: '#ef4444' },
    ].filter(d => d.value > 0)

    // ── Assignee breakdown ───────────────────────────────────────────────────
    const assigneeMap: Record<string, { name: string; total: number; done: number }> = {}
    tasks.forEach(t => {
        const name = t.assignee?.name ?? 'Unassigned'
        if (!assigneeMap[name]) assigneeMap[name] = { name, total: 0, done: 0 }
        assigneeMap[name].total++
        if (t.status === 'done') assigneeMap[name].done++
    })
    const assigneeData = Object.values(assigneeMap)
        .sort((a, b) => b.total - a.total)
        .slice(0, 6)

    // ── Loading skeleton ─────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[1,2,3,4,5,6].map(i => (
                        <Card key={i}>
                            <CardContent className="pt-4">
                                <Skeleton className="h-7 w-16 mb-2" />
                                <Skeleton className="h-3 w-20" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Skeleton className="h-[300px]" />
                    <Skeleton className="h-[300px]" />
                </div>
                <Skeleton className="h-[220px]" />
            </div>
        )
    }

    return (
        <div className="space-y-6">

            {/* ── Summary metric cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                    {
                        label: 'Total Tasks',
                        value: total,
                        icon: <ListTodo className="h-4 w-4" />,
                        color: 'text-foreground',
                        bg:    'bg-muted/40',
                    },
                    {
                        label: 'Completed',
                        value: done,
                        icon: <CheckCircle2 className="h-4 w-4" />,
                        color: 'text-green-600',
                        bg:    'bg-green-50 dark:bg-green-900/20',
                    },
                    {
                        label: 'In Progress',
                        value: inProgress,
                        icon: <TrendingUp className="h-4 w-4" />,
                        color: 'text-orange-600',
                        bg:    'bg-orange-50 dark:bg-orange-900/20',
                    },
                    {
                        label: 'In Review',
                        value: inReview,
                        icon: <Eye className="h-4 w-4" />,
                        color: 'text-purple-600',
                        bg:    'bg-purple-50 dark:bg-purple-900/20',
                    },
                    {
                        label: 'Overdue',
                        value: overdue,
                        icon: <AlertTriangle className="h-4 w-4" />,
                        color: overdue > 0 ? 'text-red-600' : 'text-muted-foreground',
                        bg:    overdue > 0
                            ? 'bg-red-50 dark:bg-red-900/20'
                            : 'bg-muted/40',
                    },
                    {
                        label: 'Completion',
                        value: `${completionRate}%`,
                        icon: <Clock className="h-4 w-4" />,
                        color: 'text-blue-600',
                        bg:    'bg-blue-50 dark:bg-blue-900/20',
                    },
                ].map(({ label, value, icon, color, bg }) => (
                    <Card key={label} className={`border-0 ${bg}`}>
                        <CardContent className="p-4">
                            <div className={`flex items-center gap-1.5 mb-1 ${color} opacity-70`}>
                                {icon}
                                <span className="text-xs font-medium">{label}</span>
                            </div>
                            <div className={`text-2xl font-bold ${color}`}>{value}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* ── Overall progress bar ── */}
            <Card>
                <CardContent className="pt-5 pb-4 px-5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Overall Progress</span>
                        <span className="text-sm font-bold text-green-600">{completionRate}%</span>
                    </div>
                    <Progress value={completionRate} className="h-2.5" />
                    <p className="text-xs text-muted-foreground mt-2">
                        {done} of {total} tasks completed
                    </p>
                </CardContent>
            </Card>

            {/* ── Charts row ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Status Distribution — Pie */}
                <Card>
                    <CardHeader className="p-4 sm:p-6 pb-2">
                        <CardTitle className="text-sm sm:text-base">Task Status Distribution</CardTitle>
                        <CardDescription className="text-xs">Breakdown of all tasks by current status</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[280px] w-full p-2 sm:p-4">
                        {statusData.length === 0 ? (
                            <EmptyChart message="No tasks yet — create some tasks to see the distribution." />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={statusData}
                                        cx="50%"
                                        cy="47%"
                                        outerRadius={90}
                                        dataKey="value"
                                        labelLine={false}
                                        label={({ name, percent }: any) =>
                                            percent > 0.06
                                                ? `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                                                : ''
                                        }
                                    >
                                        {statusData.map((entry, i) => (
                                            <Cell key={i} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(v: any, name: any) => [v + ' tasks', name]}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                {/* Priority Breakdown — Bar */}
                <Card>
                    <CardHeader className="p-4 sm:p-6 pb-2">
                        <CardTitle className="text-sm sm:text-base">Priority Breakdown</CardTitle>
                        <CardDescription className="text-xs">Number of tasks by priority level</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[280px] w-full p-2 sm:p-4">
                        {priorityData.length === 0 ? (
                            <EmptyChart message="No tasks with priorities yet." />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={priorityData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                                    <Tooltip formatter={(v: any) => [v + ' tasks']} />
                                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                        {priorityData.map((entry, i) => (
                                            <Cell key={i} fill={entry.fill} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ── Assignee workload ── */}
            {assigneeData.length > 0 && (
                <Card>
                    <CardHeader className="p-4 sm:p-6 pb-2">
                        <CardTitle className="text-sm sm:text-base">Team Workload</CardTitle>
                        <CardDescription className="text-xs">
                            Tasks assigned to each team member
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6 pt-3">
                        <div className="space-y-3">
                            {assigneeData.map(m => {
                                const pct = m.total > 0
                                    ? Math.round((m.done / m.total) * 100)
                                    : 0
                                return (
                                    <div key={m.name}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-sm font-medium truncate max-w-[160px]">
                                                {m.name}
                                            </span>
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                <span>{m.done}/{m.total} done</span>
                                                <span className="font-semibold text-foreground w-8 text-right">
                                                    {pct}%
                                                </span>
                                            </div>
                                        </div>
                                        <Progress value={pct} className="h-2" />
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
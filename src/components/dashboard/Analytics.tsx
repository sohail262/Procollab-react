// Analytics.tsx
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { Task } from '@/types/project'
import {
    collection,
    query,
    onSnapshot,
    orderBy,
    doc,
    getDoc
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useParams } from 'react-router-dom'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line
} from 'recharts'
import { useAuth } from '@/hooks/use-auth'
import { Skeleton } from '@/components/ui/skeleton'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Sprint {
    id: string
    name: string
    points: number
    completedAt: any // Firestore Timestamp
}

// ─── Component ────────────────────────────────────────────────────────────────
export function Analytics() {
    const { id: projectId } = useParams()
    const { user } = useAuth()

    const [tasks, setTasks] = useState<Task[]>([])
    const [sprints, setSprints] = useState<Sprint[]>([])
    const [loading, setLoading] = useState(true)

    // ── Tasks listener ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!projectId || !user) return

        const q = query(collection(db, 'projects', projectId, 'tasks'))

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                setTasks(
                    snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Task))
                )
                setLoading(false)
            },
            (error) => {
                console.error('Analytics tasks listener error:', error)
                setLoading(false)
            }
        )

        return () => unsubscribe()
    }, [projectId, user])

    // ── Sprints listener (velocity chart) ───────────────────────────────────
    // Firestore path: projects/{projectId}/sprints
    // Each sprint doc: { name: string, points: number, completedAt: Timestamp }
    useEffect(() => {
        if (!projectId || !user) return

        const q = query(
            collection(db, 'projects', projectId, 'sprints'),
            orderBy('completedAt', 'asc')
        )

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const data = snapshot.docs.map(d => ({
                    id: d.id,
                    ...d.data()
                })) as Sprint[]
                setSprints(data)
            },
            (error) => {
                console.error('Analytics sprints listener error:', error)
            }
        )

        return () => unsubscribe()
    }, [projectId, user])

    // ── Data transformations ─────────────────────────────────────────────────
    const statusData = [
        { name: 'Backlog', value: tasks.filter(t => t.status === 'backlog').length },
        { name: 'To Do', value: tasks.filter(t => t.status === 'todo').length },
        { name: 'In Progress', value: tasks.filter(t => t.status === 'in-progress').length },
        { name: 'Review', value: tasks.filter(t => t.status === 'review').length },
        { name: 'Done', value: tasks.filter(t => t.status === 'done').length },
    ].filter(d => d.value > 0)

    const priorityData = [
        { name: 'Low', value: tasks.filter(t => t.priority === 'low').length },
        { name: 'Medium', value: tasks.filter(t => t.priority === 'medium').length },
        { name: 'High', value: tasks.filter(t => t.priority === 'high').length },
        { name: 'Urgent', value: tasks.filter(t => t.priority === 'urgent').length },
    ].filter(d => d.value > 0)

    // Velocity: use real sprint data; fall back to placeholder message
    const velocityData = sprints.map(s => ({ name: s.name, points: s.points }))

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8']

    // ── Summary stats ────────────────────────────────────────────────────────
    const totalTasks = tasks.length
    const completedTasks = tasks.filter(t => t.status === 'done').length
    const completionRate = totalTasks > 0
        ? Math.round((completedTasks / totalTasks) * 100)
        : 0

    // ── Loading skeleton ─────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <Card key={i}>
                            <CardContent className="pt-6">
                                <Skeleton className="h-8 w-24 mb-2" />
                                <Skeleton className="h-4 w-32" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Skeleton className="h-[340px]" />
                    <Skeleton className="h-[340px]" />
                </div>
                <Skeleton className="h-[340px]" />
            </div>
        )
    }

    return (
        <div className="space-y-6">

            {/* ── Summary Cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Tasks
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{totalTasks}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Completed
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-600">{completedTasks}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Completion Rate
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{completionRate}%</div>
                    </CardContent>
                </Card>
            </div>

            {/* ── Charts Row ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Status Distribution */}
                <Card>
                    <CardHeader>
                        <CardTitle>Task Status Distribution</CardTitle>
                        <CardDescription>Overview of task progress</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] w-full min-w-0">
                        {statusData.length === 0 ? (
                            <EmptyChart message="No tasks found" />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={statusData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }: any) =>
                                            `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                                        }
                                        outerRadius={80}
                                        dataKey="value"
                                    >
                                        {statusData.map((_, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={COLORS[index % COLORS.length]}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                {/* Priority Distribution */}
                <Card>
                    <CardHeader>
                        <CardTitle>Task Priority Breakdown</CardTitle>
                        <CardDescription>Tasks by priority level</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] w-full min-w-0">
                        {priorityData.length === 0 ? (
                            <EmptyChart message="No tasks found" />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={priorityData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis allowDecimals={false} />
                                    <Tooltip />
                                    <Bar dataKey="value" fill="#82ca9d">
                                        {priorityData.map((_, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={COLORS[index % COLORS.length]}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ── Velocity Chart ── */}
            <Card>
                <CardHeader>
                    <CardTitle>Team Velocity</CardTitle>
                    <CardDescription>Story points completed per sprint</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] w-full min-w-0">
                    {velocityData.length === 0 ? (
                        <EmptyChart message="No sprint data yet. Complete sprints to see velocity." />
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={velocityData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="points"
                                    stroke="#8884d8"
                                    activeDot={{ r: 8 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function EmptyChart({ message }: { message: string }) {
    return (
        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            {message}
        </div>
    )
}
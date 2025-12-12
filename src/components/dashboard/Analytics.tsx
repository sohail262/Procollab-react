import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

import type { Task } from '@/types/project'
import { collection, query, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useParams } from 'react-router-dom'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line
} from 'recharts'

import { useAuth } from '@/hooks/use-auth'

export function Analytics() {
    const { id: projectId } = useParams()
    const { user } = useAuth()
    const [tasks, setTasks] = useState<Task[]>([])

    useEffect(() => {
        if (!projectId || !user) return

        const q = query(collection(db, 'projects', projectId, 'tasks'))
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)))
        })

        return () => unsubscribe()
    }, [projectId])

    // Data Transformations
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

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8']

    // Mock Velocity Data (since we don't have historical sprint data yet)
    const velocityData = [
        { name: 'Sprint 1', points: 24 },
        { name: 'Sprint 2', points: 32 },
        { name: 'Sprint 3', points: 28 },
        { name: 'Sprint 4', points: 36 },
    ]

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Status Distribution */}
                <Card>
                    <CardHeader>
                        <CardTitle>Task Status Distribution</CardTitle>
                        <CardDescription>Overview of task progress</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] w-full min-w-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={statusData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {statusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Priority Distribution */}
                <Card>
                    <CardHeader>
                        <CardTitle>Task Priority Breakdown</CardTitle>
                        <CardDescription>Tasks by priority level</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] w-full min-w-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={priorityData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="value" fill="#82ca9d">
                                    {priorityData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Velocity Chart */}
            <Card>
                <CardHeader>
                    <CardTitle>Team Velocity</CardTitle>
                    <CardDescription>Story points completed per sprint</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={velocityData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="points" stroke="#8884d8" activeDot={{ r: 8 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    )
}

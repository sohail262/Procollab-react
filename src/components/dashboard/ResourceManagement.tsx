import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import type { Task, Resource } from '@/types/project'
import { collection, query, onSnapshot, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useParams } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

import { useAuth } from '@/hooks/use-auth'

interface ResourceManagementProps {
    readOnly?: boolean
}

export function ResourceManagement({ readOnly: _readOnly = false }: ResourceManagementProps) {
    const { id: projectId } = useParams()
    const { user } = useAuth()
    const [tasks, setTasks] = useState<Task[]>([])
    const [teamMembers, setTeamMembers] = useState<any[]>([]) // Should be typed properly

    useEffect(() => {
        if (!projectId || !user) return

        // Fetch tasks
        const qTasks = query(collection(db, 'projects', projectId, 'tasks'))
        const unsubscribeTasks = onSnapshot(qTasks, (snapshot) => {
            setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)))
        })

        // Fetch project members (mocking this for now as we need a way to get members)
        // In a real app, we'd fetch from the project document's members array
        // For now, let's derive members from task assignees

        return () => unsubscribeTasks()
    }, [projectId, user])

    // Calculate workload per member
    const memberWorkload = tasks.reduce((acc, task) => {
        if (task.assignee?.id) {
            if (!acc[task.assignee.id]) {
                acc[task.assignee.id] = {
                    id: task.assignee.id,
                    name: task.assignee.name,
                    avatar: task.assignee.avatar,
                    tasks: 0,
                    hours: 0,
                    completed: 0
                }
            }
            acc[task.assignee.id].tasks += 1
            acc[task.assignee.id].hours += task.timeEstimate || 0
            if (task.status === 'done') {
                acc[task.assignee.id].completed += 1
            }
        }
        return acc
    }, {} as Record<string, any>)

    const workloadData = Object.values(memberWorkload)

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Workload Distribution Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle>Workload Distribution</CardTitle>
                        <CardDescription>Estimated hours per team member</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] w-full min-w-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={workloadData} layout="vertical" margin={{ left: 20 }}>
                                <XAxis type="number" />
                                <YAxis dataKey="name" type="category" width={100} />
                                <Tooltip />
                                <Bar dataKey="hours" fill="#8884d8" radius={[0, 4, 4, 0]}>
                                    {workloadData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#8884d8' : '#82ca9d'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Team Capacity */}
                <Card>
                    <CardHeader>
                        <CardTitle>Team Capacity</CardTitle>
                        <CardDescription>Current utilization based on active tasks</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {workloadData.map(member => {
                            const capacity = 40 // Assuming 40h weekly capacity
                            const utilization = Math.min(100, (member.hours / capacity) * 100)

                            return (
                                <div key={member.id} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={member.avatar} />
                                                <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="text-sm font-medium">{member.name}</p>
                                                <p className="text-xs text-muted-foreground">{member.tasks} active tasks</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold">{Math.round(utilization)}%</p>
                                            <p className="text-xs text-muted-foreground">{member.hours}h / {capacity}h</p>
                                        </div>
                                    </div>
                                    <Progress value={utilization} className={utilization > 100 ? "bg-red-100" : ""} />
                                </div>
                            )
                        })}
                        {workloadData.length === 0 && (
                            <p className="text-center text-muted-foreground py-8">No active team members found with assigned tasks.</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Detailed Allocation Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Resource Allocation</CardTitle>
                    <CardDescription>Detailed view of task assignments</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {workloadData.map(member => (
                            <div key={member.id} className="border rounded-lg p-4">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={member.avatar} />
                                            <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <h4 className="font-semibold">{member.name}</h4>
                                    </div>
                                    <Badge variant="outline">{member.tasks} Tasks</Badge>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {tasks.filter(t => t.assignee?.id === member.id).map(task => (
                                        <div key={task.id} className="bg-muted/50 p-3 rounded text-sm">
                                            <div className="flex justify-between items-start mb-1">
                                                <p className="font-medium truncate">{task.title}</p>
                                                <Badge className="text-[10px] h-5" variant={task.priority === 'high' ? 'destructive' : 'secondary'}>
                                                    {task.priority}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground mb-2 line-clamp-1">{task.description}</p>
                                            <div className="flex justify-between text-xs text-muted-foreground">
                                                <span>{task.status}</span>
                                                <span>{task.timeEstimate}h</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

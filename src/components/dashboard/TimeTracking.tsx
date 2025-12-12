import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Play, Pause, Square, Clock, Calendar as CalendarIcon } from 'lucide-react'
import type { Task, TimeLog } from '@/types/project'
import { collection, query, onSnapshot, addDoc, serverTimestamp, where, orderBy } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { useParams } from 'react-router-dom'
import { format, differenceInSeconds } from 'date-fns'

import { useAuth } from '@/hooks/use-auth'

interface TimeTrackingProps {
    readOnly?: boolean
}

export function TimeTracking({ readOnly = false }: TimeTrackingProps) {
    const { id: projectId } = useParams()
    const { user } = useAuth()
    const [tasks, setTasks] = useState<Task[]>([])
    const [timeLogs, setTimeLogs] = useState<TimeLog[]>([])
    const [activeTask, setActiveTask] = useState<string>('')
    const [isTimerRunning, setIsTimerRunning] = useState(false)
    const [startTime, setStartTime] = useState<Date | null>(null)
    const [elapsedTime, setElapsedTime] = useState(0)
    const [notes, setNotes] = useState('')

    useEffect(() => {
        if (!projectId || !user) return

        // Fetch tasks
        const qTasks = query(collection(db, 'projects', projectId, 'tasks'))
        const unsubscribeTasks = onSnapshot(qTasks, (snapshot) => {
            setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)))
        })

        // Fetch time logs
        const qLogs = query(
            collection(db, 'projects', projectId, 'timeLogs'),
            orderBy('createdAt', 'desc')
        )
        const unsubscribeLogs = onSnapshot(qLogs, (snapshot) => {
            setTimeLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeLog)))
        })

        return () => {
            unsubscribeTasks()
            unsubscribeLogs()
        }
    }, [projectId, user])

    useEffect(() => {
        let interval: any
        if (isTimerRunning && startTime) {
            interval = setInterval(() => {
                setElapsedTime(differenceInSeconds(new Date(), startTime))
            }, 1000)
        }
        return () => clearInterval(interval)
    }, [isTimerRunning, startTime])

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600)
        const m = Math.floor((seconds % 3600) / 60)
        const s = seconds % 60
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    const handleStartTimer = () => {
        if (!activeTask) return
        setStartTime(new Date())
        setIsTimerRunning(true)
    }

    const handleStopTimer = async () => {
        if (!startTime || !projectId || !auth.currentUser) return

        const endTime = new Date()
        const duration = Math.round(differenceInSeconds(endTime, startTime) / 60) // in minutes

        try {
            await addDoc(collection(db, 'projects', projectId, 'timeLogs'), {
                taskId: activeTask,
                userId: auth.currentUser.uid,
                startTime,
                endTime,
                duration,
                notes,
                createdAt: serverTimestamp()
            })

            setIsTimerRunning(false)
            setStartTime(null)
            setElapsedTime(0)
            setNotes('')
            setActiveTask('')
        } catch (error) {
            console.error('Error saving time log:', error)
        }
    }

    return (
        <div className="space-y-6">
            {/* Active Timer Card */}
            <Card className="bg-slate-50 dark:bg-slate-900 border-primary/20">
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row items-center gap-4">
                        <div className="flex-1 w-full">
                            <Select value={activeTask} onValueChange={setActiveTask} disabled={isTimerRunning}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select task to track..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {tasks.map(task => (
                                        <SelectItem key={task.id} value={task.id}>
                                            {task.title}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex-1 w-full">
                            <Input
                                placeholder="What are you working on?"
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                disabled={isTimerRunning}
                            />
                        </div>

                        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
                            <div className="text-3xl font-mono font-bold text-primary">
                                {formatTime(elapsedTime)}
                            </div>

                            {!isTimerRunning ? (
                                <Button onClick={handleStartTimer} disabled={!activeTask} className="w-32">
                                    <Play className="h-4 w-4 mr-2" /> Start
                                </Button>
                            ) : (
                                <Button onClick={handleStopTimer} variant="destructive" className="w-32">
                                    <Square className="h-4 w-4 mr-2" /> Stop
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Stats */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Total Time Logged</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {(() => {
                            const totalMinutes = timeLogs.reduce((sum, log) => sum + log.duration, 0);
                            const hours = Math.floor(totalMinutes / 60);
                            const minutes = totalMinutes % 60;
                            return (
                                <>
                                    <div className="text-2xl font-bold">{hours}h {minutes}m</div>
                                    <p className="text-xs text-muted-foreground mt-1">{timeLogs.length} time entries</p>
                                </>
                            );
                        })()}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Most Active Task</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {(() => {
                            const taskTimes = timeLogs.reduce((acc, log) => {
                                acc[log.taskId] = (acc[log.taskId] || 0) + log.duration;
                                return acc;
                            }, {} as Record<string, number>);

                            const mostActiveTaskId = Object.entries(taskTimes).sort((a, b) => b[1] - a[1])[0]?.[0];
                            const mostActiveTask = tasks.find(t => t.id === mostActiveTaskId);
                            const mostActiveTime = taskTimes[mostActiveTaskId] || 0;
                            const hours = Math.floor(mostActiveTime / 60);
                            const minutes = mostActiveTime % 60;

                            return (
                                <>
                                    <div className="text-lg font-medium truncate">
                                        {mostActiveTask?.title || 'No tasks tracked'}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {mostActiveTime > 0 ? `${hours}h ${minutes}m logged` : 'Start tracking time'}
                                    </p>
                                </>
                            );
                        })()}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Average per Entry</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {(() => {
                            const avgMinutes = timeLogs.length > 0
                                ? Math.round(timeLogs.reduce((sum, log) => sum + log.duration, 0) / timeLogs.length)
                                : 0;
                            const hours = Math.floor(avgMinutes / 60);
                            const minutes = avgMinutes % 60;
                            return (
                                <>
                                    <div className="text-2xl font-bold">{hours}h {minutes}m</div>
                                    <p className="text-xs text-muted-foreground mt-1">Per time entry</p>
                                </>
                            );
                        })()}
                    </CardContent>
                </Card>
            </div>

            {/* Time Logs Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Time Logs</CardTitle>
                    <CardDescription>History of time tracked on tasks</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {timeLogs.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">No time logs recorded yet.</p>
                        ) : (
                            timeLogs.map(log => {
                                const task = tasks.find(t => t.id === log.taskId)
                                return (
                                    <div key={log.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                <Clock className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="font-medium">{task?.title || 'Unknown Task'}</p>
                                                <p className="text-sm text-muted-foreground">{log.notes || 'No notes'}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold">{Math.floor(log.duration / 60)}h {log.duration % 60}m</p>
                                            <div className="flex items-center text-xs text-muted-foreground mt-1">
                                                <CalendarIcon className="h-3 w-3 mr-1" />
                                                {log.startTime && (() => {
                                                    try {
                                                        const date = new Date(log.startTime.toString());
                                                        return !isNaN(date.getTime()) ? format(date, 'MMM d, h:mm a') : 'Invalid date';
                                                    } catch {
                                                        return 'Invalid date';
                                                    }
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

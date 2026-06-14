import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Calendar, Clock, MoreVertical, AlertCircle, Pencil, FileText, Calendar as CalendarIcon, MessageSquare, ClipboardList, DollarSign, Trash2 } from 'lucide-react'
import type { Task } from '@/types/project'
import { format } from 'date-fns'
import { db } from '@/lib/firebase'
import { doc, updateDoc, deleteDoc, increment } from 'firebase/firestore'
import { useToast } from '@/hooks/use-toast'
import { useSearchParams } from 'react-router-dom'
import { usePermissions } from '@/hooks/use-permissions'
import { useAuth } from '@/hooks/use-auth'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface TaskCardProps {
    task: Task
    onClick?: () => void
}

const toolIcons: Record<string, { icon: any; label: string }> = {
    whiteboard: { icon: Pencil, label: 'Whiteboard' },
    docs: { icon: FileText, label: 'Drive Documents' },
    calendar: { icon: CalendarIcon, label: 'Calendar' },
    chat: { icon: MessageSquare, label: 'Team Chat' },
    gantt: { icon: ClipboardList, label: 'Gantt' },
    budget: { icon: DollarSign, label: 'Budget' },
}

export function TaskCard({ task, onClick }: TaskCardProps) {
    const { toast } = useToast()
    const [_, setSearchParams] = useSearchParams()
    const { user } = useAuth()
    const isCreator = !!(user?.uid && task.createdBy === user.uid)

    const handleDeleteTask = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!task.projectId) return

        try {
            await deleteDoc(doc(db, 'projects', task.projectId, 'tasks', task.id))
            if (task.status === 'done') {
                const projectRef = doc(db, 'projects', task.projectId)
                await updateDoc(projectRef, {
                    completedTasksCount: increment(-1)
                }).catch(() => {})
            }
            toast({
                title: 'Task deleted',
                description: `Successfully deleted "${task.title}".`,
            })
        } catch (error) {
            console.error('Error deleting task:', error)
            toast({
                title: 'Error',
                description: 'Failed to delete task.',
                variant: 'destructive',
            })
        }
    }

    const handleTaskStatusChange = async (taskId: string, newStatus: string) => {
        try {
            await updateDoc(doc(db, 'projects', task.projectId, 'tasks', taskId), {
                status: newStatus,
            })
            toast({ title: 'Task updated' })
        } catch (error) {
            console.error('Error updating task:', error)
        }
    }

    const handleToolClick = (e: React.MouseEvent, toolId: string) => {
        e.stopPropagation()
        setSearchParams(prev => {
            const next = new URLSearchParams(prev)
            next.set('tab', toolId)
            return next
        })
    }

    const priorityColors = {
        low: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
        medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
        high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100',
        urgent: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
    }

    return (
        <Card
            className="hover:shadow-md transition-shadow cursor-pointer border-l-4"
            style={{ borderLeftColor: task.priority === 'urgent' ? '#ef4444' : task.priority === 'high' ? '#f97316' : 'transparent' }}
            onClick={onClick}
        >
            <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                    <Badge variant="outline" className={`${priorityColors[task.priority]} border-0`}>
                        {task.priority}
                    </Badge>
                    {isCreator && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/50 transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <MoreVertical className="h-4 w-4" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuItem
                                    onClick={handleDeleteTask}
                                    className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Task
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>

                <div>
                    <h4 className="font-semibold text-sm line-clamp-2">{task.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
                </div>

                <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                            <AvatarImage src={task.assignee?.avatar} />
                            <AvatarFallback>{task.assignee?.name?.charAt(0) || 'U'}</AvatarFallback>
                        </Avatar>
                        {task.dueDate && (
                            <div className={`flex items-center text-xs ${(task.dueDate instanceof Date ? task.dueDate : (task.dueDate as any)?.toDate?.() || new Date(task.dueDate as any)) < new Date()
                                    ? 'text-red-500 font-medium'
                                    : 'text-muted-foreground'
                                }`}>
                                <Calendar className="h-3 w-3 mr-1" />
                                {(() => {
                                    const date = task.dueDate instanceof Date
                                        ? task.dueDate
                                        : (task.dueDate as any)?.toDate
                                            ? (task.dueDate as any).toDate()
                                            : new Date(task.dueDate as any)
                                    if (isNaN(date.getTime())) return 'Invalid Date'
                                    return format(date, 'MMM d')
                                })()}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {task.linkedTools && task.linkedTools.length > 0 && (
                            <div className="flex items-center gap-1">
                                {task.linkedTools.map(toolId => {
                                    const tool = toolIcons[toolId]
                                    if (!tool) return null
                                    const Icon = tool.icon
                                    return (
                                        <button
                                            key={toolId}
                                            type="button"
                                            title={`Go to ${tool.label}`}
                                            onClick={(e) => handleToolClick(e, toolId)}
                                            className="p-1 rounded bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 border border-zinc-200 dark:border-zinc-700 transition-colors"
                                        >
                                            <Icon className="h-3 w-3" />
                                        </button>
                                    )
                                })}
                            </div>
                        )}

                        {task.subtasks && task.subtasks.length > 0 && (
                            <div className="flex items-center text-xs text-muted-foreground bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-1.5 py-0.5 font-medium select-none">
                                {task.subtasks.filter(t => t.completed).length}/{task.subtasks.length}
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

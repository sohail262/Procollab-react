import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Calendar, Clock, MoreVertical, AlertCircle } from 'lucide-react'
import type { Task } from '@/types/project'
import { format } from 'date-fns'

interface TaskCardProps {
    task: Task
    onClick?: () => void
}

export function TaskCard({ task, onClick }: TaskCardProps) {
    const priorityColors = {
        low: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
        medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
        high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100',
        urgent: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
    }

    const statusColors = {
        backlog: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100',
        todo: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100',
        'in-progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
        review: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
        done: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
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
                    <button className="text-muted-foreground hover:text-foreground">
                        <MoreVertical className="h-4 w-4" />
                    </button>
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
                                    // Check if date is valid
                                    if (isNaN(date.getTime())) return 'Invalid Date'
                                    return format(date, 'MMM d')
                                })()}
                            </div>
                        )}
                    </div>

                    {task.subtasks && task.subtasks.length > 0 && (
                        <div className="flex items-center text-xs text-muted-foreground">
                            <span className="font-medium">
                                {task.subtasks.filter(t => t.completed).length}/{task.subtasks.length}
                            </span>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

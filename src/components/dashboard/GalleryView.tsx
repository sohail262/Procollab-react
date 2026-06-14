import { useState, useEffect } from 'react'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AspectRatio } from "@/components/ui/aspect-ratio"
import { Plus, MoreHorizontal, Paperclip, Calendar, Edit2, Trash2 } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import type { Task, TaskStatus } from '@/types/project'
import { collection, query, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { format } from 'date-fns'
import { TaskDialog } from './TaskDialog'

interface GalleryViewProps {
    readOnly?: boolean
}

export function GalleryView({ readOnly = false }: GalleryViewProps) {
    const { id: projectId } = useParams()
    const { user } = useAuth()
    const [tasks, setTasks] = useState<Task[]>([])
    const [isNewTaskOpen, setIsNewTaskOpen] = useState(false)
    const [isEditTaskOpen, setIsEditTaskOpen] = useState(false)
    const [selectedTask, setSelectedTask] = useState<Task | null>(null)

    useEffect(() => {
        if (!projectId || !user) return

        const q = query(collection(db, 'projects', projectId, 'tasks'))
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const tasksData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Task[]
            setTasks(tasksData)
        })

        return () => unsubscribe()
    }, [projectId, user])

    // Mock images for demonstration if no cover image exists
    const getCoverImage = (task: Task) => {
        if (task.coverImage) return task.coverImage
        // Generate a deterministic random image based on task ID
        const seed = task.id.charCodeAt(0) % 10
        return `https://picsum.photos/seed/${task.id}/600/400`
    }

    const handleCreateTask = async (taskData: Partial<Task>) => {
        if (!projectId || !user) return

        try {
            await addDoc(collection(db, 'projects', projectId, 'tasks'), {
                ...taskData,
                projectId,
                createdBy: user.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                assignee: {
                    id: user.uid,
                    name: user.displayName || 'User',
                    avatar: user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || 'User'}`
                },
                attachments: [], // Initialize empty
                comments: [] // Initialize empty
            })
        } catch (error) {
            console.error('Error creating task:', error)
        }
    }

    const handleDeleteTask = async (taskId: string) => {
        if (!projectId || !user) return

        try {
            await deleteDoc(doc(db, 'projects', projectId, 'tasks', taskId))
        } catch (error) {
            console.error('Error deleting task:', error)
        }
    }

    const handleUpdateTask = async (taskData: Partial<Task>) => {
        if (!projectId || !user || !selectedTask) return

        try {
            await updateDoc(doc(db, 'projects', projectId, 'tasks', selectedTask.id), {
                ...taskData,
                updatedAt: serverTimestamp()
            })
            setIsEditTaskOpen(false)
            setSelectedTask(null)
        } catch (error) {
            console.error('Error updating task:', error)
        }
    }

    return (
        <div className="h-full space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold tracking-tight">Gallery</h2>
                {!readOnly && (
                    <Button onClick={() => setIsNewTaskOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        New Item
                    </Button>
                )}
            </div>


            <ScrollArea className="h-[calc(100vh-220px)]">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-6">
                    {tasks.map((task) => (
                        <Card key={task.id} className="overflow-hidden group hover:shadow-lg transition-all duration-200 border-muted">
                            <div className="relative">
                                <AspectRatio ratio={16 / 9}>
                                    <img
                                        src={getCoverImage(task)}
                                        alt={task.title}
                                        className="object-cover w-full h-full transition-transform duration-200 group-hover:scale-105"
                                    />
                                </AspectRatio>
                                {!readOnly && (
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="secondary" size="icon" className="h-8 w-8 bg-black/50 hover:bg-black/70 text-white border-0">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => {
                                                    setSelectedTask(task);
                                                    setIsEditTaskOpen(true);
                                                }}>
                                                    <Edit2 className="h-4 w-4 mr-2" />
                                                    Edit Task
                                                </DropdownMenuItem>
                                                {task.createdBy === user?.uid && (
                                                    <DropdownMenuItem onClick={() => handleDeleteTask(task.id)}>
                                                        <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                                                        <span className="text-destructive">Delete</span>
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                )}
                                <div className="absolute top-2 left-2">
                                    <Badge variant={
                                        task.priority === 'urgent' ? 'destructive' :
                                            task.priority === 'high' ? 'default' :
                                                'secondary'
                                    } className="shadow-sm">
                                        {task.status}
                                    </Badge>
                                </div>
                            </div>

                            <CardHeader className="p-4 space-y-1">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold truncate">{task.title}</h3>
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                    {task.description || "No description provided."}
                                </p>
                            </CardHeader>

                            <CardFooter className="p-4 pt-0 flex items-center justify-between text-muted-foreground">
                                <div className="flex items-center space-x-4 text-xs">
                                    {task.dueDate && (
                                        <div className="flex items-center">
                                            <Calendar className="h-3 w-3 mr-1" />
                                            {format(task.dueDate instanceof Date ? task.dueDate : task.dueDate.toDate(), 'MMM d')}
                                        </div>
                                    )}
                                    <div className="flex items-center">
                                        <Paperclip className="h-3 w-3 mr-1" />
                                        {task.attachments?.length || 0}
                                    </div>
                                </div>
                                {task.assignee && (
                                    <Avatar className="h-6 w-6 border-2 border-background">
                                        <AvatarImage src={task.assignee.avatar} />
                                        <AvatarFallback>{task.assignee.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                )}
                            </CardFooter>
                        </Card>
                    ))}

                    {tasks.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center p-12 text-muted-foreground border-2 border-dashed rounded-lg">
                            <p className="text-lg font-medium">No tasks found</p>
                            <p className="text-sm">Create a new task to see it in the gallery</p>
                        </div>
                    )}
                </div>
            </ScrollArea>

            <TaskDialog
                open={isNewTaskOpen}
                onOpenChange={setIsNewTaskOpen}
                onSave={handleCreateTask}
            />

            <TaskDialog
                open={isEditTaskOpen}
                onOpenChange={setIsEditTaskOpen}
                task={selectedTask}
                onSave={handleUpdateTask}
            />
        </div>
    )
}

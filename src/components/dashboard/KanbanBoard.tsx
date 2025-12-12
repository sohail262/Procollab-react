import { useState, useEffect } from 'react'
import {
    DndContext,
    DragOverlay,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core'
import type {
    DragStartEvent,
    DragOverEvent,
    DragEndEvent
} from '@dnd-kit/core'
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task, TaskStatus } from '@/types/project'
import { TaskCard } from './TaskCard'
import { TaskDialog } from './TaskDialog'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { useParams } from 'react-router-dom'

// Sortable Column Component
function SortableColumn({ id, title, tasks, onAddTask, onEditTask, readOnly }: {
    id: string,
    title: string,
    tasks: Task[],
    onAddTask: () => void,
    onEditTask: (task: Task) => void,
    readOnly?: boolean
}) {
    const { setNodeRef } = useSortable({ id, disabled: readOnly })

    return (
        <div ref={setNodeRef} className="flex flex-col h-full min-w-[300px] w-[300px] bg-muted/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm uppercase text-muted-foreground">{title}</h3>
                <span className="bg-muted text-xs font-medium px-2 py-0.5 rounded-full">
                    {tasks.length}
                </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 min-h-[100px]">
                <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    {tasks.map(task => (
                        <SortableTask key={task.id} task={task} onClick={() => onEditTask(task)} readOnly={readOnly} />
                    ))}
                </SortableContext>
            </div>

            {!readOnly && (
                <Button variant="ghost" className="w-full mt-2 justify-start text-muted-foreground hover:text-foreground" onClick={onAddTask}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Task
                </Button>
            )}
        </div>
    )
}

// Sortable Task Wrapper
function SortableTask({ task, onClick, readOnly }: { task: Task, onClick: () => void, readOnly?: boolean }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: task.id, data: { task }, disabled: readOnly })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1
    }

    return (
        <div ref={setNodeRef} style={style} {...(readOnly ? {} : { ...attributes, ...listeners })}>
            <TaskCard task={task} onClick={readOnly ? undefined : onClick} />
        </div>
    )
}

import { useAuth } from '@/hooks/use-auth'

interface KanbanBoardProps {
    readOnly?: boolean
}

export function KanbanBoard({ readOnly = false }: KanbanBoardProps) {
    const { id: projectId } = useParams()
    const { user } = useAuth()
    const [tasks, setTasks] = useState<Task[]>([])
    const [activeId, setActiveId] = useState<string | null>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingTask, setEditingTask] = useState<Task | null>(null)
    const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>('todo')

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

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

    const columns: { id: TaskStatus, title: string }[] = [
        { id: 'backlog', title: 'Backlog' },
        { id: 'todo', title: 'To Do' },
        { id: 'in-progress', title: 'In Progress' },
        { id: 'review', title: 'Review' },
        { id: 'done', title: 'Done' }
    ]

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string)
    }

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event
        if (!over) return

        const activeId = active.id
        const overId = over.id

        // Find the containers
        const activeTask = tasks.find(t => t.id === activeId)
        const overTask = tasks.find(t => t.id === overId)

        if (!activeTask) return

        // If dropping over a column
        const overColumn = columns.find(c => c.id === overId)
        if (overColumn) {
            if (activeTask.status !== overColumn.id) {
                // Update local state immediately for responsiveness
                setTasks(tasks.map(t =>
                    t.id === activeId ? { ...t, status: overColumn.id } : t
                ))
            }
        } else if (overTask && activeTask.status !== overTask.status) {
            // Dropping over another task in a different column
            setTasks(tasks.map(t =>
                t.id === activeId ? { ...t, status: overTask.status } : t
            ))
        }
    }

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event
        setActiveId(null)

        if (!over) return

        const activeId = active.id as string
        const overId = over.id as string

        const activeTask = tasks.find(t => t.id === activeId)
        if (!activeTask) return

        let newStatus = activeTask.status

        // Check if dropped on a column
        const overColumn = columns.find(c => c.id === overId)
        if (overColumn) {
            newStatus = overColumn.id
        } else {
            // Check if dropped on a task
            const overTask = tasks.find(t => t.id === overId)
            if (overTask) {
                newStatus = overTask.status
            }
        }

        if (activeTask.status !== newStatus) {
            // Update Firestore
            if (projectId) {
                await updateDoc(doc(db, 'projects', projectId, 'tasks', activeId), {
                    status: newStatus,
                    updatedAt: serverTimestamp()
                })
            }
        }
    }

    const handleSaveTask = async (taskData: Partial<Task>) => {
        if (!projectId || !auth.currentUser) return

        if (editingTask) {
            // Update existing task
            await updateDoc(doc(db, 'projects', projectId, 'tasks', editingTask.id), {
                ...taskData,
                updatedAt: serverTimestamp()
            })
        } else {
            // Create new task
            await addDoc(collection(db, 'projects', projectId, 'tasks'), {
                ...taskData,
                projectId,
                status: newTaskStatus,
                createdBy: auth.currentUser.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            })
        }
        setEditingTask(null)
    }

    const openNewTaskDialog = (status: TaskStatus) => {
        setNewTaskStatus(status)
        setEditingTask(null)
        setIsDialogOpen(true)
    }

    const openEditTaskDialog = (task: Task) => {
        setEditingTask(task)
        setIsDialogOpen(true)
    }

    return (
        <div className="h-full overflow-x-auto pb-4">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
            >
                <div className="flex h-full gap-4 min-w-max">
                    {columns.map(col => (
                        <SortableColumn
                            key={col.id}
                            id={col.id}
                            title={col.title}
                            tasks={tasks.filter(t => t.status === col.id)}
                            onAddTask={() => openNewTaskDialog(col.id)}
                            onEditTask={openEditTaskDialog}
                            readOnly={readOnly}
                        />
                    ))}
                </div>

                <DragOverlay>
                    {activeId ? (
                        <TaskCard task={tasks.find(t => t.id === activeId)!} />
                    ) : null}
                </DragOverlay>
            </DndContext>

            <TaskDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                task={editingTask}
                onSave={handleSaveTask}
            />
        </div>
    )
}

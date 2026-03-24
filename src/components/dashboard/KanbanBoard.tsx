import { useState, useEffect, useCallback } from 'react'
import {
    DndContext, DragOverlay, closestCorners,
    KeyboardSensor, PointerSensor,
    useSensor, useSensors,
} from '@dnd-kit/core'
import type { DragStartEvent, DragOverEvent, DragEndEvent } from '@dnd-kit/core'
import {
    SortableContext, sortableKeyboardCoordinates,
    verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task, TaskStatus } from '@/types/project'
import { TaskCard } from './TaskCard'
import { TaskDialog } from './TaskDialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, AlertTriangle } from 'lucide-react'
import {
    collection, query, onSnapshot,
    addDoc, updateDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { isPast } from 'date-fns'
import { Skeleton } from '@/components/ui/skeleton'

// ─── WIP limits per column (0 = unlimited) ────────────────────────────────────
const WIP_LIMITS: Record<TaskStatus, number> = {
    backlog: 0,
    todo: 0,
    'in-progress': 4,   // students shouldn't juggle more than 4 at once
    review: 3,
    done: 0,
}

// ─── Column config ────────────────────────────────────────────────────────────
const COLUMNS: { id: TaskStatus; title: string }[] = [
    { id: 'backlog', title: 'Backlog' },
    { id: 'todo', title: 'To Do' },
    { id: 'in-progress', title: 'In Progress' },
    { id: 'review', title: 'Review' },
    { id: 'done', title: 'Done' },
]

// ─── Column header colour ─────────────────────────────────────────────────────
const COLUMN_ACCENT: Record<string, string> = {
    backlog: 'border-slate-400',
    todo: 'border-blue-400',
    'in-progress': 'border-orange-400',
    review: 'border-purple-400',
    done: 'border-green-400',
}

// ─── SortableTask ─────────────────────────────────────────────────────────────
function SortableTask({
    task, onClick, readOnly,
}: {
    task: Task; onClick: () => void; readOnly?: boolean
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: task.id, data: { task }, disabled: readOnly })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : 1,
    }

    // Check if task is overdue
    const isOverdue = task.dueDate && isPast(
        task.dueDate instanceof Date
            ? task.dueDate
            : (task.dueDate as any).toDate?.() ?? new Date(task.dueDate as any)
    ) && task.status !== 'done'

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`relative ${isOverdue ? 'ring-1 ring-destructive rounded-lg' : ''}`}
            {...(readOnly ? {} : { ...attributes, ...listeners })}
        >
            {isOverdue && (
                <div className="absolute -top-1.5 -right-1.5 z-10">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive fill-white" />
                </div>
            )}
            <TaskCard task={task} onClick={readOnly ? undefined : onClick} />
        </div>
    )
}

// ─── SortableColumn ───────────────────────────────────────────────────────────
function SortableColumn({
    id, title, tasks, onAddTask, onEditTask, readOnly,
}: {
    id: string; title: string; tasks: Task[];
    onAddTask: () => void; onEditTask: (t: Task) => void; readOnly?: boolean
}) {
    const { setNodeRef } = useSortable({ id, disabled: readOnly })

    const wipLimit = WIP_LIMITS[id as TaskStatus]
    const isOverWip = wipLimit > 0 && tasks.length > wipLimit
    const isAtWip = wipLimit > 0 && tasks.length === wipLimit
    const overdueCount = tasks.filter(t =>
        t.dueDate && isPast(
            t.dueDate instanceof Date
                ? t.dueDate
                : (t.dueDate as any).toDate?.() ?? new Date(t.dueDate as any)
        ) && t.status !== 'done'
    ).length

    const accentClass = COLUMN_ACCENT[id] ?? 'border-border'

    return (
        <div
            ref={setNodeRef}
            className={`flex flex-col h-full min-w-[300px] w-[300px] rounded-lg
                        bg-muted/40 border-t-4 ${accentClass}
                        ${isOverWip ? 'ring-2 ring-destructive/40' : ''}`}
        >
            {/* Column header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3">
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                    {title}
                </h3>
                <div className="flex items-center gap-1.5">
                    {overdueCount > 0 && (
                        <Badge
                            variant="destructive"
                            className="text-xs h-5 px-1.5 flex items-center gap-0.5"
                        >
                            <AlertTriangle className="h-2.5 w-2.5" />
                            {overdueCount}
                        </Badge>
                    )}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full
                        ${isOverWip ? 'bg-destructive/10 text-destructive' :
                            isAtWip ? 'bg-orange-100 text-orange-600' :
                                'bg-muted text-muted-foreground'}`}
                    >
                        {wipLimit > 0 ? `${tasks.length}/${wipLimit}` : tasks.length}
                    </span>
                </div>
            </div>

            {/* WIP warning banner */}
            {isOverWip && (
                <div className="mx-3 mb-2 text-xs bg-destructive/10 text-destructive
                                rounded-md px-2 py-1.5 flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    WIP limit exceeded! Move or complete tasks first.
                </div>
            )}

            {/* Task list */}
            <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-2.5 min-h-[80px]">
                <SortableContext
                    items={tasks.map(t => t.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {tasks.length === 0 ? (
                        <div className="flex items-center justify-center h-16
                                        border-2 border-dashed border-muted-foreground/20
                                        rounded-lg text-xs text-muted-foreground/50">
                            Drop tasks here
                        </div>
                    ) : (
                        tasks.map(task => (
                            <SortableTask
                                key={task.id}
                                task={task}
                                onClick={() => onEditTask(task)}
                                readOnly={readOnly}
                            />
                        ))
                    )}
                </SortableContext>
            </div>

            {/* Add task button */}
            {!readOnly && (
                <div className="px-3 pb-3 pt-1">
                    <Button
                        variant="ghost"
                        className="w-full justify-start text-muted-foreground
                                   hover:text-foreground hover:bg-muted/70 text-sm"
                        onClick={onAddTask}
                    >
                        <Plus className="h-4 w-4 mr-1.5" />
                        Add Task
                    </Button>
                </div>
            )}
        </div>
    )
}

// ─── KanbanBoard ──────────────────────────────────────────────────────────────
interface KanbanBoardProps {
    readOnly?: boolean
}

export function KanbanBoard({ readOnly = false }: KanbanBoardProps) {
    const { id: projectId } = useParams()
    const { user } = useAuth()
    const { toast } = useToast()

    const [tasks, setTasks] = useState<Task[]>([])
    const [prevTasks, setPrevTasks] = useState<Task[]>([])  // for rollback
    const [loading, setLoading] = useState(true)
    const [activeId, setActiveId] = useState<string | null>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingTask, setEditingTask] = useState<Task | null>(null)
    const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>('todo')

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    // ── Firestore listener ─────────────────────────────────────────────────
    useEffect(() => {
        if (!projectId || !user) return

        const q = query(collection(db, 'projects', projectId, 'tasks'))

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const data = snapshot.docs.map(d => ({
                    id: d.id,
                    ...d.data(),
                })) as Task[]
                setTasks(data)
                setLoading(false)
            },
            (err) => {
                console.error('KanbanBoard listener error:', err)
                setLoading(false)
            }
        )

        return () => unsubscribe()
    }, [projectId, user])

    // ── Summary stats ──────────────────────────────────────────────────────
    const totalDone = tasks.filter(t => t.status === 'done').length
    const totalOverdue = tasks.filter(t =>
        t.dueDate && isPast(
            t.dueDate instanceof Date
                ? t.dueDate
                : (t.dueDate as any).toDate?.() ?? new Date(t.dueDate as any)
        ) && t.status !== 'done'
    ).length
    const completionPct = tasks.length > 0
        ? Math.round((totalDone / tasks.length) * 100)
        : 0

    // ── Drag handlers ──────────────────────────────────────────────────────
    const handleDragStart = (event: DragStartEvent) => {
        setPrevTasks([...tasks])    // snapshot for rollback
        setActiveId(event.active.id as string)
    }

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event
        if (!over) return

        const activeTask = tasks.find(t => t.id === active.id)
        if (!activeTask) return

        const overColumn = COLUMNS.find(c => c.id === over.id)
        if (overColumn) {
            if (activeTask.status !== overColumn.id)
                setTasks(prev => prev.map(t =>
                    t.id === active.id ? { ...t, status: overColumn.id } : t
                ))
        } else {
            const overTask = tasks.find(t => t.id === over.id)
            if (overTask && activeTask.status !== overTask.status)
                setTasks(prev => prev.map(t =>
                    t.id === active.id ? { ...t, status: overTask.status } : t
                ))
        }
    }

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event
        setActiveId(null)
        if (!over) return

        const activeTask = tasks.find(t => t.id === active.id)
        if (!activeTask) return

        let newStatus = activeTask.status
        const overColumn = COLUMNS.find(c => c.id === over.id)
        if (overColumn) {
            newStatus = overColumn.id
        } else {
            const overTask = tasks.find(t => t.id === over.id)
            if (overTask) newStatus = overTask.status
        }

        const originalStatus = prevTasks.find(t => t.id === active.id)?.status

        if (originalStatus !== newStatus) {
            // Check WIP before committing
            const targetCount = tasks.filter(t => t.status === newStatus).length
            const wipLimit = WIP_LIMITS[newStatus as TaskStatus]

            if (wipLimit > 0 && targetCount > wipLimit) {
                toast({
                    title: '⚠️ WIP Limit Reached',
                    description: `"${newStatus}" is limited to ${wipLimit} tasks. Finish something first!`,
                    variant: 'destructive',
                })
                // Rollback
                setTasks(prevTasks)
                return
            }

            try {
                if (projectId) {
                    await updateDoc(
                        doc(db, 'projects', projectId, 'tasks', active.id as string),
                        { status: newStatus, updatedAt: serverTimestamp() }
                    )
                }
            } catch (err) {
                console.error('Failed to update task status:', err)
                toast({
                    title: 'Error',
                    description: 'Could not move task. Changes reverted.',
                    variant: 'destructive',
                })
                setTasks(prevTasks)   // rollback on Firestore failure
            }
        }
    }

    // ── Save task (create / update) ────────────────────────────────────────
    const handleSaveTask = async (taskData: Partial<Task>) => {
        if (!projectId || !auth.currentUser) return

        try {
            if (editingTask) {
                await updateDoc(
                    doc(db, 'projects', projectId, 'tasks', editingTask.id),
                    { ...taskData, updatedAt: serverTimestamp() }
                )
                toast({ title: 'Task updated ✅' })
            } else {
                await addDoc(collection(db, 'projects', projectId, 'tasks'), {
                    ...taskData,
                    projectId,
                    status: newTaskStatus,
                    createdBy: auth.currentUser.uid,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                })
                toast({ title: 'Task created 🎉' })
            }
            setEditingTask(null)
        } catch (err) {
            console.error('Failed to save task:', err)
            toast({
                title: 'Error',
                description: 'Could not save task.',
                variant: 'destructive',
            })
        }
    }

    const openNewTaskDialog = (status: TaskStatus) => {
        setNewTaskStatus(status); setEditingTask(null); setIsDialogOpen(true)
    }
    const openEditTaskDialog = (task: Task) => {
        setEditingTask(task); setIsDialogOpen(true)
    }

    // ── Loading ─────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex gap-4 h-full overflow-x-auto pb-4">
                {COLUMNS.map(col => (
                    <div key={col.id} className="min-w-[300px] space-y-3">
                        <Skeleton className="h-10 w-full" />
                        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
                    </div>
                ))}
            </div>
        )
    }

    const activeTask = tasks.find(t => t.id === activeId)

    return (
        <div className="h-full flex flex-col gap-3">

            {/* ── Progress bar + stats ── */}
            <div className="flex items-center gap-4 px-1 flex-shrink-0">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                        className="h-full bg-green-500 rounded-full transition-all duration-700"
                        style={{ width: `${completionPct}%` }}
                    />
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap font-medium">
                    {totalDone}/{tasks.length} done ({completionPct}%)
                </span>
                {totalOverdue > 0 && (
                    <Badge variant="destructive" className="flex items-center gap-1 text-xs">
                        <AlertTriangle className="h-3 w-3" />
                        {totalOverdue} overdue
                    </Badge>
                )}
            </div>

            {/* ── Board ── */}
            <div className="flex-1 overflow-x-auto pb-4">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                >
                    <div className="flex h-full gap-4 min-w-max">
                        {COLUMNS.map(col => (
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

                    <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
                        {activeTask ? (
                            <div className="opacity-95 shadow-2xl rotate-1 scale-105">
                                <TaskCard task={activeTask} />
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>
            </div>

            <TaskDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                task={editingTask}
                onSave={handleSaveTask}
            />
        </div>
    )
}
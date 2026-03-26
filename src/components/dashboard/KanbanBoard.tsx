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
import { Plus, AlertTriangle, Lock } from 'lucide-react'
import {
    collection, query, onSnapshot,
    addDoc, updateDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'
import { useToast } from '@/hooks/use-toast'
import { isPast } from 'date-fns'
import { Skeleton } from '@/components/ui/skeleton'

// ─── WIP limits per column (0 = unlimited) ────────────────────────────────────
const WIP_LIMITS: Record<TaskStatus, number> = {
    backlog:       0,
    todo:          0,
    'in-progress': 4,
    review:        3,
    done:          0,
}

// ─── Column config ────────────────────────────────────────────────────────────
const COLUMNS: { id: TaskStatus; title: string }[] = [
    { id: 'backlog',     title: 'Backlog'      },
    { id: 'todo',        title: 'To Do'        },
    { id: 'in-progress', title: 'In Progress'  },
    { id: 'review',      title: 'Review'       },
    { id: 'done',        title: 'Done'         },
]

// ─── Column accent colours ────────────────────────────────────────────────────
const COLUMN_ACCENT: Record<string, string> = {
    backlog:       'border-slate-400',
    todo:          'border-blue-400',
    'in-progress': 'border-orange-400',
    review:        'border-purple-400',
    done:          'border-green-400',
}

// ─── Helper: normalise any date value → JS Date ───────────────────────────────
function toDate(val: any): Date {
    if (!val) return new Date(0)
    if (val instanceof Date) return val
    if (typeof val.toDate === 'function') return val.toDate()
    return new Date(val)
}

// ─── SortableTask ─────────────────────────────────────────────────────────────
function SortableTask({
    task,
    onClick,
    canDrag,
}: {
    task:    Task
    onClick: () => void
    canDrag: boolean
}) {
    const {
        attributes, listeners, setNodeRef,
        transform, transition, isDragging,
    } = useSortable({ id: task.id, data: { task }, disabled: !canDrag })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : 1,
    }

    const isOverdue =
        task.dueDate &&
        isPast(toDate(task.dueDate)) &&
        task.status !== 'done'

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`relative ${isOverdue ? 'ring-1 ring-destructive rounded-lg' : ''}`}
            {...(canDrag ? { ...attributes, ...listeners } : {})}
        >
            {isOverdue && (
                <div className="absolute -top-1.5 -right-1.5 z-10">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive fill-white" />
                </div>
            )}
            <TaskCard task={task} onClick={onClick} />
        </div>
    )
}

// ─── SortableColumn ───────────────────────────────────────────────────────────
function SortableColumn({
    id, title, tasks,
    onAddTask, onEditTask,
    canCreate, canDragTask,
}: {
    id:          string
    title:       string
    tasks:       Task[]
    onAddTask:   () => void
    onEditTask:  (t: Task) => void
    canCreate:   boolean
    canDragTask: (task: Task) => boolean
}) {
    const { setNodeRef } = useSortable({ id, disabled: false })

    const wipLimit     = WIP_LIMITS[id as TaskStatus]
    const isOverWip    = wipLimit > 0 && tasks.length > wipLimit
    const isAtWip      = wipLimit > 0 && tasks.length === wipLimit
    const overdueCount = tasks.filter(
        t => t.dueDate && isPast(toDate(t.dueDate)) && t.status !== 'done'
    ).length

    const accentClass = COLUMN_ACCENT[id] ?? 'border-border'

    return (
        <div
            ref={setNodeRef}
            className={`flex flex-col h-full min-w-[300px] w-[300px] rounded-lg
                        bg-muted/40 border-t-4 ${accentClass}
                        ${isOverWip ? 'ring-2 ring-destructive/40' : ''}`}
        >
            {/* ── Column header ── */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3">
                <h3 className="font-semibold text-sm uppercase tracking-wide
                               text-muted-foreground">
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
                    <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full
                            ${isOverWip
                                ? 'bg-destructive/10 text-destructive'
                                : isAtWip
                                    ? 'bg-orange-100 text-orange-600'
                                    : 'bg-muted text-muted-foreground'
                            }`}
                    >
                        {wipLimit > 0 ? `${tasks.length}/${wipLimit}` : tasks.length}
                    </span>
                </div>
            </div>

            {/* ── WIP warning banner ── */}
            {isOverWip && (
                <div className="mx-3 mb-2 text-xs bg-destructive/10 text-destructive
                                rounded-md px-2 py-1.5 flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    WIP limit exceeded! Move or complete tasks first.
                </div>
            )}

            {/* ── Task list ── */}
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
                                canDrag={canDragTask(task)}
                            />
                        ))
                    )}
                </SortableContext>
            </div>

            {/* ── Add task — owner/admin only ── */}
            {canCreate && (
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
    tasks?:    Task[]
}

export function KanbanBoard({ readOnly = false, tasks: injectedTasks }: KanbanBoardProps) {
    const { id: projectId } = useParams()
    const { user }          = useAuth()
    const { toast }         = useToast()

    // ── Use permissions hook — single source of truth for role ───────────────
    const {
        isOwner,
        isAdmin,
        loading: permLoading,
    } = usePermissions()

    // ── Local tasks — only used when parent does NOT inject ───────────────────
    const [localTasks, setLocalTasks] = useState<Task[]>([])
    const [loading,    setLoading]    = useState(!injectedTasks)

    // ── Resolved task list ─────────────────────────────────────────────────────
    const tasks = injectedTasks ?? localTasks

    // ── Drag / dialog state ───────────────────────────────────────────────────
    const [prevTasks,     setPrevTasks]     = useState<Task[]>([])
    const [activeId,      setActiveId]      = useState<string | null>(null)
    const [isDialogOpen,  setIsDialogOpen]  = useState(false)
    const [editingTask,   setEditingTask]   = useState<Task | null>(null)
    const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>('todo')

    // ── Role booleans ─────────────────────────────────────────────────────────
    const isOwnerOrAdmin = isOwner || isAdmin
    // isMember = authenticated + in the project + NOT owner/admin
    const isMember       = !isOwnerOrAdmin && !!user

    // ── Own Firestore listener — only when tasks NOT injected ─────────────────
    useEffect(() => {
        if (injectedTasks || !projectId || !user) return

        const q = query(collection(db, 'projects', projectId, 'tasks'))
        const unsub = onSnapshot(
            q,
            snap => {
                setLocalTasks(
                    snap.docs.map(d => ({ id: d.id, ...d.data() }) as Task)
                )
                setLoading(false)
            },
            err => {
                console.error('KanbanBoard listener error:', err)
                setLoading(false)
            }
        )
        return () => unsub()
    }, [projectId, user, injectedTasks])

    // ── Clear loading when injected tasks arrive ──────────────────────────────
    useEffect(() => {
        if (injectedTasks) setLoading(false)
    }, [injectedTasks])

    // ── Summary stats ──────────────────────────────────────────────────────────
    const totalDone    = tasks.filter(t => t.status === 'done').length
    const totalOverdue = tasks.filter(
        t => t.dueDate && isPast(toDate(t.dueDate)) && t.status !== 'done'
    ).length
    const completionPct = tasks.length > 0
        ? Math.round((totalDone / tasks.length) * 100)
        : 0

    // ── DnD sensors ───────────────────────────────────────────────────────────
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    // ── Per-task drag permission ───────────────────────────────────────────────
    // Owner/Admin  → can drag any task
    // Member       → can only drag tasks assigned to them
    // readOnly     → nobody drags
    const canDragTask = useCallback((task: Task): boolean => {
        if (readOnly) return false
        if (isOwnerOrAdmin) return true
        if (isMember && task.assigneeId === user?.uid) return true
        return false
    }, [readOnly, isOwnerOrAdmin, isMember, user])

    // ── Can create new tasks ───────────────────────────────────────────────────
    const canCreate = !readOnly && isOwnerOrAdmin

    // ─────────────────────────────────────────────────────────────────────────
    // Drag handlers
    // ─────────────────────────────────────────────────────────────────────────
    const handleDragStart = (event: DragStartEvent) => {
        setPrevTasks([...tasks])
        setActiveId(event.active.id as string)
    }

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event
        if (!over) return

        const activeTask = tasks.find(t => t.id === active.id)
        if (!activeTask || !canDragTask(activeTask)) return

        const overColumn = COLUMNS.find(c => c.id === over.id)
        if (overColumn) {
            if (activeTask.status !== overColumn.id) {
                setLocalTasks(prev =>
                    prev.map(t =>
                        t.id === active.id
                            ? { ...t, status: overColumn.id }
                            : t
                    )
                )
            }
        } else {
            const overTask = tasks.find(t => t.id === over.id)
            if (overTask && activeTask.status !== overTask.status) {
                setLocalTasks(prev =>
                    prev.map(t =>
                        t.id === active.id
                            ? { ...t, status: overTask.status }
                            : t
                    )
                )
            }
        }
    }

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event
        setActiveId(null)
        if (!over) return

        const activeTask = tasks.find(t => t.id === active.id)
        if (!activeTask || !canDragTask(activeTask)) return

        // Resolve new status
        let newStatus: TaskStatus = activeTask.status
        const overColumn = COLUMNS.find(c => c.id === over.id)
        if (overColumn) {
            newStatus = overColumn.id
        } else {
            const overTask = tasks.find(t => t.id === over.id)
            if (overTask) newStatus = overTask.status
        }

        const originalStatus = prevTasks.find(t => t.id === active.id)?.status
        if (originalStatus === newStatus) return

        // ── WIP check ─────────────────────────────────────────────────────────
        const targetCount = tasks.filter(t => t.status === newStatus).length
        const wipLimit    = WIP_LIMITS[newStatus]

        if (wipLimit > 0 && targetCount > wipLimit) {
            toast({
                title:       '⚠️ WIP Limit Reached',
                description: `"${newStatus}" column is limited to ${wipLimit} tasks. Finish something first!`,
                variant:     'destructive',
            })
            setLocalTasks(prevTasks)
            return
        }

        // ── Write to Firestore ─────────────────────────────────────────────────
        try {
            if (projectId) {
                await updateDoc(
                    doc(db, 'projects', projectId, 'tasks', active.id as string),
                    {
                        status:    newStatus,
                        updatedAt: serverTimestamp(),
                    }
                )
            }
        } catch (err) {
            console.error('Failed to update task status:', err)
            toast({
                title:       'Error',
                description: 'Could not move task. Changes reverted.',
                variant:     'destructive',
            })
            setLocalTasks(prevTasks)
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Save task — owner/admin only
    // ─────────────────────────────────────────────────────────────────────────
    const handleSaveTask = async (taskData: Partial<Task>) => {
        if (!projectId || !auth.currentUser || !isOwnerOrAdmin) return

        try {
            const { dueDate, assignee, assigneeId, ...rest } = taskData

            const firestorePayload: Record<string, any> = {
                ...rest,
                dueDate:    dueDate instanceof Date && !isNaN(dueDate.getTime())
                    ? dueDate
                    : null,
                assigneeId: assigneeId || null,
                assignee:   assigneeId && assignee
                    ? {
                        id:     assignee.id,
                        name:   assignee.name,
                        avatar: assignee.avatar ?? null,
                    }
                    : null,
            }

            if (editingTask) {
                await updateDoc(
                    doc(db, 'projects', projectId, 'tasks', editingTask.id),
                    { ...firestorePayload, updatedAt: serverTimestamp() }
                )
                toast({ title: 'Task updated ✅' })
            } else {
                await addDoc(
                    collection(db, 'projects', projectId, 'tasks'),
                    {
                        ...firestorePayload,
                        projectId,
                        status:    newTaskStatus,
                        createdBy: auth.currentUser.uid,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    }
                )
                toast({ title: 'Task created 🎉' })
            }

            setEditingTask(null)
        } catch (err) {
            console.error('Failed to save task:', err)
            toast({
                title:       'Error',
                description: 'Could not save task.',
                variant:     'destructive',
            })
        }
    }

    // ── Dialog openers ─────────────────────────────────────────────────────────
    const openNewTaskDialog = (status: TaskStatus) => {
        if (!isOwnerOrAdmin) return
        setNewTaskStatus(status)
        setEditingTask(null)
        setIsDialogOpen(true)
    }

    const openEditTaskDialog = (task: Task) => {
        setEditingTask(task)
        setIsDialogOpen(true)
    }

    // ── Dialog readOnly logic ──────────────────────────────────────────────────
    // Owner/Admin         → always editable
    // Member + own task   → editable
    // Member + other task → read only
    // Viewer / no role    → read only
    const dialogReadOnly = (() => {
        if (readOnly) return true
        if (isOwnerOrAdmin) return false
        if (isMember && editingTask?.assigneeId === user?.uid) return false
        return true
    })()

    // ── Loading skeleton ───────────────────────────────────────────────────────
    if (loading || permLoading) {
        return (
            <div className="flex gap-4 h-full overflow-x-auto pb-4">
                {COLUMNS.map(col => (
                    <div key={col.id} className="min-w-[300px] space-y-3">
                        <Skeleton className="h-10 w-full" />
                        {[1, 2, 3].map(i => (
                            <Skeleton key={i} className="h-24 w-full" />
                        ))}
                    </div>
                ))}
            </div>
        )
    }

    const activeTask = tasks.find(t => t.id === activeId)

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="h-full flex flex-col gap-3">

            {/* ── Progress bar + stats ── */}
            <div className="flex items-center gap-4 px-1 flex-shrink-0 flex-wrap">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden min-w-[100px]">
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
                {isMember && (
                    <Badge variant="outline" className="flex items-center gap-1 text-xs">
                        <Lock className="h-3 w-3" />
                        You can move your assigned tasks
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
                                canCreate={canCreate}
                                canDragTask={canDragTask}
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

            {/* ── Task dialog ── */}
            <TaskDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                task={editingTask}
                onSave={handleSaveTask}
                readOnly={dialogReadOnly}
            />
        </div>
    )
}
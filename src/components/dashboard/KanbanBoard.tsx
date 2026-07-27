import { useState, useEffect, useCallback, useRef } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
    Plus, AlertTriangle, Lock, ChevronLeft, ChevronRight,
    Send, Calendar, Clock, MessageSquare,
} from 'lucide-react'
import {
    collection, query, onSnapshot,
    addDoc, updateDoc, doc, serverTimestamp,
    getDoc, increment,
} from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { clearCache } from '@/lib/queryUtils'
import { useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'
import { useToast } from '@/hooks/use-toast'
import { updateCollaborativeActivity } from '@/services/analyticsService'
import { isPast, format } from 'date-fns'
import { Skeleton } from '@/components/ui/skeleton'

// ─── Mobile detection ─────────────────────────────────────────────────────────
function useIsMobile() {
    const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768)
    useEffect(() => {
        const handler = () => setIsMobile(window.innerWidth <= 768)
        window.addEventListener('resize', handler)
        return () => window.removeEventListener('resize', handler)
    }, [])
    return isMobile
}

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

// ─── Status & Priority badge styles ──────────────────────────────────────────
const PRIORITY_BADGE_COLORS: Record<string, string> = {
    low:    'bg-green-500/10 text-green-600 border-green-500/20',
    medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    high:   'bg-orange-500/10 text-orange-600 border-orange-500/20',
    urgent: 'bg-red-500/10 text-red-600 border-red-500/20',
}

const STATUS_LABELS: Record<TaskStatus, string> = {
    backlog:       'Backlog',
    todo:          'To Do',
    'in-progress': 'In Progress',
    review:        'In Review',
    done:          'Done',
}

const STATUS_BADGE_COLORS: Record<TaskStatus, string> = {
    backlog:       'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    todo:          'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    'in-progress': 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
    review:        'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    done:          'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
}

// ─── Update Task Status Modal ────────────────────────────────────────────────
// Shown when a task is moved/submitted for review in Kanban board
interface SubmitReviewDialogProps {
    task:         Task | null
    open:         boolean
    targetStatus?: TaskStatus
    onOpenChange: (v: boolean) => void
    onSubmit:     (status: TaskStatus, note: string) => Promise<void>
}

function SubmitReviewDialog({ task, open, targetStatus = 'review', onOpenChange, onSubmit }: SubmitReviewDialogProps) {
    const [newStatus, setNewStatus] = useState<TaskStatus>(targetStatus)
    const [note,      setNote]      = useState('')
    const [saving,    setSaving]    = useState(false)

    useEffect(() => {
        if (open) {
            setNewStatus(targetStatus || task?.status || 'review')
            setNote('')
        }
    }, [open, targetStatus, task])

    if (!task) return null

    const dueDate   = toDate(task.dueDate)
    const isOverdue = dueDate && isPast(dueDate) && task.status !== 'done'
    const statusChanged = newStatus !== task.status

    const handleSubmit = async () => {
        setSaving(true)
        try {
            await onSubmit(newStatus, note)
            onOpenChange(false)
        } finally {
            setSaving(false)
        }
    }

    const MEMBER_STATUSES: TaskStatus[] = ['backlog', 'todo', 'in-progress', 'review']

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <span>Update Task Status</span>
                        <Badge
                            variant="outline"
                            className={`text-xs ${PRIORITY_BADGE_COLORS[task.priority] ?? ''}`}
                        >
                            {task.priority}
                        </Badge>
                    </DialogTitle>
                    <DialogDescription>
                        Update the status of your assigned task and leave a note for the project owner.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Task info card */}
                    <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                        <h3 className="font-semibold text-sm">{task.title}</h3>
                        {task.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                                {task.description}
                            </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                            {dueDate && (
                                <div className={`flex items-center gap-1 text-xs ${
                                    isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'
                                }`}>
                                    <Calendar className="h-3 w-3" />
                                    Due: {format(dueDate, 'MMM d, yyyy')}
                                    {isOverdue && ' (Overdue!)'}
                                </div>
                            )}
                            {task.timeEstimate && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    {task.timeEstimate}h estimated
                                </div>
                            )}
                        </div>
                        {(task.tags ?? []).length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {(task.tags ?? []).map(tag => (
                                    <span key={tag} className="text-xs bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Previous review feedback if changes were requested */}
                    {(task as any).reviewStatus === 'changes_requested' && (task as any).reviewNote && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 space-y-1">
                            <p className="text-xs font-semibold text-red-700 dark:text-red-400 flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                Owner's Feedback:
                            </p>
                            <p className="text-sm text-red-700 dark:text-red-300">
                                {(task as any).reviewNote}
                            </p>
                        </div>
                    )}

                    {/* New Status selection */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">New Status</label>
                        <Select value={newStatus} onValueChange={(v) => setNewStatus(v as TaskStatus)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {MEMBER_STATUSES.map(s => (
                                    <SelectItem key={s} value={s}>
                                        <div className="flex items-center gap-2">
                                            <span className={`inline-block w-2 h-2 rounded-full ${
                                                s === 'review' ? 'bg-purple-500' :
                                                s === 'in-progress' ? 'bg-orange-500' :
                                                s === 'todo' ? 'bg-blue-500' :
                                                'bg-slate-400'
                                            }`} />
                                            {STATUS_LABELS[s]}
                                            {s === 'review' && (
                                                <span className="text-xs text-muted-foreground ml-1">
                                                    (notifies owner)
                                                </span>
                                            )}
                                        </div>
                                    </SelectItem>
                                ))}
                                <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground/50 cursor-not-allowed select-none">
                                    <span className="inline-block w-2 h-2 rounded-full bg-green-300" />
                                    Done
                                    <span className="text-xs ml-1">(owner approval only)</span>
                                </div>
                            </SelectContent>
                        </Select>

                        {statusChanged && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant="outline" className={STATUS_BADGE_COLORS[task.status]}>
                                    {STATUS_LABELS[task.status]}
                                </Badge>
                                <ChevronRight className="h-3 w-3" />
                                <Badge variant="outline" className={STATUS_BADGE_COLORS[newStatus]}>
                                    {STATUS_LABELS[newStatus]}
                                </Badge>
                            </div>
                        )}
                    </div>

                    {/* Note to owner */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            Note{' '}
                            <span className="text-muted-foreground font-normal">
                                (tell the owner what you did)
                            </span>
                        </label>
                        <Textarea
                            placeholder="e.g., Implemented the API endpoint, all tests passing..."
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            rows={3}
                            maxLength={500}
                        />
                        <p className="text-xs text-muted-foreground text-right">
                            {note.length}/500
                        </p>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-start gap-2">
                        <Send className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                            The project owner will be notified to review your work. They can approve it (→ Done) or request changes. You cannot mark it Done yourself.
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={saving} className="bg-purple-600 hover:bg-purple-700 text-white">
                        {saving ? 'Submitting...' : (
                            <>
                                <Send className="h-4 w-4 mr-2" />
                                Submit for Review
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ─── SortableTask ─────────────────────────────────────────────────────────────
function SortableTask({
    task,
    onClick,
    canDrag,
    isMobile,
    columnIndex,
    totalColumns,
    onMoveLeft,
    onMoveRight,
}: {
    task:         Task
    onClick:      () => void
    canDrag:      boolean
    isMobile:     boolean
    columnIndex:  number
    totalColumns: number
    onMoveLeft:   () => void
    onMoveRight:  () => void
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

    const canMove = canDrag // same permission as drag

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`relative ${isOverdue ? 'ring-1 ring-destructive rounded-lg' : ''}`}
            {...(canDrag && !isMobile ? { ...attributes, ...listeners } : {})}
        >
            {isOverdue && (
                <div className="absolute -top-1.5 -right-1.5 z-10">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive fill-white" />
                </div>
            )}

            <TaskCard task={task} onClick={onClick} />

            {/* ── Mobile move arrows ── */}
            {isMobile && canMove && (
                <div className="flex items-center gap-1.5 mt-1.5 px-0.5">
                    <button
                        type="button"
                        disabled={columnIndex === 0}
                        onClick={(e) => { e.stopPropagation(); onMoveLeft() }}
                        className="flex-1 flex items-center justify-center gap-1 h-7
                                   rounded-md text-[11px] font-medium
                                   bg-muted/60 hover:bg-muted active:scale-95
                                   text-muted-foreground hover:text-foreground
                                   disabled:opacity-25 disabled:cursor-not-allowed
                                   transition-all border border-border/40"
                    >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Back
                    </button>
                    <button
                        type="button"
                        disabled={columnIndex === totalColumns - 1}
                        onClick={(e) => { e.stopPropagation(); onMoveRight() }}
                        className="flex-1 flex items-center justify-center gap-1 h-7
                                   rounded-md text-[11px] font-medium
                                   bg-primary/10 hover:bg-primary/20 active:scale-95
                                   text-primary
                                   disabled:opacity-25 disabled:cursor-not-allowed
                                   transition-all border border-primary/20"
                    >
                        Forward
                        <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}
        </div>
    )
}

// ─── SortableColumn ───────────────────────────────────────────────────────────
function SortableColumn({
    id, title, tasks,
    onAddTask, onEditTask,
    canCreate, canDragTask,
    isMobile, columnIndex, totalColumns, onMoveTask,
}: {
    id:           string
    title:        string
    tasks:        Task[]
    onAddTask:    () => void
    onEditTask:   (t: Task) => void
    canCreate:    boolean
    canDragTask:  (task: Task) => boolean
    isMobile:     boolean
    columnIndex:  number
    totalColumns: number
    onMoveTask:   (task: Task, direction: 'left' | 'right') => void
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
            className={`flex flex-col min-w-[260px] w-[260px] rounded-lg
                        bg-muted/40 border-t-4 ${accentClass}
                        h-full
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
            <div className="flex-1 overflow-y-auto px-3 pt-2 pb-2 space-y-2.5 min-h-[80px]">
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
                                isMobile={isMobile}
                                columnIndex={columnIndex}
                                totalColumns={totalColumns}
                                onMoveLeft={() => onMoveTask(task, 'left')}
                                onMoveRight={() => onMoveTask(task, 'right')}
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

    // ── Local tasks — initialized with injected tasks or fetched from Firestore ─
    const [localTasks, setLocalTasks] = useState<Task[]>(injectedTasks ?? [])
    const [loading,    setLoading]    = useState(!injectedTasks)

    // ── Resolved task list ─────────────────────────────────────────────────────
    const tasks = localTasks

    // ── Track whether a drag or save is in progress (ref = no re-render) ─────
    // This prevents the injectedTasks sync effect from overwriting optimistic
    // local state while the user is mid-drag or while Firestore write is pending.
    const isDraggingRef = useRef(false)
    const isSavingRef   = useRef(false)

    // ── Drag / dialog state ───────────────────────────────────────────────────
    const [prevTasks,     setPrevTasks]     = useState<Task[]>([])
    const [activeId,      setActiveId]      = useState<string | null>(null)
    const [isDialogOpen,  setIsDialogOpen]  = useState(false)
    const [editingTask,   setEditingTask]   = useState<Task | null>(null)
    const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>('todo')

    // ── Submit-for-review dialog state ────────────────────────────────────────
    const [reviewDialogOpen,   setReviewDialogOpen]   = useState(false)
    const [reviewPendingTask,  setReviewPendingTask]   = useState<Task | null>(null)
    const [reviewPendingStatus, setReviewPendingStatus] = useState<TaskStatus>('review')

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
                // Skip sync while dragging or saving to avoid reverting optimistic state
                if (isDraggingRef.current || isSavingRef.current) return
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

    // ── Sync injected tasks only when NOT dragging / saving ──────────────────
    // Prevents parent re-renders from reverting an in-flight optimistic drag.
    useEffect(() => {
        if (injectedTasks && !isDraggingRef.current && !isSavingRef.current) {
            setLocalTasks(injectedTasks)
            setLoading(false)
        }
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
    // Owner/Admin → can drag any task
    // Assigned Member → can drag tasks assigned to them only
    const canDragTask = useCallback((task: Task): boolean => {
        if (isOwnerOrAdmin) return true
        if (isMember && user) {
            const isAssignee = (task.assigneeId && task.assigneeId === user.uid) ||
                               (task.assignee?.id && task.assignee.id === user.uid)
            return !!isAssignee
        }
        return false
    }, [isOwnerOrAdmin, isMember, user])

    // ── Can create new tasks ───────────────────────────────────────────────────
    const canCreate = !readOnly && isOwnerOrAdmin

    // ─────────────────────────────────────────────────────────────────────────
    // Helper: write status directly to Firestore (owner/admin path)
    // ─────────────────────────────────────────────────────────────────────────
    const writeStatusDirectly = async (taskId: string, newStatus: TaskStatus) => {
        if (!projectId) return
        try {
            const taskRef = doc(db, 'projects', projectId, 'tasks', taskId)
            const taskSnap = await getDoc(taskRef)
            if (!taskSnap.exists()) return

            const taskData = taskSnap.data()
            const prevStatus = taskData.status as TaskStatus

            if (prevStatus === newStatus) return

            await updateDoc(taskRef, {
                status:    newStatus,
                updatedAt: serverTimestamp(),
            })
            clearCache(projectId)

            if (user) {
                updateCollaborativeActivity(user.uid, projectId)
            }

            const projectRef = doc(db, 'projects', projectId)
            if (newStatus === 'done' && prevStatus !== 'done') {
                await updateDoc(projectRef, {
                    completedTasksCount: increment(1)
                }).catch(() => {})
            } else if (prevStatus === 'done' && newStatus !== 'done') {
                await updateDoc(projectRef, {
                    completedTasksCount: increment(-1)
                }).catch(() => {})
            }

            if (newStatus === 'done') {
                const assigneeId = taskData.assigneeId
                if (assigneeId) {
                    const projSnap = await getDoc(projectRef)
                    if (projSnap.exists()) {
                        const projData = projSnap.data()
                        const ownerId = projData.createdBy
                        if (ownerId && assigneeId !== ownerId) {
                            const assigneeRef = doc(db, 'users', assigneeId)
                            const assigneeSnap = await getDoc(assigneeRef)
                            if (assigneeSnap.exists()) {
                                const assigneeData = assigneeSnap.data()
                                if (!assigneeData.activated) {
                                    await updateDoc(assigneeRef, {
                                        activated: true,
                                        activatedAt: serverTimestamp(),
                                        activationPath: 'contributor'
                                    })
                                }
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.error('Error writing status directly:', err)
            throw err   // ← rethrow so handleDragEnd can revert optimistic state
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helper: submit a task status update / review (called from dialog)
    // ─────────────────────────────────────────────────────────────────────────
    const submitTaskForReview = async (task: Task, targetStatus: TaskStatus, note: string) => {
        if (!projectId || !user) return

        // ── Optimistically move card to target column immediately ──────────────
        setLocalTasks(prev =>
            prev.map(t => t.id === task.id ? { ...t, status: targetStatus } : t)
        )

        // ── Block the injectedTasks sync while the write is in flight ──────────
        isSavingRef.current = true
        try {
            await updateDoc(
                doc(db, 'projects', projectId, 'tasks', task.id),
                {
                    status:       targetStatus,
                    statusNote:   note.trim() || null,
                    reviewStatus: targetStatus === 'review' ? 'pending_review' : null,
                    submittedAt:  serverTimestamp(),
                    submittedBy:  user.uid,
                    reviewNote:   null,
                    reviewedBy:   null,
                    reviewedAt:   null,
                    updatedAt:    serverTimestamp(),
                }
            )

            // Activity log
            await addDoc(
                collection(db, 'projects', projectId, 'activities'),
                {
                    userId:      user.uid,
                    type:        'task_updated',
                    description: `${user.displayName || 'Member'} moved "${task.title}" to ${STATUS_LABELS[targetStatus]}${note ? `: "${note}"` : ''}`,
                    timestamp:   serverTimestamp(),
                    targetId:    task.id,
                    targetType:  'task',
                }
            )

            updateCollaborativeActivity(user.uid, projectId)

            toast({
                title:       targetStatus === 'review' ? 'Submitted for review!' : 'Task status updated!',
                description: targetStatus === 'review' ? 'The project owner will review your work.' : `Status changed to ${STATUS_LABELS[targetStatus]}.`,
            })
        } catch (err) {
            console.error('Failed to submit task for review:', err)
            // Revert optimistic update on failure
            setLocalTasks(prev =>
                prev.map(t => t.id === task.id ? { ...t, status: task.status } : t)
            )
            toast({
                title:       'Error',
                description: 'Could not submit task. Please try again.',
                variant:     'destructive',
            })
        } finally {
            isSavingRef.current = false
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Drag handlers
    // ─────────────────────────────────────────────────────────────────────────
    const handleDragStart = (event: DragStartEvent) => {
        isDraggingRef.current = true
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
        isDraggingRef.current = false
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

        // ── When task is moved to REVIEW → open Update Task Status modal for note ─
        if (newStatus === 'review') {
            setLocalTasks(prevTasks)
            setReviewPendingTask(activeTask)
            setReviewPendingStatus('review')
            setReviewDialogOpen(true)
            return
        }

        if (isMember && newStatus === 'done') {
            toast({
                title:       '🔒 Approval required',
                description: 'Move this task to Review first. The project owner must approve it before it can be marked Done.',
                variant:     'destructive',
            })
            setLocalTasks(prevTasks)
            return
        }

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


        // ── Write to Firestore ──────────────────────────────────────────────────
        isSavingRef.current = true
        try {
            if (projectId) {
                await writeStatusDirectly(active.id as string, newStatus)

                // ── Log activity ─────────────────────────────────────────────
                const colLabel = COLUMNS.find(c => c.id === newStatus)?.title ?? newStatus
                const prevLabel = COLUMNS.find(c => c.id === originalStatus)?.title ?? originalStatus
                await addDoc(
                    collection(db, 'projects', projectId, 'activities'),
                    {
                        userId:      user?.uid,
                        type:        'task_moved',
                        description: `${user?.displayName || 'Someone'} moved "${activeTask.title}" from ${prevLabel} → ${colLabel}`,
                        timestamp:   serverTimestamp(),
                        targetId:    active.id as string,
                        targetType:  'task',
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
        } finally {
            isSavingRef.current = false
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

            const projectRef = doc(db, 'projects', projectId)

            if (editingTask) {
                const prevStatus = editingTask.status
                const newStatus = firestorePayload.status || prevStatus

                await updateDoc(
                    doc(db, 'projects', projectId, 'tasks', editingTask.id),
                    { ...firestorePayload, updatedAt: serverTimestamp() }
                )
                toast({ title: 'Task updated' })

                updateCollaborativeActivity(auth.currentUser.uid, projectId)

                if (newStatus === 'done' && prevStatus !== 'done') {
                    await updateDoc(projectRef, {
                        completedTasksCount: increment(1)
                    }).catch(() => {})

                    // Activation check
                    try {
                        const targetAssigneeId = firestorePayload.assigneeId || editingTask.assigneeId
                        if (targetAssigneeId) {
                            const projSnap = await getDoc(projectRef)
                            if (projSnap.exists()) {
                                const projData = projSnap.data()
                                const ownerId = projData.createdBy
                                if (ownerId && targetAssigneeId !== ownerId) {
                                    const assigneeRef = doc(db, 'users', targetAssigneeId)
                                    const assigneeSnap = await getDoc(assigneeRef)
                                    if (assigneeSnap.exists()) {
                                        const assigneeData = assigneeSnap.data()
                                        if (!assigneeData.activated) {
                                            await updateDoc(assigneeRef, {
                                                activated: true,
                                                activatedAt: serverTimestamp(),
                                                activationPath: 'contributor'
                                            })
                                        }
                                    }
                                }
                            }
                        }
                    } catch (err) {
                        console.error('Activation check in handleSaveTask failed:', err)
                    }
                } else if (prevStatus === 'done' && newStatus !== 'done') {
                    await updateDoc(projectRef, {
                        completedTasksCount: increment(-1)
                    }).catch(() => {})
                }
            } else {
                const newStatus = firestorePayload.status || newTaskStatus
                await addDoc(
                    collection(db, 'projects', projectId, 'tasks'),
                    {
                        ...firestorePayload,
                        projectId,
                        status:    newStatus,
                        createdBy: auth.currentUser.uid,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    }
                )
                toast({ title: 'Task created' })

                updateCollaborativeActivity(auth.currentUser.uid, projectId)

                if (newStatus === 'done') {
                    await updateDoc(projectRef, {
                        completedTasksCount: increment(1)
                    }).catch(() => {})
                }
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

    // ── Mobile move handler ────────────────────────────────────────────────────
    const handleMoveTask = useCallback(async (task: Task, direction: 'left' | 'right') => {
        const colIndex   = COLUMNS.findIndex(c => c.id === task.status)
        const nextIndex  = direction === 'left' ? colIndex - 1 : colIndex + 1
        if (nextIndex < 0 || nextIndex >= COLUMNS.length) return

        const newStatus = COLUMNS[nextIndex].id

        // ── Members: enforce review workflow on mobile too ─────────────────────
        if (isMember) {
            if (newStatus === 'done') {
                toast({
                    title:       '🔒 Approval required',
                    description: 'The project owner must approve this task before it can be marked Done.',
                    variant:     'destructive',
                })
                return
            }

            if (newStatus === 'review') {
                setReviewPendingTask(task)
                setReviewPendingStatus('review')
                setReviewDialogOpen(true)
                return
            }
        }

        // WIP check
        const targetCount = tasks.filter(t => t.status === newStatus).length
        const wipLimit    = WIP_LIMITS[newStatus]
        if (wipLimit > 0 && targetCount >= wipLimit) {
            toast({
                title:       '⚠️ WIP Limit Reached',
                description: `"${newStatus}" column is limited to ${wipLimit} tasks.`,
                variant:     'destructive',
            })
            return
        }

        // Optimistic local update
        setLocalTasks(prev =>
            prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t)
        )

        try {
            if (projectId) {
                await writeStatusDirectly(task.id, newStatus)

                // ── Log activity ─────────────────────────────────────────────
                const colLabel  = COLUMNS.find(c => c.id === newStatus)?.title ?? newStatus
                const prevLabel = COLUMNS.find(c => c.id === task.status)?.title ?? task.status
                await addDoc(
                    collection(db, 'projects', projectId, 'activities'),
                    {
                        userId:      user?.uid,
                        type:        'task_moved',
                        description: `${user?.displayName || 'Someone'} moved "${task.title}" from ${prevLabel} → ${colLabel}`,
                        timestamp:   serverTimestamp(),
                        targetId:    task.id,
                        targetType:  'task',
                    }
                )
            }
        } catch (err) {
            console.error('Failed to move task:', err)
            toast({
                title:       'Error',
                description: 'Could not move task.',
                variant:     'destructive',
            })
            // Revert
            setLocalTasks(prev =>
                prev.map(t => t.id === task.id ? { ...t, status: task.status } : t)
            )
        }
    }, [projectId, tasks, toast, isMember])

    const openEditTaskDialog = (task: Task) => {
        setEditingTask(task)
        setIsDialogOpen(true)
    }

    // ── Dialog readOnly logic ──────────────────────────────────────────────────
    // Owner/Admin → always editable
    // Member      → ALWAYS read-only in the task dialog.
    //               Members update their task status via MyTasks panel, not here.
    // Done tasks  → read-only for non-owners (locked after approval)
    const dialogReadOnly = (() => {
        if (readOnly) return true
        if (isOwnerOrAdmin) {
            // Even owners see done tasks as read-only (prevents accidental edits)
            return false
        }
        // All members see read-only dialog
        return true
    })()

    const isMobile = useIsMobile()

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
        <div className="h-full flex flex-col gap-3 overflow-hidden">

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
            <div className="flex-1 overflow-x-auto overflow-y-hidden">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                >
                    <div className="flex h-full gap-4 min-w-max">
                        {COLUMNS.map((col, colIdx) => (
                            <SortableColumn
                                key={col.id}
                                id={col.id}
                                title={col.title}
                                tasks={tasks.filter(t => t.status === col.id)}
                                onAddTask={() => openNewTaskDialog(col.id)}
                                onEditTask={openEditTaskDialog}
                                canCreate={canCreate}
                                canDragTask={canDragTask}
                                isMobile={isMobile}
                                columnIndex={colIdx}
                                totalColumns={COLUMNS.length}
                                onMoveTask={handleMoveTask}
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

            {/* ── Submit-for-Review dialog ── */}
            <SubmitReviewDialog
                task={reviewPendingTask}
                open={reviewDialogOpen}
                targetStatus={reviewPendingStatus}
                onOpenChange={(v) => {
                    setReviewDialogOpen(v)
                    if (!v) setReviewPendingTask(null)
                }}
                onSubmit={async (status, note) => {
                    if (!reviewPendingTask) return
                    await submitTaskForReview(reviewPendingTask, status, note)
                }}
            />
        </div>
    )
}
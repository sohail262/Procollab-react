// components/dashboard/MyTasksPanel.tsx
import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
    Calendar, Clock, Tag, AlertTriangle,
    CheckCircle2, Send, ChevronRight,
    RotateCcw, MessageSquare,
} from 'lucide-react'
import type { Task, TaskStatus } from '@/types/project'
import { format } from 'date-fns'
import { isPast } from 'date-fns'
import {
    doc, updateDoc, serverTimestamp,
    collection, addDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'

// ─── Types ────────────────────────────────────────────────────────────────────
interface MyTasksPanelProps {
    tasks: Task[]
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<TaskStatus, string> = {
    backlog:       'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    todo:          'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    'in-progress': 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
    review:        'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    done:          'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
}

const STATUS_LABELS: Record<TaskStatus, string> = {
    backlog:       'Backlog',
    todo:          'To Do',
    'in-progress': 'In Progress',
    review:        'In Review',
    done:          'Done',
}

const PRIORITY_COLORS: Record<string, string> = {
    low:    'bg-blue-100 text-blue-700',
    medium: 'bg-yellow-100 text-yellow-700',
    high:   'bg-orange-100 text-orange-700',
    urgent: 'bg-red-100 text-red-700',
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function toDate(val: any): Date | null {
    if (!val) return null
    if (val instanceof Date) return val
    if (typeof val.toDate === 'function') return val.toDate()
    const d = new Date(val)
    return isNaN(d.getTime()) ? null : d
}

// ─── Review status badge ──────────────────────────────────────────────────────
function ReviewBadge({ status }: { status?: string | null }) {
    if (!status) return null

    const config: Record<string, { label: string; className: string }> = {
        pending_review:    {
            label: 'Pending Review',
            className: 'bg-yellow-100 text-yellow-700 border-yellow-300',
        },
        approved:          {
            label: 'Approved ✓',
            className: 'bg-green-100 text-green-700 border-green-300',
        },
        changes_requested: {
            label: 'Changes Requested',
            className: 'bg-red-100 text-red-700 border-red-300',
        },
    }

    const c = config[status]
    if (!c) return null

    return (
        <Badge variant="outline" className={`text-xs ${c.className}`}>
            {c.label}
        </Badge>
    )
}

// ─── Task Update Dialog ───────────────────────────────────────────────────────
interface TaskUpdateDialogProps {
    task:         Task | null
    open:         boolean
    onOpenChange: (v: boolean) => void
    onUpdated:    () => void
}

function TaskUpdateDialog({
    task, open, onOpenChange, onUpdated,
}: TaskUpdateDialogProps) {
    const { id: projectId } = useParams()
    const { user }          = useAuth()
    const { toast }         = useToast()

    const [newStatus,  setNewStatus]  = useState<TaskStatus>(task?.status ?? 'todo')
    const [statusNote, setStatusNote] = useState('')
    const [saving,     setSaving]     = useState(false)

    // Sync when task changes or dialog opens
    useEffect(() => {
        if (task) {
            // If task has changes_requested, default to in-progress so member can resubmit
            const defaultStatus = (task as any).reviewStatus === 'changes_requested'
                ? 'in-progress'
                : task.status === 'review' ? 'review' : task.status
            setNewStatus(defaultStatus as TaskStatus)
            setStatusNote('')
        }
    }, [task, open])

    const handleSubmit = async () => {
        if (!projectId || !user || !task) return
        setSaving(true)

        try {
            const isSubmittingForReview = newStatus === 'review'

            await updateDoc(
                doc(db, 'projects', projectId, 'tasks', task.id),
                {
                    status:       newStatus,
                    statusNote:   statusNote.trim() || null,
                    updatedAt:    serverTimestamp(),
                    // If submitting for review, set pending review status
                    ...(isSubmittingForReview ? {
                        reviewStatus: 'pending_review',
                        submittedAt:  serverTimestamp(),
                        submittedBy:  user.uid,
                        // Clear previous review feedback
                        reviewNote:   null,
                        reviewedBy:   null,
                        reviewedAt:   null,
                    } : {
                        // If moving back to active work, clear review status
                        reviewStatus: null,
                        submittedAt:  null,
                        submittedBy:  null,
                    }),
                }
            )

            // ── Write activity log ────────────────────────────────────────────
            await addDoc(
                collection(db, 'projects', projectId, 'activities'),
                {
                    userId:      user.uid,
                    type:        'task_updated',
                    description: `${user.displayName || 'Member'} updated "${task.title}" to ${STATUS_LABELS[newStatus]}${statusNote ? `: "${statusNote}"` : ''}`,
                    timestamp:   serverTimestamp(),
                    targetId:    task.id,
                    targetType:  'task',
                    metadata: {
                        previousStatus: task.status,
                        newStatus,
                        statusNote: statusNote.trim() || null,
                    },
                }
            )

            toast({
                title: isSubmittingForReview
                    ? '📬 Submitted for review!'
                    : '✅ Status updated',
                description: isSubmittingForReview
                    ? 'The project owner will review your work. You cannot move it to Done yourself.'
                    : `Task moved to "${STATUS_LABELS[newStatus]}"`,
            })

            onUpdated()
            onOpenChange(false)
        } catch (err) {
            console.error('Failed to update task:', err)
            toast({
                title:       'Error',
                description: 'Could not update task status.',
                variant:     'destructive',
            })
        } finally {
            setSaving(false)
        }
    }

    if (!task) return null

    // Members can only set statuses up to 'review' — 'done' is set by owner approval only
    const MEMBER_STATUSES: TaskStatus[] = ['backlog', 'todo', 'in-progress', 'review']

    const dueDate    = toDate(task.dueDate)
    const isOverdue  = dueDate && isPast(dueDate) && task.status !== 'done'
    const statusChanged = newStatus !== task.status

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <span>Update Task Status</span>
                        <Badge
                            variant="outline"
                            className={`text-xs ${PRIORITY_COLORS[task.priority]}`}
                        >
                            {task.priority}
                        </Badge>
                    </DialogTitle>
                    <DialogDescription>
                        Update the status of your assigned task and leave a note
                        for the project owner.
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
                                <div className={`flex items-center gap-1 text-xs
                                    ${isOverdue
                                        ? 'text-destructive font-medium'
                                        : 'text-muted-foreground'
                                    }`}>
                                    <Calendar className="h-3 w-3" />
                                    Due: {format(dueDate, 'MMM d, yyyy')}
                                    {isOverdue && ' (Overdue!)'}
                                </div>
                            )}
                            {task.timeEstimate && (
                                <div className="flex items-center gap-1 text-xs
                                                text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    {task.timeEstimate}h estimated
                                </div>
                            )}
                        </div>
                        {(task.tags ?? []).length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {(task.tags ?? []).map(tag => (
                                    <span key={tag}
                                        className="text-xs bg-muted px-1.5 py-0.5
                                                   rounded-full text-muted-foreground">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Previous review feedback — show if changes were requested */}
                    {(task as any).reviewStatus === 'changes_requested' &&
                     (task as any).reviewNote && (
                        <div className="bg-red-50 dark:bg-red-900/20 border
                                        border-red-200 dark:border-red-800
                                        rounded-lg p-3 space-y-1">
                            <p className="text-xs font-semibold text-red-700
                                          dark:text-red-400 flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                Owner's Feedback:
                            </p>
                            <p className="text-sm text-red-700 dark:text-red-300">
                                {(task as any).reviewNote}
                            </p>
                        </div>
                    )}

                    {/* Status selector */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            New Status
                        </label>
                        <Select
                            value={newStatus}
                            onValueChange={(v) => setNewStatus(v as TaskStatus)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {MEMBER_STATUSES.map(s => (
                                    <SelectItem key={s} value={s}>
                                        <div className="flex items-center gap-2">
                                            <span className={`inline-block w-2 h-2
                                                rounded-full ${
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
                                {/* Done is NOT selectable — only owner can approve to Done */}
                                <div className="flex items-center gap-2 px-2 py-1.5
                                                text-sm text-muted-foreground/50
                                                cursor-not-allowed select-none">
                                    <span className="inline-block w-2 h-2 rounded-full bg-green-300" />
                                    Done
                                    <span className="text-xs ml-1">(owner approval only)</span>
                                </div>
                            </SelectContent>
                        </Select>

                        {/* Status change arrow indicator */}
                        {statusChanged && (
                            <div className="flex items-center gap-2 text-xs
                                            text-muted-foreground">
                                <Badge variant="outline" className={STATUS_COLORS[task.status]}>
                                    {STATUS_LABELS[task.status]}
                                </Badge>
                                <ChevronRight className="h-3 w-3" />
                                <Badge variant="outline" className={STATUS_COLORS[newStatus]}>
                                    {STATUS_LABELS[newStatus]}
                                </Badge>
                            </div>
                        )}
                    </div>

                    {/* Note to owner */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            Note{' '}
                            {(newStatus === 'review' || newStatus === 'done') && (
                                <span className="text-muted-foreground font-normal">
                                    (tell the owner what you did)
                                </span>
                            )}
                        </label>
                        <Textarea
                            placeholder={
                                newStatus === 'review'
                                    ? 'e.g., Implemented the API endpoint, all tests passing...'
                                    : newStatus === 'done'
                                        ? 'e.g., Task completed. All requirements met...'
                                        : 'Optional: add context about this status change...'
                            }
                            value={statusNote}
                            onChange={e => setStatusNote(e.target.value)}
                            rows={3}
                            maxLength={500}
                        />
                        <p className="text-xs text-muted-foreground text-right">
                            {statusNote.length}/500
                        </p>
                    </div>

                    {/* Info banner for review submission */}
                    {newStatus === 'review' && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border
                                        border-blue-200 dark:border-blue-800
                                        rounded-lg p-3 flex items-start gap-2">
                            <Send className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-blue-700 dark:text-blue-300">
                                The project owner will be notified to review your work.
                                They can approve it (→ Done) or request changes.
                                You cannot mark it Done yourself.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={saving}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={saving}
                    >
                        {saving ? (
                            'Saving...'
                        ) : newStatus === 'review' ? (
                            <>
                                <Send className="h-4 w-4 mr-2" />
                                Submit for Review
                            </>
                        ) : (
                            'Update Status'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export function MyTasksPanel({ tasks }: MyTasksPanelProps) {
    const { user } = useAuth()
    const [selectedTask, setSelectedTask] = useState<Task | null>(null)
    const [dialogOpen,   setDialogOpen]   = useState(false)
    const [refreshKey,   setRefreshKey]   = useState(0)

    // Filter to only tasks assigned to current user
    const myTasks = useMemo(() =>
        tasks.filter(t => t.assigneeId === user?.uid),
        [tasks, user?.uid, refreshKey]
    )

    const pendingReview = myTasks.filter(
        t => (t as any).reviewStatus === 'pending_review'
    )
    const changesRequested = myTasks.filter(
        t => (t as any).reviewStatus === 'changes_requested'
    )
    const activeTasks = myTasks.filter(
        t => t.status !== 'done' &&
             (t as any).reviewStatus !== 'pending_review'
    )
    const doneTasks = myTasks.filter(
        t => t.status === 'done' &&
             (t as any).reviewStatus === 'approved'
    )

    const openUpdate = (task: Task) => {
        setSelectedTask(task)
        setDialogOpen(true)
    }

    if (myTasks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64
                            text-muted-foreground gap-3">
                <CheckCircle2 className="h-12 w-12 opacity-30" />
                <p className="text-sm font-medium">No tasks assigned to you</p>
                <p className="text-xs text-center max-w-sm">
                    The project owner will assign tasks to you. Check back later.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-6">

            {/* ── Stats row ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-muted/40 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold">{myTasks.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">Total Assigned</p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-orange-600">
                        {activeTasks.length}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">In Progress</p>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-yellow-600">
                        {pendingReview.length}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Pending Review</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-600">
                        {doneTasks.length}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Approved</p>
                </div>
            </div>

            {/* ── Changes Requested section ── */}
            {changesRequested.length > 0 && (
                <TaskSection
                    title="⚠️ Changes Requested"
                    tasks={changesRequested}
                    onUpdate={openUpdate}
                    emptyMessage=""
                    headerClass="text-red-600 dark:text-red-400"
                />
            )}

            {/* ── Active tasks section ── */}
            <TaskSection
                title="My Active Tasks"
                tasks={activeTasks}
                onUpdate={openUpdate}
                emptyMessage="No active tasks right now 🎉"
            />

            {/* ── Pending review section ── */}
            {pendingReview.length > 0 && (
                <TaskSection
                    title="Submitted for Review"
                    tasks={pendingReview}
                    onUpdate={openUpdate}
                    emptyMessage=""
                    headerClass="text-yellow-600 dark:text-yellow-400"
                />
            )}

            {/* ── Done/Approved section ── */}
            {doneTasks.length > 0 && (
                <TaskSection
                    title="Completed & Approved"
                    tasks={doneTasks}
                    onUpdate={openUpdate}
                    emptyMessage=""
                    headerClass="text-green-600 dark:text-green-400"
                    collapsed
                />
            )}

            {/* ── Update dialog ── */}
            <TaskUpdateDialog
                task={selectedTask}
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onUpdated={() => setRefreshKey(k => k + 1)}
            />
        </div>
    )
}

// ─── TaskSection ──────────────────────────────────────────────────────────────
function TaskSection({
    title, tasks, onUpdate, emptyMessage,
    headerClass = '', collapsed = false,
}: {
    title:        string
    tasks:        Task[]
    onUpdate:     (task: Task) => void
    emptyMessage: string
    headerClass?: string
    collapsed?:   boolean
}) {
    const [open, setOpen] = useState(!collapsed)

    return (
        <div>
            <button
                className="flex items-center gap-2 mb-3 w-full text-left"
                onClick={() => setOpen(o => !o)}
            >
                <h3 className={`font-semibold text-sm ${headerClass}`}>{title}</h3>
                <Badge variant="secondary" className="text-xs">{tasks.length}</Badge>
                <ChevronRight className={`h-3 w-3 ml-auto transition-transform
                    ${open ? 'rotate-90' : ''}`} />
            </button>

            {open && (
                <div className="space-y-3">
                    {tasks.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                            {emptyMessage}
                        </p>
                    ) : (
                        tasks.map(task => (
                            <TaskRow
                                key={task.id}
                                task={task}
                                onUpdate={() => onUpdate(task)}
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    )
}

// ─── TaskRow ──────────────────────────────────────────────────────────────────
function TaskRow({ task, onUpdate }: { task: Task; onUpdate: () => void }) {
    const dueDate   = toDate(task.dueDate)
    const isOverdue = dueDate && isPast(dueDate) && task.status !== 'done'
    const reviewStatus = (task as any).reviewStatus as string | undefined

    return (
        <Card className={`
            transition-all hover:shadow-md
            ${isOverdue ? 'border-destructive/50' : ''}
            ${reviewStatus === 'changes_requested' ? 'border-red-400' : ''}
            ${reviewStatus === 'pending_review' ? 'border-yellow-400 opacity-80' : ''}
            ${reviewStatus === 'approved' ? 'border-green-400' : ''}
        `}>
            <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1.5">

                        {/* Title + badges row */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium text-sm truncate">
                                {task.title}
                            </h4>
                            <Badge
                                variant="outline"
                                className={`text-xs shrink-0
                                    ${STATUS_COLORS[task.status]}`}
                            >
                                {STATUS_LABELS[task.status]}
                            </Badge>
                            <Badge
                                variant="outline"
                                className={`text-xs shrink-0
                                    ${PRIORITY_COLORS[task.priority]}`}
                            >
                                {task.priority}
                            </Badge>
                            <ReviewBadge status={reviewStatus} />
                        </div>

                        {/* Description */}
                        {task.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                                {task.description}
                            </p>
                        )}

                        {/* Meta row */}
                        <div className="flex items-center gap-3 flex-wrap">
                            {dueDate && (
                                <span className={`text-xs flex items-center gap-1
                                    ${isOverdue
                                        ? 'text-destructive font-medium'
                                        : 'text-muted-foreground'
                                    }`}>
                                    <Calendar className="h-3 w-3" />
                                    {format(dueDate, 'MMM d')}
                                    {isOverdue && ' ⚠️'}
                                </span>
                            )}
                            {task.timeEstimate && (
                                <span className="text-xs text-muted-foreground
                                                 flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {task.timeEstimate}h
                                </span>
                            )}
                            {(task.tags ?? []).slice(0, 2).map(tag => (
                                <span key={tag}
                                    className="text-xs bg-muted px-1.5 py-0.5
                                               rounded-full text-muted-foreground">
                                    {tag}
                                </span>
                            ))}
                        </div>

                        {/* Owner feedback */}
                        {reviewStatus === 'changes_requested' &&
                         (task as any).reviewNote && (
                            <div className="bg-red-50 dark:bg-red-900/20 rounded-md
                                            p-2 text-xs text-red-700 dark:text-red-300
                                            flex items-start gap-1.5 mt-1">
                                <MessageSquare className="h-3 w-3 shrink-0 mt-0.5" />
                                <span>{(task as any).reviewNote}</span>
                            </div>
                        )}

                        {/* Member's last note */}
                        {(task as any).statusNote &&
                         reviewStatus === 'pending_review' && (
                            <div className="bg-muted/60 rounded-md p-2 text-xs
                                            text-muted-foreground flex items-start
                                            gap-1.5 mt-1">
                                <Send className="h-3 w-3 shrink-0 mt-0.5" />
                                <span>Your note: {(task as any).statusNote}</span>
                            </div>
                        )}
                    </div>

                    {/* Action button */}
                    {reviewStatus !== 'pending_review' &&
                     reviewStatus !== 'approved' && (
                        <Button
                            size="sm"
                            variant={
                                reviewStatus === 'changes_requested'
                                    ? 'destructive'
                                    : 'outline'
                            }
                            onClick={onUpdate}
                            className="shrink-0"
                        >
                            {reviewStatus === 'changes_requested' ? (
                                <>
                                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                                    Resubmit
                                </>
                            ) : (
                                'Update Status'
                            )}
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
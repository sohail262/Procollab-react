// components/dashboard/TaskReviewPanel.tsx
import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
    CheckCircle2, XCircle, MessageSquare,
    Clock, Calendar, User, Send,
} from 'lucide-react'
import type { Task } from '@/types/project'
import { format } from 'date-fns'
import {
    doc, updateDoc, serverTimestamp,
    collection, addDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'

interface TaskReviewPanelProps {
    tasks:       Task[]
    teamMembers: { uid: string; name: string; avatar?: string }[]
}

function toDate(val: any): Date | null {
    if (!val) return null
    if (val instanceof Date) return val
    if (typeof val.toDate === 'function') return val.toDate()
    const d = new Date(val)
    return isNaN(d.getTime()) ? null : d
}

// ─── Review Dialog ────────────────────────────────────────────────────────────
function ReviewDialog({
    task, open, onOpenChange, teamMembers, onReviewed,
}: {
    task:         Task | null
    open:         boolean
    onOpenChange: (v: boolean) => void
    teamMembers:  { uid: string; name: string; avatar?: string }[]
    onReviewed:   () => void
}) {
    const { id: projectId } = useParams()
    const { user }          = useAuth()
    const { toast }         = useToast()

    const [feedback, setFeedback] = useState('')
    const [saving,   setSaving]   = useState(false)

    if (!task) return null

    const assignee    = teamMembers.find(m => m.uid === task.assigneeId)
    const submittedAt = toDate((task as any).submittedAt)

    const handleDecision = async (decision: 'approved' | 'changes_requested') => {
        if (!projectId || !user || !task) return
        if (decision === 'changes_requested' && !feedback.trim()) {
            toast({
                title:       'Feedback required',
                description: 'Please explain what changes are needed.',
                variant:     'destructive',
            })
            return
        }

        setSaving(true)
        try {
            // ── Update task ───────────────────────────────────────────────────
            await updateDoc(
                doc(db, 'projects', projectId, 'tasks', task.id),
                {
                    reviewStatus: decision,
                    reviewNote:   feedback.trim() || null,
                    reviewedBy:   user.uid,
                    reviewedAt:   serverTimestamp(),
                    updatedAt:    serverTimestamp(),
                    // If approved, mark as done
                    ...(decision === 'approved' ? { status: 'done' } : {}),
                }
            )

            // ── Notify the member ─────────────────────────────────────────────
            if (task.assigneeId) {
                await addDoc(
                    collection(db, 'users', task.assigneeId, 'notifications'),
                    {
                        title: decision === 'approved'
                            ? '✅ Task Approved!'
                            : '🔄 Changes Requested',
                        body: decision === 'approved'
                            ? `Your task "${task.title}" has been approved!`
                            : `Changes requested for "${task.title}": ${feedback.trim()}`,
                        type: decision === 'approved' ? 'success' : 'warning',
                        read: false,
                        timestamp:  serverTimestamp(),
                        projectId:  projectId,
                        data: {
                            taskId:   task.id,
                            taskTitle: task.title,
                            reviewNote: feedback.trim() || null,
                        },
                    }
                )
            }

            // ── Activity log ──────────────────────────────────────────────────
            await addDoc(
                collection(db, 'projects', projectId, 'activities'),
                {
                    userId:      user.uid,
                    type:        'task_updated',
                    description: decision === 'approved'
                        ? `Approved task "${task.title}"`
                        : `Requested changes for "${task.title}": ${feedback.trim()}`,
                    timestamp:   serverTimestamp(),
                    targetId:    task.id,
                    targetType:  'task',
                }
            )

            toast({
                title: decision === 'approved'
                    ? '✅ Task approved!'
                    : '📬 Feedback sent',
                description: decision === 'approved'
                    ? `"${task.title}" marked as complete.`
                    : 'Member has been notified.',
            })

            setFeedback('')
            onReviewed()
            onOpenChange(false)
        } catch (err) {
            console.error('Review failed:', err)
            toast({
                title:       'Error',
                description: 'Could not submit review.',
                variant:     'destructive',
            })
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <DialogTitle>Review Task</DialogTitle>
                    <DialogDescription>
                        Review the submitted work and approve or request changes.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">

                    {/* Task details */}
                    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                        <h3 className="font-semibold">{task.title}</h3>
                        {task.description && (
                            <p className="text-sm text-muted-foreground">
                                {task.description}
                            </p>
                        )}

                        {/* Submitted by */}
                        {assignee && (
                            <div className="flex items-center gap-2 text-sm">
                                <Avatar className="h-6 w-6">
                                    <AvatarImage src={assignee.avatar} />
                                    <AvatarFallback className="text-xs">
                                        {assignee.name.charAt(0)}
                                    </AvatarFallback>
                                </Avatar>
                                <span className="text-muted-foreground">
                                    Submitted by{' '}
                                    <span className="font-medium text-foreground">
                                        {assignee.name}
                                    </span>
                                </span>
                                {submittedAt && (
                                    <span className="text-xs text-muted-foreground ml-auto">
                                        {format(submittedAt, 'MMM d, h:mm a')}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Member's note */}
                    {(task as any).statusNote && (
                        <div className="space-y-1">
                            <p className="text-sm font-medium flex items-center gap-1.5">
                                <Send className="h-3.5 w-3.5" />
                                Member's Note:
                            </p>
                            <div className="bg-blue-50 dark:bg-blue-900/20 border
                                            border-blue-200 dark:border-blue-800
                                            rounded-lg p-3 text-sm
                                            text-blue-800 dark:text-blue-200">
                                {(task as any).statusNote}
                            </div>
                        </div>
                    )}

                    {/* Feedback textarea */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            Your Feedback{' '}
                            <span className="text-muted-foreground font-normal">
                                (required if requesting changes)
                            </span>
                        </label>
                        <Textarea
                            placeholder="e.g., Looks good! or Please fix the error handling in line 42..."
                            value={feedback}
                            onChange={e => setFeedback(e.target.value)}
                            rows={3}
                            maxLength={500}
                        />
                    </div>
                </div>

                <DialogFooter className="flex gap-2 sm:gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={saving}
                        className="flex-1 sm:flex-none"
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={() => handleDecision('changes_requested')}
                        disabled={saving || !feedback.trim()}
                        className="flex-1 sm:flex-none"
                    >
                        <XCircle className="h-4 w-4 mr-2" />
                        Request Changes
                    </Button>
                    <Button
                        onClick={() => handleDecision('approved')}
                        disabled={saving}
                        className="flex-1 sm:flex-none bg-green-600
                                   hover:bg-green-700 text-white"
                    >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Approve
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export function TaskReviewPanel({ tasks, teamMembers }: TaskReviewPanelProps) {
    const [selectedTask, setSelectedTask] = useState<Task | null>(null)
    const [dialogOpen,   setDialogOpen]   = useState(false)
    const [refreshKey,   setRefreshKey]   = useState(0)

    const pendingTasks = useMemo(() =>
        tasks.filter(t => (t as any).reviewStatus === 'pending_review'),
        [tasks, refreshKey]
    )

    if (pendingTasks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-40
                            text-muted-foreground gap-2">
                <CheckCircle2 className="h-10 w-10 opacity-30" />
                <p className="text-sm">No tasks pending review</p>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
                <h3 className="font-semibold">Pending Your Review</h3>
                <Badge variant="destructive">{pendingTasks.length}</Badge>
            </div>

            {pendingTasks.map(task => {
                const assignee    = teamMembers.find(m => m.uid === task.assigneeId)
                const submittedAt = toDate((task as any).submittedAt)

                return (
                    <Card key={task.id}
                          className="border-yellow-300 dark:border-yellow-700">
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0 space-y-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className="font-medium text-sm truncate">
                                            {task.title}
                                        </h4>
                                        <Badge variant="outline"
                                               className="text-xs bg-yellow-100
                                                          text-yellow-700
                                                          border-yellow-300">
                                            Pending Review
                                        </Badge>
                                    </div>

                                    {assignee && (
                                        <div className="flex items-center gap-1.5 text-xs
                                                        text-muted-foreground">
                                            <Avatar className="h-4 w-4">
                                                <AvatarImage src={assignee.avatar} />
                                                <AvatarFallback className="text-[10px]">
                                                    {assignee.name.charAt(0)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span>{assignee.name}</span>
                                            {submittedAt && (
                                                <>
                                                    <span>·</span>
                                                    <span>
                                                        {format(submittedAt, 'MMM d, h:mm a')}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {(task as any).statusNote && (
                                        <p className="text-xs bg-muted/60 rounded
                                                       px-2 py-1 text-muted-foreground
                                                       line-clamp-1">
                                            "{(task as any).statusNote}"
                                        </p>
                                    )}
                                </div>

                                <Button
                                    size="sm"
                                    onClick={() => {
                                        setSelectedTask(task)
                                        setDialogOpen(true)
                                    }}
                                >
                                    Review
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )
            })}

            <ReviewDialog
                task={selectedTask}
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                teamMembers={teamMembers}
                onReviewed={() => setRefreshKey(k => k + 1)}
            />
        </div>
    )
}
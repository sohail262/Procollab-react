import { useState, useEffect } from 'react'
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Label }  from '@/components/ui/label'
import { Badge }  from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import type { Task, TaskPriority, TaskStatus } from '@/types/project'
import { Loader2, User, X, Plus, Lock } from 'lucide-react'
import {
    collection, getDocs, doc, getDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useParams } from 'react-router-dom'
import { format } from 'date-fns'

interface TaskDialogProps {
    open:         boolean
    onOpenChange: (open: boolean) => void
    task?:        Task | null
    onSave:       (task: Partial<Task>) => Promise<void>
    readOnly?:    boolean   // ← NEW: plain members viewing others' tasks
}

interface TeamMember {
    id:      string
    uid:     string
    name:    string
    email:   string
    avatar?: string
    role:    string
}

// ── Safe timestamp → Date ─────────────────────────────────────────────────────
function toDate(val: any): Date | undefined {
    if (!val) return undefined
    if (val instanceof Date) return val
    if (typeof val.toDate === 'function') return val.toDate()
    const d = new Date(val)
    return isNaN(d.getTime()) ? undefined : d
}

export function TaskDialog({
    open, onOpenChange, task, onSave, readOnly = false,
}: TaskDialogProps) {
    const { id: projectId } = useParams()

    const [loading,        setLoading]        = useState(false)
    const [teamMembers,    setTeamMembers]    = useState<TeamMember[]>([])
    const [loadingMembers, setLoadingMembers] = useState(false)
    const [tagInput,       setTagInput]       = useState('')

    const blankForm = (): Partial<Task> => ({
        title:        '',
        description:  '',
        status:       'todo',
        priority:     'medium',
        timeEstimate: 0,
        tags:         [],
        dueDate:      undefined,
        assigneeId:   '',
        assignee:     undefined,
    })

    const [formData, setFormData] = useState<Partial<Task>>(blankForm())

    // ── Reset form when dialog opens/closes or task changes ──────────────────
    useEffect(() => {
        if (open) {
            setFormData(
                task
                    ? {
                        title:        task.title        || '',
                        description:  task.description  || '',
                        status:       task.status       || 'todo',
                        priority:     task.priority     || 'medium',
                        timeEstimate: task.timeEstimate || 0,
                        tags:         task.tags         || [],
                        dueDate:      toDate(task.dueDate),
                        assigneeId:   task.assigneeId   || '',
                        assignee:     task.assignee     || undefined,
                    }
                    : blankForm()
            )
            setTagInput('')
        }
    }, [open, task])

    // ── Load team members (skip if readOnly — saves a Firestore read) ─────────
    useEffect(() => {
        if (open && projectId && !readOnly) loadTeamMembers()
    }, [open, projectId, readOnly])

    const loadTeamMembers = async () => {
        if (!projectId) return
        setLoadingMembers(true)
        try {
            const members: TeamMember[] = []

            // ── Batch: members sub-collection + project doc in parallel ───────
            const [membersSnap, projSnap] = await Promise.all([
                getDocs(collection(db, 'projects', projectId, 'members')),
                getDoc(doc(db, 'projects', projectId)),
            ])

            membersSnap.docs.forEach(d => {
                const data = d.data()
                members.push({
                    id:     d.id,
                    uid:    data.uid    || d.id,
                    name:   data.name   || data.displayName || 'Unknown',
                    email:  data.email  || '',
                    avatar: data.avatar || data.photoURL    || '',
                    role:   data.role   || 'member',
                })
            })

            // ── Add owner if not already in members sub-collection ────────────
            if (projSnap.exists()) {
                const createdBy = projSnap.data().createdBy
                const alreadyIn = members.some(m => m.uid === createdBy)
                if (createdBy && !alreadyIn) {
                    // Owner may also be in teamMembers map — try to get their
                    // user doc. We do this only once, not in a loop.
                    try {
                        const ownerSnap = await getDoc(doc(db, 'users', createdBy))
                        if (ownerSnap.exists()) {
                            const u = ownerSnap.data()
                            members.unshift({
                                id:     createdBy,
                                uid:    createdBy,
                                name:   `${u.firstName || ''} ${u.lastName || ''}`.trim()
                                    || u.displayName || u.email || 'Owner',
                                email:  u.email   || '',
                                avatar: u.photoURL || '',
                                role:   'owner',
                            })
                        }
                    } catch { /* non-fatal */ }
                }
            }

            setTeamMembers(members)
        } catch (error) {
            console.error('Error loading team members:', error)
        } finally {
            setLoadingMembers(false)
        }
    }

    // ── Assignee change ───────────────────────────────────────────────────────
    const handleAssigneeChange = (memberId: string) => {
        if (readOnly) return
        if (memberId === 'unassigned') {
            setFormData(prev => ({ ...prev, assigneeId: '', assignee: undefined }))
        } else {
            const m = teamMembers.find(m => m.uid === memberId)
            if (m) {
                setFormData(prev => ({
                    ...prev,
                    assigneeId: m.uid,
                    assignee: { id: m.uid, name: m.name, avatar: m.avatar },
                }))
            }
        }
    }

    // ── Tag helpers ───────────────────────────────────────────────────────────
    const addTag = () => {
        if (readOnly) return
        const tag = tagInput.trim()
        if (!tag) return
        const currentTags = formData.tags ?? []
        if (currentTags.includes(tag)) { setTagInput(''); return }
        setFormData(prev => ({ ...prev, tags: [...currentTags, tag] }))
        setTagInput('')
    }

    const removeTag = (tag: string) => {
        if (readOnly) return
        setFormData(prev => ({
            ...prev,
            tags: (prev.tags ?? []).filter(t => t !== tag),
        }))
    }

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        // ⛔ Hard block — readOnly users cannot submit
        if (readOnly || !formData.title?.trim()) return

        setLoading(true)
        try {
            const payload: Partial<Task> = {
                title:        formData.title?.trim(),
                description:  formData.description?.trim() || '',
                status:       formData.status  || 'todo',
                priority:     formData.priority || 'medium',
                timeEstimate: formData.timeEstimate || 0,
                tags:         formData.tags || [],
                ...(formData.assigneeId
                    ? { assigneeId: formData.assigneeId, assignee: formData.assignee }
                    : { assigneeId: undefined, assignee: undefined }
                ),
                ...(formData.dueDate ? { dueDate: formData.dueDate } : {}),
            }

            await onSave(payload)
            onOpenChange(false)
        } catch (error) {
            console.error('Error saving task:', error)
        } finally {
            setLoading(false)
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {task
                            ? readOnly ? 'View Task' : 'Edit Task'
                            : 'Create New Task'}
                    </DialogTitle>
                    <DialogDescription>
                        {readOnly
                            ? 'You have view-only access to this task.'
                            : task
                                ? 'Update task details and status.'
                                : 'Add a new task to your project.'}
                    </DialogDescription>
                </DialogHeader>

                {/* ── Read-only banner ─────────────────────────────────────── */}
                {readOnly && (
                    <div className="flex items-center gap-2
                                    bg-yellow-50 dark:bg-yellow-900/20
                                    border border-yellow-200 dark:border-yellow-800
                                    rounded-lg p-3 text-sm
                                    text-yellow-700 dark:text-yellow-400">
                        <Lock className="h-4 w-4 shrink-0" />
                        You can view this task but cannot edit it.
                        Only the task assignee or project admin can make changes.
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 py-2">

                    {/* Title */}
                    <div className="space-y-2">
                        <Label htmlFor="title">
                            Task Title{' '}
                            {!readOnly && <span className="text-destructive">*</span>}
                        </Label>
                        <Input
                            id="title"
                            value={formData.title}
                            onChange={e =>
                                !readOnly &&
                                setFormData(prev => ({ ...prev, title: e.target.value }))
                            }
                            placeholder="e.g., Implement User Authentication"
                            required={!readOnly}
                            readOnly={readOnly}
                            className={readOnly ? 'opacity-70 cursor-not-allowed' : ''}
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={formData.description}
                            onChange={e =>
                                !readOnly &&
                                setFormData(prev => ({ ...prev, description: e.target.value }))
                            }
                            placeholder="Detailed description of the task..."
                            rows={3}
                            readOnly={readOnly}
                            className={readOnly ? 'opacity-70 cursor-not-allowed' : ''}
                        />
                    </div>

                    {/* Status / Priority / Assignee */}
                    <div className="grid grid-cols-3 gap-4">

                        {/* Status */}
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select
                                value={formData.status}
                                onValueChange={(v: TaskStatus) =>
                                    !readOnly &&
                                    setFormData(prev => ({ ...prev, status: v }))
                                }
                                disabled={readOnly}
                            >
                                <SelectTrigger
                                    className={readOnly ? 'opacity-70 cursor-not-allowed' : ''}
                                >
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="backlog">Backlog</SelectItem>
                                    <SelectItem value="todo">To Do</SelectItem>
                                    <SelectItem value="in-progress">In Progress</SelectItem>
                                    <SelectItem value="review">Review</SelectItem>
                                    <SelectItem value="done">Done</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Priority */}
                        <div className="space-y-2">
                            <Label>Priority</Label>
                            <Select
                                value={formData.priority}
                                onValueChange={(v: TaskPriority) =>
                                    !readOnly &&
                                    setFormData(prev => ({ ...prev, priority: v }))
                                }
                                disabled={readOnly}
                            >
                                <SelectTrigger
                                    className={readOnly ? 'opacity-70 cursor-not-allowed' : ''}
                                >
                                    <SelectValue placeholder="Select priority" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                    <SelectItem value="urgent">Urgent</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Assign To */}
                        <div className="space-y-2">
                            <Label>Assign To</Label>
                            {readOnly ? (
                                // ── Read-only: just show the assignee avatar + name ──
                                <div className="flex items-center gap-2 h-10 px-3
                                                border rounded-md opacity-70">
                                    {formData.assignee ? (
                                        <>
                                            <Avatar className="h-5 w-5">
                                                <AvatarImage src={formData.assignee.avatar} />
                                                <AvatarFallback className="text-xs">
                                                    {formData.assignee.name.charAt(0).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="text-sm truncate">
                                                {formData.assignee.name}
                                            </span>
                                        </>
                                    ) : (
                                        <span className="text-sm text-muted-foreground">
                                            Unassigned
                                        </span>
                                    )}
                                </div>
                            ) : (
                                <Select
                                    value={formData.assigneeId || 'unassigned'}
                                    onValueChange={handleAssigneeChange}
                                    disabled={loadingMembers}
                                >
                                    <SelectTrigger>
                                        <SelectValue
                                            placeholder={
                                                loadingMembers ? 'Loading…' : 'Select member'
                                            }
                                        >
                                            {formData.assignee ? (
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-5 w-5">
                                                        <AvatarImage src={formData.assignee.avatar} />
                                                        <AvatarFallback className="text-xs">
                                                            {formData.assignee.name
                                                                .charAt(0)
                                                                .toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="truncate">
                                                        {formData.assignee.name}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">
                                                    Unassigned
                                                </span>
                                            )}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unassigned">
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-muted-foreground" />
                                                <span>Unassigned</span>
                                            </div>
                                        </SelectItem>
                                        {loadingMembers ? (
                                            <div className="py-2 text-center text-sm
                                                            text-muted-foreground">
                                                Loading members…
                                            </div>
                                        ) : teamMembers.length === 0 ? (
                                            <div className="py-2 text-center text-sm
                                                            text-muted-foreground">
                                                No members found
                                            </div>
                                        ) : (
                                            teamMembers.map(member => (
                                                <SelectItem key={member.uid} value={member.uid}>
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-5 w-5">
                                                            <AvatarImage src={member.avatar} />
                                                            <AvatarFallback className="text-xs">
                                                                {member.name.charAt(0).toUpperCase()}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex flex-col">
                                                            <span className="truncate text-sm">
                                                                {member.name}
                                                            </span>
                                                            <span className="text-xs
                                                                            text-muted-foreground
                                                                            capitalize">
                                                                {member.role}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    </div>

                    {/* Due Date / Time Estimate */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="dueDate">Due Date & Time</Label>
                            <DateTimePicker
                                date={
                                    formData.dueDate instanceof Date
                                        ? formData.dueDate
                                        : undefined
                                }
                                onDateChange={(date) =>
                                    !readOnly && setFormData({ ...formData, dueDate: date })
                                }
                                placeholder="Select due date and time"
                                showTime={true}
                                disabled={readOnly}
                                disablePast={!task}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="estimate">Time Estimate (hours)</Label>
                            <Input
                                id="estimate"
                                type="number"
                                min="0"
                                step="0.5"
                                value={formData.timeEstimate || ''}
                                onChange={e =>
                                    !readOnly &&
                                    setFormData(prev => ({
                                        ...prev,
                                        timeEstimate: parseFloat(e.target.value) || 0,
                                    }))
                                }
                                readOnly={readOnly}
                                className={readOnly ? 'opacity-70 cursor-not-allowed' : ''}
                            />
                        </div>
                    </div>

                    {/* Tags */}
                    <div className="space-y-2">
                        <Label>Tags</Label>
                        {!readOnly && (
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Add a tag (e.g. frontend, api)"
                                    value={tagInput}
                                    onChange={e => setTagInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault()
                                            addTag()
                                        }
                                    }}
                                    className="flex-1"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={addTag}
                                    disabled={!tagInput.trim()}
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                        {(formData.tags ?? []).length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {(formData.tags ?? []).map(tag => (
                                    <Badge
                                        key={tag}
                                        variant="secondary"
                                        className="flex items-center gap-1 pr-1"
                                    >
                                        {tag}
                                        {!readOnly && (
                                            <button
                                                type="button"
                                                onClick={() => removeTag(tag)}
                                                className="ml-0.5 rounded-full
                                                           hover:bg-muted-foreground/20
                                                           p-0.5 transition-colors"
                                            >
                                                <X className="h-2.5 w-2.5" />
                                            </button>
                                        )}
                                    </Badge>
                                ))}
                            </div>
                        )}
                        {readOnly && (formData.tags ?? []).length === 0 && (
                            <p className="text-sm text-muted-foreground">No tags</p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                        >
                            {readOnly ? 'Close' : 'Cancel'}
                        </Button>

                        {/* ── Hide submit button for readOnly ── */}
                        {!readOnly && (
                            <Button
                                type="submit"
                                disabled={loading || !formData.title?.trim()}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving…
                                    </>
                                ) : task ? (
                                    'Update Task'
                                ) : (
                                    'Create Task'
                                )}
                            </Button>
                        )}
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
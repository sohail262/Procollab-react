import { useState, useEffect, useMemo } from 'react'
import {
    Calendar, dateFnsLocalizer,
    Views, View, SlotInfo,
} from 'react-big-calendar'
import {
    format, parse, startOfWeek,
    getDay, isPast, isToday, isFuture,
} from 'date-fns'
import { enUS } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import {
    Card, CardContent, CardHeader,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Task } from '@/types/project'
import {
    collection, query, onSnapshot,
    addDoc, updateDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { TaskDialog } from './TaskDialog'
import { useToast } from '@/hooks/use-toast'
import { useProjectRole } from '@/hooks/use-project-role'
import {
    Plus, ChevronLeft, ChevronRight,
    Calendar as CalendarIcon, AlertTriangle,
    CheckCircle2, Clock, Circle,
} from 'lucide-react'
import { Skeleton as SkeletonUI } from '@/components/ui/skeleton'

// ─── Localizer ────────────────────────────────────────────────────────────────
const localizer = dateFnsLocalizer({
    format, parse, startOfWeek, getDay,
    locales: { 'en-US': enUS },
})

// ─── Priority & Status colour maps ────────────────────────────────────────────
const PRIORITY_COLORS: Record<string, string> = {
    low: '#22c55e',
    medium: '#3b82f6',
    high: '#f97316',
    urgent: '#ef4444',
}

const STATUS_COLORS: Record<string, string> = {
    backlog: '#94a3b8',
    todo: '#64748b',
    'in-progress': '#3b82f6',
    review: '#a855f7',
    done: '#22c55e',
}

// ─── Custom Toolbar ───────────────────────────────────────────────────────────
const CustomToolbar = ({
    toolbar, canEdit, onAddEvent,
}: {
    toolbar: any; canEdit: boolean; onAddEvent: () => void
}) => (
    <div className="flex items-center justify-between mb-4 p-2 bg-muted/30 rounded-lg flex-wrap gap-2">
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => toolbar.onNavigate('PREV')}>
                <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => toolbar.onNavigate('TODAY')}>
                Today
            </Button>
            <Button variant="outline" size="sm" onClick={() => toolbar.onNavigate('NEXT')}>
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>

        <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-muted-foreground" />
            <span className="text-lg font-semibold text-foreground">
                {format(toolbar.date, 'MMMM yyyy')}
            </span>
        </div>

        <div className="flex items-center gap-2">
            <div className="flex bg-muted rounded-md p-1">
                {['month', 'week', 'day', 'agenda'].map(v => (
                    <button
                        key={v}
                        onClick={() => toolbar.onView(v)}
                        className={`px-3 py-1 text-sm rounded-sm transition-colors ${toolbar.view === v
                                ? 'bg-background shadow-sm text-foreground font-medium'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                    </button>
                ))}
            </div>
            {canEdit && (
                <Button size="sm" onClick={onAddEvent}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Task
                </Button>
            )}
        </div>
    </div>
)

// ─── Main Component ───────────────────────────────────────────────────────────
interface ProjectCalendarProps {
    readOnly?: boolean
}

export function ProjectCalendar({ readOnly = false }: ProjectCalendarProps) {
    const { id: projectId } = useParams()
    const { user } = useAuth()
    const { toast } = useToast()
    const { canEdit: canEditRole } = useProjectRole()
    const canEdit = canEditRole && !readOnly

    const [tasks, setTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(true)
    const [view, setView] = useState<View>(Views.MONTH)
    const [date, setDate] = useState(new Date())
    const [colorBy, setColorBy] = useState<'priority' | 'status'>('priority')

    // Dialog state
    const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false)
    const [selectedTask, setSelectedTask] = useState<Task | null>(null)
    const [selectedDate, setSelectedDate] = useState<Date | undefined>()

    // ── Firestore listener ──────────────────────────────────────────────────
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
                console.error('ProjectCalendar listener error:', err)
                setLoading(false)
            }
        )

        return () => unsubscribe()
    }, [projectId, user])

    // ── Safe Timestamp converter ────────────────────────────────────────────
    const toDate = (value: any): Date | null => {
        if (!value) return null
        if (value instanceof Date) return value
        if (typeof value.toDate === 'function') return value.toDate()
        const d = new Date(value)
        return isNaN(d.getTime()) ? null : d
    }

    // ── Build calendar events ───────────────────────────────────────────────
    const events = useMemo(() => {
        return tasks
            .filter(t => t.dueDate)
            .map(t => {
                const dueDate = toDate(t.dueDate)
                if (!dueDate) return null

                const overdue = isPast(dueDate) && t.status !== 'done'
                const dueNow = isToday(dueDate)

                return {
                    id: t.id,
                    title: t.title,
                    start: dueDate,
                    end: dueDate,
                    allDay: true,
                    resource: t,
                    overdue,
                    dueNow,
                }
            })
            .filter(Boolean) as any[]
    }, [tasks])

    // ── Deadline summary stats ──────────────────────────────────────────────
    const stats = useMemo(() => ({
        overdue: events.filter(e => e.overdue).length,
        dueToday: events.filter(e => e.dueNow).length,
        upcoming: events.filter(e => isFuture(e.start) && !e.dueNow).length,
        completed: tasks.filter(t => t.status === 'done').length,
    }), [events, tasks])

    // ── Event styles ─────────────────────────────────────────────────────────
    const eventStyleGetter = (event: any) => {
        const task = event.resource
        const colorMap = colorBy === 'priority' ? PRIORITY_COLORS : STATUS_COLORS
        const key = colorBy === 'priority' ? task.priority : task.status
        let bgColor = colorMap[key] ?? '#3b82f6'

        if (event.overdue) bgColor = '#ef4444'

        return {
            style: {
                backgroundColor: bgColor,
                borderRadius: '5px',
                opacity: task.status === 'done' ? 0.55 : 0.92,
                color: 'white',
                border: event.dueNow ? '2px solid white' : '0px',
                boxShadow: event.overdue ? '0 0 0 2px #ef4444' : 'none',
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: task.status === 'done' ? 400 : 500,
            },
        }
    }

    // ── Slot / event handlers ───────────────────────────────────────────────
    const handleSelectSlot = (slotInfo: SlotInfo) => {
        if (!canEdit) return
        setSelectedDate(slotInfo.start)
        setSelectedTask(null)
        setIsTaskDialogOpen(true)
    }

    const handleSelectEvent = (event: any) => {
        setSelectedTask({ ...event.resource, dueDate: event.start })
        setSelectedDate(event.start)
        setIsTaskDialogOpen(true)
    }

    const handleSaveTask = async (taskData: Partial<Task>) => {
        if (!projectId || !user) return
        try {
            if (selectedTask) {
                await updateDoc(
                    doc(db, 'projects', projectId, 'tasks', selectedTask.id),
                    { ...taskData, updatedAt: serverTimestamp() }
                )
                toast({ title: 'Task updated ✅' })
            } else {
                await addDoc(collection(db, 'projects', projectId, 'tasks'), {
                    ...taskData,
                    projectId,
                    createdBy: user.uid,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    tags: taskData.tags ?? [],
                    dueDate: taskData.dueDate ?? selectedDate,
                })
                toast({ title: 'Task created 🎉' })
            }
            setIsTaskDialogOpen(false)
        } catch (error) {
            console.error('Error saving task:', error)
            toast({ title: 'Error', description: 'Failed to save task.', variant: 'destructive' })
        }
    }

    // ── Loading ─────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-[600px] w-full" />
            </div>
        )
    }

    return (
        <div className="h-[calc(100vh-12rem)] flex flex-col gap-3">

            {/* ── Stats bar ── */}
            <div className="flex flex-wrap items-center gap-3 px-1 flex-shrink-0">

                {/* Completion */}
                <div className="flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-1.5">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium text-green-700">
                        {stats.completed} completed
                    </span>
                </div>

                {/* Due today */}
                {stats.dueToday > 0 && (
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200
                                      hover:bg-blue-100 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {stats.dueToday} due today
                    </Badge>
                )}

                {/* Upcoming */}
                {stats.upcoming > 0 && (
                    <Badge variant="outline" className="flex items-center gap-1">
                        <Circle className="h-3 w-3 text-muted-foreground" />
                        {stats.upcoming} upcoming
                    </Badge>
                )}

                {/* Overdue */}
                {stats.overdue > 0 && (
                    <Badge variant="destructive" className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {stats.overdue} overdue
                    </Badge>
                )}

                {/* Colour-by toggle */}
                <div className="ml-auto flex items-center gap-1.5 bg-muted rounded-lg p-1">
                    <button
                        onClick={() => setColorBy('priority')}
                        className={`px-3 py-1 text-xs rounded-md transition-colors font-medium ${colorBy === 'priority'
                                ? 'bg-background shadow-sm text-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        By Priority
                    </button>
                    <button
                        onClick={() => setColorBy('status')}
                        className={`px-3 py-1 text-xs rounded-md transition-colors font-medium ${colorBy === 'status'
                                ? 'bg-background shadow-sm text-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        By Status
                    </button>
                </div>
            </div>

            {/* ── Legend ── */}
            <div className="flex flex-wrap gap-3 px-1 flex-shrink-0">
                {Object.entries(
                    colorBy === 'priority' ? PRIORITY_COLORS : STATUS_COLORS
                ).map(([key, color]) => (
                    <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span
                            className="inline-block w-3 h-3 rounded-sm"
                            style={{ backgroundColor: color }}
                        />
                        {key.charAt(0).toUpperCase() + key.slice(1).replace('-', ' ')}
                    </div>
                ))}
                <div className="flex items-center gap-1.5 text-xs text-destructive font-medium">
                    <span className="inline-block w-3 h-3 rounded-sm bg-destructive" />
                    Overdue
                </div>
            </div>

            {/* ── Calendar ── */}
            <div className="flex-1 min-h-0">
                <style>{`
                    .rbc-calendar          { font-family: inherit; height: 100%; }
                    .rbc-header            { padding: 10px 4px; font-weight: 600;
                                             color: hsl(var(--muted-foreground));
                                             text-transform: uppercase; font-size: 0.7rem; }
                    .rbc-today             { background-color: hsl(var(--muted)/0.5) !important; }
                    .rbc-off-range-bg      { background-color: hsl(var(--background)); opacity: 0.6; }
                    .rbc-month-view        { border: 1px solid hsl(var(--border));
                                             border-radius: var(--radius); overflow: hidden; }
                    .rbc-header + .rbc-header,
                    .rbc-day-bg + .rbc-day-bg    { border-left: 1px solid hsl(var(--border)); }
                    .rbc-month-row + .rbc-month-row { border-top: 1px solid hsl(var(--border)); }
                    .rbc-agenda-view table  { width: 100%; }
                    .rbc-agenda-date-cell,
                    .rbc-agenda-time-cell  { white-space: nowrap; color: hsl(var(--muted-foreground)); }
                    .rbc-show-more         { color: hsl(var(--primary)); font-weight: 600; }
                    .rbc-event:focus       { outline: 2px solid hsl(var(--ring)); outline-offset: 1px; }
                `}</style>

                <Calendar
                    localizer={localizer}
                    events={events}
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height: '100%' }}
                    views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
                    view={view}
                    onView={setView}
                    date={date}
                    onNavigate={setDate}
                    eventPropGetter={eventStyleGetter}
                    components={{
                        toolbar: (toolbarProps: any) => (
                            <CustomToolbar
                                toolbar={toolbarProps}
                                canEdit={canEdit}
                                onAddEvent={() => {
                                    setSelectedTask(null)
                                    setSelectedDate(new Date())
                                    setIsTaskDialogOpen(true)
                                }}
                            />
                        ),
                    }}
                    selectable={canEdit}
                    onSelectSlot={handleSelectSlot}
                    onSelectEvent={handleSelectEvent}
                    popup
                    tooltipAccessor={(event: any) =>
                        `${event.title} • ${event.resource.priority ?? ''} priority • ${event.resource.status}`
                    }
                />
            </div>

            <TaskDialog
                open={isTaskDialogOpen}
                onOpenChange={setIsTaskDialogOpen}
                task={
                    selectedTask
                        ? { ...selectedTask, dueDate: selectedTask.dueDate }
                        : selectedDate
                            ? ({ dueDate: selectedDate } as any)
                            : undefined
                }
                onSave={handleSaveTask}
            />
        </div>
    )
}
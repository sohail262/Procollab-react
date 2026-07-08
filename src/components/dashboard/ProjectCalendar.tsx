// ProjectCalendar.tsx
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
    orderBy, Timestamp,
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
    CheckCircle2, Clock, Circle, Video,
    ExternalLink, Copy,
} from 'lucide-react'
import {
    Dialog, DialogContent, DialogDescription,
    DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

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

// ─── Meeting colour ───────────────────────────────────────────────────────────
const MEETING_COLOR = '#6366f1' // indigo

// ─── Calendar Meeting type (minimal, for display) ─────────────────────────────
interface CalendarMeeting {
    id: string
    title: string
    meetLink: string
    scheduledAt: Date
    endTime: Date
    createdByName: string
    isInstant: boolean
    status: 'scheduled' | 'active' | 'ended'
}

// ─── Meeting Detail Popup ─────────────────────────────────────────────────────
function MeetingDetailDialog({
    meeting,
    open,
    onOpenChange,
    onCopyLink,
}: {
    meeting: CalendarMeeting | null
    open: boolean
    onOpenChange: (v: boolean) => void
    onCopyLink: (link: string) => void
}) {
    if (!meeting) return null

    const hasEnded = meeting.status === 'ended' || isPast(meeting.endTime)
    const isLive = !hasEnded && !isFuture(meeting.scheduledAt)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${
                            isLive ? 'bg-green-100' :
                            hasEnded ? 'bg-muted' : 'bg-indigo-100'
                        }`}>
                            <Video className={`h-4 w-4 ${
                                isLive ? 'text-green-600' :
                                hasEnded ? 'text-muted-foreground' : 'text-indigo-600'
                            }`} />
                        </div>
                        {meeting.title}
                    </DialogTitle>
                    <DialogDescription asChild>
                        <div className="space-y-2 pt-1">
                            <div className="flex items-center gap-2 text-sm">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>
                                    {format(meeting.scheduledAt, 'MMM d, yyyy • h:mm a')}
                                    {' → '}
                                    {format(meeting.endTime, 'h:mm a')}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground">
                                    Created by {meeting.createdByName}
                                </span>
                            </div>
                            {/* Status badge */}
                            <div>
                                {isLive && (
                                    <Badge className="bg-green-500 text-white">
                                        🔴 Live Now
                                    </Badge>
                                )}
                                {!isLive && !hasEnded && (
                                    <Badge variant="outline" className="border-indigo-300 text-indigo-600">
                                        Upcoming
                                    </Badge>
                                )}
                                {hasEnded && (
                                    <Badge variant="secondary">Ended</Badge>
                                )}
                                {meeting.isInstant && (
                                    <Badge variant="outline" className="ml-2 border-orange-300 text-orange-600">
                                        ⚡ Instant
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter className="flex gap-2 sm:justify-start">
                    {!hasEnded && (
                        <Button
                            className={isLive
                                ? 'bg-green-600 hover:bg-green-700 text-white'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            }
                            onClick={() => window.open(meeting.meetLink, '_blank')}
                        >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            {isLive ? 'Join Now' : 'Join Meeting'}
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        onClick={() => onCopyLink(meeting.meetLink)}
                    >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Link
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ─── Custom Toolbar ───────────────────────────────────────────────────────────
const CustomToolbar = ({
    toolbar,
    canEdit,
    onAddEvent,
}: {
    toolbar: any
    canEdit: boolean
    onAddEvent: () => void
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
                        className={`px-3 py-1 text-sm rounded-sm transition-colors ${
                            toolbar.view === v
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

    // ── Tasks state ──────────────────────────────────────────────────────────
    const [tasks, setTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(true)

    // ── Meetings state ───────────────────────────────────────────────────────
    const [meetings, setMeetings] = useState<CalendarMeeting[]>([])
    const [meetingsLoading, setMeetingsLoading] = useState(true)

    // ── Calendar UI state ────────────────────────────────────────────────────
    const [view, setView] = useState<View>(Views.MONTH)
    const [date, setDate] = useState(new Date())
    const [colorBy, setColorBy] = useState<'priority' | 'status'>('priority')

    // ── Task dialog state ────────────────────────────────────────────────────
    const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false)
    const [selectedTask, setSelectedTask] = useState<Task | null>(null)
    const [selectedDate, setSelectedDate] = useState<Date | undefined>()

    // ── Meeting detail dialog state ──────────────────────────────────────────
    const [selectedMeeting, setSelectedMeeting] = useState<CalendarMeeting | null>(null)
    const [isMeetingDialogOpen, setIsMeetingDialogOpen] = useState(false)

    // ── Firestore: Tasks listener ────────────────────────────────────────────
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
                console.error('ProjectCalendar tasks listener error:', err)
                setLoading(false)
            }
        )

        return () => unsubscribe()
    }, [projectId, user])

    // ── Firestore: Meetings listener ─────────────────────────────────────────
    useEffect(() => {
        if (!projectId || !user) return

        const q = query(
            collection(db, 'projects', projectId, 'meetings'),
            orderBy('scheduledAt', 'asc')
        )

        const unsub = onSnapshot(
            q,
            (snap) => {
                const data = snap.docs.map(d => {
                    const raw = d.data()
                    return {
                        id: d.id,
                        title: raw.title ?? 'Untitled Meeting',
                        meetLink: raw.meetLink ?? '',
                        scheduledAt: toDate(raw.scheduledAt),
                        endTime: toDate(raw.endTime),
                        createdByName: raw.createdByName ?? 'Unknown',
                        isInstant: raw.isInstant ?? false,
                        status: raw.status ?? 'scheduled',
                    } as CalendarMeeting
                })
                setMeetings(data)
                setMeetingsLoading(false)
            },
            (err) => {
                console.error('ProjectCalendar meetings listener error:', err)
                setMeetingsLoading(false)
            }
        )

        return () => unsub()
    }, [projectId, user])

    // ── Safe Timestamp converter ─────────────────────────────────────────────
    const toDate = (value: any): Date => {
        if (!value) return new Date()
        if (value instanceof Date) return value
        if (typeof value.toDate === 'function') return value.toDate()
        const d = new Date(value)
        return isNaN(d.getTime()) ? new Date() : d
    }

    // ── Safe Timestamp converter (nullable) ──────────────────────────────────
    const toDateNullable = (value: any): Date | null => {
        if (!value) return null
        if (value instanceof Date) return value
        if (typeof value.toDate === 'function') return value.toDate()
        const d = new Date(value)
        return isNaN(d.getTime()) ? null : d
    }

    // ── Build unified calendar events ────────────────────────────────────────
    const events = useMemo(() => {
        // ── Task events ──────────────────────────────────────────────────────
        const taskEvents = tasks
            .filter(t => t.dueDate)
            .map(t => {
                const dueDate = toDateNullable(t.dueDate)
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
                    eventType: 'task' as const,
                    overdue,
                    dueNow,
                }
            })
            .filter(Boolean) as any[]

        // ── Meeting events ───────────────────────────────────────────────────
        const meetingEvents = meetings.map(m => ({
            id: `meet-${m.id}`,
            title: `📹 ${m.title}`,
            start: m.scheduledAt,
            end: m.endTime,
            allDay: false,
            resource: m,
            eventType: 'meeting' as const,
            overdue: false,
            dueNow: isToday(m.scheduledAt),
            meetLink: m.meetLink,
        }))

        return [...taskEvents, ...meetingEvents]
    }, [tasks, meetings])

    // ── Deadline summary stats ────────────────────────────────────────────────
    const stats = useMemo(() => {
        const taskEvents = events.filter(e => e.eventType === 'task')
        const meetingEvents = events.filter(e => e.eventType === 'meeting')

        return {
            overdue: taskEvents.filter(e => e.overdue).length,
            dueToday: taskEvents.filter(e => e.dueNow).length,
            upcoming: taskEvents.filter(e => isFuture(e.start) && !e.dueNow).length,
            completed: tasks.filter(t => t.status === 'done').length,
            meetingsToday: meetingEvents.filter(e => isToday(e.start)).length,
            upcomingMeetings: meetingEvents.filter(e => isFuture(e.start)).length,
        }
    }, [events, tasks])

    // ── Event styles ──────────────────────────────────────────────────────────
    const eventStyleGetter = (event: any) => {
        // Meeting events → distinct indigo style
        if (event.eventType === 'meeting') {
            const m = event.resource as CalendarMeeting
            const hasEnded = m.status === 'ended' || isPast(m.endTime)
            const isLive = !hasEnded && !isFuture(m.scheduledAt)

            return {
                style: {
                    backgroundColor: isLive ? '#16a34a' : MEETING_COLOR,
                    borderRadius: '5px',
                    opacity: hasEnded ? 0.5 : 0.92,
                    color: 'white',
                    border: isLive ? '2px solid #bbf7d0' : '0px',
                    boxShadow: isLive ? '0 0 0 2px #16a34a' : 'none',
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                },
            }
        }

        // Task events → existing priority/status colour logic
        const task = event.resource as Task
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

    // ── Slot / event handlers ─────────────────────────────────────────────────
    const handleSelectSlot = (slotInfo: SlotInfo) => {
        if (!canEdit) return
        setSelectedDate(slotInfo.start)
        setSelectedTask(null)
        setIsTaskDialogOpen(true)
    }

    const handleSelectEvent = (event: any) => {
        // Meeting clicked → show meeting detail dialog
        if (event.eventType === 'meeting') {
            setSelectedMeeting(event.resource as CalendarMeeting)
            setIsMeetingDialogOpen(true)
            return
        }

        // Task clicked → open task dialog
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
            toast({
                title: 'Error',
                description: 'Failed to save task.',
                variant: 'destructive',
            })
        }
    }

    // ── Copy Meet link ────────────────────────────────────────────────────────
    const handleCopyMeetLink = (link: string) => {
        navigator.clipboard.writeText(link).then(() =>
            toast({
                title: 'Link copied!',
                description: 'Google Meet link copied to clipboard.',
            })
        )
    }

    // ── Loading ───────────────────────────────────────────────────────────────
    if (loading || meetingsLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-[600px] w-full" />
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col gap-3">

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

                {/* Upcoming tasks */}
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

                {/* Meetings today */}
                {stats.meetingsToday > 0 && (
                    <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200
                                      hover:bg-indigo-100 flex items-center gap-1">
                        <Video className="h-3 w-3" />
                        {stats.meetingsToday} meeting{stats.meetingsToday !== 1 ? 's' : ''} today
                    </Badge>
                )}

                {/* Upcoming meetings */}
                {stats.upcomingMeetings > 0 && (
                    <Badge variant="outline"
                        className="border-indigo-200 text-indigo-600 flex items-center gap-1">
                        <Video className="h-3 w-3" />
                        {stats.upcomingMeetings} upcoming meeting{stats.upcomingMeetings !== 1 ? 's' : ''}
                    </Badge>
                )}

                {/* Colour-by toggle */}
                <div className="ml-auto flex items-center gap-1.5 bg-muted rounded-lg p-1">
                    <button
                        onClick={() => setColorBy('priority')}
                        className={`px-3 py-1 text-xs rounded-md transition-colors font-medium ${
                            colorBy === 'priority'
                                ? 'bg-background shadow-sm text-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        By Priority
                    </button>
                    <button
                        onClick={() => setColorBy('status')}
                        className={`px-3 py-1 text-xs rounded-md transition-colors font-medium ${
                            colorBy === 'status'
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

                {/* Overdue marker */}
                <div className="flex items-center gap-1.5 text-xs text-destructive font-medium">
                    <span className="inline-block w-3 h-3 rounded-sm bg-destructive" />
                    Overdue
                </div>

                {/* Meeting marker */}
                <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-600">
                    <span
                        className="inline-block w-3 h-3 rounded-sm"
                        style={{ backgroundColor: MEETING_COLOR }}
                    />
                    Meeting (click to join)
                </div>

                {/* Live meeting marker */}
                <div className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                    <span className="inline-block w-3 h-3 rounded-sm bg-green-600" />
                    Live Meeting
                </div>
            </div>

            {/* ── Calendar ── */}
            <div className="flex-1 min-h-0">
                <style>{`
                    .rbc-calendar          { font-family: inherit; height: 100%; }
                    .rbc-header            { padding: 12px 6px !important; font-weight: 600;
                                             color: hsl(var(--muted-foreground));
                                             text-transform: uppercase; font-size: 0.75rem !important;
                                             letter-spacing: 0.05em; border-bottom: 1px solid hsl(var(--border)); }
                    .rbc-today             { background-color: hsl(var(--accent)/0.15) !important; }
                    .rbc-off-range-bg      { background-color: hsl(var(--background)); opacity: 0.6; }
                    .rbc-month-view        { border: 1px solid hsl(var(--border));
                                             border-radius: var(--radius); overflow: hidden; }
                    .rbc-header + .rbc-header,
                    .rbc-day-bg + .rbc-day-bg    { border-left: 1px solid hsl(var(--border)); }
                    .rbc-month-row + .rbc-month-row { border-top: 1px solid hsl(var(--border)); }
                    .rbc-month-row         { min-height: 90px; }
                    .rbc-event             { padding: 4px 8px !important; margin: 2px 4px !important;
                                             font-size: 0.75rem !important; border-radius: 6px !important;
                                             border: 0 !important; }
                    .rbc-date-cell         { padding: 8px 10px !important; text-align: right;
                                             font-size: 0.85rem; font-weight: 500; opacity: 0.8; }
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
                    selectable={false}
                    onSelectEvent={handleSelectEvent}
                    popup
                    tooltipAccessor={(event: any) => {
                        if (event.eventType === 'meeting') {
                            const m = event.resource as CalendarMeeting
                            return `📹 ${m.title} • ${format(m.scheduledAt, 'h:mm a')} • Click to join`
                        }
                        return `${event.title} • ${event.resource.priority ?? ''} priority • ${event.resource.status}`
                    }}
                />
            </div>

            {/* ── Task Dialog ── */}
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

            {/* ── Meeting Detail Dialog ── */}
            <MeetingDetailDialog
                meeting={selectedMeeting}
                open={isMeetingDialogOpen}
                onOpenChange={setIsMeetingDialogOpen}
                onCopyLink={handleCopyMeetLink}
            />
        </div>
    )
}
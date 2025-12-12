import { useState, useEffect } from 'react'
import { Calendar, dateFnsLocalizer, Views, View, SlotInfo } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { enUS } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { Task } from '@/types/project'
import { collection, query, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { TaskDialog } from './TaskDialog'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'
import { useProjectRole } from '@/hooks/use-project-role'

const locales = {
    'en-US': enUS,
}

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
})

// Custom Toolbar Component
const CustomToolbar = (toolbar: any) => {
    const goToBack = () => {
        toolbar.onNavigate('PREV')
    }

    const goToNext = () => {
        toolbar.onNavigate('NEXT')
    }

    const goToCurrent = () => {
        toolbar.onNavigate('TODAY')
    }

    const label = () => {
        const date = toolbar.date
        return (
            <span className="text-lg font-semibold text-foreground">
                {format(date, 'MMMM yyyy')}
            </span>
        )
    }

    return (
        <div className="flex items-center justify-between mb-4 p-2 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={goToBack}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={goToCurrent}>
                    Today
                </Button>
                <Button variant="outline" size="sm" onClick={goToNext}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                {label()}
            </div>

            <div className="flex bg-muted rounded-md p-1">
                {['month', 'week', 'day', 'agenda'].map(view => (
                    <button
                        key={view}
                        onClick={() => toolbar.onView(view)}
                        className={`px-3 py-1 text-sm rounded-sm transition-colors ${toolbar.view === view
                            ? 'bg-background shadow-sm text-foreground font-medium'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        {view.charAt(0).toUpperCase() + view.slice(1)}
                    </button>
                ))}
            </div>
        </div>
    )
}

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
    const [view, setView] = useState<View>(Views.MONTH)
    const [date, setDate] = useState(new Date())

    // Dialog State
    const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false)
    const [selectedTask, setSelectedTask] = useState<Task | null>(null)
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)

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

    // Convert tasks to calendar events
    const events = tasks
        .filter(task => task.dueDate)
        .map(task => {
            const dueDate = task.dueDate instanceof Date
                ? task.dueDate
                : (task.dueDate as any).toDate() // Handle Firestore Timestamp

            // For now, assume simple events (all day or specific time)
            // If we had startDate, we would use it.
            return {
                id: task.id,
                title: task.title,
                start: dueDate,
                end: dueDate,
                allDay: true, // task.allDay?
                resource: task
            }
        })

    const handleSelectSlot = (slotInfo: SlotInfo) => {
        if (!canEdit) return

        setSelectedDate(slotInfo.start)
        setSelectedTask(null)
        setIsTaskDialogOpen(true)
    }

    const handleSelectEvent = (event: any) => {
        const task = event.resource
        // Fix dates for the task object passed to dialog
        const fixedTask = {
            ...task,
            dueDate: event.start // Ensure we pass a Date object
        }

        setSelectedTask(fixedTask)
        setSelectedDate(event.start)
        setIsTaskDialogOpen(true)
    }

    const handleSaveTask = async (taskData: Partial<Task>) => {
        if (!projectId || !user) return

        try {
            if (selectedTask) {
                // Update existing task
                await updateDoc(doc(db, 'projects', projectId, 'tasks', selectedTask.id), {
                    ...taskData,
                    updatedAt: serverTimestamp()
                })
                toast({ title: "Task updated", description: "Calendar updated successfully." })
            } else {
                // Create new task
                await addDoc(collection(db, 'projects', projectId, 'tasks'), {
                    ...taskData,
                    projectId,
                    createdBy: user.uid,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    tags: taskData.tags || [],
                    // Ensure we use the selected date if not provided in form (though form handles it)
                    dueDate: taskData.dueDate || selectedDate
                })
                toast({ title: "Task created", description: "New task added to calendar." })
            }
            setIsTaskDialogOpen(false)
        } catch (error) {
            console.error("Error saving task:", error)
            toast({ title: "Error", description: "Failed to save task.", variant: "destructive" })
        }
    }

    const eventStyleGetter = (event: any) => {
        const priorityColors: Record<string, string> = {
            low: '#22c55e', // Green
            medium: '#3b82f6', // Blue
            high: '#f97316', // Orange
            urgent: '#ef4444' // Red
        }
        const priority = event.resource.priority || 'medium'
        const backgroundColor = priorityColors[priority] || '#3b82f6'

        return {
            style: {
                backgroundColor,
                borderRadius: '4px',
                opacity: 0.9,
                color: 'white',
                border: '0px',
                display: 'block',
                fontSize: '0.85rem'
            }
        }
    }

    return (
        <Card className="h-[calc(100vh-12rem)] border-none shadow-none">
            <CardHeader className="px-0 pt-0">
                <div className="flex items-center justify-between">
                    <div>
                        {/* Toolbar handles title */}
                    </div>
                    {canEdit && (
                        <Button onClick={() => {
                            setSelectedTask(null)
                            setSelectedDate(new Date())
                            setIsTaskDialogOpen(true)
                        }}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Event
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="h-full px-0 pb-0">
                <style>{`
                    .rbc-calendar { font-family: inherit; }
                    .rbc-header { padding: 12px 4px; font-weight: 600; color: var(--muted-foreground); text-transform: uppercase; font-size: 0.75rem; }
                    .rbc-today { background-color: var(--muted) !important; }
                    .rbc-off-range-bg { background-color: var(--background); opacity: 0.5; }
                    .rbc-month-view { border: 1px solid var(--border); border-radius: var(--radius); }
                    .rbc-header + .rbc-header { border-left: 1px solid var(--border); }
                    .rbc-day-bg + .rbc-day-bg { border-left: 1px solid var(--border); }
                    .rbc-month-row + .rbc-month-row { border-top: 1px solid var(--border); }
                    .rbc-day-slot .rbc-event { border: 1px solid transparent; }
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
                        toolbar: CustomToolbar
                    }}
                    selectable={canEdit}
                    onSelectSlot={handleSelectSlot}
                    onSelectEvent={handleSelectEvent}
                    popup
                />
            </CardContent>

            <TaskDialog
                open={isTaskDialogOpen}
                onOpenChange={setIsTaskDialogOpen}
                task={selectedTask ? { ...selectedTask, dueDate: selectedTask.dueDate } : (selectedDate ? { dueDate: selectedDate } as any : undefined)}
                onSave={handleSaveTask}
            />
        </Card>
    )
}

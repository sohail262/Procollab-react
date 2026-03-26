// src/components/dashboard/MeetingRoom.tsx
import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useGoogleMeet } from '@/hooks/use-google-meet'
import { useToast } from '@/hooks/use-toast'
import { db } from '@/lib/firebase'
import {
    collection, query, onSnapshot, addDoc,
    deleteDoc, doc, serverTimestamp,
    orderBy, Timestamp, getDoc,
} from 'firebase/firestore'
import {
    isPast, isFuture, isToday, format,
} from 'date-fns'
import {
    Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import {
    Dialog, DialogContent, DialogDescription,
    DialogFooter, DialogHeader, DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
    Video, VideoOff, Plus, ExternalLink,
    CalendarDays, Clock, Users, Zap,
    Trash2, Copy, Shield, CheckCircle2,
    LogOut, UserPlus, Mail, CalendarClock,
    Check,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

// ─── Types ────────────────────────────────────────────────────────────────────
type MeetingStatus = 'scheduled' | 'active' | 'ended'

interface Meeting {
    id: string
    title: string
    meetLink: string
    calendarEventId: string
    scheduledAt: Date
    endTime: Date
    createdBy: string
    createdByName: string
    createdByAvatar?: string
    status: MeetingStatus
    isInstant: boolean
    attendeeEmails: string[]
    createdAt: Date
}

interface TeamMember {
    uid: string
    name: string
    email: string
    avatar?: string
    role?: string
}

interface MeetingRoomProps {
    readOnly?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toDate = (val: any): Date => {
    if (!val) return new Date()
    if (val instanceof Date) return val
    if (typeof val.toDate === 'function') return val.toDate()
    return new Date(val)
}

function getMeetingState(meeting: Meeting) {
    const hasEnded = meeting.status === 'ended' || isPast(meeting.endTime)
    const isUpcoming = isFuture(meeting.scheduledAt)
    const isLive = !hasEnded && !isUpcoming
    return { hasEnded, isUpcoming, isLive }
}

// ─── Custom Checkbox row (no shadcn/checkbox dependency) ─────────────────────
function CheckRow({
    checked,
    onToggle,
    children,
}: {
    checked: boolean
    onToggle: () => void
    children: React.ReactNode
}) {
    return (
        <div
            role="checkbox"
            aria-checked={checked}
            tabIndex={0}
            onClick={onToggle}
            onKeyDown={e => (e.key === ' ' || e.key === 'Enter') && onToggle()}
            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer
                        transition-colors select-none outline-none
                        focus-visible:ring-2 focus-visible:ring-ring
                        ${checked
                            ? 'bg-primary/10 border border-primary/30'
                            : 'hover:bg-muted border border-transparent'
                        }`}
        >
            {/* Custom checkbox indicator */}
            <div className={`h-4 w-4 rounded shrink-0 border-2 flex items-center
                             justify-center transition-colors
                             ${checked
                                ? 'bg-primary border-primary'
                                : 'border-muted-foreground/40 bg-background'
                             }`}>
                {checked && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
            </div>
            {children}
        </div>
    )
}

// ─── Team Member Selector ─────────────────────────────────────────────────────
function TeamMemberSelector({
    members,
    selected,
    onToggle,
}: {
    members: TeamMember[]
    selected: string[]
    onToggle: (uid: string) => void
}) {
    if (members.length === 0) {
        return (
            <p className="text-xs text-muted-foreground py-3 text-center">
                No other team members found.
            </p>
        )
    }

    return (
        <ScrollArea className="max-h-[180px]">
            <div className="space-y-1 pr-1">
                {members.map(member => (
                    <CheckRow
                        key={member.uid}
                        checked={selected.includes(member.uid)}
                        onToggle={() => onToggle(member.uid)}
                    >
                        <Avatar className="h-7 w-7 shrink-0">
                            <AvatarImage src={member.avatar} />
                            <AvatarFallback className="text-xs">
                                {member.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium leading-tight truncate">
                                {member.name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                                {member.email}
                            </p>
                        </div>
                        {member.role && (
                            <Badge
                                variant="outline"
                                className="text-xs shrink-0 font-normal"
                            >
                                {member.role}
                            </Badge>
                        )}
                    </CheckRow>
                ))}
            </div>
        </ScrollArea>
    )
}

// ─── Meeting Card ─────────────────────────────────────────────────────────────
function MeetingCard({
    meeting,
    onDelete,
    onCopyLink,
    canDelete,
}: {
    meeting: Meeting
    onDelete: (m: Meeting) => void
    onCopyLink: (link: string) => void
    canDelete: boolean
}) {
    const { hasEnded, isUpcoming, isLive } = getMeetingState(meeting)

    return (
        <Card className={`transition-all duration-200 hover:shadow-sm ${
            isLive
                ? 'border-green-500/40 bg-green-500/[0.03]'
                : 'border-border'
        } ${hasEnded ? 'opacity-65' : ''}`}>
            <CardContent className="p-4">
                <div className="flex items-start gap-4">

                    {/* Status icon */}
                    <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                        isLive
                            ? 'bg-green-100 dark:bg-green-900/30'
                            : isUpcoming
                                ? 'bg-blue-100 dark:bg-blue-900/30'
                                : 'bg-muted'
                    }`}>
                        {hasEnded
                            ? <VideoOff className="h-5 w-5 text-muted-foreground" />
                            : isLive
                                ? <Video className="h-5 w-5 text-green-600" />
                                : <CalendarClock className="h-5 w-5 text-blue-600" />
                        }
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0 space-y-1.5">

                        {/* Title + badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-sm leading-snug">
                                {meeting.title}
                            </h4>

                            {isLive && (
                                <Badge className="bg-green-500 hover:bg-green-500
                                                  text-white text-xs gap-1.5 px-2 py-0.5">
                                    <span className="h-1.5 w-1.5 rounded-full
                                                     bg-white animate-pulse
                                                     inline-block shrink-0" />
                                    Live
                                </Badge>
                            )}
                            {isUpcoming && !isLive && (
                                <Badge
                                    variant="secondary"
                                    className="text-xs px-2 py-0.5"
                                >
                                    Upcoming
                                </Badge>
                            )}
                            {hasEnded && (
                                <Badge
                                    variant="outline"
                                    className="text-xs text-muted-foreground
                                               px-2 py-0.5"
                                >
                                    Ended
                                </Badge>
                            )}
                            {meeting.isInstant && (
                                <Badge
                                    variant="outline"
                                    className="text-xs border-orange-300
                                               text-orange-600 gap-1 px-2 py-0.5"
                                >
                                    <Zap className="h-3 w-3" />
                                    Instant
                                </Badge>
                            )}
                        </div>

                        {/* Time */}
                        <div className="flex items-center gap-4 text-xs
                                        text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 shrink-0" />
                                {format(meeting.scheduledAt, 'MMM d, yyyy')}
                                <span className="text-muted-foreground/50">·</span>
                                {format(meeting.scheduledAt, 'h:mm a')}
                                {' – '}
                                {format(meeting.endTime, 'h:mm a')}
                            </span>

                            {meeting.attendeeEmails.length > 0 && (
                                <span className="flex items-center gap-1.5">
                                    <Users className="h-3.5 w-3.5 shrink-0" />
                                    {meeting.attendeeEmails.length} invited
                                </span>
                            )}
                        </div>

                        {/* Creator */}
                        <div className="flex items-center gap-1.5">
                            <Avatar className="h-5 w-5">
                                <AvatarImage src={meeting.createdByAvatar} />
                                <AvatarFallback className="text-[10px]">
                                    {meeting.createdByName.charAt(0)}
                                </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-muted-foreground">
                                {meeting.createdByName}
                            </span>
                        </div>

                        {/* Invited avatars */}
                        {meeting.attendeeEmails.length > 0 && (
                            <div className="flex items-center gap-1.5">
                                <div className="flex -space-x-1.5">
                                    {meeting.attendeeEmails.slice(0, 5).map((email, i) => (
                                        <Avatar
                                            key={i}
                                            className="h-5 w-5 border-2 border-background"
                                            title={email}
                                        >
                                            <AvatarFallback
                                                className="text-[9px] bg-primary/15"
                                            >
                                                {email.charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                    ))}
                                </div>
                                {meeting.attendeeEmails.length > 5 && (
                                    <span className="text-xs text-muted-foreground">
                                        +{meeting.attendeeEmails.length - 5} more
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                        {!hasEnded && (
                            <Button
                                size="sm"
                                className={isLive
                                    ? 'bg-green-600 hover:bg-green-700 text-white'
                                    : ''
                                }
                                onClick={() =>
                                    window.open(meeting.meetLink, '_blank')
                                }
                            >
                                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                                {isLive ? 'Join Now' : 'Join'}
                            </Button>
                        )}

                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onCopyLink(meeting.meetLink)}
                            title="Copy meeting link"
                        >
                            <Copy className="h-3.5 w-3.5 mr-1.5" />
                            Copy Link
                        </Button>

                        {canDelete && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="border-destructive/30 text-destructive
                                           hover:bg-destructive/10
                                           hover:border-destructive/60"
                                onClick={() => onDelete(meeting)}
                                title="Delete meeting"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function MeetingRoom({ readOnly = false }: MeetingRoomProps) {
    const { id: projectId } = useParams()
    const { user } = useAuth()
    const { toast } = useToast()
    const {
        isAuthorized, isLoading: meetLoading,
        authorize, disconnect,
        createMeetingEvent, deleteMeetingEvent,
    } = useGoogleMeet()

    // ── State ─────────────────────────────────────────────────────────────────
    const [meetings, setMeetings] = useState<Meeting[]>([])
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
    const [loading, setLoading] = useState(true)
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isInstantMode, setIsInstantMode] = useState(false)
    const [creating, setCreating] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<Meeting | null>(null)
    const [deleting, setDeleting] = useState(false)

    const [form, setForm] = useState({
        title: '',
        scheduledAt: '',
        duration: 60,
        manualEmails: '',
    })

    const [selectedMemberUids, setSelectedMemberUids] = useState<string[]>([])

    // ── Load team members ─────────────────────────────────────────────────────
    useEffect(() => {
        if (!projectId || !user) return

        const loadTeamMembers = async () => {
            try {
                const projectSnap = await getDoc(
                    doc(db, 'projects', projectId)
                )
                if (!projectSnap.exists()) return

                const data = projectSnap.data()
                const teamMembersMap: Record<string, any> =
                    data.teamMembers ?? {}

                const memberPromises = Object.entries(teamMembersMap)
                    .filter(([uid]) => uid !== user.uid)
                    .map(async ([uid, memberData]) => {
                        try {
                            const userSnap = await getDoc(
                                doc(db, 'users', uid)
                            )
                            const userData = userSnap.exists()
                                ? userSnap.data()
                                : {}
                            return {
                                uid,
                                name: userData.displayName
                                    ?? memberData.name
                                    ?? 'Unknown',
                                email: userData.email ?? '',
                                avatar: userData.photoURL
                                    ?? memberData.avatar
                                    ?? '',
                                role: memberData.role ?? '',
                            } as TeamMember
                        } catch {
                            return null
                        }
                    })

                const resolved = (await Promise.all(memberPromises))
                    .filter((m): m is TeamMember =>
                        m !== null && Boolean(m.email)
                    )

                setTeamMembers(resolved)
            } catch (err) {
                console.error('Failed to load team members:', err)
            }
        }

        loadTeamMembers()
    }, [projectId, user])

    // ── Firestore: meetings listener ──────────────────────────────────────────
    useEffect(() => {
        if (!projectId || !user) return

        const q = query(
            collection(db, 'projects', projectId, 'meetings'),
            orderBy('scheduledAt', 'desc')
        )

        const unsub = onSnapshot(q,
            (snap) => {
                const data = snap.docs.map(d => {
                    const raw = d.data()
                    return {
                        id: d.id,
                        title: raw.title,
                        meetLink: raw.meetLink ?? '',
                        calendarEventId: raw.calendarEventId ?? '',
                        scheduledAt: toDate(raw.scheduledAt),
                        endTime: toDate(raw.endTime),
                        createdBy: raw.createdBy,
                        createdByName: raw.createdByName ?? 'Unknown',
                        createdByAvatar: raw.createdByAvatar ?? '',
                        status: raw.status as MeetingStatus,
                        isInstant: raw.isInstant ?? false,
                        attendeeEmails: raw.attendeeEmails ?? [],
                        createdAt: toDate(raw.createdAt),
                    } as Meeting
                })
                setMeetings(data)
                setLoading(false)
            },
            (err) => {
                console.error('Meetings listener error:', err)
                setLoading(false)
            }
        )

        return () => unsub()
    }, [projectId, user])

    // ── Derived lists ─────────────────────────────────────────────────────────
    const upcomingMeetings = useMemo(() =>
        meetings
            .filter(m => !isPast(m.endTime))
            .sort((a, b) =>
                a.scheduledAt.getTime() - b.scheduledAt.getTime()
            ),
        [meetings]
    )

    const pastMeetings = useMemo(() =>
        meetings
            .filter(m => isPast(m.endTime))
            .sort((a, b) =>
                b.scheduledAt.getTime() - a.scheduledAt.getTime()
            ),
        [meetings]
    )

    // ── Toggle team member ────────────────────────────────────────────────────
    const handleToggleMember = (uid: string) => {
        setSelectedMemberUids(prev =>
            prev.includes(uid)
                ? prev.filter(id => id !== uid)
                : [...prev, uid]
        )
    }

    // ── Final attendee emails ─────────────────────────────────────────────────
    const computedAttendeeEmails = useMemo(() => {
        const memberEmails = teamMembers
            .filter(m => selectedMemberUids.includes(m.uid))
            .map(m => m.email)

        const manualEmails = form.manualEmails
            .split(',')
            .map(e => e.trim())
            .filter(e => e.includes('@'))

        return [...new Set([...memberEmails, ...manualEmails])]
    }, [selectedMemberUids, teamMembers, form.manualEmails])

    // ── Reset form ────────────────────────────────────────────────────────────
    const resetForm = () => {
        setForm({ title: '', scheduledAt: '', duration: 60, manualEmails: '' })
        setSelectedMemberUids([])
        setIsInstantMode(false)
    }

    // ── Create meeting ────────────────────────────────────────────────────────
    const handleCreate = async () => {
        if (!projectId || !user || !isAuthorized) return

        if (!form.title.trim()) {
            toast({ title: 'Title required', variant: 'destructive' })
            return
        }

        setCreating(true)
        try {
            const startTime = isInstantMode
                ? new Date()
                : new Date(form.scheduledAt)

            if (!isInstantMode && isNaN(startTime.getTime())) {
                toast({ title: 'Invalid date/time', variant: 'destructive' })
                setCreating(false)
                return
            }

            const endTime = new Date(
                startTime.getTime() + form.duration * 60 * 1000
            )

            const { meetLink, calendarEventId, htmlLink } =
                await createMeetingEvent({
                    title: form.title,
                    description: 'ProCollab project meeting',
                    startTime,
                    endTime,
                    attendeeEmails: computedAttendeeEmails,
                })

            if (!meetLink) throw new Error('No Meet link returned from Google')

            await addDoc(
                collection(db, 'projects', projectId, 'meetings'),
                {
                    title: form.title,
                    meetLink,
                    calendarEventId,
                    htmlLink,
                    scheduledAt: Timestamp.fromDate(startTime),
                    endTime: Timestamp.fromDate(endTime),
                    createdBy: user.uid,
                    createdByName: user.displayName ?? 'Unknown',
                    createdByAvatar: user.photoURL ?? '',
                    status: isInstantMode ? 'active' : 'scheduled',
                    isInstant: isInstantMode,
                    attendeeEmails: computedAttendeeEmails,
                    createdAt: serverTimestamp(),
                }
            )

            toast({
                title: isInstantMode
                    ? 'Meeting started'
                    : 'Meeting scheduled',
                description: isInstantMode
                    ? 'Opening Google Meet in a new tab.'
                    : `Scheduled for ${format(startTime, 'MMM d · h:mm a')}`,
            })

            if (isInstantMode && meetLink) {
                window.open(meetLink, '_blank')
            }

            resetForm()
            setIsCreateOpen(false)

        } catch (err: any) {
            console.error('Failed to create meeting:', err)
            toast({
                title: 'Failed to create meeting',
                description: err.message ?? 'Something went wrong.',
                variant: 'destructive',
            })
        } finally {
            setCreating(false)
        }
    }

    // ── Delete meeting ────────────────────────────────────────────────────────
    const handleDelete = async () => {
        if (!deleteTarget || !projectId) return
        setDeleting(true)
        try {
            if (deleteTarget.calendarEventId) {
                await deleteMeetingEvent(deleteTarget.calendarEventId)
            }
            await deleteDoc(
                doc(db, 'projects', projectId, 'meetings', deleteTarget.id)
            )
            toast({ title: 'Meeting deleted' })
        } catch {
            toast({
                title: 'Error',
                description: 'Could not delete meeting.',
                variant: 'destructive',
            })
        } finally {
            setDeleting(false)
            setDeleteTarget(null)
        }
    }

    // ── Copy link ─────────────────────────────────────────────────────────────
    const handleCopyLink = (link: string) => {
        navigator.clipboard.writeText(link).then(() =>
            toast({
                title: 'Link copied',
                description: 'Google Meet link copied to clipboard.',
            })
        )
    }

    // ── Loading ───────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2].map(i => <Skeleton key={i} className="h-24" />)}
                </div>
                {[1, 2].map(i => <Skeleton key={i} className="h-28" />)}
            </div>
        )
    }

    const minDateTime = format(new Date(), "yyyy-MM-dd'T'HH:mm")

    return (
        <div className="space-y-6">

            {/* ── Header ── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-xl font-bold tracking-tight">
                        Meeting Room
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Create and manage Google Meet sessions for your project
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">

                    {/* Auth status */}
                    {!isAuthorized ? (
                        <Button variant="outline" onClick={authorize}>
                            <Shield className="h-4 w-4 mr-2" />
                            Connect Google Account
                        </Button>
                    ) : (
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 px-3 py-1.5
                                            rounded-lg border border-green-200
                                            bg-green-50 dark:bg-green-950/20
                                            dark:border-green-800">
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                                <span className="text-sm font-medium text-green-700
                                                 dark:text-green-400">
                                    Google Connected
                                </span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={disconnect}
                                className="text-muted-foreground hover:text-destructive
                                           h-8 px-2 text-xs"
                            >
                                <LogOut className="h-3.5 w-3.5 mr-1.5" />
                                Disconnect
                            </Button>
                        </div>
                    )}

                    {/* Create dialog */}
                    {!readOnly && isAuthorized && (
                        <Dialog
                            open={isCreateOpen}
                            onOpenChange={(open) => {
                                setIsCreateOpen(open)
                                if (!open) resetForm()
                            }}
                        >
                            <DialogTrigger asChild>
                                <Button>
                                    <Plus className="h-4 w-4 mr-2" />
                                    New Meeting
                                </Button>
                            </DialogTrigger>

                            <DialogContent className="sm:max-w-[520px]">
                                <DialogHeader>
                                    <DialogTitle>Create Meeting</DialogTitle>
                                    <DialogDescription>
                                        A Google Meet link will be generated and added
                                        to your Google Calendar automatically.
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="space-y-5 py-2">

                                    {/* Mode toggle */}
                                    <div className="flex gap-1.5 p-1 bg-muted rounded-lg">
                                        <button
                                            className={`flex-1 py-2 px-3 rounded-md text-sm
                                                font-medium transition-colors flex items-center
                                                justify-center gap-2
                                                ${!isInstantMode
                                                    ? 'bg-background shadow-sm text-foreground'
                                                    : 'text-muted-foreground hover:text-foreground'
                                                }`}
                                            onClick={() => setIsInstantMode(false)}
                                        >
                                            <CalendarDays className="h-4 w-4" />
                                            Schedule
                                        </button>
                                        <button
                                            className={`flex-1 py-2 px-3 rounded-md text-sm
                                                font-medium transition-colors flex items-center
                                                justify-center gap-2
                                                ${isInstantMode
                                                    ? 'bg-background shadow-sm text-foreground'
                                                    : 'text-muted-foreground hover:text-foreground'
                                                }`}
                                            onClick={() => setIsInstantMode(true)}
                                        >
                                            <Zap className="h-4 w-4" />
                                            Start Now
                                        </button>
                                    </div>

                                    {/* Title */}
                                    <div className="space-y-1.5">
                                        <Label htmlFor="meet-title">
                                            Meeting Title
                                            <span className="text-destructive ml-0.5">
                                                *
                                            </span>
                                        </Label>
                                        <Input
                                            id="meet-title"
                                            placeholder="e.g. Sprint Planning, Design Review"
                                            value={form.title}
                                            onChange={e =>
                                                setForm(f => ({
                                                    ...f,
                                                    title: e.target.value,
                                                }))
                                            }
                                        />
                                    </div>

                                    {/* Date + Duration */}
                                    {!isInstantMode && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <Label htmlFor="meet-time">
                                                    Date & Time
                                                    <span className="text-destructive ml-0.5">
                                                        *
                                                    </span>
                                                </Label>
                                                <DateTimePicker
                                                    date={form.scheduledAt ? new Date(form.scheduledAt) : undefined}
                                                    onDateChange={(date) => 
                                                        setForm(f => ({
                                                            ...f,
                                                            scheduledAt: date ? format(date, "yyyy-MM-dd'T'HH:mm") : '',
                                                        }))
                                                    }
                                                    placeholder="Select meeting date and time"
                                                    showTime={true}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="meet-duration">
                                                    Duration (minutes)
                                                </Label>
                                                <Input
                                                    id="meet-duration"
                                                    type="number"
                                                    min={15}
                                                    max={480}
                                                    step={15}
                                                    value={form.duration}
                                                    onChange={e =>
                                                        setForm(f => ({
                                                            ...f,
                                                            duration: Number(e.target.value),
                                                        }))
                                                    }
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Team members */}
                                    <div className="space-y-1.5">
                                        <Label className="flex items-center gap-2">
                                            <UserPlus className="h-3.5 w-3.5" />
                                            Invite Team Members
                                            {selectedMemberUids.length > 0 && (
                                                <Badge
                                                    variant="secondary"
                                                    className="text-xs ml-1"
                                                >
                                                    {selectedMemberUids.length} selected
                                                </Badge>
                                            )}
                                        </Label>
                                        <div className="rounded-lg border p-2 min-h-[44px]">
                                            <TeamMemberSelector
                                                members={teamMembers}
                                                selected={selectedMemberUids}
                                                onToggle={handleToggleMember}
                                            />
                                        </div>
                                    </div>

                                    {/* Additional emails */}
                                    <div className="space-y-1.5">
                                        <Label
                                            htmlFor="meet-emails"
                                            className="flex items-center gap-2"
                                        >
                                            <Mail className="h-3.5 w-3.5" />
                                            Additional Emails
                                            <span className="text-xs font-normal
                                                             text-muted-foreground">
                                                (comma-separated)
                                            </span>
                                        </Label>
                                        <Input
                                            id="meet-emails"
                                            placeholder="colleague@example.com, advisor@example.com"
                                            value={form.manualEmails}
                                            onChange={e =>
                                                setForm(f => ({
                                                    ...f,
                                                    manualEmails: e.target.value,
                                                }))
                                            }
                                        />
                                    </div>

                                    {/* Attendee summary */}
                                    {computedAttendeeEmails.length > 0 && (
                                        <div className="rounded-lg bg-muted/50 border
                                                        px-3 py-2.5 space-y-2">
                                            <p className="text-xs font-medium
                                                          text-muted-foreground flex
                                                          items-center gap-1.5">
                                                <Users className="h-3.5 w-3.5" />
                                                {computedAttendeeEmails.length} attendee
                                                {computedAttendeeEmails.length !== 1
                                                    ? 's'
                                                    : ''
                                                } will be invited
                                            </p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {computedAttendeeEmails.map((email, i) => (
                                                    <Badge
                                                        key={i}
                                                        variant="secondary"
                                                        className="text-xs font-normal
                                                                   max-w-[200px] truncate"
                                                    >
                                                        {email}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <DialogFooter>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setIsCreateOpen(false)
                                            resetForm()
                                        }}
                                        disabled={creating}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleCreate}
                                        disabled={creating || meetLoading}
                                    >
                                        {creating ? (
                                            <span className="flex items-center gap-2">
                                                <span className="h-3.5 w-3.5 rounded-full
                                                                 border-2 border-current
                                                                 border-t-transparent
                                                                 animate-spin" />
                                                Creating...
                                            </span>
                                        ) : isInstantMode ? (
                                            <>
                                                <Zap className="h-4 w-4 mr-2" />
                                                Start Meeting
                                            </>
                                        ) : (
                                            <>
                                                <CalendarDays className="h-4 w-4 mr-2" />
                                                Schedule Meeting
                                            </>
                                        )}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
            </div>

            {/* ── Stats ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium
                                              text-muted-foreground">
                            Upcoming Meetings
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-600">
                            {upcomingMeetings.length}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {upcomingMeetings.filter(m =>
                                isToday(m.scheduledAt)
                            ).length} scheduled today
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium
                                              text-muted-foreground">
                            Total Meetings Held
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">
                            {pastMeetings.length}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            all time
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* ── Upcoming ── */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wider
                                   text-muted-foreground">
                        Upcoming & Active
                    </h3>
                    {upcomingMeetings.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                            {upcomingMeetings.length}
                        </Badge>
                    )}
                </div>

                {upcomingMeetings.length === 0 ? (
                    <Card className="border-dashed">
                        <CardContent className="flex flex-col items-center
                                                justify-center py-14
                                                text-muted-foreground">
                            <div className="p-4 rounded-full bg-muted mb-4">
                                <Video className="h-8 w-8 opacity-40" />
                            </div>
                            <p className="font-medium text-sm">
                                No upcoming meetings
                            </p>
                            <p className="text-xs mt-1 text-center max-w-xs">
                                {!isAuthorized
                                    ? 'Connect your Google account to start creating meetings.'
                                    : readOnly
                                        ? 'No meetings have been scheduled yet.'
                                        : 'Create a meeting to collaborate with your team.'
                                }
                            </p>
                            {!isAuthorized && !readOnly && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-4"
                                    onClick={authorize}
                                >
                                    <Shield className="h-4 w-4 mr-2" />
                                    Connect Google Account
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {upcomingMeetings.map(m => (
                            <MeetingCard
                                key={m.id}
                                meeting={m}
                                onDelete={setDeleteTarget}
                                onCopyLink={handleCopyLink}
                                canDelete={!readOnly && m.createdBy === user?.uid}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* ── Past ── */}
            {pastMeetings.length > 0 && (
                <div className="space-y-3">
                    <Separator />
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold uppercase tracking-wider
                                       text-muted-foreground">
                            Past Meetings
                        </h3>
                        <Badge variant="outline" className="text-xs">
                            {pastMeetings.length}
                        </Badge>
                    </div>
                    <div className="space-y-3">
                        {pastMeetings.slice(0, 5).map(m => (
                            <MeetingCard
                                key={m.id}
                                meeting={m}
                                onDelete={setDeleteTarget}
                                onCopyLink={handleCopyLink}
                                canDelete={!readOnly && m.createdBy === user?.uid}
                            />
                        ))}
                    </div>
                    {pastMeetings.length > 5 && (
                        <p className="text-xs text-muted-foreground text-center pt-1">
                            Showing 5 of {pastMeetings.length} past meetings
                        </p>
                    )}
                </div>
            )}

            {/* ── Delete confirmation ── */}
            <AlertDialog
                open={!!deleteTarget}
                onOpenChange={open => !open && setDeleteTarget(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Meeting</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete{' '}
                            <span className="font-semibold">
                                "{deleteTarget?.title}"
                            </span>{' '}
                            and remove the associated Google Calendar event.
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deleting}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {deleting ? (
                                <span className="flex items-center gap-2">
                                    <span className="h-3.5 w-3.5 rounded-full
                                                     border-2 border-white
                                                     border-t-transparent
                                                     animate-spin" />
                                    Deleting...
                                </span>
                            ) : (
                                <>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Meeting
                                </>
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
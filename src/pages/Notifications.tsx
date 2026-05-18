import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Bell, Loader2, CheckCheck, Trash2,
    Users, FolderKanban, MessageSquare,
    Star, AlertCircle, ChevronDown,
} from 'lucide-react'
import {
    collection, query, orderBy, limit,
    onSnapshot, doc, updateDoc, writeBatch,
    startAfter, getDocs, DocumentSnapshot, Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useToast } from '@/hooks/use-toast'

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

const PAGE_SIZE = 20
const BATCH_LIMIT = 499

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

interface Notification {
    id: string
    title: string
    body: string
    type: string
    read: boolean
    timestamp: Timestamp | null
    icon?: string | null
    url?: string | null
    projectId?: string | null
    data?: {
        fromUserId?: string
        fromUserName?: string
        notificationId?: string
    }
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size))
    }
    return chunks
}

function formatTimestamp(timestamp: Timestamp | null): string {
    if (!timestamp) return 'Just now'
    const date = timestamp.toDate()
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60_000)
    const diffHours = Math.floor(diffMs / 3_600_000)
    const diffDays = Math.floor(diffMs / 86_400_000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
}

function getNotificationIcon(type: string) {
    switch (type) {
        case 'connection_request':
        case 'connection_accepted':
        case 'connection_rejected':
        case 'connection_withdrawn':
            return <Users className="h-5 w-5 text-blue-500" />
        case 'project_invite':
        case 'project_update':
        case 'application_accepted':
        case 'application_rejected':
            return <FolderKanban className="h-5 w-5 text-green-500" />
        case 'message':
            return <MessageSquare className="h-5 w-5 text-purple-500" />
        case 'mention':
            return <Star className="h-5 w-5 text-yellow-500" />
        case 'warning':
        case 'error':
            return <AlertCircle className="h-5 w-5 text-red-500" />
        default:
            return <Bell className="h-5 w-5 text-gray-500" />
    }
}

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────

export function Notifications() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const { toast } = useToast()

    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [filter, setFilter] = useState<'all' | 'unread'>('all')

    // Track last document for pagination
    const lastDocRef = useRef<DocumentSnapshot | null>(null)
    // Track listener reference for visibility pause
    const unsubscribeRef = useRef<(() => void) | null>(null)

    // ─── Start real-time listener ─────────────────────────
    const startListener = useCallback(() => {
        if (!user) return

        const q = query(
            collection(db, 'users', user.uid, 'notifications'),
            orderBy('timestamp', 'desc'),
            limit(PAGE_SIZE) // ✅ Only fetch first 20
        )

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const data: Notification[] = snapshot.docs.map(
                    d => ({ id: d.id, ...d.data() } as Notification)
                )
                setNotifications(data)
                setLoading(false)
                setError(null)

                // Track last doc for pagination
                const last = snapshot.docs[snapshot.docs.length - 1]
                lastDocRef.current = last ?? null
                setHasMore(snapshot.docs.length === PAGE_SIZE)
            },
            (err) => {
                console.error('[Notifications] Listener error:', err)
                setError('Failed to load notifications. Please refresh.')
                setLoading(false)
            }
        )

        unsubscribeRef.current = unsubscribe
    }, [user])

    // ─── Pause listener when tab hidden ──────────────────
    useEffect(() => {
        if (!user) return

        startListener()

        // ✅ Pause listener when tab is hidden — saves reads
        const handleVisibility = () => {
            if (document.hidden) {
                unsubscribeRef.current?.()
                unsubscribeRef.current = null
            } else {
                if (!unsubscribeRef.current) {
                    setLoading(true)
                    startListener()
                }
            }
        }

        document.addEventListener('visibilitychange', handleVisibility)

        return () => {
            unsubscribeRef.current?.()
            unsubscribeRef.current = null
            document.removeEventListener('visibilitychange', handleVisibility)
        }
    }, [user, startListener])

    // ─── Load more (pagination) ───────────────────────────
    const handleLoadMore = async () => {
        if (!user || !lastDocRef.current || loadingMore) return
        setLoadingMore(true)

        try {
            const q = query(
                collection(db, 'users', user.uid, 'notifications'),
                orderBy('timestamp', 'desc'),
                startAfter(lastDocRef.current),
                limit(PAGE_SIZE)
            )
            const snap = await getDocs(q)
            const more: Notification[] = snap.docs.map(
                d => ({ id: d.id, ...d.data() } as Notification)
            )

            setNotifications(prev => [...prev, ...more])
            lastDocRef.current = snap.docs[snap.docs.length - 1] ?? null
            setHasMore(snap.docs.length === PAGE_SIZE)
        } catch (err) {
            console.error('[Notifications] Load more error:', err)
        } finally {
            setLoadingMore(false)
        }
    }

    // ─── Mark single as read + navigate ──────────────────
    const handleNotificationClick = async (n: Notification) => {
        if (!user) return
        if (!n.read) {
            try {
                await updateDoc(
                    doc(db, 'users', user.uid, 'notifications', n.id),
                    { read: true }
                )
            } catch (err) {
                console.error('[Notifications] Mark read error:', err)
            }
        }
        if (n.url) navigate(n.url)
    }

    // ─── Mark all read ────────────────────────────────────
    const handleMarkAllRead = async () => {
        if (!user) return
        const unread = notifications.filter(n => !n.read)
        if (unread.length === 0) return

        try {
            for (const chunk of chunkArray(unread, BATCH_LIMIT)) {
                const batch = writeBatch(db)
                chunk.forEach(n => {
                    batch.update(
                        doc(db, 'users', user.uid, 'notifications', n.id),
                        { read: true }
                    )
                })
                await batch.commit()
            }
            toast({ title: 'All Read', variant: 'success' })
        } catch (err) {
            console.error('[Notifications] Mark all read error:', err)
            toast({ title: 'Error', variant: 'destructive' })
        }
    }

    // ─── Delete single ────────────────────────────────────
    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!user) return
        try {
            const batch = writeBatch(db)
            batch.delete(doc(db, 'users', user.uid, 'notifications', id))
            await batch.commit()
            toast({ title: 'Deleted', variant: 'success' })
        } catch (err) {
            console.error('[Notifications] Delete error:', err)
        }
    }

    // ─── Clear all ────────────────────────────────────────
    const handleClearAll = async () => {
        if (!user || notifications.length === 0) return
        try {
            for (const chunk of chunkArray(notifications, BATCH_LIMIT)) {
                const batch = writeBatch(db)
                chunk.forEach(n => {
                    batch.delete(
                        doc(db, 'users', user.uid, 'notifications', n.id)
                    )
                })
                await batch.commit()
            }
            setHasMore(false)
            lastDocRef.current = null
            toast({ title: 'Cleared', variant: 'success' })
        } catch (err) {
            console.error('[Notifications] Clear all error:', err)
            toast({ title: 'Error', variant: 'destructive' })
        }
    }

    // ─── Derived ──────────────────────────────────────────
    const filtered = filter === 'unread'
        ? notifications.filter(n => !n.read)
        : notifications
    const unreadCount = notifications.filter(n => !n.read).length

    // ─── Render ───────────────────────────────────────────
    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 sm:mb-8 gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2 sm:gap-3">
                            <Bell className="h-6 w-6 sm:h-8 sm:w-8" />
                            Notifications
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            {unreadCount > 0
                                ? `${unreadCount} unread`
                                : 'All caught up!'}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {unreadCount > 0 && (
                            <Button variant="outline" onClick={handleMarkAllRead}>
                                <CheckCheck className="h-4 w-4 mr-2" />
                                Mark all read
                            </Button>
                        )}
                        {notifications.length > 0 && (
                            <Button
                                variant="outline"
                                onClick={handleClearAll}
                                className="text-red-600 hover:text-red-700"
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Clear all
                            </Button>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <Tabs
                    value={filter}
                    onValueChange={v => setFilter(v as 'all' | 'unread')}
                    className="mb-6"
                >
                    <TabsList>
                        <TabsTrigger value="all">
                            All ({notifications.length}{hasMore ? '+' : ''})
                        </TabsTrigger>
                        <TabsTrigger value="unread">
                            Unread ({unreadCount})
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                {/* States */}
                {loading ? (
                    <div className="text-center py-16">
                        <Loader2 className="h-12 w-12 animate-spin mx-auto text-gray-400 mb-4" />
                        <p className="text-gray-500">Loading notifications...</p>
                    </div>
                ) : error ? (
                    <Card>
                        <CardContent className="py-16 text-center">
                            <AlertCircle className="h-16 w-16 mx-auto text-red-400 mb-4" />
                            <p className="text-gray-500">{error}</p>
                            <Button
                                variant="outline"
                                className="mt-4"
                                onClick={() => { setLoading(true); startListener() }}
                            >
                                Retry
                            </Button>
                        </CardContent>
                    </Card>
                ) : filtered.length === 0 ? (
                    <Card>
                        <CardContent className="py-16 text-center">
                            <Bell className="h-16 w-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                {filter === 'unread'
                                    ? 'No unread notifications'
                                    : 'No notifications yet'}
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400">
                                {filter === 'unread'
                                    ? "You're all caught up!"
                                    : "Notifications will appear here"}
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <div className="space-y-2">
                            {filtered.map((n) => (
                                <Card
                                    key={n.id}
                                    className={`cursor-pointer transition-all hover:shadow-md ${
                                        !n.read
                                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                                            : ''
                                    }`}
                                    onClick={() => handleNotificationClick(n)}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex items-start gap-4">
                                            <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full flex-shrink-0">
                                                {n.icon ? (
                                                    <img
                                                        src={n.icon}
                                                        alt=""
                                                        className="w-8 h-8 rounded-full object-cover"
                                                    />
                                                ) : (
                                                    getNotificationIcon(n.type)
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-sm ${
                                                            !n.read ? 'font-semibold' : 'font-medium'
                                                        } text-gray-900 dark:text-white`}>
                                                            {n.title}
                                                        </p>
                                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                                            {n.body}
                                                        </p>
                                                        <p className="text-xs text-gray-500 mt-2">
                                                            {formatTimestamp(n.timestamp)}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        {!n.read && (
                                                            <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                                        )}
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-gray-400 hover:text-red-500"
                                                            onClick={e => handleDelete(n.id, e)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        {/* ✅ Load more button */}
                        {hasMore && filter === 'all' && (
                            <div className="text-center mt-6">
                                <Button
                                    variant="outline"
                                    onClick={handleLoadMore}
                                    disabled={loadingMore}
                                >
                                    {loadingMore                                    ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Loading...
                                        </>
                                    ) : (
                                        <>
                                            <ChevronDown className="h-4 w-4 mr-2" />
                                            Load More
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </DashboardLayout>
    )
}
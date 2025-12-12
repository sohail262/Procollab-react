import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Bell, Loader2, Check, CheckCheck, Trash2, Filter,
    Users, FolderKanban, MessageSquare, Star, AlertCircle
} from 'lucide-react'
import {
    collection,
    query,
    orderBy,
    onSnapshot,
    doc,
    updateDoc,
    writeBatch,
    where
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useToast } from '@/hooks/use-toast'

interface Notification {
    id: string
    title: string
    body: string
    icon?: string | null
    url?: string
    timestamp: any
    read: boolean
    type: string
    data?: any
}

export function Notifications() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const { toast } = useToast()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'all' | 'unread'>('all')

    useEffect(() => {
        if (!user) return

        const notificationsRef = collection(db, 'users', user.uid, 'notifications')
        const q = query(notificationsRef, orderBy('timestamp', 'desc'))

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notificationsData: Notification[] = []
            snapshot.forEach((docSnap) => {
                notificationsData.push({ id: docSnap.id, ...docSnap.data() } as Notification)
            })
            setNotifications(notificationsData)
            setLoading(false)
        })

        return () => unsubscribe()
    }, [user])

    const handleNotificationClick = async (notification: Notification) => {
        if (!user) return

        // Mark as read
        if (!notification.read) {
            try {
                await updateDoc(doc(db, 'users', user.uid, 'notifications', notification.id), {
                    read: true
                })
            } catch (error) {
                console.error('Error marking notification as read:', error)
            }
        }

        // Navigate if URL is provided
        if (notification.url) {
            navigate(notification.url)
        }
    }

    const handleMarkAllRead = async () => {
        if (!user) return

        try {
            const batch = writeBatch(db)
            notifications
                .filter(n => !n.read)
                .forEach((notification) => {
                    const ref = doc(db, 'users', user.uid, 'notifications', notification.id)
                    batch.update(ref, { read: true })
                })
            await batch.commit()
            toast({
                title: 'All Read',
                description: 'All notifications marked as read',
                variant: 'success'
            })
        } catch (error) {
            console.error('Error marking all as read:', error)
            toast({
                title: 'Error',
                description: 'Failed to mark all as read',
                variant: 'destructive'
            })
        }
    }

    const handleDeleteNotification = async (notificationId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!user) return

        try {
            const batch = writeBatch(db)
            batch.delete(doc(db, 'users', user.uid, 'notifications', notificationId))
            await batch.commit()
            toast({
                title: 'Deleted',
                description: 'Notification deleted',
                variant: 'success'
            })
        } catch (error) {
            console.error('Error deleting notification:', error)
        }
    }

    const handleClearAll = async () => {
        if (!user || notifications.length === 0) return

        try {
            const batch = writeBatch(db)
            notifications.forEach((notification) => {
                const ref = doc(db, 'users', user.uid, 'notifications', notification.id)
                batch.delete(ref)
            })
            await batch.commit()
            toast({
                title: 'Cleared',
                description: 'All notifications cleared',
                variant: 'success'
            })
        } catch (error) {
            console.error('Error clearing notifications:', error)
            toast({
                title: 'Error',
                description: 'Failed to clear notifications',
                variant: 'destructive'
            })
        }
    }

    const formatTimestamp = (timestamp: any) => {
        if (!timestamp) return 'Just now'
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
        const now = new Date()
        const diffInMs = now.getTime() - date.getTime()
        const diffInMins = Math.floor(diffInMs / (1000 * 60))
        const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

        if (diffInMins < 1) return 'Just now'
        if (diffInMins < 60) return `${diffInMins} minutes ago`
        if (diffInHours < 24) return `${diffInHours} hours ago`
        if (diffInDays < 7) return `${diffInDays} days ago`
        return date.toLocaleDateString()
    }

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'connection_request':
            case 'connection_accepted':
            case 'connection_rejected':
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
            default:
                return <Bell className="h-5 w-5 text-gray-500" />
        }
    }

    const filteredNotifications = filter === 'unread'
        ? notifications.filter(n => !n.read)
        : notifications

    const unreadCount = notifications.filter(n => !n.read).length

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                            <Bell className="h-8 w-8" />
                            Notifications
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up!'}
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
                            <Button variant="outline" onClick={handleClearAll} className="text-red-600 hover:text-red-700">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Clear all
                            </Button>
                        )}
                    </div>
                </div>

                {/* Filter Tabs */}
                <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'unread')} className="mb-6">
                    <TabsList>
                        <TabsTrigger value="all">
                            All ({notifications.length})
                        </TabsTrigger>
                        <TabsTrigger value="unread">
                            Unread ({unreadCount})
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                {/* Notifications List */}
                {loading ? (
                    <div className="text-center py-16">
                        <Loader2 className="h-12 w-12 animate-spin mx-auto text-gray-400 mb-4" />
                        <p className="text-gray-500">Loading notifications...</p>
                    </div>
                ) : filteredNotifications.length === 0 ? (
                    <Card>
                        <CardContent className="py-16 text-center">
                            <Bell className="h-16 w-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400">
                                {filter === 'unread'
                                    ? 'You\'re all caught up!'
                                    : 'When you receive notifications, they\'ll appear here'}
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-2">
                        {filteredNotifications.map((notification) => (
                            <Card
                                key={notification.id}
                                className={`cursor-pointer transition-all hover:shadow-md ${!notification.read
                                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                                        : ''
                                    }`}
                                onClick={() => handleNotificationClick(notification)}
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-4">
                                        <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full">
                                            {notification.icon ? (
                                                <img
                                                    src={notification.icon}
                                                    alt=""
                                                    className="w-8 h-8 rounded-full"
                                                />
                                            ) : (
                                                getNotificationIcon(notification.type)
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <p className={`text-sm ${!notification.read ? 'font-semibold' : 'font-medium'} text-gray-900 dark:text-white`}>
                                                        {notification.title}
                                                    </p>
                                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                                        {notification.body}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-2">
                                                        {formatTimestamp(notification.timestamp)}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {!notification.read && (
                                                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-gray-400 hover:text-red-500"
                                                        onClick={(e) => handleDeleteNotification(notification.id, e)}
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
                )}
            </div>
        </DashboardLayout>
    )
}

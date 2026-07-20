import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Bell, Loader2 } from 'lucide-react'
import {
    collection,
    query,
    orderBy,
    limit,
    onSnapshot,
    doc,
    updateDoc,
    writeBatch
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Badge } from '@/components/ui/badge'

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

export function NotificationsDropdown() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)
    const [unreadCount, setUnreadCount] = useState(0)

    useEffect(() => {
        if (!user) return

        const notificationsRef = collection(db, 'users', user.uid, 'notifications')
        const q = query(notificationsRef, orderBy('timestamp', 'desc'), limit(10))

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notificationsData: Notification[] = []
            let unread = 0

            snapshot.forEach((docSnap) => {
                const notification = { id: docSnap.id, ...docSnap.data() } as Notification
                notificationsData.push(notification)
                if (!notification.read) unread++
            })

            setNotifications(notificationsData)
            setUnreadCount(unread)
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

    const handleClearAll = async () => {
        if (!user) return

        try {
            const batch = writeBatch(db)
            notifications.forEach((notification) => {
                const ref = doc(db, 'users', user.uid, 'notifications', notification.id)
                batch.delete(ref)
            })
            await batch.commit()
        } catch (error) {
            console.error('Error clearing notifications:', error)
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
        if (diffInMins < 60) return `${diffInMins}m ago`
        if (diffInHours < 24) return `${diffInHours}h ago`
        if (diffInDays < 7) return `${diffInDays}d ago`

        return date.toLocaleDateString()
    }

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'connection_request':
                return '🤝'
            case 'connection_accepted':
                return '✅'
            case 'connection_rejected':
                return '❌'
            case 'project_invite':
                return '📋'
            case 'project_update':
                return '🔔'
            case 'success':
                return '🎉'
            case 'info':
                return '💬'
            case 'warning':
                return '🚨'
            default:
                return '📢'
        }
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <Badge
                            variant="destructive"
                            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                        >
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
                <div className="p-3 border-b flex justify-between items-center">
                    <div>
                        <h3 className="font-semibold">Notifications</h3>
                        <p className="text-xs text-gray-500">
                            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
                        </p>
                    </div>
                    {notifications.length > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs text-gray-500 hover:text-red-600"
                            onClick={handleClearAll}
                        >
                            Clear all
                        </Button>
                    )}
                </div>

                {loading ? (
                    <div className="p-8 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="p-8 text-center text-sm text-gray-500">
                        No notifications yet
                    </div>
                ) : (
                    <div className="divide-y">
                        {notifications.map((notification) => (
                            <div
                                key={notification.id}
                                onClick={() => handleNotificationClick(notification)}
                                className={`p-3 cursor-pointer transition-colors ${notification.read
                                        ? 'hover:bg-gray-50 dark:hover:bg-gray-800'
                                        : 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="text-2xl flex-shrink-0">
                                        {notification.icon ? (
                                            <img
                                                src={notification.icon}
                                                alt=""
                                                className="w-10 h-10 rounded-full"
                                            />
                                        ) : (
                                            <span>{getNotificationIcon(notification.type)}</span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm ${!notification.read ? 'font-semibold' : 'font-medium'}`}>
                                            {notification.title}
                                        </p>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                            {notification.body}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {formatTimestamp(notification.timestamp)}
                                        </p>
                                    </div>
                                    {!notification.read && (
                                        <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1"></div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {notifications.length > 0 && (
                    <div className="p-2 border-t">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs"
                            onClick={() => navigate('/dashboard/notifications')}
                        >
                            View all notifications
                        </Button>
                    </div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

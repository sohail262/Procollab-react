import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { UserPlus, Check, X, Loader2 } from 'lucide-react'
import {
    collection,
    query,
    orderBy,
    onSnapshot,
    doc,
    deleteDoc,
    setDoc,
    serverTimestamp,
    writeBatch,
    getDoc
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Badge } from '@/components/ui/badge'

interface ConnectionRequest {
    id: string
    from: string
    fromName: string
    fromEmail: string
    sentAt: any
    fromUserData?: {
        firstName?: string
        lastName?: string
        photoURL?: string
        discipline?: string
    }
}

export function ConnectionRequestsDropdown() {
    const { user } = useAuth()
    const [requests, setRequests] = useState<ConnectionRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [processingId, setProcessingId] = useState<string | null>(null)

    useEffect(() => {
        if (!user) return

        const requestsRef = collection(db, 'users', user.uid, 'connectionRequests')
        const q = query(requestsRef, orderBy('sentAt', 'desc'))

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const requestsData: ConnectionRequest[] = []

            // Fetch user data for each request
            for (const docSnap of snapshot.docs) {
                const request = { id: docSnap.id, ...docSnap.data() } as ConnectionRequest

                // Fetch sender's user data
                if (request.from) {
                    try {
                        const userDoc = await getDoc(doc(db, 'users', request.from))
                        if (userDoc.exists()) {
                            request.fromUserData = userDoc.data() as any
                        }
                    } catch (error) {
                        console.error('Error fetching user data:', error)
                    }
                }

                requestsData.push(request)
            }

            setRequests(requestsData)
            setLoading(false)
        })

        return () => unsubscribe()
    }, [user])

    const handleAccept = async (request: ConnectionRequest) => {
        if (!user) return

        setProcessingId(request.id)

        try {
            const batch = writeBatch(db)

            // Add to friends collection for both users
            const currentUserFriendRef = doc(db, 'users', user.uid, 'friends', request.from)
            batch.set(currentUserFriendRef, {
                userId: request.from,
                name: request.fromName,
                addedAt: serverTimestamp(),
                status: 'active'
            })

            const otherUserFriendRef = doc(db, 'users', request.from, 'friends', user.uid)
            const currentUserDoc = await getDoc(doc(db, 'users', user.uid))
            const currentUserData = currentUserDoc.data()
            const currentUserName = currentUserData
                ? `${currentUserData.firstName} ${currentUserData.lastName}`
                : user.email

            batch.set(otherUserFriendRef, {
                userId: user.uid,
                name: currentUserName,
                addedAt: serverTimestamp(),
                status: 'active'
            })

            // Delete the connection request
            const requestRef = doc(db, 'users', user.uid, 'connectionRequests', request.id)
            batch.delete(requestRef)

            // Create notification for the sender
            const notificationRef = doc(collection(db, 'users', request.from, 'notifications'))
            batch.set(notificationRef, {
                title: 'Connection Accepted',
                body: `${currentUserName} accepted your connection request!`,
                icon: currentUserData?.photoURL || null,
                url: `/profile/${user.uid}`,
                timestamp: serverTimestamp(),
                read: false,
                type: 'connection_accepted'
            })

            await batch.commit()
        } catch (error) {
            console.error('Error accepting request:', error)
        } finally {
            setProcessingId(null)
        }
    }

    const handleReject = async (request: ConnectionRequest) => {
        if (!user) return

        setProcessingId(request.id)

        try {
            await deleteDoc(doc(db, 'users', user.uid, 'connectionRequests', request.id))

            // Optionally create a notification for the sender
            const currentUserDoc = await getDoc(doc(db, 'users', user.uid))
            const currentUserData = currentUserDoc.data()
            const currentUserName = currentUserData
                ? `${currentUserData.firstName} ${currentUserData.lastName}`
                : user.email

            await setDoc(doc(collection(db, 'users', request.from, 'notifications')), {
                title: 'Connection Request Declined',
                body: `${currentUserName} declined your connection request.`,
                timestamp: serverTimestamp(),
                read: false,
                type: 'connection_rejected'
            })
        } catch (error) {
            console.error('Error rejecting request:', error)
        } finally {
            setProcessingId(null)
        }
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <UserPlus className="h-5 w-5" />
                    {requests.length > 0 && (
                        <Badge
                            variant="destructive"
                            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                        >
                            {requests.length}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
                <div className="p-3 border-b">
                    <h3 className="font-semibold">Connection Requests</h3>
                    <p className="text-xs text-gray-500">{requests.length} pending</p>
                </div>

                {loading ? (
                    <div className="p-8 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                    </div>
                ) : requests.length === 0 ? (
                    <div className="p-8 text-center text-sm text-gray-500">
                        No pending requests
                    </div>
                ) : (
                    <div className="divide-y">
                        {requests.map((request) => {
                            const name = request.fromUserData
                                ? `${request.fromUserData.firstName || ''} ${request.fromUserData.lastName || ''}`.trim()
                                : request.fromName
                            const avatar = request.fromUserData?.photoURL ||
                                `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(request.fromEmail)}`

                            return (
                                <div key={request.id} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                                    <div className="flex items-start gap-3">
                                        <img
                                            src={avatar}
                                            alt={name}
                                            className="w-10 h-10 rounded-full"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm truncate">{name}</p>
                                            {request.fromUserData?.discipline && (
                                                <p className="text-xs text-gray-500 truncate">
                                                    {request.fromUserData.discipline}
                                                </p>
                                            )}
                                            <div className="flex gap-2 mt-2">
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleAccept(request)}
                                                    disabled={processingId === request.id}
                                                    className="h-7 text-xs"
                                                >
                                                    {processingId === request.id ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                        <>
                                                            <Check className="h-3 w-3 mr-1" />
                                                            Accept
                                                        </>
                                                    )}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleReject(request)}
                                                    disabled={processingId === request.id}
                                                    className="h-7 text-xs"
                                                >
                                                    {processingId === request.id ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                        <>
                                                            <X className="h-3 w-3 mr-1" />
                                                            Reject
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

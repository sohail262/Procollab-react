import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UserPlus, Check, X, Loader2, Undo2 } from 'lucide-react'
import {
    collection,
    query,
    orderBy,
    onSnapshot,
    collectionGroup,
    where,
    doc,
    getDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
    acceptConnectionRequest,
    rejectConnectionRequest,
    withdrawConnectionRequest,
} from '@/services/connectionService'
import { Badge } from '@/components/ui/badge'

interface IncomingRequest {
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

interface OutgoingRequest {
    targetUserId: string
    sentAt: any
    fromName: string
    targetUserData?: {
        firstName?: string
        lastName?: string
        photoURL?: string
        discipline?: string
        email?: string
    }
}

function targetUserIdFromOutgoingDoc(path: string): string {
    const parts = path.split('/')
    return parts[1] ?? ''
}

export function ConnectionRequestsDropdown() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [incoming, setIncoming] = useState<IncomingRequest[]>([])
    const [outgoing, setOutgoing] = useState<OutgoingRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [processingId, setProcessingId] = useState<string | null>(null)

    useEffect(() => {
        if (!user) return

        const requestsRef = collection(db, 'users', user.uid, 'connectionRequests')
        const qIn = query(requestsRef, orderBy('sentAt', 'desc'))

        const unsubIncoming = onSnapshot(qIn, async (snapshot) => {
            const list: IncomingRequest[] = []
            for (const docSnap of snapshot.docs) {
                const row = { id: docSnap.id, ...docSnap.data() } as IncomingRequest
                if (row.from) {
                    try {
                        const userDoc = await getDoc(doc(db, 'users', row.from))
                        if (userDoc.exists()) {
                            row.fromUserData = userDoc.data() as IncomingRequest['fromUserData']
                        }
                    } catch (e) {
                        console.error('Error fetching sender:', e)
                    }
                }
                list.push(row)
            }
            setIncoming(list)
            setLoading(false)
        })

        const qOut = query(
            collectionGroup(db, 'connectionRequests'),
            where('from', '==', user.uid)
        )

        const unsubOutgoing = onSnapshot(qOut, async (snapshot) => {
            const list: OutgoingRequest[] = []
            for (const docSnap of snapshot.docs) {
                const targetUserId = targetUserIdFromOutgoingDoc(docSnap.ref.path)
                if (!targetUserId || targetUserId === user.uid) continue

                const data = docSnap.data()
                const row: OutgoingRequest = {
                    targetUserId,
                    sentAt: data.sentAt,
                    fromName: (data.fromName as string) || '',
                }
                try {
                    const userDoc = await getDoc(doc(db, 'users', targetUserId))
                    if (userDoc.exists()) {
                        row.targetUserData = userDoc.data() as OutgoingRequest['targetUserData']
                    }
                } catch (e) {
                    console.error('Error fetching target user:', e)
                }
                list.push(row)
            }
            setOutgoing(list)
        })

        return () => {
            unsubIncoming()
            unsubOutgoing()
        }
    }, [user])

    const handleAccept = async (request: IncomingRequest) => {
        if (!user) return
        setProcessingId(request.id)
        try {
            const senderUid = request.from || request.id
            await acceptConnectionRequest(user.uid, senderUid)
        } catch (error) {
            console.error('Error accepting request:', error)
        } finally {
            setProcessingId(null)
        }
    }

    const handleReject = async (request: IncomingRequest) => {
        if (!user) return
        setProcessingId(request.id)
        try {
            const senderUid = request.from || request.id
            await rejectConnectionRequest(user.uid, senderUid)
        } catch (error) {
            console.error('Error rejecting request:', error)
        } finally {
            setProcessingId(null)
        }
    }

    const handleWithdraw = async (targetUserId: string) => {
        if (!user) return
        setProcessingId(`out-${targetUserId}`)
        try {
            await withdrawConnectionRequest(user.uid, targetUserId)
        } catch (error) {
            console.error('Error withdrawing request:', error)
        } finally {
            setProcessingId(null)
        }
    }

    const badgeCount = incoming.length + outgoing.length
    const needsAction = incoming.length > 0

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <UserPlus className="h-5 w-5" />
                    {badgeCount > 0 && (
                        <Badge
                            variant={needsAction ? 'destructive' : 'secondary'}
                            className="absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center p-0 text-[10px]"
                        >
                            {badgeCount > 9 ? '9+' : badgeCount}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[22rem] max-h-[min(28rem,80vh)] p-0 overflow-hidden flex flex-col">
                <div className="p-3 border-b shrink-0">
                    <h3 className="font-semibold">Connections</h3>
                    <p className="text-xs text-muted-foreground">
                        {incoming.length} to respond
                        {outgoing.length > 0 ? ` · ${outgoing.length} sent` : ''}
                    </p>
                </div>

                {loading ? (
                    <div className="p-8 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </div>
                ) : (
                    <Tabs defaultValue="incoming" className="flex flex-col min-h-0 flex-1">
                        <TabsList className="w-full rounded-none border-b h-9 shrink-0">
                            <TabsTrigger value="incoming" className="flex-1 text-xs">
                                Incoming ({incoming.length})
                            </TabsTrigger>
                            <TabsTrigger value="outgoing" className="flex-1 text-xs">
                                Sent ({outgoing.length})
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent
                            value="incoming"
                            className="m-0 max-h-64 overflow-y-auto data-[state=inactive]:hidden"
                        >
                            {incoming.length === 0 ? (
                                <div className="p-6 text-center text-sm text-muted-foreground">
                                    No incoming requests
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {incoming.map((request) => {
                                        const name = request.fromUserData
                                            ? `${request.fromUserData.firstName || ''} ${request.fromUserData.lastName || ''}`.trim()
                                            : request.fromName
                                        const avatar =
                                            request.fromUserData?.photoURL ||
                                            `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(request.fromEmail)}`

                                        return (
                                            <div key={request.id} className="p-3 hover:bg-muted/50">
                                                <div className="flex items-start gap-3">
                                                    <button
                                                        type="button"
                                                        className="shrink-0"
                                                        onClick={() => navigate(`/profile/${request.from || request.id}`)}
                                                    >
                                                        <img
                                                            src={avatar}
                                                            alt=""
                                                            className="w-10 h-10 rounded-full"
                                                        />
                                                    </button>
                                                    <div className="flex-1 min-w-0">
                                                        <button
                                                            type="button"
                                                            className="font-medium text-sm truncate text-left hover:underline"
                                                            onClick={() => navigate(`/profile/${request.from || request.id}`)}
                                                        >
                                                            {name}
                                                        </button>
                                                        {request.fromUserData?.discipline && (
                                                            <p className="text-xs text-muted-foreground truncate">
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
                                                                <X className="h-3 w-3 mr-1" />
                                                                Decline
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </TabsContent>
                        <TabsContent
                            value="outgoing"
                            className="m-0 max-h-64 overflow-y-auto data-[state=inactive]:hidden"
                        >
                            {outgoing.length === 0 ? (
                                <div className="p-6 text-center text-sm text-muted-foreground">
                                    No pending sent requests
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {outgoing.map((row) => {
                                        const name = row.targetUserData
                                            ? `${row.targetUserData.firstName || ''} ${row.targetUserData.lastName || ''}`.trim()
                                            : 'User'
                                        const avatar =
                                            row.targetUserData?.photoURL ||
                                            `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(row.targetUserData?.email || row.targetUserId)}`
                                        const pid = `out-${row.targetUserId}`

                                        return (
                                            <div key={row.targetUserId} className="p-3 hover:bg-muted/50">
                                                <div className="flex items-start gap-3">
                                                    <button
                                                        type="button"
                                                        className="shrink-0"
                                                        onClick={() => navigate(`/profile/${row.targetUserId}`)}
                                                    >
                                                        <img
                                                            src={avatar}
                                                            alt=""
                                                            className="w-10 h-10 rounded-full"
                                                        />
                                                    </button>
                                                    <div className="flex-1 min-w-0">
                                                        <button
                                                            type="button"
                                                            className="font-medium text-sm truncate text-left hover:underline"
                                                            onClick={() => navigate(`/profile/${row.targetUserId}`)}
                                                        >
                                                            {name}
                                                        </button>
                                                        <p className="text-xs text-muted-foreground">Awaiting response</p>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-7 text-xs mt-2"
                                                            onClick={() => handleWithdraw(row.targetUserId)}
                                                            disabled={processingId === pid}
                                                        >
                                                            {processingId === pid ? (
                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                            ) : (
                                                                <>
                                                                    <Undo2 className="h-3 w-3 mr-1" />
                                                                    Withdraw
                                                                </>
                                                            )}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

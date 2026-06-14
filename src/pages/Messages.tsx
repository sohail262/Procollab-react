import { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
    collection, doc, getDoc, getDocs, addDoc, query, where,
    orderBy, limit, onSnapshot, serverTimestamp, updateDoc
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useToast } from '@/hooks/use-toast'
import { 
    Send, Search, Loader2, MessageSquare, User, ArrowLeft 
} from 'lucide-react'

interface Conversation {
    id: string
    participants: Record<string, boolean>
    participantDetails: Record<string, {
        name: string
        photoURL?: string
        email?: string
    }>
    lastMessage?: string
    lastMessageAt?: any
    lastMessageSenderId?: string
    createdAt: any
}

interface Message {
    id: string
    senderId: string
    text: string
    createdAt: any
}

export function Messages() {
    const { user: currentUser } = useAuth()
    const { toast } = useToast()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    
    // States
    const [conversations, setConversations] = useState<Conversation[]>([])
    const [activeConvo, setActiveConvo] = useState<Conversation | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [inputText, setInputText] = useState('')
    const [loadingConvos, setLoadingConvos] = useState(true)
    const [loadingMessages, setLoadingMessages] = useState(false)
    const [sending, setSending] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    
    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null)
    
    const targetUserId = searchParams.get('userId')

    // ── Scroll to bottom ──────────────────────────────────────────────────
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        if (messages.length > 0) {
            scrollToBottom()
        }
    }, [messages])

    // ── Load Conversations ───────────────────────────────────────────────
    useEffect(() => {
        if (!currentUser) return

        const q = query(
            collection(db, 'conversations'),
            where(`participants.${currentUser.uid}`, '==', true),
            orderBy('lastMessageAt', 'desc')
        )

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list: Conversation[] = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data()
            } as Conversation))
            setConversations(list)
            setLoadingConvos(false)
        }, (error) => {
            console.error('Error fetching conversations:', error)
            setLoadingConvos(false)
        })

        return () => unsubscribe()
    }, [currentUser])

    // ── Handle redirect/init chat from userId query param ──────────────────
    useEffect(() => {
        if (!currentUser || loadingConvos || !targetUserId) return

        // Prevent chatting with oneself
        if (targetUserId === currentUser.uid) {
            toast({ title: 'Invalid chat partner', description: 'You cannot open a DM with yourself.' })
            return
        }

        async function initConversation() {
            try {
                // 1. Check if conversation already exists in local state
                const existing = conversations.find(c => 
                    c.participants[currentUser!.uid] && c.participants[targetUserId!]
                )

                if (existing) {
                    setActiveConvo(existing)
                    return
                }

                // 2. Query Firestore directly in case it is not in local active list yet
                const q = query(
                    collection(db, 'conversations'),
                    where(`participants.${currentUser!.uid}`, '==', true),
                    where(`participants.${targetUserId!}`, '==', true),
                    limit(1)
                )
                const snap = await getDocs(q)

                if (!snap.empty) {
                    const firstDoc = snap.docs[0]
                    setActiveConvo({ id: firstDoc.id, ...firstDoc.data() } as Conversation)
                    return
                }

                // 3. Create new conversation document
                setLoadingMessages(true)
                const [targetUserDoc, currentUserDoc] = await Promise.all([
                    getDoc(doc(db, 'users', targetUserId!)),
                    getDoc(doc(db, 'users', currentUser!.uid))
                ])

                if (!targetUserDoc.exists()) {
                    toast({ title: 'User not found', description: 'Cannot start conversation with non-existing user.', variant: 'destructive' })
                    setLoadingMessages(false)
                    return
                }

                const targetData = targetUserDoc.data()
                const currentData = currentUserDoc.exists() ? currentUserDoc.data() : {}

                const targetName = `${targetData.firstName || ''} ${targetData.lastName || ''}`.trim() || targetData.displayName || 'Collaborator'
                const currentName = `${currentData.firstName || ''} ${currentData.lastName || ''}`.trim() || currentData.displayName || 'Me'

                const newConvoData = {
                    participants: {
                        [currentUser!.uid]: true,
                        [targetUserId!]: true
                    },
                    participantDetails: {
                        [currentUser!.uid]: {
                            name: currentName,
                            photoURL: currentUser!.photoURL || ''
                        },
                        [targetUserId!]: {
                            name: targetName,
                            photoURL: targetData.photoURL || ''
                        }
                    },
                    createdAt: serverTimestamp(),
                    lastMessage: 'Conversation started',
                    lastMessageAt: serverTimestamp(),
                    lastMessageSenderId: currentUser!.uid
                }

                const newDocRef = await addDoc(collection(db, 'conversations'), newConvoData)
                setActiveConvo({ id: newDocRef.id, ...newConvoData } as Conversation)
            } catch (err) {
                console.error('Failed to init conversation:', err)
                toast({ title: 'Error', description: 'Failed to start conversation.', variant: 'destructive' })
            } finally {
                setLoadingMessages(false)
            }
        }

        initConversation()
    }, [targetUserId, conversations, loadingConvos, currentUser])

    // ── Listen to Messages of Active Conversation ──────────────────────────
    useEffect(() => {
        if (!activeConvo) {
            setMessages([])
            return
        }

        setLoadingMessages(true)
        const q = query(
            collection(db, 'conversations', activeConvo.id, 'messages'),
            orderBy('createdAt', 'asc')
        )

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list: Message[] = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data()
            } as Message))
            setMessages(list)
            setLoadingMessages(false)
        }, (error) => {
            console.error('Error fetching messages:', error)
            setLoadingMessages(false)
        })

        return () => unsubscribe()
    }, [activeConvo])

    // ── Send Message ──────────────────────────────────────────────────────
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!currentUser || !activeConvo || !inputText.trim() || sending) return

        const messageText = inputText.trim()
        setInputText('')
        setSending(true)

        try {
            const convoId = activeConvo.id

            // 1. Add message doc
            await addDoc(collection(db, 'conversations', convoId, 'messages'), {
                senderId: currentUser.uid,
                text: messageText,
                createdAt: serverTimestamp()
            })

            // 2. Update conversation header doc
            await updateDoc(doc(db, 'conversations', convoId), {
                lastMessage: messageText,
                lastMessageAt: serverTimestamp(),
                lastMessageSenderId: currentUser.uid
            })

        } catch (err) {
            console.error('Error sending message:', err)
            toast({ title: 'Failed to send message', variant: 'destructive' })
            setInputText(messageText) // Restore text
        } finally {
            setSending(false)
        }
    }

    // ── Get chat partner info ─────────────────────────────────────────────
    const getPartnerDetails = (convo: Conversation) => {
        if (!currentUser) return { name: 'Chat', photoURL: '' }
        const partnerId = Object.keys(convo.participants).find(id => id !== currentUser.uid)
        return convo.participantDetails[partnerId || ''] || { name: 'Collaborator', photoURL: '' }
    }

    // ── Filtered conversations ─────────────────────────────────────────────
    const filteredConvos = useMemo(() => {
        return conversations.filter(c => {
            const partner = getPartnerDetails(c)
            return partner.name.toLowerCase().includes(searchQuery.toLowerCase())
        })
    }, [conversations, searchQuery, currentUser])

    // Format Timestamp
    const formatTime = (timestamp: any) => {
        if (!timestamp) return ''
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    return (
        <DashboardLayout>
            <div className="flex h-[calc(100vh-140px)] border rounded-xl overflow-hidden bg-white dark:bg-gray-900 shadow-sm">
                
                {/* ── Left Sidebar: Conversation List ── */}
                <div className={`w-full md:w-80 border-r flex flex-col ${activeConvo ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-4 border-b">
                        <h1 className="text-xl font-bold mb-3">Messages</h1>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search conversations..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-1 p-2">
                        {loadingConvos ? (
                            <div className="flex justify-center items-center py-12">
                                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                            </div>
                        ) : filteredConvos.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-20" />
                                <p className="text-sm">No active conversations found</p>
                            </div>
                        ) : (
                            filteredConvos.map(convo => {
                                const partner = getPartnerDetails(convo)
                                const isActive = activeConvo?.id === convo.id
                                return (
                                    <div
                                        key={convo.id}
                                        onClick={() => {
                                            setActiveConvo(convo)
                                            // Clear URL parameters silently
                                            navigate('/messages', { replace: true })
                                        }}
                                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                                            isActive
                                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-950 dark:text-blue-200'
                                                : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                                        }`}
                                    >
                                        <Avatar className="h-10 w-10 border">
                                            <AvatarImage src={partner.photoURL} />
                                            <AvatarFallback className="bg-blue-150 dark:bg-blue-950">
                                                <User className="h-5 w-5" />
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between">
                                                <span className="font-semibold text-sm truncate">{partner.name}</span>
                                                <span className="text-[10px] text-muted-foreground">
                                                    {convo.lastMessageAt && formatTime(convo.lastMessageAt)}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                                                {convo.lastMessageSenderId === currentUser?.uid ? 'You: ' : ''}
                                                {convo.lastMessage}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* ── Right Panel: Chat Thread ── */}
                <div className={`flex-1 flex flex-col bg-gray-50/50 dark:bg-gray-950/20 ${!activeConvo ? 'hidden md:flex justify-center items-center text-muted-foreground' : 'flex'}`}>
                    {activeConvo ? (
                        <>
                            {/* Chat Header */}
                            <div className="p-4 border-b bg-white dark:bg-gray-900 flex items-center gap-3">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="md:hidden"
                                    onClick={() => setActiveConvo(null)}
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                                <Avatar className="h-9 w-9 border">
                                    <AvatarImage src={getPartnerDetails(activeConvo).photoURL} />
                                    <AvatarFallback>
                                        <User className="h-4 w-4" />
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <h2 className="font-semibold text-sm">{getPartnerDetails(activeConvo).name}</h2>
                                    <p className="text-[10px] text-green-500 font-medium">Direct Message</p>
                                </div>
                            </div>

                            {/* Messages Thread */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {loadingMessages && messages.length === 0 ? (
                                    <div className="flex justify-center items-center h-full">
                                        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                                    </div>
                                ) : (
                                    messages.map(msg => {
                                        const isMe = msg.senderId === currentUser?.uid
                                        return (
                                            <div
                                                key={msg.id}
                                                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                                            >
                                                <div className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                                                    isMe
                                                        ? 'bg-blue-600 text-white rounded-br-none'
                                                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-none border'
                                                }`}>
                                                    <p className="break-words leading-relaxed">{msg.text}</p>
                                                    <span className={`block text-[9px] mt-1 text-right ${
                                                        isMe ? 'text-blue-150' : 'text-muted-foreground'
                                                    }`}>
                                                        {msg.createdAt && formatTime(msg.createdAt)}
                                                    </span>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Message input */}
                            <form onSubmit={handleSendMessage} className="p-4 bg-white dark:bg-gray-900 border-t flex gap-2">
                                <Input
                                    placeholder="Type a message..."
                                    value={inputText}
                                    onChange={e => setInputText(e.target.value)}
                                    className="flex-1 bg-gray-50/50 dark:bg-gray-950/20"
                                    disabled={sending}
                                    maxLength={500}
                                />
                                <Button type="submit" size="icon" disabled={!inputText.trim() || sending}>
                                    {sending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Send className="h-4 w-4" />
                                    )}
                                </Button>
                            </form>
                        </>
                    ) : (
                        <div className="text-center p-6 space-y-3">
                            <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/10 flex items-center justify-center mx-auto border">
                                <MessageSquare className="h-8 w-8 text-blue-500" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900 dark:text-white">Your Chat Inbox</h3>
                                <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
                                    Select a user from the list or click "Message" on their discover card to start collaborating in real-time.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </DashboardLayout>
    )
}

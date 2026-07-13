import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'
import { useToast } from '@/hooks/use-toast'
import {
    ref,
    onValue,
    set,
    push,
    remove,
    off,
    query,
    limitToLast,
} from 'firebase/database'
import { database } from '@/lib/firebase'
import { doc, onSnapshot, getDoc, getDocs, collection, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { updateCollaborativeActivity } from '@/services/analyticsService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import {
    MessageSquare, Send, Trash2, Loader2,
    CheckCheck, X, CornerDownRight, Smile
} from 'lucide-react'
import { format } from 'date-fns'
import { sendNotificationWithPush } from '@/services/notificationTrigger'

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChatMessage {
    id:                 string
    text:               string
    senderId:           string
    senderName:         string
    senderAvatar:       string
    timestamp:          number
    replyToId?:         string
    replyToSenderName?: string
    replyToText?:       string
    reactions?:         Record<string, Record<string, boolean>>
}

export function TeamChat() {
    const { id: projectId } = useParams<{ id: string }>()
    const { user } = useAuth()
    const { isOwner, isAdmin } = usePermissions()
    const { toast } = useToast()

    // ─── State ────────────────────────────────────────────────────────────────
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [inputText, setInputText] = useState('')
    const [limitCount, setLimitCount] = useState(50)
    const [loading, setLoading] = useState(true)
    const [connected, setConnected] = useState(true)
    const [sending, setSending] = useState(false)
    const [roleSet, setRoleSet] = useState(false)

    // User profile from Firestore for name/avatar sync
    const [userProfile, setUserProfile] = useState<any>(null)

    // Project members directory from RTDB for read receipts and @tagging list
    const [members, setMembers] = useState<Record<string, { role: string; name: string; avatar: string; lastReadTimestamp?: number }>>({})

    // Complete project team (owner + admins + members) from Firestore for tagging/mentions
    const [projectTeam, setProjectTeam] = useState<{ uid: string; name: string; avatar: string; role: string }[]>([])

    // @tagging autocomplete state
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [suggestionFilter, setSuggestionFilter] = useState('')
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)

    // Right click reply states
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; message: ChatMessage } | null>(null)
    const [replyToMessage, setReplyToMessage] = useState<ChatMessage | null>(null)

    // Track clicked mentions to hide the `@` scroll indicator once tapped
    const [clickedMentionIds, setClickedMentionIds] = useState<Set<string>>(new Set())
    const hasLoadedRef = useRef(false)

    // Load read mentions once user and project ID are available
    useEffect(() => {
        if (!user?.uid || !projectId) return
        try {
            const saved = localStorage.getItem(`read_mentions_${projectId}_${user.uid}`)
            if (saved) {
                setClickedMentionIds(new Set(JSON.parse(saved)))
            }
        } catch (err) {
            console.error('Error loading read mentions:', err)
        } finally {
            hasLoadedRef.current = true
        }
    }, [projectId, user?.uid])

    // Save to localStorage when it changes
    useEffect(() => {
        if (!user?.uid || !projectId || !hasLoadedRef.current) return
        try {
            localStorage.setItem(
                `read_mentions_${projectId}_${user.uid}`,
                JSON.stringify(Array.from(clickedMentionIds))
            )
        } catch (err) {
            console.error('Error saving read mentions:', err)
        }
    }, [clickedMentionIds, projectId, user?.uid])

    // Emoji reactions
    const [activeReactionPickerMsgId, setActiveReactionPickerMsgId] = useState<string | null>(null)

    useEffect(() => {
        const closePickers = () => setActiveReactionPickerMsgId(null)
        window.addEventListener('click', closePickers)
        return () => window.removeEventListener('click', closePickers)
    }, [])

    const handleToggleReaction = async (msgId: string, emoji: string) => {
        if (!projectId || !user) return
        try {
            const reactionRef = ref(database, `chats/${projectId}/${msgId}/reactions/${emoji}/${user.uid}`)
            const msg = messages.find(m => m.id === msgId)
            const hasReacted = msg?.reactions?.[emoji]?.[user.uid]
            if (hasReacted) {
                await remove(reactionRef)
            } else {
                await set(reactionRef, true)
            }
        } catch (err) {
            console.error('Error toggling reaction:', err)
        }
    }

    const renderReactions = (msg: ChatMessage) => {
        if (!msg.reactions) return null
        
        const emojiEntries = Object.entries(msg.reactions).filter(([_, userMap]) => {
            return Object.keys(userMap).length > 0
        })

        if (emojiEntries.length === 0) return null

        return (
            <div className="flex flex-wrap gap-1 mt-1.5 select-none">
                {emojiEntries.map(([emoji, userMap]) => {
                    const userUids = Object.keys(userMap)
                    const count = userUids.length
                    const hasReacted = userMap[user?.uid || '']
                    
                    return (
                        <button
                            key={emoji}
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                handleToggleReaction(msg.id, emoji)
                            }}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border transition-all duration-150 active:scale-95 ${
                                hasReacted
                                    ? 'bg-zinc-900 border-zinc-900 text-white dark:bg-zinc-100 dark:border-zinc-100 dark:text-zinc-900'
                                    : 'bg-zinc-50/50 border-zinc-200 text-zinc-650 hover:bg-zinc-100 dark:bg-zinc-800/40 dark:border-zinc-850 dark:text-zinc-400 dark:hover:bg-zinc-800/80'
                            }`}
                        >
                            <span>{emoji}</span>
                            <span className="text-[10px] font-mono tabular-nums">{count}</span>
                        </button>
                    )
                })}
            </div>
        )
    }

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const prevMessagesCount = useRef(0)

    // ─── Load Firestore User Profile ──────────────────────────────────────────
    useEffect(() => {
        if (!user?.uid) return
        const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
            if (snap.exists()) {
                setUserProfile(snap.data())
            }
        }, (err) => {
            console.error('Error fetching user profile in TeamChat:', err)
        })
        return () => unsub()
    }, [user?.uid])

    // ─── Setup RTDB Membership ────────────────────────────────────────────────
    useEffect(() => {
        if (!projectId || !user) return
        setRoleSet(false)
        const role = isOwner ? 'owner' : isAdmin ? 'admin' : 'member'
        const avatar = userProfile?.photoURL || user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user?.email || user?.uid || 'default')}`
        const name = userProfile ? `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || user.displayName || 'Anonymous User' : user.displayName || 'Anonymous User'

        const memberRef = ref(database, `projectMembers/${projectId}/${user.uid}`)
        const payload = {
            role,
            name,
            avatar,
            lastReadTimestamp: Date.now()
        }
        set(memberRef, payload)
            .then(() => {
                setRoleSet(true)
            })
            .catch(err => {
                console.error('Error setting role in RTDB:', err)
            })
    }, [projectId, user, isOwner, isAdmin, userProfile])

    // ─── Sync RTDB Members Directory ──────────────────────────────────────────
    useEffect(() => {
        if (!projectId || !roleSet) return
        const membersRef = ref(database, `projectMembers/${projectId}`)
        const unsub = onValue(membersRef, (snap) => {
            const data = snap.val()
            if (data) {
                setMembers(data)
            } else {
                setMembers({})
            }
        })
        return () => off(membersRef)
    }, [projectId, roleSet])

    // ─── Sync Complete Project Team from Firestore (Owner + Admins + Members) ────
    useEffect(() => {
        if (!projectId) return

        let active = true
        let unsubMembers: (() => void) | null = null

        const loadTeam = async () => {
            try {
                const projSnap = await getDoc(doc(db, 'projects', projectId))
                if (!projSnap.exists() || !active) return
                const projData = projSnap.data()
                const ownerUid = projData.createdBy

                let ownerDetail = {
                    uid: ownerUid,
                    name: 'Project Owner',
                    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(ownerUid || 'owner')}`,
                    role: 'owner'
                }

                if (ownerUid) {
                    const ownerSnap = await getDoc(doc(db, 'users', ownerUid))
                    if (ownerSnap.exists() && active) {
                        const ownerData = ownerSnap.data()
                        ownerDetail = {
                            uid: ownerUid,
                            name: `${ownerData.firstName || ''} ${ownerData.lastName || ''}`.trim() || ownerData.displayName || 'Project Owner',
                            avatar: ownerData.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(ownerUid)}`,
                            role: 'owner'
                        }
                    }
                }

                if (!active) return

                const membersRef = collection(db, 'projects', projectId, 'members')
                unsubMembers = onSnapshot(membersRef, (membersSnap) => {
                    const list = [ownerDetail]
                    membersSnap.docs.forEach((docSnap) => {
                        const m = docSnap.data()
                        if (docSnap.id === ownerUid) return
                        list.push({
                            uid: docSnap.id,
                            name: m.name || m.displayName || 'Team Member',
                            avatar: m.avatar || m.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(docSnap.id)}`,
                            role: m.role || 'member'
                        })
                    })
                    if (active) {
                        setProjectTeam(list)
                    }
                }, (err) => {
                    console.error('Error listening to project members:', err)
                })

            } catch (err) {
                console.error('Error initializing project team for mentions:', err)
            }
        }

        loadTeam()

        return () => {
            active = false
            if (unsubMembers) unsubMembers()
        }
    }, [projectId])

    // ─── Monitor Connection Status ────────────────────────────────────────────
    useEffect(() => {
        const connRef = ref(database, '.info/connected')
        const unsub = onValue(connRef, snap => {
            setConnected(snap.val() === true)
        })
        return () => off(connRef)
    }, [])

    // ─── Close Context Menu on click outside ──────────────────────────────────
    useEffect(() => {
        const closeMenu = () => setContextMenu(null)
        window.addEventListener('click', closeMenu)
        return () => window.removeEventListener('click', closeMenu)
    }, [])

    // ─── Load Chat Messages & Update Read Receipts ────────────────────────────
    useEffect(() => {
        if (!projectId || !user || !roleSet) return

        setLoading(true)
        const chatRef = query(ref(database, `chats/${projectId}`), limitToLast(limitCount))

        const unsub = onValue(chatRef, snap => {
            const data = snap.val()
            if (data) {
                const list: ChatMessage[] = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                }))
                list.sort((a, b) => a.timestamp - b.timestamp)
                setMessages(list)

                // Update our read receipt when new messages are loaded
                const lastMsg = list[list.length - 1]
                if (lastMsg && lastMsg.senderId !== user.uid) {
                    const myReadRef = ref(database, `projectMembers/${projectId}/${user.uid}/lastReadTimestamp`)
                    set(myReadRef, Date.now()).catch(e => console.error("Error setting lastReadTimestamp:", e))
                }
            } else {
                setMessages([])
            }
            setLoading(false)
        }, err => {
            console.error('RTDB Chat read error:', err)
            setLoading(false)
        })

        return () => unsub()
    }, [projectId, user, limitCount, roleSet])

    // ─── Scroll-to-Bottom Logic ───────────────────────────────────────────────
    useEffect(() => {
        if (messages.length > 0) {
            const lastMsg = messages[messages.length - 1]
            const isOwnMessage = lastMsg.senderId === user?.uid
            const isInitialLoad = prevMessagesCount.current === 0

            if (isOwnMessage || isInitialLoad) {
                scrollToBottom('smooth')
            }
            prevMessagesCount.current = messages.length
        }
    }, [messages, user?.uid])

    const scrollToBottom = (behavior: 'smooth' | 'auto') => {
        messagesEndRef.current?.scrollIntoView({ behavior })
    }

    // ─── Message Scrolling & Highlighting ─────────────────────────────────────
    const scrollToMessage = (msgId: string) => {
        const element = document.getElementById(`msg-${msgId}`)
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
            element.classList.remove('animate-highlight')
            // trigger reflow
            void element.offsetWidth
            element.classList.add('animate-highlight')
        }
    }

    // ─── Message Helpers ──────────────────────────────────────────────────────
    const handleSend = async (e?: React.FormEvent) => {
        if (e) e.preventDefault()
        if (!inputText.trim() || !projectId || !user || !connected) return

        const text = inputText.trim()
        setInputText('')
        setSending(true)
        setShowSuggestions(false)
        setReplyToMessage(null)

        try {
            const chatRef = ref(database, `chats/${projectId}`)
            const newMessageRef = push(chatRef)
            const avatar = userProfile?.photoURL || user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user?.email || user?.uid || 'default')}`
            const name = userProfile ? `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || user.displayName || 'Anonymous User' : user.displayName || 'Anonymous User'

            const payload = {
                text,
                senderId: user.uid,
                senderName: name,
                senderAvatar: avatar,
                timestamp: Date.now(),
                ...(replyToMessage && {
                    replyToId: replyToMessage.id,
                    replyToSenderName: replyToMessage.senderName,
                    replyToText: replyToMessage.text
                })
            }
            await set(newMessageRef, payload)

            // Update read receipt immediately
            const myReadRef = ref(database, `projectMembers/${projectId}/${user.uid}/lastReadTimestamp`)
            await set(myReadRef, Date.now())

            // Update collaborative activity
            updateCollaborativeActivity(user.uid, projectId)

            // Owner FVE Activation
            if (isOwner && projectTeam.length >= 2) {
                try {
                    const userRef = doc(db, 'users', user.uid)
                    const userSnap = await getDoc(userRef)
                    if (userSnap.exists()) {
                        const userData = userSnap.data()
                        if (!userData.activated) {
                            await updateDoc(userRef, {
                                activated: true,
                                activatedAt: serverTimestamp(),
                                activationPath: 'owner'
                            })
                        }
                    }
                } catch (err) {
                    console.error('Owner activation check failed:', err)
                }
            }

            // Notify mentioned users
            projectTeam.forEach(async (m) => {
                if (m.uid !== user.uid && m.name && text.includes(`@${m.name}`)) {
                    try {
                        await sendNotificationWithPush(m.uid, {
                            title: '💬 Mentioned in Team Chat',
                            body: `${name} mentioned you in chat: "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}"`,
                            type: 'info',
                            url: `/project/${projectId}/dashboard?tab=chat`,
                            projectId,
                        })
                    } catch (err) {
                        console.error('Error sending mention notification:', err)
                    }
                }
            })
        } catch (err: any) {
            console.error('Error sending message:', err)
            toast({
                title: 'Failed to send message',
                description: err.message || 'Please check your permissions and try again.',
                variant: 'destructive'
            })
        } finally {
            setSending(false)
            setTimeout(() => {
                inputRef.current?.focus()
            }, 50)
        }
    }

    const handleDelete = async (msgId: string) => {
        if (!projectId) return
        const confirmDelete = window.confirm("Are you sure you want to delete this message?")
        if (!confirmDelete) return

        try {
            await remove(ref(database, `chats/${projectId}/${msgId}`))
            toast({ title: 'Message deleted' })
        } catch (err: any) {
            console.error('Error deleting message:', err)
            toast({
                title: 'Error deleting message',
                description: 'You do not have permission to delete this message.',
                variant: 'destructive'
            })
        }
    }

    const handleLoadMore = () => {
        setLimitCount(prev => prev + 50)
    }

    // ─── Right Click Context Menu ─────────────────────────────────────────────
    const handleContextMenu = (e: React.MouseEvent, msg: ChatMessage) => {
        e.preventDefault()
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            message: msg
        })
    }

    // ─── Mentions Autocomplete & Formatting ───────────────────────────────────
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        setInputText(val)

        const cursorPosition = e.target.selectionStart || 0
        const textBeforeCursor = val.slice(0, cursorPosition)
        const lastAtIdx = textBeforeCursor.lastIndexOf('@')

        if (lastAtIdx !== -1) {
            const charBeforeAt = lastAtIdx > 0 ? textBeforeCursor[lastAtIdx - 1] : ' '
            const textAfterAt = textBeforeCursor.slice(lastAtIdx + 1)
            
            if (charBeforeAt === ' ' || charBeforeAt === '\n') {
                if (!textAfterAt.includes(' ')) {
                    setSuggestionFilter(textAfterAt.toLowerCase())
                    setShowSuggestions(true)
                    setSelectedSuggestionIndex(0)
                    return
                }
            }
        }
        setShowSuggestions(false)
    }

    const selectSuggestion = (member: { uid: string; name: string }) => {
        const cursorPosition = inputRef.current?.selectionStart || 0
        const textBeforeCursor = inputText.slice(0, cursorPosition)
        const textAfterCursor = inputText.slice(cursorPosition)
        
        const lastAtIdx = textBeforeCursor.lastIndexOf('@')
        if (lastAtIdx !== -1) {
            const newText = textBeforeCursor.slice(0, lastAtIdx) + `@${member.name} ` + textAfterCursor
            setInputText(newText)
            setShowSuggestions(false)
            setTimeout(() => {
                if (inputRef.current) {
                    const newCursorPos = lastAtIdx + member.name.length + 2
                    inputRef.current.setSelectionRange(newCursorPos, newCursorPos)
                    inputRef.current.focus()
                }
            }, 0)
        }
    }

    const filteredSuggestions = projectTeam
        .filter(m => m.uid !== user?.uid && m.name && m.name.toLowerCase().includes(suggestionFilter))
        .map(m => ({ uid: m.uid, name: m.name, avatar: m.avatar }))

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (showSuggestions && filteredSuggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSelectedSuggestionIndex(prev => (prev + 1) % filteredSuggestions.length)
            } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelectedSuggestionIndex(prev => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length)
            } else if (e.key === 'Enter') {
                e.preventDefault()
                selectSuggestion(filteredSuggestions[selectedSuggestionIndex])
            } else if (e.key === 'Escape') {
                e.preventDefault()
                setShowSuggestions(false)
            }
        }
    }

    const renderMessageText = (text: string, isOwn: boolean) => {
        const memberNames = projectTeam.map(m => m.name).filter(Boolean)
        if (memberNames.length === 0) return <p className="whitespace-pre-wrap">{text}</p>

        const sortedNames = [...memberNames].sort((a, b) => b.length - a.length)
        const escapedNames = sortedNames.map(name => name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'))
        const regexPattern = new RegExp(`@(${escapedNames.join('|')})`, 'g')

        const parts = []
        let lastIndex = 0
        let match

        while ((match = regexPattern.exec(text)) !== null) {
            const matchIndex = match.index
            const matchText = match[0]

            if (matchIndex > lastIndex) {
                parts.push(text.slice(lastIndex, matchIndex))
            }

            parts.push(
                <span 
                    key={matchIndex} 
                    className={`font-semibold px-1 py-0.5 rounded text-[13px] inline-block ${
                        isOwn 
                            ? 'bg-white/15 text-white/90 dark:bg-zinc-950/15 dark:text-zinc-900' 
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                    }`}
                >
                    {matchText}
                </span>
            )

            lastIndex = regexPattern.lastIndex
        }

        if (lastIndex < text.length) {
            parts.push(text.slice(lastIndex))
        }

        return (
            <div className="whitespace-pre-wrap leading-relaxed text-sm">
                {parts.length > 0 ? parts : text}
            </div>
        )
    }

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n.charAt(0))
            .join('')
            .toUpperCase()
            .slice(0, 2)
    }

    const getAvatarColor = (uid: string) => {
        const colors = [
            'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 border border-zinc-200/50 dark:border-zinc-700/50',
            'bg-zinc-200 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 border border-zinc-300/50 dark:border-zinc-800/50',
            'bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 border border-zinc-950/20 dark:border-zinc-200/20',
            'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200 border border-neutral-200/50 dark:border-neutral-700/50',
            'bg-neutral-200 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 border border-neutral-300/50 dark:border-neutral-800/50',
            'bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-200 border border-stone-200/50 dark:border-stone-700/50',
            'bg-stone-200 text-stone-900 dark:bg-stone-900 dark:text-stone-100 border border-stone-300/50 dark:border-stone-800/50',
            'bg-zinc-50 text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 border border-zinc-200/50 dark:border-zinc-900/50'
        ]
        let hash = 0
        for (let i = 0; i < uid.length; i++) {
            hash = uid.charCodeAt(i) + ((hash << 5) - hash)
        }
        return colors[Math.abs(hash) % colors.length]
    }

    const formatHeaderDate = (timestamp: number) => {
        const date = new Date(timestamp)
        const today = new Date()
        const yesterday = new Date()
        yesterday.setDate(today.getDate() - 1)

        if (date.toDateString() === today.toDateString()) {
            return 'Today'
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday'
        } else {
            return format(date, 'MMMM d, yyyy')
        }
    }

    const hasMore = messages.length === limitCount

    // ─── Filter Mention Messages for `@` scroll indicator ─────────────────────
    const myName = userProfile ? `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() : (user?.displayName || '')
    const mentionMessages = messages.filter(msg => 
        msg.senderId !== user?.uid && 
        myName && 
        msg.text.includes(`@${myName}`)
    )

    // filter only those that haven't been clicked/tapped in this session
    const activeMentions = mentionMessages.filter(msg => !clickedMentionIds.has(msg.id))

    const handleMentionScroll = () => {
        if (activeMentions.length === 0) return
        const targetMsg = activeMentions[0] // scroll to the first active mention
        scrollToMessage(targetMsg.id)
        
        // Mark as clicked so it disappears
        setClickedMentionIds(prev => {
            const next = new Set(prev)
            next.add(targetMsg.id)
            return next
        })
    }

    // ─── Compute read receipts (LinkedIn-style, latest message read only) ──
    const lastReadMap: Record<string, { uid: string; name: string; avatar: string }[]> = {}
    Object.entries(members).forEach(([uid, m]) => {
        if (uid === user?.uid || !m.lastReadTimestamp) return
        
        let latestReadMsgId: string | null = null
        let maxTimestamp = -1
        
        messages.forEach((msg) => {
            if (msg.timestamp <= m.lastReadTimestamp! && msg.timestamp > maxTimestamp) {
                maxTimestamp = msg.timestamp
                latestReadMsgId = msg.id
            }
        })
        
        if (latestReadMsgId) {
            if (!lastReadMap[latestReadMsgId]) {
                lastReadMap[latestReadMsgId] = []
            }
            lastReadMap[latestReadMsgId].push({
                uid,
                name: m.name,
                avatar: m.avatar
            })
        }
    })

    // ─── Render ───────────────────────────────────────────────────────────────
    const onlineMembers = Object.entries(members).filter(([uid]) => uid !== user?.uid)

    return (
        <div className="flex flex-col h-full rounded-2xl overflow-hidden relative border border-zinc-200/80 dark:border-zinc-800/80 bg-white/40 dark:bg-black/40 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.06)] antialiased">
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes msgHighlight {
                    0% { background-color: rgba(24, 24, 27, 0.08); }
                    50% { background-color: rgba(24, 24, 27, 0.04); }
                    100% { background-color: transparent; }
                }
                .dark .animate-highlight {
                    animation: msgHighlightDark 2s ease-out;
                    border-radius: 12px;
                }
                @keyframes msgHighlightDark {
                    0% { background-color: rgba(250, 250, 250, 0.08); }
                    50% { background-color: rgba(250, 250, 250, 0.04); }
                    100% { background-color: transparent; }
                }
                .animate-highlight {
                    animation: msgHighlight 2s ease-out;
                    border-radius: 12px;
                }
                @keyframes msgSlideIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                .msg-enter {
                    animation: msgSlideIn 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
                }
            `}} />

            {/* ── @mention jump pill ── */}
            {activeMentions.length > 0 && (
                <button
                    type="button"
                    onClick={handleMentionScroll}
                    className="absolute bottom-20 right-6 z-40 flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950 rounded-full shadow-lg text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-transform active:scale-[0.96] duration-150"
                >
                    <span className="font-mono">@</span>
                    <span className="tabular-nums">{activeMentions.length} mention{activeMentions.length > 1 ? 's' : ''}</span>
                </button>
            )}

            {/* ── Context menu ── */}
            {contextMenu && (
                <div
                    className="fixed z-50 min-w-[160px] bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl shadow-2xl py-1 overflow-hidden"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        type="button"
                        onClick={() => {
                            setReplyToMessage(contextMenu.message)
                            setContextMenu(null)
                            inputRef.current?.focus()
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-left transition-colors duration-150 active:scale-[0.96]"
                    >
                        <CornerDownRight className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                        Reply
                    </button>
                    {(contextMenu.message.senderId === user?.uid || isOwner || isAdmin) && (
                        <button
                            type="button"
                            onClick={() => {
                                handleDelete(contextMenu.message.id)
                                setContextMenu(null)
                            }}
                            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-955/20 text-left transition-colors duration-150 active:scale-[0.96]"
                        >
                            <Trash2 className="h-4 w-4 text-red-500" />
                            Delete
                        </button>
                    )}
                </div>
            )}

            {/* ── Header ── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/20 dark:bg-black/20 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-zinc-900/5 dark:bg-zinc-100/5">
                        <MessageSquare className="h-4 w-4 text-zinc-900 dark:text-zinc-100" />
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 text-wrap-balance">Team Chat</h4>
                        {onlineMembers.length > 0 && (
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 font-medium tabular-nums">
                                {onlineMembers.length} member{onlineMembers.length !== 1 ? 's' : ''} in workspace
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {/* Member avatars strip */}
                    {onlineMembers.length > 0 && (
                        <div className="flex -space-x-2">
                            {onlineMembers.slice(0, 4).map(([uid, m]) => (
                                m.avatar ? (
                                    <img key={uid} src={m.avatar} alt={m.name} title={m.name}
                                        className="w-7 h-7 rounded-full border-2 border-white dark:border-zinc-950 object-cover shadow-sm outline outline-1 outline-black/5 dark:outline-white/5 transition-transform duration-200 hover:scale-105" />
                                ) : (
                                    <div key={uid} title={m.name}
                                        className={`w-7 h-7 rounded-full border-2 border-white dark:border-zinc-950 flex items-center justify-center text-[10px] font-bold shadow-sm outline outline-1 outline-black/5 dark:outline-white/5 transition-transform duration-200 hover:scale-105 ${getAvatarColor(uid)}`}>
                                        {getInitials(m.name)}
                                    </div>
                                )
                            ))}
                            {onlineMembers.length > 4 && (
                                <div className="w-7 h-7 rounded-full border-2 border-white dark:border-zinc-950 bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 shadow-sm outline outline-1 outline-black/5 dark:outline-white/5">
                                    +{onlineMembers.length - 4}
                                </div>
                            )}
                        </div>
                    )}
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${connected ? 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-red-500/10 text-red-700 dark:bg-red-500/20 dark:text-red-400'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'} ${connected ? 'animate-pulse' : ''}`} />
                        {connected ? 'Live' : 'Reconnecting'}
                    </span>
                </div>
            </div>

            {/* ── Messages area ── */}
            <div className="flex-1 overflow-y-auto px-6 py-5 scroll-smooth space-y-4" ref={containerRef}>
                {loading && messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-500 dark:text-zinc-400">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="text-sm font-medium">Loading messages…</span>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8 max-w-sm mx-auto">
                        <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-center text-zinc-400 dark:text-zinc-500 shadow-sm">
                            <MessageSquare className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Start the conversation</p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed text-wrap-pretty">
                                This is the beginning of your team workspace. Send a message to get started.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-0.5">
                        {hasMore && (
                            <div className="text-center py-4">
                                <button
                                    type="button"
                                    onClick={handleLoadMore}
                                    className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 border border-zinc-200 dark:border-zinc-800 rounded-full px-4 py-1.5 bg-white/50 dark:bg-black/50 backdrop-blur-sm shadow-sm transition-all duration-200 hover:bg-zinc-50 dark:hover:bg-zinc-900 active:scale-[0.96]"
                                >
                                    Load older messages
                                </button>
                            </div>
                        )}

                        {messages.map((msg, index) => {
                            const isOwn = msg.senderId === user?.uid
                            const showHeader = index === 0 || formatHeaderDate(messages[index - 1].timestamp) !== formatHeaderDate(msg.timestamp)
                            const prevMsg = messages[index - 1]
                            const showSender = index === 0 || prevMsg.senderId !== msg.senderId || showHeader || (msg.timestamp - prevMsg.timestamp > 300000)
                            const canDelete = isOwn || isOwner || isAdmin
                            const member = members[msg.senderId]
                            const senderName = member?.name || msg.senderName || 'User'
                            const senderAvatar = member?.avatar || msg.senderAvatar || ''
                            const readBy = lastReadMap[msg.id] || []

                            return (
                                <div key={msg.id} id={`msg-${msg.id}`} className="msg-enter transition-colors duration-150 rounded-xl relative">
                                    {/* ── Date divider ── */}
                                    {showHeader && (
                                        <div className="flex items-center gap-4 my-6 select-none">
                                            <div className="flex-1 h-px bg-zinc-200/80 dark:bg-zinc-800/80" />
                                            <span className="text-[10px] font-mono tracking-wider font-semibold text-zinc-500 dark:text-zinc-400 bg-white/80 dark:bg-black/80 border border-zinc-200/80 dark:border-zinc-800/80 rounded-full px-3 py-1 shadow-sm backdrop-blur-md">
                                                {formatHeaderDate(msg.timestamp)}
                                            </span>
                                            <div className="flex-1 h-px bg-zinc-200/80 dark:bg-zinc-800/80" />
                                        </div>
                                    )}

                                    {isOwn ? (
                                        /* ── Own message: right-aligned white/black bubble ── */
                                        <div className={`flex flex-col items-end ${showSender ? 'mt-4' : 'mt-1'}`}>
                                            <div className="group flex items-end gap-2 max-w-[80%] relative">
                                                {/* Hover actions menu instead of just a delete button */}
                                                <div className="absolute top-1/2 -translate-y-1/2 right-full mr-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-md overflow-hidden z-10">
                                                    <div className="relative">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                setActiveReactionPickerMsgId(activeReactionPickerMsgId === msg.id ? null : msg.id)
                                                            }}
                                                            className="h-8 px-2.5 flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors duration-150 active:scale-[0.96]"
                                                            title="React"
                                                        >
                                                            <Smile className="h-3.5 w-3.5" />
                                                        </button>
                                                        {activeReactionPickerMsgId === msg.id && (
                                                            <div 
                                                                className="absolute bottom-full mb-1 right-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full shadow-lg p-1.5 flex gap-1 z-30 animate-in fade-in zoom-in-95 duration-100"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                {['👍', '❤️', '🔥', '👏', '😂', '🎉', '😮'].map(emoji => (
                                                                    <button
                                                                        key={emoji}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            handleToggleReaction(msg.id, emoji)
                                                                            setActiveReactionPickerMsgId(null)
                                                                        }}
                                                                        className="hover:scale-125 transition-transform duration-100 p-1.5 text-base"
                                                                    >
                                                                        {emoji}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setReplyToMessage(msg)
                                                            inputRef.current?.focus()
                                                        }}
                                                        className="h-8 px-2.5 flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors duration-150 active:scale-[0.96]"
                                                        title="Reply"
                                                    >
                                                        <CornerDownRight className="h-3.5 w-3.5" />
                                                    </button>
                                                    {canDelete && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(msg.id)}
                                                            className="h-8 px-2.5 flex items-center gap-1 text-xs font-medium text-red-650 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-955/20 transition-colors duration-150 active:scale-[0.96]"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}
                                                </div>

                                                <div
                                                    onContextMenu={(e) => handleContextMenu(e, msg)}
                                                    className="bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-950 px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed break-words cursor-default select-text shadow-sm hover:shadow-md transition-shadow duration-150"
                                                >
                                                    {msg.replyToId && (
                                                        <div
                                                            onClick={(e) => { e.stopPropagation(); scrollToMessage(msg.replyToId!) }}
                                                            className="mb-2 px-2.5 py-1.5 rounded-lg border-l-2 border-zinc-500 bg-white/10 dark:bg-black/10 text-[11px] cursor-pointer hover:bg-white/15 dark:hover:bg-black/15 transition-colors duration-150 flex items-start gap-1.5 text-zinc-300 dark:text-zinc-700"
                                                        >
                                                            <CornerDownRight className="h-3 w-3 shrink-0 mt-0.5 opacity-70" />
                                                            <div className="truncate min-w-0">
                                                                <span className="font-semibold opacity-90 mr-1">{msg.replyToSenderName}:</span>
                                                                <span className="opacity-80">{msg.replyToText}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {renderMessageText(msg.text, isOwn)}
                                                    <div className="flex items-center justify-end gap-1 mt-1.5 opacity-60 text-[9px] font-mono select-none tabular-nums">
                                                        {format(new Date(msg.timestamp), 'h:mm a')}
                                                        <CheckCheck className="h-3 w-3 text-zinc-400 dark:text-zinc-500" />
                                                    </div>
                                                </div>
                                            </div>
                                            {renderReactions(msg)}
                                            {/* Read receipts */}
                                            {readBy.length > 0 && (
                                                <div className="flex items-center gap-1 mt-1 mr-1">
                                                    <div className="flex -space-x-1">
                                                        {readBy.slice(0, 5).map((u) => (
                                                            u.avatar ? (
                                                                <img key={u.uid} src={u.avatar} alt={u.name} title={`Seen by ${u.name}`}
                                                                    className="w-4 h-4 rounded-full border border-white dark:border-zinc-955 object-cover shadow-sm outline outline-1 outline-black/5 dark:outline-white/5" />
                                                            ) : (
                                                                <div key={u.uid} title={`Seen by ${u.name}`}
                                                                    className={`w-4 h-4 rounded-full border border-white dark:border-zinc-955 flex items-center justify-center text-[7px] font-bold shadow-sm outline outline-1 outline-black/5 dark:outline-white/5 ${getAvatarColor(u.uid)}`}>
                                                                    {getInitials(u.name)}
                                                                </div>
                                                            )
                                                        ))}
                                                    </div>
                                                    {readBy.length > 5 && <span className="text-[9px] font-mono text-zinc-500 dark:text-zinc-400 ml-0.5 tabular-nums">+{readBy.length - 5}</span>}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        /* ── Others' messages: left-aligned gray/dark bubble ── */
                                        <div className={`group flex items-start gap-3 ${showSender ? 'mt-4' : 'mt-1'}`}>
                                            {/* Hover action menu for others msgs */}
                                            <div className="absolute top-2 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center bg-white dark:bg-zinc-905 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-md overflow-hidden z-10">
                                                <div className="relative">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setActiveReactionPickerMsgId(activeReactionPickerMsgId === msg.id ? null : msg.id)
                                                        }}
                                                        className="h-8 px-2.5 flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-955 dark:text-zinc-400 dark:hover:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors duration-150 active:scale-[0.96]"
                                                        title="React"
                                                    >
                                                        <Smile className="h-3.5 w-3.5" />
                                                    </button>
                                                    {activeReactionPickerMsgId === msg.id && (
                                                        <div 
                                                            className="absolute bottom-full mb-1 right-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full shadow-lg p-1.5 flex gap-1 z-30 animate-in fade-in zoom-in-95 duration-100"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            {['👍', '❤️', '🔥', '👏', '😂', '🎉', '😮'].map(emoji => (
                                                                <button
                                                                    key={emoji}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        handleToggleReaction(msg.id, emoji)
                                                                        setActiveReactionPickerMsgId(null)
                                                                    }}
                                                                    className="hover:scale-125 transition-transform duration-100 p-1.5 text-base"
                                                                >
                                                                    {emoji}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setReplyToMessage(msg)
                                                        inputRef.current?.focus()
                                                    }}
                                                    className="h-8 px-2.5 flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors duration-150 active:scale-[0.96]"
                                                    title="Reply"
                                                >
                                                    <CornerDownRight className="h-3.5 w-3.5" />
                                                </button>
                                                {canDelete && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(msg.id)}
                                                        className="h-8 px-2.5 flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-955/20 transition-colors duration-150 active:scale-[0.96]"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </div>

                                            {/* Avatar column */}
                                            <div className="w-9 shrink-0 flex justify-center pt-0.5">
                                                {showSender ? (
                                                    senderAvatar ? (
                                                        <img src={senderAvatar} alt={senderName}
                                                            className="h-9 w-9 rounded-full object-cover border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm outline outline-1 outline-black/5 dark:outline-white/5" />
                                                    ) : (
                                                        <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shadow-sm outline outline-1 outline-black/5 dark:outline-white/5 ${getAvatarColor(msg.senderId)}`}>
                                                            {getInitials(senderName)}
                                                        </div>
                                                    )
                                                ) : (
                                                    <span className="text-[9px] font-mono text-zinc-400/50 dark:text-zinc-500/50 opacity-0 group-hover:opacity-100 transition-opacity duration-150 select-none mt-1.5 tabular-nums">
                                                        {format(new Date(msg.timestamp), 'HH:mm')}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                {showSender && (
                                                    <div className="flex items-baseline gap-2 mb-1">
                                                        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{senderName}</span>
                                                        <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 select-none tabular-nums">{format(new Date(msg.timestamp), 'h:mm a')}</span>
                                                    </div>
                                                )}

                                                {msg.replyToId && (
                                                    <div
                                                        onClick={(e) => { e.stopPropagation(); scrollToMessage(msg.replyToId!) }}
                                                        className="mb-2 px-2.5 py-1.5 rounded-lg border-l-2 border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 text-[11px] cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors duration-150 flex items-start gap-1.5 text-zinc-500 dark:text-zinc-400"
                                                    >
                                                        <CornerDownRight className="h-3 w-3 shrink-0 mt-0.5 opacity-60" />
                                                        <div className="truncate min-w-0">
                                                            <span className="font-semibold text-zinc-700 dark:text-zinc-300 mr-1">{msg.replyToSenderName}:</span>
                                                            <span>{msg.replyToText}</span>
                                                        </div>
                                                    </div>
                                                )}

                                                <div
                                                    onContextMenu={(e) => handleContextMenu(e, msg)}
                                                    className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed cursor-default select-text text-wrap-pretty"
                                                >
                                                    {renderMessageText(msg.text, isOwn)}
                                                </div>

                                                {/* Read receipts row (under others message text if any) */}
                                                {readBy.length > 0 && (
                                                    <div className="flex items-center gap-1 mt-1.5">
                                                        <div className="flex -space-x-1">
                                                            {readBy.slice(0, 5).map((u) => (
                                                                u.avatar ? (
                                                                    <img key={u.uid} src={u.avatar} alt={u.name} title={`Seen by ${u.name}`}
                                                                        className="w-4 h-4 rounded-full border border-white dark:border-zinc-955 object-cover shadow-sm outline outline-1 outline-black/5 dark:outline-white/5" />
                                                                ) : (
                                                                    <div key={u.uid} title={`Seen by ${u.name}`}
                                                                        className={`w-4 h-4 rounded-full border border-white dark:border-zinc-955 flex items-center justify-center text-[7px] font-bold shadow-sm outline outline-1 outline-black/5 dark:outline-white/5 ${getAvatarColor(u.uid)}`}>
                                                                        {getInitials(u.name)}
                                                                    </div>
                                                                )
                                                            ))}
                                                        </div>
                                                        {readBy.length > 5 && <span className="text-[9px] font-mono text-zinc-500 dark:text-zinc-400 ml-0.5 tabular-nums">+{readBy.length - 5}</span>}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* ── Composer area ── */}
            <div className="relative border-t border-zinc-200/80 dark:border-zinc-800/80 bg-white/10 dark:bg-black/10 backdrop-blur-md shrink-0 px-6 py-4">
                {/* Reply preview strip */}
                {replyToMessage && (
                    <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-50/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-xl mb-3 shadow-sm transition-all duration-205">
                        <div className="flex items-center gap-2 min-w-0">
                            <CornerDownRight className="h-4 w-4 text-zinc-400 shrink-0" />
                            <div className="min-w-0">
                                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Replying to {replyToMessage.senderName}</span>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-sm mt-0.5 text-wrap-pretty">{replyToMessage.text}</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setReplyToMessage(null)}
                            className="ml-3 h-6 w-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-150 shrink-0 active:scale-[0.96]"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )}

                {/* @mention autocomplete dropdown */}
                {showSuggestions && filteredSuggestions.length > 0 && (
                    <div className="absolute bottom-full left-6 right-6 z-50 mb-2 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                        <div className="px-4 py-2 text-[9px] font-mono tracking-wider font-semibold uppercase text-zinc-400 dark:text-zinc-500 border-b border-zinc-200/80 dark:border-zinc-800/80 select-none bg-zinc-50 dark:bg-zinc-900">
                            Mention a member
                        </div>
                        {filteredSuggestions.map((member, index) => (
                            <button
                                key={member.uid}
                                type="button"
                                onClick={() => selectSuggestion(member)}
                                className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors text-left ${
                                    index === selectedSuggestionIndex
                                        ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50'
                                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/50 text-zinc-700 dark:text-zinc-300'
                                }`}
                            >
                                {member.avatar ? (
                                    <img src={member.avatar} alt={member.name} className="w-6 h-6 rounded-full object-cover shrink-0 border border-zinc-200/80 dark:border-zinc-800/80" />
                                ) : (
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${getAvatarColor(member.uid)}`}>
                                        {getInitials(member.name)}
                                    </div>
                                )}
                                <span className="font-semibold truncate">{member.name}</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Input form */}
                <form onSubmit={handleSend} className="flex items-center gap-3">
                    <div className="flex-1 relative">
                        <Input
                            ref={inputRef}
                            placeholder={connected ? 'Message the team…  (@ to mention)' : 'Reconnecting…'}
                            value={inputText}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            disabled={!connected || sending}
                            maxLength={1000}
                            className="w-full text-sm h-11 pl-4 pr-16 bg-white/60 dark:bg-black/60 border border-zinc-200/80 dark:border-zinc-800/80 focus-visible:ring-1 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 rounded-xl placeholder:text-zinc-400 dark:placeholder:text-zinc-500 shadow-inner backdrop-blur-sm transition-all duration-150 font-sans"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center select-none">
                            {inputText.length > 800 && (
                                <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 tabular-nums">{inputText.length}/1000</span>
                            )}
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={!inputText.trim() || !connected || sending}
                        className="h-11 w-11 flex items-center justify-center rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 active:scale-[0.96] disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100 transition-transform duration-150 shrink-0 shadow-md"
                        title="Send (Enter)"
                    >
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                </form>
            </div>
        </div>
    )
}

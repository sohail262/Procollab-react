import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { SEOHead, buildBreadcrumbSchema } from '@/components/seo/SEOHead'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { useInfiniteScroll, usePagination } from '@/hooks/useInfiniteScroll'
import { useDebounce } from '@/hooks/useDebounce'
import {
    loadPaginatedUsers,
} from '@/services/paginationService'
import {
    Search,
    RefreshCw,
    Users,
    TrendingUp,
    UserPlus,
    ExternalLink,
    Check,
    BookOpen,
    Loader2,
    Bot,
    Globe,
    Cloud,
    ShieldCheck,
    BarChart2,
    Link2,
    Monitor,
    HeartPulse,
    Scale,
    MessageCircle,
    X
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
    collection,
    query,
    getDocs,
    doc,
    addDoc,
    serverTimestamp,
    where,
} from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { cachedQuery } from '@/lib/queryUtils'
import {
    sendConnectionRequest,
    removeConnection,
} from '@/services/connectionService'
import { useToast } from '@/hooks/use-toast'
import { InviteToProjectDropdown, InviteButton } from '@/components/InviteToProjectDropdown'
import { sendNotificationWithPush } from '@/services/notificationTrigger'
import { trackFeatureUsed } from '@/services/analyticsService'
import { getTagColorClass } from '@/lib/utils'

// ── sessionStorage cache key + TTL ────────────────────────────────────────────
const SS_USERS_KEY = 'discover_users_page1'
const SS_USERS_TTL = 5 * 60 * 1000 // 5 minutes

interface Person {
    id: string
    firstName: string
    lastName: string
    email: string
    discipline: string
    role: string
    skills: string[]
    bio?: string
    photoURL?: string
    avatarStyle?: string
    avatarSeed?: string
}

interface TrendingTopic {
    id: string
    title: string
    description: string
    url: string
    time: number
    category: string
    color: string
    icon: string
    tags: string[]
    source: string
    sourceLabel?: string
}

export function Discover() {
    const navigate = useNavigate()
    const { toast } = useToast()
    const [loading, setLoading] = useState(true)
    const [refreshingTopics, setRefreshingTopics] = useState(false)

    // Track feature usage on mount
    useEffect(() => {
        if (auth.currentUser?.uid) {
            trackFeatureUsed(auth.currentUser.uid, 'discover')
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ── Connection state ───────────────────────────────────────────────────────
    /** Confirmed friends — hidden from Discover list */
    const [friendIds, setFriendIds] = useState<Set<string>>(new Set())
    /** I sent a request to them */
    const [outgoingPendingIds, setOutgoingPendingIds] = useState<Set<string>>(new Set())
    /** They sent a request to me */
    const [incomingPendingIds, setIncomingPendingIds] = useState<Set<string>>(new Set())
    /** Transient "just sent" animation set */
    const [fadingUsers, setFadingUsers] = useState<Set<string>>(new Set())

    // ── Invite-to-project state ─────────────────────────────────────────────
    /** The current user's owned projects */
    const [myProjects, setMyProjects] = useState<{ id: string; title: string }[]>([])
    /** Which user card currently has the invite dropdown open */
    const [inviteOpenForUserId, setInviteOpenForUserId] = useState<string | null>(null)
    /** Set of `${targetUserId}_${projectId}` keys for already-sent invites */
    const [sentInvites, setSentInvites] = useState<Set<string>>(new Set())


    // ── Search / filter state ──────────────────────────────────────────────────
    const [peopleSearch, setPeopleSearch] = useState('')
    const [disciplineFilter, setDisciplineFilter] = useState('all')

    const debouncedPeopleSearch = useDebounce(peopleSearch, 300)

    // ── Pagination ─────────────────────────────────────────────────────────────
    const [peopleState, peopleActions] = usePagination<Person>()
    const [topicsState, topicsActions] = usePagination<TrendingTopic>()

    const disciplines = [
        'All Disciplines',
        'Computer Science',
        'Engineering',
        'Medicine & Health Sciences',
        'Business & Economics',
        'Arts & Humanities',
        'Social Sciences',
        'Natural Sciences',
        'Education',
        'Law'
    ]

    // ── Connection status checker (REPLACES, never merges) ────────────────────
    // ✅ PERF FIX: Replaced N parallel cachedGetDoc calls (one per visible person)
    // with 3 queries total:
    //   1. friends subcollection (cached 2 min)
    //   2. incoming connectionRequests (cached 2 min)
    //   3. MY OWN outgoing connectionRequests subcollection (cached 2 min)
    // Before: 2 + N reads (N = page size, typically 10). After: 3 reads max.
    const checkConnectionStatuses = useCallback(async () => {
        if (!auth.currentUser) return
        const currentUserId = auth.currentUser.uid

        try {
            const [friendsSnapshot, incomingSnapshot, outgoingSnapshot] = await Promise.all([
                // 1. My confirmed friends
                cachedQuery(
                    query(collection(db, 'users', currentUserId, 'friends')),
                    { userId: currentUserId, ttl: 120_000, cacheKey: `friends-${currentUserId}` }
                ),
                // 2. Requests sent TO me
                cachedQuery(
                    query(collection(db, 'users', currentUserId, 'connectionRequests')),
                    { userId: currentUserId, ttl: 120_000, cacheKey: `incoming-requests-${currentUserId}` }
                ),
                // 3. ⚡ FIX: Read MY outgoing requests as one subcollection query
                // (stored under each target's /connectionRequests/{myUid})
                // We can't query across users, but we can query a special mirror:
                // Instead, read from MY /sentRequests subcollection if it exists,
                // or fall back to the outgoing list stored in my profile.
                // For now: keep a "sentRequests" subcollection on the current user.
                // This is populated by sendConnectionRequest (handled separately).
                // Fallback: read the existing outgoingPendingIds from state (already in memory).
                cachedQuery(
                    query(collection(db, 'users', currentUserId, 'sentRequests')),
                    { userId: currentUserId, ttl: 120_000, cacheKey: `sent-requests-${currentUserId}` }
                ),
            ])

            const freshFriendSet    = new Set(friendsSnapshot.docs.map(d => d.id))
            const freshIncomingSet  = new Set(incomingSnapshot.docs.map(d => d.id))
            const freshOutgoingSet  = new Set(outgoingSnapshot.docs.map(d => d.id))

            // ✅ REPLACE (not merge) to avoid stale entries persisting
            setFriendIds(freshFriendSet)
            setIncomingPendingIds(freshIncomingSet)
            setOutgoingPendingIds(freshOutgoingSet)
        } catch (error) {
            console.error('Error checking connection statuses:', error)
        }
    }, [])

    // ── Load more (infinite scroll) ───────────────────────────────────────────
    const loadMorePeople = useCallback(async (): Promise<boolean> => {
        try {
            const result = await loadPaginatedUsers(peopleState.lastDoc)
            peopleActions.addItems(result.items, result.lastDoc as any)
            // Connection status is refreshed globally (not per-batch) — no extra reads
            return result.hasMore
        } catch (error) {
            console.error('Error loading more people:', error)
            return false
        }
    }, [peopleState.lastDoc, peopleActions])

    const loadMoreTopics = useCallback(async (): Promise<boolean> => {
        try {
            const topics = await loadTrendingTopics()
            const currentIndex = topicsState.lastDoc
                ? parseInt(topicsState.lastDoc.id) || 0
                : 0
            const pageSize = 9
            const endIndex = currentIndex + pageSize
            const paginatedTopics = topics.slice(currentIndex, endIndex)
            const hasMore = endIndex < topics.length
            if (paginatedTopics.length > 0) {
                topicsActions.addItems(paginatedTopics, { id: endIndex.toString() } as any)
            }
            return hasMore
        } catch (error) {
            console.error('Error loading more topics:', error)
            return false
        }
    }, [topicsState.lastDoc, topicsActions])

    // ── Infinite scroll sentinels ─────────────────────────────────────────────
    const peopleScroll = useInfiniteScroll(loadMorePeople, { enabled: !peopleState.loading })
    const topicsScroll = useInfiniteScroll(loadMoreTopics, { enabled: !topicsState.loading })

    // ── Initial load ──────────────────────────────────────────────────────────
    useEffect(() => {
        loadInitialData()
        loadMyProjects()
    }, [])

    // ── Load current user's owned and admin projects (for invite dropdown) ────────────
    const loadMyProjects = async () => {
        if (!auth.currentUser) return
        try {
            const currentUid = auth.currentUser.uid
            
            // Query 1: Projects created by the user
            const qOwned = query(
                collection(db, 'projects'),
                where('createdBy', '==', currentUid)
            )
            
            // Query 2: Projects where user is a member
            const qMember = query(
                collection(db, 'projects'),
                where('members', 'array-contains', currentUid)
            )
            
            const [snapOwned, snapMember] = await Promise.all([
                getDocs(qOwned),
                getDocs(qMember)
            ])
            
            // Combine both results and deduplicate by project ID
            const projectMap = new Map<string, { id: string; title: string }>()
            
            // Add owned projects
            snapOwned.docs.forEach(d => {
                projectMap.set(d.id, { id: d.id, title: d.data().title || 'Untitled' })
            })
            
            // Add member projects where user role is 'admin' or they are the owner
            snapMember.docs.forEach(d => {
                const data = d.data()
                const memberInfo = data.teamMembers?.[currentUid]
                const role = memberInfo?.role
                const isOwner = data.createdBy === currentUid
                const isAdmin = role === 'admin'
                
                if (isOwner || isAdmin) {
                    projectMap.set(d.id, { id: d.id, title: data.title || 'Untitled' })
                }
            })
            
            setMyProjects(Array.from(projectMap.values()))
        } catch (err) {
            console.error('Failed to load owned/admin projects for invite:', err)
        }
    }

    const loadInitialData = async () => {
        setLoading(true)
        try {
            // ── Load people FIRST, clear spinner, then load topics in background ──
            const peopleResult = await loadPaginatedUsers()

            peopleActions.setItems(peopleResult.items)
            peopleActions.setHasMore(peopleResult.hasMore)
            if (peopleResult.lastDoc) {
                peopleActions.addItems([], peopleResult.lastDoc as any)
            }

            // Spinner can go away as soon as we have people data
            setLoading(false)

            // ── Run connection status check (now 3 queries, not N+1) ──
            checkConnectionStatuses()

            // ── Load topics in background — doesn't block people display ──
            loadTrendingTopics().then(topics => {
                const initialTopics = topics.slice(0, 9)
                topicsActions.setItems(initialTopics)
                topicsActions.setHasMore(topics.length > 9)
                if (topics.length > 9) {
                    topicsActions.addItems([], { id: '9' } as any)
                }
            }).catch(error => {
                console.error('Error loading trending topics:', error)
            })
        } catch (error) {
            console.error('Error loading initial data:', error)
            setLoading(false)
        }
    }

    // ── Trending topics ───────────────────────────────────────────────────────
    const fetchTopHackerNewsStories = async (count = 20) => {
        try {
            const response = await fetch(
                `https://hacker-news.firebaseio.com/v0/topstories.json`
            )
            const storyIds = await response.json()
            const topStoryIds = storyIds.slice(0, count)
            const storyPromises = topStoryIds.map((id: number) =>
                fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
                    .then(res => res.json())
                    .catch(() => null)
            )
            const stories = await Promise.all(storyPromises)
            return stories
                .filter((s: any) => s && s.title && s.url && !s.deleted)
                .map((story: any) => {
                    let description = story.title
                    if (story.url) {
                        try {
                            const domain = new URL(story.url).hostname.replace('www.', '')
                            description = `Trending story from ${domain}: ${story.title}`
                        } catch {
                            description = `Trending tech story: ${story.title}`
                        }
                    }
                    return { ...story, description, source: 'hackernews' }
                })
        } catch (error) {
            console.error('Error fetching Hacker News stories:', error)
            return []
        }
    }

    const fetchDevToArticles = async (count = 10) => {
        try {
            const response = await fetch(
                `https://dev.to/api/articles?top=10&per_page=${count}`
            )
            const articles = await response.json()
            return articles
                .filter((a: any) => a && a.title && a.url)
                .map((article: any) => ({
                    id: article.id,
                    title: article.title,
                    url: article.url,
                    time: new Date(article.published_at || article.created_at).getTime() / 1000,
                    tags: article.tag_list || article.tags || [],
                    description:
                        article.description ||
                        article.social_image_alt ||
                        `Article by ${article.user?.name || 'Dev.to'}`,
                    source: 'devto'
                }))
        } catch (error) {
            console.error('Error fetching Dev.to articles:', error)
            return []
        }
    }

    const fetchNewsAPIArticles = async (
        category: 'health' | 'science' | 'technology' | 'business',
        label: string,
        count = 10
    ) => {
        try {
            const apiKey = import.meta.env.VITE_CURRENTS_API_KEY
            // Currents API /v1/search — uses keywords param for category-based search
            // Docs: https://currentsapi.services/en/docs/search
            const url = `https://api.currentsapi.services/v1/search?keywords=${category}&language=en&page_size=${count}&apiKey=${apiKey}`
            const response = await fetch(url)
            const data = await response.json()
            if (data.status !== 'ok') return []
            return (data.news || [])
                .filter((a: any) => a.title && a.url && a.title !== '[Removed]')
                .map((a: any, i: number) => ({
                    id: a.id || `currents_${category}_${i}_${Date.now()}`,
                    title: a.title,
                    url: a.url,
                    time: new Date(a.published || Date.now()).getTime() / 1000,
                    tags: Array.isArray(a.category) ? a.category.slice(0, 3) : [],
                    description: a.description || '',
                    source: 'currents',
                    sourceLabel: label,
                    _newsCategory: category
                }))
        } catch (error) {
            console.error(`[CurrentsAPI] Error fetching ${label}:`, error)
            return []
        }
    }

    const createTopicsFromStories = (stories: any[]) => {
        const categoryMap: Record<string, any> = {
            ai: {
                title: 'Artificial Intelligence', color: 'indigo', icon: 'bot',
                keywords: ['ai', 'artificial intelligence', 'machine learning', 'ml', 'neural', 'deep learning', 'llm', 'gpt', 'chatgpt', 'transformer']
            },
            web: {
                title: 'Web Development', color: 'blue', icon: 'globe',
                keywords: ['javascript', 'react', 'vue', 'angular', 'node', 'web', 'frontend', 'backend', 'api', 'framework']
            },
            devops: {
                title: 'DevOps & Cloud', color: 'green', icon: 'cloud',
                keywords: ['docker', 'kubernetes', 'devops', 'cloud', 'aws', 'azure', 'gcp', 'ci/cd', 'deployment', 'infrastructure']
            },
            security: {
                title: 'Cybersecurity', color: 'red', icon: 'shield',
                keywords: ['security', 'cyber', 'encryption', 'vulnerability', 'privacy', 'breach', 'authentication', 'oauth']
            },
            data: {
                title: 'Data Science', color: 'purple', icon: 'barchart',
                keywords: ['data', 'database', 'sql', 'nosql', 'analytics', 'big data', 'data science', 'visualization']
            },
            blockchain: {
                title: 'Blockchain & Web3', color: 'yellow', icon: 'link2',
                keywords: ['blockchain', 'crypto', 'bitcoin', 'ethereum', 'web3', 'defi', 'nft', 'smart contract']
            },
            default: { title: 'Technology', color: 'indigo', icon: 'monitor', keywords: [] }
        }

        return stories.map(story => {
            if ((story.source === 'newsapi' || story.source === 'currents') && story._newsCategory) {
                const isHealth = story._newsCategory === 'health'
                let tags: string[] = []
                if (story.tags && Array.isArray(story.tags)) {
                    tags = story.tags.slice(0, 3).map((t: any) =>
                        typeof t === 'string' ? t : t.name || t
                    )
                }
                let description = story.description || ''
                if (!description || description === story.title) {
                    description = isHealth
                        ? 'Latest health and medical news.'
                        : 'Latest science and policy developments.'
                }
                if (description.length > 150) description = description.substring(0, 150) + '...'
                return {
                    id: story.id,
                    title: story.title,
                    description,
                    url: story.url,
                    time: story.time || Date.now() / 1000,
                    category: isHealth ? 'Health & Medicine' : 'Law & Policy',
                    color: isHealth ? 'rose' : 'amber',
                    icon: isHealth ? 'heartpulse' : 'scale',
                    tags,
                    source: 'newsapi',
                    sourceLabel: story.sourceLabel || (isHealth ? 'Health' : 'Science')
                }
            }

            const titleLower = (story.title || '').toLowerCase()
            let category = categoryMap.default
            for (const [, cat] of Object.entries(categoryMap)) {
                if ((cat as any).keywords.some((kw: string) => titleLower.includes(kw))) {
                    category = cat
                    break
                }
            }

            let tags: string[] = []
            if (story.tags && Array.isArray(story.tags)) {
                tags = story.tags.slice(0, 3).map((t: any) =>
                    typeof t === 'string' ? t : t.name || t
                )
            }

            let description = story.description || ''
            if (!description || description === story.title) {
                const fallbacks: Record<string, string> = {
                    'Artificial Intelligence': 'Explore the latest developments in AI and machine learning.',
                    'Web Development': 'Discover new frameworks and best practices for modern web apps.',
                    'DevOps & Cloud': 'Learn about cloud infrastructure and DevOps automation.',
                    'Cybersecurity': 'Stay informed about security vulnerabilities and privacy.',
                    'Data Science': 'Dive into data analysis techniques and visualization.',
                    'Blockchain & Web3': 'Understand cryptocurrency trends and blockchain tech.',
                    'Technology': 'Get insights into the latest tech trends and innovations.'
                }
                description = fallbacks[(category as any).title] ||
                    'Stay updated with the latest technology trends.'
            }
            if (description.length > 150) description = description.substring(0, 150) + '...'

            return {
                id: story.source ? `${story.source}_${story.id}` : `${story.id || Date.now()}`,
                title: story.title,
                description,
                url: story.url,
                time: story.time || Date.now() / 1000,
                category: (category as any).title,
                color: (category as any).color,
                icon: (category as any).icon,
                tags,
                source: story.source || 'unknown'
            }
        })
    }

    const loadTrendingTopics = async () => {
        try {
            const [hackerNewsStories, devToArticles, healthArticles, lawArticles] =
                await Promise.all([
                    fetchTopHackerNewsStories(20).catch(() => []),
                    fetchDevToArticles(10).catch(() => []),
                    fetchNewsAPIArticles('health', 'Health', 8).catch(() => []),
                    fetchNewsAPIArticles('science', 'Science & Law', 8).catch(() => [])
                ])

            const allStories = [
                ...hackerNewsStories,
                ...devToArticles,
                ...healthArticles,
                ...lawArticles
            ]
            if (allStories.length === 0) return []

            const topics = createTopicsFromStories(allStories)
            const unique = topics.filter((t, i, self) =>
                i === self.findIndex(x => x.title === t.title)
            )
            const withIds = unique.map((t, i) => ({
                ...t,
                id: `${t.source}_${t.id}_${Date.now()}_${i}`
            }))
            return withIds.sort(() => 0.5 - Math.random())
        } catch (error) {
            console.error('Error loading trending topics:', error)
            return []
        }
    }

    const handleRefreshTopics = async () => {
        setRefreshingTopics(true)
        try {
            topicsActions.reset()
            const topics = await loadTrendingTopics()
            const initialTopics = topics.slice(0, 9)
            topicsActions.setItems(initialTopics)
            topicsActions.setHasMore(topics.length > 9)
            if (topics.length > 9) {
                topicsActions.addItems([], { id: '9' } as any)
            }
        } catch (error) {
            console.error('Error refreshing topics:', error)
        } finally {
            setRefreshingTopics(false)
        }
    }

    // ── Connect handler ───────────────────────────────────────────────────────
    const handleConnect = async (userId: string) => {
        if (!auth.currentUser) return
        try {
            // Optimistic update
            setOutgoingPendingIds(prev => new Set([...prev, userId]))

            // ✅ Centralized service — handles guard, write, and notification
            await sendConnectionRequest(auth.currentUser.uid, userId)

            // Brief "sent" animation
            setFadingUsers(prev => new Set([...prev, userId]))
            setTimeout(() => {
                setFadingUsers(prev => {
                    const next = new Set(prev)
                    next.delete(userId)
                    return next
                })
            }, 2000)

            toast({ title: 'Request sent', description: 'They will be notified.' })
        } catch (error) {
            // Revert optimistic update on error
            setOutgoingPendingIds(prev => {
                const next = new Set(prev)
                next.delete(userId)
                return next
            })
            console.error('Error sending connection request:', error)
            toast({ title: 'Could not send request', variant: 'destructive' })
        }
    }

    const handleDisconnect = async (userId: string) => {
        if (!auth.currentUser) return
        try {
            // Optimistic update
            setFriendIds(prev => {
                const next = new Set(prev)
                next.delete(userId)
                return next
            })
            await removeConnection(auth.currentUser.uid, userId)
            toast({ title: 'Connection removed' })
        } catch (error) {
            // Revert optimistic update on error
            setFriendIds(prev => new Set([...prev, userId]))
            console.error('Error removing connection:', error)
            toast({ title: 'Could not remove connection', variant: 'destructive' })
        }
    }



    // ── Invite-to-project handler ───────────────────────────────────────
    const handleInvite = async (targetUserId: string, projectId: string, projectTitle: string, message?: string) => {
        if (!auth.currentUser) return
        const key = `${targetUserId}_${projectId}`
        if (sentInvites.has(key)) return

        try {
            // Write invitation record to project's invitations subcollection
            await addDoc(collection(db, 'projects', projectId, 'invitations'), {
                email: '',           // email optional — we use userId directly
                userId: targetUserId,
                invitedBy: auth.currentUser.uid,
                projectId,
                projectTitle,
                status: 'pending',
                message: message || '',
                createdAt: serverTimestamp(),
            })

            // Notify the target user
            const body = message 
                ? `You've been invited to join "${projectTitle}". Message: "${message}"`
                : `You've been invited to join "${projectTitle}".`

            await sendNotificationWithPush(targetUserId, {
                title: '📬 Project Invitation',
                body,
                type: 'info',
                url: `/project/${projectId}`,
                projectId,
            })

            setSentInvites(prev => new Set([...prev, key]))
            setInviteOpenForUserId(null)
            toast({ title: 'Invitation sent!', description: `Invited to "${projectTitle}"` })
        } catch (err) {
            console.error('Error sending project invite:', err)
            toast({ title: 'Failed to send invitation', variant: 'destructive' })
        }
    }

    // ── Filtered lists ────────────────────────────────────────────────────────
    const filteredPeople = useMemo(() => peopleState.items.filter(person => {
        // Hide self
        if (auth.currentUser && person.id === auth.currentUser.uid) return false
        // Hide confirmed connections from Discover suggestions (manage them via Profile > My Connections)
        if (friendIds.has(person.id)) return false
        // ✅ Hide outgoing pending — already sent, no action needed in Discover
        if (outgoingPendingIds.has(person.id)) return false

        const matchesSearch =
            debouncedPeopleSearch === '' ||
            person.firstName?.toLowerCase().includes(debouncedPeopleSearch.toLowerCase()) ||
            person.lastName?.toLowerCase().includes(debouncedPeopleSearch.toLowerCase()) ||
            (person.skills || []).some(s =>
                s?.toLowerCase().includes(debouncedPeopleSearch.toLowerCase())
            )

        const matchesDiscipline =
            disciplineFilter === 'all' ||
            person.discipline
                ?.toLowerCase()
                .replace(/ & /g, '-')
                .replace(/ /g, '-') === disciplineFilter

        return matchesSearch && matchesDiscipline
    }), [peopleState.items, friendIds, outgoingPendingIds, debouncedPeopleSearch, disciplineFilter])

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <DashboardLayout>
            <SEOHead
                title="Discover Projects & Collaborators"
                description="Discover student projects by domain and skill. Find teammates, connect with developers, and explore trending tech projects. Search by technology, discipline, or skill to find your next collaboration."
                keywords={[
                    'discover student projects',
                    'find project collaborators',
                    'find teammates online',
                    'student networking platform',
                    'connect with developers',
                    'domain wise project discovery',
                    'skill wise project search',
                    'find project partner India',
                    'developer collaboration',
                    'tech team finder',
                    'engineering student network',
                    'project mate finder',
                    'trending tech projects',
                    'open to collaborate students',
                ]}
                canonical="https://procollab.in/discover"
                structuredData={buildBreadcrumbSchema([
                    { name: 'Home', url: '/' },
                    { name: 'Discover', url: '/discover' },
                ])}
            />
            <div className="mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    Discover
                </h1>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                    Find collaborators and stay updated with trending tech
                </p>
            </div>

            {/* ── Find Collaborators ── */}
            <section id="discover-people" className="mb-12">
                <div className="mb-5">
                    <h2 className="text-xl sm:text-2xl font-bold">Find Collaborators</h2>
                    <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                        Invites you send or receive are in the connections menu (header).
                        Withdraw sent requests from the Sent tab there.
                    </p>
                </div>
                {/* Filters: always side-by-side in a 2-col grid */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                        <Input
                            type="text"
                            placeholder="Search by name or skill"
                            className="pl-10 w-full rounded-lg bg-white/3 border-white/10 hover:border-primary/30 focus-visible:ring-primary transition-all duration-300"
                            value={peopleSearch}
                            onChange={e => setPeopleSearch(e.target.value)}
                        />
                    </div>
                    <Select
                        value={disciplineFilter}
                        onValueChange={value => setDisciplineFilter(value)}
                    >
                        <SelectTrigger className="w-full text-sm border-white/10 hover:border-primary/30 bg-white/3 h-10 rounded-lg transition-all duration-300">
                            <SelectValue placeholder="All Disciplines" />
                        </SelectTrigger>
                        <SelectContent>
                            {disciplines.map((d, i) => (
                                <SelectItem
                                    key={i}
                                    value={
                                        i === 0
                                            ? 'all'
                                            : d.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')
                                    }
                                >
                                    {d}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {loading ? (
                        <div className="col-span-full text-center py-12">
                            <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full mb-4" />
                            <p className="text-white/50">Loading collaborators...</p>
                        </div>
                    ) : filteredPeople.length === 0 ? (
                        <div className="col-span-full text-center py-12">
                            <Users className="h-12 w-12 text-white/30 mx-auto mb-4" />
                            <p className="text-white/50">No collaborators found</p>
                        </div>
                    ) : (
                        filteredPeople.map(person => {
                            const isOutgoing = outgoingPendingIds.has(person.id)
                            const isIncoming = incomingPendingIds.has(person.id)
                            const isFading = fadingUsers.has(person.id)
                            const isConnected = friendIds.has(person.id)

                            return (
                                <Card
                                    key={person.id}
                                    className={`glass-card hover:border-white/20 transition-all duration-300 group h-full flex flex-col ${
                                        inviteOpenForUserId === person.id ? 'relative z-30 shadow-2xl' : 'relative z-10'
                                    }`}
                                >
                                    <CardContent className="p-3 sm:p-5 flex flex-col flex-1 h-full">
                                        <div className="flex items-start justify-between mb-3 gap-2">
                                            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                                <img
                                                    src={
                                                        person.photoURL ||
                                                        `https://api.dicebear.com/7.x/${person.avatarStyle || 'avataaars'}/svg?seed=${encodeURIComponent(person.avatarSeed || person.email || person.id)}`
                                                    }
                                                    alt={`${person.firstName} ${person.lastName}`}
                                                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-white/10 cursor-pointer hover:border-primary transition-colors shrink-0"
                                                    onClick={() => navigate(`/profile/${person.id}`)}
                                                />
                                                <div className="min-w-0">
                                                    <h3
                                                        className="font-semibold text-sm sm:text-base text-white cursor-pointer hover:text-primary transition-colors truncate"
                                                        onClick={() => navigate(`/profile/${person.id}`)}
                                                    >
                                                        {person.firstName} {person.lastName}
                                                    </h3>
                                                    <p className="text-xs text-white/50 truncate">
                                                        {person.role}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Connection button */}
                                            <div className="shrink-0 flex items-center gap-1.5">
                                                {isConnected ? (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 px-2 text-xs text-red-400 hover:text-red-500 hover:bg-red-500/10 border-red-500/20"
                                                        onClick={() => handleDisconnect(person.id)}
                                                    >
                                                        Disconnect
                                                    </Button>
                                                ) : isOutgoing || isFading ? (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 px-2 text-xs text-primary border-primary/20 bg-primary/10"
                                                        disabled
                                                    >
                                                        <Check className="h-3 w-3 sm:mr-1" />
                                                        <span className="hidden sm:inline">Sent</span>
                                                    </Button>
                                                ) : isIncoming ? (
                                                    <Button
                                                        size="sm"
                                                        className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                                                        onClick={() => navigate(`/profile/${person.id}`)}
                                                    >
                                                        <Check className="h-3 w-3 sm:mr-1" />
                                                        <span className="hidden sm:inline">Respond</span>
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        className="h-7 px-2 text-xs text-white/90 hover:text-white"
                                                        onClick={() => handleConnect(person.id)}
                                                    >
                                                        <UserPlus className="h-3 w-3 sm:mr-1" />
                                                        <span className="hidden sm:inline">Connect</span>
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-2 flex-grow flex flex-col justify-start mb-3">
                                            <div className="flex items-center gap-1.5 text-xs text-white/50">
                                                <BookOpen className="h-3 w-3 shrink-0" />
                                                <span className="truncate text-white/70">{person.discipline || (
                                                    <span className="italic text-white/40">
                                                        No discipline listed
                                                    </span>
                                                )}</span>
                                            </div>
                                            <p className="text-xs sm:text-sm text-white/60 line-clamp-2">
                                                {person.bio || (
                                                    <span className="italic text-white/40">
                                                        No bio available
                                                    </span>
                                                )}
                                            </p>
                                            <div className="flex flex-wrap gap-1 pt-1.5 mt-auto">
                                                {(person.skills || []).length > 0 ? (
                                                    <>
                                                        {person.skills.slice(0, 3).map((skill, i) => (
                                                            <Badge
                                                                key={i}
                                                                className={`text-[10px] px-2 py-0.5 h-5 border-0 font-semibold transition-colors ${getTagColorClass(skill)}`}
                                                            >
                                                                {skill}
                                                            </Badge>
                                                        ))}
                                                        {person.skills.length > 3 && (
                                                            <Badge
                                                                className="text-[10px] px-2 py-0.5 h-5 border-0 bg-white/5 text-white/70"
                                                            >
                                                                +{person.skills.length - 3}
                                                            </Badge>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span className="text-[10px] italic text-white/45">
                                                        No skills listed
                                                    </span>
                                                )}
                                            </div>

                                            {/* ── Quick actions row ── */}
                                            <div className="flex items-center pt-1 relative">
                                                {/* Invite to Project button + dropdown */}
                                                <div className="relative w-full">
                                                    <InviteButton
                                                        isOpen={inviteOpenForUserId === person.id}
                                                        className="w-full justify-between"
                                                        onClick={() => setInviteOpenForUserId(
                                                            inviteOpenForUserId === person.id ? null : person.id
                                                        )}
                                                    />
                                                    {inviteOpenForUserId === person.id && (
                                                        <InviteToProjectDropdown
                                                            targetUserId={person.id}
                                                            projects={myProjects}
                                                            sentInvites={sentInvites}
                                                            onInvite={(projectId, projectTitle, message) =>
                                                                handleInvite(person.id, projectId, projectTitle, message)
                                                            }
                                                            onClose={() => setInviteOpenForUserId(null)}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })
                    )}

                    {!loading && peopleState.hasMore && (
                        <div
                            ref={peopleScroll.sentinelRef}
                            className="col-span-full flex justify-center py-8"
                        >
                            {peopleScroll.isLoading ? (
                                <div className="flex items-center gap-2 text-gray-500">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Loading more collaborators...</span>
                                </div>
                            ) : (
                                <Button
                                    variant="outline"
                                    onClick={peopleScroll.loadMore}
                                    className="px-6 py-2"
                                >
                                    Load More Collaborators
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </section>

            {/* ── Trending Topics ── */}
            <section className="mb-8">
                <div className="flex flex-wrap justify-between items-center gap-2 mb-6">
                    <h2 className="text-xl sm:text-2xl font-bold">Trending Topics</h2>
                    <Button
                        onClick={handleRefreshTopics}
                        disabled={refreshingTopics}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                    >
                        <RefreshCw className={`h-4 w-4 ${refreshingTopics ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {topicsState.items.length === 0 ? (
                        <div className="col-span-full text-center py-8">
                            <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-500">No trending topics yet</p>
                        </div>
                    ) : (
                        topicsState.items.map(topic => {
                            const iconMap: Record<string, LucideIcon> = {
                                bot: Bot,
                                globe: Globe,
                                cloud: Cloud,
                                shield: ShieldCheck,
                                barchart: BarChart2,
                                link2: Link2,
                                monitor: Monitor,
                                heartpulse: HeartPulse,
                                scale: Scale
                            }
                            const TopicIcon = iconMap[topic.icon] || Monitor
                            return (
                                <Card
                                    key={topic.id}
                                    className="hover:shadow-lg transition-all hover:border-blue-500"
                                >
                                    <CardContent className="p-3 sm:p-5">
                                        <div className="flex items-center justify-between mb-2 sm:mb-3">
                                            <TopicIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600 dark:text-gray-300" />
                                            <Badge variant="secondary" className="text-[10px] sm:text-xs">
                                                {topic.sourceLabel || topic.source}
                                            </Badge>
                                        </div>
                                        <h3
                                            className="text-xs sm:text-sm font-bold mb-1 sm:mb-2 line-clamp-2"
                                            title={topic.title}
                                        >
                                            {topic.title}
                                        </h3>
                                        {topic.description && topic.description !== topic.title && (
                                            <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-300 mb-2 line-clamp-2 hidden sm:block">
                                                {topic.description}
                                            </p>
                                        )}
                                        <div className="flex flex-wrap gap-1 mb-2">
                                            <Badge
                                                variant="outline"
                                                className="text-[10px] bg-gray-50 dark:bg-gray-800 px-1"
                                            >
                                                {topic.category}
                                            </Badge>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => window.open(topic.url, '_blank')}
                                            className="text-blue-600 hover:text-blue-800 text-xs font-medium flex items-center gap-1 h-7 px-1 w-full justify-end"
                                        >
                                            Read <ExternalLink className="h-3 w-3" />
                                        </Button>
                                    </CardContent>
                                </Card>
                            )
                        })
                    )}

                    {topicsState.hasMore && (
                        <div
                            ref={topicsScroll.sentinelRef}
                            className="col-span-full flex justify-center py-8"
                        >
                            {topicsScroll.isLoading ? (
                                <div className="flex items-center gap-2 text-gray-500">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Loading more topics...</span>
                                </div>
                            ) : (
                                <Button
                                    variant="outline"
                                    onClick={topicsScroll.loadMore}
                                    className="px-6 py-2"
                                >
                                    Load More Topics
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </section>

        </DashboardLayout>
    )
}
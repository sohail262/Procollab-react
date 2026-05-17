import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardContent } from '@/components/ui/card'
import { DiscoverProjectCard } from '@/components/DiscoverProjectCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useInfiniteScroll, usePagination } from '@/hooks/useInfiniteScroll'
import { useDebounce } from '@/hooks/useDebounce'
import {
    loadPaginatedUsers,
    loadPaginatedProjects
} from '@/services/paginationService'
import {
    Search,
    RefreshCw,
    Users,
    FolderKanban,
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
    type LucideIcon
} from 'lucide-react'
import {
    collection,
    query,
    getDocs,
    doc,
} from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { cachedGetDoc } from '@/lib/queryUtils'
import {
    sendConnectionRequest,
} from '@/services/connectionService'
import { useToast } from '@/hooks/use-toast'

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

interface Project {
    id: string
    title: string
    description: string
    primaryDiscipline: string
    status: string
    tags?: string[]
    createdBy: string
    createdAt: Date
    teamSize?: number
    summary?: string
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

    // ── Connection state ───────────────────────────────────────────────────────
    /** Confirmed friends — hidden from Discover list */
    const [friendIds, setFriendIds] = useState<Set<string>>(new Set())
    /** I sent a request to them */
    const [outgoingPendingIds, setOutgoingPendingIds] = useState<Set<string>>(new Set())
    /** They sent a request to me */
    const [incomingPendingIds, setIncomingPendingIds] = useState<Set<string>>(new Set())
    /** Transient "just sent" animation set */
    const [fadingUsers, setFadingUsers] = useState<Set<string>>(new Set())

    // ── Search / filter state ──────────────────────────────────────────────────
    const [peopleSearch, setPeopleSearch] = useState('')
    const [disciplineFilter, setDisciplineFilter] = useState('all')
    const [projectsSearch, setProjectsSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')

    const debouncedPeopleSearch = useDebounce(peopleSearch, 300)
    const debouncedProjectsSearch = useDebounce(projectsSearch, 300)

    // ── Pagination ─────────────────────────────────────────────────────────────
    const [peopleState, peopleActions] = usePagination<Person>()
    const [projectsState, projectsActions] = usePagination<Project>()
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
    const checkConnectionStatuses = useCallback(async (people: Person[]) => {
        if (!auth.currentUser) return
        const currentUserId = auth.currentUser.uid

        try {
            // Fresh read of my friends
            const friendsSnapshot = await getDocs(
                collection(db, 'users', currentUserId, 'friends')
            )
            const freshFriendSet = new Set(friendsSnapshot.docs.map(d => d.id))

            // Fresh read of requests sent TO me
            const incomingSnapshot = await getDocs(
                collection(db, 'users', currentUserId, 'connectionRequests')
            )
            const freshIncomingSet = new Set(incomingSnapshot.docs.map(d => d.id))

            // ⚡ OPTIMIZATION: Use cachedGetDoc instead of raw getDoc.
            // Each doc is cached for 5 min — repeated scroll pages skip the read
            // entirely for users already checked. Reduces Firestore reads by ~N
            // per page load (N = visible people count, typically 10).
            const others = people.filter(p => p.id !== currentUserId)
            const outgoingResults = await Promise.all(
                others.map(async (p) => {
                    const snap = await cachedGetDoc(
                        doc(db, 'users', p.id, 'connectionRequests', currentUserId)
                    )
                    return snap.exists() ? p.id : null
                })
            )
            const freshOutgoingSet = new Set(
                outgoingResults.filter(Boolean) as string[]
            )

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
            if (result.items.length > 0) {
                await checkConnectionStatuses(result.items)
            }
            return result.hasMore
        } catch (error) {
            console.error('Error loading more people:', error)
            return false
        }
    }, [peopleState.lastDoc, peopleActions, checkConnectionStatuses])

    const loadMoreProjects = useCallback(async (): Promise<boolean> => {
        try {
            const filters = {
                status: statusFilter !== 'all' ? statusFilter : undefined,
                searchTerm: debouncedProjectsSearch || undefined
            }
            const result = await loadPaginatedProjects(projectsState.lastDoc, 10, filters)
            projectsActions.addItems(result.items, result.lastDoc as any)
            return result.hasMore
        } catch (error) {
            console.error('Error loading more projects:', error)
            return false
        }
    }, [projectsState.lastDoc, projectsActions, statusFilter, debouncedProjectsSearch])

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
    const projectsScroll = useInfiniteScroll(loadMoreProjects, { enabled: !projectsState.loading })
    const topicsScroll = useInfiniteScroll(loadMoreTopics, { enabled: !topicsState.loading })

    // ── Initial load ──────────────────────────────────────────────────────────
    useEffect(() => {
        loadInitialData()
    }, [])

    const loadInitialData = async () => {
        setLoading(true)
        try {
            const [peopleResult, projectsResult] = await Promise.all([
                loadPaginatedUsers(),
                loadPaginatedProjects()
            ])

            const topics = await loadTrendingTopics()
            const initialTopics = topics.slice(0, 9)

            peopleActions.setItems(peopleResult.items)
            peopleActions.setHasMore(peopleResult.hasMore)
            if (peopleResult.lastDoc) {
                peopleActions.addItems([], peopleResult.lastDoc as any)
            }

            projectsActions.setItems(projectsResult.items)
            projectsActions.setHasMore(projectsResult.hasMore)
            if (projectsResult.lastDoc) {
                projectsActions.addItems([], projectsResult.lastDoc as any)
            }

            topicsActions.setItems(initialTopics)
            topicsActions.setHasMore(topics.length > 9)
            if (topics.length > 9) {
                topicsActions.addItems([], { id: '9' } as any)
            }

            if (peopleResult.items.length > 0) {
                await checkConnectionStatuses(peopleResult.items)
            }
        } catch (error) {
            console.error('Error loading initial data:', error)
        } finally {
            setLoading(false)
        }
    }

    // Reset projects on filter change
    useEffect(() => {
        if (debouncedProjectsSearch !== projectsSearch) return
        projectsActions.reset()
        loadMoreProjects()
    }, [statusFilter, debouncedProjectsSearch])

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
            // ✅ Centralized service — handles guard, write, and notification
            await sendConnectionRequest(auth.currentUser.uid, userId)
            setOutgoingPendingIds(prev => new Set([...prev, userId]))

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
            console.error('Error sending connection request:', error)
            toast({ title: 'Could not send request', variant: 'destructive' })
        }
    }

    // ── Filtered lists ────────────────────────────────────────────────────────
    // ⚡ OPTIMIZATION: useMemo prevents recomputing these on every render.
    // filteredPeople only recalculates when people data or search/filter values change.
    // filteredProjects only recalculates when project data or its own filters change.
    // Without this, typing in the people search box also recomputed filteredProjects.
    const filteredPeople = useMemo(() => peopleState.items.filter(person => {
        // Hide self
        if (auth.currentUser && person.id === auth.currentUser.uid) return false
        // Hide confirmed friends
        if (friendIds.has(person.id)) return false
        // ✅ Hide outgoing pending — already sent, no action needed in Discover
        if (outgoingPendingIds.has(person.id)) return false
        // ✅ Keep incoming pending visible — user needs to respond
        // (they'll see "Respond" button that navigates to profile)

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

    const filteredProjects = useMemo(() => projectsState.items.filter(project => {
        const matchesSearch =
            debouncedProjectsSearch === '' ||
            project.title.toLowerCase().includes(debouncedProjectsSearch.toLowerCase()) ||
            project.description.toLowerCase().includes(debouncedProjectsSearch.toLowerCase()) ||
            (project.tags || []).some(t =>
                t.toLowerCase().includes(debouncedProjectsSearch.toLowerCase())
            )
        const matchesStatus = statusFilter === 'all' || project.status === statusFilter
        return matchesSearch && matchesStatus
    }), [projectsState.items, debouncedProjectsSearch, statusFilter])

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <DashboardLayout>
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    Discover
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Find collaborators, explore projects, and stay updated with trending tech
                </p>
            </div>

            {/* ── Find Collaborators ── */}
            <section id="discover-people" className="mb-12">
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-6 gap-4">
                    <div>
                        <h2 className="text-2xl font-bold">Find Collaborators</h2>
                        <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                            Invites you send or receive are in the connections menu (header).
                            Withdraw sent requests from the Sent tab there.
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1 sm:flex-none">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                            <Input
                                type="text"
                                placeholder="Search by name or skill"
                                className="pl-10 w-full sm:w-64"
                                value={peopleSearch}
                                onChange={e => setPeopleSearch(e.target.value)}
                            />
                        </div>
                        <select
                            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
                            value={disciplineFilter}
                            onChange={e => setDisciplineFilter(e.target.value)}
                        >
                            {disciplines.map((d, i) => (
                                <option
                                    key={i}
                                    value={
                                        i === 0
                                            ? 'all'
                                            : d.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')
                                    }
                                >
                                    {d}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        <div className="col-span-full text-center py-12">
                            <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4" />
                            <p className="text-gray-500">Loading collaborators...</p>
                        </div>
                    ) : filteredPeople.length === 0 ? (
                        <div className="col-span-full text-center py-12">
                            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-500">No collaborators found</p>
                        </div>
                    ) : (
                        filteredPeople.map(person => {
                            const isOutgoing = outgoingPendingIds.has(person.id)
                            const isIncoming = incomingPendingIds.has(person.id)
                            const isFading = fadingUsers.has(person.id)

                            return (
                                <Card
                                    key={person.id}
                                    className="hover:shadow-lg transition-all duration-300 group"
                                >
                                    <CardContent className="p-5">
                                        <div className="flex items-start justify-between mb-4 gap-2">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <img
                                                    src={
                                                        person.photoURL ||
                                                        `https://api.dicebear.com/7.x/${person.avatarStyle || 'avataaars'}/svg?seed=${encodeURIComponent(person.avatarSeed || person.email || person.id)}`
                                                    }
                                                    alt={`${person.firstName} ${person.lastName}`}
                                                    className="w-12 h-12 rounded-full border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-blue-500 transition-colors shrink-0"
                                                    onClick={() => navigate(`/profile/${person.id}`)}
                                                />
                                                <div className="min-w-0">
                                                    <h3
                                                        className="font-semibold text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 transition-colors truncate"
                                                        onClick={() => navigate(`/profile/${person.id}`)}
                                                    >
                                                        {person.firstName} {person.lastName}
                                                    </h3>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                        {person.role}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* ✅ Connection button — correct state for all cases */}
                                            <div className="shrink-0">
                                                {isOutgoing || isFading ? (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 px-3 text-xs text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400"
                                                        disabled
                                                    >
                                                        <Check className="h-3 w-3 mr-1" />
                                                        Request Sent
                                                    </Button>
                                                ) : isIncoming ? (
                                                    <Button
                                                        size="sm"
                                                        className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700"
                                                        onClick={() => navigate(`/profile/${person.id}`)}
                                                    >
                                                        <Check className="h-3 w-3 mr-1" />
                                                        Respond
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        className="h-8 px-3 text-xs"
                                                        onClick={() => handleConnect(person.id)}
                                                    >
                                                        <UserPlus className="h-3 w-3 mr-1" />
                                                        Connect
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                                                <BookOpen className="h-3 w-3" />
                                                {person.discipline || (
                                                    <span className="italic text-gray-400">
                                                        No discipline listed
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 min-h-[2.5rem]">
                                                {person.bio || (
                                                    <span className="italic text-gray-400">
                                                        No bio available
                                                    </span>
                                                )}
                                            </p>
                                            <div className="flex flex-wrap gap-1.5 pt-1">
                                                {(person.skills || []).length > 0 ? (
                                                    <>
                                                        {person.skills.slice(0, 3).map((skill, i) => (
                                                            <Badge
                                                                key={i}
                                                                variant="outline"
                                                                className="text-[10px] px-2 py-0.5 h-5 bg-gray-50 dark:bg-gray-800/50"
                                                            >
                                                                {skill}
                                                            </Badge>
                                                        ))}
                                                        {person.skills.length > 3 && (
                                                            <Badge
                                                                variant="outline"
                                                                className="text-[10px] px-2 py-0.5 h-5"
                                                            >
                                                                +{person.skills.length - 3}
                                                            </Badge>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span className="text-[10px] italic text-gray-400">
                                                        No skills listed
                                                    </span>
                                                )}
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

            {/* ── Explore Projects ── */}
            <section id="discover-projects" className="mb-12">
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-6 gap-4">
                    <h2 className="text-2xl font-bold">Explore Projects</h2>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1 sm:flex-none">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                            <Input
                                type="text"
                                placeholder="Search projects"
                                className="pl-10 w-full sm:w-64"
                                value={projectsSearch}
                                onChange={e => setProjectsSearch(e.target.value)}
                            />
                        </div>
                        <select
                            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                        >
                            <option value="all">All Statuses</option>
                            <option value="recruiting">Recruiting</option>
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                            <option value="on-hold">On Hold</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        <div className="col-span-full text-center py-12">
                            <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4" />
                            <p className="text-gray-500">Loading projects...</p>
                        </div>
                    ) : filteredProjects.length === 0 ? (
                        <div className="col-span-full text-center py-12">
                            <FolderKanban className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-500">No projects found</p>
                        </div>
                    ) : (
                        filteredProjects.map(project => (
                            <DiscoverProjectCard key={project.id} project={project} />
                        ))
                    )}

                    {!loading && projectsState.hasMore && (
                        <div
                            ref={projectsScroll.sentinelRef}
                            className="col-span-full flex justify-center py-8"
                        >
                            {projectsScroll.isLoading ? (
                                <div className="flex items-center gap-2 text-gray-500">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Loading more projects...</span>
                                </div>
                            ) : (
                                <Button
                                    variant="outline"
                                    onClick={projectsScroll.loadMore}
                                    className="px-6 py-2"
                                >
                                    Load More Projects
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </section>

            {/* ── Trending Topics ── */}
            <section className="mb-8">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">Trending Topics</h2>
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                                    <CardContent className="p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <TopicIcon className="h-6 w-6 text-gray-600 dark:text-gray-300" />
                                            <Badge variant="secondary" className="text-xs">
                                                {topic.sourceLabel || topic.source}
                                            </Badge>
                                        </div>
                                        <h3
                                            className="text-lg font-bold mb-3 line-clamp-2"
                                            title={topic.title}
                                        >
                                            {topic.title}
                                        </h3>
                                        {topic.description && topic.description !== topic.title && (
                                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-3">
                                                {topic.description}
                                            </p>
                                        )}
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            <Badge
                                                variant="outline"
                                                className="text-xs bg-gray-50 dark:bg-gray-800"
                                            >
                                                {topic.category}
                                            </Badge>
                                            {topic.tags.slice(0, 2).map((tag, i) => (
                                                <Badge
                                                    key={i}
                                                    variant="outline"
                                                    className="text-xs bg-gray-50 dark:bg-gray-800"
                                                >
                                                    {tag}
                                                </Badge>
                                            ))}
                                        </div>
                                        <div className="flex justify-between items-center mt-auto">
                                            <span className="text-xs text-gray-500">
                                                Trending in tech
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => window.open(topic.url, '_blank')}
                                                className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
                                            >
                                                Read <ExternalLink className="h-3 w-3" />
                                            </Button>
                                        </div>
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
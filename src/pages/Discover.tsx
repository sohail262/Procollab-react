import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardContent } from '@/components/ui/card'
import { DiscoverProjectCard } from '@/components/DiscoverProjectCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
    Search,
    RefreshCw,
    Users,
    FolderKanban,
    TrendingUp,
    UserPlus,
    ExternalLink,
    Check,
    BookOpen
} from 'lucide-react'
import {
    collection,
    query,
    limit,
    getDocs,
    orderBy,
    doc,
    getDoc,
    setDoc,
    addDoc,
    serverTimestamp
} from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'

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
    count?: number
    category: string
    url?: string
    source?: string
    time?: number
    tags?: string[]
    icon?: string
    color?: string
}

export function Discover() {
    const navigate = useNavigate()
    const [people, setPeople] = useState<Person[]>([])
    const [projects, setProjects] = useState<Project[]>([])
    const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshingTopics, setRefreshingTopics] = useState(false)
    const [connectedUsers, setConnectedUsers] = useState<Set<string>>(new Set())
    const [fadingUsers, setFadingUsers] = useState<Set<string>>(new Set()) // Users whose cards are fading out

    const [peopleSearch, setPeopleSearch] = useState('')
    const [disciplineFilter, setDisciplineFilter] = useState('all')
    const [projectsSearch, setProjectsSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')

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

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setLoading(true)
        try {
            await Promise.all([
                loadPeople(),
                loadProjects(),
                loadTrendingTopics()
            ])
        } catch (error) {
            console.error('Error loading discover data:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadPeople = async () => {
        try {
            const usersRef = collection(db, 'users')
            const q = query(usersRef, limit(20))
            const snapshot = await getDocs(q)
            const peopleData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Person[]

            // Check connection statuses BEFORE setting people to avoid flash
            await checkConnectionStatuses(peopleData)
            setPeople(peopleData)
        } catch (error) {
            console.error('Error loading people:', error)
            setPeople([])
        }
    }

    const checkConnectionStatuses = async (people: Person[]) => {
        if (!auth.currentUser) return

        const currentUserId = auth.currentUser.uid
        const connectedSet = new Set<string>()

        try {
            await Promise.all(people.map(async (person) => {
                if (person.id === currentUserId) return

                // Check if already friends (connection accepted)
                const friendRef = doc(db, 'users', currentUserId, 'friends', person.id)
                const friendDoc = await getDoc(friendRef)

                if (friendDoc.exists()) {
                    connectedSet.add(person.id)
                    return
                }

                // Also check the reverse (if the other user has us as friend)
                const reverseFriendRef = doc(db, 'users', person.id, 'friends', currentUserId)
                const reverseFriendDoc = await getDoc(reverseFriendRef)

                if (reverseFriendDoc.exists()) {
                    connectedSet.add(person.id)
                    return
                }

                // Check if request sent by current user
                const requestRef = doc(db, 'users', person.id, 'connectionRequests', currentUserId)
                const requestDoc = await getDoc(requestRef)

                if (requestDoc.exists()) {
                    connectedSet.add(person.id)
                    return
                }

                // Check if request received from this person (pending)
                const receivedRequestRef = doc(db, 'users', currentUserId, 'connectionRequests', person.id)
                const receivedRequestDoc = await getDoc(receivedRequestRef)

                if (receivedRequestDoc.exists()) {
                    connectedSet.add(person.id)
                }
            }))

            setConnectedUsers(connectedSet)
        } catch (error) {
            console.error('Error checking connection statuses:', error)
        }
    }

    const loadProjects = async () => {
        try {
            const projectsRef = collection(db, 'projects')
            const q = query(
                projectsRef,
                orderBy('createdAt', 'desc'),
                limit(12)
            )
            const snapshot = await getDocs(q)
            const projectsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                tags: doc.data().tags || [],
                createdAt: doc.data().createdAt?.toDate() || new Date()
            })) as Project[]
            setProjects(projectsData)
        } catch (error) {
            console.error('Error loading projects:', error)
            setProjects([])
        }
    }

    // --- Trending Topics Logic ---

    const fetchTopHackerNewsStories = async (count = 20) => {
        try {
            const response = await fetch(`https://hacker-news.firebaseio.com/v0/topstories.json`)
            const storyIds = await response.json()
            const topStoryIds = storyIds.slice(0, count)
            const storyPromises = topStoryIds.map((id: number) =>
                fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(res => res.json()).catch(() => null)
            )
            const stories = await Promise.all(storyPromises)
            return stories.filter((story: any) => story && story.title && story.url && !story.deleted).map((story: any) => ({
                ...story,
                source: 'hackernews'
            }))
        } catch (error) {
            console.error('Error fetching Hacker News stories:', error)
            return []
        }
    }

    const fetchDevToArticles = async (count = 10) => {
        try {
            const response = await fetch(`https://dev.to/api/articles?top=10&per_page=${count}`)
            const articles = await response.json()
            return articles.filter((article: any) => article && article.title && article.url).map((article: any) => ({
                id: article.id,
                title: article.title,
                url: article.url,
                time: new Date(article.published_at || article.created_at).getTime() / 1000,
                tags: article.tags || [],
                description: article.description || '',
                source: 'devto'
            }))
        } catch (error) {
            console.error('Error fetching Dev.to articles:', error)
            return []
        }
    }

    const createTopicsFromStories = (stories: any[]) => {
        const categoryMap: Record<string, any> = {
            'ai': { title: 'Artificial Intelligence', color: 'indigo', icon: '🤖', keywords: ['ai', 'artificial intelligence', 'machine learning', 'ml', 'neural', 'deep learning', 'llm', 'gpt', 'chatgpt', 'transformer'] },
            'web': { title: 'Web Development', color: 'blue', icon: '🌐', keywords: ['javascript', 'react', 'vue', 'angular', 'node', 'web', 'frontend', 'backend', 'api', 'framework'] },
            'devops': { title: 'DevOps & Cloud', color: 'green', icon: '☁️', keywords: ['docker', 'kubernetes', 'devops', 'cloud', 'aws', 'azure', 'gcp', 'ci/cd', 'deployment', 'infrastructure'] },
            'security': { title: 'Cybersecurity', color: 'red', icon: '🔒', keywords: ['security', 'cyber', 'encryption', 'vulnerability', 'privacy', 'breach', 'authentication', 'oauth'] },
            'data': { title: 'Data Science', color: 'purple', icon: '📊', keywords: ['data', 'database', 'sql', 'nosql', 'analytics', 'big data', 'data science', 'visualization'] },
            'blockchain': { title: 'Blockchain & Web3', color: 'yellow', icon: '⛓️', keywords: ['blockchain', 'crypto', 'bitcoin', 'ethereum', 'web3', 'defi', 'nft', 'smart contract'] },
            'default': { title: 'Technology', color: 'indigo', icon: '💻', keywords: [] }
        }

        return stories.map(story => {
            const titleLower = story.title ? story.title.toLowerCase() : ''
            let category = categoryMap.default

            for (const [, cat] of Object.entries(categoryMap)) {
                if (cat.keywords.some((keyword: string) => titleLower.includes(keyword))) {
                    category = cat
                    break
                }
            }

            let tags: string[] = []
            if (story.tags && Array.isArray(story.tags)) {
                tags = story.tags.slice(0, 3).map((tag: any) => typeof tag === 'string' ? tag : tag.name || tag)
            }

            return {
                id: story.source ? `${story.source}_${story.id}` : `${story.id || Date.now()}`,
                title: story.title,
                url: story.url,
                time: story.time || Date.now() / 1000,
                category: category.title,
                color: category.color,
                icon: category.icon,
                tags: tags,
                source: story.source || 'unknown'
            }
        })
    }

    const loadTrendingTopics = async () => {
        try {
            const [hackerNewsStories, devToArticles] = await Promise.all([
                fetchTopHackerNewsStories(20).catch(() => []),
                fetchDevToArticles(10).catch(() => [])
            ])

            const allStories = [...hackerNewsStories, ...devToArticles]

            if (allStories.length === 0) {
                setTrendingTopics([])
                return
            }

            const topics = createTopicsFromStories(allStories)
            const shuffled = topics.sort(() => 0.5 - Math.random()).slice(0, 9)
            setTrendingTopics(shuffled)
        } catch (error) {
            console.error('Error loading trending topics:', error)
            setTrendingTopics([])
        }
    }

    const handleRefreshTopics = async () => {
        setRefreshingTopics(true)
        await loadTrendingTopics()
        setRefreshingTopics(false)
    }

    const handleConnect = async (userId: string) => {
        if (!auth.currentUser) {
            console.error('User not authenticated')
            return
        }

        try {
            const currentUser = auth.currentUser
            const targetUserRef = doc(db, 'users', userId)
            const requestRef = doc(targetUserRef, 'connectionRequests', currentUser.uid)

            // Check if request already exists
            const requestDoc = await getDoc(requestRef)
            if (requestDoc.exists()) {
                console.log('Request already sent')
                setConnectedUsers(prev => {
                    const newSet = new Set(prev)
                    newSet.add(userId)
                    return newSet
                })
                return
            }

            // Get current user data for the request
            const currentUserDoc = await getDoc(doc(db, 'users', currentUser.uid))
            const currentUserData = currentUserDoc.data()
            const currentUserName = currentUserData ? `${currentUserData.firstName} ${currentUserData.lastName}` : currentUser.email

            // Create connection request
            await setDoc(requestRef, {
                from: currentUser.uid,
                fromName: currentUserName,
                fromEmail: currentUser.email,
                sentAt: serverTimestamp(),
                status: 'pending'
            })

            // Create notification
            await addDoc(collection(targetUserRef, 'notifications'), {
                title: 'New Connection Request',
                body: `${currentUserName} wants to connect with you!`,
                icon: currentUserData?.photoURL || null,
                url: `/profile/${currentUser.uid}`,
                timestamp: serverTimestamp(),
                read: false,
                type: 'connection_request',
                data: {
                    fromUserId: currentUser.uid,
                    fromUserName: currentUserName
                }
            })

            // Add to fading users first (shows "Sent" with fade animation)
            setFadingUsers(prev => {
                const newSet = new Set(prev)
                newSet.add(userId)
                return newSet
            })

            // After 5 seconds, move to connectedUsers (removes from view)
            setTimeout(() => {
                setConnectedUsers(prev => {
                    const newSet = new Set(prev)
                    newSet.add(userId)
                    return newSet
                })
                setFadingUsers(prev => {
                    const newSet = new Set(prev)
                    newSet.delete(userId)
                    return newSet
                })
            }, 5000)
        } catch (error) {
            console.error('Error sending connection request:', error)
        }
    }

    const filteredPeople = people.filter(person => {
        // Filter out current user
        if (auth.currentUser && person.id === auth.currentUser.uid) {
            return false
        }

        // Filter out users who already received a connection request from current user
        if (connectedUsers.has(person.id)) {
            return false
        }

        const matchesSearch = peopleSearch === '' ||
            (person.firstName && person.firstName.toLowerCase().includes(peopleSearch.toLowerCase())) ||
            (person.lastName && person.lastName.toLowerCase().includes(peopleSearch.toLowerCase())) ||
            (person.skills || []).some(skill => skill && skill.toLowerCase().includes(peopleSearch.toLowerCase()))

        const matchesDiscipline = disciplineFilter === 'all' ||
            (person.discipline && person.discipline.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-') === disciplineFilter)

        return matchesSearch && matchesDiscipline
    })

    const filteredProjects = projects.filter(project => {
        const matchesSearch = projectsSearch === '' ||
            project.title.toLowerCase().includes(projectsSearch.toLowerCase()) ||
            project.description.toLowerCase().includes(projectsSearch.toLowerCase()) ||
            (project.tags || []).some(tag => tag.toLowerCase().includes(projectsSearch.toLowerCase()))

        const matchesStatus = statusFilter === 'all' || project.status === statusFilter

        return matchesSearch && matchesStatus
    })

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

            {/* Discover People Section */}
            <section id="discover-people" className="mb-12">
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-6 gap-4">
                    <h2 className="text-2xl font-bold">Find Collaborators</h2>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1 sm:flex-none">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                            <Input
                                type="text"
                                placeholder="Search by name or skill"
                                className="pl-10 w-full sm:w-64"
                                value={peopleSearch}
                                onChange={(e) => setPeopleSearch(e.target.value)}
                            />
                        </div>
                        <select
                            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
                            value={disciplineFilter}
                            onChange={(e) => setDisciplineFilter(e.target.value)}
                        >
                            {disciplines.map((discipline, index) => (
                                <option key={index} value={index === 0 ? 'all' : discipline.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')}>
                                    {discipline}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        <div className="col-span-full text-center py-12">
                            <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
                            <p className="text-gray-500">Loading collaborators...</p>
                        </div>
                    ) : filteredPeople.length === 0 ? (
                        <div className="col-span-full text-center py-12">
                            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-500">No collaborators found</p>
                        </div>
                    ) : (
                        filteredPeople.map((person) => {
                            const isFading = fadingUsers.has(person.id)

                            return (
                                <Card
                                    key={person.id}
                                    className={`hover:shadow-lg transition-all duration-500 group ${isFading ? 'opacity-50 scale-95 pointer-events-none' : ''
                                        }`}
                                >
                                    <CardContent className="p-5">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <img
                                                    src={person.photoURL || `https://api.dicebear.com/7.x/${person.avatarStyle || 'avataaars'}/svg?seed=${encodeURIComponent(person.avatarSeed || person.email || person.id)}`}
                                                    alt={`${person.firstName || ''} ${person.lastName || ''}`}
                                                    className="w-12 h-12 rounded-full border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-blue-500 transition-colors"
                                                    onClick={() => navigate(`/profile/${person.id}`)}
                                                />
                                                <div>
                                                    <h3
                                                        className="font-semibold text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 transition-colors"
                                                        onClick={() => navigate(`/profile/${person.id}`)}
                                                    >
                                                        {person.firstName} {person.lastName}
                                                    </h3>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">{person.role}</p>
                                                </div>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant={isFading ? "outline" : "secondary"}
                                                className={`h-8 px-3 text-xs ${isFading ? 'text-green-600 border-green-200 bg-green-50 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400' : ''}`}
                                                onClick={() => handleConnect(person.id)}
                                                disabled={isFading}
                                            >
                                                {isFading ? (
                                                    <>
                                                        <Check className="h-3 w-3 mr-1" />
                                                        Request Sent!
                                                    </>
                                                ) : (
                                                    <>
                                                        <UserPlus className="h-3 w-3 mr-1" />
                                                        Connect
                                                    </>
                                                )}
                                            </Button>
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                                                <BookOpen className="h-3 w-3" />
                                                {person.discipline || <span className="italic text-gray-400">No discipline listed</span>}
                                            </div>

                                            <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 min-h-[2.5rem]">
                                                {person.bio || <span className="italic text-gray-400">No bio available</span>}
                                            </p>

                                            <div className="flex flex-wrap gap-1.5 pt-1">
                                                {(person.skills || []).length > 0 ? (
                                                    <>
                                                        {person.skills.slice(0, 3).map((skill, index) => (
                                                            <Badge key={index} variant="outline" className="text-[10px] px-2 py-0.5 h-5 bg-gray-50 dark:bg-gray-800/50">
                                                                {skill}
                                                            </Badge>
                                                        ))}
                                                        {person.skills.length > 3 && (
                                                            <Badge variant="outline" className="text-[10px] px-2 py-0.5 h-5">
                                                                +{person.skills.length - 3}
                                                            </Badge>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span className="text-[10px] italic text-gray-400">No skills listed</span>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })
                    )}
                </div>
            </section>

            {/* Discover Projects Section */}
            <section id="discover-projects" className="mb-12">
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-6 gap-4">
                    <h2 className="text-2xl font-bold">Explore Projects</h2>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1 sm:flex-none">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                            <Input
                                type="text"
                                placeholder="Search projects"
                                className="pl-10 w-full sm:w-64"
                                value={projectsSearch}
                                onChange={(e) => setProjectsSearch(e.target.value)}
                            />
                        </div>
                        <select
                            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
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
                            <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
                            <p className="text-gray-500">Loading projects...</p>
                        </div>
                    ) : filteredProjects.length === 0 ? (
                        <div className="col-span-full text-center py-12">
                            <FolderKanban className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-500">No projects found</p>
                        </div>
                    ) : (
                        filteredProjects.map((project) => (
                            <DiscoverProjectCard key={project.id} project={project} />
                        ))
                    )}
                </div>
            </section>

            {/* Trending Topics Section */}
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
                    {trendingTopics.length === 0 ? (
                        <div className="col-span-full text-center py-8">
                            <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-500">No trending topics yet</p>
                        </div>
                    ) : (
                        trendingTopics.map((topic) => (
                            <Card key={topic.id} className="hover:shadow-lg transition-all hover:border-blue-500">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-2xl">{topic.icon}</span>
                                        <Badge variant="secondary" className="text-xs">{topic.category}</Badge>
                                    </div>
                                    <h3 className="text-lg font-bold mb-2 line-clamp-2 h-14" title={topic.title}>
                                        {topic.title}
                                    </h3>
                                    <div className="flex flex-wrap gap-2 mb-4 h-12 overflow-hidden">
                                        {(topic.tags || []).slice(0, 3).map((tag, i) => (
                                            <Badge key={i} variant="outline" className="text-xs bg-gray-50">
                                                {tag}
                                            </Badge>
                                        ))}
                                    </div>
                                    <div className="flex justify-between items-center mt-auto">
                                        <span className="text-xs text-gray-500">
                                            {topic.source === 'hackernews' ? 'Hacker News' : 'Dev.to'}
                                        </span>
                                        <a
                                            href={topic.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
                                        >
                                            Read <ExternalLink className="h-3 w-3" />
                                        </a>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </section>
        </DashboardLayout>
    )
}

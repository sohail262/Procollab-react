import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/mode-toggle'
import { ConnectionRequestsDropdown } from '@/components/ConnectionRequestsDropdown'
import { NotificationsDropdown } from '@/components/NotificationsDropdown'
import {
    LayoutDashboard,
    FolderKanban,
    Send,
    Bell,
    Bookmark,
    User,
    Search,
    LogOut,
    Menu,
    X,
    Compass,
    Grid3x3,
    Shield
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { doc, onSnapshot, collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'

interface UserProfile {
    photoURL?: string
    avatarStyle?: string
    avatarSeed?: string
    role?: string
}

interface Project {
    id: string
    title: string
    description?: string
    tags?: string[]
    primaryDiscipline?: string
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { user, logout } = useAuth()
    const location = useLocation()
    const navigate = useNavigate()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null)

    // Search state
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<Project[]>([])
    const [allProjects, setAllProjects] = useState<Project[]>([])
    const [isSearchFocused, setIsSearchFocused] = useState(false)
    const searchRef = useRef<HTMLDivElement>(null)

    // Fetch user profile from Firestore for real-time avatar updates
    useEffect(() => {
        if (!user) {
            setUserProfile(null)
            return
        }

        const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnapshot) => {
            if (docSnapshot.exists()) {
                setUserProfile(docSnapshot.data() as UserProfile)
            }
        }, (error) => {
            console.error('Error fetching user profile:', error)
        })

        return () => unsubscribe()
    }, [user])

    // Load projects for search
    useEffect(() => {
        const loadProjects = async () => {
            try {
                const projectsRef = collection(db, 'projects')
                const q = query(projectsRef, orderBy('createdAt', 'desc'), limit(50))
                const snapshot = await getDocs(q)
                const projectsData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Project[]
                setAllProjects(projectsData)
            } catch (error) {
                console.error('Error loading projects for search:', error)
            }
        }
        loadProjects()
    }, [])

    // Handle click outside to close search results
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsSearchFocused(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Filter projects based on search query
    useEffect(() => {
        if (searchQuery.trim() === '') {
            setSearchResults([])
            return
        }

        const lowerQuery = searchQuery.toLowerCase()
        const filtered = allProjects.filter(project =>
            project.title?.toLowerCase().includes(lowerQuery) ||
            project.description?.toLowerCase().includes(lowerQuery) ||
            (project.tags || []).some(tag => tag?.toLowerCase().includes(lowerQuery))
        ).slice(0, 5)

        setSearchResults(filtered)
    }, [searchQuery, allProjects])

    const handleProjectClick = (projectId: string) => {
        setSearchQuery('')
        setIsSearchFocused(false)
        navigate(`/project/${projectId}`)
    }

    // Get the user's avatar URL (from Firestore profile or generate default)
    const getUserAvatarUrl = () => {
        // First check Firestore profile
        if (userProfile?.photoURL) {
            return userProfile.photoURL
        }
        // Then check Firebase Auth photoURL (for Google/GitHub login)
        if (user?.photoURL) {
            return user.photoURL
        }
        // Generate default DiceBear avatar
        const seed = user?.email || user?.uid || 'default'
        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`
    }

    const isAdmin = userProfile?.role === 'admin'

    const navigation = [
        { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Discover', href: '/discover', icon: Compass },
        { name: 'Projects', href: '/projects', icon: Grid3x3 },
        { name: 'My Projects', href: '/dashboard/projects', icon: FolderKanban },
        { name: 'Applications', href: '/dashboard/applications', icon: Send },
        { name: 'Saved', href: '/dashboard/saved', icon: Bookmark },
        { name: 'Notifications', href: '/dashboard/notifications', icon: Bell },
        { name: 'Profile', href: '/profile', icon: User },
        ...(isAdmin ? [{ name: 'Admin', href: '/admin', icon: Shield }] : []),
    ]

    const handleLogout = async () => {
        try {
            await logout()
        } catch (error) {
            console.error('Logout error:', error)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
            {/* Top Navigation Bar */}
            <nav className="fixed top-0 z-50 w-full bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800">
                <div className="px-3 py-3 lg:px-5 lg:pl-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center justify-start">
                            <button
                                onClick={() => setSidebarOpen(!sidebarOpen)}
                                className="inline-flex items-center p-2 text-sm text-gray-500 rounded-lg lg:hidden hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-600"
                            >
                                {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                            </button>
                            <Link to="/" className="flex ml-2 md:mr-24">
                                <span className="self-center text-xl font-semibold sm:text-2xl whitespace-nowrap dark:text-white">
                                    ProCollab
                                </span>
                            </Link>
                        </div>
                        <div className="flex items-center gap-3">
                            <div ref={searchRef} className="relative hidden md:block">
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                        <Search className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                    </div>
                                    <input
                                        type="text"
                                        className="block w-64 p-2 pl-10 pr-8 text-sm text-gray-900 border border-gray-300 rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                                        placeholder="Search projects..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onFocus={() => setIsSearchFocused(true)}
                                    />
                                    {searchQuery && (
                                        <button
                                            onClick={() => setSearchQuery('')}
                                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>

                                {/* Search Results Dropdown */}
                                {isSearchFocused && searchQuery && (
                                    <div className="absolute top-full mt-2 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden z-50 min-w-[300px]">
                                        {searchResults.length > 0 ? (
                                            <div className="max-h-[300px] overflow-y-auto">
                                                {searchResults.map((project) => (
                                                    <div
                                                        key={project.id}
                                                        onClick={() => handleProjectClick(project.id)}
                                                        className="flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors"
                                                    >
                                                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                                                            {project.title?.charAt(0) || 'P'}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{project.title}</p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{project.primaryDiscipline || 'Project'}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                                                No projects found for "{searchQuery}"
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <ConnectionRequestsDropdown />
                            <NotificationsDropdown />
                            <ModeToggle />
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => navigate('/profile')}
                                    className="focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full"
                                    title="View Profile"
                                >
                                    <img
                                        key={getUserAvatarUrl()}
                                        src={getUserAvatarUrl()}
                                        alt="User avatar"
                                        className="w-10 h-10 rounded-full border-2 border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 transition-colors cursor-pointer"
                                    />
                                </button>
                                <span className="text-sm text-gray-700 dark:text-gray-300 hidden md:block">
                                    {user?.displayName || user?.email?.split('@')[0]}
                                </span>
                                <Button variant="ghost" size="sm" onClick={handleLogout}>
                                    <LogOut className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Sidebar */}
            <aside
                className={`fixed top-0 left-0 z-40 w-64 h-screen pt-20 transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                    } bg-white border-r border-gray-200 lg:translate-x-0 dark:bg-gray-900 dark:border-gray-800`}
            >
                <div className="h-full px-3 pb-4 overflow-y-auto">
                    <ul className="space-y-2 font-medium">
                        {navigation.map((item) => {
                            const isActive = location.pathname === item.href
                            return (
                                <li key={item.name}>
                                    <Link
                                        to={item.href}
                                        className={`flex items-center p-2 rounded-lg group ${isActive
                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                                            : 'text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700'
                                            }`}
                                    >
                                        <item.icon className={`w-5 h-5 transition duration-75 ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'
                                            }`} />
                                        <span className="ml-3">{item.name}</span>
                                    </Link>
                                </li>
                            )
                        })}
                    </ul>
                </div>
            </aside>

            {/* Main Content */}
            <div className="p-4 lg:ml-64 pt-20">
                <div className="rounded-lg">
                    {children}
                </div>
            </div>

            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-30 bg-gray-900/50 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                ></div>
            )}
        </div>
    )
}

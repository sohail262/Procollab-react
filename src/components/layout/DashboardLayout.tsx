import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/layout/Logo'
import { ConnectionRequestsDropdown } from '@/components/ConnectionRequestsDropdown'
import { NotificationsDropdown } from '@/components/NotificationsDropdown'
import { AnimatePresence, motion } from 'framer-motion'
import { NotificationPermissionPrompt } from '@/components/NotificationPermissionPrompt'
import { useNotificationPrompt } from '@/hooks/useNotificationPrompt'
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
    Shield,
    Sparkles,
    MessageSquare
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

    // Notification prompt hook
    const { showPrompt, handleDismiss, handleAccept } = useNotificationPrompt(user?.uid ?? null)

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
            navigate('/')
        } catch (error) {
            console.error('Logout error:', error)
        }
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Top Navigation Bar — Frosted Glass */}
            <nav className="fixed top-0 z-50 w-full glass border-b border-border/40">
                <div className="px-4 py-3 lg:px-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center justify-start">
                            <button
                                onClick={() => setSidebarOpen(!sidebarOpen)}
                                className="inline-flex items-center p-2 text-muted-foreground rounded-lg lg:hidden hover:bg-accent hover:text-foreground transition-all duration-200"
                            >
                                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                            </button>
                            <Link to="/" className="flex items-center ml-2 md:mr-24 group">
                                <Logo iconSize={38} showText={true} />
                            </Link>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3">
                            <div ref={searchRef} className="relative hidden md:block">
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                        <Search className="w-3.5 h-3.5 text-muted-foreground" />
                                    </div>
                                    <input
                                        type="text"
                                        className="block w-56 p-2 pl-9 pr-8 text-sm bg-transparent border border-border/50 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground/15 focus:border-foreground/20 transition-all duration-200"
                                        placeholder="Search projects..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onFocus={() => setIsSearchFocused(true)}
                                    />
                                    {searchQuery && (
                                        <button
                                            onClick={() => setSearchQuery('')}
                                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>

                                {/* Search Results Dropdown */}
                                {isSearchFocused && searchQuery && (
                                    <div className="absolute top-full mt-2 left-0 right-0 bg-card border border-border/50 rounded-xl shadow-2xl overflow-hidden z-50 min-w-[300px]">
                                        {searchResults.length > 0 ? (
                                            <div className="max-h-[300px] overflow-y-auto">
                                                {searchResults.map((project) => (
                                                    <div
                                                        key={project.id}
                                                        onClick={() => handleProjectClick(project.id)}
                                                        className="flex items-center gap-3 p-3 hover:bg-accent cursor-pointer border-b border-border/30 last:border-b-0 transition-colors duration-150"
                                                    >
                                                        <div className="w-8 h-8 rounded-lg bg-foreground/10 flex items-center justify-center text-foreground text-xs font-semibold">
                                                            {project.title?.charAt(0) || 'P'}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-sm text-foreground truncate">{project.title}</p>
                                                            <p className="text-xs text-muted-foreground truncate">{project.primaryDiscipline || 'Project'}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-4 text-center text-muted-foreground text-sm">
                                                No projects found for "{searchQuery}"
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <ConnectionRequestsDropdown />
                            <NotificationsDropdown />
                            <div className="flex items-center gap-2 sm:gap-3">
                                <button
                                    onClick={() => navigate('/profile')}
                                    className="focus:outline-none rounded-full ring-1 ring-border/50 hover:ring-foreground/20 transition-all duration-200"
                                    title="View Profile"
                                >
                                    <img
                                        key={getUserAvatarUrl()}
                                        src={getUserAvatarUrl()}
                                        alt="User avatar"
                                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-muted"
                                    />
                                </button>
                                <span className="text-sm text-muted-foreground hidden md:block">
                                    {user?.displayName || user?.email?.split('@')[0]}
                                </span>
                                <Button variant="ghost" size="sm" onClick={handleLogout} className="hidden sm:flex text-muted-foreground hover:text-foreground">
                                    <LogOut className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Sidebar — Frosted Glass */}
            <aside
                className={`fixed top-0 left-0 z-40 w-64 h-screen pt-20 transition-transform duration-300 ease-premium ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                    } glass border-r border-border/40 lg:translate-x-0`}
            >
                <div className="h-full flex flex-col justify-between pb-4">
                    {/* Scrollable Navigation List */}
                    <div className="flex-1 overflow-y-auto px-3 mt-2">
                        <ul className="space-y-0.5 font-medium">
                            {navigation.map((item, index) => {
                                const isActive = location.pathname === item.href
                                return (
                                    <motion.li
                                        key={item.name}
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                                    >
                                        <Link
                                            to={item.href}
                                            onClick={() => setSidebarOpen(false)}
                                            className={`relative flex items-center px-3.5 py-2.5 rounded-lg group transition-all duration-200 border border-transparent ${isActive
                                                ? 'bg-white/[0.06] dark:bg-zinc-800/40 text-foreground border-white/[0.06] dark:border-zinc-800/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md font-semibold'
                                                : 'text-muted-foreground hover:text-foreground hover:bg-zinc-500/[0.03] dark:hover:bg-zinc-800/20 hover:border-zinc-500/[0.03] dark:hover:border-zinc-800/10'
                                                }`}
                                        >
                                            {/* Active indicator bar */}
                                            {isActive && (
                                                <div
                                                    className="absolute left-1.5 top-1/2 w-[3px] h-4 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.4)]"
                                                    style={{ transform: 'translateY(-50%)' }}
                                                />
                                            )}
                                            <item.icon className={`w-[18px] h-[18px] transition-colors duration-200 ${isActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
                                                }`} strokeWidth={1.5} />
                                            <span className="ml-3 text-[13px]">{item.name}</span>
                                        </Link>
                                    </motion.li>
                                )
                            })}
                        </ul>
                    </div>

                    {/* Feedback Prompt Card at the bottom of the sidebar */}
                    <div className="px-4 py-4 mx-3 my-2 rounded-xl border border-white/5 bg-white/[0.02] backdrop-blur-md hidden lg:block">
                        <div className="flex items-center gap-2 mb-2 text-primary">
                            <MessageSquare className="h-4 w-4" />
                            <h4 className="text-xs font-semibold text-white">Found a Bug?</h4>
                        </div>
                        <p className="text-[10px] text-white/50 mb-3 leading-relaxed">
                            Help us improve ProCollab by reporting bugs or sharing your feature ideas.
                        </p>
                        <Button
                            onClick={() => {
                                setSidebarOpen(false)
                                navigate('/feedback')
                            }}
                            size="sm"
                            className="w-full h-8 text-[11px] font-medium bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 hover:text-white rounded-lg transition-all"
                        >
                            Give Feedback
                        </Button>
                    </div>

                    {/* Logout — mobile sidebar only (fixed at bottom, non-scrollable) */}
                    <div className="px-3 pt-3 mt-2 border-t border-border/30 lg:hidden">
                        {/* Mobile feedback entry (same style) */}
                        <div className="px-3 py-3 mb-3 rounded-lg bg-white/[0.02] border border-white/5">
                            <p className="text-[10px] text-white/50 mb-2 leading-relaxed">
                                Help us improve by reporting bugs or sharing ideas.
                            </p>
                            <Button
                                onClick={() => {
                                    setSidebarOpen(false)
                                    navigate('/feedback')
                                }}
                                size="sm"
                                className="w-full h-7 text-[10px] font-medium bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-lg"
                            >
                                Give Feedback
                            </Button>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center px-3 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-200"
                        >
                            <LogOut className="w-[18px] h-[18px]" strokeWidth={1.5} />
                            <span className="ml-3 text-[13px] font-medium">Log out</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="pt-20 px-4 pb-4 sm:px-6 sm:pb-6 lg:ml-64">
                <motion.div
                    key={location.pathname}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className="rounded-lg"
                >
                    {children}
                </motion.div>
            </div>

            {/* Mobile sidebar overlay */}
            <AnimatePresence>
                {sidebarOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}
            </AnimatePresence>

            {/* Notification Permission Prompt */}
            <AnimatePresence>
                {showPrompt && user && (
                    <NotificationPermissionPrompt
                        onAccept={() => handleAccept(user.uid)}
                        onDismiss={handleDismiss}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}

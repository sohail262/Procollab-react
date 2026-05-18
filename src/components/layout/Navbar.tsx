import { useState, useEffect, useRef } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Menu, LogOut, User, LayoutDashboard, Search, X, FolderKanban } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { VisuallyHidden } from "@/components/ui/visually-hidden"
import { useAuth } from "@/contexts/AuthContext"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { collection, query, limit, getDocs, orderBy, doc, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"

interface Project {
    id: string
    title: string
    description: string
    status: string
    tags?: string[]
}

interface UserProfile {
    photoURL?: string
    avatarStyle?: string
    avatarSeed?: string
    firstName?: string
    lastName?: string
}

export function Navbar() {
    const [isOpen, setIsOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [searchResults, setSearchResults] = useState<Project[]>([])
    const [allProjects, setAllProjects] = useState<Project[]>([])
    const [isSearchFocused, setIsSearchFocused] = useState(false)
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
    const searchRef = useRef<HTMLDivElement>(null)

    const { user, logout } = useAuth()
    const navigate = useNavigate()

    const navLinks = [
        { name: "Home", href: "/" },
        { name: "Projects", href: "/projects" },
        { name: "Discover", href: "/discover" },
        { name: "About", href: "/about" },
    ]

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
                console.error('Error loading projects:', error)
            }
        }
        loadProjects()
    }, [])

    // Fetch user profile from Firestore to get custom avatar (real-time updates)
    useEffect(() => {
        if (!user) {
            setUserProfile(null)
            return
        }

        // Use onSnapshot for real-time updates
        const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnapshot) => {
            if (docSnapshot.exists()) {
                setUserProfile(docSnapshot.data() as UserProfile)
            }
        }, (error) => {
            console.error('Error fetching user profile:', error)
        })

        return () => unsubscribe()
    }, [user])

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
        ).slice(0, 5) // Limit to 5 results

        setSearchResults(filtered)
    }, [searchQuery, allProjects])

    const handleLogout = async () => {
        try {
            await logout()
            navigate("/")
        } catch (error) {
            console.error("Error logging out:", error)
        }
    }

    const handleProjectClick = (projectId: string) => {
        setSearchQuery("")
        setIsSearchFocused(false)
        navigate(`/projects/${projectId}`)
    }

    // Get user initials for avatar fallback
    const getUserInitials = () => {
        if (user?.displayName) {
            return user.displayName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)
        }
        if (user?.email) {
            return user.email[0].toUpperCase()
        }
        return "U"
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

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'recruiting': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            case 'active': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            case 'completed': return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
            default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
        }
    }

    return (
        <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-16 items-center justify-between">
                <div className="flex items-center gap-2">
                    <Link to="/" className="flex items-center">
                        <span className="font-bold text-lg text-foreground">
                            ProCollab
                        </span>
                    </Link>
                </div>

                {/* Desktop Navigation */}
                <div className="hidden md:flex md:items-center md:gap-4">
                    {navLinks.map((link) => (
                        <Link
                            key={link.name}
                            to={link.href}
                            className="text-sm font-medium transition-colors hover:text-primary"
                        >
                            {link.name}
                        </Link>
                    ))}

                    {/* Project Search Bar */}
                    <div ref={searchRef} className="relative">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Search projects..."
                                className="pl-9 pr-8 w-48 lg:w-64 h-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={() => setIsSearchFocused(true)}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        {/* Search Results Dropdown */}
                        {isSearchFocused && searchQuery && (
                            <div className="absolute top-full mt-2 left-0 right-0 bg-background border rounded-lg shadow-lg overflow-hidden z-50 min-w-[300px]">
                                {searchResults.length > 0 ? (
                                    <div className="max-h-[300px] overflow-y-auto">
                                        {searchResults.map((project) => (
                                            <div
                                                key={project.id}
                                                onClick={() => handleProjectClick(project.id)}
                                                className="flex items-center gap-3 p-3 hover:bg-muted cursor-pointer border-b last:border-b-0 transition-colors"
                                            >
                                                <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                                                    <FolderKanban className="h-5 w-5 text-white" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-medium text-sm truncate">{project.title}</h4>
                                                    <p className="text-xs text-muted-foreground truncate">{project.description}</p>
                                                </div>
                                                <Badge variant="secondary" className={`text-[10px] flex-shrink-0 ${getStatusColor(project.status)}`}>
                                                    {project.status}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-4 text-center text-sm text-muted-foreground">
                                        <FolderKanban className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                        <p>No projects found for "{searchQuery}"</p>
                                    </div>
                                )}

                                {/* View all results link */}
                                <div className="border-t p-2 bg-muted/50">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full text-xs"
                                        onClick={() => {
                                            navigate(`/projects?search=${encodeURIComponent(searchQuery)}`)
                                            setSearchQuery("")
                                            setIsSearchFocused(false)
                                        }}
                                    >
                                        View all projects
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    <ModeToggle />

                    {/* Auth-aware buttons */}
                    {user ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                                    <Avatar className="h-9 w-9" key={getUserAvatarUrl()}>
                                        <AvatarImage src={getUserAvatarUrl()} alt={user.displayName || "User"} />
                                        <AvatarFallback className="bg-primary text-primary-foreground">
                                            {getUserInitials()}
                                        </AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" align="end" forceMount>
                                <div className="flex items-center justify-start gap-2 p-2">
                                    <div className="flex flex-col space-y-1 leading-none">
                                        {user.displayName && (
                                            <p className="font-medium">{user.displayName}</p>
                                        )}
                                        {user.email && (
                                            <p className="text-xs text-muted-foreground truncate w-[200px]">
                                                {user.email}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <Link to="/dashboard" className="cursor-pointer">
                                        <LayoutDashboard className="mr-2 h-4 w-4" />
                                        Dashboard
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link to={`/profile/${user.uid}`} className="cursor-pointer">
                                        <User className="mr-2 h-4 w-4" />
                                        Profile
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600">
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Log out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" asChild>
                                <Link to="/login">Log in</Link>
                            </Button>
                            <Button asChild>
                                <Link to="/register">Sign up</Link>
                            </Button>
                        </div>
                    )}
                </div>

                {/* Mobile Navigation */}
                <div className="flex items-center gap-2 md:hidden">
                    <ModeToggle />
                    <Sheet open={isOpen} onOpenChange={setIsOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="md:hidden">
                                <Menu className="h-5 w-5" />
                                <span className="sr-only">Toggle menu</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right">
                            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                            <SheetDescription className="sr-only">
                                Mobile navigation menu with search and user options
                            </SheetDescription>
                            <div className="flex flex-col gap-4 py-4">
                                {/* Mobile Search */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="text"
                                        placeholder="Search projects..."
                                        className="pl-9"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>

                                {/* Mobile Search Results */}
                                {searchQuery && searchResults.length > 0 && (
                                    <div className="border rounded-lg divide-y">
                                        {searchResults.slice(0, 3).map((project) => (
                                            <div
                                                key={project.id}
                                                onClick={() => {
                                                    handleProjectClick(project.id)
                                                    setIsOpen(false)
                                                }}
                                                className="p-3 hover:bg-muted cursor-pointer"
                                            >
                                                <h4 className="font-medium text-sm truncate">{project.title}</h4>
                                                <p className="text-xs text-muted-foreground truncate">{project.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* User info in mobile menu if logged in */}
                                {user && (
                                    <div className="flex items-center gap-3 pb-4 border-b">
                                        <Avatar className="h-10 w-10" key={getUserAvatarUrl()}>
                                            <AvatarImage src={getUserAvatarUrl()} alt={user.displayName || "User"} />
                                            <AvatarFallback className="bg-primary text-primary-foreground">
                                                {getUserInitials()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                            {user.displayName && (
                                                <p className="font-medium text-sm">{user.displayName}</p>
                                            )}
                                            {user.email && (
                                                <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                                                    {user.email}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {navLinks.map((link) => (
                                    <Link
                                        key={link.name}
                                        to={link.href}
                                        className="text-lg font-medium transition-colors hover:text-primary"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        {link.name}
                                    </Link>
                                ))}

                                {/* Auth-aware mobile buttons */}
                                {user ? (
                                    <div className="flex flex-col gap-2 mt-4 pt-4 border-t">
                                        <Button variant="outline" asChild className="w-full justify-start">
                                            <Link to="/dashboard" onClick={() => setIsOpen(false)}>
                                                <LayoutDashboard className="mr-2 h-4 w-4" />
                                                Dashboard
                                            </Link>
                                        </Button>
                                        <Button variant="outline" asChild className="w-full justify-start">
                                            <Link to={`/profile/${user.uid}`} onClick={() => setIsOpen(false)}>
                                                <User className="mr-2 h-4 w-4" />
                                                Profile
                                            </Link>
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            className="w-full justify-start mt-2"
                                            onClick={() => {
                                                handleLogout()
                                                setIsOpen(false)
                                            }}
                                        >
                                            <LogOut className="mr-2 h-4 w-4" />
                                            Log out
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2 mt-4">
                                        <Button variant="outline" asChild className="w-full justify-start">
                                            <Link to="/login" onClick={() => setIsOpen(false)}>Log in</Link>
                                        </Button>
                                        <Button asChild className="w-full justify-start">
                                            <Link to="/register" onClick={() => setIsOpen(false)}>Sign up</Link>
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </nav>
    )
}

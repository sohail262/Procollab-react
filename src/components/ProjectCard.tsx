import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Bookmark, Users, Send, LayoutDashboard, CheckCircle, AlertTriangle, MoreVertical, Star } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { invalidateSavedProjectsCache, updateProjectHighlightStatus } from '@/services/dashboardService'
import { getTagColorClass } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from '@/components/ui/dropdown-menu'

interface ProjectCardProps {
    project: {
        id:                string
        title:             string
        description:       string
        status:            string
        tags?:             string[]
        createdAt:         any
        duration?:         string
        currentMembers?:   number
        maxMembers?:       number
        members?:          any[]
        createdBy?:        string
        summary?:          string
        primaryDiscipline?:string
        teamSize?:         number
        ownerLastActiveAt?:any   // ← optional: owner's last activity timestamp
    }
    onApply?:         () => void
    isAlreadyMember?: boolean
    hasApplied?:      boolean   // ← NEW: passed from Projects.tsx / SavedProjects.tsx
}

export function ProjectCard({ project, onApply, isAlreadyMember = false, hasApplied = false }: ProjectCardProps) {
    const navigate = useNavigate()
    const { toast } = useToast()
    const [isSaved,         setIsSaved]         = useState(false)
    const [loading,         setLoading]         = useState(false)
    const [memberProfiles,  setMemberProfiles]  = useState<any[]>([])
    const [isHighlighted,   setIsHighlighted]   = useState((project as any).isHighlighted || false)

    useEffect(() => {
        setIsHighlighted((project as any).isHighlighted || false)
    }, [(project as any).isHighlighted])

    const handleToggleHighlight = async (e: React.MouseEvent) => {
        e.stopPropagation()
        try {
            const nextStatus = !isHighlighted
            await updateProjectHighlightStatus(project.id, nextStatus)
            setIsHighlighted(nextStatus)
            toast({
                title: nextStatus ? 'Added to Highlights' : 'Removed from Highlight',
                description: `Project "${project.title}" highlight status updated.`,
            })
        } catch (error) {
            console.error('Error toggling highlight status:', error)
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to update highlight status.',
            })
        }
    }

    useEffect(() => {
        checkIfSaved()
        loadMemberProfiles()
    }, [project.id])

    const checkIfSaved = async () => {
        if (!auth.currentUser) return
        try {
            const savedRef = doc(db, 'users', auth.currentUser.uid, 'savedProjects', project.id)
            const docSnap  = await getDoc(savedRef)
            setIsSaved(docSnap.exists())
        } catch (error) {
            console.error('Error checking saved status:', error)
        }
    }

    const loadMemberProfiles = async () => {
        try {
            const memberIds =
                project.members && project.members.length > 0
                    ? project.members.slice(0, 3)
                    : project.createdBy ? [project.createdBy] : []

            if (memberIds.length === 0) return

            const profiles = await Promise.all(
                memberIds.map(async memberId => {
                    const userId =
                        typeof memberId === 'string'
                            ? memberId
                            : memberId.userId || memberId.id
                    try {
                        const userDoc = await getDoc(doc(db, 'users', userId))
                        if (userDoc.exists()) return userDoc.data()
                    } catch { /* non-fatal */ }
                    return null
                })
            )
            setMemberProfiles(profiles.filter(Boolean))
        } catch (error) {
            console.error('Error loading member profiles:', error)
        }
    }

    const toggleSave = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!auth.currentUser) return
        setLoading(true)
        try {
            const savedRef = doc(db, 'users', auth.currentUser.uid, 'savedProjects', project.id)
            if (isSaved) {
                await deleteDoc(savedRef)
                setIsSaved(false)
            } else {
                await setDoc(savedRef, { projectId: project.id, savedAt: new Date() })
                setIsSaved(true)
            }
            // ✅ Invalidate the saved-projects cache so the next visit to Saved Projects
            // reflects the change immediately instead of serving stale cached data.
            invalidateSavedProjectsCache(auth.currentUser.uid)
        } catch (error) {
            console.error('Error toggling save:', error)
        } finally {
            setLoading(false)
        }
    }

    const formatTimeAgo = (date: any) => {
        if (!date) return ''
        const diffInSeconds = Math.floor(
            (Date.now() - new Date(date).getTime()) / 1000
        )
        if (diffInSeconds < 60)      return 'Just now'
        if (diffInSeconds < 3600)    return `${Math.floor(diffInSeconds / 60)}m ago`
        if (diffInSeconds < 86400)   return `${Math.floor(diffInSeconds / 3600)}h ago`
        if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`
        return `${Math.floor(diffInSeconds / 2592000)}mo ago`
    }

    // Check if current user is the project owner
    const isOwner =
        auth.currentUser && project.createdBy === auth.currentUser.uid

    // Ghost project: recruiting for 14+ days with no recent owner activity
    const isGhostProject = (() => {
        if (project.status !== 'recruiting') return false
        // Use ownerLastActiveAt if available, else fall back to createdAt
        const referenceDate = project.ownerLastActiveAt
            ? new Date(project.ownerLastActiveAt?.toDate?.() ?? project.ownerLastActiveAt)
            : new Date(project.createdAt)
        const daysSince = Math.floor(
            (Date.now() - referenceDate.getTime()) / (1000 * 60 * 60 * 24)
        )
        return daysSince >= 14
    })()

    const avatars =
        memberProfiles.length > 0
            ? memberProfiles
            : project.members && project.members.length > 0
                ? project.members.slice(0, 3)
                : project.createdBy ? [{ id: project.createdBy }] : []

    // ── What action button to show ─────────────────────────────────────────
    // Priority: owner > already member > applied > apply
    const renderActionButton = () => {
        // Owners go straight to dashboard
        if (isOwner) {
            return (
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground h-auto p-0 px-2"
                    onClick={e => {
                        e.stopPropagation()
                        navigate(`/project/${project.id}/dashboard`)
                    }}
                >
                    <LayoutDashboard className="h-4 w-4 mr-1" />
                    Dashboard
                </Button>
            )
        }

        // Already a member — show "Member" badge + dashboard link
        if (isAlreadyMember) {
            return (
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground h-auto p-0 px-2"
                    onClick={e => {
                        e.stopPropagation()
                        navigate(`/project/${project.id}/dashboard`)
                    }}
                >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Member
                </Button>
            )
        }

        // Has already applied — show "Applied" disabled badge
        if (hasApplied) {
            return (
                <Button
                    variant="ghost"
                    size="sm"
                    disabled
                    className="text-muted-foreground h-auto p-0 px-2 cursor-default opacity-100"
                >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Applied
                </Button>
            )
        }

        // Not a member — show Apply button if handler provided
        if (onApply) {
            return (
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground h-auto p-0 px-2"
                    onClick={e => {
                        e.stopPropagation()
                        onApply()
                    }}
                >
                    <Send className="h-4 w-4 mr-1" />
                    Apply
                </Button>
            )
        }

        return null
    }

    const getStatusStyle = (status: string) => {
        const s = status.toLowerCase()
        if (s === 'recruiting') {
            return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400 border'
        }
        if (s === 'active') {
            return 'border-orange-500/30 bg-orange-500/15 text-orange-400 border'
        }
        if (s === 'planning' || s === 'completed') {
            return 'border-primary/25 bg-primary/10 text-primary border'
        }
        return 'border-white/10 bg-white/5 text-white/70 border'
    }

    // ─── Render ───────────────────────────────────────────────────────────

    return (
        <Card className="glass-card hover:bg-primary/5 rounded-lg overflow-hidden transition-all duration-300 h-full flex flex-col">
            <CardContent className="p-4 sm:p-6 relative z-10 flex flex-col flex-1">
                {/* Header row */}
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge
                            variant="outline"
                            className={`font-semibold text-[10px] uppercase tracking-wider rounded-full px-2.5 py-0.5 ${getStatusStyle(project.status)}`}
                        >
                            {project.status}
                        </Badge>

                        {/* Ghost project warning */}
                        {isGhostProject && !isOwner && (
                            <Badge
                                variant="outline"
                                className="border-destructive/20 text-destructive bg-destructive/10 text-[10px] rounded-full px-2 py-0.5 gap-1 font-semibold"
                                title="Owner hasn't been active for 14+ days"
                            >
                                <AlertTriangle className="h-2.5 w-2.5" />
                                Low activity
                            </Badge>
                        )}

                        {isAlreadyMember && (
                            <Badge
                                variant="outline"
                                className="border-white/15 text-white/80 bg-white/5 text-xs rounded-full px-2.5 py-0.5"
                            >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Joined
                            </Badge>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className="text-xs text-muted-foreground">
                            {formatTimeAgo(project.createdAt)}
                        </span>

                        {isOwner && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        onClick={e => e.stopPropagation()}
                                        className="p-1 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                                        title="Project actions"
                                    >
                                        <MoreVertical className="h-4 w-4" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" onClick={e => e.stopPropagation()} className="w-48 bg-slate-900 border border-slate-800 text-white z-50">
                                    <DropdownMenuItem onClick={handleToggleHighlight} className="cursor-pointer hover:bg-slate-800 focus:bg-slate-800 text-xs py-2 flex items-center gap-2">
                                        <Star className={`h-3.5 w-3.5 ${isHighlighted ? 'fill-yellow-400 text-yellow-400' : 'text-slate-400'}`} />
                                        {isHighlighted ? 'Remove from Highlight' : 'Add to Highlights'}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </div>

                {/* Main Content Wrapper (title, description, tags) that will stretch */}
                <div className="flex-grow flex flex-col justify-start mb-4">
                    {/* Title */}
                    <h3 className="text-base sm:text-lg font-bold mb-1.5 text-foreground line-clamp-1 font-sans">
                        {project.title}
                    </h3>

                    {/* Description */}
                    <p className="text-muted-foreground text-xs sm:text-sm mb-3 line-clamp-2">
                        {project.summary || project.description}
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mt-auto">
                        {project.tags?.slice(0, 3).map((tag, i) => (
                            <Badge
                                key={i}
                                className={`border-0 text-xs px-2.5 py-0.5 rounded-md font-semibold transition-all duration-300 ${getTagColorClass(tag)}`}
                            >
                                {tag}
                            </Badge>
                        ))}
                    </div>
                </div>

                {/* Members + duration row */}
                <div className="flex justify-between items-center text-xs text-muted-foreground mb-3">
                    <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        <span>
                            {(() => {
                                const membersList = project.members || [];
                                const hasOwner = project.createdBy && membersList.includes(project.createdBy);
                                return membersList.length + (hasOwner ? 0 : 1);
                            })()}/
                            {project.maxMembers || project.teamSize || 4}
                        </span>
                    </div>
                    {project.duration && (
                        <span className="text-muted-foreground truncate ml-2">
                            {/* Handle legacy "2" (no unit) vs proper "2 months" */}
                            {/^\d+$/.test(project.duration.trim())
                                ? `${project.duration} months`
                                : project.duration}
                        </span>
                    )}
                </div>

                {/* Footer row */}
                <div className="flex justify-between items-center pt-3 border-t border-border/30">
                    {/* Member avatars */}
                    <div className="flex -space-x-1.5 shrink-0">
                        {avatars.slice(0, 3).map((member, i) => {
                            const userId =
                                member?.id ||
                                member?.userId ||
                                (typeof member === 'string' ? member : `user-${i}`)
                            const photoURL    = member?.photoURL
                            const avatarStyle = member?.avatarStyle || 'avataaars'
                            const avatarSeed  = member?.avatarSeed || member?.email || userId
                            const avatarUrl   =
                                photoURL ||
                                `https://api.dicebear.com/7.x/${avatarStyle}/svg?seed=${encodeURIComponent(avatarSeed)}`
                            const displayName =
                                member?.firstName && member?.lastName
                                    ? `${member.firstName} ${member.lastName}`
                                    : member?.email || userId

                            return (
                                <img
                                    key={i}
                                    src={avatarUrl}
                                    alt={displayName}
                                    className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 border-card bg-muted"
                                />
                            )
                        })}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5">
                        {/* Save bookmark */}
                        <button
                            onClick={toggleSave}
                            disabled={loading}
                            className={`hover:text-foreground transition-colors duration-200 flex items-center gap-1 text-xs ${
                                isSaved
                                    ? 'text-foreground'
                                    : 'text-muted-foreground'
                            }`}
                        >
                            <Bookmark className={`h-3.5 w-3.5 ${isSaved ? 'fill-current' : ''}`} />
                            <span className="hidden sm:inline">{isSaved ? 'Saved' : 'Save'}</span>
                        </button>

                        {/* Dynamic action button */}
                        {renderActionButton()}

                        {/* View Details */}
                        <button
                            onClick={() => navigate(`/project/${project.id}`)}
                            className="text-muted-foreground hover:text-foreground text-xs font-medium transition-colors duration-200"
                        >
                            View
                        </button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

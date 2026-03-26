import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Bookmark, Users, Send, LayoutDashboard, CheckCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { Button } from '@/components/ui/button'

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
    }
    onApply?:         () => void
    isAlreadyMember?: boolean   // ← NEW: passed from Projects.tsx
}

export function ProjectCard({ project, onApply, isAlreadyMember = false }: ProjectCardProps) {
    const navigate = useNavigate()
    const [isSaved,         setIsSaved]         = useState(false)
    const [loading,         setLoading]         = useState(false)
    const [memberProfiles,  setMemberProfiles]  = useState<any[]>([])

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

    const avatars =
        memberProfiles.length > 0
            ? memberProfiles
            : project.members && project.members.length > 0
                ? project.members.slice(0, 3)
                : project.createdBy ? [{ id: project.createdBy }] : []

    // ── What action button to show ─────────────────────────────────────────
    // Priority: owner > already member > apply
    const renderActionButton = () => {
        // Owners go straight to dashboard
        if (isOwner) {
            return (
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-purple-500 hover:text-purple-400 hover:bg-purple-500/10 h-auto p-0 px-2"
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
                    className="text-green-500 hover:text-green-400 hover:bg-green-500/10 h-auto p-0 px-2"
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

        // Not a member — show Apply button if handler provided
        if (onApply) {
            return (
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 h-auto p-0 px-2"
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

    // ─── Render ───────────────────────────────────────────────────────────

    return (
        <Card className="bg-white dark:bg-[#0B1120] border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-colors shadow-sm">
            <CardContent className="p-6">
                {/* Header row */}
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                        <Badge
                            variant="secondary"
                            className={`border-none font-medium ${
                                project.status === 'recruiting'
                                    ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                                    : project.status === 'active'
                                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                        >
                            {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                        </Badge>

                        {/* Member badge inline with status */}
                        {isAlreadyMember && (
                            <Badge
                                variant="outline"
                                className="border-green-500/40 text-green-500 bg-green-500/10 text-xs"
                            >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Joined
                            </Badge>
                        )}
                    </div>

                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        Posted {formatTimeAgo(project.createdAt)}
                    </span>
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white line-clamp-1">
                    {project.title}
                </h3>

                {/* Description */}
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2 min-h-[2.5rem]">
                    {project.summary || project.description}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-6">
                    {project.tags?.slice(0, 3).map((tag, i) => (
                        <Badge
                            key={i}
                            variant="secondary"
                            className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 border-none"
                        >
                            {tag}
                        </Badge>
                    ))}
                </div>

                {/* Members + duration row */}
                <div className="flex justify-between items-center text-sm text-gray-400 mb-6">
                    <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>
                            {project.currentMembers || 1}/
                            {project.maxMembers || project.teamSize || 4} members
                        </span>
                    </div>
                    {project.duration && (
                        <span className="text-gray-600 dark:text-gray-400">
                            Duration: {project.duration}
                        </span>
                    )}
                </div>

                {/* Footer row */}
                <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-800">
                    {/* Member avatars */}
                    <div className="flex -space-x-2">
                        {avatars.map((member, i) => {
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
                                    className="w-8 h-8 rounded-full border-2 border-white dark:border-[#0B1120] bg-gray-200 dark:bg-gray-700"
                                />
                            )
                        })}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-3">
                        {/* Save bookmark */}
                        <button
                            onClick={toggleSave}
                            disabled={loading}
                            className={`hover:text-gray-900 dark:hover:text-white transition-colors flex items-center gap-1 ${
                                isSaved
                                    ? 'text-blue-500 dark:text-blue-400'
                                    : 'text-gray-500 dark:text-gray-400'
                            }`}
                        >
                            <Bookmark
                                className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`}
                            />
                            <span className="text-sm">{isSaved ? 'Saved' : 'Save'}</span>
                        </button>

                        {/* Dynamic action button */}
                        {renderActionButton()}

                        {/* View Details always visible */}
                        <button
                            onClick={() => navigate(`/project/${project.id}`)}
                            className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                        >
                            View Details
                        </button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
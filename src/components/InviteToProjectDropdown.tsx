import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FolderPlus, ChevronDown, CheckCircle2, Send, X } from 'lucide-react'

interface Project {
    id: string
    title: string
}

interface InviteToProjectDropdownProps {
    targetUserId: string
    projects: Project[]
    sentInvites: Set<string>  // Set of `${targetUserId}_${projectId}` keys
    onInvite: (projectId: string, projectTitle: string, message?: string) => Promise<void>
    onClose: () => void
}

export function InviteToProjectDropdown({
    targetUserId,
    projects,
    sentInvites,
    onInvite,
    onClose,
}: InviteToProjectDropdownProps) {
    const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null)
    const [selectedProject, setSelectedProject] = useState<Project | null>(null)
    const [inviteMessage, setInviteMessage] = useState('')
    const ref = useRef<HTMLDivElement>(null)

    // Close on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                onClose()
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [onClose])

    const handleSelectProject = (project: Project) => {
        const key = `${targetUserId}_${project.id}`
        if (sentInvites.has(key)) return
        setSelectedProject(project)
    }

    const handleSendInvite = async () => {
        if (!selectedProject || loadingProjectId) return
        setLoadingProjectId(selectedProject.id)
        try {
            await onInvite(selectedProject.id, selectedProject.title, inviteMessage.trim())
            setSelectedProject(null)
            setInviteMessage('')
        } finally {
            setLoadingProjectId(null)
        }
    }

    return (
        <div
            ref={ref}
            className="absolute right-0 top-full mt-1 z-50 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
        >
            {selectedProject ? (
                <>
                    {/* Header */}
                    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                            Invitation Message
                        </span>
                        <button
                            onClick={() => {
                                setSelectedProject(null)
                                setInviteMessage('')
                            }}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>

                    {/* Form */}
                    <div className="p-3 space-y-3">
                        <div>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold block uppercase tracking-wider">Inviting to</span>
                            <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 mt-0.5 truncate">
                                {selectedProject.title}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <label htmlFor="invite-msg" className="text-[10px] text-gray-400 dark:text-gray-500 font-bold block uppercase tracking-wider">Message (Optional)</label>
                            <textarea
                                id="invite-msg"
                                rows={3}
                                value={inviteMessage}
                                onChange={(e) => setInviteMessage(e.target.value)}
                                placeholder="Explain the project or why you'd like to collaborate..."
                                className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none text-gray-800 dark:text-gray-200"
                            />
                        </div>
                        <div className="flex gap-2 justify-end pt-1">
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                                onClick={() => {
                                    setSelectedProject(null)
                                    setInviteMessage('')
                                }}
                                disabled={!!loadingProjectId}
                            >
                                Back
                            </Button>
                            <Button
                                size="sm"
                                className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={handleSendInvite}
                                disabled={!!loadingProjectId}
                            >
                                {loadingProjectId ? (
                                    <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                    </svg>
                                ) : (
                                    'Invite'
                                )}
                            </Button>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    {/* Header */}
                    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                            Select a Project
                        </span>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>

                    {/* Project list */}
                    <div className="max-h-52 overflow-y-auto">
                        {projects.length === 0 ? (
                            <div className="px-3 py-4 text-center">
                                <FolderPlus className="h-6 w-6 text-gray-300 mx-auto mb-1.5" />
                                <p className="text-xs text-gray-500">
                                    You have no projects to invite to.
                                </p>
                            </div>
                        ) : (
                            projects.map((project) => {
                                const key = `${targetUserId}_${project.id}`
                                const alreadySent = sentInvites.has(key)
                                const isLoading = loadingProjectId === project.id

                                return (
                                    <div
                                        key={project.id}
                                        className={`flex items-center justify-between gap-2 px-3 py-2.5 border-b border-gray-50 dark:border-gray-800/50 last:border-0 transition-colors ${
                                            alreadySent
                                                ? 'bg-green-50 dark:bg-green-900/10'
                                                : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'
                                        }`}
                                    >
                                        <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate flex-1 min-w-0">
                                            {project.title}
                                        </p>

                                        {alreadySent ? (
                                            <Badge className="text-[10px] px-1.5 py-0.5 h-5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border-0 shrink-0 gap-0.5">
                                                <CheckCircle2 className="h-3 w-3" />
                                                Sent
                                            </Badge>
                                        ) : (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-6 text-[10px] px-2 shrink-0 border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/20"
                                                disabled={isLoading || !!loadingProjectId}
                                                onClick={() => handleSelectProject(project)}
                                            >
                                                <span className="flex items-center gap-1">
                                                    <Send className="h-2.5 w-2.5" />
                                                    Invite
                                                </span>
                                            </Button>
                                        )}
                                    </div>
                                )
                            })
                        )}
                    </div>
                </>
            )}
        </div>
    )
}

// ── Trigger button ─────────────────────────────────────────────────────────────

interface InviteButtonProps {
    isOpen: boolean
    onClick: () => void
    className?: string
}

export function InviteButton({ isOpen, onClick, className = '' }: InviteButtonProps) {
    return (
        <Button
            size="sm"
            variant="outline"
            className={`h-7 px-2 text-xs gap-1 transition-all ${
                isOpen
                    ? 'bg-violet-50 border-violet-300 text-violet-700 dark:bg-violet-900/20 dark:border-violet-700 dark:text-violet-400'
                    : 'text-gray-600 dark:text-gray-400'
            } ${className}`}
            onClick={onClick}
        >
            <span className="flex items-center gap-1">
                <FolderPlus className="h-3 w-3" />
                <span>Invite to Project</span>
            </span>
            <ChevronDown className={`h-2.5 w-2.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </Button>
    )
}

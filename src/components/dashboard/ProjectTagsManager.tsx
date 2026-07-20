import { useState, useEffect } from 'react'
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useToast } from '@/hooks/use-toast'
import { useProjectRole } from '@/hooks/use-project-role'
import { doc, onSnapshot, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { ProjectTag, PRESET_TAG_COLORS } from '@/types/project'
import {
    Tag, Plus, Edit2, Trash2, Check,
    Search, UserCheck, ShieldAlert, Sparkles,
    Palette, Info
} from 'lucide-react'

interface TeamMemberItem {
    uid: string
    displayName?: string
    name?: string
    email?: string
    avatar?: string
    photoURL?: string
    role?: string
}

interface ProjectTagsManagerProps {
    projectId: string
    open: boolean
    onOpenChange: (open: boolean) => void
    members?: TeamMemberItem[]
}

const PRESET_TAG_TEMPLATES = [
    { name: 'Software Engineer', color: '#3b82f6' },
    { name: 'Tech Team', color: '#6366f1' },
    { name: 'Graphic Design', color: '#f43f5e' },
    { name: 'Management', color: '#f59e0b' },
    { name: 'Core Dev', color: '#10b981' },
    { name: 'UI/UX Design', color: '#8b5cf6' },
    { name: 'Product Lead', color: '#06b6d4' },
    { name: 'QA & Testing', color: '#14b8a6' },
]

export function ProjectTagsManager({
    projectId,
    open,
    onOpenChange,
    members = [],
}: ProjectTagsManagerProps) {
    const { toast } = useToast()
    const { canManageTeam } = useProjectRole()

    const [projectTags, setProjectTags] = useState<ProjectTag[]>([])
    const [memberTags, setMemberTags] = useState<Record<string, string[]>>({})
    const [loading, setLoading] = useState(true)

    // Form states for tag creation / editing
    const [tagName, setTagName] = useState('')
    const [selectedColor, setSelectedColor] = useState(PRESET_TAG_COLORS[0].hex)
    const [editingTagId, setEditingTagId] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Member search filter inside assignment tab
    const [memberSearch, setMemberSearch] = useState('')
    const [activeTab, setActiveTab] = useState<'define' | 'assign'>('define')

    // Real-time sync with project doc
    useEffect(() => {
        if (!projectId || !open) return

        const unsub = onSnapshot(
            doc(db, 'projects', projectId),
            (snap) => {
                if (snap.exists()) {
                    const data = snap.data()
                    setProjectTags(data.projectTags || [])
                    setMemberTags(data.memberTags || {})
                }
                setLoading(false)
            },
            (error) => {
                console.error('Error fetching project tags:', error)
                setLoading(false)
            }
        )

        return () => unsub()
    }, [projectId, open])

    // Helper: Reset tag form
    const resetForm = () => {
        setTagName('')
        setSelectedColor(PRESET_TAG_COLORS[0].hex)
        setEditingTagId(null)
    }

    // Save/Update Tag definition
    const handleSaveTag = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!canManageTeam) {
            toast({
                title: 'Permission Denied',
                description: 'Only Project Owners and Admins can manage tags.',
                variant: 'destructive',
            })
            return
        }

        const trimmedName = tagName.trim()
        if (!trimmedName) {
            toast({
                title: 'Tag Name Required',
                description: 'Please enter a valid label name for the tag.',
                variant: 'destructive',
            })
            return
        }

        // Check duplicates if creating new tag
        if (
            !editingTagId &&
            projectTags.some((t) => t.name.toLowerCase() === trimmedName.toLowerCase())
        ) {
            toast({
                title: 'Duplicate Tag',
                description: 'A tag with this name already exists in this project.',
                variant: 'destructive',
            })
            return
        }

        setIsSubmitting(true)

        try {
            let updatedTags: ProjectTag[] = []

            if (editingTagId) {
                // Update existing tag
                updatedTags = projectTags.map((t) =>
                    t.id === editingTagId
                        ? {
                              ...t,
                              name: trimmedName,
                              color: selectedColor,
                          }
                        : t
                )
            } else {
                // Create new tag
                const newTag: ProjectTag = {
                    id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                    name: trimmedName,
                    color: selectedColor,
                    createdAt: new Date().toISOString(),
                }
                updatedTags = [...projectTags, newTag]
            }

            await updateDoc(doc(db, 'projects', projectId), {
                projectTags: updatedTags,
            })

            toast({
                title: editingTagId ? 'Tag Updated' : 'Tag Created',
                description: `Project tag "${trimmedName}" has been successfully saved.`,
            })

            resetForm()
        } catch (err: any) {
            console.error('Error saving tag:', err)
            toast({
                title: 'Error',
                description: err.message || 'Failed to save tag.',
                variant: 'destructive',
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    // Quick Add Preset Template
    const handleAddPreset = async (preset: { name: string; color: string }) => {
        if (!canManageTeam) return
        if (projectTags.some((t) => t.name.toLowerCase() === preset.name.toLowerCase())) {
            toast({
                title: 'Tag Already Added',
                description: `Tag "${preset.name}" is already defined in this project.`,
            })
            return
        }

        try {
            const newTag: ProjectTag = {
                id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                name: preset.name,
                color: preset.color,
                createdAt: new Date().toISOString(),
            }

            const updatedTags = [...projectTags, newTag]
            await updateDoc(doc(db, 'projects', projectId), {
                projectTags: updatedTags,
            })

            toast({
                title: 'Template Tag Added',
                description: `Added "${preset.name}" tag to project workspace.`,
            })
        } catch (err: any) {
            console.error('Error adding preset tag:', err)
            toast({
                title: 'Error',
                description: err.message || 'Failed to add preset tag.',
                variant: 'destructive',
            })
        }
    }

    // Edit existing tag action
    const handleStartEdit = (tag: ProjectTag) => {
        setEditingTagId(tag.id)
        setTagName(tag.name)
        setSelectedColor(tag.color)
    }

    // Delete tag action
    const handleDeleteTag = async (tagId: string, tagName: string) => {
        if (!canManageTeam) return

        try {
            const updatedTags = projectTags.filter((t) => t.id !== tagId)

            // Also remove this tagId/tagName from all member assignments in memberTags map
            const updatedMemberTags: Record<string, string[]> = { ...memberTags }
            Object.keys(updatedMemberTags).forEach((uid) => {
                updatedMemberTags[uid] = (updatedMemberTags[uid] || []).filter((id) => id !== tagId && id !== tagName)
            })

            await updateDoc(doc(db, 'projects', projectId), {
                projectTags: updatedTags,
                memberTags: updatedMemberTags,
            })

            toast({
                title: 'Tag Removed',
                description: `Tag "${tagName}" was removed from the project workspace.`,
            })

            if (editingTagId === tagId) resetForm()
        } catch (err: any) {
            console.error('Error deleting tag:', err)
            toast({
                title: 'Delete Failed',
                description: err.message || 'Failed to delete tag.',
                variant: 'destructive',
            })
        }
    }

    // Toggle tag assignment for a team member
    const handleToggleMemberTag = async (memberUid: string, tagIdOrName: string) => {
        if (!canManageTeam) {
            toast({
                title: 'Permission Denied',
                description: 'Only Owners and Admins can assign project tags.',
                variant: 'destructive',
            })
            return
        }

        try {
            const currentTags = memberTags[memberUid] || []
            const hasTag = currentTags.includes(tagIdOrName)

            const updatedMemberTagsForUser = hasTag
                ? currentTags.filter((t) => t !== tagIdOrName)
                : [...currentTags, tagIdOrName]

            const updatedMemberTagsMap = {
                ...memberTags,
                [memberUid]: updatedMemberTagsForUser,
            }

            // Update root project doc
            const projectRef = doc(db, 'projects', projectId)
            await updateDoc(projectRef, {
                [`memberTags.${memberUid}`]: updatedMemberTagsForUser,
            })

            // Update local state immediately
            setMemberTags(updatedMemberTagsMap)

            // Try updating member subcollection doc quietly for backward compatibility
            try {
                const memberRef = doc(db, 'projects', projectId, 'members', memberUid)
                await updateDoc(memberRef, { tags: updatedMemberTagsForUser })
            } catch (e) {
                // Ignore subcollection error if doc path differs
            }

        } catch (err: any) {
            console.error('Error updating member tag assignment:', err)
            toast({
                title: 'Assignment Failed',
                description: err.message || 'Failed to update member tag.',
                variant: 'destructive',
            })
        }
    }

    // Filter members for assign tab
    const filteredMembers = members.filter((m) => {
        const name = m.displayName || m.name || ''
        const email = m.email || ''
        const query = memberSearch.toLowerCase()
        return name.toLowerCase().includes(query) || email.toLowerCase().includes(query)
    })

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden sm:rounded-xl">
                <DialogHeader className="p-6 pb-4 border-b bg-card">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                <Tag className="h-5 w-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                    Project Custom Tags
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                    Define project-specific labels and assign them to team members inside this workspace.
                                </DialogDescription>
                            </div>
                        </div>
                    </div>

                    {!canManageTeam && (
                        <div className="mt-3 flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs">
                            <ShieldAlert className="h-4 w-4 shrink-0" />
                            <span>
                                You are viewing project tags in read-only mode. Only Project Owners and Admins can create or assign tags.
                            </span>
                        </div>
                    )}
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col min-h-0">
                    <div className="px-6 pt-3 bg-card border-b">
                        <TabsList className="grid w-full grid-cols-2 h-9">
                            <TabsTrigger value="define" className="text-xs gap-2">
                                <Palette className="h-3.5 w-3.5" />
                                Define Tags ({projectTags.length})
                            </TabsTrigger>
                            <TabsTrigger value="assign" className="text-xs gap-2">
                                <UserCheck className="h-3.5 w-3.5" />
                                Assign to Members ({members.length})
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* TAB 1: DEFINE TAGS */}
                    <TabsContent value="define" className="flex-1 overflow-y-auto p-6 space-y-6 m-0">
                        {canManageTeam && (
                            <form onSubmit={handleSaveTag} className="p-4 rounded-xl border bg-accent/30 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-semibold flex items-center gap-1.5">
                                        <Sparkles className="h-4 w-4 text-primary" />
                                        {editingTagId ? 'Edit Project Tag' : 'Create New Tag'}
                                    </h4>
                                    {editingTagId && (
                                        <Button type="button" variant="ghost" size="sm" onClick={resetForm} className="h-7 text-xs">
                                            Cancel Editing
                                        </Button>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="tagName" className="text-xs font-medium">
                                        Tag Label Name *
                                    </Label>
                                    <Input
                                        id="tagName"
                                        placeholder="e.g. Software Engineer, Tech Team, Graphic Design, Management"
                                        value={tagName}
                                        onChange={(e) => setTagName(e.target.value)}
                                        className="h-9 text-xs"
                                        maxLength={30}
                                    />
                                </div>

                                {/* Quick Tag Templates */}
                                <div className="space-y-1.5 pt-1">
                                    <Label className="text-xs font-medium flex items-center justify-between">
                                        <span>Quick Templates (Click to Add)</span>
                                    </Label>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        {PRESET_TAG_TEMPLATES.map((tmpl) => {
                                            const isAlreadyAdded = projectTags.some(
                                                (t) => t.name.toLowerCase() === tmpl.name.toLowerCase()
                                            )

                                            return (
                                                <button
                                                    key={tmpl.name}
                                                    type="button"
                                                    disabled={isAlreadyAdded}
                                                    onClick={() => {
                                                        if (!isAlreadyAdded) {
                                                            setTagName(tmpl.name)
                                                            setSelectedColor(tmpl.color)
                                                        }
                                                    }}
                                                    className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 border transition-all ${
                                                        isAlreadyAdded
                                                            ? 'opacity-40 cursor-not-allowed border-dashed'
                                                            : 'hover:scale-105 hover:shadow-xs cursor-pointer'
                                                    }`}
                                                    style={{
                                                        backgroundColor: `${tmpl.color}18`,
                                                        color: tmpl.color,
                                                        borderColor: `${tmpl.color}40`,
                                                    }}
                                                    title={isAlreadyAdded ? 'Tag already added' : `Use "${tmpl.name}" template`}
                                                >
                                                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tmpl.color }} />
                                                    <span>{tmpl.name}</span>
                                                    {isAlreadyAdded ? (
                                                        <Check className="h-3 w-3 ml-0.5 opacity-70" />
                                                    ) : (
                                                        <Plus className="h-3 w-3 ml-0.5" />
                                                    )}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                <div className="space-y-1.5 pt-1">
                                    <Label className="text-xs font-medium">Tag Color Palette</Label>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {PRESET_TAG_COLORS.map((preset) => (
                                            <button
                                                key={preset.hex}
                                                type="button"
                                                onClick={() => setSelectedColor(preset.hex)}
                                                className={`h-7 px-2.5 rounded-full text-xs font-medium flex items-center gap-1.5 border transition-all ${
                                                    selectedColor === preset.hex
                                                        ? 'ring-2 ring-primary ring-offset-1 scale-105 shadow-sm'
                                                        : 'opacity-85 hover:opacity-100'
                                                }`}
                                                style={{
                                                    backgroundColor: `${preset.hex}18`,
                                                    color: preset.hex,
                                                    borderColor: `${preset.hex}40`,
                                                }}
                                            >
                                                <span
                                                    className="w-2.5 h-2.5 rounded-full"
                                                    style={{ backgroundColor: preset.hex }}
                                                />
                                                {preset.name}
                                                {selectedColor === preset.hex && <Check className="h-3 w-3 ml-0.5" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-1 border-t mt-3">
                                    <div className="flex items-center gap-2 pt-2">
                                        <span className="text-xs text-muted-foreground">Preview:</span>
                                        <Badge
                                            className="px-2.5 py-0.5 rounded-full text-xs font-medium border shadow-xs"
                                            style={{
                                                backgroundColor: `${selectedColor}18`,
                                                color: selectedColor,
                                                borderColor: `${selectedColor}40`,
                                            }}
                                        >
                                            <span
                                                className="w-1.5 h-1.5 rounded-full mr-1.5 shrink-0"
                                                style={{ backgroundColor: selectedColor }}
                                            />
                                            {tagName.trim() || 'Preview Tag'}
                                        </Badge>
                                    </div>

                                    <Button type="submit" size="sm" disabled={isSubmitting || !tagName.trim()} className="h-8 text-xs gap-1.5 mt-2">
                                        {editingTagId ? (
                                            <>
                                                <Check className="h-3.5 w-3.5" /> Update Tag
                                            </>
                                        ) : (
                                            <>
                                                <Plus className="h-3.5 w-3.5" /> Add Tag
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </form>
                        )}

                        {/* Tag Definitions List */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Project Tag Definitions ({projectTags.length})
                            </h4>

                            {projectTags.length === 0 ? (
                                <div className="text-center py-8 px-4 rounded-xl border border-dashed text-muted-foreground space-y-2">
                                    <Tag className="h-8 w-8 mx-auto opacity-40" />
                                    <p className="text-sm font-medium">No custom tags created yet.</p>
                                    <p className="text-xs max-w-sm mx-auto">
                                        {canManageTeam
                                            ? 'Use the form or quick templates above to define project-specific tags.'
                                            : 'No tags have been created by project owners yet.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {projectTags.map((tag) => {
                                        const assignedCount = Object.values(memberTags).filter(
                                            (userTagList) => userTagList && (userTagList.includes(tag.id) || userTagList.includes(tag.name))
                                        ).length

                                        return (
                                            <div
                                                key={tag.id}
                                                className="flex items-center justify-between p-3 rounded-xl border bg-card hover:shadow-sm transition-all group"
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <span
                                                        className="w-3 h-3 rounded-full shrink-0"
                                                        style={{ backgroundColor: tag.color }}
                                                    />
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-xs font-semibold truncate" title={tag.name}>
                                                                {tag.name}
                                                            </p>
                                                            <Badge
                                                                variant="outline"
                                                                className="text-[10px] px-1.5 py-0 h-4 font-normal text-muted-foreground"
                                                            >
                                                                {assignedCount} member{assignedCount === 1 ? '' : 's'}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </div>

                                                {canManageTeam && (
                                                    <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleStartEdit(tag)}
                                                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                                            title="Edit Tag"
                                                        >
                                                            <Edit2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDeleteTag(tag.id, tag.name)}
                                                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                            title="Delete Tag"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    {/* TAB 2: ASSIGN TAGS TO MEMBERS */}
                    <TabsContent value="assign" className="flex-1 overflow-y-auto p-6 space-y-4 m-0">
                        <div className="flex items-center gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search team members by name or email..."
                                    value={memberSearch}
                                    onChange={(e) => setMemberSearch(e.target.value)}
                                    className="pl-9 h-9 text-xs"
                                />
                            </div>
                        </div>

                        {projectTags.length === 0 ? (
                            <div className="text-center py-10 px-4 rounded-xl border border-dashed space-y-3">
                                <Tag className="h-8 w-8 mx-auto text-muted-foreground opacity-50" />
                                <p className="text-sm font-medium">Please define project tags first.</p>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setActiveTab('define')}
                                    className="h-8 text-xs gap-1.5"
                                >
                                    <Plus className="h-3.5 w-3.5" /> Switch to Tag Definitions
                                </Button>
                            </div>
                        ) : filteredMembers.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-xs">
                                No matching team members found.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {filteredMembers.map((member) => {
                                    const mUid = member.uid
                                    const assignedTagKeys = memberTags[mUid] || []

                                    return (
                                        <div
                                            key={mUid}
                                            className="p-3.5 rounded-xl border bg-card space-y-3 hover:border-primary/30 transition-colors"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-9 w-9">
                                                        <AvatarImage src={member.avatar || member.photoURL} />
                                                        <AvatarFallback className="text-xs font-bold">
                                                            {(member.displayName || member.name || 'U').charAt(0).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-xs font-semibold">
                                                                {member.displayName || member.name || 'Team Member'}
                                                            </p>
                                                            {member.role && (
                                                                <Badge
                                                                    variant="secondary"
                                                                    className="text-[9px] px-1.5 py-0 font-medium capitalize"
                                                                >
                                                                    {member.role}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-[11px] text-muted-foreground">
                                                            {member.email || 'Workspace Member'}
                                                        </p>
                                                    </div>
                                                </div>

                                                <span className="text-[11px] font-medium text-muted-foreground">
                                                    {assignedTagKeys.length} tag{assignedTagKeys.length === 1 ? '' : 's'}
                                                </span>
                                            </div>

                                            {/* Tag Selector Chips */}
                                            <div className="pt-2 border-t flex flex-wrap items-center gap-1.5">
                                                <span className="text-[11px] text-muted-foreground mr-1">Assign:</span>
                                                {projectTags.map((tag) => {
                                                    const isAssigned =
                                                        assignedTagKeys.includes(tag.id) || assignedTagKeys.includes(tag.name)

                                                    return (
                                                        <button
                                                            key={tag.id}
                                                            type="button"
                                                            disabled={!canManageTeam}
                                                            onClick={() => handleToggleMemberTag(mUid, tag.id)}
                                                            className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 border transition-all ${
                                                                isAssigned
                                                                    ? 'ring-1 ring-primary/50 shadow-xs'
                                                                    : 'opacity-60 hover:opacity-100 grayscale hover:grayscale-0'
                                                            } ${!canManageTeam ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                                                            style={{
                                                                backgroundColor: isAssigned ? `${tag.color}20` : 'transparent',
                                                                color: isAssigned ? tag.color : 'inherit',
                                                                borderColor: isAssigned ? `${tag.color}60` : 'currentColor',
                                                            }}
                                                        >
                                                            <span
                                                                className="w-2 h-2 rounded-full"
                                                                style={{ backgroundColor: tag.color }}
                                                            />
                                                            {tag.name}
                                                            {isAssigned && <Check className="h-3 w-3 ml-0.5 text-primary" />}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>

                <DialogFooter className="p-4 border-t bg-accent/20 sm:justify-between flex-row items-center">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Info className="h-3.5 w-3.5 text-primary" />
                        <span>Tags are visible across the entire project workspace.</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs">
                        Done
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

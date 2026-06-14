/**
 * GoogleDocsPanel.tsx
 *
 * Replaces the old Documents tab. Connects to Google Drive via OAuth,
 * stores a shared project folder ID in Firestore, and lets all members
 * create / view / rename / delete Google Docs, Sheets, and Slides.
 *
 * RBAC:
 *  Owner / Admin → Connect Drive, setup folder, delete any doc
 *  Members       → Connect their own Google account to create docs,
 *                  delete only their own docs, view everything
 */
import { useState, useEffect, useRef } from 'react'
import { useGoogleDriveToken } from '@/hooks/use-google-drive-token'
import {
    doc, getDoc, setDoc, updateDoc,
    collection, onSnapshot, addDoc, deleteDoc,
    serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'
import { useToast } from '@/hooks/use-toast'
import { updateCollaborativeActivity } from '@/services/analyticsService'
import {
    createProjectFolder,
    createFileInFolder,
    uploadFileToFolder,
    deleteFile,
    renameFile,
    getEmbedUrl,
    mimeLabel,
    MIME,
    type DocType,
    type DriveFile,
} from '@/lib/google-drive'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { format } from 'date-fns'
import {
    FileText, Sheet, Presentation, Plus, Trash2,
    ExternalLink, Link2, Pencil, MoreVertical,
    FolderOpen, LogIn, RefreshCw, X, Check,
    AlertTriangle, ChevronLeft, Upload,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────────
interface DriveConfig {
    folderId:    string
    folderName:  string
    folderUrl:   string
    connectedBy: string
    connectedAt: any
}

interface StoredDoc {
    id:          string   // Firestore doc ID
    fileId:      string   // Google Drive file ID
    title:       string
    mimeType:    string
    webViewLink: string
    createdBy:   string
    createdAt:   any
}

const DOC_TYPES: { type: DocType; label: string; icon: React.ReactNode; color: string }[] = [
    {
        type:  'document',
        label: 'Google Doc',
        icon:  <FileText className="h-5 w-5" />,
        color: 'text-blue-600',
    },
    {
        type:  'spreadsheet',
        label: 'Google Sheet',
        icon:  <Sheet className="h-5 w-5" />,
        color: 'text-green-600',
    },
    {
        type:  'presentation',
        label: 'Google Slides',
        icon:  <Presentation className="h-5 w-5" />,
        color: 'text-orange-500',
    },
]

function DocIcon({ mimeType, size = 'default' }: { mimeType: string; size?: 'default' | 'sm' }) {
    const cls = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'
    if (mimeType === MIME.document)     return <FileText className={`${cls} text-blue-600`} />
    if (mimeType === MIME.spreadsheet)  return <Sheet className={`${cls} text-green-600`} />
    if (mimeType === MIME.presentation) return <Presentation className={`${cls} text-orange-500`} />
    return <FileText className={`${cls} text-muted-foreground`} />
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function GoogleDocsPanel() {
    const { id: projectId }  = useParams()
    const { user }           = useAuth()
    const { isOwner, isAdmin } = usePermissions()
    const { toast }          = useToast()

    const isOwnerOrAdmin = isOwner || isAdmin

    // ── Google Drive token (persisted, shared across components) ─────────────
    const { token: accessToken, connected, connecting, connect: connectGoogle, disconnect } = useGoogleDriveToken()

    // ── Drive / Firestore state ───────────────────────────────────────────────
    const [driveConfig,     setDriveConfig]     = useState<DriveConfig | null>(null)
    const [configLoading,   setConfigLoading]   = useState(true)
    const [docs,            setDocs]            = useState<StoredDoc[]>([])
    const [docsLoading,     setDocsLoading]     = useState(true)
    const [setupFolder,     setSetupFolder]     = useState(false)

    // ── UI state ──────────────────────────────────────────────────────────────
    const [activeDoc,       setActiveDoc]       = useState<StoredDoc | null>(null)
    const [showNewDialog,   setShowNewDialog]   = useState(false)
    const [newDocTitle,     setNewDocTitle]     = useState('')
    const [newDocType,      setNewDocType]      = useState<DocType>('document')
    const [creating,        setCreating]        = useState(false)
    const [deletingId,      setDeletingId]      = useState<string | null>(null)
    const [renamingDoc,     setRenamingDoc]     = useState<StoredDoc | null>(null)
    const [renameTitle,     setRenameTitle]     = useState('')
    const [renaming,        setRenaming]        = useState(false)
    const [uploading,       setUploading]       = useState(false)

    // Hidden file input ref for upload
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Project name for folder creation
    const [projectName, setProjectName] = useState('')

    // ── Load project name ─────────────────────────────────────────────────────
    useEffect(() => {
        if (!projectId) return
        getDoc(doc(db, 'projects', projectId)).then(snap => {
            if (snap.exists()) setProjectName(snap.data().title ?? 'Project')
        })
    }, [projectId])

    // ── Load drive config from Firestore ──────────────────────────────────────
    useEffect(() => {
        if (!projectId) return
        const unsubConfig = onSnapshot(
            doc(db, 'projects', projectId, 'driveConfig', 'config'),
            snap => {
                if (snap.exists()) {
                    setDriveConfig(snap.data() as DriveConfig)
                } else {
                    setDriveConfig(null)
                }
                setConfigLoading(false)
            },
            err => {
                console.error('Drive config listener error:', err)
                setConfigLoading(false)
            }
        )
        return () => unsubConfig()
    }, [projectId])

    // ── Listen for docs in Firestore ──────────────────────────────────────────
    useEffect(() => {
        if (!projectId) return
        const q = query(
            collection(db, 'projects', projectId, 'driveDocuments'),
            orderBy('createdAt', 'desc')
        )
        const unsub = onSnapshot(
            q,
            snap => {
                setDocs(snap.docs.map(d => ({ id: d.id, ...d.data() } as StoredDoc)))
                setDocsLoading(false)
            },
            err => {
                console.error('Drive docs listener:', err)
                setDocsLoading(false)
            }
        )
        return () => unsub()
    }, [projectId])

    const handleConnectGoogle = () => {
        if (!driveConfig) {
            setSetupFolder(true)
        }
        connectGoogle()
    }

    // ── Setup Drive folder (owner/admin only) ─────────────────────────────────
    const handleSetupFolder = async () => {
        if (!accessToken || !projectId || !user) return
        try {
            const { id: folderId, webViewLink } = await createProjectFolder(
                accessToken,
                projectName || 'Project'
            )

            const config: DriveConfig = {
                folderId,
                folderName: `Procollab – ${projectName}`,
                folderUrl:  webViewLink,
                connectedBy: user.uid,
                connectedAt: serverTimestamp(),
            }

            await setDoc(
                doc(db, 'projects', projectId, 'driveConfig', 'config'),
                config
            )

            toast({
                title:       'Drive folder created!',
                description: `"Procollab – ${projectName}" is ready in your Google Drive.`,
            })
        } catch (err: any) {
            console.error('Folder setup error:', err)
            toast({
                title:       'Error creating folder',
                description: err.message || 'Please try again.',
                variant:     'destructive',
            })
        }
    }

    // If owner just connected and folder doesn't exist → ask to create
    useEffect(() => {
        if (setupFolder && accessToken && !driveConfig && isOwnerOrAdmin) {
            handleSetupFolder()
        }
    }, [setupFolder, accessToken, driveConfig])

    // ── Create a document ─────────────────────────────────────────────────────
    const handleCreate = async () => {
        if (!accessToken || !driveConfig || !projectId || !user) return
        if (!newDocTitle.trim()) return
        setCreating(true)
        try {
            const file = await createFileInFolder(
                accessToken,
                driveConfig.folderId,
                newDocTitle.trim(),
                newDocType
            )

            // Store metadata in Firestore
            await addDoc(
                collection(db, 'projects', projectId, 'driveDocuments'),
                {
                    fileId:      file.id,
                    title:       file.name,
                    mimeType:    file.mimeType,
                    webViewLink: file.webViewLink,
                    createdBy:   user.uid,
                    createdAt:   serverTimestamp(),
                }
            )

            updateCollaborativeActivity(user.uid, projectId)

            toast({
                title:       `${newDocTitle} created!`,
                description: `Your ${mimeLabel(file.mimeType)} is ready to edit.`,
            })

            setShowNewDialog(false)
            setNewDocTitle('')
        } catch (err: any) {
            console.error('Create doc error:', err)
            // Token may have expired — prompt re-auth
            if (err.message?.includes('401') || err.message?.includes('403')) {
                disconnect()
                toast({
                    title:       'Session expired',
                    description: 'Please reconnect your Google account.',
                    variant:     'destructive',
                })
            } else {
                toast({
                    title:       'Error creating document',
                    description: err.message,
                    variant:     'destructive',
                })
            }
        } finally {
            setCreating(false)
        }
    }

    // ── Delete a document ──────────────────────────────────────────────────────
    const handleDelete = async (storedDoc: StoredDoc) => {
        if (!projectId || !user) return
        // Permission: owner/admin can delete any; member only their own
        if (!isOwnerOrAdmin && storedDoc.createdBy !== user.uid) {
            toast({
                title:       'Permission denied',
                description: 'You can only delete documents you created.',
                variant:     'destructive',
            })
            return
        }

        setDeletingId(storedDoc.id)
        try {
            // Delete from Google Drive if we have token
            if (accessToken) {
                try { await deleteFile(accessToken, storedDoc.fileId) } catch { /* Drive delete failed — still remove from Firestore */ }
            }
            // Always remove from Firestore
            await deleteDoc(
                doc(db, 'projects', projectId, 'driveDocuments', storedDoc.id)
            )
            if (activeDoc?.id === storedDoc.id) setActiveDoc(null)
            toast({ title: 'Document deleted' })
        } catch (err: any) {
            toast({
                title:       'Error deleting',
                description: err.message,
                variant:     'destructive',
            })
        } finally {
            setDeletingId(null)
        }
    }

    // ── Upload a file ──────────────────────────────────────────────────────────
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !accessToken || !driveConfig || !projectId || !user) return
        setUploading(true)
        try {
            const uploaded = await uploadFileToFolder(
                accessToken,
                driveConfig.folderId,
                file
            )
            // Store metadata in Firestore
            await addDoc(
                collection(db, 'projects', projectId, 'driveDocuments'),
                {
                    fileId:      uploaded.id,
                    title:       uploaded.name,
                    mimeType:    uploaded.mimeType,
                    webViewLink: uploaded.webViewLink,
                    createdBy:   user.uid,
                    createdAt:   serverTimestamp(),
                }
            )

            updateCollaborativeActivity(user.uid, projectId)
            toast({
                title:       `${file.name} uploaded!`,
                description: 'File is now in the shared project folder.',
            })
        } catch (err: any) {
            console.error('Upload error:', err)
            if (err.message?.includes('401') || err.message?.includes('403')) {
                disconnect()
                toast({
                    title:       'Session expired',
                    description: 'Please reconnect your Google account.',
                    variant:     'destructive',
                })
            } else {
                toast({
                    title:       'Upload failed',
                    description: err.message,
                    variant:     'destructive',
                })
            }
        } finally {
            setUploading(false)
            // Reset input so the same file can be re-selected if needed
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    // ── Rename a document ──────────────────────────────────────────────────────
    const handleRename = async () => {
        if (!renamingDoc || !renameTitle.trim() || !accessToken || !projectId) return
        setRenaming(true)
        try {
            await renameFile(accessToken, renamingDoc.fileId, renameTitle.trim())
            await updateDoc(
                doc(db, 'projects', projectId, 'driveDocuments', renamingDoc.id),
                { title: renameTitle.trim() }
            )
            if (user) {
                updateCollaborativeActivity(user.uid, projectId)
            }
            if (activeDoc?.id === renamingDoc.id) {
                setActiveDoc(prev => prev ? { ...prev, title: renameTitle.trim() } : prev)
            }
            toast({ title: 'Renamed successfully' })
            setRenamingDoc(null)
        } catch (err: any) {
            toast({
                title:       'Error renaming',
                description: err.message,
                variant:     'destructive',
            })
        } finally {
            setRenaming(false)
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    // Loading
    if (configLoading) {
        return (
            <div className="space-y-4 p-4">
                <Skeleton className="h-10 w-48" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1,2,3].map(i => <Skeleton key={i} className="h-28" />)}
                </div>
            </div>
        )
    }

    // Drive not connected yet — show setup screen
    if (!driveConfig) {
        return (
            <div className="flex flex-col items-center justify-center
                            min-h-[400px] gap-6 p-8 text-center">
                <div className="relative">
                    <div className="h-24 w-24 rounded-2xl bg-gradient-to-br
                                    from-blue-500 to-indigo-600 flex items-center
                                    justify-center shadow-xl shadow-blue-500/25">
                        <FolderOpen className="h-12 w-12 text-white" />
                    </div>
                </div>

                <div className="space-y-2 max-w-md">
                    <h2 className="text-2xl font-bold">Connect Google Drive</h2>
                    {isOwnerOrAdmin ? (
                        <p className="text-muted-foreground leading-relaxed">
                            Connect your Google account to create a shared project folder.
                            All team members will be able to create and collaborate on
                            Google Docs, Sheets, and Slides within this folder.
                        </p>
                    ) : (
                        <p className="text-muted-foreground leading-relaxed">
                            The project owner hasn't connected Google Drive yet.
                            Ask your project owner to set it up from this tab.
                        </p>
                    )}
                </div>

                {isOwnerOrAdmin && (
                    <div className="flex flex-col items-center gap-3">
                        <Button
                            size="lg"
                            onClick={handleConnectGoogle}
                            disabled={connecting}
                            className="bg-blue-600 hover:bg-blue-700 text-white
                                       shadow-lg shadow-blue-500/25 gap-3 px-8"
                        >
                            <img
                                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                                alt="Google"
                                className="h-5 w-5"
                            />
                            {connecting ? 'Connecting…' : 'Connect Google Drive'}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                            Requires access only to files created by Procollab
                        </p>
                    </div>
                )}
            </div>
        )
    }

    // Drive IS connected → show the docs workspace
    return (
        <div className="flex h-full gap-0">

            {/* ── Left sidebar: document list ── */}
            <div className={`flex flex-col border-r bg-muted/20
                             ${activeDoc ? 'hidden md:flex w-72 shrink-0' : 'flex-1 md:w-80 md:flex-none md:shrink-0'}`}>

                {/* Sidebar header */}
                <div className="flex items-center justify-between px-4 py-3 border-b">
                    <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-semibold truncate max-w-[140px]">
                            {driveConfig.folderName}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Open folder in Drive"
                            onClick={() => window.open(driveConfig.folderUrl, '_blank')}
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>

                {/* Connect google / token status */}
                <div className="px-3 pt-3">
                    {!accessToken ? (
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-2 text-xs"
                            onClick={handleConnectGoogle}
                            disabled={connecting}
                        >
                            <LogIn className="h-3.5 w-3.5" />
                            {connecting ? 'Connecting…' : 'Connect Google to create / edit'}
                        </Button>
                    ) : (
                        <div className="flex gap-1.5">
                            <Button
                                className="flex-1 gap-2 h-8 text-xs"
                                onClick={() => {
                                    setNewDocType('document')
                                    setNewDocTitle('')
                                    setShowNewDialog(true)
                                }}
                            >
                                <Plus className="h-3.5 w-3.5" />
                                New
                            </Button>
                            <Button
                                variant="outline"
                                className="h-8 w-8 p-0 shrink-0"
                                title="Upload a file to Drive"
                                disabled={uploading}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {uploading
                                    ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                    : <Upload className="h-3.5 w-3.5" />
                                }
                            </Button>
                            {/* Hidden file input */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                className="hidden"
                                onChange={handleUpload}
                            />
                        </div>
                    )}
                </div>

                {/* Document list */}
                <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
                    {docsLoading ? (
                        [1,2,3].map(i => <Skeleton key={i} className="h-14" />)
                    ) : docs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center
                                        py-12 text-muted-foreground gap-2">
                            <FileText className="h-8 w-8 opacity-25" />
                            <p className="text-xs text-center">
                                No documents yet.
                                {accessToken
                                    ? ' Click "New Document" to create one.'
                                    : ' Connect Google to get started.'}
                            </p>
                        </div>
                    ) : (
                        docs.map(d => {
                            const isOwnerDoc = d.createdBy === user?.uid
                            const canDelete  = isOwnerOrAdmin || isOwnerDoc
                            const isActive   = activeDoc?.id === d.id

                            return (
                                <div
                                    key={d.id}
                                    onClick={() => setActiveDoc(d)}
                                    className={`group flex items-center gap-3 px-3 py-2.5
                                                rounded-lg cursor-pointer transition-colors
                                                ${isActive
                                                    ? 'bg-primary/10 border border-primary/20'
                                                    : 'hover:bg-muted/60'
                                                }`}
                                >
                                    <DocIcon mimeType={d.mimeType} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">
                                            {d.title}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {mimeLabel(d.mimeType)}
                                        </p>
                                    </div>

                                    {/* Actions dropdown */}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button
                                                type="button"
                                                onClick={e => e.stopPropagation()}
                                                className="opacity-0 group-hover:opacity-100
                                                           h-6 w-6 flex items-center justify-center
                                                           rounded hover:bg-muted-foreground/20
                                                           transition-opacity"
                                            >
                                                <MoreVertical className="h-3.5 w-3.5" />
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-44">
                                            <DropdownMenuItem
                                                onClick={e => {
                                                    e.stopPropagation()
                                                    window.open(d.webViewLink, '_blank')
                                                }}
                                            >
                                                <ExternalLink className="h-3.5 w-3.5 mr-2" />
                                                Open in Drive
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={e => {
                                                    e.stopPropagation()
                                                    navigator.clipboard.writeText(d.webViewLink)
                                                    toast({ title: 'Link copied!' })
                                                }}
                                            >
                                                <Link2 className="h-3.5 w-3.5 mr-2" />
                                                Copy link
                                            </DropdownMenuItem>
                                            {accessToken && (
                                                <DropdownMenuItem
                                                    onClick={e => {
                                                        e.stopPropagation()
                                                        setRenamingDoc(d)
                                                        setRenameTitle(d.title)
                                                    }}
                                                >
                                                    <Pencil className="h-3.5 w-3.5 mr-2" />
                                                    Rename
                                                </DropdownMenuItem>
                                            )}
                                            {canDelete && (
                                                <>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        onClick={e => {
                                                            e.stopPropagation()
                                                            handleDelete(d)
                                                        }}
                                                        disabled={deletingId === d.id}
                                                        className="text-destructive focus:text-destructive"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                                                        {deletingId === d.id ? 'Deleting…' : 'Delete'}
                                                    </DropdownMenuItem>
                                                </>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>

            {/* ── Right panel: document preview / editor ── */}
            {activeDoc ? (
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Preview toolbar */}
                    <div className="flex items-center gap-3 px-4 py-2.5
                                    border-b bg-muted/10 shrink-0">
                        <button
                            type="button"
                            onClick={() => setActiveDoc(null)}
                            className="md:hidden flex items-center gap-1.5
                                       text-sm text-muted-foreground hover:text-foreground
                                       transition-colors"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Back
                        </button>

                        <DocIcon mimeType={activeDoc.mimeType} size="sm" />
                        <span className="text-sm font-semibold truncate flex-1">
                            {activeDoc.title}
                        </span>
                        <Badge variant="outline" className="text-xs shrink-0">
                            {mimeLabel(activeDoc.mimeType)}
                        </Badge>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 shrink-0"
                            onClick={() => window.open(activeDoc.webViewLink, '_blank')}
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open in Drive
                        </Button>
                    </div>

                    {/* Embedded editor */}
                    <div className="flex-1 relative bg-white dark:bg-neutral-900">
                        {!accessToken && (
                            <div className="absolute inset-0 z-10 flex flex-col
                                            items-center justify-center gap-4 bg-background/80
                                            backdrop-blur-sm">
                                <AlertTriangle className="h-8 w-8 text-amber-500" />
                                <p className="text-sm text-center text-muted-foreground max-w-xs">
                                    Connect your Google account to edit this document in the
                                    embedded viewer.
                                </p>
                                <Button
                                    size="sm"
                                    onClick={handleConnectGoogle}
                                    className="gap-2"
                                >
                                    <LogIn className="h-4 w-4" />
                                    Connect Google
                                </Button>
                                <p className="text-xs text-muted-foreground">
                                    Or{' '}
                                    <button
                                        type="button"
                                        className="underline hover:text-foreground"
                                        onClick={() => window.open(activeDoc.webViewLink, '_blank')}
                                    >
                                        open in Google Drive
                                    </button>
                                    {' '}to edit without connecting.
                                </p>
                            </div>
                        )}
                        <iframe
                            key={activeDoc.fileId}
                            src={getEmbedUrl(activeDoc.fileId, activeDoc.mimeType)}
                            className="w-full h-full border-0"
                            title={activeDoc.title}
                            allow="autoplay; camera; microphone"
                        />
                    </div>
                </div>
            ) : (
                /* Empty state when no doc selected (desktop) */
                <div className="hidden md:flex flex-1 items-center justify-center
                                bg-muted/10 text-muted-foreground">
                    <div className="text-center space-y-3">
                        <FileText className="h-16 w-16 opacity-15 mx-auto" />
                        <p className="text-sm">Select a document to open it here</p>
                        {accessToken && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setNewDocTitle('')
                                    setShowNewDialog(true)
                                }}
                                className="gap-2"
                            >
                                <Plus className="h-4 w-4" />
                                Create new document
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {/* ── New document dialog ── */}
            <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            Create New Document
                        </DialogTitle>
                        <DialogDescription>
                            The document will be created in the shared project folder
                            in your Google Drive.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Document type */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Document type</label>
                            <div className="grid grid-cols-3 gap-2">
                                {DOC_TYPES.map(({ type, label, icon, color }) => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setNewDocType(type)}
                                        className={`flex flex-col items-center gap-2 p-3 rounded-lg
                                                    border-2 text-xs font-medium transition-all
                                                    ${newDocType === type
                                                        ? 'border-primary bg-primary/5'
                                                        : 'border-border hover:border-muted-foreground/40'
                                                    }`}
                                    >
                                        <span className={color}>{icon}</span>
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Title input */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Title</label>
                            <Input
                                placeholder={
                                    newDocType === 'document'     ? 'e.g., Project Proposal' :
                                    newDocType === 'spreadsheet'  ? 'e.g., Budget Tracker' :
                                                                    'e.g., Pitch Deck'
                                }
                                value={newDocTitle}
                                onChange={e => setNewDocTitle(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && newDocTitle.trim()) handleCreate()
                                }}
                                autoFocus
                            />
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/20
                                        border border-blue-200 dark:border-blue-800
                                        rounded-lg p-3 flex items-start gap-2">
                            <FolderOpen className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-blue-700 dark:text-blue-300">
                                Will be saved to{' '}
                                <strong>{driveConfig?.folderName}</strong>
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowNewDialog(false)}
                            disabled={creating}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreate}
                            disabled={creating || !newDocTitle.trim()}
                        >
                            {creating ? (
                                <>
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                    Creating…
                                </>
                            ) : (
                                <>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Create
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Rename dialog ── */}
            <Dialog open={!!renamingDoc} onOpenChange={v => { if (!v) setRenamingDoc(null) }}>
                <DialogContent className="sm:max-w-[380px]">
                    <DialogHeader>
                        <DialogTitle>Rename Document</DialogTitle>
                    </DialogHeader>
                    <div className="py-2">
                        <Input
                            value={renameTitle}
                            onChange={e => setRenameTitle(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleRename() }}
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setRenamingDoc(null)}
                            disabled={renaming}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleRename}
                            disabled={renaming || !renameTitle.trim()}
                        >
                            {renaming ? 'Renaming…' : (
                                <><Check className="h-4 w-4 mr-2" />Save</>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

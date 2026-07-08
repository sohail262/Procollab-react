// Documents.tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
    FileText, Folder, Plus, Save, Search,
    MoreVertical, File, Image as ImageIcon, Download, Share2
} from 'lucide-react'
import {
    DropdownMenu, DropdownMenuContent,
    DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/hooks/use-auth'
import { useParams } from 'react-router-dom'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Doc {
    id: string
    title: string
    updatedAt: Date
    type: 'doc' | 'folder'
    content?: string
    createdBy: string
}

interface DocumentsProps {
    readOnly?: boolean
}

// ─── Firestore path ───────────────────────────────────────────────────────────
// projects/{projectId}/documents (collection)
//   fields: { title, type, content, createdBy, createdAt, updatedAt }

// ─── Rich Text Editor (unchanged — no Firebase needed here) ──────────────────
function Editor({
    content,
    onChange,
    readOnly = false,
}: {
    content: string
    onChange: (c: string) => void
    readOnly?: boolean
}) {
    const editorRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== content) {
            editorRef.current.innerHTML = content
        }
    }, [content])

    const handleInput = () => {
        if (editorRef.current) onChange(editorRef.current.innerHTML)
    }

    const handlePaste = async (e: React.ClipboardEvent) => {
        if (readOnly) return
        const items = e.clipboardData?.items
        if (!items) return

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                e.preventDefault()
                const blob = items[i].getAsFile()
                if (blob) {
                    const reader = new FileReader()
                    reader.onload = (ev) => {
                        const base64 = ev.target?.result as string
                        document.execCommand(
                            'insertHTML', false,
                            `<img src="${base64}" style="max-width:100%;height:auto;margin:10px 0;" />`
                        )
                        handleInput()
                    }
                    reader.readAsDataURL(blob)
                }
            }
        }
    }

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (ev) => {
            const base64 = ev.target?.result as string
            if (editorRef.current) {
                editorRef.current.focus()
                document.execCommand(
                    'insertHTML', false,
                    `<img src="${base64}" style="max-width:100%;height:auto;margin:10px 0;" />`
                )
                handleInput()
            }
        }
        reader.readAsDataURL(file)
    }

    return (
        <div className="h-full flex flex-col">
            {!readOnly && (
                <div className="border-b p-2 flex gap-2 bg-background">
                    <Button variant="outline" size="sm"
                        onClick={() => document.execCommand('bold')} title="Bold">
                        <strong>B</strong>
                    </Button>
                    <Button variant="outline" size="sm"
                        onClick={() => document.execCommand('italic')} title="Italic">
                        <em>I</em>
                    </Button>
                    <Button variant="outline" size="sm"
                        onClick={() => document.execCommand('underline')} title="Underline">
                        <u>U</u>
                    </Button>
                    <div className="border-l mx-2" />
                    <Button variant="outline" size="sm"
                        onClick={() => fileInputRef.current?.click()} title="Insert Image">
                        <ImageIcon className="h-4 w-4" />
                    </Button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                    />
                </div>
            )}
            <div
                ref={editorRef}
                contentEditable={!readOnly}
                onInput={handleInput}
                onPaste={handlePaste}
                className="flex-1 p-4 focus:outline-none overflow-auto bg-background text-foreground"
                style={{ minHeight: '500px' }}
                suppressContentEditableWarning
            />
        </div>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function Documents({ readOnly = false }: DocumentsProps) {
    const { id: projectId } = useParams()
    const { user } = useAuth()
    const { toast } = useToast()

    const [docs, setDocs] = useState<Doc[]>([])
    const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    // local draft while user types (avoids writing on every keystroke)
    const [draftContent, setDraftContent] = useState<string>('')

    // ── Realtime listener ────────────────────────────────────────────────────
    useEffect(() => {
        if (!projectId || !user) return

        const q = query(
            collection(db, 'projects', projectId, 'documents'),
            orderBy('updatedAt', 'desc')
        )

        const unsub = onSnapshot(
            q,
            (snap) => {
                const data = snap.docs.map(d => {
                    const raw = d.data()
                    return {
                        id: d.id,
                        title: raw.title ?? 'Untitled',
                        type: raw.type as 'doc' | 'folder',
                        content: raw.content ?? '',
                        createdBy: raw.createdBy ?? '',
                        updatedAt: raw.updatedAt instanceof Timestamp
                            ? raw.updatedAt.toDate()
                            : new Date(raw.updatedAt ?? Date.now()),
                    } as Doc
                })
                setDocs(data)
                setLoading(false)

                // Keep selectedDoc in sync with server changes
                setSelectedDoc(prev =>
                    prev ? (data.find(d => d.id === prev.id) ?? prev) : null
                )
            },
            (err) => {
                console.error('Documents listener error:', err)
                setLoading(false)
            }
        )

        return () => unsub()
    }, [projectId, user])

    // sync draft when a new doc is selected
    useEffect(() => {
        setDraftContent(selectedDoc?.content ?? '')
    }, [selectedDoc?.id])

    // ── Create document ──────────────────────────────────────────────────────
    const handleCreateDoc = async () => {
        if (!projectId || !user) return
        try {
            const ref = await addDoc(
                collection(db, 'projects', projectId, 'documents'),
                {
                    title: 'Untitled Document',
                    type: 'doc',
                    content: '',
                    createdBy: user.uid,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                }
            )
            // listener will update docs; pre-select the new doc
            setSelectedDoc({
                id: ref.id,
                title: 'Untitled Document',
                type: 'doc',
                content: '',
                createdBy: user.uid,
                updatedAt: new Date(),
            })
        } catch (err) {
            console.error('Failed to create document:', err)
            toast({ title: 'Error', description: 'Could not create document.', variant: 'destructive' })
        }
    }

    // ── Delete document ──────────────────────────────────────────────────────
    const handleDeleteDoc = async (docId: string) => {
        if (!projectId) return
        try {
            await deleteDoc(doc(db, 'projects', projectId, 'documents', docId))
            if (selectedDoc?.id === docId) setSelectedDoc(null)
            toast({ title: 'Document deleted' })
        } catch (err) {
            console.error('Failed to delete document:', err)
            toast({ title: 'Error', description: 'Could not delete document.', variant: 'destructive' })
        }
    }

    // ── Save (explicit save button) ──────────────────────────────────────────
    const handleSave = async () => {
        if (!selectedDoc || !projectId) return
        setSaving(true)
        try {
            await updateDoc(
                doc(db, 'projects', projectId, 'documents', selectedDoc.id),
                {
                    content: draftContent,
                    title: selectedDoc.title,
                    updatedAt: serverTimestamp(),
                }
            )
            toast({ title: 'Document saved', description: 'Your changes have been saved.' })
        } catch (err) {
            console.error('Failed to save document:', err)
            toast({ title: 'Error', description: 'Could not save document.', variant: 'destructive' })
        } finally {
            setSaving(false)
        }
    }

    // ── Title change ─────────────────────────────────────────────────────────
    // Debounce title updates to avoid hammering Firestore
    const titleDebounce = useRef<any>(null)

    const handleTitleChange = (title: string) => {
        if (!selectedDoc) return
        const updated = { ...selectedDoc, title }
        setSelectedDoc(updated)
        setDocs(prev => prev.map(d => d.id === selectedDoc.id ? updated : d))

        clearTimeout(titleDebounce.current)
        titleDebounce.current = setTimeout(async () => {
            if (!projectId) return
            try {
                await updateDoc(
                    doc(db, 'projects', projectId, 'documents', selectedDoc.id),
                    { title, updatedAt: serverTimestamp() }
                )
            } catch (err) {
                console.error('Failed to update title:', err)
            }
        }, 800)
    }

    // ── Export PDF ───────────────────────────────────────────────────────────
    const handleExportPDF = () => {
        if (!selectedDoc) return
        const printWindow = window.open('', '_blank')
        if (printWindow) {
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${selectedDoc.title}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 40px;
                               max-width: 800px; margin: 0 auto; }
                        h1   { color: #333; }
                        img  { max-width: 100%; height: auto; }
                    </style>
                </head>
                <body>
                    <h1>${selectedDoc.title}</h1>
                    <div>${draftContent}</div>
                </body>
                </html>
            `)
            printWindow.document.close()
            printWindow.print()
        }
        toast({ title: 'Export to PDF', description: "Use 'Save as PDF' in the print dialog." })
    }

    // ── Share (copy plain text) ──────────────────────────────────────────────
    const handleShare = () => {
        if (!selectedDoc) return
        const text = draftContent.replace(/<[^>]*>/g, '')
        navigator.clipboard.writeText(text).then(() => {
            toast({ title: 'Copied', description: 'Document content copied to clipboard.' })
        })
    }

    // ── Filtered list ────────────────────────────────────────────────────────
    const filteredDocs = docs.filter(d =>
        d.title.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // ── Loading skeleton ─────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="h-full grid grid-cols-12 gap-6">
                <div className="col-span-3 space-y-2 p-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-8 w-full" />)}
                </div>
                <div className="col-span-9">
                    <Skeleton className="h-full w-full" />
                </div>
            </div>
        )
    }

    return (
        <div className="h-full grid grid-cols-12 gap-6">

            {/* ── Sidebar ── */}
            <Card className="col-span-3 h-full flex flex-col">
                <CardHeader className="p-4 border-b">
                    <div className="flex items-center justify-between mb-4">
                        <CardTitle className="text-lg">Documents</CardTitle>
                        {!readOnly && (
                            <Button size="icon" variant="ghost" onClick={handleCreateDoc}>
                                <Plus className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search docs..."
                            className="pl-8"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent className="flex-1 p-0 overflow-hidden">
                    <ScrollArea className="h-full">
                        <div className="flex flex-col p-2 gap-1">
                            {filteredDocs.length === 0 && (
                                <p className="text-xs text-muted-foreground text-center py-6">
                                    {searchQuery ? 'No results found.' : 'No documents yet.'}
                                </p>
                            )}
                            {filteredDocs.map(d => (
                                <button
                                    key={d.id}
                                    onClick={() => setSelectedDoc(d)}
                                    className={`flex items-center gap-3 p-2 rounded-md transition-colors
                                        text-sm text-left ${selectedDoc?.id === d.id
                                            ? 'bg-primary/10 text-primary font-medium'
                                            : 'hover:bg-muted'
                                        }`}
                                >
                                    {d.type === 'folder'
                                        ? <Folder className="h-4 w-4 text-blue-500 shrink-0" />
                                        : <FileText className="h-4 w-4 text-gray-500 shrink-0" />
                                    }
                                    <span className="truncate flex-1">{d.title}</span>
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>

            {/* ── Editor Area ── */}
            <Card className="col-span-9 h-full flex flex-col">
                {selectedDoc ? (
                    <>
                        <CardHeader className="p-4 border-b flex flex-row items-center justify-between">
                            <div className="flex-1">
                                <Input
                                    value={selectedDoc.title}
                                    onChange={(e) => handleTitleChange(e.target.value)}
                                    readOnly={readOnly}
                                    className="text-lg font-semibold border-none shadow-none
                                               focus-visible:ring-0 px-0"
                                />
                                <CardDescription className="text-xs mt-1">
                                    Last edited {selectedDoc.updatedAt.toLocaleString()}
                                </CardDescription>
                            </div>
                            <div className="flex gap-2">
                                {!readOnly && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleSave}
                                        disabled={saving}
                                    >
                                        <Save className="h-4 w-4 mr-2" />
                                        {saving ? 'Saving…' : 'Save'}
                                    </Button>
                                )}
                                <Button variant="outline" size="sm" onClick={handleShare}>
                                    <Share2 className="h-4 w-4 mr-2" />
                                    Share
                                </Button>
                                <Button variant="outline" size="sm" onClick={handleExportPDF}>
                                    <Download className="h-4 w-4 mr-2" />
                                    Export PDF
                                </Button>
                                {!readOnly && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                                onClick={() => handleDeleteDoc(selectedDoc.id)}
                                                className="text-destructive"
                                            >
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 p-0 overflow-hidden">
                            {selectedDoc.type === 'doc' ? (
                                <Editor
                                    content={draftContent}
                                    onChange={setDraftContent}
                                    readOnly={readOnly}
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center
                                                h-full text-muted-foreground">
                                    <Folder className="h-16 w-16 mb-4 opacity-20" />
                                    <p>Select a document to view contents</p>
                                </div>
                            )}
                        </CardContent>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <File className="h-16 w-16 mb-4 opacity-20" />
                        <h3 className="text-lg font-medium mb-2">No Document Selected</h3>
                        <p>Select a document from the sidebar or create a new one</p>
                        {!readOnly && (
                            <Button className="mt-4" variant="outline" onClick={handleCreateDoc}>
                                <Plus className="h-4 w-4 mr-2" />
                                Create New Document
                            </Button>
                        )}
                    </div>
                )}
            </Card>
        </div>
    )
}
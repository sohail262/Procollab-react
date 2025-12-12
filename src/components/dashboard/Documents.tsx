import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileText, Folder, Plus, Save, Search, MoreVertical, File, Image as ImageIcon, Download, Share2 } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'

// Rich text editor with image support
function Editor({ content, onChange }: { content: string, onChange: (content: string) => void }) {
    const editorRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== content) {
            editorRef.current.innerHTML = content;
        }
    }, [content]);

    const handleInput = () => {
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                e.preventDefault();
                const blob = items[i].getAsFile();
                if (blob) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const base64 = event.target?.result as string;
                        // Insert image at cursor position
                        document.execCommand('insertHTML', false, `<img src="${base64}" style="max-width: 100%; height: auto; margin: 10px 0;" />`);
                        handleInput();
                    };
                    reader.readAsDataURL(blob);
                }
            }
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target?.result as string;
                if (editorRef.current) {
                    editorRef.current.focus();
                    document.execCommand('insertHTML', false, `<img src="${base64}" style="max-width: 100%; height: auto; margin: 10px 0;" />`);
                    handleInput();
                }
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="h-full flex flex-col">
            <div className="border-b p-2 flex gap-2 bg-background">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.execCommand('bold')}
                    title="Bold"
                >
                    <strong>B</strong>
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.execCommand('italic')}
                    title="Italic"
                >
                    <em>I</em>
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.execCommand('underline')}
                    title="Underline"
                >
                    <u>U</u>
                </Button>
                <div className="border-l mx-2" />
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    title="Insert Image"
                >
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
            <div
                ref={editorRef}
                contentEditable
                onInput={handleInput}
                onPaste={handlePaste}
                className="flex-1 p-4 focus:outline-none overflow-auto bg-background text-foreground"
                style={{ minHeight: '500px' }}
                suppressContentEditableWarning
            />
        </div>
    );
}

interface Doc {
    id: string
    title: string
    updatedAt: Date
    type: 'doc' | 'folder'
    content?: string
}

interface DocumentsProps {
    readOnly?: boolean
}

export function Documents({ readOnly: _readOnly = false }: DocumentsProps) {
    const { toast } = useToast();
    const [docs, setDocs] = useState<Doc[]>(() => {
        const saved = localStorage.getItem('procollab-docs');
        if (saved) {
            try {
                return JSON.parse(saved).map((d: any) => ({
                    ...d,
                    updatedAt: new Date(d.updatedAt)
                }));
            } catch (e) {
                console.error("Failed to parse docs from local storage", e);
            }
        }
        return [];
    });
    const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null)
    const [searchQuery, setSearchQuery] = useState('')

    // Save to local storage whenever docs change
    useEffect(() => {
        localStorage.setItem('procollab-docs', JSON.stringify(docs));
    }, [docs]);

    const handleCreateDoc = () => {
        const newDoc: Doc = {
            id: Date.now().toString(),
            title: 'Untitled Document',
            type: 'doc',
            updatedAt: new Date(),
            content: ''
        };
        const updatedDocs = [...docs, newDoc];
        setDocs(updatedDocs);
        setSelectedDoc(newDoc);
    };

    const handleDeleteDoc = (docId: string) => {
        const updatedDocs = docs.filter(d => d.id !== docId);
        setDocs(updatedDocs);
        if (selectedDoc?.id === docId) {
            setSelectedDoc(null);
        }
        toast({
            title: "Document deleted",
            description: "The document has been removed."
        });
    };

    const handleUpdateDocContent = (content: string) => {
        if (!selectedDoc) return;

        const updatedDoc = { ...selectedDoc, content, updatedAt: new Date() };
        const updatedDocs = docs.map(d =>
            d.id === selectedDoc.id ? updatedDoc : d
        );

        setDocs(updatedDocs);
        setSelectedDoc(updatedDoc);
    };

    const handleSave = () => {
        if (!selectedDoc) return;

        const updatedDoc = { ...selectedDoc, updatedAt: new Date() };
        const updatedDocs = docs.map(d =>
            d.id === selectedDoc.id ? updatedDoc : d
        );
        setDocs(updatedDocs);
        setSelectedDoc(updatedDoc);

        toast({
            title: "Document saved",
            description: "Your changes have been saved successfully."
        });
    };

    const handleExportPDF = () => {
        if (!selectedDoc) return;

        // Create a printable version
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${selectedDoc.title}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
                        h1 { color: #333; }
                        img { max-width: 100%; height: auto; }
                    </style>
                </head>
                <body>
                    <h1>${selectedDoc.title}</h1>
                    <div>${selectedDoc.content || ''}</div>
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
        }

        toast({
            title: "Export to PDF",
            description: "Print dialog opened. Use 'Save as PDF' option."
        });
    };

    const handleShare = () => {
        if (!selectedDoc) return;

        // Copy document content to clipboard
        const textContent = selectedDoc.content?.replace(/<[^>]*>/g, '') || '';
        navigator.clipboard.writeText(textContent).then(() => {
            toast({
                title: "Content copied",
                description: "Document content copied to clipboard for sharing."
            });
        });
    };

    const filteredDocs = docs.filter(doc =>
        doc.title.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="h-[calc(100vh-12rem)] grid grid-cols-12 gap-6">
            {/* Sidebar */}
            <Card className="col-span-3 h-full flex flex-col">
                <CardHeader className="p-4 border-b">
                    <div className="flex items-center justify-between mb-4">
                        <CardTitle className="text-lg">Documents</CardTitle>
                        <Button size="icon" variant="ghost" onClick={handleCreateDoc}>
                            <Plus className="h-4 w-4" />
                        </Button>
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
                            {filteredDocs.map(doc => (
                                <button
                                    key={doc.id}
                                    onClick={() => setSelectedDoc(doc)}
                                    className={`flex items-center gap-3 p-2 rounded-md transition-colors text-sm text-left ${selectedDoc?.id === doc.id
                                        ? 'bg-primary/10 text-primary font-medium'
                                        : 'hover:bg-muted'
                                        }`}
                                >
                                    {doc.type === 'folder' ? (
                                        <Folder className="h-4 w-4 text-blue-500" />
                                    ) : (
                                        <FileText className="h-4 w-4 text-gray-500" />
                                    )}
                                    <span className="truncate flex-1">{doc.title}</span>
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>

            {/* Editor Area */}
            <Card className="col-span-9 h-full flex flex-col">
                {selectedDoc ? (
                    <>
                        <CardHeader className="p-4 border-b flex flex-row items-center justify-between">
                            <div className="flex-1">
                                <Input
                                    value={selectedDoc.title}
                                    onChange={(e) => {
                                        const updatedDoc = { ...selectedDoc, title: e.target.value };
                                        setSelectedDoc(updatedDoc);
                                        setDocs(docs.map(d => d.id === selectedDoc.id ? updatedDoc : d));
                                    }}
                                    className="text-lg font-semibold border-none shadow-none focus-visible:ring-0 px-0"
                                />
                                <CardDescription className="text-xs mt-1">
                                    Last edited {selectedDoc.updatedAt.toLocaleString()}
                                </CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={handleSave}>
                                    <Save className="h-4 w-4 mr-2" />
                                    Save
                                </Button>
                                <Button variant="outline" size="sm" onClick={handleShare}>
                                    <Share2 className="h-4 w-4 mr-2" />
                                    Share
                                </Button>
                                <Button variant="outline" size="sm" onClick={handleExportPDF}>
                                    <Download className="h-4 w-4 mr-2" />
                                    Export PDF
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleDeleteDoc(selectedDoc.id)} className="text-destructive">
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 p-0 overflow-hidden">
                            {selectedDoc.type === 'doc' ? (
                                <Editor
                                    content={selectedDoc.content || ''}
                                    onChange={handleUpdateDocContent}
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
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
                        <Button className="mt-4" variant="outline" onClick={handleCreateDoc}>
                            <Plus className="h-4 w-4 mr-2" />
                            Create New Document
                        </Button>
                    </div>
                )}
            </Card>
        </div>
    )
}

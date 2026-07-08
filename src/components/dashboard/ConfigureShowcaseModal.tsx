import { useState, useEffect } from 'react'
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
    Briefcase, Link, Github, ExternalLink, Sparkles,
    Plus, Trash2, Check, Loader2, Target, HelpCircle, Clock
} from 'lucide-react'

interface ConfigureShowcaseModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    projectId: string
    onSaved?: () => void
}

export function ConfigureShowcaseModal({
    open,
    onOpenChange,
    projectId,
    onSaved
}: ConfigureShowcaseModalProps) {
    const { toast } = useToast()
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    // Form fields
    const [summary, setSummary] = useState('')
    const [problemStatement, setProblemStatement] = useState('')
    const [duration, setDuration] = useState('')
    const [githubLink, setGithubLink] = useState('')
    const [liveLink, setLiveLink] = useState('')
    const [techStackInput, setTechStackInput] = useState('')
    const [keyOutcomes, setKeyOutcomes] = useState<string[]>([])
    const [newOutcome, setNewOutcome] = useState('')

    // Fetch existing values when modal opens
    useEffect(() => {
        if (!open || !projectId) return

        async function fetchProjectData() {
            setLoading(true)
            try {
                const docRef = doc(db, 'projects', projectId)
                const snap = await getDoc(docRef)
                if (snap.exists()) {
                    const data = snap.data()
                    setSummary(data.summary || '')
                    setProblemStatement(data.problemStatement || '')
                    setDuration(data.duration || '')
                    setGithubLink(data.githubLink || '')
                    setLiveLink(data.liveLink || '')
                    setKeyOutcomes(data.keyOutcomes || [])
                    
                    // Fallback to tags if techStack is empty
                    const tech = data.techStack || data.tags || []
                    setTechStackInput(tech.join(', '))
                }
            } catch (err) {
                console.error('Error fetching showcase config:', err)
                toast({
                    title: 'Error',
                    description: 'Failed to load showcase configuration data.',
                    variant: 'destructive'
                })
            } finally {
                setLoading(false)
            }
        }

        fetchProjectData()
    }, [open, projectId])

    // Outcome additions
    const handleAddOutcome = () => {
        if (!newOutcome.trim()) return
        if (keyOutcomes.includes(newOutcome.trim())) {
            toast({ description: 'This outcome is already added.' })
            return
        }
        setKeyOutcomes([...keyOutcomes, newOutcome.trim()])
        setNewOutcome('')
    }

    const handleRemoveOutcome = (idx: number) => {
        setKeyOutcomes(keyOutcomes.filter((_, i) => i !== idx))
    }

    // Save configuration
    const handleSave = async () => {
        setSaving(true)
        try {
            const projectRef = doc(db, 'projects', projectId)
            const techStack = techStackInput
                .split(',')
                .map(t => t.trim())
                .filter(Boolean)

            await updateDoc(projectRef, {
                summary: summary.trim(),
                problemStatement: problemStatement.trim(),
                duration: duration.trim(),
                githubLink: githubLink.trim(),
                liveLink: liveLink.trim(),
                keyOutcomes,
                techStack
            })

            toast({
                title: 'Showcase Configured!',
                description: 'Public showcase details updated successfully.',
            })

            if (onSaved) onSaved()
            onOpenChange(false)
        } catch (err) {
            console.error('Error saving showcase details:', err)
            toast({
                title: 'Save Failed',
                description: 'Unable to update showcase details in Firestore.',
                variant: 'destructive'
            })
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl bg-zinc-950 border border-zinc-800 text-white rounded-xl shadow-2xl p-6 overflow-y-auto max-h-[90vh] selection:bg-zinc-850">
                <DialogHeader className="border-b border-zinc-805 pb-4">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2 text-white">
                        <Sparkles className="h-5 w-5 text-violet-400" />
                        Configure Recruiter Showcase
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400 text-sm mt-1">
                        Enhance your public project URL with structured data. Help recruiters evaluate your contribution, problem-solving skills, and tech outcomes.
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-violet-400 mb-2" />
                        <p className="text-xs text-zinc-500">Loading current showcase data...</p>
                    </div>
                ) : (
                    <div className="space-y-5 py-4">
                        {/* Tagline / Summary */}
                        <div className="space-y-1.5">
                            <Label htmlFor="summary" className="text-xs font-bold text-zinc-300 uppercase tracking-wide">
                                Project Tagline / One-Liner
                            </Label>
                            <Input
                                id="summary"
                                value={summary}
                                onChange={(e) => setSummary(e.target.value)}
                                placeholder='e.g., "A high-performance real-time messaging engine built with WebSockets and Go."'
                                className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder-zinc-500 text-sm focus:ring-1 focus:ring-violet-500 focus:border-violet-500"
                            />
                            <p className="text-[10px] text-zinc-500 leading-snug">
                                Summarizes the core technical outcome. Placed in quotes at the top of the showcase.
                            </p>
                        </div>

                        {/* Problem Statement */}
                        <div className="space-y-1.5">
                            <Label htmlFor="problem" className="text-xs font-bold text-zinc-300 uppercase tracking-wide">
                                Problem Statement & Challenge
                            </Label>
                            <Textarea
                                id="problem"
                                value={problemStatement}
                                onChange={(e) => setProblemStatement(e.target.value)}
                                placeholder="Describe the business/technical challenge your team had to solve. (e.g. Lack of real-time collaboration led to fragmented file updates...)"
                                className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder-zinc-500 text-sm min-h-[90px] focus:ring-1 focus:ring-violet-500 focus:border-violet-500"
                            />
                        </div>

                        {/* Links and duration row */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="duration" className="text-xs font-bold text-zinc-300 uppercase tracking-wide flex items-center gap-1.5 h-5">
                                    <Clock className="h-3 w-3 text-zinc-400" /> Project Duration
                                </Label>
                                <Input
                                    id="duration"
                                    value={duration}
                                    onChange={(e) => setDuration(e.target.value)}
                                    placeholder='e.g., "3 Months", "Ongoing"'
                                    className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder-zinc-500 text-sm h-10"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="github" className="text-xs font-bold text-zinc-300 uppercase tracking-wide flex items-center gap-1.5 h-5">
                                    <Github className="h-3 w-3 text-zinc-400" /> GitHub Repository
                                </Label>
                                <Input
                                    id="github"
                                    value={githubLink}
                                    onChange={(e) => setGithubLink(e.target.value)}
                                    placeholder="https://github.com/..."
                                    className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder-zinc-500 text-sm h-10"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="live" className="text-xs font-bold text-zinc-300 uppercase tracking-wide flex items-center gap-1.5 h-5">
                                    <ExternalLink className="h-3 w-3 text-zinc-400" /> Live Demo URL
                                </Label>
                                <Input
                                    id="live"
                                    value={liveLink}
                                    onChange={(e) => setLiveLink(e.target.value)}
                                    placeholder="https://my-app.vercel.app"
                                    className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder-zinc-500 text-sm h-10"
                                />
                            </div>
                        </div>

                        {/* Tech Stack Tags */}
                        <div className="space-y-1.5">
                            <Label htmlFor="tech" className="text-xs font-bold text-zinc-300 uppercase tracking-wide">
                                Tech Stack & Skills
                            </Label>
                            <Input
                                id="tech"
                                value={techStackInput}
                                onChange={(e) => setTechStackInput(e.target.value)}
                                placeholder="React, Node.js, WebSockets, Tailwind CSS, Firestore"
                                className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder-zinc-500 text-sm"
                            />
                            <p className="text-[10px] text-zinc-500 leading-snug">
                                Comma-separated list of technologies. Used to construct the skills panel.
                            </p>
                        </div>

                        {/* Key Outcomes dynamic editor */}
                        <div className="space-y-2.5">
                            <Label className="text-xs font-bold text-zinc-300 uppercase tracking-wide">
                                Key Outcomes & Metrics (STAR Method Results)
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    value={newOutcome}
                                    onChange={(e) => setNewOutcome(e.target.value)}
                                    placeholder='e.g., "Reduced initial page load latency by 45% via code splitting"'
                                    className="flex-1 bg-zinc-900 border-zinc-800 text-zinc-100 placeholder-zinc-500 text-sm"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault()
                                            handleAddOutcome()
                                        }
                                    }}
                                />
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={handleAddOutcome}
                                    className="bg-violet-600 hover:bg-violet-700 text-white flex items-center gap-1 px-3"
                                >
                                    <Plus className="h-4 w-4" /> Add
                                </Button>
                            </div>

                            {/* Added outcomes list */}
                            {keyOutcomes.length > 0 ? (
                                <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                                    {keyOutcomes.map((outcome, idx) => (
                                        <div key={idx} className="flex items-start justify-between gap-3 p-2.5 rounded-lg bg-zinc-900/50 border border-zinc-800/80 hover:bg-zinc-900 transition-colors">
                                            <p className="text-xs text-zinc-300 leading-relaxed pr-2">✦ {outcome}</p>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveOutcome(idx)}
                                                className="text-zinc-500 hover:text-red-400 p-0.5 transition-colors shrink-0"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-4 border border-dashed border-zinc-800 rounded-lg text-center text-xs text-zinc-500">
                                    No outcomes added. Bullet points showcasing hard numbers or milestones stand out most to recruiters.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <DialogFooter className="border-t border-zinc-800 pt-4 flex gap-2 sm:justify-end w-full">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="text-zinc-400 hover:text-white"
                        disabled={saving}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="bg-violet-600 hover:bg-violet-700 text-white font-semibold flex items-center gap-1.5"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Check className="h-4 w-4" />
                                Save Showcase Info
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

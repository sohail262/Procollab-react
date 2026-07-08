import { useState } from 'react'
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Check, Copy, Share2, ClipboardList, Linkedin, ExternalLink, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface ProjectCompletionModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    projectId: string
    projectTitle: string
    projectSummary?: string
    completedTaskCount: number
    teamMemberCount: number
    onNavigateToReviews?: () => void
    onEditShowcase?: () => void
    completedTasksList?: string[]
    primaryDiscipline?: string
    tags?: string[]
    activityVerified?: boolean
}

export function ProjectCompletionModal({
    open,
    onOpenChange,
    projectId,
    projectTitle,
    projectSummary = 'Collaboratively built application.',
    completedTaskCount,
    teamMemberCount,
    onNavigateToReviews,
    onEditShowcase,
    completedTasksList = [],
    primaryDiscipline = 'Software Development',
    tags = [],
    activityVerified = false,
}: ProjectCompletionModalProps) {
    const { toast } = useToast()
    const [copiedLink, setCopiedLink] = useState(false)
    const [copiedLinkedin, setCopiedLinkedin] = useState(false)
    const [copiedSTAR, setCopiedSTAR] = useState(false)

    const publicUrl = `${window.location.origin}/project/public/${projectId}`

    const tasksPart = completedTasksList.length > 0
        ? completedTasksList.slice(0, 3).join(', ')
        : 'key functional features'

    // Pre-composed LinkedIn post
    const linkedinTemplate = `Thrilled to announce the completion of our latest project: "${projectTitle}" on ProCollab. 

Over the course of this ${primaryDiscipline} collaboration, our team of ${teamMemberCount} members successfully delivered ${completedTaskCount} tasks. Personally, I was responsible for delivering tasks such as: ${tasksPart}.

You can view our full project showcase, contribution breakdown, and verified deliverables here: ${publicUrl}

#${primaryDiscipline.replace(/\s+/g, '')} ${tags.map(t => `#${t.replace(/[^a-zA-Z0-9]/g, '')}`).slice(0, 3).join(' ')}`

    // Pre-composed STAR resume case study
    const starResumeTemplate = `Project: ${projectTitle} (${primaryDiscipline} Portfolio)
- Situation: Needed to collaborate within a team of ${teamMemberCount} professionals to design, manage, and execute a complex software project using ${tags.slice(0, 4).join(', ')}.
- Task: Acted as a core collaborator to successfully deliver task backlogs and coordinate milestones.
- Action: Authored key tasks, collaborated via sprint trackers, and completed critical deliverables: ${completedTasksList.slice(0, 4).join('; ') || 'core features'}.
- Result: Successfully finalized the project, completing ${completedTasksList.length} user-specific deliverables within a total backlog of ${completedTaskCount} project tasks, verified by public portfolio analytics.`

    const handleCopy = async (text: string, setCopiedFlag: (flag: boolean) => void, toastMsg: string) => {
        try {
            await navigator.clipboard.writeText(text)
            setCopiedFlag(true)
            toast({ title: toastMsg })
            setTimeout(() => setCopiedFlag(false), 2000)
        } catch (err) {
            console.error('Failed to copy text:', err)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl p-6 overflow-y-auto max-h-[90vh]">
                <DialogHeader className="border-b border-zinc-808 pb-4">
                    <DialogTitle className="text-xl font-extrabold text-white flex items-center gap-2">
                        <Check className="h-5 w-5 text-emerald-500 stroke-[3px]" />
                        Project Completed!
                    </DialogTitle>
                    <DialogDescription className="text-sm text-zinc-400 mt-1.5">
                        Congratulations on delivering "{projectTitle}"! Here are the professional materials generated for your resume and portfolio showcase.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Verification Trust Badge */}
                    {activityVerified ? (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-start gap-3 mb-2">
                            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wide">Activity Verified Work</h4>
                                <p className="text-[11px] text-zinc-450 mt-0.5 leading-snug">
                                    This project meets ProCollab's verification standards: multiple collaborators present and at least 10 completed deliverables. This grants you the <strong>Verified Deliverer</strong> badge.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-start gap-3 mb-2">
                            <AlertTriangle className="h-5 w-5 text-zinc-500 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wide">Sandbox Collaboration</h4>
                                <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                                    This project has not met the verification threshold (requires at least 2 team members and 10 finished tasks). Deliverables remain unverified.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Shareable Public Portfolio Link */}
                    <div className="space-y-2">
                        <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wide flex items-center gap-1.5">
                            <Share2 className="h-3.5 w-3.5 text-zinc-500" />
                            Recruiter-Ready Public Portfolio Link
                        </h4>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                readOnly
                                value={publicUrl}
                                className="flex-1 bg-zinc-900 border border-zinc-808 rounded-lg px-3 py-2 text-xs font-mono text-zinc-300"
                            />
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCopy(publicUrl, setCopiedLink, 'Link copied to clipboard')}
                                className="h-9 px-3 flex items-center gap-1 border-zinc-808 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white"
                            >
                                {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                                <span className="text-xs">Copy</span>
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => window.open(publicUrl, '_blank')}
                                className="h-9 px-3 flex items-center gap-1 bg-violet-600 hover:bg-violet-700 text-white border-0"
                            >
                                <ExternalLink className="h-3.5 w-3.5" />
                                <span className="text-xs">View</span>
                            </Button>
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-1 leading-snug">
                            This public URL displays contribution graphs and completed deliverables. Share it on your resume or email it to recruiters.
                        </p>
                    </div>

                    {/* Resume Case Study Builder (STAR Method) */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wide flex items-center gap-1.5">
                                <ClipboardList className="h-3.5 w-3.5 text-zinc-500" />
                                Resume STAR Template
                            </h4>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleCopy(starResumeTemplate, setCopiedSTAR, 'STAR template copied')}
                                className="h-6 text-xs text-zinc-400 hover:text-white flex items-center gap-1 p-1 hover:bg-transparent"
                            >
                                {copiedSTAR ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                                Copy STAR text
                            </Button>
                        </div>
                        <div className="bg-zinc-900 border border-zinc-808 rounded-lg p-3 text-xs font-mono leading-relaxed text-zinc-300 select-text whitespace-pre-wrap max-h-36 overflow-y-auto">
                            {starResumeTemplate}
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-snug">
                            Format details optimized for recruiters screening candidate portfolios.
                        </p>
                    </div>

                    {/* LinkedIn Share Update */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wide flex items-center gap-1.5">
                                <Linkedin className="h-3.5 w-3.5 text-zinc-500" />
                                LinkedIn Share Template
                            </h4>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleCopy(linkedinTemplate, setCopiedLinkedin, 'LinkedIn post copied')}
                                className="h-6 text-xs text-zinc-400 hover:text-white flex items-center gap-1 p-1 hover:bg-transparent"
                            >
                                {copiedLinkedin ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                                Copy Post
                            </Button>
                        </div>
                        <div className="bg-zinc-900 border border-zinc-808 rounded-lg p-3 text-xs font-mono leading-relaxed text-zinc-300 select-text whitespace-pre-wrap max-h-36 overflow-y-auto">
                            {linkedinTemplate}
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-1.5 leading-snug">
                            Tip: You can copy this template and feed it to any LLM along with your project details to customize a highly engaging, personalized post!
                        </p>
                    </div>

                </div>

                <DialogFooter className="border-t border-zinc-800 pt-4 flex sm:justify-between items-center w-full">
                    <div className="flex gap-2">
                        {onNavigateToReviews && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    onOpenChange(false)
                                    onNavigateToReviews()
                                }}
                                className="text-xs border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20 text-amber-700 dark:text-amber-400"
                            >
                                Rate Teammates & Peers
                            </Button>
                        )}
                        {onEditShowcase && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    onOpenChange(false)
                                    onEditShowcase()
                                }}
                                className="text-xs border-violet-300 dark:border-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950/20 text-violet-750 dark:text-violet-400 flex items-center gap-1"
                            >
                                <Sparkles className="h-3.5 w-3.5" />
                                Edit Showcase Info
                            </Button>
                        )}
                    </div>
                    <Button
                        type="button"
                        onClick={() => onOpenChange(false)}
                    >
                        Done
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// src/components/dashboard/TemplateGallery.tsx
import { useState, useEffect } from 'react'
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button }     from '@/components/ui/button'
import { Badge }      from '@/components/ui/badge'
import { Input }      from '@/components/ui/input'
import { Textarea }   from '@/components/ui/textarea'
import { Label }      from '@/components/ui/label'
import { Progress }   from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator }  from '@/components/ui/separator'
import { DatePicker } from '@/components/ui/date-time-picker'
import {
    Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs'
import {
    Select, SelectContent,
    SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Switch }  from '@/components/ui/switch'
import {
    AlertTriangle, ArrowLeft, ArrowRight,
    CheckCircle2,  FileText,   Loader2,
    Search,        Clock,      BarChart3,
    Trash2,        Users,      Target,
    Sparkles,      Plus,       Pencil,
    X,             Flag,       FolderOpen,
    CloudUpload,
} from 'lucide-react'
import {
    PROJECT_TEMPLATES,
    TEMPLATE_CATEGORIES,
    type ProjectTemplate,
    type TemplateCategory,
    type TemplateTask,
    type TemplateMilestone,
} from '@/config/projectTemplates'
import {
    collection, addDoc, doc, getDocs,
    serverTimestamp, writeBatch,
    updateDoc, deleteDoc, query,
    getCountFromServer, getDoc,
} from 'firebase/firestore'
import { db }       from '@/lib/firebase'
import { useAuth }  from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TemplateGalleryProps {
    open:        boolean
    onClose:     () => void
    projectId:   string
    projectName: string   // current project name passed in
    onApplied:   (updatedName: string) => void
}

// Step 2 — project setup form
interface ProjectSetupForm {
    name:          string
    description:   string
    goal:          string
    startDate:     string
    teamSize:      string
    discipline:    string
}

// Step 3 — template-specific parameters (tech/sprint config)
interface TemplateParams {
    techStack:       string
    repositoryUrl:   string
    sprintDuration:  string
    storyPointScale: string
    researchField:   string
    campaignBudget:  string
    supervisorName:  string
    submissionDate:  string
    university:      string
    designTool:      string
}

// Editable task row (inherits TemplateTask)
interface EditableTask extends TemplateTask {
    _id: string // local key
}

// Editable milestone row
interface EditableMilestone extends TemplateMilestone {
    _id: string
}

// Step 4 — existing data counts
interface ExistingDataCounts {
    tasks:     number
    documents: number
    sprints:   number
}

const DIFFICULTY_COLORS: Record<string, string> = {
    beginner:     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    intermediate: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    advanced:     'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const PRIORITY_COLORS: Record<string, string> = {
    urgent: 'bg-red-500',
    high:   'bg-orange-400',
    medium: 'bg-blue-400',
    low:    'bg-green-400',
}

type Step = 1 | 2 | 3 | 4 | 5

let _eid = 0
const eid = () => `e_${++_eid}`

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepIndicator({
    current, total, labels,
}: {
    current: Step; total: number; labels: string[]
}) {
    return (
        <div className="flex items-center gap-0 mb-6">
            {labels.map((label, i) => {
                const stepNum = (i + 1) as Step
                const isDone    = current > stepNum
                const isActive  = current === stepNum
                return (
                    <div key={i} className="flex items-center flex-1 last:flex-none">
                        <div className="flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center
                                justify-center text-sm font-semibold transition-all ${
                                isDone   ? 'bg-green-500 text-white' :
                                isActive ? 'bg-primary text-primary-foreground' :
                                           'bg-muted text-muted-foreground'
                            }`}>
                                {isDone
                                    ? <CheckCircle2 className="h-4 w-4" />
                                    : stepNum}
                            </div>
                            <span className={`text-xs mt-1 whitespace-nowrap ${
                                isActive
                                    ? 'text-primary font-medium'
                                    : 'text-muted-foreground'
                            }`}>
                                {label}
                            </span>
                        </div>
                        {i < labels.length - 1 && (
                            <div className={`flex-1 h-0.5 mx-2 mb-4 transition-all ${
                                current > stepNum ? 'bg-green-500' : 'bg-muted'
                            }`} />
                        )}
                    </div>
                )
            })}
        </div>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function TemplateGallery({
    open, onClose, projectId, projectName, onApplied,
}: TemplateGalleryProps) {
    const { user }  = useAuth()
    const { toast } = useToast()

    // ── Navigation state ─────────────────────────────────────────────────────
    const [step,    setStep]    = useState<Step>(1)
    const [applying, setApplying] = useState(false)
    const [applied,  setApplied]  = useState(false)
    const [applyProgress, setApplyProgress] = useState(0)
    const [applyStatus,   setApplyStatus]   = useState('')

    // ── Step 1 — browse ──────────────────────────────────────────────────────
    const [search,   setSearch]   = useState('')
    const [category, setCategory] = useState<TemplateCategory | 'all'>('all')
    const [selected, setSelected] = useState<ProjectTemplate | null>(null)

    // ── Step 2 — project setup ───────────────────────────────────────────────
    const [setupForm, setSetupForm] = useState<ProjectSetupForm>({
        name:        projectName,
        description: '',
        goal:        '',
        startDate:   new Date().toISOString().split('T')[0],
        teamSize:    '1',
        discipline:  '',
    })

    // ── Step 3 — editable customisation ─────────────────────────────────────
    const [editableTasks,      setEditableTasks]      = useState<EditableTask[]>([])
    const [editableMilestones, setEditableMilestones] = useState<EditableMilestone[]>([])

    // ── Step 3 — template-specific params & Drive state ──────────────────────
    const [params, setParams] = useState<TemplateParams>({
        techStack:        '',
        repositoryUrl:    '',
        sprintDuration:   '14',
        storyPointScale:  'fibonacci',
        researchField:    '',
        campaignBudget:   '',
        supervisorName:   '',
        submissionDate:   '',
        university:       '',
        designTool:       '',
    })

    // ── Step 4 — existing data ───────────────────────────────────────────────
    const [existingData,   setExistingData]   = useState<ExistingDataCounts>({ tasks: 0, documents: 0, sprints: 0 })
    const [clearExisting,  setClearExisting]  = useState(true)
    const [checkingData,   setCheckingData]   = useState(false)
    const [hasExisting,    setHasExisting]    = useState(false)

    // ── Reset on open/close ──────────────────────────────────────────────────
    useEffect(() => {
        if (open) {
            setStep(1)
            setApplied(false)
            setApplyProgress(0)
            setSelected(null)
            setSetupForm(f => ({ ...f, name: projectName }))
            setEditableTasks([])
            setEditableMilestones([])
        }
    }, [open, projectName])


    // ── Step 1 — filter templates ────────────────────────────────────────
    const filtered = PROJECT_TEMPLATES.filter(t => {
        const matchSearch =
            t.name.toLowerCase().includes(search.toLowerCase()) ||
            t.description.toLowerCase().includes(search.toLowerCase()) ||
            t.tags.some(tag => tag.includes(search.toLowerCase()))
        const matchCat = category === 'all' || t.category === category
        return matchSearch && matchCat
    })

    // ── Initialise editable lists when selected changes ──────────────────────
    const initEditableLists = (template: ProjectTemplate) => {
        setEditableTasks(template.tasks.map(t => ({ ...t, _id: eid() })))
        setEditableMilestones(template.milestones.map(m => ({ ...m, _id: eid() })))
    }

    // ── Check existing data when moving to step 4 ────────────────────────────
    const checkExistingData = async () => {
        setCheckingData(true)
        try {
            const [tasksSnap, docsSnap, sprintsSnap] = await Promise.all([
                getCountFromServer(collection(db, 'projects', projectId, 'tasks')),
                getCountFromServer(collection(db, 'projects', projectId, 'documents')),
                getCountFromServer(collection(db, 'projects', projectId, 'sprints')),
            ])
            const counts = {
                tasks:     tasksSnap.data().count,
                documents: docsSnap.data().count,
                sprints:   sprintsSnap.data().count,
            }
            setExistingData(counts)
            const totalExisting = counts.tasks + counts.documents + counts.sprints
            setHasExisting(totalExisting > 0)
        } catch (err) {
            console.error('Failed to check existing data:', err)
            setHasExisting(false)
        } finally {
            setCheckingData(false)
        }
    }

    // ── Navigation ────────────────────────────────────────────────────────────
    const goToStep = async (nextStep: Step) => {
        if (nextStep === 3 && selected) initEditableLists(selected)
        if (nextStep === 4) await checkExistingData()
        setStep(nextStep)
    }

    const canProceedStep1 = !!selected
    const canProceedStep2 = setupForm.name.trim().length >= 2 &&
                             setupForm.goal.trim().length >= 2

    // ── Delete a subcollection ────────────────────────────────────────────────
    const deleteSubcollection = async (subcollectionName: string) => {
        const colRef  = collection(db, 'projects', projectId, subcollectionName)
        const snap    = await getDocs(query(colRef))
        const batch   = writeBatch(db)
        snap.docs.forEach(d => batch.delete(d.ref))
        if (snap.docs.length > 0) await batch.commit()
    }

    // ── Apply template ────────────────────────────────────────────────────────
    const handleApply = async () => {
        if (!selected || !user) return
        setApplying(true)
        setApplyProgress(0)

        try {
            // ── Step A: Clear existing data if requested ───────────────────
            if (clearExisting && hasExisting) {
                setApplyStatus('Clearing existing data…')
                await Promise.all([
                    deleteSubcollection('tasks'),
                    deleteSubcollection('documents'),
                    deleteSubcollection('driveDocuments'),
                    deleteSubcollection('sprints'),
                ])
                setApplyProgress(15)
            }

            // ── Step B: Update project metadata ───────────────────────────
            setApplyStatus('Updating project info…')
            await updateDoc(doc(db, 'projects', projectId), {
                title:       setupForm.name,
                description: setupForm.description,
                summary:     setupForm.goal,
                teamSize:    parseInt(setupForm.teamSize) || 1,
                discipline:  setupForm.discipline,
                methodology: selected.methodology,
                templateId:  selected.id,
                templateAppliedAt: serverTimestamp(),
                updatedAt:   serverTimestamp(),
                ...(params.repositoryUrl && { repositoryUrl: params.repositoryUrl }),
                ...(params.techStack     && { techStack:     params.techStack }),
            })
            setApplyProgress(30)

            // ── Step C: Create tasks (from editable list) ─────────────────
            setApplyStatus(`Creating ${editableTasks.length} tasks…`)
            const tasksBatch = writeBatch(db)
            const projectStart = new Date(setupForm.startDate)

            const enrichedTasks = editableTasks.map(task => ({
                ...task,
                tags: [
                    ...task.tags,
                    ...(params.techStack
                            ? params.techStack.split(',').map(t => t.trim().toLowerCase())
                            : []),
                ],
            }))

            for (const task of enrichedTasks) {
                const { _id, ...taskData } = task
                const taskRef = doc(collection(db, 'projects', projectId, 'tasks'))
                tasksBatch.set(taskRef, {
                    ...taskData,
                    projectId,
                    createdBy:   user.uid,
                    createdAt:   serverTimestamp(),
                    updatedAt:   serverTimestamp(),
                    assignee:    null,
                    dueDate:     null,
                    comments:    [],
                    attachments: [],
                })
            }
            await tasksBatch.commit()
            setApplyProgress(50)

            setApplyProgress(75)

            // ── Step E: Create sprints ─────────────────────────────────────
            if (selected.sprints.length > 0) {
                setApplyStatus(`Creating ${selected.sprints.length} sprints…`)
                const sprintsBatch = writeBatch(db)

                const sprintDuration = parseInt(params.sprintDuration) || 14
                let sprintStart      = new Date(projectStart)

                for (const sprint of selected.sprints) {
                    const duration = selected.methodology === 'scrum'
                        ? sprintDuration
                        : sprint.durationDays
                    const sprintEnd = new Date(sprintStart)
                    sprintEnd.setDate(sprintEnd.getDate() + duration)

                    const sRef = doc(collection(db, 'projects', projectId, 'sprints'))
                    sprintsBatch.set(sRef, {
                        name:        sprint.name,
                        goals:       sprint.goals,
                        points:      0,
                        startDate:   sprintStart,
                        endDate:     sprintEnd,
                        completedAt: sprintEnd,
                        createdBy:   user.uid,
                        createdAt:   serverTimestamp(),
                    })
                    sprintStart = new Date(sprintEnd)
                }
                await sprintsBatch.commit()
            }
            setApplyProgress(100)
            setApplyStatus('Done!')

            setApplied(true)
            toast({
                title:       `"${setupForm.name}" is ready!`,
                description: `Template applied with ${editableTasks.length} tasks.`,
            })

            setTimeout(() => onApplied(setupForm.name), 2000)

        } catch (err) {
            console.error('Failed to apply template:', err)
            toast({
                title:       'Error',
                description: 'Could not apply template. Please try again.',
                variant:     'destructive',
            })
            setApplying(false)
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────
    const stepLabels = ['Browse', 'Setup', 'Customise', 'Review', 'Apply']

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent
                className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden"
            >
                {/* ── Header ── */}
                <div className="px-6 pt-5 pb-4 border-b flex-shrink-0">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        Project Template Wizard
                    </DialogTitle>
                    <DialogDescription className="mt-1">
                        Set up your project from a curated template in a few steps.
                    </DialogDescription>
                    <div className="mt-4">
                        <StepIndicator
                            current={step}
                            total={5}
                            labels={stepLabels}
                        />
                    </div>
                </div>

                {/* ── Body ── */}
                <div className="flex-1 min-h-0 overflow-hidden">

                    {/* ════════════════════════════════════════════════════
                        STEP 1 — Browse Templates
                    ════════════════════════════════════════════════════ */}
                    {step === 1 && (
                        <div className="flex h-full">
                            {/* Left — template list */}
                            <div className="w-[52%] border-r flex flex-col min-h-0">
                                <div className="p-4 border-b flex-shrink-0 space-y-3">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-2.5
                                            h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search templates…"
                                            className="pl-9"
                                            value={search}
                                            onChange={e => setSearch(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {[{ id: 'all', label: 'All' },
                                          ...TEMPLATE_CATEGORIES].map(cat => (
                                            <button
                                                key={cat.id}
                                                onClick={() =>
                                                    setCategory(cat.id as any)
                                                }
                                                className={`px-2.5 py-1 rounded-full
                                                    text-xs font-medium border
                                                    transition-colors ${
                                                    category === cat.id
                                                        ? 'bg-primary text-primary-foreground border-primary'
                                                        : 'bg-background border-border hover:bg-muted'
                                                }`}
                                            >
                                                {cat.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <ScrollArea className="flex-1">
                                    <div className="p-3 space-y-2">
                                        {filtered.map(template => (
                                            <button
                                                key={template.id}
                                                onClick={() => setSelected(template)}
                                                className={`w-full text-left p-3.5
                                                    rounded-xl border-2 transition-all
                                                    hover:shadow-sm ${
                                                    selected?.id === template.id
                                                        ? 'border-primary bg-primary/5'
                                                        : 'border-border hover:border-primary/30'
                                                }`}
                                            >
                                                <div className="flex gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center
                                                            gap-1.5 flex-wrap">
                                                            <span className="font-semibold text-sm">
                                                                {template.name}
                                                            </span>
                                                            <Badge variant="outline"
                                                                className="text-xs capitalize h-5">
                                                                {template.methodology}
                                                            </Badge>
                                                            <span className={`text-xs px-1.5
                                                                py-0.5 rounded-full font-medium
                                                                ${DIFFICULTY_COLORS[template.difficulty]}`}>
                                                                {template.difficulty}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs
                                                            text-muted-foreground mt-1
                                                            line-clamp-2">
                                                            {template.description}
                                                        </p>
                                                        <div className="flex gap-3 mt-1.5
                                                            text-xs text-muted-foreground">
                                                            <span className="flex items-center gap-1">
                                                                <BarChart3 className="h-3 w-3" />
                                                                {template.preview.taskCount} tasks
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <Clock className="h-3 w-3" />
                                                                ~{template.estimatedWeeks}w
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {selected?.id === template.id && (
                                                        <CheckCircle2 className="h-5 w-5
                                                            text-primary shrink-0 mt-1" />
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </div>

                            {/* Right — preview */}
                            <div className="flex-1 flex flex-col min-h-0">
                                {selected ? (
                                    <ScrollArea className="flex-1">
                                        <div className="p-5 space-y-4">
                                            <div className="flex items-start gap-3">
                                                <div>
                                                    <h3 className="text-lg font-bold">
                                                        {selected.name}
                                                    </h3>
                                                    <p className="text-sm
                                                        text-muted-foreground">
                                                        {selected.description}
                                                    </p>
                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                        {selected.tags.map(tag => (
                                                            <Badge key={tag}
                                                                variant="secondary"
                                                                className="text-xs">
                                                                {tag}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Stats */}
                                            <div className="grid grid-cols-2 gap-2">
                                                {[
                                                    { label: 'Tasks',      val: selected.preview.taskCount      },
                                                    { label: 'Milestones', val: selected.preview.milestoneCount },
                                                ].map(s => (
                                                    <div key={s.label}
                                                        className="bg-muted/50 rounded-lg
                                                            p-2.5 text-center">
                                                        <p className="font-bold">{s.val}</p>
                                                        <p className="text-xs
                                                            text-muted-foreground">
                                                            {s.label}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Task list */}
                                            <div>
                                                <p className="text-sm font-semibold mb-2">
                                                    Tasks included
                                                </p>
                                                <div className="space-y-1">
                                                    {selected.tasks.slice(0, 6).map((t, i) => (
                                                        <div key={i}
                                                            className="flex items-center
                                                                gap-2 text-sm">
                                                            <span className={`w-2 h-2
                                                                rounded-full shrink-0 ${
                                                                PRIORITY_COLORS[t.priority] ?? 'bg-muted'
                                                            }`} />
                                                            <span className="line-clamp-1">
                                                                {t.title}
                                                            </span>
                                                            <Badge variant="outline"
                                                                className="ml-auto
                                                                    text-xs shrink-0 h-4">
                                                                {t.status}
                                                            </Badge>
                                                        </div>
                                                    ))}
                                                    {selected.tasks.length > 6 && (
                                                        <p className="text-xs
                                                            text-muted-foreground pl-4">
                                                            +{selected.tasks.length - 6} more…
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Milestones */}
                                            {selected.milestones.length > 0 && (
                                                <div>
                                                    <p className="text-sm font-semibold mb-2">
                                                        Milestones
                                                    </p>
                                                    {selected.milestones.map((m, i) => (
                                                        <div key={i}
                                                            className="flex items-center
                                                                gap-2 text-sm py-1">
                                                            <Flag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                            <span className="flex-1">
                                                                {m.title}
                                                            </span>
                                                            <span className="text-xs
                                                                text-muted-foreground">
                                                                Day {m.daysFromStart}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </ScrollArea>
                                ) : (
                                    <div className="flex flex-col items-center
                                        justify-center h-full text-muted-foreground">
                                        <FileText className="h-10 w-10 opacity-20 mb-3" />
                                        <p className="text-sm">Select a template to preview</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ════════════════════════════════════════════════════
                        STEP 2 — Project Setup
                    ════════════════════════════════════════════════════ */}
                    {step === 2 && (
                        <ScrollArea className="h-full">
                            <div className="p-6 space-y-5 max-w-xl mx-auto">
                                <div className="text-center mb-2">
                                    <h3 className="text-lg font-bold mt-2">
                                        Set Up Your Project
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Tell us about your project so we can
                                        customise the template for you.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="proj-name">
                                        Project Name <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="proj-name"
                                        value={setupForm.name}
                                        onChange={e => setSetupForm(f => ({
                                            ...f, name: e.target.value,
                                        }))}
                                        placeholder={`e.g. ${selected?.name ?? 'My Project'}`}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="proj-desc">
                                        Short Description
                                    </Label>
                                    <Textarea
                                        id="proj-desc"
                                        rows={2}
                                        value={setupForm.description}
                                        onChange={e => setSetupForm(f => ({
                                            ...f, description: e.target.value,
                                        }))}
                                        placeholder="What does this project do in one sentence?"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="proj-goal">
                                        Main Goal <span className="text-destructive">*</span>
                                    </Label>
                                    <Textarea
                                        id="proj-goal"
                                        rows={2}
                                        value={setupForm.goal}
                                        onChange={e => setSetupForm(f => ({
                                            ...f, goal: e.target.value,
                                        }))}
                                        placeholder="What problem are you solving or what do you want to achieve?"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="start-date">Start Date</Label>
                                        <DatePicker
                                            date={setupForm.startDate ? new Date(setupForm.startDate) : undefined}
                                            onDateChange={(date) => setSetupForm(f => ({
                                                ...f,
                                                startDate: date ? date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
                                            }))}
                                            placeholder="Select project start date"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="team-size">Team Size</Label>
                                        <Select
                                            value={setupForm.teamSize}
                                            onValueChange={v => setSetupForm(f => ({
                                                ...f, teamSize: v,
                                            }))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="1">Solo (1)</SelectItem>
                                                <SelectItem value="2">Pair (2)</SelectItem>
                                                <SelectItem value="3">Small (3-4)</SelectItem>
                                                <SelectItem value="5">Medium (5-7)</SelectItem>
                                                <SelectItem value="8">Large (8+)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="discipline">Primary Discipline</Label>
                                    <Select
                                        value={setupForm.discipline}
                                        onValueChange={v => setSetupForm(f => ({
                                            ...f, discipline: v,
                                        }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select your field…" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="frontend">Frontend Development</SelectItem>
                                            <SelectItem value="backend">Backend Development</SelectItem>
                                            <SelectItem value="fullstack">Full Stack Development</SelectItem>
                                            <SelectItem value="mobile">Mobile Development</SelectItem>
                                            <SelectItem value="devops">DevOps / Infrastructure</SelectItem>
                                            <SelectItem value="design">UI/UX Design</SelectItem>
                                            <SelectItem value="data">Data Science / ML</SelectItem>
                                            <SelectItem value="research">Research</SelectItem>
                                            <SelectItem value="marketing">Marketing</SelectItem>
                                            <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </ScrollArea>
                    )}

                    {/* ════════════════════════════════════════════════════
                        STEP 3 — Customise (Editable Tasks / Docs / Milestones + Params)
                    ════════════════════════════════════════════════════ */}
                    {step === 3 && selected && (
                        <ScrollArea className="h-full">
                            <div className="p-6 space-y-5 max-w-3xl mx-auto">
                                <div className="mb-2">
                                    <h3 className="text-lg font-bold">
                                        Customise Template Content
                                    </h3>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Add, edit, or remove tasks, documents, and milestones before applying.
                                        Changes here apply only to this project.
                                    </p>
                                </div>

                                <Tabs defaultValue="tasks">
                                    <TabsList className="mb-4">
                                        <TabsTrigger value="tasks">
                                            Tasks ({editableTasks.length})
                                        </TabsTrigger>
                                        <TabsTrigger value="milestones">
                                            Milestones ({editableMilestones.length})
                                        </TabsTrigger>
                                        <TabsTrigger value="params">
                                            Config
                                        </TabsTrigger>
                                    </TabsList>

                                    {/* ── Tasks tab ── */}
                                    <TabsContent value="tasks" className="space-y-2">
                                        {editableTasks.map((task, idx) => (
                                            <div key={task._id}
                                                className="flex items-start gap-2 p-3 rounded-lg border bg-muted/20">
                                                <span className={`w-2 h-2 rounded-full mt-2.5 shrink-0 ${
                                                    PRIORITY_COLORS[task.priority] ?? 'bg-muted'
                                                }`} />
                                                <div className="flex-1 space-y-1.5">
                                                    <Input
                                                        value={task.title}
                                                        onChange={e => setEditableTasks(prev =>
                                                            prev.map(t => t._id === task._id
                                                                ? { ...t, title: e.target.value }
                                                                : t
                                                            )
                                                        )}
                                                        className="h-7 text-sm"
                                                        placeholder="Task title"
                                                    />
                                                    <div className="flex gap-2">
                                                        <Select
                                                            value={task.priority}
                                                            onValueChange={v => setEditableTasks(prev =>
                                                                prev.map(t => t._id === task._id
                                                                    ? { ...t, priority: v as any }
                                                                    : t
                                                                )
                                                            )}
                                                        >
                                                            <SelectTrigger className="h-6 text-xs w-[100px]">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="urgent">Urgent</SelectItem>
                                                                <SelectItem value="high">High</SelectItem>
                                                                <SelectItem value="medium">Medium</SelectItem>
                                                                <SelectItem value="low">Low</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <Select
                                                            value={task.status}
                                                            onValueChange={v => setEditableTasks(prev =>
                                                                prev.map(t => t._id === task._id
                                                                    ? { ...t, status: v as any }
                                                                    : t
                                                                )
                                                            )}
                                                        >
                                                            <SelectTrigger className="h-6 text-xs w-[120px]">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="backlog">Backlog</SelectItem>
                                                                <SelectItem value="todo">To Do</SelectItem>
                                                                <SelectItem value="in-progress">In Progress</SelectItem>
                                                                <SelectItem value="review">Review</SelectItem>
                                                                <SelectItem value="done">Done</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditableTasks(prev => prev.filter(t => t._id !== task._id))}
                                                    className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors mt-0.5"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full gap-2 mt-2"
                                            onClick={() => setEditableTasks(prev => [
                                                ...prev,
                                                { _id: eid(), title: '', description: '', status: 'todo', priority: 'medium', tags: [] }
                                            ])}
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                            Add Task
                                        </Button>
                                    </TabsContent>



                                    {/* ── Milestones tab ── */}
                                    <TabsContent value="milestones" className="space-y-2">
                                        {editableMilestones.length === 0 && (
                                            <p className="text-sm text-muted-foreground text-center py-4">
                                                No milestones in this template.
                                            </p>
                                        )}
                                        {editableMilestones.map((m) => (
                                            <div key={m._id}
                                                className="flex items-center gap-2 p-3 rounded-lg border bg-muted/20">
                                                <Flag className="h-4 w-4 text-muted-foreground shrink-0" />
                                                <Input
                                                    value={m.title}
                                                    onChange={e => setEditableMilestones(prev =>
                                                        prev.map(ms => ms._id === m._id
                                                            ? { ...ms, title: e.target.value }
                                                            : ms
                                                        )
                                                    )}
                                                    className="h-7 text-sm flex-1"
                                                    placeholder="Milestone title"
                                                />
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <span className="text-xs text-muted-foreground">Day</span>
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        value={m.daysFromStart}
                                                        onChange={e => setEditableMilestones(prev =>
                                                            prev.map(ms => ms._id === m._id
                                                                ? { ...ms, daysFromStart: parseInt(e.target.value) || 1 }
                                                                : ms
                                                            )
                                                        )}
                                                        className="h-7 w-16 text-sm text-center"
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditableMilestones(prev => prev.filter(ms => ms._id !== m._id))}
                                                    className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full gap-2 mt-2"
                                            onClick={() => setEditableMilestones(prev => [
                                                ...prev,
                                                { _id: eid(), title: 'New Milestone', description: '', daysFromStart: 14 }
                                            ])}
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                            Add Milestone
                                        </Button>
                                    </TabsContent>

                                    {/* ── Config / Params tab ── */}
                                    <TabsContent value="params" className="space-y-4">
                                        {/* Software-specific */}
                                        {['software'].includes(selected.category) && (
                                            <>
                                                <div className="space-y-2">
                                                    <Label>Tech Stack</Label>
                                                    <Input
                                                        value={params.techStack}
                                                        onChange={e => setParams(p => ({ ...p, techStack: e.target.value }))}
                                                        placeholder="e.g. React, Node.js, PostgreSQL"
                                                    />
                                                    <p className="text-xs text-muted-foreground">
                                                        Comma-separated — will be added as tags to tasks
                                                    </p>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Repository URL</Label>
                                                    <Input
                                                        value={params.repositoryUrl}
                                                        onChange={e => setParams(p => ({ ...p, repositoryUrl: e.target.value }))}
                                                        placeholder="https://github.com/org/repo"
                                                    />
                                                </div>
                                            </>
                                        )}

                                        {/* Sprint settings */}
                                        {['scrum', 'agile'].includes(selected.methodology) && (
                                            <>
                                                <Separator />
                                                <p className="text-sm font-semibold">Sprint Settings</p>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label>Sprint Duration</Label>
                                                        <Select
                                                            value={params.sprintDuration}
                                                            onValueChange={v => setParams(p => ({ ...p, sprintDuration: v }))}
                                                        >
                                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="7">1 week</SelectItem>
                                                                <SelectItem value="14">2 weeks</SelectItem>
                                                                <SelectItem value="21">3 weeks</SelectItem>
                                                                <SelectItem value="28">4 weeks</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Story Point Scale</Label>
                                                        <Select
                                                            value={params.storyPointScale}
                                                            onValueChange={v => setParams(p => ({ ...p, storyPointScale: v }))}
                                                        >
                                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="fibonacci">Fibonacci (1,2,3,5,8…)</SelectItem>
                                                                <SelectItem value="linear">Linear (1-10)</SelectItem>
                                                                <SelectItem value="tshirt">T-Shirt (XS-XL)</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        {/* Research specific */}
                                        {selected.category === 'research' && (
                                            <>
                                                <Separator />
                                                <div className="space-y-2">
                                                    <Label>Research Field / Domain</Label>
                                                    <Input
                                                        value={params.researchField}
                                                        onChange={e => setParams(p => ({ ...p, researchField: e.target.value }))}
                                                        placeholder="e.g. Machine Learning, Psychology"
                                                    />
                                                </div>
                                            </>
                                        )}

                                        {/* Education / Student */}
                                        {selected.category === 'education' && (
                                            <>
                                                <Separator />
                                                <p className="text-sm font-semibold">Academic Details</p>
                                                <div className="space-y-2">
                                                    <Label>University / Institution</Label>
                                                    <Input
                                                        value={params.university}
                                                        onChange={e => setParams(p => ({ ...p, university: e.target.value }))}
                                                        placeholder="e.g. University of Manchester"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Supervisor Name</Label>
                                                    <Input
                                                        value={params.supervisorName}
                                                        onChange={e => setParams(p => ({ ...p, supervisorName: e.target.value }))}
                                                        placeholder="Dr. Jane Smith"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Final Submission Date</Label>
                                                    <Input
                                                        type="date"
                                                        value={params.submissionDate}
                                                        onChange={e => setParams(p => ({ ...p, submissionDate: e.target.value }))}
                                                    />
                                                </div>
                                            </>
                                        )}

                                        {/* Marketing */}
                                        {selected.category === 'marketing' && (
                                            <>
                                                <Separator />
                                                <div className="space-y-2">
                                                    <Label>Campaign Budget (INR)</Label>
                                                    <Input
                                                        type="number"
                                                        value={params.campaignBudget}
                                                        onChange={e => setParams(p => ({ ...p, campaignBudget: e.target.value }))}
                                                        placeholder="e.g. 50000"
                                                    />
                                                </div>
                                            </>
                                        )}

                                        {/* Design */}
                                        {selected.category === 'design' && (
                                            <>
                                                <Separator />
                                                <div className="space-y-2">
                                                    <Label>Primary Design Tool</Label>
                                                    <Select
                                                        value={params.designTool}
                                                        onValueChange={v => setParams(p => ({ ...p, designTool: v }))}
                                                    >
                                                        <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="figma">Figma</SelectItem>
                                                            <SelectItem value="sketch">Sketch</SelectItem>
                                                            <SelectItem value="xd">Adobe XD</SelectItem>
                                                            <SelectItem value="framer">Framer</SelectItem>
                                                            <SelectItem value="other">Other</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </>
                                        )}

                                        {/* No config needed */}
                                        {!['software', 'research', 'education', 'marketing', 'design'].includes(selected.category) &&
                                         !['scrum', 'agile'].includes(selected.methodology) && (
                                            <p className="text-sm text-muted-foreground text-center py-6">
                                                No additional configuration needed for this template type.
                                            </p>
                                        )}
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </ScrollArea>
                    )}

                    {/* ════════════════════════════════════════════════════
                        STEP 4 — Existing Data Warning & Confirm
                    ════════════════════════════════════════════════════ */}
                    {step === 4 && (
                        <ScrollArea className="h-full">
                            <div className="p-6 space-y-5 max-w-xl mx-auto">
                                <div className="text-center">
                                    <h3 className="text-lg font-bold mt-2">
                                        Review &amp; Confirm
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Double-check everything before we apply the template.
                                    </p>
                                </div>

                                {/* Summary card */}
                                <div className="bg-muted/40 rounded-xl p-4 space-y-3 border">
                                    <p className="text-sm font-semibold">
                                        What will be applied
                                    </p>
                                    <div className="space-y-2 text-sm">
                                        {[
                                            { label: 'Template',     val: selected?.name ?? '' },
                                            { label: 'Project Name', val: setupForm.name },
                                            { label: 'Goal',         val: setupForm.goal },
                                            { label: 'Start Date',   val: setupForm.startDate },
                                            { label: 'Team Size',    val: `${setupForm.teamSize} people` },
                                            { label: 'Tasks',        val: `${editableTasks.length} tasks` },
                                            { label: 'Sprints',      val: `${selected?.sprints.length ?? 0} sprint(s)` },
                                            { label: 'Milestones',   val: `${editableMilestones.length} milestone${editableMilestones.length !== 1 ? 's' : ''}` },
                                        ].map(row => (
                                            <div key={row.label}
                                                className="flex items-start gap-2">
                                                <span className="text-muted-foreground
                                                    min-w-[100px]">
                                                    {row.label}:
                                                </span>
                                                <span className="font-medium flex-1">
                                                    {row.val}
                                                </span>
                                            </div>
                                        ))}
                                        {params.techStack && (
                                            <div className="flex items-start gap-2">
                                                <span className="text-muted-foreground min-w-[100px]">
                                                    Tech Stack:
                                                </span>
                                                <span className="font-medium">
                                                    {params.techStack}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Existing data warning */}
                                {checkingData ? (
                                    <div className="flex items-center gap-2
                                        text-sm text-muted-foreground justify-center py-4">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Checking existing project data…
                                    </div>
                                ) : hasExisting ? (
                                    <div className="border-2 border-orange-200
                                        dark:border-orange-800 rounded-xl p-4 space-y-4
                                        bg-orange-50 dark:bg-orange-900/10">
                                        <div className="flex items-start gap-3">
                                            <AlertTriangle className="h-5 w-5
                                                text-orange-500 shrink-0 mt-0.5" />
                                            <div>
                                                <p className="font-semibold text-sm
                                                    text-orange-700 dark:text-orange-400">
                                                    This project already has data
                                                </p>
                                                <p className="text-xs
                                                    text-orange-600 dark:text-orange-500 mt-1">
                                                    Applying the template will affect
                                                    the following existing content:
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2">
                                            {[
                                                { icon: <BarChart3 className="h-4 w-4" />, label: 'Tasks',     count: existingData.tasks     },
                                                { icon: <FileText  className="h-4 w-4" />, label: 'Documents', count: existingData.documents  },
                                                { icon: <Target    className="h-4 w-4" />, label: 'Sprints',   count: existingData.sprints    },
                                            ].map(item => (
                                                <div key={item.label}
                                                    className="bg-white dark:bg-background
                                                        rounded-lg p-2 text-center border">
                                                    <div className="flex justify-center
                                                        text-orange-500 mb-1">
                                                        {item.icon}
                                                    </div>
                                                    <p className="font-bold text-sm">
                                                        {item.count}
                                                    </p>
                                                    <p className="text-xs
                                                        text-muted-foreground">
                                                        {item.label}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex items-center gap-2
                                            text-xs text-green-600 dark:text-green-400
                                            bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
                                            <Users className="h-3.5 w-3.5 shrink-0" />
                                            Team members will <strong className="mx-1">
                                            always be preserved
                                            </strong> — they are never removed.
                                        </div>

                                        <div className="flex items-center
                                            justify-between bg-white dark:bg-background
                                            rounded-lg p-3 border">
                                            <div>
                                                <p className="text-sm font-medium flex
                                                    items-center gap-1.5">
                                                    <Trash2 className="h-3.5 w-3.5
                                                        text-destructive" />
                                                    Clear existing tasks, docs &amp; sprints
                                                </p>
                                                <p className="text-xs
                                                    text-muted-foreground mt-0.5">
                                                    Start completely fresh with
                                                    the template content
                                                </p>
                                            </div>
                                            <Switch
                                                checked={clearExisting}
                                                onCheckedChange={setClearExisting}
                                            />
                                        </div>

                                        {!clearExisting && (
                                            <p className="text-xs text-muted-foreground
                                                bg-muted/50 rounded-lg p-2.5">
                                                Template content will be <strong>added on top</strong> of
                                                your existing data.
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2
                                        text-sm text-green-600 bg-green-50
                                        dark:bg-green-900/20 rounded-lg p-3 border
                                        border-green-200 dark:border-green-800">
                                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                                        Project is empty — template will be
                                        applied to a clean slate.
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    )}

                    {/* ════════════════════════════════════════════════════
                        STEP 5 — Applying
                    ════════════════════════════════════════════════════ */}
                    {step === 5 && (
                        <div className="flex flex-col items-center
                            justify-center h-full p-8 text-center gap-6">
                            {!applied ? (
                                <>
                                    <div className="relative">
                                        <div className="w-20 h-20 rounded-full
                                            bg-primary/10 flex items-center
                                            justify-center">
                                            <Sparkles className="h-9 w-9
                                                text-primary animate-pulse" />
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-lg font-bold">
                                            Applying Template…
                                        </p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {applyStatus}
                                        </p>
                                    </div>
                                    <div className="w-full max-w-xs">
                                        <Progress
                                            value={applyProgress}
                                            className="h-2"
                                        />
                                        <p className="text-xs text-muted-foreground mt-2">
                                            {applyProgress}% complete
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="w-20 h-20 rounded-full
                                        bg-green-100 dark:bg-green-900/30
                                        flex items-center justify-center">
                                        <CheckCircle2 className="h-10 w-10
                                            text-green-500" />
                                    </div>
                                    <div>
                                        <p className="text-xl font-bold">
                                            "{setupForm.name}" is ready!
                                        </p>
                                        <p className="text-sm text-muted-foreground mt-2">
                                            {editableTasks.length} tasks &bull;{' '}
                                            {selected?.sprints.length} sprints
                                        </p>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Redirecting to your board…
                                    </p>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Footer navigation ── */}
                {step !== 5 && (
                    <div className="border-t px-6 py-4 flex items-center
                        justify-between flex-shrink-0 bg-background">

                        {/* Back button */}
                        <Button
                            variant="ghost"
                            onClick={() => {
                                if (step === 1) onClose()
                                else setStep(s => (s - 1) as Step)
                            }}
                            disabled={applying}
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            {step === 1 ? 'Cancel' : 'Back'}
                        </Button>

                        {/* Step info */}
                        <span className="text-xs text-muted-foreground">
                            Step {step} of {stepLabels.length}
                        </span>

                        {/* Next / Apply */}
                        {step < 4 ? (
                            <Button
                                onClick={() => goToStep((step + 1) as Step)}
                                disabled={
                                    (step === 1 && !canProceedStep1) ||
                                    (step === 2 && !canProceedStep2)
                                }
                            >
                                Next
                                <ArrowRight className="h-4 w-4 ml-2" />
                            </Button>
                        ) : (
                            <Button
                                onClick={() => { setStep(5); handleApply() }}
                                disabled={applying}
                                className="gap-2"
                            >
                                <Sparkles className="h-4 w-4" />
                                Apply Template
                            </Button>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
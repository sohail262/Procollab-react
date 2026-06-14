// src/components/dashboard/ProjectGuide.tsx
import { useState, useEffect } from 'react'
import {
    Dialog, DialogContent, DialogDescription, DialogHeader,
    DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
    BookOpen, LayoutDashboard, Trello, BarChart3, 
    FolderKanban, IndianRupee, PenTool, 
    ShieldAlert, ChevronLeft, ChevronRight, CheckCircle2,
    Activity, AlertTriangle
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

type GuideTab = 'overview' | 'kanban' | 'timeline' | 'docs' | 'budget' | 'whiteboard' | 'rbac'

interface TabOption {
    id: GuideTab
    label: string
    icon: any
    description: string
}

const TABS: TabOption[] = [
    {
        id: 'overview',
        label: 'Dashboard Overview',
        icon: LayoutDashboard,
        description: 'Project health, metrics and real-time activity tracking.'
    },
    {
        id: 'kanban',
        label: 'Kanban Workflow',
        icon: Trello,
        description: 'Task management, assignment and progress flows.'
    },
    {
        id: 'timeline',
        label: 'Gantt & Timeline',
        icon: BarChart3,
        description: 'Visual scheduling, milestones and deadline tracking.'
    },
    {
        id: 'docs',
        label: 'Google Drive Docs',
        icon: FolderKanban,
        description: 'Connected document collaboration and cloud storage.'
    },
    {
        id: 'budget',
        label: 'Budget Tracking',
        icon: IndianRupee,
        description: 'Project finances, expense approval and category analysis.'
    },
    {
        id: 'whiteboard',
        label: 'Whiteboard',
        icon: PenTool,
        description: 'Real-time collaborative drawing and brainstorming.'
    },
    {
        id: 'rbac',
        label: 'Permissions & Roles',
        icon: ShieldAlert,
        description: 'Access control structures and security parameters.'
    }
]

export function ProjectGuide() {
    const [isOpen, setIsOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<GuideTab>('overview')

    const getTabIndex = (tab: GuideTab) => TABS.findIndex(t => t.id === tab)
    const nextTab = () => {
        const currentIndex = getTabIndex(activeTab)
        if (currentIndex < TABS.length - 1) {
            setActiveTab(TABS[currentIndex + 1].id)
        }
    }
    const prevTab = () => {
        const currentIndex = getTabIndex(activeTab)
        if (currentIndex > 0) {
            setActiveTab(TABS[currentIndex - 1].id)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button 
                    variant="outline" 
                    size="sm" 
                    className="border-primary/30 hover:border-primary/70 bg-primary/5 hover:bg-primary/10 transition-all font-medium text-xs py-1 h-8 flex items-center gap-1.5"
                >
                    <BookOpen className="h-3.5 w-3.5 text-primary" />
                    <span>User Guide</span>
                </Button>
            </DialogTrigger>

            <DialogContent className="max-w-5xl h-[85vh] p-0 flex flex-col overflow-hidden bg-background border border-border/80 shadow-2xl rounded-xl">
                <DialogHeader className="px-6 py-4 border-b border-border/40 bg-muted/20 shrink-0">
                    <div className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary" />
                        <DialogTitle className="text-lg font-bold tracking-tight">Project Management Dashboard Guide</DialogTitle>
                    </div>
                    <DialogDescription className="text-xs text-muted-foreground">
                        Detailed instruction manual and system workflow mapping for collaborative workspace operations.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 flex min-h-0 overflow-hidden">
                    {/* Left Sidebar Navigation */}
                    <div className="w-72 border-r border-border/40 bg-muted/10 flex flex-col py-4 shrink-0">
                        <div className="px-3 mb-2">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3">Sections</span>
                        </div>
                        <ScrollArea className="flex-1 px-2">
                            <div className="space-y-1">
                                {TABS.map((tab) => {
                                    const Icon = tab.icon
                                    const isSelected = activeTab === tab.id
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-all group ${
                                                isSelected 
                                                    ? 'bg-primary/10 text-primary font-medium' 
                                                    : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${isSelected ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                                            <div className="min-w-0">
                                                <p className="text-xs leading-none font-semibold">{tab.label}</p>
                                                <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1 leading-snug">{tab.description}</p>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
                        <ScrollArea className="flex-1 p-6">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeTab}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-6"
                                >
                                    {activeTab === 'overview' && <OverviewGuide />}
                                    {activeTab === 'kanban' && <KanbanGuide />}
                                    {activeTab === 'timeline' && <TimelineGuide />}
                                    {activeTab === 'docs' && <DocsGuide />}
                                    {activeTab === 'budget' && <BudgetGuide />}
                                    {activeTab === 'whiteboard' && <WhiteboardGuide />}
                                    {activeTab === 'rbac' && <RbacGuide />}
                                </motion.div>
                            </AnimatePresence>
                        </ScrollArea>

                        {/* Footer Navigation controls */}
                        <div className="px-6 py-3 border-t border-border/40 bg-muted/20 shrink-0 flex items-center justify-between">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={prevTab}
                                disabled={getTabIndex(activeTab) === 0}
                                className="text-xs"
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                Previous Section
                            </Button>
                            <span className="text-[10px] text-muted-foreground font-mono">
                                Section {getTabIndex(activeTab) + 1} of {TABS.length}
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={nextTab}
                                disabled={getTabIndex(activeTab) === TABS.length - 1}
                                className="text-xs"
                            >
                                Next Section
                                <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-GUIDE COMPONENTS (AESTHETIC, DETAILED, EMOJI-FREE, ANIMATED DEMOS)
// ─────────────────────────────────────────────────────────────────────────────

function OverviewGuide() {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-bold tracking-tight">Dashboard Overview</h3>
                <p className="text-sm text-muted-foreground mt-1">
                    The control center of your project, displaying high-level performance indicators, milestones, and real-time operational logs.
                </p>
            </div>

            {/* Animation Visualizer - Progress Simulation */}
            <div className="border border-border/60 rounded-xl p-6 bg-muted/10 overflow-hidden relative">
                <div className="absolute top-2 right-2 flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                    <span>Live Simulation</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto">
                    <div className="border border-border/80 bg-background rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-muted-foreground">Total Progress</span>
                            <Activity className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-baseline justify-between">
                                <motion.span 
                                    animate={{ 
                                        opacity: [0.8, 1, 0.8],
                                        scale: [1, 1.02, 1]
                                    }}
                                    transition={{ duration: 3, repeat: Infinity }}
                                    className="text-xl font-bold"
                                >
                                    75%
                                </motion.span>
                                <span className="text-[10px] text-muted-foreground">15 of 20 tasks completed</span>
                            </div>
                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                <motion.div 
                                    initial={{ width: "0%" }}
                                    animate={{ width: ["60%", "75%", "60%"] }}
                                    transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                                    className="h-full bg-green-500 rounded-full"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="border border-border/80 bg-background rounded-lg p-4 space-y-3">
                        <span className="text-xs font-semibold text-muted-foreground block">Recent Activities</span>
                        <div className="space-y-2 max-h-[60px] overflow-hidden">
                            <motion.div 
                                animate={{ y: [0, -20, 0] }}
                                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                                className="space-y-2"
                            >
                                <div className="text-[10px] leading-snug border-b border-border/40 pb-1.5">
                                    <span className="font-semibold text-foreground">Project Owner</span> approved expense "Server Hosting"
                                </div>
                                <div className="text-[10px] leading-snug border-b border-border/40 pb-1.5">
                                    <span className="font-semibold text-foreground">Lead Developer</span> added task "Database Schema"
                                </div>
                                <div className="text-[10px] leading-snug">
                                    <span className="font-semibold text-foreground">Team Member</span> submitted "OAuth Integration" for review
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Core Components & Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <span className="text-xs font-bold text-foreground block">Progress Bar Analytics</span>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            Automatically aggregates all tasks from the Kanban board. Displays the mathematical ratio of completed tasks to total tasks, updating the percentage in real time.
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <span className="text-xs font-bold text-foreground block">Activity Streams</span>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            Captures operations across all categories (tasks created, modified, submitted, reviewed, or budgets updated) and displays them chronologically. The dashboard limits this view to the latest 10, with a "View All" action to load the history.
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <span className="text-xs font-bold text-foreground block">Active Milestones</span>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            Monitors active backlog items, todo objects, and tasks marked in-progress. Automatically flags high-priority or overdue milestones to alert team members.
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <span className="text-xs font-bold text-foreground block">Spot Allocation</span>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            Tracks current project enrollment against maximum member parameters, alerting leads on application capacity and available workspace slots.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

function KanbanGuide() {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-bold tracking-tight">Kanban Workflow</h3>
                <p className="text-sm text-muted-foreground mt-1">
                    The task board implements strict workflow enforcement, moving tasks from creation through execution, peer review, and final sign-off.
                </p>
            </div>

            {/* Animation Visualizer - Drag Drop & Review flow */}
            <div className="border border-border/60 rounded-xl p-4 bg-muted/10 overflow-hidden relative">
                <div className="absolute top-2 right-2 flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
                    <span className="h-2 w-2 rounded-full bg-purple-500 animate-pulse"></span>
                    <span>Workflow Loop</span>
                </div>

                <div className="flex gap-3 justify-center items-center overflow-x-auto py-4">
                    {/* To Do Column */}
                    <div className="border border-border/80 bg-background rounded p-2.5 w-36 h-28 flex flex-col justify-between shrink-0">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">To Do</span>
                        <div className="relative flex-1 flex items-center justify-center">
                            <motion.div 
                                animate={{
                                    x: [0, 160, 160, 0, 0],
                                    y: [0, 0, 0, 0, 0],
                                    opacity: [1, 1, 0, 0, 1],
                                    scale: [1, 1.05, 0.9, 0.9, 1]
                                }}
                                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                                className="w-full bg-muted border border-border rounded p-1.5 text-[9px] shadow-sm font-medium text-center"
                            >
                                API Integration
                            </motion.div>
                        </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />

                    {/* Review Column */}
                    <div className="border border-border/80 bg-background rounded p-2.5 w-36 h-28 flex flex-col justify-between shrink-0">
                        <span className="text-[10px] font-bold text-purple-600 uppercase">Review</span>
                        <div className="flex-1 flex flex-col items-center justify-center relative">
                            {/* Ghost placeholder for incoming */}
                            <div className="w-full h-8 border border-dashed border-purple-300 rounded flex items-center justify-center text-[9px] text-purple-400">
                                Pending Approval
                            </div>
                        </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />

                    {/* Done Column */}
                    <div className="border border-border/80 bg-background rounded p-2.5 w-36 h-28 flex flex-col justify-between shrink-0">
                        <span className="text-[10px] font-bold text-green-600 uppercase">Done</span>
                        <div className="flex-1 flex items-center justify-center">
                            <motion.div 
                                animate={{
                                    opacity: [0, 0, 1, 1, 0],
                                    scale: [0.9, 0.9, 1, 1, 0.9]
                                }}
                                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                                className="w-full bg-green-500/10 border border-green-200 rounded p-1.5 text-[9px] text-green-700 font-semibold text-center flex items-center justify-center gap-1"
                            >
                                <CheckCircle2 className="h-3 w-3 text-green-600" />
                                Approved
                            </motion.div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Operational Protocols</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <span className="text-xs font-bold text-foreground block">Task Submission Protocol</span>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            When a team member drags a task into the "Review" column, the platform forces a "Submit for Review" dialog. The member must input comments summarizing their output. The status updates to review, notifying the project lead.
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <span className="text-xs font-bold text-foreground block">State Locking</span>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            Tasks in the "Done" state are strictly locked for non-owners. Furthermore, general team members cannot bypass review to push tasks directly into "Done" or modify administrative parameters when in progress.
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <span className="text-xs font-bold text-foreground block">WIP (Work-In-Progress) Limits</span>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            To ensure optimal resource allocation, "In Progress" and "Review" columns support maximum limits (4 and 3 tasks respectively). Exceeding these limits highlights the column in a warning state to prevent task clogging.
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <span className="text-xs font-bold text-foreground block">Drag & Drop Controls</span>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            Uses standard pointer sensors. On mobile viewports, the dragging mechanism is deactivated to prevent conflict with scrolling, replacing dragging with directional Back/Forward navigation controls.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

function TimelineGuide() {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-bold tracking-tight">Gantt Chart & Visual Timeline</h3>
                <p className="text-sm text-muted-foreground mt-1">
                    Provides comprehensive visualization of task schedules, overlap dependencies, deadlines, and critical path milestones.
                </p>
            </div>

            {/* Animation Visualizer - Gantt timeline bar drawing */}
            <div className="border border-border/60 rounded-xl p-6 bg-muted/10 overflow-hidden relative">
                <div className="absolute top-2 right-2 flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
                    <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
                    <span>Timeline Simulation</span>
                </div>

                <div className="space-y-3 max-w-md mx-auto bg-background border border-border/80 rounded-lg p-4">
                    <div className="flex items-center gap-2 border-b border-border/40 pb-2 text-[10px] text-muted-foreground font-semibold">
                        <div className="w-24">Task Title</div>
                        <div className="flex-1 flex justify-between">
                            <span>Week 1</span>
                            <span>Week 2</span>
                            <span>Week 3</span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <div className="w-24 text-[10px] font-medium truncate">Database Setup</div>
                        <div className="flex-1 relative h-6 bg-muted/50 rounded">
                            <motion.div 
                                initial={{ width: "0%" }}
                                animate={{ width: "40%", x: "0%" }}
                                transition={{ duration: 2, ease: "easeOut" }}
                                className="absolute top-1 bottom-1 bg-blue-500/80 rounded border-l-2 border-blue-600 text-[8px] text-white flex items-center pl-1 font-semibold"
                            >
                                4 Days
                            </motion.div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="w-24 text-[10px] font-medium truncate">Authentication</div>
                        <div className="flex-1 relative h-6 bg-muted/50 rounded">
                            <motion.div 
                                initial={{ width: "0%" }}
                                animate={{ width: "50%", x: "35%" }}
                                transition={{ duration: 2.5, delay: 0.5, ease: "easeOut" }}
                                className="absolute top-1 bottom-1 bg-purple-500/80 rounded border-l-2 border-purple-600 text-[8px] text-white flex items-center pl-1 font-semibold"
                            >
                                6 Days
                            </motion.div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="w-24 text-[10px] font-medium text-destructive truncate flex items-center gap-0.5">
                            <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                            Client Portal
                        </div>
                        <div className="flex-1 relative h-6 bg-muted/50 rounded">
                            <motion.div 
                                initial={{ width: "0%" }}
                                animate={{ width: "30%", x: "70%" }}
                                transition={{ duration: 2.2, delay: 1, ease: "easeOut" }}
                                className="absolute top-1 bottom-1 bg-red-300 border border-red-500 rounded border-l-2 border-red-600 text-[8px] text-red-700 flex items-center pl-1 font-semibold"
                            >
                                Overdue
                            </motion.div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">System Mechanics</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <span className="text-xs font-bold text-foreground block">Auto-Filtering Matrix</span>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            The Gantt chart automatically ignores tasks without valid due dates. It processes start dates (creation timestamp) and end dates (due dates) to map bars along daily or weekly interval scales.
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <span className="text-xs font-bold text-foreground block">Overdue Warnings</span>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            Calculates current date status against due date fields. Tasks that exceed deadlines without a "Done" state are rendered with red borders, warnings, and their names are flagged in red.
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <span className="text-xs font-bold text-foreground block">Calendar Deadlines</span>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            The Project Calendar aggregates task records, placing event objects directly on respective dates. Helps team members track scheduling deadlines in standard calendar layouts.
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <span className="text-xs font-bold text-foreground block">Virtual Meeting Rooms</span>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            Features interactive, RTC-capable meeting spaces enabling audio/video connections alongside drawing utilities for design sprints.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

function DocsGuide() {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-bold tracking-tight">Google Drive & Document Integration</h3>
                <p className="text-sm text-muted-foreground mt-1">
                    Connects local workspaces to Google Drive cloud directories, allowing project teams to create, read, update, and manage documents.
                </p>
            </div>

            {/* Animation Visualizer - Document Tree */}
            <div className="border border-border/60 rounded-xl p-6 bg-muted/10 overflow-hidden relative">
                <div className="absolute top-2 right-2 flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
                    <span>Drive Connection</span>
                </div>

                <div className="max-w-xs mx-auto bg-background border border-border/80 rounded-lg p-4 space-y-3 font-mono">
                    <div className="flex items-center gap-2 border-b border-border/40 pb-2 text-[10px] text-muted-foreground">
                        <span>Google Workspace Drive</span>
                    </div>
                    
                    <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2 text-foreground font-semibold">
                            <span>📁</span> Project Root Directory
                        </div>
                        <div className="pl-4 space-y-1.5 text-[11px] text-muted-foreground">
                            <motion.div 
                                animate={{ x: [0, 4, 0] }}
                                transition={{ duration: 4, repeat: Infinity }}
                                className="flex items-center gap-1.5"
                            >
                                <span>📄</span> SRS Document.docx
                            </motion.div>
                            <motion.div 
                                animate={{ x: [0, 4, 0] }}
                                transition={{ duration: 4, delay: 1, repeat: Infinity }}
                                className="flex items-center gap-1.5 text-foreground font-medium"
                            >
                                <span>📄</span> Architecture Blueprint.gdoc
                            </motion.div>
                            <motion.div 
                                animate={{ x: [0, 4, 0] }}
                                transition={{ duration: 4, delay: 2, repeat: Infinity }}
                                className="flex items-center gap-1.5"
                            >
                                <span>📄</span> Marketing Assets.gsheet
                            </motion.div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Integration Architecture</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <span className="text-xs font-bold text-foreground block">Shared Cloud Directory</span>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            Project owners can link a Google Drive folder. This directory acts as the central cloud repository. All documents created on the platform automatically reside inside this folder.
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <span className="text-xs font-bold text-foreground block">OAuth 2.0 Credentials</span>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            Team members authorize using Google Sign-In, obtaining OAuth credentials. All document requests run on behalf of the member's personal credentials, keeping file-access logs clean.
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <span className="text-xs font-bold text-foreground block">Metadata Mirroring</span>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            The platform mirrors Google Drive file structures by keeping lightweight metadata references (Title, File ID, Web View Link) in Firestore. Document content stays inside Google Workspace.
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <span className="text-xs font-bold text-foreground block">Seamless CRUD Controls</span>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            Permitted users can create documents directly in Google Drive from the dashboard. Deleting a document removes metadata locally and frees folder space in the shared directory.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

function BudgetGuide() {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-bold tracking-tight">Budget & Financial Tracker</h3>
                <p className="text-sm text-muted-foreground mt-1">
                    Enforces fiscal responsibility, permitting tracking of monthly budgets and expenditures in local Rupees (₹) with administrative approval workflows.
                </p>
            </div>

            {/* Animation Visualizer - Budget tracking values updating */}
            <div className="border border-border/60 rounded-xl p-6 bg-muted/10 overflow-hidden relative">
                <div className="absolute top-2 right-2 flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Finance Engine</span>
                </div>

                <div className="space-y-4 max-w-md mx-auto">
                    <div className="grid grid-cols-3 gap-3">
                        <div className="border border-border bg-background rounded p-2.5 text-center">
                            <span className="text-[9px] text-muted-foreground uppercase font-bold block">Total Budget</span>
                            <span className="text-xs font-bold">₹1,00,000</span>
                        </div>
                        <div className="border border-border bg-background rounded p-2.5 text-center">
                            <span className="text-[9px] text-muted-foreground uppercase font-bold block">Actual Spend</span>
                            <motion.span 
                                animate={{ textShadow: ["0 0 0px rgba(0,0,0,0)", "0 0 8px rgba(16,185,129,0.3)", "0 0 0px rgba(0,0,0,0)"] }}
                                transition={{ duration: 3, repeat: Infinity }}
                                className="text-xs font-bold text-emerald-600"
                            >
                                ₹45,000
                            </motion.span>
                        </div>
                        <div className="border border-border bg-background rounded p-2.5 text-center">
                            <span className="text-[9px] text-muted-foreground uppercase font-bold block">Remaining</span>
                            <span className="text-xs font-bold text-green-700">₹55,000</span>
                        </div>
                    </div>

                    <div className="border border-border bg-background rounded p-3 text-xs space-y-1.5">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase block">Expense Approvals</span>
                        <div className="flex justify-between items-center bg-muted/40 p-1.5 rounded">
                            <span>AWS Deployment</span>
                            <span className="font-semibold text-emerald-600">₹15,000</span>
                            <span className="text-[9px] bg-green-500/10 text-green-700 font-bold px-1.5 py-0.5 rounded">Approved</span>
                        </div>
                        <div className="flex justify-between items-center bg-muted/40 p-1.5 rounded">
                            <span>Consulting Fee</span>
                            <span className="font-semibold text-amber-600">₹30,000</span>
                            <span className="text-[9px] bg-amber-500/10 text-amber-700 font-bold px-1.5 py-0.5 rounded">Pending</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Calculation Rules</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <span className="text-xs font-bold text-foreground block">Rupee (₹) Currency Mapping</span>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            All ledger entries, calculations, notifications, and analytics operate using Rupee (₹) parameters, ensuring currency localization and formatting compatibility.
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <span className="text-xs font-bold text-foreground block">Expense Frequency Multipliers</span>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            Tracks recurring operational costs. The engine projects hourly, daily, weekly, or monthly frequencies to match the monthly budget cycle (e.g. hourly * 176 hours, daily * 22 days, weekly * 4 weeks).
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <span className="text-xs font-bold text-foreground block">Expense Status Approvals</span>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            Expenses are marked "Pending" on creation. Only "Approved" expenses are subtracted from the remaining balance or counted in Category Pie Chart statistics, preventing non-approved budget drains.
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <span className="text-xs font-bold text-foreground block">Overbudget Alerts</span>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            When approved expenses cross 90% of the set budget parameter, progress bars turn red and display explicit warnings to prevent project deficit risk.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

function WhiteboardGuide() {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-bold tracking-tight">Whiteboard & Diagram Spaces</h3>
                <p className="text-sm text-muted-foreground mt-1">
                    An endless collaborative canvas enabling design modeling, flow mapping, and architectural diagramming.
                </p>
            </div>

            {/* Animation Visualizer - Whiteboard shapes drawing */}
            <div className="border border-border/60 rounded-xl p-6 bg-muted/10 overflow-hidden relative">
                <div className="absolute top-2 right-2 flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
                    <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
                    <span>Canvas Loop</span>
                </div>

                <div className="h-24 max-w-sm mx-auto bg-background border border-border/80 rounded-lg flex items-center justify-center relative overflow-hidden">
                    <svg className="h-full w-full" viewBox="0 0 300 100">
                        {/* Box 1 */}
                        <motion.rect 
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: [0, 1, 1, 0] }}
                            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                            x="20" y="30" width="60" height="40" rx="4"
                            fill="none" stroke="#6366f1" strokeWidth="2"
                        />
                        <text x="32" y="54" fontSize="8" fill="#6366f1" className="font-semibold font-mono">Client</text>

                        {/* Arrow */}
                        <motion.line 
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: [0, 1, 1, 0] }}
                            transition={{ duration: 6, delay: 1, repeat: Infinity, ease: "easeInOut" }}
                            x1="85" y1="50" x2="140" y2="50"
                            stroke="#94a3b8" strokeWidth="2"
                        />

                        {/* Box 2 */}
                        <motion.rect 
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: [0, 1, 1, 0] }}
                            transition={{ duration: 6, delay: 2, repeat: Infinity, ease: "easeInOut" }}
                            x="145" y="30" width="70" height="40" rx="4"
                            fill="none" stroke="#10b981" strokeWidth="2"
                        />
                        <text x="156" y="54" fontSize="8" fill="#10b981" className="font-semibold font-mono">App API</text>
                    </svg>
                </div>
            </div>

            <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Technical Specs</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <span className="text-xs font-bold text-foreground block">Collaborative Synchronization</span>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            Utilizes real-time database endpoints to capture element vectors, synchronization states, shapes, and brush strokes. This lets team members sketch ideas collaboratively.
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <span className="text-xs font-bold text-foreground block">Element Vector Libraries</span>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            Includes tools for creating vector shapes (rectangles, ellipses, arrows), freehand brush strokes, text objects, and sticky notes to help map flows.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

function RbacGuide() {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-bold tracking-tight">Permissions & Role-Based Access (RBAC)</h3>
                <p className="text-sm text-muted-foreground mt-1">
                    Security protocols enforce isolation, restricting write access and visibility based on user roles and workspace permissions.
                </p>
            </div>

            {/* RBAC Matrix Visual Table */}
            <div className="border border-border/60 rounded-xl overflow-hidden">
                <table className="w-full text-[11px] font-medium text-left">
                    <thead className="bg-muted/50 border-b border-border/40 text-muted-foreground font-semibold">
                        <tr>
                            <th className="p-3">Workspace Capability</th>
                            <th className="p-3">Project Owner / Lead</th>
                            <th className="p-3">Team Member</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30 bg-background/50">
                        <tr>
                            <td className="p-3 font-semibold text-foreground">Task Creation & Deletion</td>
                            <td className="p-3 text-emerald-600">Full Access</td>
                            <td className="p-3 text-muted-foreground">Blocked</td>
                        </tr>
                        <tr>
                            <td className="p-3 font-semibold text-foreground">Task Status Update</td>
                            <td className="p-3 text-emerald-600">Direct Change</td>
                            <td className="p-3 text-blue-600">Submit for Review</td>
                        </tr>
                        <tr>
                            <td className="p-3 font-semibold text-foreground">Financial Budget Settings</td>
                            <td className="p-3 text-emerald-600">Full Access</td>
                            <td className="p-3 text-muted-foreground">Read Only (Tab Hidden if Blocked)</td>
                        </tr>
                        <tr>
                            <td className="p-3 font-semibold text-foreground">Member Roster Settings</td>
                            <td className="p-3 text-emerald-600">Full Access</td>
                            <td className="p-3 text-muted-foreground">Read Only</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Access Control System</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <span className="text-xs font-bold text-foreground block">Dynamic Security Tokens</span>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            When entering the workspace, the system loads the user's role parameters. If write permissions are disabled for a section, edit features (like "New Item" or "Add Expense") are hidden.
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <span className="text-xs font-bold text-foreground block">Tab Isolation Rules</span>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            If a member does not have read permissions for a feature (e.g. Budget), the corresponding tab is completely hidden from their view.
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <span className="text-xs font-bold text-foreground block">Review Workflow Limits</span>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            Members can only edit or move tasks assigned to them, and dragging them to "Review" triggers an mandatory approval request. Done tasks cannot be modified by team members.
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <span className="text-xs font-bold text-foreground block">Firestore Security Rules</span>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            The database enforces validation at the API layer. Unauthorized requests that try to bypass front-end controls are immediately rejected by Firebase rules.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

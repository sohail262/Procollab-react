import { Timestamp } from 'firebase/firestore'
// Types for project management features

export type ProjectMethodology = 'agile' | 'scrum' | 'kanban' | 'waterfall' | 'hybrid'

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskStatus = 'backlog' | 'todo' | 'in-progress' | 'review' | 'done'

export interface Task {
    id: string
    projectId: string
    title: string
    description: string
    status: TaskStatus
    priority: TaskPriority
    assigneeId?: string
    assignee?: {
        id: string
        name: string
        avatar?: string
    }
    dueDate?: Timestamp | Date
    timeEstimate?: number // in hours
    timeSpent?: number // in hours
    tags: string[]
    attachments?: string[] // URLs
    coverImage?: string // URL
    dependencies?: string[] // task IDs
    subtasks?: {
        id: string
        title: string
        completed: boolean
    }[]
    createdAt: Timestamp | Date
    updatedAt: Timestamp | Date
    createdBy: string
    // Review-related fields
    statusNote?: string // member's note when updating status
    reviewStatus?: 'pending_review' | 'approved' | 'changes_requested' | null
    reviewNote?: string // owner's feedback
    reviewedBy?: string // owner uid
    reviewedAt?: Timestamp | Date
    submittedAt?: Timestamp | Date // when member submitted for review
    submittedBy?: string // member uid
    linkedTools?: string[]
}

export interface TimeLog {
    id: string
    taskId: string
    userId: string
    startTime: Timestamp | Date
    endTime?: Timestamp | Date
    duration: number // in minutes
    notes?: string
    createdAt: Timestamp | Date
}

export interface Resource {
    userId: string
    projectId: string
    role: string
    availability: number // hours per week
    capacity: number // percentage
    allocatedHours: number
    skills: string[]
}

export interface Milestone {
    id: string
    projectId: string
    title: string
    description?: string
    dueDate: Timestamp | Date
    status: 'pending' | 'completed' | 'overdue'
    tasks?: string[] // task IDs
}

export interface Sprint {
    id: string
    projectId: string
    name: string
    goal: string
    startDate: Timestamp | Date
    endDate: Timestamp | Date
    status: 'planned' | 'active' | 'completed'
    tasks: string[] // task IDs
}

export interface ProjectSettings {
    methodology: ProjectMethodology
    kanbanColumns: {
        id: string
        title: string
        color?: string
    }[]
    workingDays: string[] // 'monday', 'tuesday', etc.
    workingHours: {
        start: string // "09:00"
        end: string // "17:00"
    }
}

export interface ProjectTag {
    id: string
    name: string
    color: string
    description?: string
    createdAt?: string
}

export const PRESET_TAG_COLORS = [
    { name: 'Blue', hex: '#3b82f6', bgClass: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400' },
    { name: 'Emerald', hex: '#10b981', bgClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400' },
    { name: 'Purple', hex: '#8b5cf6', bgClass: 'bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400' },
    { name: 'Amber', hex: '#f59e0b', bgClass: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400' },
    { name: 'Rose', hex: '#f43f5e', bgClass: 'bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400' },
    { name: 'Indigo', hex: '#6366f1', bgClass: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:text-indigo-400' },
    { name: 'Teal', hex: '#14b8a6', bgClass: 'bg-teal-500/10 text-teal-600 border-teal-500/20 dark:text-teal-400' },
    { name: 'Orange', hex: '#f97316', bgClass: 'bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400' },
    { name: 'Cyan', hex: '#06b6d4', bgClass: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20 dark:text-cyan-400' },
    { name: 'Fuchsia', hex: '#d946ef', bgClass: 'bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20 dark:text-fuchsia-400' },
]


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

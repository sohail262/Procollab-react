import type { Task, ProjectMethodology } from '@/types/project'

// Mock AI Service for now
// In a real implementation, this would call OpenAI/Gemini API

export type AIRecommendation = {
    id: string
    type: 'risk' | 'optimization' | 'insight'
    title: string
    description: string
    confidence: number
    action?: string
}

export const aiService = {
    analyzeProjectRisks: async (tasks: Task[]): Promise<AIRecommendation[]> => {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000))

        const risks: AIRecommendation[] = []
        const overdueTasks = tasks.filter(t => t.dueDate && new Date(t.dueDate.toString()) < new Date() && t.status !== 'done')

        if (overdueTasks.length > 0) {
            risks.push({
                id: 'risk-1',
                type: 'risk',
                title: 'Deadline Risk',
                description: `${overdueTasks.length} tasks are overdue. Consider rescheduling or adding resources.`,
                confidence: 0.95,
                action: 'Reschedule Tasks'
            })
        }

        const highPriorityBacklog = tasks.filter(t => t.priority === 'high' && t.status === 'backlog')
        if (highPriorityBacklog.length > 2) {
            risks.push({
                id: 'risk-2',
                type: 'risk',
                title: 'Bottleneck Detected',
                description: 'High priority tasks are piling up in the backlog.',
                confidence: 0.85,
                action: 'Review Backlog'
            })
        }

        return risks
    },

    getOptimizationSuggestions: async (tasks: Task[], methodology: ProjectMethodology): Promise<AIRecommendation[]> => {
        await new Promise(resolve => setTimeout(resolve, 1000))

        const suggestions: AIRecommendation[] = []

        if (methodology === 'kanban') {
            const inProgress = tasks.filter(t => t.status === 'in-progress')
            if (inProgress.length > 5) {
                suggestions.push({
                    id: 'opt-1',
                    type: 'optimization',
                    title: 'WIP Limit Exceeded',
                    description: 'Too many tasks in progress. Consider lowering WIP limit to improve flow.',
                    confidence: 0.9,
                    action: 'Adjust WIP Limits'
                })
            }
        }

        return suggestions
    },

    generateProgressReport: async (tasks: Task[]): Promise<string> => {
        await new Promise(resolve => setTimeout(resolve, 1500))

        const completed = tasks.filter(t => t.status === 'done').length
        const total = tasks.length
        const percentage = Math.round((completed / total) * 100) || 0

        return `Project is ${percentage}% complete. The team has completed ${completed} out of ${total} tasks. Velocity is stable.`
    }
}

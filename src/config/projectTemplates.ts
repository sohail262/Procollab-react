// src/config/projectTemplates.ts
import type { ProjectMethodology } from '@/types/project'

export type TemplateCategory =
    | 'software'
    | 'design'
    | 'research'
    | 'marketing'
    | 'education'
    | 'general'

export interface TemplateTask {
    title:       string
    description: string
    status:      'backlog' | 'todo' | 'in-progress' | 'review' | 'done'
    priority:    'low' | 'medium' | 'high' | 'urgent'
    tags:        string[]
    timeEstimate?: number // minutes
}

export interface TemplateMilestone {
    title:       string
    description: string
    daysFromStart: number // relative due date
}

export interface TemplateSprint {
    name:   string
    goals:  string[]
    durationDays: number
}

export interface ProjectTemplate {
    id:          string
    name:        string
    description: string
    category:    TemplateCategory
    emoji:       string
    methodology: ProjectMethodology
    estimatedWeeks: number
    difficulty:  'beginner' | 'intermediate' | 'advanced'
    tags:        string[]
    tasks:       TemplateTask[]
    milestones:  TemplateMilestone[]
    sprints:     TemplateSprint[]
    preview: {
        taskCount:      number
        milestoneCount: number
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────
export const PROJECT_TEMPLATES: ProjectTemplate[] = [

    // ── Web Application (Agile) ───────────────────────────────────────────────
    {
        id:          'web-app-agile',
        name:        'Web Application',
        description: 'Full-stack web app with frontend, backend, and deployment pipeline.',
        category:    'software',
        emoji:       '🌐',
        methodology: 'agile',
        estimatedWeeks: 8,
        difficulty:  'intermediate',
        tags:        ['web', 'fullstack', 'agile'],
        tasks: [
            // Sprint 1 — Foundation
            {
                title:       'Set up project repository',
                description: 'Initialize Git repo, configure branching strategy (main/develop/feature).',
                status:      'todo', priority: 'urgent',
                tags:        ['setup', 'devops'], timeEstimate: 60,
            },
            {
                title:       'Configure development environment',
                description: 'Set up linting, formatting, and pre-commit hooks.',
                status:      'todo', priority: 'high',
                tags:        ['setup', 'devops'], timeEstimate: 120,
            },
            {
                title:       'Design database schema',
                description: 'Define entities, relationships, and indexes. Create ER diagram.',
                status:      'todo', priority: 'high',
                tags:        ['backend', 'design'], timeEstimate: 180,
            },
            {
                title:       'Create UI wireframes',
                description: 'Low-fidelity wireframes for all main screens.',
                status:      'todo', priority: 'high',
                tags:        ['frontend', 'design'], timeEstimate: 240,
            },
            // Sprint 2 — Core
            {
                title:       'Implement authentication',
                description: 'User registration, login, logout, and session management.',
                status:      'backlog', priority: 'urgent',
                tags:        ['backend', 'auth'], timeEstimate: 480,
            },
            {
                title:       'Build REST API endpoints',
                description: 'CRUD operations for all main resources.',
                status:      'backlog', priority: 'high',
                tags:        ['backend', 'api'], timeEstimate: 720,
            },
            {
                title:       'Build core UI components',
                description: 'Reusable component library (buttons, forms, cards, modals).',
                status:      'backlog', priority: 'medium',
                tags:        ['frontend', 'components'], timeEstimate: 480,
            },
            // Sprint 3 — Integration
            {
                title:       'Connect frontend to API',
                description: 'Wire up all UI screens to their respective API endpoints.',
                status:      'backlog', priority: 'high',
                tags:        ['integration', 'frontend'], timeEstimate: 600,
            },
            {
                title:       'Write unit tests',
                description: 'Test coverage for all API endpoints and key frontend components.',
                status:      'backlog', priority: 'medium',
                tags:        ['testing', 'quality'], timeEstimate: 360,
            },
            // Sprint 4 — Launch
            {
                title:       'Set up CI/CD pipeline',
                description: 'GitHub Actions for automated testing and deployment.',
                status:      'backlog', priority: 'medium',
                tags:        ['devops', 'automation'], timeEstimate: 300,
            },
            {
                title:       'Performance optimization',
                description: 'Lighthouse audit, lazy loading, caching, and bundle optimization.',
                status:      'backlog', priority: 'medium',
                tags:        ['performance', 'frontend'], timeEstimate: 360,
            },
            {
                title:       'Deploy to production',
                description: 'Deploy and verify all systems are running correctly.',
                status:      'backlog', priority: 'urgent',
                tags:        ['devops', 'launch'], timeEstimate: 240,
            },
        ],
        milestones: [
            {
                title:         'Project Kickoff',
                description:   'Repository set up, team aligned, tech stack decided.',
                daysFromStart: 7,
            },
            {
                title:         'Alpha Release',
                description:   'Core features working end-to-end in a dev environment.',
                daysFromStart: 28,
            },
            {
                title:         'Beta Release',
                description:   'Feature complete, testing in progress.',
                daysFromStart: 49,
            },
            {
                title:         'Production Launch',
                description:   'Deployed and publicly available.',
                daysFromStart: 56,
            },
        ],
        sprints: [
            {
                name:         'Sprint 1 — Foundation',
                goals:        ['Repo setup', 'DB schema', 'Wireframes'],
                durationDays: 14,
            },
            {
                name:         'Sprint 2 — Core Features',
                goals:        ['Auth', 'API', 'Core UI'],
                durationDays: 14,
            },
            {
                name:         'Sprint 3 — Integration',
                goals:        ['API integration', 'Testing'],
                durationDays: 14,
            },
            {
                name:         'Sprint 4 — Launch',
                goals:        ['CI/CD', 'Performance', 'Deploy'],
                durationDays: 14,
            },
        ],
        preview: { taskCount: 12, milestoneCount: 4 },
    },

    // ── Mobile App (Scrum) ───────────────────────────────────────────────────
    {
        id:          'mobile-app-scrum',
        name:        'Mobile Application',
        description: 'Cross-platform mobile app using Scrum with 2-week sprints.',
        category:    'software',
        emoji:       '📱',
        methodology: 'scrum',
        estimatedWeeks: 10,
        difficulty:  'advanced',
        tags:        ['mobile', 'scrum', 'cross-platform'],
        tasks: [
            {
                title:       'Define app navigation structure',
                description: 'Design the screen hierarchy and navigation flow.',
                status:      'todo', priority: 'urgent',
                tags:        ['design', 'ux'], timeEstimate: 180,
            },
            {
                title:       'Set up state management',
                description: 'Configure global state management solution.',
                status:      'todo', priority: 'high',
                tags:        ['architecture', 'frontend'], timeEstimate: 240,
            },
            {
                title:       'Implement push notifications',
                description: 'Configure push notification service and handlers.',
                status:      'backlog', priority: 'medium',
                tags:        ['backend', 'notifications'], timeEstimate: 360,
            },
            {
                title:       'Offline mode support',
                description: 'Implement local caching for offline functionality.',
                status:      'backlog', priority: 'high',
                tags:        ['frontend', 'performance'], timeEstimate: 480,
            },
            {
                title:       'App store submission',
                description: 'Prepare and submit to iOS App Store and Google Play.',
                status:      'backlog', priority: 'urgent',
                tags:        ['launch', 'devops'], timeEstimate: 300,
            },
        ],
        milestones: [
            { title: 'MVP Ready',        description: 'Core screens working.',          daysFromStart: 21  },
            { title: 'Beta TestFlight',  description: 'Internal testing build.',        daysFromStart: 42  },
            { title: 'Store Submission', description: 'Submitted to app stores.',       daysFromStart: 63  },
            { title: 'Public Launch',    description: 'App live on stores.',            daysFromStart: 70  },
        ],
        sprints: [
            { name: 'Sprint 1 — Core Screens', goals: ['Navigation', 'Auth screens', 'Home screen'], durationDays: 14 },
            { name: 'Sprint 2 — Data Layer',   goals: ['API integration', 'State management'],       durationDays: 14 },
            { name: 'Sprint 3 — Features',     goals: ['Push notifications', 'Offline mode'],        durationDays: 14 },
            { name: 'Sprint 4 — Polish',        goals: ['Animations', 'Performance', 'Accessibility'],durationDays: 14 },
            { name: 'Sprint 5 — Launch',        goals: ['Store assets', 'Submission'],               durationDays: 14 },
        ],
        preview: { taskCount: 5, milestoneCount: 4 },
    },

    // ── Research Project (Waterfall) ─────────────────────────────────────────
    {
        id:          'research-waterfall',
        name:        'Research Project',
        description: 'Academic or professional research with sequential phases and deliverables.',
        category:    'research',
        emoji:       '🔬',
        methodology: 'waterfall',
        estimatedWeeks: 12,
        difficulty:  'intermediate',
        tags:        ['research', 'academic', 'waterfall'],
        tasks: [
            {
                title:       'Define research questions',
                description: 'Formulate clear, specific, and measurable research questions.',
                status:      'todo', priority: 'urgent',
                tags:        ['requirements', 'planning'], timeEstimate: 240,
            },
            {
                title:       'Literature review',
                description: 'Review existing research and identify gaps.',
                status:      'todo', priority: 'high',
                tags:        ['research', 'analysis'], timeEstimate: 1200,
            },
            {
                title:       'Design methodology',
                description: 'Define data collection and analysis methods.',
                status:      'backlog', priority: 'high',
                tags:        ['design', 'methodology'], timeEstimate: 480,
            },
            {
                title:       'Collect data',
                description: 'Execute data collection according to methodology.',
                status:      'backlog', priority: 'high',
                tags:        ['data', 'collection'], timeEstimate: 1440,
            },
            {
                title:       'Analyze results',
                description: 'Apply statistical or qualitative analysis to collected data.',
                status:      'backlog', priority: 'high',
                tags:        ['analysis', 'data'], timeEstimate: 960,
            },
            {
                title:       'Write final report',
                description: 'Document findings, methodology, and conclusions.',
                status:      'backlog', priority: 'urgent',
                tags:        ['documentation', 'writing'], timeEstimate: 1440,
            },
        ],
        milestones: [
            { title: 'Research Proposal Approved', description: 'Questions and methodology signed off.', daysFromStart: 14  },
            { title: 'Data Collection Complete',   description: 'All data gathered and cleaned.',        daysFromStart: 56  },
            { title: 'Analysis Complete',          description: 'Results analyzed and validated.',       daysFromStart: 70  },
            { title: 'Final Report Submitted',     description: 'Report delivered.',                     daysFromStart: 84  },
        ],
        sprints: [],
        preview: { taskCount: 6, milestoneCount: 4 },
    },

    // ── Marketing Campaign (Kanban) ───────────────────────────────────────────
    {
        id:          'marketing-kanban',
        name:        'Marketing Campaign',
        description: 'Continuous content and campaign delivery with Kanban flow.',
        category:    'marketing',
        emoji:       '📣',
        methodology: 'kanban',
        estimatedWeeks: 6,
        difficulty:  'beginner',
        tags:        ['marketing', 'content', 'kanban'],
        tasks: [
            {
                title:       'Define target audience',
                description: 'Create detailed buyer personas for this campaign.',
                status:      'todo', priority: 'urgent',
                tags:        ['strategy', 'research'], timeEstimate: 180,
            },
            {
                title:       'Content calendar',
                description: 'Plan all content pieces for the campaign duration.',
                status:      'todo', priority: 'high',
                tags:        ['planning', 'content'], timeEstimate: 240,
            },
            {
                title:       'Design visual assets',
                description: 'Create banners, social media graphics, and ad creatives.',
                status:      'backlog', priority: 'high',
                tags:        ['design', 'creative'], timeEstimate: 480,
            },
            {
                title:       'Write blog articles',
                description: 'SEO-optimized articles for organic traffic.',
                status:      'backlog', priority: 'medium',
                tags:        ['content', 'seo'], timeEstimate: 720,
            },
            {
                title:       'Set up analytics tracking',
                description: 'Configure UTM parameters, conversions, and dashboards.',
                status:      'backlog', priority: 'high',
                tags:        ['analytics', 'tracking'], timeEstimate: 180,
            },
            {
                title:       'Launch email campaign',
                description: 'Set up automated email sequences and triggers.',
                status:      'backlog', priority: 'high',
                tags:        ['email', 'automation'], timeEstimate: 360,
            },
        ],
        milestones: [
            { title: 'Campaign Brief Approved', description: 'Strategy and budget signed off.', daysFromStart: 7  },
            { title: 'Assets Ready',            description: 'All creative assets completed.',  daysFromStart: 21 },
            { title: 'Campaign Live',           description: 'All channels active.',            daysFromStart: 28 },
        ],
        sprints: [],
        preview: { taskCount: 6, milestoneCount: 3 },
    },

    // ── Student Capstone Project (Hybrid) ────────────────────────────────────
    {
        id:          'student-capstone',
        name:        'Student Capstone Project',
        description: 'Academic capstone with structured phases and agile execution. Perfect for final-year projects.',
        category:    'education',
        emoji:       '🎓',
        methodology: 'hybrid',
        estimatedWeeks: 16,
        difficulty:  'intermediate',
        tags:        ['student', 'academic', 'capstone', 'hybrid'],
        tasks: [
            {
                title:       'Submit project proposal',
                description: 'Write and submit a formal project proposal to your supervisor.',
                status:      'todo', priority: 'urgent',
                tags:        ['milestone', 'documentation'], timeEstimate: 480,
            },
            {
                title:       'Literature review',
                description: 'Survey existing work related to your project topic.',
                status:      'todo', priority: 'high',
                tags:        ['research', 'academic'], timeEstimate: 960,
            },
            {
                title:       'System requirements specification',
                description: 'Document functional and non-functional requirements.',
                status:      'backlog', priority: 'high',
                tags:        ['documentation', 'planning'], timeEstimate: 480,
            },
            {
                title:       'Prototype / Proof of Concept',
                description: 'Build a basic prototype to validate your approach.',
                status:      'backlog', priority: 'high',
                tags:        ['development', 'prototype'], timeEstimate: 1200,
            },
            {
                title:       'Supervisor check-in meeting',
                description: 'Schedule and prepare for your progress review meeting.',
                status:      'backlog', priority: 'medium',
                tags:        ['milestone', 'review'], timeEstimate: 60,
            },
            {
                title:       'Build core system',
                description: 'Implement the main features of your project.',
                status:      'backlog', priority: 'urgent',
                tags:        ['development', 'core'], timeEstimate: 4800,
            },
            {
                title:       'User testing',
                description: 'Conduct user testing sessions and collect feedback.',
                status:      'backlog', priority: 'high',
                tags:        ['testing', 'ux'], timeEstimate: 720,
            },
            {
                title:       'Write final dissertation/report',
                description: 'Complete the full project write-up.',
                status:      'backlog', priority: 'urgent',
                tags:        ['documentation', 'academic'], timeEstimate: 4800,
            },
            {
                title:       'Prepare presentation/demo',
                description: 'Create slides and rehearse for the final presentation.',
                status:      'backlog', priority: 'high',
                tags:        ['milestone', 'presentation'], timeEstimate: 480,
            },
        ],
        milestones: [
            { title: 'Proposal Approved',      description: 'Supervisor signs off on topic.', daysFromStart: 14  },
            { title: 'Design Phase Complete',  description: 'Architecture and wireframes done.', daysFromStart: 42 },
            { title: 'Prototype Demo',         description: 'Working prototype shown to supervisor.', daysFromStart: 63 },
            { title: 'Feature Freeze',         description: 'No new features, only fixes.',    daysFromStart: 98  },
            { title: 'Final Submission',       description: 'Report and code submitted.',      daysFromStart: 112 },
        ],
        sprints: [
            { name: 'Phase 1 — Research & Planning', goals: ['Proposal', 'Literature review', 'SRS'], durationDays: 21 },
            { name: 'Phase 2 — Design',              goals: ['Architecture', 'Wireframes', 'Prototype'], durationDays: 21 },
            { name: 'Phase 3 — Development',         goals: ['Core system', 'Integrations'], durationDays: 42 },
            { name: 'Phase 4 — Testing & Write-up',  goals: ['User testing', 'Dissertation'], durationDays: 28 },
        ],
        preview: { taskCount: 9, milestoneCount: 5 },
    },

    // ── Design System (Agile) ─────────────────────────────────────────────────
    {
        id:          'design-system',
        name:        'Design System',
        description: 'Build a comprehensive component library and design system from scratch.',
        category:    'design',
        emoji:       '🎨',
        methodology: 'agile',
        estimatedWeeks: 6,
        difficulty:  'intermediate',
        tags:        ['design', 'components', 'ui'],
        tasks: [
            {
                title:       'Define design tokens',
                description: 'Colours, typography, spacing, shadows, and border radii.',
                status:      'todo', priority: 'urgent',
                tags:        ['tokens', 'design'], timeEstimate: 240,
            },
            {
                title:       'Build Button component',
                description: 'All variants: primary, secondary, ghost, destructive.',
                status:      'todo', priority: 'high',
                tags:        ['component', 'ui'], timeEstimate: 180,
            },
            {
                title:       'Build Form components',
                description: 'Input, Select, Checkbox, Radio, Textarea with validation states.',
                status:      'backlog', priority: 'high',
                tags:        ['component', 'forms'], timeEstimate: 480,
            },
            {
                title:       'Build Navigation components',
                description: 'Navbar, Sidebar, Breadcrumbs, Tabs.',
                status:      'backlog', priority: 'medium',
                tags:        ['component', 'navigation'], timeEstimate: 360,
            },
            {
                title:       'Write Storybook documentation',
                description: 'Document every component with usage examples.',
                status:      'backlog', priority: 'medium',
                tags:        ['documentation', 'storybook'], timeEstimate: 480,
            },
        ],
        milestones: [
            { title: 'Tokens Defined',      description: 'All design tokens agreed on.', daysFromStart: 7  },
            { title: 'Core Components',     description: 'Essential components built.',  daysFromStart: 28 },
            { title: 'System Published',    description: 'NPM package or Figma published.', daysFromStart: 42 },
        ],
        sprints: [
            { name: 'Sprint 1 — Foundation',   goals: ['Tokens', 'Core components'], durationDays: 14 },
            { name: 'Sprint 2 — Components',   goals: ['Forms', 'Navigation', 'Layout'], durationDays: 14 },
            { name: 'Sprint 3 — Polish & Docs', goals: ['Storybook', 'Accessibility', 'Publish'], durationDays: 14 },
        ],
        preview: { taskCount: 5, milestoneCount: 3 },
    },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const getTemplatesByMethodology = (m: ProjectMethodology) =>
    PROJECT_TEMPLATES.filter(t => t.methodology === m)

export const getTemplatesByCategory = (c: TemplateCategory) =>
    PROJECT_TEMPLATES.filter(t => t.category === c)

export const getTemplateById = (id: string) =>
    PROJECT_TEMPLATES.find(t => t.id === id)

export const TEMPLATE_CATEGORIES: {
    id:    TemplateCategory
    label: string
    emoji: string
}[] = [
    { id: 'software',  label: 'Software',  emoji: '💻' },
    { id: 'design',    label: 'Design',    emoji: '🎨' },
    { id: 'research',  label: 'Research',  emoji: '🔬' },
    { id: 'marketing', label: 'Marketing', emoji: '📣' },
    { id: 'education', label: 'Education', emoji: '🎓' },
    { id: 'general',   label: 'General',   emoji: '📋' },
]
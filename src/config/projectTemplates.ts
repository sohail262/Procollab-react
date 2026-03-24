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

export interface TemplateDocument {
    title:   string
    content: string // HTML
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
    documents:   TemplateDocument[]
    sprints:     TemplateSprint[]
    preview: {
        taskCount:      number
        milestoneCount: number
        docCount:       number
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
        documents: [
            {
                title: '📋 Project Requirements',
                content: `
                    <h2>Project Overview</h2>
                    <p>Describe your web application here.</p>
                    <h2>Functional Requirements</h2>
                    <ul>
                        <li>User authentication and authorization</li>
                        <li>Core feature 1</li>
                        <li>Core feature 2</li>
                    </ul>
                    <h2>Non-Functional Requirements</h2>
                    <ul>
                        <li>Response time &lt; 200ms for API calls</li>
                        <li>Mobile responsive design</li>
                        <li>99.9% uptime SLA</li>
                    </ul>
                    <h2>Tech Stack</h2>
                    <ul>
                        <li><strong>Frontend:</strong> </li>
                        <li><strong>Backend:</strong> </li>
                        <li><strong>Database:</strong> </li>
                        <li><strong>Hosting:</strong> </li>
                    </ul>
                `,
            },
            {
                title: '🏗 Architecture Overview',
                content: `
                    <h2>System Architecture</h2>
                    <p>Describe the high-level architecture here.</p>
                    <h2>Components</h2>
                    <ul>
                        <li><strong>Frontend:</strong> SPA communicating with REST API</li>
                        <li><strong>Backend:</strong> REST API server</li>
                        <li><strong>Database:</strong> Relational/NoSQL</li>
                        <li><strong>CDN:</strong> Static asset delivery</li>
                    </ul>
                    <h2>Data Flow</h2>
                    <p>Client → API Gateway → Backend → Database</p>
                `,
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
        preview: { taskCount: 12, milestoneCount: 4, docCount: 2 },
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
        documents: [
            {
                title: '📱 App Specification',
                content: `
                    <h2>App Overview</h2>
                    <p>Describe your mobile app here.</p>
                    <h2>Target Platforms</h2>
                    <ul><li>iOS (minimum version: )</li><li>Android (minimum API: )</li></ul>
                    <h2>Key Features</h2>
                    <ul><li>Feature 1</li><li>Feature 2</li><li>Feature 3</li></ul>
                `,
            },
        ],
        sprints: [
            { name: 'Sprint 1 — Core Screens', goals: ['Navigation', 'Auth screens', 'Home screen'], durationDays: 14 },
            { name: 'Sprint 2 — Data Layer',   goals: ['API integration', 'State management'],       durationDays: 14 },
            { name: 'Sprint 3 — Features',     goals: ['Push notifications', 'Offline mode'],        durationDays: 14 },
            { name: 'Sprint 4 — Polish',        goals: ['Animations', 'Performance', 'Accessibility'],durationDays: 14 },
            { name: 'Sprint 5 — Launch',        goals: ['Store assets', 'Submission'],               durationDays: 14 },
        ],
        preview: { taskCount: 5, milestoneCount: 4, docCount: 1 },
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
        documents: [
            {
                title: '📄 Research Proposal',
                content: `
                    <h2>Research Title</h2>
                    <p>[Title here]</p>
                    <h2>Problem Statement</h2>
                    <p>Describe the problem being investigated.</p>
                    <h2>Research Questions</h2>
                    <ol><li>Question 1</li><li>Question 2</li></ol>
                    <h2>Methodology</h2>
                    <p>Describe your research approach.</p>
                    <h2>Expected Outcomes</h2>
                    <p>What do you expect to find?</p>
                `,
            },
            {
                title: '📊 Data Collection Plan',
                content: `
                    <h2>Data Sources</h2>
                    <p>List your data sources.</p>
                    <h2>Collection Methods</h2>
                    <ul><li>Surveys</li><li>Interviews</li><li>Observations</li></ul>
                    <h2>Sample Size</h2>
                    <p>Define your sample size and selection criteria.</p>
                `,
            },
        ],
        sprints: [],
        preview: { taskCount: 6, milestoneCount: 4, docCount: 2 },
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
        documents: [
            {
                title: '📣 Campaign Brief',
                content: `
                    <h2>Campaign Objective</h2>
                    <p>Describe what this campaign aims to achieve.</p>
                    <h2>Target Audience</h2>
                    <p>Who are we targeting?</p>
                    <h2>Key Messages</h2>
                    <ul><li>Message 1</li><li>Message 2</li></ul>
                    <h2>Channels</h2>
                    <ul><li>Social Media</li><li>Email</li><li>Blog</li></ul>
                    <h2>Success Metrics (KPIs)</h2>
                    <ul><li>Impressions: </li><li>Conversions: </li><li>ROI: </li></ul>
                `,
            },
        ],
        sprints: [],
        preview: { taskCount: 6, milestoneCount: 3, docCount: 1 },
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
        documents: [
            {
                title: '🎓 Project Proposal',
                content: `
                    <h2>Project Title</h2>
                    <p>[Your project title here]</p>
                    <h2>Problem Statement</h2>
                    <p>What problem are you solving?</p>
                    <h2>Proposed Solution</h2>
                    <p>How will your project solve it?</p>
                    <h2>Objectives</h2>
                    <ol>
                        <li>Objective 1</li>
                        <li>Objective 2</li>
                        <li>Objective 3</li>
                    </ol>
                    <h2>Scope</h2>
                    <p>Define the boundaries of your project.</p>
                    <h2>Timeline Overview</h2>
                    <ul>
                        <li>Weeks 1-2: Research and Planning</li>
                        <li>Weeks 3-6: Design</li>
                        <li>Weeks 7-12: Development</li>
                        <li>Weeks 13-14: Testing</li>
                        <li>Weeks 15-16: Write-up</li>
                    </ul>
                `,
            },
            {
                title: '📝 Meeting Notes Template',
                content: `
                    <h2>Supervisor Meeting — [Date]</h2>
                    <h3>Attendees</h3>
                    <ul><li>Student: </li><li>Supervisor: </li></ul>
                    <h3>Progress Since Last Meeting</h3>
                    <ul><li>Completed: </li></ul>
                    <h3>Issues / Blockers</h3>
                    <ul><li></li></ul>
                    <h3>Feedback Received</h3>
                    <p></p>
                    <h3>Action Items</h3>
                    <ul><li> — Due: </li></ul>
                    <h3>Next Meeting</h3>
                    <p>Date: </p>
                `,
            },
        ],
        sprints: [
            { name: 'Phase 1 — Research & Planning', goals: ['Proposal', 'Literature review', 'SRS'], durationDays: 21 },
            { name: 'Phase 2 — Design',              goals: ['Architecture', 'Wireframes', 'Prototype'], durationDays: 21 },
            { name: 'Phase 3 — Development',         goals: ['Core system', 'Integrations'], durationDays: 42 },
            { name: 'Phase 4 — Testing & Write-up',  goals: ['User testing', 'Dissertation'], durationDays: 28 },
        ],
        preview: { taskCount: 9, milestoneCount: 5, docCount: 2 },
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
        documents: [
            {
                title: '🎨 Design System Guidelines',
                content: `
                    <h2>Brand Values</h2>
                    <p>What principles guide your design decisions?</p>
                    <h2>Colour Palette</h2>
                    <ul><li>Primary: </li><li>Secondary: </li><li>Neutral: </li></ul>
                    <h2>Typography Scale</h2>
                    <ul><li>Heading 1: </li><li>Body: </li><li>Caption: </li></ul>
                    <h2>Spacing System</h2>
                    <p>Base unit: 4px. Scale: 4, 8, 12, 16, 24, 32, 48, 64...</p>
                    <h2>Component Naming Convention</h2>
                    <p>PascalCase for components, kebab-case for CSS classes.</p>
                `,
            },
        ],
        sprints: [
            { name: 'Sprint 1 — Foundation',   goals: ['Tokens', 'Core components'], durationDays: 14 },
            { name: 'Sprint 2 — Components',   goals: ['Forms', 'Navigation', 'Layout'], durationDays: 14 },
            { name: 'Sprint 3 — Polish & Docs', goals: ['Storybook', 'Accessibility', 'Publish'], durationDays: 14 },
        ],
        preview: { taskCount: 5, milestoneCount: 3, docCount: 1 },
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
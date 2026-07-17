import React, { useState, useEffect } from 'react'
import { 
    Plus, Trash2, ArrowLeft, Download, RotateCcw, 
    FileText, User, GraduationCap, Briefcase, 
    FolderGit, CheckSquare, PlusCircle, Link as LinkIcon, X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { auth, storage } from '@/lib/firebase'
import { ref, uploadBytes } from 'firebase/storage'
import { useToast } from '@/hooks/use-toast'


// ── Types ─────────────────────────────────────────────────────────────────────
interface PersonalInfo {
    name: string
    phone: string
    email: string
    linkedin: string
    github: string
}

interface EducationItem {
    id: string
    institution: string
    location: string
    degree: string
    dateRange: string
}

interface ExperienceItem {
    id: string
    role: string
    company: string
    location: string
    dateRange: string
    bullets: string[]
}

interface ProjectItem {
    id: string
    title: string
    technologies: string
    dateRange: string
    bullets: string[]
}

interface SkillCategory {
    id: string
    category: string // e.g. "Languages"
    items: string // e.g. "Java, Python, C/C++"
}

interface CustomItem {
    id: string
    heading: string
    subheading?: string
    location?: string
    dateRange?: string
    bullets: string[]
}

interface CustomSection {
    id: string
    title: string // e.g. "Achievements", "Extra-Curricular Activities"
    items: CustomItem[]
}

interface ResumeData {
    personalInfo: PersonalInfo
    education: EducationItem[]
    experience: ExperienceItem[]
    projects: ProjectItem[]
    skills: SkillCategory[]
    customSections: CustomSection[]
}

// ── Sample Template Data (Jake Ryan format) ───────────────────────────────────
const SAMPLE_RESUME_DATA: ResumeData = {
    personalInfo: {
        name: 'Jake Ryan',
        phone: '123-456-7890',
        email: 'jake@su.edu',
        linkedin: 'linkedin.com/in/jake',
        github: 'github.com/jake'
    },
    education: [
        {
            id: 'edu-1',
            institution: 'Southwestern University',
            location: 'Georgetown, TX',
            degree: 'Bachelor of Arts in Computer Science, Minor in Business',
            dateRange: 'Aug. 2018 – May 2021'
        },
        {
            id: 'edu-2',
            institution: 'Blinn College',
            location: 'Bryan, TX',
            degree: 'Associate\'s in Liberal Arts',
            dateRange: 'Aug. 2014 – May 2018'
        }
    ],
    experience: [
        {
            id: 'exp-1',
            role: 'Undergraduate Research Assistant',
            company: 'Texas A&M University',
            location: 'College Station, TX',
            dateRange: 'June 2020 – Present',
            bullets: [
                'Developed a REST API using FastAPI and PostgreSQL to store data from learning management systems',
                'Developed a full-stack web application using Flask, React, PostgreSQL and Docker to analyze GitHub data',
                'Explored ways to visualize GitHub collaboration in a classroom setting'
            ]
        },
        {
            id: 'exp-2',
            role: 'Information Technology Support Specialist',
            company: 'Southwestern University',
            location: 'Georgetown, TX',
            dateRange: 'Sep. 2018 – Present',
            bullets: [
                'Communicate with managers to set up campus computers used on campus',
                'Assess and troubleshoot computer problems brought by students, faculty and staff',
                'Maintain upkeep of computers, classroom equipment, and 200 printers across campus'
            ]
        },
        {
            id: 'exp-3',
            role: 'Artificial Intelligence Research Assistant',
            company: 'Southwestern University',
            location: 'Georgetown, TX',
            dateRange: 'May 2019 – July 2019',
            bullets: [
                'Explored methods to generate video game dungeons based off of The Legend of Zelda',
                'Developed a game in Java to test the generated dungeons',
                'Contributed 50K+ lines of code to an established codebase via Git',
                'Conducted a human subject study to determine which video game dungeon generation technique is enjoyable',
                'Wrote an 8-page paper and gave multiple presentations on-campus',
                'Presented virtually to the World Conference on Computational Intelligence'
            ]
        }
    ],
    projects: [
        {
            id: 'proj-1',
            title: 'Gitlytics',
            technologies: 'Python, Flask, React, PostgreSQL, Docker',
            dateRange: 'June 2020 – Present',
            bullets: [
                'Developed a full-stack web application using with Flask serving a REST API with React as the frontend',
                'Implemented GitHub OAuth to get data from user\'s repositories',
                'Visualized GitHub data to show collaboration',
                'Used Celery and Redis for asynchronous tasks'
            ]
        },
        {
            id: 'proj-2',
            title: 'Simple Paintball',
            technologies: 'Spigot API, Java, Maven, TravisCI, Git',
            dateRange: 'May 2018 – May 2020',
            bullets: [
                'Developed a Minecraft server plugin to entertain kids during free time for a previous job',
                'Published plugin to websites gaining 2K+ downloads and an average 4.5/5-star review',
                'Implemented continuous delivery using TravisCI to build the plugin upon new a release',
                'Collaborated with Minecraft server administrators to suggest features and get feedback about the plugin'
            ]
        }
    ],
    skills: [
        {
            id: 'skill-1',
            category: 'Languages',
            items: 'Java, Python, C/C++, SQL (Postgres), JavaScript, HTML/CSS, R'
        },
        {
            id: 'skill-2',
            category: 'Frameworks',
            items: 'React, Node.js, Flask, JUnit, WordPress, Material-UI, FastAPI'
        },
        {
            id: 'skill-3',
            category: 'Developer Tools',
            items: 'Git, Docker, TravisCI, Google Cloud Platform, VS Code, Visual Studio, PyCharm, IntelliJ, Eclipse'
        },
        {
            id: 'skill-4',
            category: 'Libraries',
            items: 'pandas, NumPy, Matplotlib'
        }
    ],
    customSections: []
}

interface ResumeBuilderProps {
    onClose: () => void
}

export function ResumeBuilder({ onClose }: ResumeBuilderProps) {
    const { toast } = useToast()
    const [isExporting, setIsExporting] = useState(false)
    const [resumeData, setResumeData] = useState<ResumeData>(() => {
        const saved = localStorage.getItem('procollab_resume_draft')
        if (saved) {
            try {
                return JSON.parse(saved)
            } catch {
                return SAMPLE_RESUME_DATA
            }
        }
        return SAMPLE_RESUME_DATA
    })

    const [activeTab, setActiveTab] = useState<'personal' | 'education' | 'experience' | 'projects' | 'skills' | 'custom'>('personal')

    // Auto-save draft locally
    useEffect(() => {
        localStorage.setItem('procollab_resume_draft', JSON.stringify(resumeData))
    }, [resumeData])

    const resetToSample = () => {
        if (window.confirm('Reset draft to Jake Ryan\'s sample template? This will overwrite your current edits.')) {
            setResumeData(SAMPLE_RESUME_DATA)
        }
    }

    const clearAll = () => {
        if (window.confirm('Are you sure you want to clear all data in the resume builder?')) {
            setResumeData({
                personalInfo: { name: '', phone: '', email: '', linkedin: '', github: '' },
                education: [],
                experience: [],
                projects: [],
                skills: [],
                customSections: []
            })
        }
    }

    const loadScript = (src: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve()
                return
            }
            const script = document.createElement('script')
            script.src = src
            script.onload = () => resolve()
            script.onerror = () => reject(new Error(`Failed to load script ${src}`))
            document.head.appendChild(script)
        })
    }

    const handlePrint = async () => {
        const resumeElement = document.getElementById('resume-preview-sheet')
        if (!resumeElement) return

        setIsExporting(true)
        toast({
            title: 'Generating PDF',
            description: 'Compiling layout and rendering resume...',
        })

        try {
            // Load html2canvas and jsPDF dynamically from CDN
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js')
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')

            const html2canvas = (window as any).html2canvas
            const { jsPDF } = (window as any).jspdf

            // Render the DOM element to a canvas
            const canvas = await html2canvas(resumeElement, {
                scale: 2.5, // 2.5x resolution for crisp Times New Roman text
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                onclone: (clonedDoc: Document) => {
                    const clonedSheet = clonedDoc.getElementById('resume-preview-sheet')
                    if (clonedSheet) {
                        const body = clonedDoc.body
                        body.innerHTML = ''
                        
                        // Strip screen-only borders and shadows for a clean export
                        clonedSheet.style.border = 'none'
                        clonedSheet.style.boxShadow = 'none'
                        clonedSheet.style.margin = '0 auto'
                        
                        // Append sheet directly to body to avoid parent viewport flex/height distortion
                        body.appendChild(clonedSheet)
                    }
                }
            })

            // Compress to JPEG at 0.85 quality (extremely small size, high crispness)
            const imgData = canvas.toDataURL('image/jpeg', 0.85)

            // Setup A4 dimensions in inches
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'in',
                format: 'a4'
            })

            const imgWidth = 8.27 // A4 width in inches
            const imgHeight = 11.69 // A4 height in inches
            
            pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight, undefined, 'FAST')

            // Add interactive hyperlink overlays on top of the image PDF
            const sheetRect = resumeElement.getBoundingClientRect()
            const scaleFactor = imgWidth / sheetRect.width
            const linkElements = resumeElement.querySelectorAll('a')
            linkElements.forEach(linkEl => {
                const href = linkEl.getAttribute('href')
                if (href) {
                    const linkRect = linkEl.getBoundingClientRect()
                    const relativeX = linkRect.left - sheetRect.left
                    const relativeY = linkRect.top - sheetRect.top
                    
                    const pdfX = relativeX * scaleFactor
                    const pdfY = relativeY * scaleFactor
                    const pdfW = linkRect.width * scaleFactor
                    const pdfH = linkRect.height * scaleFactor
                    
                    pdf.link(pdfX, pdfY, pdfW, pdfH, { url: href })
                }
            })

            // Trigger local download
            const fileName = `${(resumeData.personalInfo.name || 'resume').toLowerCase().replace(/\s+/g, '_')}_resume.pdf`
            pdf.save(fileName)

            toast({
                title: 'Download Started',
                description: 'Your resume PDF is downloading directly.',
            })

            // Upload PDF Blob to Firebase Storage if authenticated
            const user = auth.currentUser
            if (user) {
                const pdfBlob = pdf.output('blob')
                const storageRef = ref(storage, `resumes/${user.uid}/resume.pdf`)
                
                uploadBytes(storageRef, pdfBlob).then(() => {
                    toast({
                        title: 'Saved to Profile',
                        description: 'Your resume PDF has been uploaded to Firebase Storage.',
                    })
                }).catch((uploadErr) => {
                    console.error('Firebase Storage Upload Failed:', uploadErr)
                })
            }
        } catch (error) {
            console.error('PDF generation error:', error)
            toast({
                title: 'Generation Failed',
                description: 'Failed to build PDF. Please try again.',
                variant: 'destructive',
            })
        } finally {
            setIsExporting(false)
        }
    }

    // Helper functions for link handling
    const formatLink = (url: string, prefix: string) => {
        if (!url) return ''
        let cleanUrl = url.trim()
        if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
            return cleanUrl
        }
        if (prefix === 'mailto:') {
            return `mailto:${cleanUrl}`
        }
        return `https://${cleanUrl}`
    }

    // Section update handlers
    const updatePersonalInfo = (field: keyof PersonalInfo, value: string) => {
        setResumeData(prev => ({
            ...prev,
            personalInfo: {
                ...prev.personalInfo,
                [field]: value
            }
        }))
    }

    // Education
    const addEducation = () => {
        const newItem: EducationItem = {
            id: `edu-${Date.now()}`,
            institution: '',
            location: '',
            degree: '',
            dateRange: ''
        }
        setResumeData(prev => ({ ...prev, education: [...prev.education, newItem] }))
    }

    const updateEducation = (id: string, field: keyof EducationItem, value: string) => {
        setResumeData(prev => ({
            ...prev,
            education: prev.education.map(item => item.id === id ? { ...item, [field]: value } : item)
        }))
    }

    const deleteEducation = (id: string) => {
        setResumeData(prev => ({
            ...prev,
            education: prev.education.filter(item => item.id !== id)
        }))
    }

    // Experience
    const addExperience = () => {
        const newItem: ExperienceItem = {
            id: `exp-${Date.now()}`,
            role: '',
            company: '',
            location: '',
            dateRange: '',
            bullets: ['']
        }
        setResumeData(prev => ({ ...prev, experience: [...prev.experience, newItem] }))
    }

    const updateExperience = (id: string, field: keyof Omit<ExperienceItem, 'bullets'>, value: string) => {
        setResumeData(prev => ({
            ...prev,
            experience: prev.experience.map(item => item.id === id ? { ...item, [field]: value } : item)
        }))
    }

    const updateExperienceBullet = (expId: string, bulletIndex: number, value: string) => {
        setResumeData(prev => ({
            ...prev,
            experience: prev.experience.map(item => {
                if (item.id !== expId) return item
                const newBullets = [...item.bullets]
                newBullets[bulletIndex] = value
                return { ...item, bullets: newBullets }
            })
        }))
    }

    const addExperienceBullet = (expId: string) => {
        setResumeData(prev => ({
            ...prev,
            experience: prev.experience.map(item => {
                if (item.id !== expId) return item
                return { ...item, bullets: [...item.bullets, ''] }
            })
        }))
    }

    const deleteExperienceBullet = (expId: string, bulletIndex: number) => {
        setResumeData(prev => ({
            ...prev,
            experience: prev.experience.map(item => {
                if (item.id !== expId) return item
                return { ...item, bullets: item.bullets.filter((_, idx) => idx !== bulletIndex) }
            })
        }))
    }

    const deleteExperience = (id: string) => {
        setResumeData(prev => ({
            ...prev,
            experience: prev.experience.filter(item => item.id !== id)
        }))
    }

    // Projects
    const addProject = () => {
        const newItem: ProjectItem = {
            id: `proj-${Date.now()}`,
            title: '',
            technologies: '',
            dateRange: '',
            bullets: ['']
        }
        setResumeData(prev => ({ ...prev, projects: [...prev.projects, newItem] }))
    }

    const updateProject = (id: string, field: keyof Omit<ProjectItem, 'bullets'>, value: string) => {
        setResumeData(prev => ({
            ...prev,
            projects: prev.projects.map(item => item.id === id ? { ...item, [field]: value } : item)
        }))
    }

    const updateProjectBullet = (projId: string, bulletIndex: number, value: string) => {
        setResumeData(prev => ({
            ...prev,
            projects: prev.projects.map(item => {
                if (item.id !== projId) return item
                const newBullets = [...item.bullets]
                newBullets[bulletIndex] = value
                return { ...item, bullets: newBullets }
            })
        }))
    }

    const addProjectBullet = (projId: string) => {
        setResumeData(prev => ({
            ...prev,
            projects: prev.projects.map(item => {
                if (item.id !== projId) return item
                return { ...item, bullets: [...item.bullets, ''] }
            })
        }))
    }

    const deleteProjectBullet = (projId: string, bulletIndex: number) => {
        setResumeData(prev => ({
            ...prev,
            projects: prev.projects.map(item => {
                if (item.id !== projId) return item
                return { ...item, bullets: item.bullets.filter((_, idx) => idx !== bulletIndex) }
            })
        }))
    }

    const deleteProject = (id: string) => {
        setResumeData(prev => ({
            ...prev,
            projects: prev.projects.filter(item => item.id !== id)
        }))
    }

    // Skills
    const addSkill = () => {
        const newItem: SkillCategory = {
            id: `skill-${Date.now()}`,
            category: '',
            items: ''
        }
        setResumeData(prev => ({ ...prev, skills: [...prev.skills, newItem] }))
    }

    const updateSkill = (id: string, field: keyof SkillCategory, value: string) => {
        setResumeData(prev => ({
            ...prev,
            skills: prev.skills.map(item => item.id === id ? { ...item, [field]: value } : item)
        }))
    }

    const deleteSkill = (id: string) => {
        setResumeData(prev => ({
            ...prev,
            skills: prev.skills.filter(item => item.id !== id)
        }))
    }

    // Custom Sections
    const addCustomSection = () => {
        const newSec: CustomSection = {
            id: `custom-${Date.now()}`,
            title: 'Achievements',
            items: [
                {
                    id: `custom-item-${Date.now()}`,
                    heading: '',
                    bullets: ['']
                }
            ]
        }
        setResumeData(prev => ({ ...prev, customSections: [...prev.customSections, newSec] }))
    }

    const updateCustomSectionTitle = (secId: string, value: string) => {
        setResumeData(prev => ({
            ...prev,
            customSections: prev.customSections.map(sec => sec.id === secId ? { ...sec, title: value } : sec)
        }))
    }

    const deleteCustomSection = (secId: string) => {
        setResumeData(prev => ({
            ...prev,
            customSections: prev.customSections.filter(sec => sec.id !== secId)
        }))
    }

    const addCustomItem = (secId: string) => {
        const newItem: CustomItem = {
            id: `custom-item-${Date.now()}`,
            heading: '',
            bullets: ['']
        }
        setResumeData(prev => ({
            ...prev,
            customSections: prev.customSections.map(sec => {
                if (sec.id !== secId) return sec
                return { ...sec, items: [...sec.items, newItem] }
            })
        }))
    }

    const updateCustomItem = (secId: string, itemId: string, field: keyof Omit<CustomItem, 'bullets'>, value: string) => {
        setResumeData(prev => ({
            ...prev,
            customSections: prev.customSections.map(sec => {
                if (sec.id !== secId) return sec
                return {
                    ...sec,
                    items: sec.items.map(item => item.id === itemId ? { ...item, [field]: value } : item)
                }
            })
        }))
    }

    const updateCustomItemBullet = (secId: string, itemId: string, bulletIndex: number, value: string) => {
        setResumeData(prev => ({
            ...prev,
            customSections: prev.customSections.map(sec => {
                if (sec.id !== secId) return sec
                return {
                    ...sec,
                    items: sec.items.map(item => {
                        if (item.id !== itemId) return item
                        const newBullets = [...item.bullets]
                        newBullets[bulletIndex] = value
                        return { ...item, bullets: newBullets }
                    })
                }
            })
        }))
    }

    const addCustomItemBullet = (secId: string, itemId: string) => {
        setResumeData(prev => ({
            ...prev,
            customSections: prev.customSections.map(sec => {
                if (sec.id !== secId) return sec
                return {
                    ...sec,
                    items: sec.items.map(item => {
                        if (item.id !== itemId) return item
                        return { ...item, bullets: [...item.bullets, ''] }
                    })
                }
            })
        }))
    }

    const deleteCustomItemBullet = (secId: string, itemId: string, bulletIndex: number) => {
        setResumeData(prev => ({
            ...prev,
            customSections: prev.customSections.map(sec => {
                if (sec.id !== secId) return sec
                return {
                    ...sec,
                    items: sec.items.map(item => {
                        if (item.id !== itemId) return item
                        return { ...item, bullets: item.bullets.filter((_, idx) => idx !== bulletIndex) }
                    })
                }
            })
        }))
    }

    const deleteCustomItem = (secId: string, itemId: string) => {
        setResumeData(prev => ({
            ...prev,
            customSections: prev.customSections.map(sec => {
                if (sec.id !== secId) return sec
                return { ...sec, items: sec.items.filter(item => item.id !== itemId) }
            })
        }))
    }

    return (
        <div className="flex flex-col h-full bg-[#08080a] text-gray-200">
            {/* Inject dynamic print css */}
            <style>{`
                /* Ensure Times New Roman is used for the resume preview */
                #resume-preview-sheet,
                #resume-preview-sheet * {
                    font-family: "Times New Roman", Times, Georgia, serif !important;
                }

                @media print {
                    /* Hide the main website layout */
                    #root {
                        display: none !important;
                    }
                    /* Hide Dialog overlays, close buttons, and backdrops */
                    [data-radix-portal] button[aria-label="Close"],
                    [class*="DialogOverlay"],
                    .DialogOverlay,
                    [data-state="open"]::before {
                        display: none !important;
                    }
                    /* Strip dialog container borders, backgrounds, and shadows during print */
                    [role="dialog"] {
                        background: white !important;
                        border: none !important;
                        box-shadow: none !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        height: 100% !important;
                        max-height: 100% !important;
                        position: absolute !important;
                        inset: 0 !important;
                        transform: none !important;
                        border-radius: 0 !important;
                    }
                    /* Ensure print-container matches the A4 sheet placement */
                    .print-container {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        height: 100% !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    body {
                        margin: 0 !important;
                        padding: 0.35in 0.45in !important;
                        background: white !important;
                    }
                    #resume-preview-sheet {
                        width: 100% !important;
                        height: auto !important;
                        min-height: 0 !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                        background: white !important;
                        color: black !important;
                        font-size: 10.5pt !important;
                        line-height: 1.15 !important;
                    }
                    /* Ensure link coloring is basic text color in printing */
                    #resume-preview-sheet a {
                        color: black !important;
                        text-decoration: underline !important;
                    }
                }
                @page {
                    size: A4 portrait;
                    margin: 0; /* Hides browser default headers/footers */
                }
            `}</style>

            {/* Title / Action bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-b border-white/[0.08] bg-[#0c0c0e]">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white rounded-lg hover:bg-white/5 h-9 w-9" onClick={onClose}>
                        <ArrowLeft className="h-4.5 w-4.5" />
                    </Button>
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <FileText className="h-4.5 w-4.5 text-indigo-400" />
                            Resume Builder
                        </h2>
                        <p className="text-[11px] text-gray-400">Jake Ryan LaTeX-style template creator</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" className="h-9 font-mono text-[11px] uppercase tracking-wider text-gray-400 border-white/[0.06] hover:bg-white/5 hover:text-white" onClick={resetToSample}>
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                        Reset Sample
                    </Button>
                    <Button variant="outline" size="sm" className="h-9 font-mono text-[11px] uppercase tracking-wider text-red-400 border-red-950/30 hover:bg-red-950/20 hover:text-red-300" onClick={clearAll}>
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        Clear All
                    </Button>
                    <Button 
                        size="sm" 
                        disabled={isExporting}
                        className="h-9 font-mono text-[11px] uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white rounded-none btn-glow-amber disabled:opacity-50" 
                        onClick={handlePrint}
                    >
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        {isExporting ? 'Exporting...' : 'Export PDF'}
                    </Button>
                </div>
            </div>

            {/* Split Panel Area */}
            <div className="flex-1 flex overflow-hidden min-h-0">
                
                {/* Left Side: Editor Panel */}
                <div className="w-full lg:w-1/2 flex flex-col border-r border-white/[0.08] bg-[#08080a] h-full">
                    {/* Navigation Tabs */}
                    <div className="flex border-b border-white/[0.06] bg-[#0c0c0e] overflow-x-auto select-none no-scrollbar">
                        {[
                            { id: 'personal', label: 'Contact', icon: User },
                            { id: 'education', label: 'Education', icon: GraduationCap },
                            { id: 'experience', label: 'Experience', icon: Briefcase },
                            { id: 'projects', label: 'Projects', icon: FolderGit },
                            { id: 'skills', label: 'Skills', icon: CheckSquare },
                            { id: 'custom', label: 'Custom', icon: PlusCircle }
                        ].map((t) => {
                            const Icon = t.icon
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => setActiveTab(t.id as any)}
                                    className={`flex items-center gap-2 px-4 py-3 border-b-2 font-mono text-xs uppercase tracking-wider transition-all whitespace-nowrap outline-none ${
                                        activeTab === t.id 
                                            ? 'border-indigo-500 text-indigo-400 bg-indigo-500/[0.02]' 
                                            : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-white/[0.02]'
                                    }`}
                                >
                                    <Icon className="h-3.5 w-3.5" />
                                    {t.label}
                                </button>
                            )
                        })}
                    </div>

                    {/* Scrollable Form Content */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-6">
                        
                        {/* 1. PERSONAL INFO TAB */}
                        {activeTab === 'personal' && (
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold uppercase tracking-wider text-white border-b border-white/[0.06] pb-2">Personal Information</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-[10px] uppercase font-mono tracking-wider text-gray-400 block mb-1">Full Name</label>
                                        <Input value={resumeData.personalInfo.name} onChange={(e) => updatePersonalInfo('name', e.target.value)} className="bg-white/5 border-white/[0.08] focus:border-indigo-500 text-white rounded-none" placeholder="Jake Ryan" />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] uppercase font-mono tracking-wider text-gray-400 block mb-1">Phone Number</label>
                                            <Input value={resumeData.personalInfo.phone} onChange={(e) => updatePersonalInfo('phone', e.target.value)} className="bg-white/5 border-white/[0.08] focus:border-indigo-500 text-white rounded-none" placeholder="123-456-7890" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase font-mono tracking-wider text-gray-400 block mb-1">Email Address</label>
                                            <Input value={resumeData.personalInfo.email} onChange={(e) => updatePersonalInfo('email', e.target.value)} className="bg-white/5 border-white/[0.08] focus:border-indigo-500 text-white rounded-none" placeholder="jake@su.edu" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] uppercase font-mono tracking-wider text-gray-400 block mb-1">LinkedIn Username/Link</label>
                                            <Input value={resumeData.personalInfo.linkedin} onChange={(e) => updatePersonalInfo('linkedin', e.target.value)} className="bg-white/5 border-white/[0.08] focus:border-indigo-500 text-white rounded-none" placeholder="linkedin.com/in/jake" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase font-mono tracking-wider text-gray-400 block mb-1">GitHub Username/Link</label>
                                            <Input value={resumeData.personalInfo.github} onChange={(e) => updatePersonalInfo('github', e.target.value)} className="bg-white/5 border-white/[0.08] focus:border-indigo-500 text-white rounded-none" placeholder="github.com/jake" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 2. EDUCATION TAB */}
                        {activeTab === 'education' && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center border-b border-white/[0.06] pb-2">
                                    <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Education History</h3>
                                    <Button size="sm" onClick={addEducation} className="h-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-none font-mono text-[10px] uppercase tracking-wider">
                                        <Plus className="mr-1 h-3.5 w-3.5" /> Add School
                                    </Button>
                                </div>

                                {resumeData.education.length === 0 ? (
                                    <p className="text-sm text-gray-500 italic">No education entries yet. Click Add School above to start.</p>
                                ) : (
                                    <div className="space-y-4">
                                        {resumeData.education.map((edu, index) => (
                                            <Card key={edu.id} className="bg-white/[0.02] border-white/[0.06] rounded-none">
                                                <CardContent className="p-4 space-y-3 relative">
                                                    <Button variant="ghost" size="icon" onClick={() => deleteEducation(edu.id)} className="absolute top-2 right-2 text-gray-400 hover:text-red-400 hover:bg-red-950/20 h-7 w-7 rounded-md">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                    <div className="font-mono text-xs font-bold text-indigo-400 mb-1">SCHOOL #{index + 1}</div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="text-[9px] uppercase font-mono tracking-wider text-gray-400 block mb-1">Institution</label>
                                                            <Input value={edu.institution} onChange={(e) => updateEducation(edu.id, 'institution', e.target.value)} className="bg-white/5 border-white/[0.08] text-white rounded-none h-9 text-sm" placeholder="Southwestern University" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[9px] uppercase font-mono tracking-wider text-gray-400 block mb-1">Location</label>
                                                            <Input value={edu.location} onChange={(e) => updateEducation(edu.id, 'location', e.target.value)} className="bg-white/5 border-white/[0.08] text-white rounded-none h-9 text-sm" placeholder="Georgetown, TX" />
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="text-[9px] uppercase font-mono tracking-wider text-gray-400 block mb-1">Degree / Course</label>
                                                            <Input value={edu.degree} onChange={(e) => updateEducation(edu.id, 'degree', e.target.value)} className="bg-white/5 border-white/[0.08] text-white rounded-none h-9 text-sm" placeholder="Bachelor of Arts in Computer Science" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[9px] uppercase font-mono tracking-wider text-gray-400 block mb-1">Date Range</label>
                                                            <Input value={edu.dateRange} onChange={(e) => updateEducation(edu.id, 'dateRange', e.target.value)} className="bg-white/5 border-white/[0.08] text-white rounded-none h-9 text-sm" placeholder="Aug. 2018 – May 2021" />
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 3. EXPERIENCE TAB */}
                        {activeTab === 'experience' && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center border-b border-white/[0.06] pb-2">
                                    <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Work Experience</h3>
                                    <Button size="sm" onClick={addExperience} className="h-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-none font-mono text-[10px] uppercase tracking-wider">
                                        <Plus className="mr-1 h-3.5 w-3.5" /> Add Job
                                    </Button>
                                </div>

                                {resumeData.experience.length === 0 ? (
                                    <p className="text-sm text-gray-500 italic">No experience entries yet. Click Add Job to start.</p>
                                ) : (
                                    <div className="space-y-5">
                                        {resumeData.experience.map((exp, index) => (
                                            <Card key={exp.id} className="bg-white/[0.02] border-white/[0.06] rounded-none">
                                                <CardContent className="p-4 space-y-3 relative">
                                                    <Button variant="ghost" size="icon" onClick={() => deleteExperience(exp.id)} className="absolute top-2 right-2 text-gray-400 hover:text-red-400 hover:bg-red-950/20 h-7 w-7 rounded-md">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                    <div className="font-mono text-xs font-bold text-indigo-400 mb-1">JOB POSITION #{index + 1}</div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="text-[9px] uppercase font-mono tracking-wider text-gray-400 block mb-1">Role / Position Title</label>
                                                            <Input value={exp.role} onChange={(e) => updateExperience(exp.id, 'role', e.target.value)} className="bg-white/5 border-white/[0.08] text-white rounded-none h-9 text-sm" placeholder="Undergraduate Research Assistant" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[9px] uppercase font-mono tracking-wider text-gray-400 block mb-1">Employer / Organization</label>
                                                            <Input value={exp.company} onChange={(e) => updateExperience(exp.id, 'company', e.target.value)} className="bg-white/5 border-white/[0.08] text-white rounded-none h-9 text-sm" placeholder="Texas A&M University" />
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="text-[9px] uppercase font-mono tracking-wider text-gray-400 block mb-1">Location</label>
                                                            <Input value={exp.location} onChange={(e) => updateExperience(exp.id, 'location', e.target.value)} className="bg-white/5 border-white/[0.08] text-white rounded-none h-9 text-sm" placeholder="College Station, TX" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[9px] uppercase font-mono tracking-wider text-gray-400 block mb-1">Date Range</label>
                                                            <Input value={exp.dateRange} onChange={(e) => updateExperience(exp.id, 'dateRange', e.target.value)} className="bg-white/5 border-white/[0.08] text-white rounded-none h-9 text-sm" placeholder="June 2020 – Present" />
                                                        </div>
                                                    </div>

                                                    {/* Bullet Points */}
                                                    <div className="space-y-2 mt-2">
                                                        <div className="flex justify-between items-center">
                                                            <label className="text-[9px] uppercase font-mono tracking-wider text-gray-400 block">Description Bullets</label>
                                                            <Button variant="ghost" size="sm" onClick={() => addExperienceBullet(exp.id)} className="h-6 px-2 text-[9px] font-mono text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/20">
                                                                <Plus className="h-3 w-3 mr-1" /> Add Bullet
                                                            </Button>
                                                        </div>
                                                        {exp.bullets.map((bullet, bIdx) => (
                                                            <div key={bIdx} className="flex gap-2 items-center">
                                                                <span className="text-gray-500 font-mono text-xs shrink-0 select-none">•</span>
                                                                <Input value={bullet} onChange={(e) => updateExperienceBullet(exp.id, bIdx, e.target.value)} className="bg-white/5 border-white/[0.08] text-white rounded-none h-8 text-xs flex-1" placeholder="Describe accomplishment..." />
                                                                {exp.bullets.length > 1 && (
                                                                    <Button variant="ghost" size="icon" onClick={() => deleteExperienceBullet(exp.id, bIdx)} className="h-7 w-7 text-gray-500 hover:text-red-400">
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 4. PROJECTS TAB */}
                        {activeTab === 'projects' && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center border-b border-white/[0.06] pb-2">
                                    <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Project Showcase</h3>
                                    <Button size="sm" onClick={addProject} className="h-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-none font-mono text-[10px] uppercase tracking-wider">
                                        <Plus className="mr-1 h-3.5 w-3.5" /> Add Project
                                    </Button>
                                </div>

                                {resumeData.projects.length === 0 ? (
                                    <p className="text-sm text-gray-500 italic">No projects yet. Click Add Project to start.</p>
                                ) : (
                                    <div className="space-y-5">
                                        {resumeData.projects.map((proj, index) => (
                                            <Card key={proj.id} className="bg-white/[0.02] border-white/[0.06] rounded-none">
                                                <CardContent className="p-4 space-y-3 relative">
                                                    <Button variant="ghost" size="icon" onClick={() => deleteProject(proj.id)} className="absolute top-2 right-2 text-gray-400 hover:text-red-400 hover:bg-red-950/20 h-7 w-7 rounded-md">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                    <div className="font-mono text-xs font-bold text-indigo-400 mb-1">PROJECT #{index + 1}</div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="text-[9px] uppercase font-mono tracking-wider text-gray-400 block mb-1">Project Title</label>
                                                            <Input value={proj.title} onChange={(e) => updateProject(proj.id, 'title', e.target.value)} className="bg-white/5 border-white/[0.08] text-white rounded-none h-9 text-sm" placeholder="Gitlytics" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[9px] uppercase font-mono tracking-wider text-gray-400 block mb-1">Technologies / Tech Stack</label>
                                                            <Input value={proj.technologies} onChange={(e) => updateProject(proj.id, 'technologies', e.target.value)} className="bg-white/5 border-white/[0.08] text-white rounded-none h-9 text-sm" placeholder="Python, Flask, React, Docker" />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-[9px] uppercase font-mono tracking-wider text-gray-400 block mb-1">Date Range</label>
                                                        <Input value={proj.dateRange} onChange={(e) => updateProject(proj.id, 'dateRange', e.target.value)} className="bg-white/5 border-white/[0.08] text-white rounded-none h-9 text-sm" placeholder="June 2020 – Present" />
                                                    </div>

                                                    {/* Bullet Points */}
                                                    <div className="space-y-2 mt-2">
                                                        <div className="flex justify-between items-center">
                                                            <label className="text-[9px] uppercase font-mono tracking-wider text-gray-400 block">Description Bullets</label>
                                                            <Button variant="ghost" size="sm" onClick={() => addProjectBullet(proj.id)} className="h-6 px-2 text-[9px] font-mono text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/20">
                                                                <Plus className="h-3 w-3 mr-1" /> Add Bullet
                                                            </Button>
                                                        </div>
                                                        {proj.bullets.map((bullet, bIdx) => (
                                                            <div key={bIdx} className="flex gap-2 items-center">
                                                                <span className="text-gray-500 font-mono text-xs shrink-0 select-none">•</span>
                                                                <Input value={bullet} onChange={(e) => updateProjectBullet(proj.id, bIdx, e.target.value)} className="bg-white/5 border-white/[0.08] text-white rounded-none h-8 text-xs flex-1" placeholder="Describe accomplishment..." />
                                                                {proj.bullets.length > 1 && (
                                                                    <Button variant="ghost" size="icon" onClick={() => deleteProjectBullet(proj.id, bIdx)} className="h-7 w-7 text-gray-500 hover:text-red-400">
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 5. TECHNICAL SKILLS TAB */}
                        {activeTab === 'skills' && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center border-b border-white/[0.06] pb-2">
                                    <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Technical Skills</h3>
                                    <Button size="sm" onClick={addSkill} className="h-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-none font-mono text-[10px] uppercase tracking-wider">
                                        <Plus className="mr-1 h-3.5 w-3.5" /> Add Category
                                    </Button>
                                </div>

                                {resumeData.skills.length === 0 ? (
                                    <p className="text-sm text-gray-500 italic">No skill categories yet. Click Add Category to start.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {resumeData.skills.map((skill, index) => (
                                            <div key={skill.id} className="flex gap-3 items-end bg-white/[0.01] border border-white/[0.04] p-3 rounded-none relative group">
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
                                                    <div className="sm:col-span-1">
                                                        <label className="text-[9px] uppercase font-mono tracking-wider text-gray-400 block mb-1">Category Name</label>
                                                        <Input value={skill.category} onChange={(e) => updateSkill(skill.id, 'category', e.target.value)} className="bg-white/5 border-white/[0.08] text-white rounded-none h-9 text-sm font-semibold" placeholder="Languages" />
                                                    </div>
                                                    <div className="sm:col-span-2">
                                                        <label className="text-[9px] uppercase font-mono tracking-wider text-gray-400 block mb-1">Skill Items (comma separated)</label>
                                                        <Input value={skill.items} onChange={(e) => updateSkill(skill.id, 'items', e.target.value)} className="bg-white/5 border-white/[0.08] text-white rounded-none h-9 text-sm" placeholder="Java, Python, JavaScript, SQL" />
                                                    </div>
                                                </div>
                                                <Button variant="ghost" size="icon" onClick={() => deleteSkill(skill.id)} className="text-gray-500 hover:text-red-400 h-9 w-9 shrink-0">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 6. CUSTOM SECTIONS TAB */}
                        {activeTab === 'custom' && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center border-b border-white/[0.06] pb-2">
                                    <div>
                                        <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Custom Sections</h3>
                                        <p className="text-[10px] text-gray-500 mt-0.5">Achievements, Leadership, Extra-curriculars, etc.</p>
                                    </div>
                                    <Button size="sm" onClick={addCustomSection} className="h-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-none font-mono text-[10px] uppercase tracking-wider">
                                        <Plus className="mr-1 h-3.5 w-3.5" /> Add Section
                                    </Button>
                                </div>

                                {resumeData.customSections.length === 0 ? (
                                    <div className="text-center py-6 border border-dashed border-white/[0.08] rounded-none">
                                        <p className="text-sm text-gray-500 italic">No custom sections created yet.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {resumeData.customSections.map((sec, secIdx) => (
                                            <div key={sec.id} className="border border-indigo-950/40 bg-indigo-950/[0.04] p-4 relative space-y-4">
                                                
                                                {/* Header area of Custom Section */}
                                                <div className="flex flex-col sm:flex-row gap-2 justify-between items-start border-b border-white/[0.06] pb-3">
                                                    <div className="w-full sm:max-w-xs">
                                                        <label className="text-[9px] uppercase font-mono tracking-wider text-indigo-400 block mb-1">Section Title</label>
                                                        <Input value={sec.title} onChange={(e) => updateCustomSectionTitle(sec.id, e.target.value)} className="bg-white/5 border-white/[0.08] text-white rounded-none h-8 text-xs font-bold uppercase" placeholder="Achievements" />
                                                    </div>
                                                    <div className="flex gap-1.5 self-end">
                                                        <Button variant="outline" size="sm" onClick={() => addCustomItem(sec.id)} className="h-7 px-2 font-mono text-[10px] uppercase tracking-wider border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/10">
                                                            <Plus className="h-3 w-3 mr-1" /> Add Entry
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => deleteCustomSection(sec.id)} className="text-gray-500 hover:text-red-400 h-7 w-7">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>

                                                {/* Custom items in this section */}
                                                <div className="space-y-4">
                                                    {sec.items.map((item, itemIdx) => (
                                                        <Card key={item.id} className="bg-white/[0.01] border-white/[0.04] rounded-none">
                                                            <CardContent className="p-3.5 space-y-3 relative">
                                                                <Button variant="ghost" size="icon" onClick={() => deleteCustomItem(sec.id, item.id)} className="absolute top-2 right-2 text-gray-500 hover:text-red-400 h-6 w-6">
                                                                    <X className="h-3.5 w-3.5" />
                                                                </Button>
                                                                
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                    <div>
                                                                        <label className="text-[9px] uppercase font-mono tracking-wider text-gray-500 block mb-0.5">Heading</label>
                                                                        <Input value={item.heading} onChange={(e) => updateCustomItem(sec.id, item.id, 'heading', e.target.value)} className="bg-white/5 border-white/[0.08] text-white rounded-none h-8 text-xs" placeholder="Google Summer of Code Developer" />
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-[9px] uppercase font-mono tracking-wider text-gray-500 block mb-0.5">Subheading / Organization</label>
                                                                        <Input value={item.subheading || ''} onChange={(e) => updateCustomItem(sec.id, item.id, 'subheading', e.target.value)} className="bg-white/5 border-white/[0.08] text-white rounded-none h-8 text-xs" placeholder="Gnome Foundation" />
                                                                    </div>
                                                                </div>

                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                    <div>
                                                                        <label className="text-[9px] uppercase font-mono tracking-wider text-gray-500 block mb-0.5">Location</label>
                                                                        <Input value={item.location || ''} onChange={(e) => updateCustomItem(sec.id, item.id, 'location', e.target.value)} className="bg-white/5 border-white/[0.08] text-white rounded-none h-8 text-xs" placeholder="Remote" />
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-[9px] uppercase font-mono tracking-wider text-gray-500 block mb-0.5">Date / Duration</label>
                                                                        <Input value={item.dateRange || ''} onChange={(e) => updateCustomItem(sec.id, item.id, 'dateRange', e.target.value)} className="bg-white/5 border-white/[0.08] text-white rounded-none h-8 text-xs" placeholder="May – Aug 2021" />
                                                                    </div>
                                                                </div>

                                                                {/* Custom item Bullets */}
                                                                <div className="space-y-1.5 mt-1.5">
                                                                    <div className="flex justify-between items-center">
                                                                        <label className="text-[8px] uppercase font-mono tracking-wider text-gray-500">Bullets</label>
                                                                        <Button variant="ghost" size="sm" onClick={() => addCustomItemBullet(sec.id, item.id)} className="h-5 px-1.5 text-[8px] font-mono text-indigo-400 hover:bg-indigo-950/20">
                                                                            <Plus className="h-2.5 w-2.5 mr-0.5" /> Add Bullet
                                                                        </Button>
                                                                    </div>
                                                                    {item.bullets.map((bullet, bIdx) => (
                                                                        <div key={bIdx} className="flex gap-2 items-center">
                                                                            <span className="text-gray-600 text-[10px] shrink-0 font-mono">•</span>
                                                                            <Input value={bullet} onChange={(e) => updateCustomItemBullet(sec.id, item.id, bIdx, e.target.value)} className="bg-white/5 border-white/[0.08] text-white rounded-none h-7 text-[11px] flex-1" placeholder="Detail accomplishment..." />
                                                                            {item.bullets.length > 1 && (
                                                                                <Button variant="ghost" size="icon" onClick={() => deleteCustomItemBullet(sec.id, item.id, bIdx)} className="h-6 w-6 text-gray-500 hover:text-red-400">
                                                                                    <Trash2 className="h-3 w-3" />
                                                                                </Button>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>

                                                            </CardContent>
                                                        </Card>
                                                    ))}
                                                </div>

                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                </div>

                {/* Right Side: Live LaTeX Preview Panel */}
                <div className="hidden lg:flex w-1/2 flex-col bg-[#121215] overflow-y-auto p-8 items-center h-full relative select-text print:flex print:w-full print:p-0 print:bg-white print:overflow-visible">
                    <div className="absolute top-2 left-4 text-[10px] font-mono text-gray-500 uppercase tracking-widest pointer-events-none">Live WYSIWYG LaTeX Preview</div>
                    
                    {/* The A4 Sheet Mockup Container */}
                    <div className="print-container">
                        <div 
                            id="resume-preview-sheet" 
                            className="bg-white text-black font-serif text-[10pt] shadow-2xl p-12 w-[210mm] min-h-[297mm] overflow-hidden flex flex-col justify-start select-text"
                            style={{ 
                                fontFamily: '"Times New Roman", Times, Georgia, serif', 
                                border: '1px solid rgba(0, 0, 0, 0.1)',
                                lineHeight: '13.5pt'
                            }}
                        >
                            {/* 1. Header (Centered Name + Info) */}
                            <div className="text-center mb-4">
                                <h1 className="text-3xl font-bold tracking-normal uppercase mb-1 leading-none text-black">
                                    {resumeData.personalInfo.name || 'Your Name'}
                                </h1>
                                <div className="text-[9.5pt] text-black tracking-normal flex flex-wrap justify-center items-center gap-1.5 font-normal">
                                    {resumeData.personalInfo.phone && <span>{resumeData.personalInfo.phone}</span>}
                                    {resumeData.personalInfo.phone && (resumeData.personalInfo.email || resumeData.personalInfo.linkedin || resumeData.personalInfo.github) && <span className="mx-0.5">|</span>}
                                    
                                    {resumeData.personalInfo.email && (
                                        <a href={formatLink(resumeData.personalInfo.email, 'mailto:')} className="underline text-black font-normal hover:text-black">
                                            {resumeData.personalInfo.email}
                                        </a>
                                    )}
                                    {resumeData.personalInfo.email && (resumeData.personalInfo.linkedin || resumeData.personalInfo.github) && <span className="mx-0.5">|</span>}
                                    
                                    {resumeData.personalInfo.linkedin && (
                                        <a href={formatLink(resumeData.personalInfo.linkedin, 'https://')} target="_blank" rel="noopener noreferrer" className="underline text-black font-normal hover:text-black">
                                            {resumeData.personalInfo.linkedin}
                                        </a>
                                    )}
                                    {resumeData.personalInfo.linkedin && resumeData.personalInfo.github && <span className="mx-0.5">|</span>}
                                    
                                    {resumeData.personalInfo.github && (
                                        <a href={formatLink(resumeData.personalInfo.github, 'https://')} target="_blank" rel="noopener noreferrer" className="underline text-black font-normal hover:text-black">
                                            {resumeData.personalInfo.github}
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* 2. Education Section */}
                            {resumeData.education.length > 0 && (
                                <div className="mb-4">
                                    <div className="mb-1">
                                        <h2 className="text-[11.5pt] font-bold uppercase tracking-wider text-black leading-normal mb-1.5">Education</h2>
                                        <div className="h-[1px] bg-black w-full" />
                                    </div>
                                    <div className="space-y-2">
                                        {resumeData.education.map((edu) => (
                                            <div key={edu.id} className="text-[10pt] leading-tight">
                                                <div className="flex justify-between font-bold text-black">
                                                    <span>{edu.institution || 'University Name'}</span>
                                                    <span>{edu.location || 'Location'}</span>
                                                </div>
                                                <div className="flex justify-between italic text-black font-normal">
                                                    <span>{edu.degree || 'Degree details'}</span>
                                                    <span>{edu.dateRange || 'Dates'}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 3. Experience Section */}
                            {resumeData.experience.length > 0 && (
                                <div className="mb-4">
                                    <div className="mb-1">
                                        <h2 className="text-[11.5pt] font-bold uppercase tracking-wider text-black leading-normal mb-1.5">Experience</h2>
                                        <div className="h-[1px] bg-black w-full" />
                                    </div>
                                    <div className="space-y-3">
                                        {resumeData.experience.map((exp) => (
                                            <div key={exp.id} className="text-[10pt] leading-snug">
                                                <div className="flex justify-between font-bold text-black">
                                                    <span>{exp.role || 'Job Title'}</span>
                                                    <span>{exp.dateRange || 'Dates'}</span>
                                                </div>
                                                <div className="flex justify-between italic text-black font-normal mb-1">
                                                    <span>{exp.company || 'Company'}</span>
                                                    <span>{exp.location || 'Location'}</span>
                                                </div>
                                                <ul className="space-y-0.5 text-black pl-1.5">
                                                    {exp.bullets.filter(b => b.trim() !== '').map((bullet, idx) => (
                                                        <li key={idx} className="text-[9.5pt] font-normal leading-normal flex items-start gap-1.5">
                                                            <span className="shrink-0 text-[8.5pt] leading-normal">•</span>
                                                            <span className="flex-1">{bullet}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 4. Projects Section */}
                            {resumeData.projects.length > 0 && (
                                <div className="mb-4">
                                    <div className="mb-1">
                                        <h2 className="text-[11.5pt] font-bold uppercase tracking-wider text-black leading-normal mb-1.5">Projects</h2>
                                        <div className="h-[1px] bg-black w-full" />
                                    </div>
                                    <div className="space-y-3">
                                        {resumeData.projects.map((proj) => (
                                            <div key={proj.id} className="text-[10pt] leading-snug">
                                                <div className="flex justify-between font-bold text-black">
                                                    <span className="flex items-center flex-wrap gap-1 font-bold">
                                                        <span>{proj.title || 'Project Name'}</span>
                                                        {proj.technologies && <span className="font-normal text-black mx-1">|</span>}
                                                        {proj.technologies && <span className="italic font-normal text-black">{proj.technologies}</span>}
                                                    </span>
                                                    <span>{proj.dateRange || 'Dates'}</span>
                                                </div>
                                                <ul className="space-y-0.5 text-black pl-1.5 mt-1">
                                                    {proj.bullets.filter(b => b.trim() !== '').map((bullet, idx) => (
                                                        <li key={idx} className="text-[9.5pt] font-normal leading-normal flex items-start gap-1.5">
                                                            <span className="shrink-0 text-[8.5pt] leading-normal">•</span>
                                                            <span className="flex-1">{bullet}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 5. Custom Sections (e.g. Achievements, Extracurriculars) */}
                            {resumeData.customSections.map((sec) => (
                                <div key={sec.id} className="mb-4">
                                    <div className="mb-1">
                                        <h2 className="text-[11.5pt] font-bold uppercase tracking-wider text-black leading-normal mb-1.5">{sec.title}</h2>
                                        <div className="h-[1px] bg-black w-full" />
                                    </div>
                                    <div className="space-y-3">
                                        {sec.items.map((item) => (
                                            <div key={item.id} className="text-[10pt] leading-snug">
                                                {(item.heading || item.dateRange) && (
                                                    <div className="flex justify-between font-bold text-black">
                                                        <span>{item.heading || ''}</span>
                                                        <span>{item.dateRange || ''}</span>
                                                    </div>
                                                )}
                                                {(item.subheading || item.location) && (
                                                    <div className="flex justify-between italic text-black font-normal mb-1">
                                                        <span>{item.subheading || ''}</span>
                                                        <span>{item.location || ''}</span>
                                                    </div>
                                                )}
                                                <ul className="space-y-0.5 text-black pl-1.5 mt-1">
                                                    {item.bullets.filter(b => b.trim() !== '').map((bullet, idx) => (
                                                        <li key={idx} className="text-[9.5pt] font-normal leading-normal flex items-start gap-1.5">
                                                            <span className="shrink-0 text-[8.5pt] leading-normal">•</span>
                                                            <span className="flex-1">{bullet}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            {/* 6. Technical Skills Section */}
                            {resumeData.skills.length > 0 && (
                                <div className="mb-2">
                                    <div className="mb-1">
                                        <h2 className="text-[11.5pt] font-bold uppercase tracking-wider text-black leading-normal mb-1.5">Technical Skills</h2>
                                        <div className="h-[1px] bg-black w-full" />
                                    </div>
                                    <div className="space-y-1 text-[9.5pt] leading-snug text-black">
                                        {resumeData.skills.map((skill) => (
                                            <div key={skill.id} className="font-normal">
                                                <strong className="font-bold text-black">{skill.category}:</strong>{' '}
                                                <span>{skill.items || 'Skill list...'}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>

                </div>

            </div>
        </div>
    )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
    CheckCircle2, 
    Circle, 
    ArrowRight, 
    User, 
    Camera, 
    Globe, 
    Users, 
    Bookmark, 
    PlusCircle,
    X,
    Sparkles
} from 'lucide-react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

interface OnboardingChecklistProps {
    userId: string
    profileData: any
    stats: {
        myProjects: number
        applications: number
        savedProjects: number
    }
    connectionsCount: number
    onDismiss: () => void
}

export function OnboardingChecklist({
    userId,
    profileData,
    stats,
    connectionsCount,
    onDismiss
}: OnboardingChecklistProps) {
    const navigate = useNavigate()
    const [dismissed, setDismissed] = useState(false)
    const [showConfetti, setShowConfetti] = useState(false)

    // Calculate checklist item completions
    const hasBioAndSkills = !!(profileData?.bio && (profileData?.skills && profileData?.skills.length > 0))
    const hasPhoto = !!(profileData?.photoURL)
    const hasLinks = !!(profileData?.portfolioURL || profileData?.githubURL || profileData?.linkedinURL || profileData?.websiteURL)
    const hasConnection = connectionsCount > 0
    const hasSavedProject = stats.savedProjects > 0
    const hasAppliedOrCreate = stats.myProjects > 0 || stats.applications > 0

    const items = [
        {
            key: 'profile',
            label: 'Complete profile',
            desc: 'Add a bio and at least 3 skills to your profile',
            completed: hasBioAndSkills,
            icon: User,
            action: () => navigate('/profile/' + userId)
        },
        {
            key: 'photo',
            label: 'Add profile photo',
            desc: 'Upload a picture so colleagues can recognize you',
            completed: hasPhoto,
            icon: Camera,
            action: () => navigate('/profile/' + userId)
        },
        {
            key: 'links',
            label: 'Add portfolio / GitHub',
            desc: 'Link your GitHub, LinkedIn, or portfolio website',
            completed: hasLinks,
            icon: Globe,
            action: () => navigate('/profile/' + userId)
        },
        {
            key: 'connect',
            label: 'Connect with 1 professional',
            desc: 'Send a connection request to someone on Discover',
            completed: hasConnection,
            icon: Users,
            action: () => navigate('/discover')
        },
        {
            key: 'save',
            label: 'Save a project',
            desc: 'Bookmark a project you are interested in',
            completed: hasSavedProject,
            icon: Bookmark,
            action: () => navigate('/projects')
        },
        {
            key: 'create_apply',
            label: 'Apply to a project OR create one',
            desc: 'Submit your first project application or create a new idea',
            completed: hasAppliedOrCreate,
            icon: PlusCircle,
            action: () => navigate('/projects')
        }
    ]

    const completedCount = items.filter(i => i.completed).length
    const totalCount = items.length
    const percentage = Math.round((completedCount / totalCount) * 100)

    // Trigger confetti when hitting 100%
    useEffect(() => {
        if (percentage === 100 && !profileData?.onboardingChecklist?.checklistCompleted) {
            setShowConfetti(true)
            const timer = setTimeout(() => setShowConfetti(false), 5000)

            // Auto save completion status in Firestore
            const updateStatus = async () => {
                try {
                    const docRef = doc(db, 'users', userId)
                    await updateDoc(docRef, {
                        'onboardingChecklist.checklistCompleted': true
                    })
                } catch (e) {
                    console.error('Failed to update checklist completed state', e)
                }
            }
            updateStatus()

            return () => clearTimeout(timer)
        }
    }, [percentage, userId, profileData?.onboardingChecklist?.checklistCompleted])

    const handleDismiss = async () => {
        setDismissed(true)
        try {
            const docRef = doc(db, 'users', userId)
            await updateDoc(docRef, {
                'onboardingChecklist.checklistDismissed': true
            })
            onDismiss()
        } catch (e) {
            console.error('Failed to dismiss onboarding checklist', e)
        }
    }

    if (dismissed || profileData?.onboardingChecklist?.checklistDismissed) {
        return null
    }

    return (
        <div className="relative">
            {/* Confetti Animation */}
            <AnimatePresence>
                {showConfetti && (
                    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
                        {[...Array(50)].map((_, i) => {
                            const size = Math.random() * 8 + 4
                            const colors = ['#3b82f6', '#6366f1', '#10b981', '#f59e0b', '#ec4899']
                            const randomColor = colors[Math.floor(Math.random() * colors.length)]
                            return (
                                <motion.div
                                    key={i}
                                    className="absolute rounded-full"
                                    style={{
                                        width: size,
                                        height: size,
                                        backgroundColor: randomColor,
                                        top: '50%',
                                        left: '50%'
                                    }}
                                    initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                                    animate={{
                                        x: (Math.random() - 0.5) * 600,
                                        y: (Math.random() - 0.5) * 400 - 150,
                                        scale: 0,
                                        opacity: [1, 1, 0],
                                        rotate: Math.random() * 360
                                    }}
                                    transition={{
                                        duration: Math.random() * 2 + 1.5,
                                        ease: 'easeOut'
                                    }}
                                />
                            )
                        })}
                    </div>
                )}
            </AnimatePresence>

            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 dark:from-indigo-950/20 border border-indigo-500/20 dark:border-indigo-500/10 rounded-2xl p-6 mb-8 shadow-xl overflow-hidden relative"
            >
                {/* Visual Accent */}
                <div className="absolute -right-20 -top-20 w-44 h-44 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="flex justify-between items-start mb-5 relative z-10">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" />
                                Onboarding Checklist
                            </h2>
                            {percentage === 100 && (
                                <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2.5 py-0.5 rounded-full font-medium border border-emerald-500/30 flex items-center gap-1 animate-bounce">
                                    All Done! 🎉
                                </span>
                            )}
                        </div>
                        <p className="text-slate-400 text-xs sm:text-sm mt-1">
                            Complete these quick steps to unlock ProCollab and matches tailored for you.
                        </p>
                    </div>
                    <button 
                        onClick={handleDismiss}
                        className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
                        title="Dismiss Checklist"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Progress bar */}
                <div className="mb-6 relative z-10">
                    <div className="flex justify-between text-xs text-slate-300 font-medium mb-1.5">
                        <span>Setup progress</span>
                        <span className="text-indigo-400">{percentage}% ({completedCount}/{totalCount})</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                        <motion.div 
                            className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                        />
                    </div>
                </div>

                {/* Checklist Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 relative z-10">
                    {items.map((item) => {
                        const Icon = item.icon
                        return (
                            <div 
                                key={item.key}
                                onClick={item.action}
                                className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all duration-300 cursor-pointer ${
                                    item.completed 
                                        ? 'bg-emerald-950/10 border-emerald-500/20 hover:border-emerald-500/40 text-slate-300' 
                                        : 'bg-slate-950/40 border-slate-800 hover:border-indigo-500/30 hover:bg-slate-900/60 text-slate-300'
                                }`}
                            >
                                <div className="mt-0.5 shrink-0">
                                    {item.completed ? (
                                        <CheckCircle2 className="h-5 w-5 text-emerald-500 fill-emerald-500/10" />
                                    ) : (
                                        <Circle className="h-5 w-5 text-slate-600 hover:text-indigo-400 transition-colors" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className={`text-sm font-semibold truncate ${item.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                                        {item.label}
                                    </h4>
                                    <p className="text-slate-500 text-xs line-clamp-1 mt-0.5">
                                        {item.desc}
                                    </p>
                                </div>
                                <div className="shrink-0 mt-1">
                                    <ArrowRight className="h-3 w-3 text-slate-600 hover:text-indigo-400" />
                                </div>
                            </div>
                        )
                    })}
                </div>
            </motion.div>
        </div>
    )
}

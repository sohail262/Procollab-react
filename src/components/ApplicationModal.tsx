import { useState, useEffect } from 'react'
import { X, FileText, MessageSquare, Zap, ChevronDown, ChevronUp, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { collection, addDoc, serverTimestamp, getDoc, doc } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { useToast } from '@/hooks/use-toast'
import { triggerNewApplicantNotification } from '@/services/notificationTrigger'
import { cachedGetDoc } from '@/lib/queryUtils'

interface ApplicationModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess?: () => void
    project: {
        id: string
        title: string
        createdBy: string
        openRoles?: string[]
    } | null
}

export function ApplicationModal({ isOpen, onClose, onSuccess, project }: ApplicationModalProps) {
    const { toast } = useToast()
    const [loading, setLoading] = useState(false)
    const [showDetailed, setShowDetailed] = useState(false)
    const [userProfile, setUserProfile] = useState<any>(null)
    const [profileLoading, setProfileLoading] = useState(false)

    const [formData, setFormData] = useState({
        position: '',
        skills: '',
        experience: '',
        motivation: '',
        timeCommitment: '',
        coverLetter: '',
        customMessage: '',
    })

    // Load user profile for pre-filling on modal open
    useEffect(() => {
        if (!isOpen || !auth.currentUser) return

        const fetchProfile = async () => {
            setProfileLoading(true)
            try {
                const snap = await cachedGetDoc(doc(db, 'users', auth.currentUser!.uid), { ttl: 300_000 })
                if (snap.exists()) {
                    const data = snap.data()
                    setUserProfile(data)

                    // Pre-fill skills from profile
                    let skillsStr = ''
                    if (data.skills) {
                        if (Array.isArray(data.skills)) {
                            skillsStr = data.skills.join(', ')
                        } else if (typeof data.skills === 'object') {
                            const all = [
                                ...(data.skills.technical || []),
                                ...(data.skills.soft || []),
                                ...(data.skills.tools || []),
                            ]
                            skillsStr = all.join(', ')
                        }
                    }

                    setFormData(prev => ({
                        ...prev,
                        skills: skillsStr,
                        experience: data.bio || '',
                    }))
                }
            } catch (err) {
                console.warn('Could not pre-fill profile:', err)
            } finally {
                setProfileLoading(false)
            }
        }

        fetchProfile()
    }, [isOpen])

    if (!isOpen || !project) return null

    const hasOpenRoles = project.openRoles && project.openRoles.length > 0

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!auth.currentUser) return

        // Prevent applying to own project
        if (auth.currentUser.uid === project.createdBy) {
            toast({ title: 'Cannot Apply', description: 'You cannot apply to your own project!', variant: 'warning' })
            return
        }

        if (!formData.position.trim()) {
            toast({ title: 'Position Required', description: 'Please select or enter a position.', variant: 'destructive' })
            return
        }

        setLoading(true)
        try {
            const statusHistory = [{
                status: 'applied',
                timestamp: new Date(),
                changedBy: auth.currentUser.uid,
            }]

            const applicationPayload = {
                userId: auth.currentUser.uid,
                userEmail: auth.currentUser.email,
                position: formData.position,
                skills: formData.skills,
                experience: formData.experience,
                motivation: formData.motivation || (userProfile?.bio ? `Excited to contribute to ${project.title}` : ''),
                timeCommitment: formData.timeCommitment || 'Flexible',
                coverLetter: formData.coverLetter || '',
                customMessage: formData.customMessage || '',
                status: 'applied',
                statusHistory,
                appliedAt: serverTimestamp(),
            }

            // Write to project's applications subcollection
            await addDoc(collection(db, 'projects', project.id, 'applications'), applicationPayload)

            // Write to user's applications subcollection
            await addDoc(collection(db, 'users', auth.currentUser.uid, 'applications'), {
                projectId: project.id,
                projectTitle: project.title,
                position: formData.position,
                status: 'applied',
                statusHistory,
                coverLetter: formData.coverLetter || '',
                customMessage: formData.customMessage || '',
                appliedAt: serverTimestamp(),
            })

            // Notify project owner
            try {
                const applicantDoc = await getDoc(doc(db, 'users', auth.currentUser.uid))
                const applicantData = applicantDoc.data()
                const applicantName = applicantData
                    ? `${applicantData.firstName || ''} ${applicantData.lastName || ''}`.trim() || auth.currentUser.email || 'Someone'
                    : auth.currentUser.email || 'Someone'
                await triggerNewApplicantNotification(project.createdBy, applicantName, project.id, project.title)
            } catch (notifErr) {
                console.warn('Failed to send owner notification:', notifErr)
            }

            // Reset form
            setFormData({ position: '', skills: '', experience: '', motivation: '', timeCommitment: '', coverLetter: '', customMessage: '' })
            setShowDetailed(false)

            toast({ title: '🎉 Application Submitted!', description: 'The project owner has been notified.', variant: 'success' })
            onClose()
            onSuccess?.()

        } catch (error) {
            console.error('Error submitting application:', error)
            toast({ title: 'Submission Failed', description: 'Failed to submit application. Please try again.', variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 max-w-md w-full max-h-[90vh] overflow-y-auto">

                {/* Header */}
                <div className="p-5 border-b dark:border-gray-800 flex justify-between items-start sticky top-0 bg-white dark:bg-gray-900 z-10 rounded-t-2xl">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Apply to Join</h2>
                        <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{project.title}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors mt-0.5"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-5">
                    <form onSubmit={handleSubmit} className="space-y-4">

                        {/* Express Apply Banner */}
                        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800">
                            <Zap className="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-indigo-800 dark:text-indigo-300">
                                    Express Apply — Pre-filled from your profile
                                </p>
                                {profileLoading ? (
                                    <p className="text-xs text-indigo-500 mt-0.5">Loading your profile…</p>
                                ) : userProfile ? (
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <div className="w-5 h-5 rounded-full overflow-hidden bg-indigo-200 shrink-0">
                                            {userProfile.photoURL ? (
                                                <img src={userProfile.photoURL} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <User className="h-3 w-3 text-indigo-500 m-1" />
                                            )}
                                        </div>
                                        <p className="text-xs text-indigo-600 dark:text-indigo-400 truncate">
                                            {`${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || 'Your profile'} · Skills pre-filled
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-xs text-indigo-500 mt-0.5">Complete your profile for faster applications</p>
                                )}
                            </div>
                        </div>

                        {/* Position — the one required field */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                                Role you're applying for *
                            </label>
                            {hasOpenRoles ? (
                                <select
                                    required
                                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                    value={formData.position}
                                    onChange={e => setFormData({ ...formData, position: e.target.value })}
                                >
                                    <option value="">Select a role…</option>
                                    {project.openRoles!.map((role, index) => (
                                        <option key={index} value={role}>{role}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    required
                                    type="text"
                                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                    placeholder="e.g. Frontend Developer, UI Designer…"
                                    value={formData.position}
                                    onChange={e => setFormData({ ...formData, position: e.target.value })}
                                />
                            )}
                        </div>

                        {/* Optional quick message */}
                        <div>
                            <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                                <MessageSquare className="h-3.5 w-3.5 text-gray-400" />
                                Quick message
                                <span className="text-xs font-normal text-gray-400">(optional)</span>
                            </label>
                            <Textarea
                                rows={2}
                                placeholder="Anything you'd like the team to know upfront…"
                                value={formData.customMessage}
                                onChange={e => setFormData({ ...formData, customMessage: e.target.value })}
                                className="resize-none text-sm rounded-xl"
                            />
                        </div>

                        {/* ── Detailed Application (expandable) ── */}
                        <button
                            type="button"
                            onClick={() => setShowDetailed(v => !v)}
                            className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-600 hover:text-gray-700 dark:hover:text-gray-300 transition-all"
                        >
                            <span className="flex items-center gap-2">
                                <FileText className="h-3.5 w-3.5" />
                                {showDetailed ? 'Hide detailed application' : 'Add detailed application (cover letter, experience…)'}
                            </span>
                            {showDetailed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>

                        {showDetailed && (
                            <div className="space-y-4 pt-1 animate-in slide-in-from-top-2 duration-200">

                                {/* Skills — pre-filled */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                        Relevant Skills
                                        {userProfile && formData.skills && (
                                            <span className="ml-2 text-xs text-indigo-500 font-normal">· pre-filled from profile</span>
                                        )}
                                    </label>
                                    <Textarea
                                        rows={2}
                                        placeholder="List your relevant skills for this role…"
                                        value={formData.skills}
                                        onChange={e => setFormData({ ...formData, skills: e.target.value })}
                                        className="resize-none text-sm rounded-xl"
                                    />
                                </div>

                                {/* Experience — pre-filled from bio */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                        Experience
                                        {userProfile?.bio && (
                                            <span className="ml-2 text-xs text-indigo-500 font-normal">· pre-filled from bio</span>
                                        )}
                                    </label>
                                    <Textarea
                                        rows={2}
                                        placeholder="Briefly describe your relevant experience…"
                                        value={formData.experience}
                                        onChange={e => setFormData({ ...formData, experience: e.target.value })}
                                        className="resize-none text-sm rounded-xl"
                                    />
                                </div>

                                {/* Motivation */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                        Why do you want to join?
                                    </label>
                                    <Textarea
                                        rows={2}
                                        placeholder="What excites you about this project?"
                                        value={formData.motivation}
                                        onChange={e => setFormData({ ...formData, motivation: e.target.value })}
                                        className="resize-none text-sm rounded-xl"
                                    />
                                </div>

                                {/* Time Commitment */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                        Weekly Availability
                                    </label>
                                    <select
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                        value={formData.timeCommitment}
                                        onChange={e => setFormData({ ...formData, timeCommitment: e.target.value })}
                                    >
                                        <option value="">Select availability…</option>
                                        <option value="1-5 hours/week">1–5 hours/week</option>
                                        <option value="5-10 hours/week">5–10 hours/week</option>
                                        <option value="10-15 hours/week">10–15 hours/week</option>
                                        <option value="15-20 hours/week">15–20 hours/week</option>
                                        <option value="20+ hours/week">20+ hours/week</option>
                                        <option value="Flexible">Flexible</option>
                                    </select>
                                </div>

                                {/* Cover Letter */}
                                <div>
                                    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                        <FileText className="h-3.5 w-3.5 text-gray-400" />
                                        Cover Letter
                                        <span className="text-xs text-gray-400 font-normal">(optional)</span>
                                    </label>
                                    <Textarea
                                        rows={3}
                                        placeholder="Tell us about yourself and why you're a great fit…"
                                        value={formData.coverLetter}
                                        onChange={e => setFormData({ ...formData, coverLetter: e.target.value })}
                                        className="resize-none text-sm rounded-xl"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">{formData.coverLetter.length}/1000</p>
                                </div>
                            </div>
                        )}

                        {/* Submit */}
                        <div className="flex gap-2 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                className="flex-1 rounded-xl"
                                onClick={onClose}
                                disabled={loading}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={loading || !formData.position}
                                className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 border-0 shadow-md shadow-indigo-500/20 gap-2"
                            >
                                {loading ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                        </svg>
                                        Submitting…
                                    </span>
                                ) : (
                                    <>
                                        <Zap className="h-4 w-4" />
                                        Submit Application
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
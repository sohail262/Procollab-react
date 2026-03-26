import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { useToast } from '@/hooks/use-toast'

interface ApplicationModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess?: () => void  // ✅ Added
    project: {
        id: string
        title: string
        createdBy: string
        openRoles?: string[]  // ✅ Added
    } | null
}

export function ApplicationModal({ isOpen, onClose, onSuccess, project }: ApplicationModalProps) {
    const { toast } = useToast()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        position: '',
        skills: '',
        experience: '',
        motivation: '',
        timeCommitment: ''
    })

    if (!isOpen || !project) return null

    const hasOpenRoles = project.openRoles && project.openRoles.length > 0

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!auth.currentUser) return

        // CRITICAL: Prevent applying to own project
        if (auth.currentUser.uid === project.createdBy) {
            toast({
                title: 'Cannot Apply',
                description: 'You cannot apply to your own project!',
                variant: 'warning',
            })
            return
        }

        // Validate position selected
        if (!formData.position.trim()) {
            toast({
                title: 'Position Required',
                description: 'Please select or enter a position.',
                variant: 'destructive',
            })
            return
        }

        setLoading(true)
        try {
            // ✅ Create application in project's subcollection
            await addDoc(collection(db, 'projects', project.id, 'applications'), {
                userId: auth.currentUser.uid,
                userEmail: auth.currentUser.email,
                position: formData.position,
                skills: formData.skills,
                experience: formData.experience,
                motivation: formData.motivation,
                timeCommitment: formData.timeCommitment,
                status: 'pending',
                appliedAt: serverTimestamp()
            })

            // ✅ Also add to user's applications subcollection
            await addDoc(collection(db, 'users', auth.currentUser.uid, 'applications'), {
                projectId: project.id,
                projectTitle: project.title,
                position: formData.position,
                status: 'pending',
                appliedAt: serverTimestamp()
            })

            // Reset form
            setFormData({
                position: '',
                skills: '',
                experience: '',
                motivation: '',
                timeCommitment: ''
            })

            toast({
                title: 'Application Submitted',
                description: 'Your application has been submitted successfully!',
                variant: 'success',
            })

            onClose()
            onSuccess?.() // ✅ Trigger status refresh in ProjectDetails

        } catch (error) {
            console.error('Error submitting application:', error)
            toast({
                title: 'Submission Failed',
                description: 'Failed to submit application. Please try again.',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">

                {/* Header */}
                <div className="p-6 border-b dark:border-gray-800 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-900 z-10">
                    <div>
                        <h2 className="text-xl font-bold">Apply to Join</h2>
                        <p className="text-sm text-gray-500 mt-0.5">{project.title}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div className="p-6">
                    <form onSubmit={handleSubmit} className="space-y-5">

                        {/* ✅ Position: dropdown if openRoles exist, text input as fallback */}
                        <div>
                            <label className="block text-sm font-medium mb-1.5">
                                Position
                                {hasOpenRoles ? (
                                    <span className="ml-1.5 text-xs text-gray-400 font-normal">
                                        (select from open roles)
                                    </span>
                                ) : (
                                    <span className="ml-1.5 text-xs text-gray-400 font-normal">
                                        (enter your desired role)
                                    </span>
                                )}
                            </label>

                            {hasOpenRoles ? (
                                // ✅ Dropdown from project's openRoles
                                <select
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    value={formData.position}
                                    onChange={e => setFormData({ ...formData, position: e.target.value })}
                                >
                                    <option value="">Select a role...</option>
                                    {project.openRoles!.map((role, index) => (
                                        <option key={index} value={role}>
                                            {role}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                // ✅ Fallback: free text if no roles defined
                                <input
                                    required
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="e.g. Frontend Developer"
                                    value={formData.position}
                                    onChange={e => setFormData({ ...formData, position: e.target.value })}
                                />
                            )}
                        </div>

                        {/* Relevant Skills */}
                        <div>
                            <label className="block text-sm font-medium mb-1.5">
                                Relevant Skills
                            </label>
                            <Textarea
                                required
                                rows={3}
                                placeholder="List your relevant skills for this role..."
                                value={formData.skills}
                                onChange={e => setFormData({ ...formData, skills: e.target.value })}
                                className="resize-none"
                            />
                        </div>

                        {/* Experience */}
                        <div>
                            <label className="block text-sm font-medium mb-1.5">
                                Experience
                            </label>
                            <Textarea
                                required
                                rows={3}
                                placeholder="Briefly describe your relevant experience..."
                                value={formData.experience}
                                onChange={e => setFormData({ ...formData, experience: e.target.value })}
                                className="resize-none"
                            />
                        </div>

                        {/* Motivation */}
                        <div>
                            <label className="block text-sm font-medium mb-1.5">
                                Why do you want to join?
                            </label>
                            <Textarea
                                required
                                rows={3}
                                placeholder="What excites you about this project?"
                                value={formData.motivation}
                                onChange={e => setFormData({ ...formData, motivation: e.target.value })}
                                className="resize-none"
                            />
                        </div>

                        {/* Time Commitment */}
                        <div>
                            <label className="block text-sm font-medium mb-1.5">
                                Weekly Availability
                            </label>
                            <select
                                required
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                value={formData.timeCommitment}
                                onChange={e => setFormData({ ...formData, timeCommitment: e.target.value })}
                            >
                                <option value="">Select your availability...</option>
                                <option value="1-5 hours/week">1-5 hours/week</option>
                                <option value="5-10 hours/week">5-10 hours/week</option>
                                <option value="10-15 hours/week">10-15 hours/week</option>
                                <option value="15-20 hours/week">15-20 hours/week</option>
                                <option value="20+ hours/week">20+ hours/week</option>
                                <option value="Flexible">Flexible</option>
                            </select>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 pt-2 border-t dark:border-gray-800">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClose}
                                disabled={loading}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={loading}
                            >
                                {loading ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                        </svg>
                                        Submitting...
                                    </span>
                                ) : (
                                    'Submit Application'
                                )}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
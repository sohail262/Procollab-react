import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { useToast } from '@/hooks/use-toast'

interface ApplicationModalProps {
    isOpen: boolean
    onClose: () => void
    project: {
        id: string
        title: string
        createdBy: string
    } | null
}

export function ApplicationModal({ isOpen, onClose, project }: ApplicationModalProps) {
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

        setLoading(true)
        try {
            // Create application document
            await addDoc(collection(db, 'projects', project.id, 'applications'), {
                userId: auth.currentUser.uid,
                userEmail: auth.currentUser.email,
                ...formData,
                status: 'pending',
                appliedAt: serverTimestamp()
            })

            // Also add to user's applications
            await addDoc(collection(db, 'users', auth.currentUser.uid, 'applications'), {
                projectId: project.id,
                projectTitle: project.title,
                position: formData.position,
                status: 'pending',
                appliedAt: serverTimestamp()
            })

            onClose()
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
                <div className="p-6 border-b dark:border-gray-800 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-900 z-10">
                    <h2 className="text-xl font-bold">Apply to {project.title}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div className="p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Position</label>
                            <Input
                                required
                                placeholder="e.g. Frontend Developer"
                                value={formData.position}
                                onChange={e => setFormData({ ...formData, position: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Relevant Skills</label>
                            <Textarea
                                required
                                placeholder="List your relevant skills..."
                                value={formData.skills}
                                onChange={e => setFormData({ ...formData, skills: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Experience</label>
                            <Textarea
                                required
                                placeholder="Briefly describe your relevant experience..."
                                value={formData.experience}
                                onChange={e => setFormData({ ...formData, experience: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Motivation</label>
                            <Textarea
                                required
                                placeholder="Why do you want to join this project?"
                                value={formData.motivation}
                                onChange={e => setFormData({ ...formData, motivation: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Time Commitment</label>
                            <select
                                className="w-full px-3 py-2 border rounded-md bg-background"
                                required
                                value={formData.timeCommitment}
                                onChange={e => setFormData({ ...formData, timeCommitment: e.target.value })}
                            >
                                <option value="">Select availability</option>
                                <option value="5-10">5-10 hours/week</option>
                                <option value="10-15">10-15 hours/week</option>
                                <option value="15-20">15-20 hours/week</option>
                                <option value="20+">20+ hours/week</option>
                            </select>
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? 'Submitting...' : 'Submit Application'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}

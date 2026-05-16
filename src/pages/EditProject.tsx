import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Loader2, Trash2, AlertCircle } from 'lucide-react'
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'

export function EditProject() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { toast } = useToast()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    const [formData, setFormData] = useState({
        title: '',
        summary: '',
        description: '',
        status: 'recruiting',
        duration: '',
        durationUnit: 'months',
        teamSize: 4,
        primaryDiscipline: '',
        requiredSkills: '',
        tags: '',
        timeCommitment: '5-10 hours/week',
        openRoles: '',
        goals: '',
        timeline: '',
        location: 'remote',
        locationDetails: '',
        additionalNotes: ''
    })

    useEffect(() => {
        if (id && auth.currentUser) {
            loadProject()
        }
    }, [id])

    const loadProject = async () => {
        if (!id) return
        setLoading(true)
        try {
            const docRef = doc(db, 'projects', id)
            const docSnap = await getDoc(docRef)

            if (docSnap.exists()) {
                const project = docSnap.data()

                if (project.createdBy !== auth.currentUser?.uid) {
                    toast({
                        title: 'Access Denied',
                        description: 'You do not have permission to edit this project',
                        variant: 'destructive',
                    })
                    navigate(`/project/${id}`)
                    return
                }

                // ✅ Parse duration smartly
                // Handles 3 cases:
                // 1. New format: durationValue="3" + durationUnit="months" saved separately
                // 2. Combined format: duration="3 months"
                // 3. Old format: duration="3" (just a number)
                let durationValue = ''
                let durationUnit = project.durationUnit || 'months'

                if (project.durationValue) {
                    // Case 1: New format — use directly
                    durationValue = project.durationValue.toString()
                    durationUnit = project.durationUnit || 'months'
                } else if (project.duration) {
                    const durationStr = project.duration.toString().trim()
                    const parts = durationStr.split(' ')
                    if (parts.length >= 2) {
                        // Case 2: "3 months" — split it
                        durationValue = parts[0]
                        durationUnit = parts[1]
                    } else {
                        // Case 3: just "3"
                        durationValue = parts[0]
                    }
                }

                setFormData({
                    title: project.title || '',
                    summary: project.summary || '',
                    description: project.description || '',
                    status: project.status || 'recruiting',
                    duration: durationValue,
                    durationUnit: durationUnit,
                    teamSize: project.teamSize || 4,
                    primaryDiscipline: project.primaryDiscipline || '',
                    requiredSkills: project.requiredSkills?.join(', ') || '',
                    tags: project.tags?.join(', ') || '',
                    timeCommitment: project.timeCommitment || '5-10 hours/week',
                    openRoles: project.openRoles?.join('\n') || '',
                    goals: project.goals?.join('\n') || '',
                    timeline: project.timeline || '',
                    location: project.location || 'remote',
                    locationDetails: project.locationDetails || '',
                    additionalNotes: project.additionalNotes || ''
                })
            } else {
                toast({
                    title: 'Not Found',
                    description: 'Project not found',
                    variant: 'destructive',
                })
                navigate('/dashboard/projects')
            }
        } catch (error) {
            console.error('Error loading project:', error)
            toast({
                title: 'Load Failed',
                description: 'Failed to load project',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!id) return

        setSaving(true)
        try {
            const updateData = {
                title: formData.title,
                summary: formData.summary,
                description: formData.description,
                status: formData.status,

                // ✅ Save all 3 duration formats
                duration: `${formData.duration} ${formData.durationUnit}`,
                durationValue: formData.duration,
                durationUnit: formData.durationUnit,

                teamSize: parseInt(formData.teamSize.toString()),
                maxMembers: parseInt(formData.teamSize.toString()), // ✅ keep in sync
                primaryDiscipline: formData.primaryDiscipline,
                disciplines: [formData.primaryDiscipline].filter(Boolean),
                requiredSkills: formData.requiredSkills
                    .split(',').map(s => s.trim()).filter(Boolean),
                tags: formData.tags
                    .split(',').map(t => t.trim()).filter(Boolean),
                timeCommitment: formData.timeCommitment,
                openRoles: formData.openRoles
                    .split('\n').map(r => r.trim()).filter(Boolean),
                goals: formData.goals
                    .split('\n').map(g => g.trim()).filter(Boolean),
                timeline: formData.timeline,
                location: formData.location,
                locationDetails: formData.locationDetails,
                additionalNotes: formData.additionalNotes,
                updatedAt: serverTimestamp()
            }

            await updateDoc(doc(db, 'projects', id), updateData)
            toast({
                title: 'Project Updated',
                description: 'Your project has been updated successfully!',
                variant: 'success',
            })
            navigate(`/project/${id}`)
        } catch (error) {
            console.error('Error updating project:', error)
            toast({
                title: 'Update Failed',
                description: 'Failed to update project. Please try again.',
                variant: 'destructive',
            })
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!id) return
        setDeleting(true)
        try {
            await deleteDoc(doc(db, 'projects', id))
            toast({
                title: 'Project Deleted',
                description: 'Your project has been deleted successfully.',
                variant: 'success',
            })
            navigate('/dashboard/projects')
        } catch (error) {
            console.error('Error deleting project:', error)
            toast({
                title: 'Delete Failed',
                description: 'Failed to delete project. Please try again.',
                variant: 'destructive',
            })
        } finally {
            setDeleting(false)
            setShowDeleteConfirm(false)
        }
    }

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-12 w-12 animate-spin" />
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Edit Project</h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">Update your project details</p>
                    </div>
                    <Button variant="ghost" onClick={() => navigate(`/project/${id}`)}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Basic Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="title">Project Title *</Label>
                                <Input
                                    id="title"
                                    required
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="summary">Summary *</Label>
                                <Input
                                    id="summary"
                                    required
                                    value={formData.summary}
                                    onChange={e => setFormData({ ...formData, summary: e.target.value })}
                                    maxLength={150}
                                />
                                <p className="text-xs text-gray-500">{formData.summary.length}/150</p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">Description *</Label>
                                <Textarea
                                    id="description"
                                    required
                                    rows={5}
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="status">Status *</Label>
                                    <select
                                        id="status"
                                        className="w-full px-3 py-2 border rounded-md bg-background"
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                                    >
                                        <option value="recruiting">Recruiting</option>
                                        <option value="active">Active</option>
                                        <option value="completed">Completed</option>
                                        <option value="on-hold">On Hold</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="discipline">Primary Discipline *</Label>
                                    <select
                                        id="discipline"
                                        className="w-full px-3 py-2 border rounded-md bg-background"
                                        required
                                        value={formData.primaryDiscipline}
                                        onChange={e => setFormData({ ...formData, primaryDiscipline: e.target.value })}
                                    >
                                        <option value="">Select discipline</option>
                                        <option value="computer-science">Computer Science</option>
                                        <option value="engineering">Engineering</option>
                                        <option value="medicine">Medicine & Health</option>
                                        <option value="business">Business & Economics</option>
                                        <option value="arts">Arts & Humanities</option>
                                        <option value="social-sciences">Social Sciences</option>
                                        <option value="natural-sciences">Natural Sciences</option>
                                        <option value="education">Education</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Team & Timeline */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Team & Timeline</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="teamSize">Team Size *</Label>
                                    <Input
                                        id="teamSize"
                                        type="number"
                                        min="1"
                                        max="50"
                                        required
                                        value={formData.teamSize}
                                        onChange={e => setFormData({
                                            ...formData,
                                            teamSize: parseInt(e.target.value)
                                        })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="duration">Duration *</Label>
                                    <Input
                                        id="duration"
                                        type="number"
                                        min="1"
                                        required
                                        value={formData.duration}
                                        onChange={e => setFormData({
                                            ...formData,
                                            duration: e.target.value
                                        })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="durationUnit">Unit</Label>
                                    <select
                                        id="durationUnit"
                                        className="w-full px-3 py-2 border rounded-md bg-background"
                                        value={formData.durationUnit}
                                        onChange={e => setFormData({
                                            ...formData,
                                            durationUnit: e.target.value
                                        })}
                                    >
                                        <option value="weeks">Weeks</option>
                                        <option value="months">Months</option>
                                        <option value="years">Years</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="timeCommitment">Time Commitment</Label>
                                <select
                                    id="timeCommitment"
                                    className="w-full px-3 py-2 border rounded-md bg-background"
                                    value={formData.timeCommitment}
                                    onChange={e => setFormData({
                                        ...formData,
                                        timeCommitment: e.target.value
                                    })}
                                >
                                    <option value="1-5 hours/week">1-5 hours/week</option>
                                    <option value="5-10 hours/week">5-10 hours/week</option>
                                    <option value="10-20 hours/week">10-20 hours/week</option>
                                    <option value="20+ hours/week">20+ hours/week</option>
                                    <option value="Flexible">Flexible</option>
                                </select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Skills & Roles */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Skills & Roles</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="skills">Required Skills</Label>
                                <Input
                                    id="skills"
                                    value={formData.requiredSkills}
                                    onChange={e => setFormData({
                                        ...formData,
                                        requiredSkills: e.target.value
                                    })}
                                    placeholder="Python, React, UI/UX Design (comma-separated)"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="tags">Tags</Label>
                                <Input
                                    id="tags"
                                    value={formData.tags}
                                    onChange={e => setFormData({
                                        ...formData,
                                        tags: e.target.value
                                    })}
                                    placeholder="AI, Healthcare, Mobile (comma-separated)"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="roles">Open Roles</Label>
                                <Textarea
                                    id="roles"
                                    rows={4}
                                    value={formData.openRoles}
                                    onChange={e => setFormData({
                                        ...formData,
                                        openRoles: e.target.value
                                    })}
                                    placeholder="Frontend Developer&#10;UX Designer&#10;Data Scientist"
                                />
                                <p className="text-xs text-gray-500">One role per line</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Goals & Timeline */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Goals & Timeline</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="goals">Project Goals</Label>
                                <Textarea
                                    id="goals"
                                    rows={4}
                                    value={formData.goals}
                                    onChange={e => setFormData({
                                        ...formData,
                                        goals: e.target.value
                                    })}
                                    placeholder="Develop prototype&#10;Launch beta&#10;Publish research"
                                />
                                <p className="text-xs text-gray-500">One goal per line</p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="timeline">Timeline</Label>
                                <Textarea
                                    id="timeline"
                                    rows={4}
                                    value={formData.timeline}
                                    onChange={e => setFormData({
                                        ...formData,
                                        timeline: e.target.value
                                    })}
                                    placeholder="Month 1: Research&#10;Month 2-3: Development"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Location */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Location</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="location">Project Location *</Label>
                                <select
                                    id="location"
                                    className="w-full px-3 py-2 border rounded-md bg-background"
                                    value={formData.location}
                                    onChange={e => setFormData({
                                        ...formData,
                                        location: e.target.value
                                    })}
                                >
                                    <option value="remote">Remote/Virtual</option>
                                    <option value="in-person">In-Person</option>
                                    <option value="hybrid">Hybrid</option>
                                </select>
                            </div>

                            {formData.location !== 'remote' && (
                                <div className="space-y-2">
                                    <Label htmlFor="locationDetails">Location Details</Label>
                                    <Input
                                        id="locationDetails"
                                        value={formData.locationDetails}
                                        onChange={e => setFormData({
                                            ...formData,
                                            locationDetails: e.target.value
                                        })}
                                        placeholder="City, State, Country"
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="notes">Additional Notes</Label>
                                <Textarea
                                    id="notes"
                                    rows={3}
                                    value={formData.additionalNotes}
                                    onChange={e => setFormData({
                                        ...formData,
                                        additionalNotes: e.target.value
                                    })}
                                    placeholder="Any other information..."
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Actions */}
                    <div className="flex justify-between items-center">
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={() => setShowDeleteConfirm(true)}
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Project
                        </Button>

                        <div className="flex gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => navigate(`/project/${id}`)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={saving}>
                                {saving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    'Save Changes'
                                )}
                            </Button>
                        </div>
                    </div>
                </form>
            </div>

            {/* Delete Confirmation */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="max-w-md w-full">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-red-600">
                                <AlertCircle className="h-5 w-5" />
                                Delete Project
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Alert>
                                <AlertDescription>
                                    This action cannot be undone. This will permanently delete your
                                    project and remove all associated data.
                                </AlertDescription>
                            </Alert>
                            <div className="flex justify-end gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowDeleteConfirm(false)}
                                    disabled={deleting}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={handleDelete}
                                    disabled={deleting}
                                >
                                    {deleting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Deleting...
                                        </>
                                    ) : (
                                        'Delete Project'
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </DashboardLayout>
    )
}

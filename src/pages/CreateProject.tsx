import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { ArrowLeft, Loader2, AlertTriangle, ShieldAlert, CheckCircle, Info, Shield, XCircle } from 'lucide-react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { useToast } from '@/hooks/use-toast'
import {
    analyzeProjectContent,
    getModerationStatus,
    getFlagMessage,
    type ModerationAnalysis
} from '@/services/contentModerationService'

export function CreateProject() {
    const navigate = useNavigate()
    const { toast } = useToast()
    const [loading, setLoading] = useState(false)
    const [moderationWarnings, setModerationWarnings] = useState<ModerationAnalysis | null>(null)
    const [showWarnings, setShowWarnings] = useState(false)
    const [showGuidelinesDialog, setShowGuidelinesDialog] = useState(true)

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!auth.currentUser) return

        // Prepare project data for moderation check
        const projectDataForModeration = {
            title: formData.title,
            summary: formData.summary,
            description: formData.description,
            goals: formData.goals.split('\n').map(g => g.trim()).filter(Boolean),
            tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
            requiredSkills: formData.requiredSkills.split(',').map(s => s.trim()).filter(Boolean),
            openRoles: formData.openRoles.split('\n').map(r => r.trim()).filter(Boolean),
            additionalNotes: formData.additionalNotes,
            primaryDiscipline: formData.primaryDiscipline,
            teamSize: formData.teamSize,
            duration: formData.duration
        }

        // Run content moderation
        const analysis = analyzeProjectContent(projectDataForModeration)
        const moderationStatus = getModerationStatus(analysis)

        // If project requires review, show warning and block submission
        if (moderationStatus === 'rejected') {
            setModerationWarnings(analysis)
            setShowWarnings(true)
            toast({
                title: 'Project Rejected',
                description: 'Your project contains content that violates our guidelines. Please review and fix the issues.',
                variant: 'destructive',
            })
            return
        }

        // If project requires review, add to moderation queue
        if (moderationStatus === 'review') {
            setModerationWarnings(analysis)
            setShowWarnings(true)
            toast({
                title: 'Project Under Review',
                description: 'Your project has been submitted for review. An admin will review it shortly.',
                variant: 'warning',
            })
            // Still create the project but with pending_review status
        }

        // Show warnings but allow submission
        if (moderationStatus === 'warning' && !showWarnings) {
            setModerationWarnings(analysis)
            setShowWarnings(true)
            toast({
                title: 'Please Review',
                description: 'Your project has some issues. Review them below and submit again if everything is correct.',
                variant: 'warning',
            })
            return
        }

        setLoading(true)
        try {
            const projectData = {
                title: formData.title,
                summary: formData.summary,
                description: formData.description,
                status: moderationStatus === 'review' ? 'pending_review' : formData.status,
                duration: formData.duration,
                durationUnit: formData.durationUnit,
                teamSize: parseInt(formData.teamSize.toString()),
                maxMembers: parseInt(formData.teamSize.toString()),
                currentMembers: 1,
                primaryDiscipline: formData.primaryDiscipline,
                disciplines: [formData.primaryDiscipline].filter(Boolean),
                requiredSkills: formData.requiredSkills.split(',').map(s => s.trim()).filter(Boolean),
                tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
                timeCommitment: formData.timeCommitment,
                openRoles: formData.openRoles.split('\n').map(r => r.trim()).filter(Boolean),
                goals: formData.goals.split('\n').map(g => g.trim()).filter(Boolean),
                timeline: formData.timeline,
                location: formData.location,
                locationDetails: formData.locationDetails,
                additionalNotes: formData.additionalNotes,
                createdBy: auth.currentUser.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                // Add moderation metadata
                moderationScore: analysis.riskScore,
                moderationStatus: moderationStatus === 'review' ? 'pending' : 'approved',
                moderationFlags: analysis.flags.map(f => f.type)
            }

            const docRef = await addDoc(collection(db, 'projects'), projectData)

            // If project needs review, also add to moderation queue
            if (moderationStatus === 'review') {
                await addDoc(collection(db, 'moderationQueue'), {
                    projectId: docRef.id,
                    userId: auth.currentUser.uid,
                    flags: analysis.flags,
                    riskScore: analysis.riskScore,
                    status: 'pending',
                    createdAt: serverTimestamp(),
                    reviewedAt: null,
                    reviewerId: null
                })
            }

            toast({
                title: moderationStatus === 'review' ? 'Project Submitted for Review' : 'Project Created',
                description: moderationStatus === 'review'
                    ? 'Your project is pending admin approval.'
                    : 'Your project has been created successfully!',
                variant: 'success',
            })
            navigate(`/project/${docRef.id}`)
        } catch (error) {
            console.error('Error creating project:', error)
            toast({
                title: 'Creation Failed',
                description: 'Failed to create project. Please try again.',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create Project</h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">Fill in the details to create your new project</p>
                    </div>
                    <Button variant="ghost" onClick={() => navigate('/my-projects')}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                </div>

                {/* Moderation Warnings */}
                {showWarnings && moderationWarnings && moderationWarnings.flags.length > 0 && (
                    <Alert variant={moderationWarnings.requiresReview ? "destructive" : "default"} className="border-2">
                        <ShieldAlert className="h-5 w-5" />
                        <AlertTitle className="flex items-center gap-2">
                            {moderationWarnings.requiresReview
                                ? 'Project Requires Review'
                                : 'Please Review These Issues'}
                        </AlertTitle>
                        <AlertDescription>
                            <ul className="mt-2 space-y-1">
                                {moderationWarnings.flags.map((flag, index) => (
                                    <li key={index} className="flex items-start gap-2 text-sm">
                                        <span className={`mt-0.5 ${flag.severity === 'high' ? 'text-red-500' :
                                            flag.severity === 'medium' ? 'text-yellow-500' : 'text-blue-500'
                                            }`}>
                                            {flag.severity === 'high' ? '🔴' : flag.severity === 'medium' ? '🟡' : '🔵'}
                                        </span>
                                        <span>{getFlagMessage(flag)}</span>
                                    </li>
                                ))}
                            </ul>
                            {!moderationWarnings.requiresReview && (
                                <p className="mt-3 text-sm font-medium">
                                    If you believe your project is valid, click "Create Project" again to submit.
                                </p>
                            )}
                        </AlertDescription>
                    </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Basic Information</CardTitle>
                            <CardDescription>Provide the essential details about your project</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="title">Project Title *</Label>
                                <Input
                                    id="title"
                                    required
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="Enter your project title"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="summary">Summary *</Label>
                                <Input
                                    id="summary"
                                    required
                                    value={formData.summary}
                                    onChange={e => setFormData({ ...formData, summary: e.target.value })}
                                    placeholder="Brief description (max 150 characters)"
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
                                    placeholder="Detailed description of your project"
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
                                        <option value="planning">Planning</option>
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
                            <CardDescription>Define your team requirements and project duration</CardDescription>
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
                                        onChange={e => setFormData({ ...formData, teamSize: parseInt(e.target.value) })}
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
                                        onChange={e => setFormData({ ...formData, duration: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="durationUnit">Unit</Label>
                                    <select
                                        id="durationUnit"
                                        className="w-full px-3 py-2 border rounded-md bg-background"
                                        value={formData.durationUnit}
                                        onChange={e => setFormData({ ...formData, durationUnit: e.target.value })}
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
                                    onChange={e => setFormData({ ...formData, timeCommitment: e.target.value })}
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
                            <CardDescription>Specify required skills and open positions</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="skills">Required Skills</Label>
                                <Input
                                    id="skills"
                                    value={formData.requiredSkills}
                                    onChange={e => setFormData({ ...formData, requiredSkills: e.target.value })}
                                    placeholder="Python, React, UI/UX Design (comma-separated)"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="tags">Tags</Label>
                                <Input
                                    id="tags"
                                    value={formData.tags}
                                    onChange={e => setFormData({ ...formData, tags: e.target.value })}
                                    placeholder="AI, Healthcare, Mobile (comma-separated)"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="roles">Open Roles</Label>
                                <Textarea
                                    id="roles"
                                    rows={4}
                                    value={formData.openRoles}
                                    onChange={e => setFormData({ ...formData, openRoles: e.target.value })}
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
                            <CardDescription>Define your project objectives and milestones</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="goals">Project Goals</Label>
                                <Textarea
                                    id="goals"
                                    rows={4}
                                    value={formData.goals}
                                    onChange={e => setFormData({ ...formData, goals: e.target.value })}
                                    placeholder="Develop prototype&#10;Launch beta&#10;Publish research"
                                />
                                <p className="text-xs text-gray-500">One goal per line</p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="timeline">Timeline (Optional)</Label>
                                <Textarea
                                    id="timeline"
                                    rows={4}
                                    value={formData.timeline}
                                    onChange={e => setFormData({ ...formData, timeline: e.target.value })}
                                    placeholder="Month 1: Research&#10;Month 2-3: Development"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Location */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Location</CardTitle>
                            <CardDescription>Specify where the project will take place</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="location">Project Location *</Label>
                                <select
                                    id="location"
                                    className="w-full px-3 py-2 border rounded-md bg-background"
                                    value={formData.location}
                                    onChange={e => setFormData({ ...formData, location: e.target.value })}
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
                                        onChange={e => setFormData({ ...formData, locationDetails: e.target.value })}
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
                                    onChange={e => setFormData({ ...formData, additionalNotes: e.target.value })}
                                    placeholder="Any other information..."
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Actions */}
                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={() => navigate('/my-projects')}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                'Create Project'
                            )}
                        </Button>
                    </div>
                </form>
            </div>

            {/* Moderation Guidelines Dialog */}
            <Dialog open={showGuidelinesDialog} onOpenChange={setShowGuidelinesDialog}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <Shield className="h-6 w-6 text-blue-500" />
                            Project Guidelines
                        </DialogTitle>
                        <DialogDescription>
                            Please review these guidelines to ensure your project is approved quickly.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-3">
                            <h4 className="font-semibold flex items-center gap-2 text-green-600 dark:text-green-400">
                                <CheckCircle className="h-5 w-5" />
                                Your project will be approved if it:
                            </h4>
                            <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400 ml-7">
                                <li>• Has a clear, descriptive title (not just "Test" or "Project")</li>
                                <li>• Includes a detailed summary and description</li>
                                <li>• Specifies required skills and team size</li>
                                <li>• Uses professional, appropriate language</li>
                                <li>• Is a genuine academic/professional project</li>
                            </ul>
                        </div>

                        <div className="space-y-3">
                            <h4 className="font-semibold flex items-center gap-2 text-red-600 dark:text-red-400">
                                <XCircle className="h-5 w-5" />
                                Your project may be flagged if it contains:
                            </h4>
                            <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400 ml-7">
                                <li>• Placeholder text (lorem ipsum, TBD, N/A)</li>
                                <li>• Vague descriptions ("just for fun", "idk", "test")</li>
                                <li>• Very short content (less than 100 characters)</li>
                                <li>• Spam-like language ("click here", "urgent")</li>
                                <li>• Inappropriate or offensive content</li>
                                <li>• Unrealistic requirements ("unpaid", "free work")</li>
                            </ul>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                            <p className="text-sm text-blue-700 dark:text-blue-300 flex items-start gap-2">
                                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                Projects with issues will be submitted for admin review. You'll be notified once approved or if changes are needed.
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button onClick={() => setShowGuidelinesDialog(false)} className="w-full">
                            Got it, let's create my project!
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    )
}

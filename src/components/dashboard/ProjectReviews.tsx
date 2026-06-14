import { useState } from 'react'
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Star, Loader2 } from 'lucide-react'
import { db } from '@/lib/firebase'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'

interface ProjectReviewsProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    projectId: string
    projectName: string
    targetUserId: string
    targetUserName: string
    onReviewSubmitted?: () => void
}

export function ProjectReviews({
    open,
    onOpenChange,
    projectId,
    projectName,
    targetUserId,
    targetUserName,
    onReviewSubmitted,
}: ProjectReviewsProps) {
    const { user } = useAuth()
    const { toast } = useToast()
    const [submitting, setSubmitting] = useState(false)

    // Form states
    const [cooperation, setCooperation] = useState(5)
    const [reliability, setReliability] = useState(5)
    const [communication, setCommunication] = useState(5)
    const [skill, setSkill] = useState(5)
    const [comment, setComment] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user || submitting) return
        setSubmitting(true)

        try {
            const reviewId = `${user.uid}_${projectId}`
            const reviewRef = doc(db, 'users', targetUserId, 'reviews', reviewId)

            await setDoc(reviewRef, {
                projectId,
                projectName,
                reviewerId: user.uid,
                reviewerName: user.displayName || user.email || 'Anonymous',
                reviewerAvatar: user.photoURL || '',
                cooperation,
                reliability,
                communication,
                skill,
                comment: comment.trim(),
                createdAt: serverTimestamp(),
            })

            toast({
                title: 'Review submitted!',
                description: `Successfully reviewed ${targetUserName}.`,
            })
            onOpenChange(false)
            setComment('')
            onReviewSubmitted?.()
        } catch (err: any) {
            console.error('Error submitting review:', err)
            toast({
                title: 'Error submitting review',
                description: err.message || 'Please try again later.',
                variant: 'destructive',
            })
        } finally {
            setSubmitting(false)
        }
    }

    const renderStars = (rating: number, setRating: (val: number) => void) => {
        return (
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((val) => (
                    <button
                        key={val}
                        type="button"
                        onClick={() => setRating(val)}
                        className="p-0.5 transition-transform hover:scale-125 focus:outline-none"
                    >
                        <Star
                            className={`h-5 w-5 ${
                                val <= rating
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-zinc-300 dark:text-zinc-600'
                            }`}
                        />
                    </button>
                ))}
            </div>
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl shadow-2xl p-6">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                        Teammate Feedback
                    </DialogTitle>
                    <DialogDescription className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Leave peer feedback for <span className="font-semibold text-zinc-700 dark:text-zinc-300">{targetUserName}</span> based on their contribution to <span className="italic">{projectName}</span>.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                                Cooperation & Teamwork
                            </Label>
                            {renderStars(cooperation, setCooperation)}
                        </div>

                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                                Reliability & Sprints
                            </Label>
                            {renderStars(reliability, setReliability)}
                        </div>

                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                                Communication
                            </Label>
                            {renderStars(communication, setCommunication)}
                        </div>

                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                                Technical Skill
                            </Label>
                            {renderStars(skill, setSkill)}
                        </div>
                    </div>

                    <div className="space-y-2 mt-4">
                        <Label htmlFor="comment" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                            Endorsement & Comments
                        </Label>
                        <Textarea
                            id="comment"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Describe how they helped the project succeed (e.g. reliable sprint deliveries, great code structure)..."
                            className="text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:ring-zinc-900 dark:focus:ring-zinc-100"
                            rows={3}
                        />
                    </div>

                    <DialogFooter className="pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={submitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={submitting}
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Submitting
                                </>
                            ) : (
                                'Submit Review'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

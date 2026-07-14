import { useState, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { submitFeedback } from '@/services/feedbackService'
import { 
    Bug, 
    MessageSquare, 
    Sparkles, 
    UploadCloud, 
    CheckCircle2, 
    Image as ImageIcon, 
    ArrowRight, 
    Lock, 
    User, 
    Loader2,
    X
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

type FeedbackType = 'bug' | 'feedback' | 'feature_request'

export default function Feedback() {
    const { user } = useAuth()
    const { toast } = useToast()
    const navigate = useNavigate()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [type, setType] = useState<FeedbackType>('feedback')
    const [message, setMessage] = useState('')
    const [isAnonymous, setIsAnonymous] = useState(false)
    const [screenshot, setScreenshot] = useState<File | null>(null)
    const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [isSubmitted, setIsSubmitted] = useState(false)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toast({
                    title: 'File too large',
                    description: 'Screenshots must be smaller than 5MB.',
                    variant: 'destructive'
                })
                return
            }
            setScreenshot(file)
            const reader = new FileReader()
            reader.onloadend = () => {
                setScreenshotPreview(reader.result as string)
            }
            reader.readAsDataURL(file)
        }
    }

    const removeScreenshot = () => {
        setScreenshot(null)
        setScreenshotPreview(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!message.trim()) {
            toast({
                title: 'Please enter a message',
                description: 'Tell us a bit more about the issue or feedback.',
                variant: 'destructive'
            })
            return
        }

        setSubmitting(true)
        try {
            await submitFeedback(type, message, screenshot, user, isAnonymous)
            setIsSubmitted(true)
            toast({
                title: 'Feedback Submitted',
                description: 'Thank you for helping us improve ProCollab!'
            })
        } catch (error) {
            console.error('Feedback submit error:', error)
            toast({
                title: 'Submission Failed',
                description: 'Something went wrong. Please check your connection and try again.',
                variant: 'destructive'
            })
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <DashboardLayout>
            <div className="max-w-3xl mx-auto py-4 sm:py-8 px-2">
                <div className="mb-6 sm:mb-8 text-center sm:text-left">
                    <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                        Help Us Improve ProCollab
                    </h1>
                    <p className="text-sm sm:text-base text-white/60">
                        Encountered a bug? Or have a feature idea? Share it with the development team.
                    </p>
                </div>

                {!isSubmitted ? (
                    <Card className="glass-card overflow-hidden border-white/10">
                        <CardContent className="p-4 sm:p-8">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                {/* Type Selector */}
                                <div className="space-y-3">
                                    <label className="text-xs sm:text-sm font-semibold text-white/80">
                                        What kind of feedback do you have?
                                    </label>
                                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setType('feedback')}
                                            className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border transition-all duration-300 ${
                                                type === 'feedback'
                                                    ? 'bg-primary/10 border-primary text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                                                    : 'bg-white/5 border-white/5 text-white/60 hover:border-white/15 hover:text-white'
                                            }`}
                                        >
                                            <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 mb-2" />
                                            <span className="text-[10px] sm:text-xs font-medium">General Feedback</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setType('bug')}
                                            className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border transition-all duration-300 ${
                                                type === 'bug'
                                                    ? 'bg-destructive/10 border-destructive text-destructive-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                                                    : 'bg-white/5 border-white/5 text-white/60 hover:border-white/15 hover:text-white'
                                            }`}
                                        >
                                            <Bug className="h-5 w-5 sm:h-6 sm:w-6 mb-2" />
                                            <span className="text-[10px] sm:text-xs font-medium">Report a Bug</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setType('feature_request')}
                                            className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border transition-all duration-300 ${
                                                type === 'feature_request'
                                                    ? 'bg-violet-500/10 border-violet-500 text-violet-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                                                    : 'bg-white/5 border-white/5 text-white/60 hover:border-white/15 hover:text-white'
                                            }`}
                                        >
                                            <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 mb-2" />
                                            <span className="text-[10px] sm:text-xs font-medium">Feature Idea</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Message */}
                                <div className="space-y-2">
                                    <label className="text-xs sm:text-sm font-semibold text-white/80">
                                        Describe the issue or idea
                                    </label>
                                    <Textarea
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        placeholder={
                                            type === 'bug'
                                                ? 'What happened? How can we reproduce the bug? Please include steps...'
                                                : type === 'feature_request'
                                                ? 'Tell us what feature you want and how it will help the platform...'
                                                : 'Let us know your thoughts, suggestions, or comments...'
                                        }
                                        className="min-h-[140px] bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-primary/40 focus:ring-primary/20 rounded-xl"
                                        maxLength={2000}
                                    />
                                </div>

                                {/* Screenshot Upload */}
                                <div className="space-y-2">
                                    <label className="text-xs sm:text-sm font-semibold text-white/80">
                                        Attach Screenshot (Optional)
                                    </label>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        accept="image/*"
                                        className="hidden"
                                    />
                                    
                                    {!screenshotPreview ? (
                                        <div 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="border border-dashed border-white/20 hover:border-white/40 bg-white/5 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group"
                                        >
                                            <UploadCloud className="h-8 w-8 text-white/40 group-hover:text-white mb-2 transition-colors" />
                                            <span className="text-xs font-medium text-white/80">Click to upload screenshot</span>
                                            <span className="text-[10px] text-white/40 mt-1">PNG, JPG or WEBP up to 5MB</span>
                                        </div>
                                    ) : (
                                        <div className="relative rounded-xl overflow-hidden border border-white/15 bg-white/5 p-2 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="h-12 w-12 rounded-lg bg-cover bg-center border border-white/10" style={{ backgroundImage: `url(${screenshotPreview})` }}></div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-medium text-white truncate max-w-[200px] sm:max-w-xs">{screenshot?.name}</p>
                                                    <p className="text-[10px] text-white/40">{(screenshot!.size / 1024 / 1024).toFixed(2)} MB</p>
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={removeScreenshot}
                                                className="h-8 w-8 p-0 text-white/60 hover:text-white hover:bg-white/10 rounded-lg"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {/* Submit Identity Selector */}
                                <div className="space-y-3">
                                    <label className="text-xs sm:text-sm font-semibold text-white/80">
                                        Submit as
                                    </label>
                                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsAnonymous(false)}
                                            className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all duration-300 ${
                                                !isAnonymous
                                                    ? 'bg-primary/10 border-primary text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                                                    : 'bg-white/5 border-white/5 text-white/60 hover:border-white/15 hover:text-white'
                                            }`}
                                        >
                                            <div className={`p-1.5 rounded-lg shrink-0 ${!isAnonymous ? 'bg-primary/20 text-primary' : 'bg-white/5'}`}>
                                                <User className="h-4 w-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-semibold text-white">Myself</p>
                                                <p className="text-[9px] text-white/40 truncate">{user?.displayName || user?.email?.split('@')[0]}</p>
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsAnonymous(true)}
                                            className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all duration-300 ${
                                                isAnonymous
                                                    ? 'bg-primary/10 border-primary text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                                                    : 'bg-white/5 border-white/5 text-white/60 hover:border-white/15 hover:text-white'
                                            }`}
                                        >
                                            <div className={`p-1.5 rounded-lg shrink-0 ${isAnonymous ? 'bg-primary/20 text-primary' : 'bg-white/5'}`}>
                                                <Lock className="h-4 w-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-semibold text-white">Anonymously</p>
                                                <p className="text-[9px] text-white/40">Hide name &amp; email</p>
                                            </div>
                                        </button>
                                    </div>
                                </div>

                                {/* Submit Button */}
                                <Button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl text-sm"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Submitting report...
                                        </>
                                    ) : (
                                        <>
                                            Submit Report
                                            <ArrowRight className="h-4 w-4 ml-2" />
                                        </>
                                    )}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                ) : (
                    /* Thank You Message Card */
                    <Card className="glass-card border-white/10 text-center py-10 px-4 sm:p-12 animate-fade-up">
                        <CardContent className="flex flex-col items-center max-w-md mx-auto space-y-5">
                            <div className="h-16 w-16 bg-emerald-500/10 rounded-full border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-2">
                                <CheckCircle2 className="h-8 w-8" />
                            </div>
                            <h2 className="text-xl sm:text-2xl font-bold text-white">
                                Thank You for Your Feedback!
                            </h2>
                            <p className="text-xs sm:text-sm text-white/60 leading-relaxed">
                                We've received your submission. Your contribution plays an essential role in making ProCollab a better, smoother home for student innovators. 
                            </p>
                            <div className="w-full pt-4 space-y-2">
                                <Button 
                                    className="w-full h-10 bg-white/10 hover:bg-white/15 text-white font-medium rounded-xl text-sm"
                                    onClick={() => navigate('/dashboard')}
                                >
                                    Return to Overview
                                </Button>
                                <Button 
                                    variant="ghost"
                                    className="w-full text-xs text-white/50 hover:text-white"
                                    onClick={() => {
                                        setIsSubmitted(false)
                                        setMessage('')
                                        removeScreenshot()
                                    }}
                                >
                                    Submit Another Report
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </DashboardLayout>
    )
}

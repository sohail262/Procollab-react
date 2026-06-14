// src/components/dashboard/ProjectOnboardingModal.tsx
/**
 * ProjectOnboardingModal
 *
 * Shown once, on first visit, to the project owner only.
 * The owner picks between using a project template or managing manually.
 * This choice is permanent — stored as `onboardingDecision` on the project doc.
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutTemplate, PenLine, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type OnboardingDecision = 'template' | 'manual'

interface ProjectOnboardingModalProps {
    projectName: string
    onDecide: (decision: OnboardingDecision) => void
}

interface OptionCardProps {
    selected:    boolean
    onClick:     () => void
    icon:        React.ReactNode
    title:       string
    subtitle:    string
    bullets:     string[]
    badge?:      string
}

function OptionCard({
    selected, onClick, icon, title, subtitle, bullets, badge,
}: OptionCardProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'relative flex flex-col gap-4 rounded-2xl border-2 p-6 text-left transition-all duration-200 w-full',
                'hover:border-foreground/30 hover:shadow-lg',
                selected
                    ? 'border-foreground bg-foreground/[0.04] shadow-lg ring-1 ring-foreground/10'
                    : 'border-border bg-background',
            )}
        >
            {/* Selected checkmark */}
            <AnimatePresence>
                {selected && (
                    <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="absolute top-4 right-4"
                    >
                        <CheckCircle2 className="h-5 w-5 text-foreground" />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Badge */}
            {badge && (
                <span className="inline-flex w-fit items-center rounded-full bg-foreground/10 px-2.5 py-0.5 text-xs font-medium tracking-wide text-foreground/70">
                    {badge}
                </span>
            )}

            {/* Icon */}
            <div className={cn(
                'flex h-12 w-12 items-center justify-center rounded-xl border transition-colors duration-200',
                selected ? 'border-foreground/20 bg-foreground/10' : 'border-border bg-muted/60',
            )}>
                {icon}
            </div>

            {/* Title & subtitle */}
            <div>
                <h3 className="text-base font-semibold tracking-tight text-foreground">
                    {title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                    {subtitle}
                </p>
            </div>

            {/* Bullets */}
            <ul className="space-y-1.5">
                {bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                        {b}
                    </li>
                ))}
            </ul>
        </button>
    )
}

// ─── Main Component ─────────────────────────────────────────────────────────────
export function ProjectOnboardingModal({
    projectName,
    onDecide,
}: ProjectOnboardingModalProps) {
    const [choice, setChoice] = useState<OnboardingDecision | null>(null)
    const [confirming, setConfirming] = useState(false)

    const handleConfirm = async () => {
        if (!choice) return
        setConfirming(true)
        // Small artificial delay for perceived responsiveness
        await new Promise(r => setTimeout(r, 300))
        onDecide(choice)
    }

    return (
        // Full-screen overlay
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="relative w-full max-w-2xl mx-4"
            >
                {/* Card */}
                <div className="overflow-hidden rounded-2xl border bg-card shadow-2xl">

                    {/* Top accent line */}
                    <div className="h-1 w-full bg-gradient-to-r from-foreground/20 via-foreground/60 to-foreground/20" />

                    <div className="px-8 py-8">

                        {/* Header */}
                        <div className="mb-7">
                            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                                Project Setup
                            </p>
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                How would you like to set up{' '}
                                <span className="text-foreground/70">"{projectName}"</span>?
                            </h1>
                            <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-lg">
                                Choose your preferred approach. This decision is permanent and applies
                                only to this project — it cannot be changed after confirmation.
                            </p>
                        </div>

                        {/* Option cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-7">
                            <OptionCard
                                selected={choice === 'template'}
                                onClick={() => setChoice('template')}
                                icon={<LayoutTemplate className="h-6 w-6 text-foreground/70" />}
                                badge="Recommended"
                                title="Use a Project Template"
                                subtitle="Start with a curated structure that includes pre-built tasks, milestones, and documents."
                                bullets={[
                                    'Pre-defined tasks and milestones',
                                    'Document templates included',
                                    'Customisable before applying',
                                ]}
                            />
                            <OptionCard
                                selected={choice === 'manual'}
                                onClick={() => setChoice('manual')}
                                icon={<PenLine className="h-6 w-6 text-foreground/70" />}
                                title="Manage on My Own"
                                subtitle="Start with a blank slate and build the project structure yourself from scratch."
                                bullets={[
                                    'Full control from day one',
                                    'Add tasks and docs manually',
                                    'No predefined structure',
                                ]}
                            />
                        </div>

                        {/* Warning note */}
                        <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/10 px-4 py-3">
                            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                                <strong>This choice is final.</strong> Once confirmed, the project setup
                                mode cannot be changed. Templates cannot be applied later if you choose
                                manual, and vice versa.
                            </p>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">
                                {choice
                                    ? choice === 'template'
                                        ? 'You selected: Use a Project Template'
                                        : 'You selected: Manage on My Own'
                                    : 'Select an option to continue'}
                            </p>
                            <Button
                                onClick={handleConfirm}
                                disabled={!choice || confirming}
                                className="gap-2 min-w-[140px]"
                            >
                                {confirming ? (
                                    'Confirming...'
                                ) : (
                                    <>
                                        Confirm Choice
                                        <ArrowRight className="h-4 w-4" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}

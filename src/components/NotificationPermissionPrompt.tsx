import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Bell,
    X,
    Users,
    Zap,
    MessageSquare,
    ShieldCheck,
    BellRing,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface NotificationPermissionPromptProps {
    onAccept: () => Promise<void>
    onDismiss: () => void
}

export function NotificationPermissionPrompt({
    onAccept,
    onDismiss,
}: NotificationPermissionPromptProps) {
    const [loading, setLoading] = useState(false)
    const [accepted, setAccepted] = useState(false)

    const handleAccept = async () => {
        setLoading(true)
        try {
            await onAccept()
            setAccepted(true)
            setTimeout(() => onDismiss(), 2000)
        } catch {
            setLoading(false)
        }
    }

    return (
        <AnimatePresence mode="wait">
            {accepted ? (
                <motion.div
                    key="success"
                    initial={{ opacity: 0, y: 16, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 16, scale: 0.96 }}
                    transition={{ duration: 0.25 }}
                    className="fixed bottom-6 right-6 z-50 w-80"
                >
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                                <ShieldCheck className="h-4 w-4 text-green-500" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                    Notifications enabled
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    You won't miss anything important.
                                </p>
                            </div>
                        </div>
                    </div>
                </motion.div>
            ) : (
                <motion.div
                    key="prompt"
                    initial={{ opacity: 0, y: 40, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 40, scale: 0.95 }}
                    transition={{
                        type: 'spring',
                        damping: 22,
                        stiffness: 280,
                    }}
                    className="fixed bottom-6 right-6 z-50 w-[22rem] max-w-[calc(100vw-3rem)]"
                >
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">

                        {/* Top accent bar */}
                        <div className="h-[3px] w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

                        <div className="p-5">

                            {/* Header row */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    {/* Animated bell icon */}
                                    <div className="relative flex-shrink-0">
                                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/20">
                                            <motion.div
                                                animate={{
                                                    rotate: [
                                                        0, -18, 18, -12,
                                                        12, -6, 6, 0,
                                                    ],
                                                }}
                                                transition={{
                                                    duration: 1.4,
                                                    delay: 0.8,
                                                    repeat: Infinity,
                                                    repeatDelay: 5,
                                                }}
                                            >
                                                <Bell className="h-5 w-5 text-white" />
                                            </motion.div>
                                        </div>
                                        {/* Live indicator dot */}
                                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-60" />
                                            <span className="relative inline-flex h-3 w-3 rounded-full bg-blue-500" />
                                        </span>
                                    </div>

                                    <div>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                                            Stay connected
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                            Enable push notifications
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={onDismiss}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex-shrink-0"
                                    aria-label="Dismiss"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>

                            {/* Description */}
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">
                                Get real-time alerts so you're always first to know when
                                something needs your attention.
                            </p>

                            {/* Feature list */}
                            <div className="space-y-2 mb-4">
                                {[
                                    {
                                        Icon: Users,
                                        color: 'text-blue-500',
                                        bg: 'bg-blue-50 dark:bg-blue-500/10',
                                        label: 'Connection requests & acceptances',
                                    },
                                    {
                                        Icon: Zap,
                                        color: 'text-indigo-500',
                                        bg: 'bg-indigo-50 dark:bg-indigo-500/10',
                                        label: 'Project application updates',
                                    },
                                    {
                                        Icon: MessageSquare,
                                        color: 'text-violet-500',
                                        bg: 'bg-violet-50 dark:bg-violet-500/10',
                                        label: 'Team messages & project activity',
                                    },
                                ].map(({ Icon, color, bg, label }, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.15 + i * 0.08 }}
                                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg ${bg}`}
                                    >
                                        <Icon
                                            className={`h-3.5 w-3.5 ${color} flex-shrink-0`}
                                        />
                                        <span className="text-xs text-gray-700 dark:text-gray-300">
                                            {label}
                                        </span>
                                    </motion.div>
                                ))}
                            </div>

                            {/* Privacy note */}
                            <div className="flex items-center gap-1.5 mb-4">
                                <ShieldCheck className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                    Disable anytime in your browser settings
                                </p>
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onDismiss}
                                    className="flex-1 text-xs text-gray-500 border-gray-200 dark:border-gray-700 h-8"
                                >
                                    Maybe later
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleAccept}
                                    disabled={loading}
                                    className="flex-[1.6] text-xs h-8 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white border-0 shadow-md shadow-blue-500/20 gap-1.5"
                                >
                                    {loading ? (
                                        <>
                                            <motion.div
                                                animate={{ rotate: 360 }}
                                                transition={{
                                                    duration: 0.8,
                                                    repeat: Infinity,
                                                    ease: 'linear',
                                                }}
                                                className="w-3 h-3 border-[1.5px] border-white border-t-transparent rounded-full"
                                            />
                                            Enabling...
                                        </>
                                    ) : (
                                        <>
                                            <BellRing className="h-3.5 w-3.5" />
                                            Enable Notifications
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
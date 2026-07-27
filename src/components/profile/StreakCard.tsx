import React, { useState, useEffect } from 'react'
import { StreakMetrics } from '@/services/activityService'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Flame, Trophy, Share2, ShieldCheck, Zap, Award, Target, TrendingUp, Info } from 'lucide-react'
import { StreakFireOverlay } from './StreakFireOverlay'

interface StreakCardProps {
    metrics: StreakMetrics
    userName?: string
    isOwnProfile?: boolean
    onOpenLeaderboard: () => void
    onOpenShareModal: () => void
}

export const StreakCard: React.FC<StreakCardProps> = ({
    metrics,
    userName = 'Student',
    isOwnProfile = true,
    onOpenLeaderboard,
    onOpenShareModal,
}) => {
    const {
        currentStreak,
        longestStreak,
        totalContributions,
        consistencyRate,
        tier,
        tierIcon,
        tierColor,
        streakShieldActive,
    } = metrics

    const [showFireOverlay, setShowFireOverlay] = useState(false)

    // Trigger full-screen fire overlay on first daily visit to own profile
    useEffect(() => {
        if (!isOwnProfile || currentStreak === 0) return

        const todayKey = `streak_anim_${new Date().toISOString().split('T')[0]}`
        const alreadyShown = localStorage.getItem(todayKey)

        if (!alreadyShown) {
            // Small delay so the profile page has time to render first
            const t = setTimeout(() => {
                setShowFireOverlay(true)
                localStorage.setItem(todayKey, 'true')
            }, 600)
            return () => clearTimeout(t)
        }
    }, [isOwnProfile, currentStreak])

    return (
        <TooltipProvider delayDuration={150}>
            {showFireOverlay && (
                <StreakFireOverlay
                    streakCount={currentStreak}
                    onDone={() => setShowFireOverlay(false)}
                />
            )}
            <div className="bg-gradient-to-br from-zinc-900 via-zinc-950 to-black border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden text-white group">
                {/* Background subtle flame glow effect */}
                <div className="absolute -top-12 -right-12 w-48 h-48 bg-orange-600/15 dark:bg-orange-500/20 rounded-full blur-3xl pointer-events-none group-hover:bg-orange-500/30 transition-all duration-500" />
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

                {/* Top row: Title + Info + Badges */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-5 relative z-10">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => isOwnProfile && currentStreak > 0 && setShowFireOverlay(true)}
                            aria-label={isOwnProfile && currentStreak > 0 ? 'Replay streak animation' : 'Streak fire icon'}
                            className={`p-2 rounded-xl bg-orange-500/20 border border-orange-500/30 text-orange-400 transition-all duration-200 ${isOwnProfile && currentStreak > 0 ? 'hover:bg-orange-500/30 hover:border-orange-400/60 hover:scale-110 cursor-pointer' : 'cursor-default'}`}
                        >
                            <Flame className="h-5 w-5 animate-pulse" aria-hidden="true" />
                        </button>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <h2 className="text-sm font-bold tracking-tight text-white">
                                    Consistency & Streaks
                                </h2>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button className="text-zinc-400 hover:text-amber-400 transition-colors p-0.5" aria-label="How streaks and contributions work">
                                            <Info className="h-3.5 w-3.5" aria-hidden="true" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="bg-zinc-950 text-zinc-100 border-zinc-800 p-3 max-w-xs text-xs shadow-xl space-y-1.5">
                                        <p className="font-bold text-amber-400 border-b border-zinc-800 pb-1">
                                            How Streaks & Contributions Work
                                        </p>
                                        <p className="text-[11px] text-zinc-300">
                                             • <strong className="text-white">Contributions</strong> are earned by creating projects (+2), submitting applications (+1), completing tasks (+1), or giving peer reviews (+1).
                                         </p>
                                         <p className="text-[11px] text-zinc-300">
                                             • <strong className="text-white">Streak</strong> increases every consecutive day you log in or build on Procollab. Simply log in daily to maintain!
                                         </p>
                                     </TooltipContent>
                                 </Tooltip>
                            </div>
                            <p className="text-[11px] text-zinc-300">
                                "He's the one who showed up."
                            </p>
                        </div>
                    </div>

                    {/* Tier pill */}
                    <div className="flex items-center gap-2">
                        {streakShieldActive && (
                            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30" title="Streak Shield protects your streak if you miss 1 day">
                                <ShieldCheck className="h-3 w-3" />
                                Shield Active
                            </span>
                        )}
                        <span className={`flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-zinc-800/90 border border-zinc-700 ${tierColor} shadow-sm`}>
                            <span>{tierIcon}</span>
                            <span>{tier}</span>
                        </span>
                    </div>
                </div>

                {/* Main Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 relative z-10">
                    {/* Current Streak */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="bg-zinc-900/80 border border-orange-500/30 rounded-xl p-3.5 flex flex-col justify-between hover:border-orange-500/60 transition-all shadow-inner cursor-pointer">
                                <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
                                    <span className="flex items-center gap-1">
                                        Current Streak
                                        <Info className="h-3 w-3 text-zinc-500" />
                                    </span>
                                    <Flame className="h-3.5 w-3.5 text-orange-400" />
                                </div>
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-red-500">
                                        {currentStreak}
                                    </span>
                                    <span className="text-xs font-medium text-zinc-400">days</span>
                                </div>
                                <p className="text-[10px] text-orange-400/90 mt-1 font-mono">
                                    {currentStreak > 0 ? '🔥 On fire right now!' : 'Log in daily to maintain!'}
                                </p>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-zinc-950 text-zinc-200 border-zinc-800 text-xs p-2.5 max-w-xs">
                            <p className="font-semibold text-orange-400 mb-1">Current Active Streak</p>
                            <p className="text-[11px] text-zinc-300">
                                Consecutive calendar days logged in or active on Procollab. Simply log in daily to maintain your streak!
                            </p>
                        </TooltipContent>
                    </Tooltip>

                    {/* Longest Streak */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3.5 flex flex-col justify-between hover:border-zinc-700 transition-all cursor-pointer">
                                <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
                                    <span className="flex items-center gap-1">
                                        Best Streak
                                        <Info className="h-3 w-3 text-zinc-500" />
                                    </span>
                                    <Zap className="h-3.5 w-3.5 text-amber-400" />
                                </div>
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-2xl sm:text-3xl font-extrabold text-amber-300">
                                        {longestStreak}
                                    </span>
                                    <span className="text-xs font-medium text-zinc-400">days</span>
                                </div>
                                <p className="text-[10px] text-zinc-400 mt-1">All-time record</p>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-zinc-950 text-zinc-200 border-zinc-800 text-xs p-2.5 max-w-xs">
                            <p className="font-semibold text-amber-400 mb-1">All-Time Best Streak</p>
                            <p className="text-[11px] text-zinc-300">
                                Your highest recorded unbroken streak of active daily contributions on Procollab.
                            </p>
                        </TooltipContent>
                    </Tooltip>

                    {/* Consistency Score */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3.5 flex flex-col justify-between hover:border-zinc-700 transition-all cursor-pointer">
                                <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
                                    <span className="flex items-center gap-1">
                                        Consistency
                                        <Info className="h-3 w-3 text-zinc-500" />
                                    </span>
                                    <Target className="h-3.5 w-3.5 text-teal-400" />
                                </div>
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-2xl sm:text-3xl font-extrabold text-teal-300">
                                        {consistencyRate}%
                                    </span>
                                </div>
                                <p className="text-[10px] text-zinc-400 mt-1">Active days ratio</p>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-zinc-950 text-zinc-200 border-zinc-800 text-xs p-2.5 max-w-xs">
                            <p className="font-semibold text-teal-400 mb-1">Consistency Rate</p>
                            <p className="text-[11px] text-zinc-300">
                                Percentage of days over the past year where you logged at least 1 real action. Calculated as: (Active Days / 365 Days) × 100%.
                            </p>
                        </TooltipContent>
                    </Tooltip>

                    {/* Total Contributions */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3.5 flex flex-col justify-between hover:border-zinc-700 transition-all cursor-pointer">
                                <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
                                    <span className="flex items-center gap-1">
                                        Total Contributions
                                        <Info className="h-3 w-3 text-zinc-500" />
                                    </span>
                                    <TrendingUp className="h-3.5 w-3.5 text-indigo-400" />
                                </div>
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-2xl sm:text-3xl font-extrabold text-indigo-300">
                                        {totalContributions}
                                    </span>
                                </div>
                                <p className="text-[10px] text-zinc-400 mt-1">Actions in 1 yr</p>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-zinc-950 text-zinc-200 border-zinc-800 text-xs p-2.5 max-w-xs">
                            <p className="font-semibold text-indigo-400 mb-1">Total Platform Actions</p>
                            <p className="text-[11px] text-zinc-300">
                                Sum of all actual actions in 1 year: project creations (+2), task updates (+1), applications submitted (+1), and peer reviews (+1).
                            </p>
                        </TooltipContent>
                    </Tooltip>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-800/80 relative z-10">
                    <Button
                        onClick={onOpenLeaderboard}
                        variant="outline"
                        size="sm"
                        className="bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-200 hover:text-white text-xs font-semibold h-9 rounded-xl transition-all"
                    >
                        <Trophy className="h-3.5 w-3.5 mr-1.5 text-amber-400" />
                        Global Leaderboard
                    </Button>

                    {isOwnProfile && (
                        <Button
                            onClick={onOpenShareModal}
                            size="sm"
                            className="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-zinc-950 font-bold text-xs h-9 rounded-xl shadow-lg shadow-orange-500/20 transition-all hover:scale-105"
                        >
                            <Share2 className="h-3.5 w-3.5 mr-1.5" />
                            Flex Your Grind 💪
                        </Button>
                    )}

                </div>
            </div>
        </TooltipProvider>
    )
}

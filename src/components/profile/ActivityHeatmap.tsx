import React, { useState, useMemo } from 'react'
import { ActivityDay } from '@/services/activityService'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Flame, Sparkles, Calendar as CalendarIcon, Info, Palette } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type HeatmapTheme = 'emerald' | 'flame' | 'violet' | 'gold' | 'github'

interface ActivityHeatmapProps {
    activityData: Record<string, ActivityDay>
    userName?: string
    isOwnProfile?: boolean
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({
    activityData,
    userName = 'Student',
}) => {
    const [theme, setTheme] = useState<HeatmapTheme>('emerald')
    const [periodMonths, setPeriodMonths] = useState<number>(12) // 12, 6, or 3 months

    // Color theme classes mapping
    const themeStyles: Record<HeatmapTheme, { label: string; iconColor: string; activeBorder: string; levels: Record<number, string> }> = {
        emerald: {
            label: 'Emerald Electric',
            iconColor: 'text-emerald-500',
            activeBorder: 'border-emerald-500/50',
            levels: {
                0: 'bg-zinc-100 dark:bg-zinc-800/40 border-transparent',
                1: 'bg-emerald-900/30 text-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-800/30',
                2: 'bg-emerald-600/40 dark:bg-emerald-800/80 border-emerald-600/40',
                3: 'bg-emerald-500 dark:bg-emerald-600 border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]',
                4: 'bg-emerald-400 dark:bg-emerald-400 border-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.6)] animate-pulse',
            }
        },
        flame: {
            label: 'Neon Flame',
            iconColor: 'text-orange-500',
            activeBorder: 'border-orange-500/50',
            levels: {
                0: 'bg-zinc-100 dark:bg-zinc-800/40 border-transparent',
                1: 'bg-amber-950/40 text-amber-300 dark:bg-amber-950/70 border-amber-900/30',
                2: 'bg-orange-600/40 dark:bg-orange-800/80 border-orange-600/40',
                3: 'bg-orange-500 dark:bg-orange-600 border-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.4)]',
                4: 'bg-red-500 dark:bg-red-500 border-red-300 shadow-[0_0_12px_rgba(239,68,68,0.7)] animate-pulse',
            }
        },
        violet: {
            label: 'Cyber Violet',
            iconColor: 'text-violet-500',
            activeBorder: 'border-violet-500/50',
            levels: {
                0: 'bg-zinc-100 dark:bg-zinc-800/40 border-transparent',
                1: 'bg-violet-950/40 dark:bg-violet-950/70 border-violet-900/30',
                2: 'bg-violet-700/40 dark:bg-violet-800/80 border-violet-600/40',
                3: 'bg-violet-500 dark:bg-violet-600 border-violet-400 shadow-[0_0_8px_rgba(139,92,246,0.4)]',
                4: 'bg-fuchsia-400 dark:bg-fuchsia-400 border-fuchsia-300 shadow-[0_0_12px_rgba(232,121,249,0.7)] animate-pulse',
            }
        },
        gold: {
            label: 'Gold Grind',
            iconColor: 'text-amber-400',
            activeBorder: 'border-amber-400/50',
            levels: {
                0: 'bg-zinc-100 dark:bg-zinc-800/40 border-transparent',
                1: 'bg-amber-950/40 dark:bg-amber-950/70 border-amber-900/30',
                2: 'bg-amber-600/40 dark:bg-amber-700/80 border-amber-500/40',
                3: 'bg-amber-400 dark:bg-amber-500 border-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.4)]',
                4: 'bg-yellow-300 dark:bg-yellow-300 border-yellow-100 shadow-[0_0_12px_rgba(253,224,71,0.8)] animate-pulse',
            }
        },
        github: {
            label: 'GitHub Classic',
            iconColor: 'text-green-600',
            activeBorder: 'border-green-600/50',
            levels: {
                0: 'bg-zinc-100 dark:bg-zinc-800/40 border-transparent',
                1: 'bg-emerald-900/20 dark:bg-emerald-950/50 border-emerald-900/20',
                2: 'bg-emerald-700/40 dark:bg-emerald-800/70 border-emerald-600/30',
                3: 'bg-emerald-500 dark:bg-emerald-600 border-emerald-400',
                4: 'bg-emerald-400 dark:bg-emerald-400 border-emerald-300 shadow-sm',
            }
        }
    }

    // Process dates into grid columns (weeks)
    const { weeks, monthLabels, totalContributionsInPeriod } = useMemo(() => {
        const today = new Date()
        const daysToInclude = periodMonths * 30
        
        const startDate = new Date(today)
        startDate.setDate(startDate.getDate() - daysToInclude + 1)
        
        // Align start date to Sunday for tidy 7-day grid alignment
        const dayOfWeek = startDate.getDay()
        startDate.setDate(startDate.getDate() - dayOfWeek)

        const weeksList: { dateStr: string; dayObj: ActivityDay; isCurrentYear: boolean }[][] = []
        const monthsList: { name: string; index: number }[] = []

        let currentWeek: { dateStr: string; dayObj: ActivityDay; isCurrentYear: boolean }[] = []
        let lastMonth = -1
        let weekIndex = 0
        let totalCount = 0

        const cur = new Date(startDate)
        while (cur <= today) {
            const yyyy = cur.getFullYear()
            const mm = String(cur.getMonth() + 1).padStart(2, '0')
            const dd = String(cur.getDate()).padStart(2, '0')
            const key = `${yyyy}-${mm}-${dd}`

            const currentMonth = cur.getMonth()
            if (currentMonth !== lastMonth) {
                monthsList.push({
                    name: MONTH_NAMES[currentMonth],
                    index: weekIndex,
                })
                lastMonth = currentMonth
            }

            const dayData = activityData[key] || {
                date: key,
                count: 0,
                level: 0,
                breakdown: { commits: 0, tasks: 0, applications: 0, reviews: 0 }
            }

            totalCount += dayData.count

            currentWeek.push({
                dateStr: key,
                dayObj: dayData,
                isCurrentYear: true
            })

            if (currentWeek.length === 7) {
                weeksList.push(currentWeek)
                currentWeek = []
                weekIndex++
            }

            cur.setDate(cur.getDate() + 1)
        }

        if (currentWeek.length > 0) {
            weeksList.push(currentWeek)
        }

        return {
            weeks: weeksList,
            monthLabels: monthsList,
            totalContributionsInPeriod: totalCount
        }
    }, [activityData, periodMonths])

    const currentThemeStyle = themeStyles[theme]

    return (
        <TooltipProvider delayDuration={150}>
            <div className="bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-sm relative overflow-hidden transition-all duration-300" role="region" aria-label="Activity Calendar">
                {/* Top header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                <Sparkles className={`h-4 w-4 ${currentThemeStyle.iconColor}`} aria-hidden="true" />
                                Activity Calendar
                            </h2>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium">
                                {totalContributionsInPeriod} contributions
                            </span>
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            {userName}'s work consistency & contribution heatmap
                        </p>
                    </div>

                    {/* Filter Controls */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Period Selector */}
                        <div className="flex items-center bg-zinc-100 dark:bg-zinc-800/80 p-0.5 rounded-lg text-xs font-medium" role="group" aria-label="Select time period">
                            <button
                                onClick={() => setPeriodMonths(12)}
                                aria-pressed={periodMonths === 12}
                                aria-label="Show 1 year"
                                className={`px-2.5 py-1.5 rounded-md transition-all ${
                                    periodMonths === 12
                                        ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white shadow-xs font-semibold'
                                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                                }`}
                            >
                                1 Year
                            </button>
                            <button
                                onClick={() => setPeriodMonths(6)}
                                aria-pressed={periodMonths === 6}
                                aria-label="Show 6 months"
                                className={`px-2.5 py-1.5 rounded-md transition-all ${
                                    periodMonths === 6
                                        ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white shadow-xs font-semibold'
                                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                                }`}
                            >
                                6 Months
                            </button>
                            <button
                                onClick={() => setPeriodMonths(3)}
                                aria-pressed={periodMonths === 3}
                                aria-label="Show 3 months"
                                className={`px-2.5 py-1.5 rounded-md transition-all ${
                                    periodMonths === 3
                                        ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white shadow-xs font-semibold'
                                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                                }`}
                            >
                                3 Months
                            </button>
                        </div>

                        {/* Theme Switcher Pills */}
                        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-lg" role="group" aria-label="Select heatmap theme">
                            {(Object.keys(themeStyles) as HeatmapTheme[]).map((tKey) => (
                                <button
                                    key={tKey}
                                    onClick={() => setTheme(tKey)}
                                    aria-label={`${themeStyles[tKey].label} theme`}
                                    aria-pressed={theme === tKey}
                                    className={`w-6 h-6 rounded-full transition-transform ${
                                        tKey === 'emerald' ? 'bg-emerald-500' :
                                        tKey === 'flame' ? 'bg-orange-500' :
                                        tKey === 'violet' ? 'bg-violet-500' :
                                        tKey === 'gold' ? 'bg-amber-400' : 'bg-emerald-700'
                                    } ${theme === tKey ? 'scale-125 ring-2 ring-zinc-900 dark:ring-white z-10' : 'opacity-70 hover:opacity-100'}`}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Heatmap Grid Container */}
                <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700">
                    <div className="min-w-[680px]">
                        {/* Month Header */}
                        <div className="flex text-[10px] text-zinc-400 dark:text-zinc-500 mb-2 pl-7 relative h-4">
                            {monthLabels.map((m, idx) => (
                                <span
                                    key={idx}
                                    className="absolute font-medium"
                                    style={{ left: `${m.index * 13 + 28}px` }}
                                >
                                    {m.name}
                                </span>
                            ))}
                        </div>

                        {/* Main Grid: Days of week on left + columns of weeks */}
                        <div className="flex gap-1">
                            {/* Day Labels (Mon, Wed, Fri) */}
                            <div className="flex flex-col gap-[3px] text-[9px] text-zinc-400 dark:text-zinc-500 select-none pr-1 justify-between py-[1px] w-6">
                                {DAY_LABELS.map((lbl, idx) => (
                                    <span key={idx} className="h-[11px] leading-[11px] font-mono text-right">
                                        {lbl}
                                    </span>
                                ))}
                            </div>

                            {/* Weeks Grid */}
                            <div className="flex gap-[3px] flex-1">
                                {weeks.map((week, wIdx) => (
                                    <div key={wIdx} className="flex flex-col gap-[3px]">
                                        {week.map((dayItem, dIdx) => {
                                            const { dayObj, dateStr } = dayItem
                                            const levelClass = currentThemeStyle.levels[dayObj.level]
                                            const formattedDate = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
                                                weekday: 'short',
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                            })

                                            return (
                                                <Tooltip key={dIdx}>
                                                    <TooltipTrigger asChild>
                                                        <div
                                                            className={`w-[11px] h-[11px] rounded-[2px] transition-all duration-150 cursor-pointer border ${levelClass} hover:scale-125 hover:z-20`}
                                                        />
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="bg-zinc-950 text-white border-zinc-800 p-2.5 text-xs max-w-xs shadow-xl">
                                                        <div className="font-semibold flex items-center justify-between gap-3 border-b border-zinc-800 pb-1.5 mb-1.5">
                                                            <span>{formattedDate}</span>
                                                            <span className={`font-mono text-xs font-bold ${currentThemeStyle.iconColor}`}>
                                                                {dayObj.count} actions
                                                            </span>
                                                        </div>
                                                        {dayObj.count === 0 ? (
                                                            <p className="text-[11px] text-zinc-400">No activity recorded on this day.</p>
                                                        ) : (
                                                            <div className="space-y-1.5 text-[11px] max-w-[220px]">
                                                                {dayObj.breakdown.items && dayObj.breakdown.items.length > 0 ? (
                                                                    dayObj.breakdown.items.map((itemStr, itemIdx) => (
                                                                        <div key={itemIdx} className="text-zinc-200 leading-snug">
                                                                            {itemStr}
                                                                        </div>
                                                                    ))
                                                                ) : (
                                                                    <>
                                                                        {dayObj.breakdown.commits > 0 && (
                                                                            <div className="flex justify-between text-zinc-300">
                                                                                <span>💻 Projects & Work</span>
                                                                                <span className="font-mono text-zinc-100">{dayObj.breakdown.commits}</span>
                                                                            </div>
                                                                        )}
                                                                        {dayObj.breakdown.tasks > 0 && (
                                                                            <div className="flex justify-between text-zinc-300">
                                                                                <span>✅ Tasks Completed</span>
                                                                                <span className="font-mono text-zinc-100">{dayObj.breakdown.tasks}</span>
                                                                            </div>
                                                                        )}
                                                                        {dayObj.breakdown.applications > 0 && (
                                                                            <div className="flex justify-between text-zinc-300">
                                                                                <span>📬 Applications Sent</span>
                                                                                <span className="font-mono text-zinc-100">{dayObj.breakdown.applications}</span>
                                                                            </div>
                                                                        )}
                                                                        {dayObj.breakdown.reviews > 0 && (
                                                                            <div className="flex justify-between text-zinc-300">
                                                                                <span>⭐ Peer Reviews</span>
                                                                                <span className="font-mono text-zinc-100">{dayObj.breakdown.reviews}</span>
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}
                                                    </TooltipContent>

                                                </Tooltip>
                                            )
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Legend */}
                <div className="flex flex-wrap items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 gap-2">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center gap-1.5 text-[11px] cursor-pointer text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
                                <Info className="h-3.5 w-3.5 text-zinc-400" />
                                <span>Green squares show days showing up & grinding on Procollab.</span>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-zinc-950 text-zinc-200 border-zinc-800 text-xs p-3 max-w-xs">
                            <p className="font-semibold text-emerald-400 mb-1">How Grid Activity Is Calculated</p>
                            <p className="text-[11px] text-zinc-300">
                                Each square represents 1 calendar day. Darker green squares mean more real actions recorded on that date (creating projects, submitting applications, delivering tasks, or writing peer reviews).
                            </p>
                        </TooltipContent>
                    </Tooltip>


                    <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="text-zinc-400">Less</span>
                        {[0, 1, 2, 3, 4].map((lvl) => (
                            <div
                                key={lvl}
                                className={`w-3 h-3 rounded-[2px] border ${currentThemeStyle.levels[lvl]}`}
                            />
                        ))}
                        <span className="text-zinc-400">More</span>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    )
}

import React, { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { LeaderboardUser, fetchGlobalStreakLeaderboard } from '@/services/activityService'
import { Trophy, Flame, Zap, Award, Search, Sparkles, User, ExternalLink, Shield } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useNavigate } from 'react-router-dom'

interface StreakLeaderboardProps {
    isOpen: boolean
    onClose: () => void
    currentUserId?: string
}

export const StreakLeaderboard: React.FC<StreakLeaderboardProps> = ({
    isOpen,
    onClose,
    currentUserId,
}) => {
    const navigate = useNavigate()
    const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [filterTab, setFilterTab] = useState<'all' | 'monthly' | 'discipline'>('all')

    useEffect(() => {
        if (!isOpen) return
        async function loadLeaderboard() {
            setLoading(true)
            try {
                const data = await fetchGlobalStreakLeaderboard(currentUserId)
                setLeaderboard(data)
            } catch (err) {
                console.error('Failed to load streak leaderboard:', err)
            } finally {
                setLoading(false)
            }
        }
        loadLeaderboard()
    }, [isOpen, currentUserId])

    const filteredUsers = leaderboard.filter((u) =>
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.role && u.role.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (u.discipline && u.discipline.toLowerCase().includes(searchQuery.toLowerCase()))
    )

    const topThree = filteredUsers.slice(0, 3)
    const restList = filteredUsers.slice(3)
    const currentUserRank = leaderboard.find((u) => u.isCurrentUser || u.id === currentUserId)

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl bg-zinc-950 border-zinc-800 text-white p-0 overflow-hidden shadow-2xl rounded-2xl max-h-[90vh] flex flex-col">
                {/* Header Banner */}
                <div className="bg-gradient-to-r from-amber-600/30 via-orange-600/20 to-red-600/30 p-6 border-b border-zinc-800 relative">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="p-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400">
                                    <Trophy className="h-5 w-5" />
                                </span>
                                <DialogTitle className="text-xl font-extrabold text-white">
                                    Procollab Streak Leaderboard
                                </DialogTitle>
                            </div>
                            <DialogDescription className="text-xs text-zinc-300">
                                Top consistent student builders ranking by consecutive active days.
                            </DialogDescription>
                        </div>

                        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900/80 border border-zinc-700 text-xs font-semibold text-amber-300">
                            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                            <span>Updated Hourly</span>
                        </div>
                    </div>

                    {/* Filter Tabs & Search */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-5">
                        <div className="flex items-center bg-zinc-900/90 border border-zinc-800 p-1 rounded-xl w-full sm:w-auto">
                            <button
                                onClick={() => setFilterTab('all')}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                                    filterTab === 'all'
                                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-zinc-950 shadow-sm'
                                        : 'text-zinc-400 hover:text-white'
                                }`}
                            >
                                All-Time Grind
                            </button>
                            <button
                                onClick={() => setFilterTab('monthly')}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                                    filterTab === 'monthly'
                                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-zinc-950 shadow-sm'
                                        : 'text-zinc-400 hover:text-white'
                                }`}
                            >
                                This Month
                            </button>
                        </div>

                        <div className="relative w-full sm:w-48">
                            <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-zinc-400" />
                            <Input
                                placeholder="Search builder..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-8 pl-8 text-xs bg-zinc-900/90 border-zinc-800 text-white placeholder:text-zinc-500 focus-visible:ring-amber-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Main Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-thin scrollbar-thumb-zinc-800">
                    {loading ? (
                        <div className="py-12 text-center text-zinc-400 text-xs flex flex-col items-center gap-2">
                            <Flame className="h-6 w-6 text-orange-500 animate-bounce" />
                            Loading streak standings...
                        </div>
                    ) : (
                        <>
                            {/* Top 3 Podium Cards */}
                            {topThree.length >= 3 && (
                                <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end pt-4 pb-2">
                                    {/* 2nd Place */}
                                    <div className="flex flex-col items-center bg-zinc-900/70 border border-slate-700/60 rounded-2xl p-3 sm:p-4 relative hover:border-slate-500 transition-all text-center">
                                        <div className="absolute -top-3 w-6 h-6 rounded-full bg-slate-300 text-zinc-950 font-black text-xs flex items-center justify-center shadow-md">
                                            2
                                        </div>
                                        <img
                                            src={topThree[1].photoURL}
                                            alt={topThree[1].name}
                                            className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover ring-2 ring-slate-400 mb-2 mt-1"
                                        />
                                        <h4 className="text-xs sm:text-sm font-bold text-white truncate max-w-full">
                                            {topThree[1].name}
                                        </h4>
                                        <p className="text-[10px] text-zinc-400 truncate max-w-full">
                                            {topThree[1].role || 'Builder'}
                                        </p>
                                        <div className="mt-2 flex items-center gap-1 text-xs font-black text-orange-400 bg-orange-950/40 px-2 py-0.5 rounded-full border border-orange-800/40">
                                            <Flame className="h-3 w-3 fill-orange-400" />
                                            <span>{topThree[1].score || (topThree[1].currentStreak + topThree[1].totalContributions)} pts</span>
                                        </div>
                                        <p className="text-[9px] text-zinc-400 mt-0.5">{topThree[1].currentStreak}d streak · {topThree[1].totalContributions} actions</p>
                                    </div>

                                    {/* 1st Place (Center Podium) */}
                                    <div className="flex flex-col items-center bg-gradient-to-b from-amber-950/60 via-zinc-900 to-zinc-900 border-2 border-amber-500/80 rounded-2xl p-3 sm:p-5 relative shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:border-amber-400 transition-all text-center transform sm:-translate-y-2">
                                        <div className="absolute -top-4 w-8 h-8 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 text-zinc-950 font-black text-sm flex items-center justify-center shadow-lg">
                                            👑 1
                                        </div>
                                        <img
                                            src={topThree[0].photoURL}
                                            alt={topThree[0].name}
                                            className="w-14 h-14 sm:w-20 sm:h-20 rounded-full object-cover ring-4 ring-amber-400 shadow-md mb-2 mt-1"
                                        />
                                        <h4 className="text-xs sm:text-base font-extrabold text-amber-200 truncate max-w-full">
                                            {topThree[0].name}
                                        </h4>
                                        <p className="text-[10px] sm:text-xs text-amber-400/80 font-medium truncate max-w-full">
                                            {topThree[0].role || 'Lead Engineer'}
                                        </p>
                                        <div className="mt-2 flex items-center gap-1 text-xs sm:text-sm font-black text-amber-300 bg-amber-900/50 px-2.5 py-1 rounded-full border border-amber-500/50 shadow-inner">
                                            <Flame className="h-4 w-4 fill-amber-400 animate-pulse" />
                                            <span>{topThree[0].score || (topThree[0].currentStreak + topThree[0].totalContributions)} pts</span>
                                        </div>
                                        <p className="text-[10px] text-amber-300/70 mt-0.5 font-medium">{topThree[0].currentStreak}d streak · {topThree[0].totalContributions} actions</p>
                                    </div>

                                    {/* 3rd Place */}
                                    <div className="flex flex-col items-center bg-zinc-900/70 border border-amber-900/40 rounded-2xl p-3 sm:p-4 relative hover:border-amber-800 transition-all text-center">
                                        <div className="absolute -top-3 w-6 h-6 rounded-full bg-amber-700 text-white font-black text-xs flex items-center justify-center shadow-md">
                                            3
                                        </div>
                                        <img
                                            src={topThree[2].photoURL}
                                            alt={topThree[2].name}
                                            className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover ring-2 ring-amber-700 mb-2 mt-1"
                                        />
                                        <h4 className="text-xs sm:text-sm font-bold text-white truncate max-w-full">
                                            {topThree[2].name}
                                        </h4>
                                        <p className="text-[10px] text-zinc-400 truncate max-w-full">
                                            {topThree[2].role || 'Builder'}
                                        </p>
                                        <div className="mt-2 flex items-center gap-1 text-xs font-black text-orange-400 bg-orange-950/40 px-2 py-0.5 rounded-full border border-orange-800/40">
                                            <Flame className="h-3 w-3 fill-orange-400" />
                                            <span>{topThree[2].score || (topThree[2].currentStreak + topThree[2].totalContributions)} pts</span>
                                        </div>
                                        <p className="text-[9px] text-zinc-400 mt-0.5">{topThree[2].currentStreak}d streak · {topThree[2].totalContributions} actions</p>
                                    </div>
                                </div>
                            )}

                            {/* Full Rankings List */}
                            <div className="space-y-2">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 px-1 mb-2">
                                    Global Standings
                                </h4>
                                {restList.map((user) => (
                                    <div
                                        key={user.id}
                                        onClick={() => {
                                            onClose()
                                            navigate(`/profile/${user.id}`)
                                        }}
                                        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                                            user.isCurrentUser
                                                ? 'bg-amber-950/30 border-amber-500/50 shadow-md'
                                                : 'bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-900 hover:border-zinc-700'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="w-6 text-center text-xs font-bold text-zinc-400 font-mono">
                                                #{user.rank}
                                            </span>
                                            <img
                                                src={user.photoURL}
                                                alt={user.name}
                                                className="w-9 h-9 rounded-full object-cover shrink-0"
                                            />
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs font-bold text-white truncate">
                                                        {user.name}
                                                    </span>
                                                    {user.isCurrentUser && (
                                                        <span className="text-[9px] bg-amber-500 text-zinc-950 font-bold px-1.5 py-0.2 rounded-md">
                                                            YOU
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-zinc-400 truncate">
                                                    {user.role} {user.discipline ? `· ${user.discipline}` : ''}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 text-right shrink-0">
                                            <div>
                                                <div className="flex items-center justify-end gap-1 text-xs font-extrabold text-orange-400">
                                                    <Flame className="h-3.5 w-3.5 fill-orange-400" />
                                                    <span>{user.score || (user.currentStreak + user.totalContributions)} pts</span>
                                                </div>
                                                <span className="text-[10px] text-zinc-400 font-mono">
                                                    {user.currentStreak}d streak · {user.totalContributions} actions
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer showing logged-in user's rank */}
                {currentUserRank && (
                    <div className="bg-zinc-900 border-t border-zinc-800 p-3 sm:p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                <Trophy className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-white">Your Rank: #{currentUserRank.rank}</p>
                                <p className="text-[10px] text-zinc-400">
                                    Keep grinding to climb to the Top 3 podium!
                                </p>
                            </div>
                        </div>

                        <Button
                            onClick={onClose}
                            size="sm"
                            className="bg-zinc-800 hover:bg-zinc-700 text-white text-xs h-8 rounded-lg"
                        >
                            Close
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}

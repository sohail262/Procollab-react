import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { Task } from '@/types/project';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
    format, differenceInDays, differenceInWeeks,
    startOfWeek, isPast, isToday
} from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

interface GanttChartProps {
    readOnly?: boolean
}

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
    backlog: '#94a3b8',
    todo: '#64748b',
    'in-progress': '#3b82f6',
    review: '#a855f7',
    done: '#22c55e',
}

const STATUS_LABELS: Record<string, string> = {
    backlog: 'Backlog',
    todo: 'To Do',
    'in-progress': 'In Progress',
    review: 'In Review',
    done: 'Done',
}

export function GanttChart({ readOnly: _readOnly = false }: GanttChartProps) {
    const { id: projectId } = useParams();
    const { user } = useAuth();

    const [allTasks, setAllTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
    const [filterStatus, setFilterStatus] = useState<string>('all');

    // ── Firestore listener ────────────────────────────────────────────────────
    useEffect(() => {
        if (!projectId || !user) return;

        const q = query(collection(db, 'projects', projectId, 'tasks'));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const raw = snapshot.docs.map(d => ({
                    id: d.id,
                    ...d.data(),
                })) as Task[];
                setAllTasks(raw);
                setLoading(false);
            },
            (err) => {
                console.error('GanttChart listener error:', err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [projectId, user]);

    // Filter tasks that have due dates for timeline display
    const tasksWithDueDates = useMemo(() => 
        allTasks.filter(t => t.dueDate), 
        [allTasks]
    );

    // ── Safe date converter ───────────────────────────────────────────────────
    const toDate = (value: any): Date => {
        if (!value) return new Date();
        if (value instanceof Date) return value;
        if (typeof value.toDate === 'function') return value.toDate();
        const d = new Date(value);
        return isNaN(d.getTime()) ? new Date() : d;
    };

    // ── Derived stats for student motivation ─────────────────────────────────
    const stats = useMemo(() => {
        const total = allTasks.length;
        const done = allTasks.filter(t => t.status === 'done').length;
        const overdue = tasksWithDueDates.filter(t => {
            const due = toDate(t.dueDate);
            return isPast(due) && t.status !== 'done';
        }).length;
        const dueToday = tasksWithDueDates.filter(t => isToday(toDate(t.dueDate))).length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        return { total, done, overdue, dueToday, pct };
    }, [allTasks, tasksWithDueDates]);

    // ── Build chart data ──────────────────────────────────────────────────────
    const data = useMemo(() => {
        const filtered = filterStatus === 'all'
            ? tasksWithDueDates
            : tasksWithDueDates.filter(t => t.status === filterStatus);

        return filtered
            .map((task) => {
                const startDate = toDate((task as any).createdAt);
                const endDate = toDate(task.dueDate);
                const overdue = isPast(endDate) && task.status !== 'done';

                const duration = viewMode === 'week'
                    ? Math.max(differenceInWeeks(endDate, startDate), 1)
                    : Math.max(differenceInDays(endDate, startDate), 1);

                return {
                    name: task.title.length > 28
                        ? task.title.slice(0, 26) + '…'
                        : task.title,
                    fullName: task.title,
                    startDate: startDate.getTime(),
                    endDate: endDate.getTime(),
                    duration,
                    status: task.status,
                    priority: task.priority,
                    overdue,
                };
            })
            .sort((a, b) => a.startDate - b.startDate);
    }, [tasksWithDueDates, viewMode, filterStatus]);

    // ── Custom tooltip ────────────────────────────────────────────────────────
    const CustomTooltip = ({ active, payload }: any) => {
        if (!active || !payload?.length) return null;
        const d = payload[0].payload;
        return (
            <div className="bg-background border rounded-lg p-3 shadow-lg text-xs space-y-1 max-w-[220px]">
                <p className="font-semibold text-sm leading-tight">{d.fullName}</p>
                <div className="h-px bg-border my-1" />
                <p>📅 Start: <span className="font-medium">{format(new Date(d.startDate), 'MMM d, yyyy')}</span></p>
                <p>🏁 Due:   <span className="font-medium">{format(new Date(d.endDate), 'MMM d, yyyy')}</span></p>
                <p>⏱ Duration: <span className="font-medium">
                    {d.duration} {viewMode === 'week' ? 'week(s)' : 'day(s)'}
                </span></p>
                <p>
                    Status:{' '}
                    <span
                        className="font-medium"
                        style={{ color: STATUS_COLORS[d.status] }}
                    >
                        {STATUS_LABELS[d.status] ?? d.status}
                    </span>
                </p>
                {d.overdue && (
                    <p className="text-destructive font-semibold flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Overdue!
                    </p>
                )}
            </div>
        );
    };

    // ── Custom Y-axis tick ─────────────────────────────────────────────────────
    const CustomYAxisTick = ({ x, y, payload }: any) => {
        const entry = data.find(d => d.name === payload.value);
        return (
            <g transform={`translate(${x},${y})`}>
                <text
                    x={-4}
                    y={0}
                    dy={4}
                    textAnchor="end"
                    fill={entry?.overdue ? '#ef4444' : 'currentColor'}
                    fontSize={12}
                    className="font-medium"
                >
                    {payload.value}
                </text>
                {entry?.overdue && (
                    <text x={-190} y={0} dy={5} fontSize={10} fill="#ef4444">⚠</text>
                )}
            </g>
        );
    };

    // ── Loading skeleton ──────────────────────────────────────────────────────
    if (loading) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <Skeleton className="h-6 w-48" />
                </CardHeader>
                <CardContent className="space-y-3">
                    {[1, 2, 3, 4].map(i => (
                        <Skeleton key={i} className="h-8 w-full" />
                    ))}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="flex-shrink-0">
                {/* ── Header row ── */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
                    <CardTitle className="text-base sm:text-lg font-medium">Project Timeline</CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Status filter */}
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger className="w-[120px] sm:w-[140px] h-8 text-xs sm:text-sm">
                                <SelectValue placeholder="Filter status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                {Object.entries(STATUS_LABELS).map(([val, label]) => (
                                    <SelectItem key={val} value={val}>{label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* View mode */}
                        <Select
                            value={viewMode}
                            onValueChange={(v) => setViewMode(v as 'day' | 'week')}
                        >
                            <SelectTrigger className="w-[100px] sm:w-[130px] h-8 text-xs sm:text-sm">
                                <SelectValue placeholder="View" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="day">Daily</SelectItem>
                                <SelectItem value="week">Weekly</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* ── Progress stats row — student motivation ── */}
                <div className="flex flex-wrap gap-3 mt-1">
                    <div className="flex items-center gap-1.5 bg-muted/60 rounded-lg px-3 py-1.5">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium">
                            {stats.done}/{stats.total} done
                        </span>
                        <span className="text-xs text-muted-foreground">
                            ({stats.pct}%)
                        </span>
                    </div>

                    {stats.dueToday > 0 && (
                        <Badge
                            variant="outline"
                            className="bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1"
                        >
                            <Clock className="h-3 w-3" />
                            {stats.dueToday} due today
                        </Badge>
                    )}

                    {stats.overdue > 0 && (
                        <Badge
                            variant="destructive"
                            className="flex items-center gap-1"
                        >
                            <AlertTriangle className="h-3 w-3" />
                            {stats.overdue} overdue
                        </Badge>
                    )}

                    {/* Progress bar */}
                    <div className="flex-1 flex items-center gap-2 min-w-[120px]">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                                className="h-full bg-green-500 rounded-full transition-all duration-500"
                                style={{ width: `${stats.pct}%` }}
                            />
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {stats.pct}% complete
                        </span>
                    </div>
                </div>

                {/* ── Status colour legend ── */}
                <div className="flex flex-wrap gap-3 mt-2">
                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                        <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span
                                className="inline-block w-3 h-3 rounded-sm"
                                style={{ backgroundColor: STATUS_COLORS[key] }}
                            />
                            {label}
                        </div>
                    ))}
                    <div className="flex items-center gap-1.5 text-xs text-destructive">
                        <span>⚠</span> Overdue (red label)
                    </div>
                </div>
            </CardHeader>

            <CardContent className="flex-1 min-h-0 w-full overflow-x-auto">
                {data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                        <div className="text-5xl">📅</div>
                        <p className="text-sm font-medium">No tasks with due dates found</p>
                        <p className="text-xs text-center max-w-md">
                            The Gantt chart shows tasks with due dates to visualize your project timeline. 
                            Add due dates to your tasks in the Kanban board to see them here.
                        </p>
                        {stats.total > 0 && (
                            <p className="text-xs text-blue-600 font-medium">
                                {stats.total} task(s) exist but need due dates to appear on timeline
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="min-w-[500px]">
                    <ResponsiveContainer width="100%" height={Math.max(data.length * 50 + 60, 300)}>
                        <BarChart
                            data={data}
                            layout="vertical"
                            barSize={22}
                            margin={{ top: 10, right: 40, left: 120, bottom: 10 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis
                                type="number"
                                domain={['dataMin', 'dataMax']}
                                tickFormatter={(unix) =>
                                    format(
                                        new Date(unix),
                                        viewMode === 'week' ? 'MMM d' : 'MMM d'
                                    )
                                }
                                scale="time"
                                tick={{ fontSize: 10 }}
                            />
                            <YAxis
                                type="category"
                                dataKey="name"
                                width={115}
                                tick={<CustomYAxisTick />}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar
                                dataKey="duration"
                                background={{ fill: '#f1f5f9', radius: 4 }}
                                radius={[4, 4, 4, 4]}
                                label={{
                                    position: 'right',
                                    fontSize: 10,
                                    fill: '#64748b',
                                    formatter: (v: any) =>
                                        `${v}${viewMode === 'week' ? 'w' : 'd'}`,
                                }}
                            >
                                {data.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={
                                            entry.overdue
                                                ? '#fca5a5'
                                                : STATUS_COLORS[entry.status] ?? '#cbd5e1'
                                        }
                                        stroke={entry.overdue ? '#ef4444' : 'transparent'}
                                        strokeWidth={entry.overdue ? 1.5 : 0}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
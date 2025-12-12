import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Task } from '@/types/project';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, differenceInDays } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';

interface GanttChartProps {
    readOnly?: boolean
}

export function GanttChart({ readOnly: _readOnly = false }: GanttChartProps) {
    const { id: projectId } = useParams();
    const { user } = useAuth();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [viewMode, setViewMode] = useState<'day' | 'week'>('day');

    // Fetch tasks with due dates
    useEffect(() => {
        if (!projectId || !user) return;
        const q = query(collection(db, 'projects', projectId, 'tasks'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const tasksData = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Task[];
            setTasks(tasksData.filter((t) => t.dueDate));
        });
        return () => unsubscribe();
    }, [projectId, user]);

    // Helper to safely convert Firestore Timestamp or Date or raw value to Date
    const toSafeDate = (value: any): Date => {
        if (value instanceof Date) return value;
        if (value && typeof value.toDate === 'function') return value.toDate();
        // Fallback to current date if undefined or invalid
        const d = new Date(value);
        return isNaN(d.getTime()) ? new Date() : d;
    };

    // Transform tasks for Gantt chart
    const data = tasks
        .map((task) => {
            const startDate = toSafeDate((task as any).createdAt);
            const endDate = toSafeDate(task.dueDate);
            const duration = differenceInDays(endDate, startDate) || 1;
            return {
                name: task.title,
                startDate: startDate.getTime(),
                endDate: endDate.getTime(),
                duration,
                status: task.status,
                priority: task.priority,
            };
        })
        .sort((a, b) => a.startDate - b.startDate);

    const statusColors: Record<string, string> = {
        backlog: '#94a3b8',
        todo: '#64748b',
        'in-progress': '#3b82f6',
        review: '#a855f7',
        done: '#22c55e',
    };

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const d = payload[0].payload;
            return (
                <div className="bg-background border rounded-lg p-2 shadow-md text-xs">
                    <p className="font-semibold">{d.name}</p>
                    <p>Start: {format(new Date(d.startDate), 'MMM d')}</p>
                    <p>End: {format(new Date(d.endDate), 'MMM d')}</p>
                    <p>Duration: {d.duration} days</p>
                    <p className="capitalize">Status: {d.status}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-medium">Project Timeline</CardTitle>
                <Select value={viewMode} onValueChange={(v) => setViewMode(v as 'day' | 'week')}>
                    <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="View" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="day">Daily View</SelectItem>
                        <SelectItem value="week">Weekly View</SelectItem>
                    </SelectContent>
                </Select>
            </CardHeader>
            <CardContent className="h-[calc(100%-60px)] w-full min-w-0">
                {tasks.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        No tasks with due dates found. Add due dates to tasks to see them here.
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} layout="vertical" barSize={20} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal vertical />
                            <XAxis
                                type="number"
                                domain={['dataMin', 'dataMax']}
                                tickFormatter={(unix) => format(new Date(unix), 'MMM d')}
                                scale="time"
                            />
                            <YAxis type="category" dataKey="name" width={150} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="duration" background={{ fill: '#eee' }} radius={[4, 4, 4, 4]}>
                                {data.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={statusColors[entry.status as keyof typeof statusColors] || '#cbd5e1'}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
}

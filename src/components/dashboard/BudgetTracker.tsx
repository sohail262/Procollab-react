// BudgetTracker.tsx
import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
    Table, TableBody, TableCell, TableHead,
    TableHeader, TableRow
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, TrendingUp, TrendingDown, Edit2, Trash2 } from 'lucide-react'
import {
    ResponsiveContainer, PieChart as RechartsPieChart,
    Pie, Cell, Tooltip
} from 'recharts'
import {
    doc,
    collection,
    onSnapshot,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    query,
    orderBy,
    Timestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/hooks/use-auth'
import { useParams } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'

// ─── Types ────────────────────────────────────────────────────────────────────
type ExpenseFrequency = 'one-time' | 'hourly' | 'daily' | 'weekly' | 'monthly'
type ExpenseStatus = 'pending' | 'approved' | 'rejected'

interface Expense {
    id: string
    description: string
    amount: number
    category: string
    date: Date
    status: ExpenseStatus
    frequency: ExpenseFrequency
    createdBy: string
}

interface BudgetTrackerProps {
    readOnly?: boolean
}

// ─── Firestore paths ──────────────────────────────────────────────────────────
// projects/{projectId}/budget (single doc, id = "config")
//   fields: { amount: number, updatedAt: Timestamp, updatedBy: string }
//
// projects/{projectId}/expenses (collection)
//   fields: { description, amount, category, date, status, frequency, createdBy, createdAt }

export function BudgetTracker({ readOnly = false }: BudgetTrackerProps) {
    const { id: projectId } = useParams()
    const { user } = useAuth()
    const { toast } = useToast()

    const [budget, setBudget] = useState<number>(0)
    const [expenses, setExpenses] = useState<Expense[]>([])
    const [loading, setLoading] = useState(true)
    const [isEditingBudget, setIsEditingBudget] = useState(false)
    const [tempBudget, setTempBudget] = useState('')
    const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false)
    const [savingBudget, setSavingBudget] = useState(false)
    const [newExpense, setNewExpense] = useState<Partial<Expense>>({
        description: '',
        amount: 0,
        category: 'General',
        status: 'pending',
        frequency: 'one-time',
    })

    // ── Budget listener ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!projectId || !user) return

        const budgetRef = doc(db, 'projects', projectId, 'budget', 'config')

        const unsub = onSnapshot(
            budgetRef,
            (snap) => {
                if (snap.exists()) {
                    setBudget(snap.data().amount ?? 0)
                }
                setLoading(false)
            },
            (err) => {
                console.error('Budget listener error:', err)
                setLoading(false)
            }
        )

        return () => unsub()
    }, [projectId, user])

    // ── Expenses listener ────────────────────────────────────────────────────
    useEffect(() => {
        if (!projectId || !user) return

        const q = query(
            collection(db, 'projects', projectId, 'expenses'),
            orderBy('createdAt', 'desc')
        )

        const unsub = onSnapshot(
            q,
            (snap) => {
                const data = snap.docs.map(d => {
                    const raw = d.data()
                    return {
                        id: d.id,
                        description: raw.description,
                        amount: raw.amount,
                        category: raw.category,
                        // Firestore Timestamp → JS Date
                        date: raw.date instanceof Timestamp
                            ? raw.date.toDate()
                            : new Date(raw.date),
                        status: raw.status as ExpenseStatus,
                        frequency: raw.frequency as ExpenseFrequency,
                        createdBy: raw.createdBy,
                    } as Expense
                })
                setExpenses(data)
            },
            (err) => console.error('Expenses listener error:', err)
        )

        return () => unsub()
    }, [projectId, user])

    // ── Save budget to Firestore ─────────────────────────────────────────────
    const handleSaveBudget = async () => {
        const parsed = parseFloat(tempBudget)
        if (isNaN(parsed) || parsed < 0) return

        setSavingBudget(true)
        try {
            const budgetRef = doc(db, 'projects', projectId!, 'budget', 'config')
            await setDoc(budgetRef, {
                amount: parsed,
                updatedAt: serverTimestamp(),
                updatedBy: user!.uid,
            })
            setIsEditingBudget(false)
            toast({
                title: 'Budget updated', description: `Budget set to 
$$
{parsed.toLocaleString()}` })
        } catch (err) {
            console.error('Failed to save budget:', err)
            toast({ title: 'Error', description: 'Could not save budget.', variant: 'destructive' })
        } finally {
            setSavingBudget(false)
        }
    }

    // ── Add expense to Firestore ─────────────────────────────────────────────
    const handleAddExpense = async () => {
        if (!newExpense.description || !newExpense.amount || newExpense.amount <= 0) return
        if (!projectId || !user) return

        try {
            await addDoc(collection(db, 'projects', projectId, 'expenses'), {
                description: newExpense.description,
                amount: Number(newExpense.amount),
                category: newExpense.category || 'General',
                date: serverTimestamp(),   // store as Timestamp
                status: 'pending',
                frequency: newExpense.frequency || 'one-time',
                createdBy: user.uid,
                createdAt: serverTimestamp(),
            })

            setIsAddExpenseOpen(false)
            setNewExpense({
                description: '',
                amount: 0,
                category: 'General',
                status: 'pending',
                frequency: 'one-time',
            })
            toast({ title: 'Expense added', description: 'New expense recorded.' })
        } catch (err) {
            console.error('Failed to add expense:', err)
            toast({ title: 'Error', description: 'Could not save expense.', variant: 'destructive' })
        }
    }

    // ── Delete expense ───────────────────────────────────────────────────────
    const handleDeleteExpense = async (id: string) => {
        if (!projectId) return
        try {
            await deleteDoc(doc(db, 'projects', projectId, 'expenses', id))
            toast({ title: 'Expense deleted' })
        } catch (err) {
            console.error('Failed to delete expense:', err)
            toast({ title: 'Error', description: 'Could not delete expense.', variant: 'destructive' })
        }
    }

    // ── Update expense status ────────────────────────────────────────────────
    const handleUpdateStatus = async (id: string, status: ExpenseStatus) => {
        if (!projectId) return
        try {
            await updateDoc(doc(db, 'projects', projectId, 'expenses', id), { status })
        } catch (err) {
            console.error('Failed to update status:', err)
            toast({ title: 'Error', description: 'Could not update status.', variant: 'destructive' })
        }
    }

    // ── Calculations (unchanged logic) ───────────────────────────────────────
    const getMultiplier = (frequency: ExpenseFrequency) => {
        switch (frequency) {
            case 'hourly': return 8 * 22
            case 'daily': return 22
            case 'weekly': return 4
            case 'monthly': return 1
            default: return 1
        }
    }

    const calculateActualSpend = useCallback(() => {
        return expenses
            .filter(e => e.status === 'approved')
            .reduce((total, e) => total + e.amount * getMultiplier(e.frequency), 0)
    }, [expenses])

    const totalSpent = calculateActualSpend()
    const remainingBudget = budget - totalSpent
    const percentUsed = budget > 0 ? Math.min(Math.round((totalSpent / budget) * 100), 100) : 0

    const categoryData = expenses
        .filter(e => e.status === 'approved')
        .reduce((acc, e) => {
            const amount = e.amount * getMultiplier(e.frequency)
            const existing = acc.find(item => item.name === e.category)
            if (existing) existing.value += amount
            else acc.push({ name: e.category, value: amount })
            return acc
        }, [] as { name: string; value: number }[])

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']

    const getFrequencyLabel = (f: ExpenseFrequency) =>
        ({ 'one-time': 'One-time', hourly: 'Per Hour', daily: 'Per Day', weekly: 'Per Week', monthly: 'Per Month' }[f])

    // ── Loading state ────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
                </div>
                <Skeleton className="h-64" />
            </div>
        )
    }

    return (
        <div className="space-y-6">

            {/* ── Summary Cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Total Budget */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
                        {!readOnly && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                    setTempBudget(budget.toString())
                                    setIsEditingBudget(true)
                                }}
                            >
                                <Edit2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent>
                        {isEditingBudget ? (
                            <div className="space-y-2">
                                <Input
                                    type="number"
                                    value={tempBudget}
                                    onChange={(e) => setTempBudget(e.target.value)}
                                    placeholder="Enter budget"
                                    className="text-xl font-bold"
                                    autoFocus
                                />
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={handleSaveBudget} disabled={savingBudget}>
                                        {savingBudget ? 'Saving...' : 'Save'}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setIsEditingBudget(false)}
                                        disabled={savingBudget}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="text-2xl font-bold">
                                    {budget > 0 ? `
$$
{budget.toLocaleString()}` : 'Not Set'}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Monthly Budget</p>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Actual Spend */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Actual Spend</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${totalSpent.toLocaleString()}</div>
                        {budget > 0 && (
                            <>
                                <Progress
                                    value={percentUsed}
                                    className={`mt-2 ${percentUsed >= 90 ? '[&>div]:bg-destructive' : ''}`}
                                />
                                <p className="text-xs text-muted-foreground mt-2">
                                    {percentUsed}% of budget used
                                    {percentUsed >= 90 && (
                                        <span className="text-destructive ml-1 font-medium">
                                            — Over budget risk!
                                        </span>
                                    )}
                                </p>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Remaining */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Remaining</CardTitle>
                        <TrendingDown className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${remainingBudget < 0 ? 'text-destructive' : 'text-green-600'}`}>
                            ${remainingBudget.toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {budget > 0 ? 'Available for allocation' : 'Set budget to track'}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* ── Expense Log + Category Chart ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Expense Log */}
                <Card className="col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Expense Log</CardTitle>
                            <CardDescription>Track all project expenses and their frequencies</CardDescription>
                        </div>
                        {!readOnly && (
                            <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
                                <DialogTrigger asChild>
                                    <Button size="sm">
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Expense
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[500px]">
                                    <DialogHeader>
                                        <DialogTitle>Add New Expense</DialogTitle>
                                        <DialogDescription>
                                            Record a new project expense with frequency.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="desc">Description</Label>
                                            <Input
                                                id="desc"
                                                value={newExpense.description}
                                                onChange={(e) =>
                                                    setNewExpense({ ...newExpense, description: e.target.value })
                                                }
                                                placeholder="e.g. Hosting Fees"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="amount">Amount ($)</Label>
                                                <Input
                                                    id="amount"
                                                    type="number"
                                                    min={0}
                                                    value={newExpense.amount || ''}
                                                    onChange={(e) =>
                                                        setNewExpense({
                                                            ...newExpense,
                                                            amount: parseFloat(e.target.value),
                                                        })
                                                    }
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="category">Category</Label>
                                                <Select
                                                    value={newExpense.category}
                                                    onValueChange={(val) =>
                                                        setNewExpense({ ...newExpense, category: val })
                                                    }
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {['Software', 'Personnel', 'Infrastructure', 'Marketing', 'General']
                                                            .map(c => (
                                                                <SelectItem key={c} value={c}>{c}</SelectItem>
                                                            ))
                                                        }
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="frequency">Frequency</Label>
                                            <Select
                                                value={newExpense.frequency}
                                                onValueChange={(val: ExpenseFrequency) =>
                                                    setNewExpense({ ...newExpense, frequency: val })
                                                }
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select frequency" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="one-time">One-time</SelectItem>
                                                    <SelectItem value="hourly">Hourly</SelectItem>
                                                    <SelectItem value="daily">Daily</SelectItem>
                                                    <SelectItem value="weekly">Weekly</SelectItem>
                                                    <SelectItem value="monthly">Monthly</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <p className="text-xs text-muted-foreground">
                                                Recurring expenses will be calculated for the monthly budget
                                            </p>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setIsAddExpenseOpen(false)}>
                                            Cancel
                                        </Button>
                                        <Button onClick={handleAddExpense}>Save Expense</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Frequency</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    {!readOnly && <TableHead className="text-right">Actions</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {expenses.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={readOnly ? 6 : 7}
                                            className="text-center text-muted-foreground h-24"
                                        >
                                            No expenses recorded yet.
                                            {!readOnly && ' Click "Add Expense" to get started.'}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    expenses.map((expense) => (
                                        <TableRow key={expense.id}>
                                            <TableCell className="font-medium">
                                                {expense.description}
                                            </TableCell>
                                            <TableCell>{expense.category}</TableCell>
                                            <TableCell>
                                                <span className="text-xs bg-muted px-2 py-1 rounded">
                                                    {getFrequencyLabel(expense.frequency)}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                {expense.date instanceof Date
                                                    ? expense.date.toLocaleDateString()
                                                    : '—'}
                                            </TableCell>
                                            <TableCell>
                                                {readOnly ? (
                                                    <span className={`text-xs px-2 py-1 rounded font-medium ${expense.status === 'approved'
                                                            ? 'bg-green-100 text-green-700'
                                                            : expense.status === 'rejected'
                                                                ? 'bg-red-100 text-red-700'
                                                                : 'bg-yellow-100 text-yellow-700'
                                                        }`}>
                                                        {expense.status}
                                                    </span>
                                                ) : (
                                                    <Select
                                                        value={expense.status}
                                                        onValueChange={(val: ExpenseStatus) =>
                                                            handleUpdateStatus(expense.id, val)
                                                        }
                                                    >
                                                        <SelectTrigger className="w-[110px] h-7">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="pending">Pending</SelectItem>
                                                            <SelectItem value="approved">Approved</SelectItem>
                                                            <SelectItem value="rejected">Rejected</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                ${expense.amount.toLocaleString()}
                                            </TableCell>
                                            {!readOnly && (
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() => handleDeleteExpense(expense.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Category Pie */}
                <Card>
                    <CardHeader>
                        <CardTitle>Spend by Category</CardTitle>
                        <CardDescription>Approved expenses only</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[400px]">
                        {categoryData.length > 0 ? (
                            <>
                                <ResponsiveContainer width="100%" height="60%">
                                    <RechartsPieChart>
                                        <Pie
                                            data={categoryData}
                                            cx="50%" cy="50%"
                                            innerRadius={60} outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {categoryData.map((_, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={COLORS[index % COLORS.length]}
                                                />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            formatter={(value: number) => `$${value.toLocaleString()}`}
                                        />
                                    </RechartsPieChart>
                                </ResponsiveContainer>
                                <div className="mt-4 space-y-2">
                                    {categoryData.map((entry, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center justify-between text-sm"
                                        >
                                            <div className="flex items-center">
                                                <div
                                                    className="h-3 w-3 rounded-full mr-2"
                                                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                                />
                                                <span>{entry.name}</span>
                                            </div>
                                            <span className="font-medium">
                                                ${entry.value.toLocaleString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                <p className="text-sm">No approved expenses yet</p>
                                <p className="text-xs mt-1">
                                    Add and approve expenses to see the breakdown
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
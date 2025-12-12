import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, DollarSign, TrendingUp, TrendingDown, Edit2, Trash2 } from 'lucide-react'
import { ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, Tooltip } from 'recharts'

type ExpenseFrequency = 'one-time' | 'hourly' | 'daily' | 'weekly' | 'monthly'

interface Expense {
    id: string
    description: string
    amount: number
    category: string
    date: Date
    status: 'pending' | 'approved' | 'rejected'
    frequency: ExpenseFrequency
}

interface BudgetTrackerProps {
    readOnly?: boolean
}

export function BudgetTracker({ readOnly: _readOnly = false }: BudgetTrackerProps) {
    // State for local storage
    const [budget, setBudget] = useState(() => {
        const saved = localStorage.getItem('procollab-budget');
        return saved ? parseFloat(saved) : 0;
    });

    const [isEditingBudget, setIsEditingBudget] = useState(false);
    const [tempBudget, setTempBudget] = useState(budget.toString());

    // Load expenses from local storage
    const [expenses, setExpenses] = useState<Expense[]>(() => {
        const saved = localStorage.getItem('procollab-expenses');
        if (saved) {
            try {
                return JSON.parse(saved).map((e: any) => ({
                    ...e,
                    date: new Date(e.date)
                }));
            } catch (e) {
                console.error("Failed to parse expenses", e);
            }
        }
        return [];
    });

    const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
    const [newExpense, setNewExpense] = useState<Partial<Expense>>({
        description: '',
        amount: 0,
        category: 'General',
        status: 'pending',
        frequency: 'one-time'
    });

    // Persist changes
    useEffect(() => {
        localStorage.setItem('procollab-budget', budget.toString());
    }, [budget]);

    useEffect(() => {
        localStorage.setItem('procollab-expenses', JSON.stringify(expenses));
    }, [expenses]);

    const handleSaveBudget = () => {
        const newBudget = parseFloat(tempBudget);
        if (!isNaN(newBudget) && newBudget >= 0) {
            setBudget(newBudget);
            setIsEditingBudget(false);
        }
    };

    const handleAddExpense = () => {
        if (!newExpense.description || !newExpense.amount || newExpense.amount <= 0) return;

        const expense: Expense = {
            id: Date.now().toString(),
            description: newExpense.description,
            amount: Number(newExpense.amount),
            category: newExpense.category || 'General',
            date: new Date(),
            status: 'pending',
            frequency: newExpense.frequency || 'one-time'
        };

        setExpenses([expense, ...expenses]);
        setIsAddExpenseOpen(false);
        setNewExpense({
            description: '',
            amount: 0,
            category: 'General',
            status: 'pending',
            frequency: 'one-time'
        });
    };

    const handleDeleteExpense = (id: string) => {
        setExpenses(expenses.filter(e => e.id !== id));
    };

    const handleUpdateStatus = (id: string, status: 'pending' | 'approved' | 'rejected') => {
        setExpenses(expenses.map(e => e.id === id ? { ...e, status } : e));
    };

    // Calculate actual spend based on approved expenses and their frequencies
    const calculateActualSpend = () => {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        return expenses
            .filter(e => e.status === 'approved')
            .reduce((total, expense) => {
                let multiplier = 1;

                switch (expense.frequency) {
                    case 'hourly':
                        // Assuming 8 working hours per day, ~22 working days per month
                        multiplier = 8 * 22;
                        break;
                    case 'daily':
                        multiplier = 22; // ~22 working days
                        break;
                    case 'weekly':
                        multiplier = 4; // ~4 weeks per month
                        break;
                    case 'monthly':
                        multiplier = 1;
                        break;
                    case 'one-time':
                    default:
                        multiplier = 1;
                        break;
                }

                return total + (expense.amount * multiplier);
            }, 0);
    };

    const totalSpent = calculateActualSpend();
    const remainingBudget = budget - totalSpent;
    const percentUsed = budget > 0 ? Math.round((totalSpent / budget) * 100) : 0;

    const categoryData = expenses
        .filter(e => e.status === 'approved')
        .reduce((acc, expense) => {
            let multiplier = 1;
            switch (expense.frequency) {
                case 'hourly': multiplier = 8 * 22; break;
                case 'daily': multiplier = 22; break;
                case 'weekly': multiplier = 4; break;
                case 'monthly': multiplier = 1; break;
                default: multiplier = 1;
            }

            const amount = expense.amount * multiplier;
            const existing = acc.find(item => item.name === expense.category);
            if (existing) {
                existing.value += amount;
            } else {
                acc.push({ name: expense.category, value: amount });
            }
            return acc;
        }, [] as { name: string, value: number }[]);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

    const getFrequencyLabel = (frequency: ExpenseFrequency) => {
        const labels = {
            'one-time': 'One-time',
            'hourly': 'Per Hour',
            'daily': 'Per Day',
            'weekly': 'Per Week',
            'monthly': 'Per Month'
        };
        return labels[frequency];
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                                setTempBudget(budget.toString());
                                setIsEditingBudget(true);
                            }}
                        >
                            <Edit2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
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
                                />
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={handleSaveBudget}>Save</Button>
                                    <Button size="sm" variant="outline" onClick={() => setIsEditingBudget(false)}>Cancel</Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="text-2xl font-bold">
                                    {budget > 0 ? `$${budget.toLocaleString()}` : 'Not Set'}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Monthly Budget
                                </p>
                            </>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Actual Spend</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${totalSpent.toLocaleString()}</div>
                        {budget > 0 && (
                            <>
                                <Progress value={percentUsed} className="mt-2" />
                                <p className="text-xs text-muted-foreground mt-2">
                                    {percentUsed}% of budget used
                                </p>
                            </>
                        )}
                    </CardContent>
                </Card>
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Expense Log</CardTitle>
                            <CardDescription>Track all project expenses and their frequencies</CardDescription>
                        </div>
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
                                    <DialogDescription>Record a new project expense with frequency.</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="desc">Description</Label>
                                        <Input
                                            id="desc"
                                            value={newExpense.description}
                                            onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                                            placeholder="e.g. Hosting Fees"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="amount">Amount ($)</Label>
                                            <Input
                                                id="amount"
                                                type="number"
                                                value={newExpense.amount || ''}
                                                onChange={(e) => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) })}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="category">Category</Label>
                                            <Select
                                                value={newExpense.category}
                                                onValueChange={(val) => setNewExpense({ ...newExpense, category: val })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Software">Software</SelectItem>
                                                    <SelectItem value="Personnel">Personnel</SelectItem>
                                                    <SelectItem value="Infrastructure">Infrastructure</SelectItem>
                                                    <SelectItem value="Marketing">Marketing</SelectItem>
                                                    <SelectItem value="General">General</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="frequency">Frequency</Label>
                                        <Select
                                            value={newExpense.frequency}
                                            onValueChange={(val: ExpenseFrequency) => setNewExpense({ ...newExpense, frequency: val })}
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
                                    <Button variant="outline" onClick={() => setIsAddExpenseOpen(false)}>Cancel</Button>
                                    <Button onClick={handleAddExpense}>Save Expense</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
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
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {expenses.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-muted-foreground h-24">
                                            No expenses recorded yet. Click "Add Expense" to get started.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    expenses.map((expense) => (
                                        <TableRow key={expense.id}>
                                            <TableCell className="font-medium">{expense.description}</TableCell>
                                            <TableCell>{expense.category}</TableCell>
                                            <TableCell>
                                                <span className="text-xs bg-muted px-2 py-1 rounded">
                                                    {getFrequencyLabel(expense.frequency)}
                                                </span>
                                            </TableCell>
                                            <TableCell>{expense.date.toLocaleDateString()}</TableCell>
                                            <TableCell>
                                                <Select
                                                    value={expense.status}
                                                    onValueChange={(val: 'pending' | 'approved' | 'rejected') =>
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
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                ${expense.amount.toLocaleString()}
                                            </TableCell>
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
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

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
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {categoryData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                                    </RechartsPieChart>
                                </ResponsiveContainer>
                                <div className="mt-4 space-y-2">
                                    {categoryData.map((entry, index) => (
                                        <div key={index} className="flex items-center justify-between text-sm">
                                            <div className="flex items-center">
                                                <div className="h-3 w-3 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                                <span>{entry.name}</span>
                                            </div>
                                            <span className="font-medium">${entry.value.toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                <p className="text-sm">No approved expenses yet</p>
                                <p className="text-xs mt-1">Add and approve expenses to see the breakdown</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    ClipboardList, ArrowLeft, Clock, Check, X, ExternalLink,
    AlertTriangle, Trash2, Eye
} from 'lucide-react'
import {
    doc,
    getDocs,
    collection,
    query,
    orderBy,
    deleteDoc,
    where
} from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { useToast } from '@/hooks/use-toast'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface Application {
    id: string
    projectId: string
    projectTitle: string
    position?: string
    status: 'pending' | 'accepted' | 'rejected'
    appliedAt: Date
}

export function Applications() {
    const navigate = useNavigate()
    const { toast } = useToast()
    const [applications, setApplications] = useState<Application[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadApplications()
    }, [])

    const loadApplications = async () => {
        if (!auth.currentUser) {
            setLoading(false)
            return
        }

        try {
            const appsRef = collection(db, 'users', auth.currentUser.uid, 'applications')
            const q = query(appsRef, orderBy('appliedAt', 'desc'))
            const snapshot = await getDocs(q)

            const appsData: Application[] = []

            for (const docSnap of snapshot.docs) {
                const data = docSnap.data()
                appsData.push({
                    id: docSnap.id,
                    projectId: data.projectId,
                    projectTitle: data.projectTitle || 'Unknown Project',
                    position: data.position,
                    status: data.status || 'pending',
                    appliedAt: data.appliedAt?.toDate() || new Date()
                })
            }

            setApplications(appsData)
        } catch (error) {
            console.error('Error loading applications:', error)
            toast({
                title: "Error",
                description: "Failed to load applications",
                variant: "destructive"
            })
        } finally {
            setLoading(false)
        }
    }

    const handleWithdraw = async (application: Application) => {
        if (!auth.currentUser) return

        try {
            // Delete from user's applications
            await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'applications', application.id))

            // Try to delete from project's applications
            try {
                const projectAppsRef = collection(db, 'projects', application.projectId, 'applications')
                const projectAppsQuery = query(projectAppsRef, where('userId', '==', auth.currentUser.uid))
                const projectAppsSnap = await getDocs(projectAppsQuery)

                for (const appDoc of projectAppsSnap.docs) {
                    await deleteDoc(doc(db, 'projects', application.projectId, 'applications', appDoc.id))
                }
            } catch (err) {
                console.error('Error deleting from project applications:', err)
            }

            // Remove from local state
            setApplications(prev => prev.filter(app => app.id !== application.id))

            toast({
                title: "Application withdrawn",
                description: "Your application has been withdrawn successfully"
            })
        } catch (error) {
            console.error('Error withdrawing application:', error)
            toast({
                title: "Error",
                description: "Failed to withdraw application",
                variant: "destructive"
            })
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return (
                    <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-none">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                    </Badge>
                )
            case 'accepted':
                return (
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-none">
                        <Check className="h-3 w-3 mr-1" />
                        Accepted
                    </Badge>
                )
            case 'rejected':
                return (
                    <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-none">
                        <X className="h-3 w-3 mr-1" />
                        Rejected
                    </Badge>
                )
            default:
                return <Badge variant="outline">{status}</Badge>
        }
    }

    const pendingApps = applications.filter(app => app.status === 'pending')
    const acceptedApps = applications.filter(app => app.status === 'accepted')
    const rejectedApps = applications.filter(app => app.status === 'rejected')

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto space-y-6 p-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">My Applications</h1>
                        <p className="text-muted-foreground">Track and manage your project applications</p>
                    </div>
                </div>

                {/* Stats cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Pending</p>
                                    <p className="text-3xl font-bold text-yellow-600">{pendingApps.length}</p>
                                </div>
                                <Clock className="h-8 w-8 text-yellow-500 opacity-50" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Accepted</p>
                                    <p className="text-3xl font-bold text-green-600">{acceptedApps.length}</p>
                                </div>
                                <Check className="h-8 w-8 text-green-500 opacity-50" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Rejected</p>
                                    <p className="text-3xl font-bold text-red-600">{rejectedApps.length}</p>
                                </div>
                                <X className="h-8 w-8 text-red-500 opacity-50" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Applications list */}
                <Card>
                    <CardHeader>
                        <CardTitle>All Applications</CardTitle>
                        <CardDescription>Your project applications and their current status</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="text-center py-12">
                                <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
                                <p className="text-muted-foreground">Loading applications...</p>
                            </div>
                        ) : applications.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p className="text-lg font-medium">No applications yet</p>
                                <p className="text-sm mb-4">You haven't applied to any projects yet</p>
                                <Button onClick={() => navigate('/projects')}>
                                    Browse Projects
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {applications.map((application) => (
                                    <div
                                        key={application.id}
                                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/30 transition-colors"
                                    >
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3">
                                                <h4 className="font-semibold">{application.projectTitle}</h4>
                                                {getStatusBadge(application.status)}
                                            </div>
                                            {application.position && (
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    Applied for: {application.position}
                                                </p>
                                            )}
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Applied {application.appliedAt.toLocaleDateString()}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => navigate(`/project/${application.projectId}`)}
                                            >
                                                <Eye className="h-4 w-4 mr-1" />
                                                View Project
                                            </Button>

                                            {application.status === 'pending' && (
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
                                                        >
                                                            <Trash2 className="h-4 w-4 mr-1" />
                                                            Withdraw
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Withdraw Application?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Are you sure you want to withdraw your application to "{application.projectTitle}"?
                                                                This action cannot be undone.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                onClick={() => handleWithdraw(application)}
                                                                className="bg-red-600 hover:bg-red-700"
                                                            >
                                                                Withdraw
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            )}

                                            {application.status === 'accepted' && (
                                                <Button
                                                    size="sm"
                                                    onClick={() => navigate(`/project/${application.projectId}/dashboard`)}
                                                >
                                                    <ExternalLink className="h-4 w-4 mr-1" />
                                                    Go to Dashboard
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Tips section */}
                {pendingApps.length > 0 && (
                    <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
                        <CardContent className="pt-6">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-medium text-blue-900 dark:text-blue-400">
                                        Pending Applications
                                    </h4>
                                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                                        You have {pendingApps.length} pending application{pendingApps.length > 1 ? 's' : ''}.
                                        Project owners will review your application and you'll be notified of their decision.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </DashboardLayout>
    )
}

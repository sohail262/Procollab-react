import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import {
    doc, getDoc, setDoc, updateDoc,
    arrayUnion, serverTimestamp,
    collection, addDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    Users, Eye, CheckCircle, XCircle,
    Loader2, LogIn, UserPlus, FolderKanban,
    ArrowRight, Clock,
} from 'lucide-react'
import { EMPTY_MEMBER_PERMISSIONS } from '@/hooks/use-permissions'
import type { MemberPermissions } from '@/hooks/use-permissions'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step =
    | 'loading'
    | 'preview'
    | 'need-auth'
    | 'accepting'
    | 'done'
    | 'error'
    | 'expired'
    | 'already-joined'

interface InviteData {
    id:               string
    token:            string
    projectId:        string
    projectTitle:     string
    role:             'member' | 'viewer'
    email:            string
    invitedBy:        string
    invitedByName?:   string
    invitationDocId?: string
    resolvedUserId?:  string
    status:           string
    createdAt:        any
    acceptedBy?:      string
    acceptedAt?:      any
}

interface ProjectData {
    id:                 string
    title:              string
    summary?:           string
    description?:       string
    primaryDiscipline?: string
    createdBy:          string
    tags?:              string[]
    status?:            string
}

// ─── Permission helper ────────────────────────────────────────────────────────

function getDefaultPermissions(role: 'member' | 'viewer'): MemberPermissions {
    if (role === 'viewer') {
        return {
            dashboard:  { read: true,  write: false },
            tasks:      { read: false, write: false },
            whiteboard: { read: false, write: false },
            files:      { read: false, write: false },
            chat:       { read: false, write: false },
            calendar:   { read: false, write: false },
            gantt:      { read: false, write: false },
            settings:   { read: false, write: false },
        }
    }
    return EMPTY_MEMBER_PERMISSIONS
}

import { sendNotificationWithPush } from '@/services/notificationTrigger'

// ─── Component ────────────────────────────────────────────────────────────────

export default function InviteAccept() {
    const [searchParams]                 = useSearchParams()
    const navigate                       = useNavigate()
    const { user, loading: authLoading } = useAuth()

    const token = searchParams.get('token')

    const [step,        setStep]        = useState<Step>('loading')
    const [inviteData,  setInviteData]  = useState<InviteData | null>(null)
    const [projectData, setProjectData] = useState<ProjectData | null>(null)
    const [errorMsg,    setErrorMsg]    = useState('')

    // ── Load invite once auth resolves ────────────────────────────────────
    useEffect(() => {
        if (!token) {
            setErrorMsg('Invalid invitation link — no token found.')
            setStep('error')
            return
        }
        if (authLoading) return
        loadInvite()
    }, [token, authLoading])

    // ── When user signs in on need-auth step, advance to preview ──────────
    useEffect(() => {
        if (step === 'need-auth' && user && inviteData) {
            setStep('preview')
        }
    }, [user, step, inviteData])

    const loadInvite = async () => {
        try {
            const tokenSnap = await getDoc(doc(db, 'inviteTokens', token!))

            if (!tokenSnap.exists()) {
                setStep('expired')
                return
            }

            const data = tokenSnap.data() as Omit<InviteData, 'id'>

            // Expiry check — 7 days
            const createdAt  = data.createdAt?.toDate() ?? new Date(0)
            const hoursOld   = (Date.now() - createdAt.getTime()) / 36e5
            const isConsumed =
                data.status === 'declined'  ||
                data.status === 'cancelled'

            // If accepted by this user, show a friendly 'already joined' screen
            if (data.status === 'accepted') {
                const invite: InviteData = { id: tokenSnap.id, ...data }
                setInviteData(invite)
                if (user && data.acceptedBy === user.uid) {
                    setStep('already-joined')
                } else {
                    setStep('expired')
                }
                return
            }

            if (hoursOld > 168 || isConsumed) {
                setStep('expired')
                return
            }

            // Load project
            const projSnap = await getDoc(doc(db, 'projects', data.projectId))
            if (!projSnap.exists()) {
                setErrorMsg('The project this invitation was for no longer exists.')
                setStep('error')
                return
            }

            const invite: InviteData = { id: tokenSnap.id, ...data }
            setInviteData(invite)
            setProjectData({ id: projSnap.id, ...projSnap.data() } as ProjectData)

            // If already logged in → preview, else need auth
            setStep(user ? 'preview' : 'need-auth')
        } catch (err) {
            console.error('Error loading invite:', err)
            setErrorMsg('Failed to load the invitation. Please try again.')
            setStep('error')
        }
    }

    // ── Accept ────────────────────────────────────────────────────────────
    const handleAccept = async () => {
        if (!user || !inviteData || !projectData) return
        setStep('accepting')

        try {
            const { projectId, role, invitationDocId } = inviteData
            const permissions = getDefaultPermissions(role)
            const displayName = user.displayName || user.email || 'Team Member'

            // 1. Write member document
            await setDoc(doc(db, 'projects', projectId, 'members', user.uid), {
                uid:       user.uid,
                name:      displayName,
                email:     user.email ?? '',
                avatar:    user.photoURL ?? '',
                role,
                permissions,
                joinedAt:  serverTimestamp(),
                joinedVia: 'invitation',
            })

            // 2. Add uid to project.members array
            await updateDoc(doc(db, 'projects', projectId), {
                members: arrayUnion(user.uid),
            })

            // 3. Mark token consumed
            await updateDoc(doc(db, 'inviteTokens', inviteData.id), {
                status:     'accepted',
                acceptedBy: user.uid,
                acceptedAt: serverTimestamp(),
            })

            // 4. Mark invitation doc in project sub-collection
            if (invitationDocId) {
                await updateDoc(
                    doc(db, 'projects', projectId, 'invitations', invitationDocId),
                    {
                        status:     'accepted',
                        acceptedBy: user.uid,
                        acceptedAt: serverTimestamp(),
                    }
                )
            }

            // 5. Write to user's joinedProjects sub-collection
            await setDoc(
                doc(db, 'users', user.uid, 'joinedProjects', projectId),
                {
                    projectId,
                    role,
                    joinedAt:  serverTimestamp(),
                    joinedVia: 'invitation',
                }
            )

            // 6. Notify the project owner
            if (projectData.createdBy && projectData.createdBy !== user.uid) {
                await sendNotificationWithPush(projectData.createdBy, {
                    type:      'success',
                    title:     'Invitation Accepted',
                    body:      `${displayName} accepted your invitation to join "${projectData.title}".`,
                    url:       `/project/${projectId}/manage-team`,
                    projectId,
                })
            }

            setStep('done')
        } catch (err) {
            console.error('Error accepting invitation:', err)
            setErrorMsg('Failed to accept the invitation. Please try again.')
            setStep('error')
        }
    }

    // ── Decline ───────────────────────────────────────────────────────────
    const handleDecline = async () => {
        if (inviteData) {
            try {
                await updateDoc(doc(db, 'inviteTokens', inviteData.id), {
                    status: 'declined',
                })
                if (inviteData.invitationDocId) {
                    await updateDoc(
                        doc(
                            db,
                            'projects',
                            inviteData.projectId,
                            'invitations',
                            inviteData.invitationDocId
                        ),
                        { status: 'declined' }
                    )
                }
            } catch { /* non-fatal */ }
        }
        navigate('/')
    }

    // ─── Render ───────────────────────────────────────────────────────────

    if (step === 'loading') {
        return <FullPageSpinner message="Loading your invitation…" />
    }

    if (step === 'accepting') {
        return <FullPageSpinner message="Joining project…" />
    }

    if (step === 'already-joined') {
        return (
            <FullPageCard>
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mx-auto">
                    <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
                <h2 className="text-xl font-bold text-center">Already a Member!</h2>
                <p className="text-muted-foreground text-sm text-center leading-relaxed">
                    You've already joined{' '}
                    <strong className="text-foreground">{inviteData?.projectTitle}</strong>.
                    <br />Head to your project dashboard to get started.
                </p>
                <div className="flex flex-col gap-2 w-full pt-2">
                    <Button
                        className="w-full"
                        onClick={() => navigate(`/dashboard/projects/${inviteData?.projectId}`)}
                    >
                        <FolderKanban className="h-4 w-4 mr-2" />
                        Go to Project Dashboard
                    </Button>
                    <Button variant="outline" className="w-full" onClick={() => navigate('/dashboard/projects')}>
                        My Projects
                    </Button>
                </div>
            </FullPageCard>
        )
    }

    if (step === 'expired') {
        return (
            <FullPageCard>
                <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center mx-auto">
                    <Clock className="h-8 w-8 text-orange-500" />
                </div>
                <h2 className="text-xl font-bold text-center">Invitation Expired</h2>
                <p className="text-muted-foreground text-sm text-center leading-relaxed">
                    This invitation link has expired (links are valid for 72 hours),
                    has already been used, or was cancelled.
                    <br /><br />
                    Ask the project owner to send you a new invitation.
                </p>
                <div className="flex flex-col gap-2 w-full pt-2">
                    <Button className="w-full" onClick={() => navigate('/')}>
                        Go to Home
                    </Button>
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => navigate('/discover')}
                    >
                        Discover Projects
                    </Button>
                </div>
            </FullPageCard>
        )
    }

    if (step === 'error') {
        return (
            <FullPageCard>
                <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto">
                    <XCircle className="h-8 w-8 text-destructive" />
                </div>
                <h2 className="text-xl font-bold text-center">Something went wrong</h2>
                <p className="text-muted-foreground text-sm text-center">
                    {errorMsg}
                </p>
                <Button className="w-full mt-2" onClick={() => navigate('/')}>
                    Go to Home
                </Button>
            </FullPageCard>
        )
    }

    if (step === 'done') {
        return (
            <FullPageCard>
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mx-auto">
                    <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
                <h2 className="text-xl font-bold text-center">You're in!</h2>
                <div className="text-center space-y-1">
                    <p className="text-muted-foreground text-sm">
                        You've joined{' '}
                        <strong className="text-foreground">
                            {projectData?.title}
                        </strong>{' '}
                        as a{' '}
                        <strong className="text-foreground">
                            {inviteData?.role === 'viewer' ? 'Viewer' : 'Team Member'}
                        </strong>.
                    </p>
                    <p className="text-muted-foreground text-sm">
                        The project now appears in your{' '}
                        <strong className="text-foreground">Joined Projects</strong>.
                    </p>
                </div>

                {inviteData?.role === 'viewer' && (
                    <div className="w-full rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground text-center">
                        <Eye className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                        As a Viewer you can see the project dashboard and details.
                        The project lead can upgrade your role at any time.
                    </div>
                )}

                <div className="flex flex-col gap-2 w-full">
                    <Button
                        className="w-full"
                        onClick={() =>
                            navigate(`/project/${inviteData?.projectId}/dashboard`)
                        }
                    >
                        <FolderKanban className="h-4 w-4 mr-2" />
                        Go to Project Dashboard
                    </Button>
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => navigate('/dashboard/projects')}
                    >
                        My Projects
                    </Button>
                </div>
            </FullPageCard>
        )
    }

    // ── need-auth step ────────────────────────────────────────────────────
    if (step === 'need-auth') {
        return (
            <FullPageCard>
                <ProjectPreviewHeader
                    project={projectData}
                    invite={inviteData}
                />
                <div className="w-full border-t pt-5 space-y-3">
                    <p className="text-sm text-center text-muted-foreground leading-relaxed">
                        Create an account or sign in to accept this invitation.
                        <br />
                        Your invitation will be waiting after you authenticate.
                    </p>
                    <Button
                        className="w-full"
                        onClick={() =>
                            navigate(
                                `/register?redirect=${encodeURIComponent(`/invite?token=${token}`)}`
                            )
                        }
                    >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Create Account &amp; Accept
                    </Button>
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={() =>
                            navigate(
                                `/login?redirect=${encodeURIComponent(`/invite?token=${token}`)}`
                            )
                        }
                    >
                        <LogIn className="h-4 w-4 mr-2" />
                        Sign In &amp; Accept
                    </Button>
                    <Button
                        variant="ghost"
                        className="w-full text-muted-foreground text-sm"
                        onClick={handleDecline}
                    >
                        Decline invitation
                    </Button>
                </div>
            </FullPageCard>
        )
    }

    // ── preview step (authenticated) ──────────────────────────────────────
    return (
        <FullPageCard>
            <ProjectPreviewHeader
                project={projectData}
                invite={inviteData}
            />
            <div className="w-full border-t pt-5 space-y-3">
                <p className="text-xs text-center text-muted-foreground">
                    Accepting as{' '}
                    <strong className="text-foreground">{user?.email}</strong>
                </p>
                <Button className="w-full" onClick={handleAccept}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Accept Invitation
                    <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button
                    variant="outline"
                    className="w-full text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
                    onClick={handleDecline}
                >
                    <XCircle className="h-4 w-4 mr-2" />
                    Decline
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                    Not you?{' '}
                    <Link
                        to={`/login?redirect=${encodeURIComponent(`/invite?token=${token}`)}`}
                        className="text-primary underline underline-offset-2"
                    >
                        Sign in with a different account
                    </Link>
                </p>
            </div>
        </FullPageCard>
    )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProjectPreviewHeader({
    project,
    invite,
}: {
    project: ProjectData | null
    invite:  InviteData  | null
}) {
    return (
        <div className="text-center w-full space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <FolderKanban className="h-8 w-8 text-primary" />
            </div>

            <div>
                <p className="text-sm text-muted-foreground">
                    You've been invited to join
                </p>
                <h2 className="text-2xl font-bold mt-1 leading-tight">
                    {project?.title ?? '…'}
                </h2>
            </div>

            {project?.summary && (
                <p className="text-sm text-muted-foreground line-clamp-2 max-w-xs mx-auto">
                    {project.summary}
                </p>
            )}

            <div className="flex items-center justify-center gap-2 flex-wrap">
                {invite?.role === 'viewer' ? (
                    <Badge
                        variant="secondary"
                        className="flex items-center gap-1.5 px-3 py-1"
                    >
                        <Eye className="h-3.5 w-3.5" />
                        Viewer — Dashboard &amp; details only
                    </Badge>
                ) : (
                    <Badge className="bg-green-100 text-green-700 border-none flex items-center gap-1.5 px-3 py-1">
                        <Users className="h-3.5 w-3.5" />
                        Team Member
                    </Badge>
                )}

                {project?.primaryDiscipline && (
                    <Badge variant="outline">{project.primaryDiscipline}</Badge>
                )}
            </div>

            {invite?.invitedByName && (
                <p className="text-xs text-muted-foreground">
                    Invited by{' '}
                    <strong className="text-foreground">
                        {invite.invitedByName}
                    </strong>
                </p>
            )}
        </div>
    )
}

function FullPageSpinner({ message }: { message: string }) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <FolderKanban className="h-8 w-8 text-primary" />
            </div>
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-muted-foreground text-sm">{message}</p>
        </div>
    )
}

function FullPageCard({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md shadow-xl border-border">
                <CardContent className="pt-8 pb-8 px-6 flex flex-col items-center gap-5">
                    {children}
                </CardContent>
            </Card>
        </div>
    )
}

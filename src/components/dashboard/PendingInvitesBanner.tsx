/**
 * PendingInvitesBanner
 *
 * Fetches invitations where `resolvedUserId === currentUser.uid` and status = 'pending',
 * then renders actionable Accept / Decline cards inline — no email required.
 *
 * Accept flow:
 *   1. Write to projects/{id}/members
 *   2. Update inviteTokens/{token} status → 'accepted'
 *   3. Update projects/{id}/invitations/{inviteId} status → 'accepted'
 *   4. Write to users/{uid}/joinedProjects/{projectId}
 *   5. Navigate to project dashboard
 *
 * Decline flow:
 *   1. Update both invitation docs status → 'declined'
 *   2. Remove card from UI
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    collection, collectionGroup, query, where, getDocs,
    doc, setDoc, updateDoc, serverTimestamp, writeBatch,
    increment, arrayUnion, getDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Users, Check, X, FolderKanban, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface PendingInvite {
    inviteId: string
    projectId: string
    projectTitle: string
    role: string
    invitedByName: string
    token: string
}

export function PendingInvitesBanner() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const { toast } = useToast()

    const [invites, setInvites] = useState<PendingInvite[]>([])
    const [loading, setLoading] = useState(true)
    const [processingId, setProcessingId] = useState<string | null>(null)

    useEffect(() => {
        if (!user) return

        const fetchPendingInvites = async () => {
            setLoading(true)
            try {
                // Query the global inviteTokens collection for this user's pending invites
                const q = query(
                    collection(db, 'inviteTokens'),
                    where('resolvedUserId', '==', user.uid),
                    where('status', '==', 'pending')
                )
                const snap = await getDocs(q)

                const found: PendingInvite[] = []
                snap.forEach(d => {
                    const data = d.data()
                    found.push({
                        inviteId: data.invitationDocId || d.id,
                        projectId: data.projectId,
                        projectTitle: data.projectTitle || 'a project',
                        role: data.role || 'member',
                        invitedByName: data.invitedByName || 'Someone',
                        token: d.id,
                    })
                })
                setInvites(found)
            } catch (err) {
                console.warn('[PendingInvitesBanner] fetch error:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchPendingInvites()
    }, [user])

    const handleAccept = async (invite: PendingInvite) => {
        if (!user) return
        setProcessingId(invite.token)
        try {
            // ── Guard check remains blocking (prevents duplicate membership) ──
            const memberSnap = await getDoc(doc(db, 'projects', invite.projectId, 'members', user.uid))
            if (memberSnap.exists()) {
                toast({ title: 'Already a member', description: 'You are already on this project.' })
                // Just clean up the invite
                await updateDoc(doc(db, 'inviteTokens', invite.token), { status: 'accepted' })
                setInvites(prev => prev.filter(i => i.token !== invite.token))
                navigate(`/project/${invite.projectId}/dashboard`)
                return
            }

            // ── Optimistic update: remove card immediately ────────────────────
            const previousInvites = invites
            setInvites(prev => prev.filter(i => i.token !== invite.token))

            const batch = writeBatch(db)

            // 1. Add to project members subcollection
            batch.set(doc(db, 'projects', invite.projectId, 'members', user.uid), {
                uid: user.uid,
                name: user.displayName || user.email || 'Member',
                email: user.email || '',
                avatar: user.photoURL || '',
                role: invite.role || 'member',
                joinedAt: serverTimestamp(),
                joinedVia: 'invitation',
                permissions: {
                    kanban: { read: true, write: true },
                    files: { read: true, write: false },
                    calendar: { read: true, write: false },
                    chat: { read: true, write: true },
                    whiteboard: { read: true, write: true },
                    budget: { read: false, write: false },
                    analytics: { read: false, write: false },
                    settings: { read: false, write: false },
                },
            })

            // 2. Update root project doc — add user to teamMembers map and members array
            batch.update(doc(db, 'projects', invite.projectId), {
                [`teamMembers.${user.uid}`]: {
                    role: invite.role || 'member',
                    joinedAt: serverTimestamp(),
                },
                members: arrayUnion(user.uid),
                currentMembers: increment(1),
            })

            // 3. Write to user's joinedProjects
            batch.set(doc(db, 'users', user.uid, 'joinedProjects', invite.projectId), {
                projectId: invite.projectId,
                role: invite.role || 'member',
                joinedAt: serverTimestamp(),
                joinedVia: 'invitation',
            })

            // 4. Update inviteToken status
            batch.update(doc(db, 'inviteTokens', invite.token), { status: 'accepted', acceptedAt: serverTimestamp() })

            // 5. Update the project's invitations subcollection doc
            if (invite.inviteId) {
                batch.update(doc(db, 'projects', invite.projectId, 'invitations', invite.inviteId), {
                    status: 'accepted',
                    acceptedAt: serverTimestamp(),
                })
            }

            try {
                await batch.commit()
                toast({ title: '🎉 Joined the team!', description: `You are now a member of "${invite.projectTitle}".`, variant: 'success' })
                navigate(`/project/${invite.projectId}/dashboard`)
            } catch (err) {
                // ── Rollback: restore card ────────────────────────────────────
                setInvites(previousInvites)
                console.error('[PendingInvitesBanner] accept error:', err)
                toast({ title: "Changes couldn't be saved.", description: 'Failed to join. Please try again.', variant: 'destructive' })
            }

        } catch (err) {
            console.error('[PendingInvitesBanner] accept guard error:', err)
            toast({ title: 'Failed to join', description: 'Something went wrong. Please try again.', variant: 'destructive' })
        } finally {
            setProcessingId(null)
        }
    }

    const handleDecline = async (invite: PendingInvite) => {
        if (!user) return
        setProcessingId(invite.token)

        // ── Optimistic update: remove card immediately ────────────────────────
        const previousInvites = invites
        setInvites(prev => prev.filter(i => i.token !== invite.token))

        try {
            const batch = writeBatch(db)
            batch.update(doc(db, 'inviteTokens', invite.token), { status: 'declined', declinedAt: serverTimestamp() })
            if (invite.inviteId) {
                batch.update(doc(db, 'projects', invite.projectId, 'invitations', invite.inviteId), {
                    status: 'declined',
                    declinedAt: serverTimestamp(),
                })
            }
            await batch.commit()
            toast({ title: 'Invitation declined', description: `You declined the invitation to "${invite.projectTitle}".` })
        } catch (err) {
            // ── Rollback: restore card ────────────────────────────────────────
            setInvites(previousInvites)
            console.error('[PendingInvitesBanner] decline error:', err)
            toast({ title: "Changes couldn't be saved.", description: 'Failed to decline invitation. Please try again.', variant: 'destructive' })
        } finally {
            setProcessingId(null)
        }
    }

    // Don't render during initial load or if there are no invites
    if (loading || invites.length === 0) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-6"
            >
                <div className="flex items-center gap-2 mb-3">
                    <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Pending Invitations
                    </h3>
                    <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-0">
                        {invites.length}
                    </Badge>
                </div>

                <div className="space-y-2.5">
                    <AnimatePresence>
                        {invites.map(invite => (
                            <motion.div
                                key={invite.token}
                                layout
                                initial={{ opacity: 0, scale: 0.97 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95, height: 0, marginBottom: 0 }}
                                transition={{ duration: 0.2 }}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30"
                            >
                                {/* Left: Info */}
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                    <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                                        <FolderKanban className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">
                                            {invite.invitedByName} invited you to join
                                        </p>
                                        <p className="text-sm text-indigo-700 dark:text-indigo-400 font-medium line-clamp-1">
                                            "{invite.projectTitle}"
                                        </p>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <Users className="h-3 w-3 text-gray-400" />
                                            <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                                                as {invite.role}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Actions */}
                                <div className="flex items-center gap-2 shrink-0">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={processingId === invite.token}
                                        onClick={() => handleDecline(invite)}
                                        className="h-8 text-xs border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                                    >
                                        {processingId === invite.token ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <>
                                                <X className="h-3.5 w-3.5 mr-1" />
                                                Decline
                                            </>
                                        )}
                                    </Button>
                                    <Button
                                        size="sm"
                                        disabled={processingId === invite.token}
                                        onClick={() => handleAccept(invite)}
                                        className="h-8 text-xs bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 border-0 text-white shadow-md shadow-indigo-500/20 rounded-lg"
                                    >
                                        {processingId === invite.token ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <>
                                                <Check className="h-3.5 w-3.5 mr-1" />
                                                Join Project
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </motion.div>
        </AnimatePresence>
    )
}

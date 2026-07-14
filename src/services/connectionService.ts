import {
    doc,
    getDoc,
    deleteDoc,
    writeBatch,
    serverTimestamp,
    collection,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { cachedGetDoc, clearCache } from '@/lib/queryUtils'
import {
    buildConnectionAcceptedNotif,
    buildConnectionRejectedNotif,
    buildConnectionWithdrawnNotif,
    buildConnectionRequestNotif,
    buildNotificationDoc,
} from '@/services/notificationService'
import {
    sendNotificationWithPush,
} from '@/services/notificationTrigger'
import { trackConnectionSent, trackConnectionAccepted } from '@/services/analyticsService'

// ─── Status check ────────────────────────────────────────────────────────────

export async function hasOutgoingRequestTo(
    myUid: string,
    targetUserId: string
): Promise<boolean> {
    const ref = doc(db, 'users', targetUserId, 'connectionRequests', myUid)
    const snap = await getDoc(ref)
    return snap.exists()
}

export async function getConnectionStatus(
    myUid: string,
    otherUid: string
): Promise<'none' | 'pending_out' | 'pending_in' | 'connected'> {
    // ── FIX: Run all 3 reads in parallel instead of sequentially ──
    // Before: 3 sequential round-trips (~300-600ms total)
    // After:  3 concurrent round-trips (~100-200ms total)
    // Plus: 30s cachedGetDoc TTL so rapid re-calls (onSnapshot callbacks) are free
    const TTL = 30_000
    const [friendSnap, outSnap, inSnap] = await Promise.all([
        cachedGetDoc(doc(db, 'users', myUid, 'friends', otherUid), { ttl: TTL }),
        cachedGetDoc(doc(db, 'users', otherUid, 'connectionRequests', myUid), { ttl: TTL }),
        cachedGetDoc(doc(db, 'users', myUid, 'connectionRequests', otherUid), { ttl: TTL }),
    ])

    if (friendSnap.exists()) return 'connected'
    if (outSnap.exists())    return 'pending_out'
    if (inSnap.exists())     return 'pending_in'
    return 'none'
}

/**
 * Bust cached connection-related docs for two users.
 * Call this after any write that changes connection state.
 */
function bustConnectionCache(uidA: string, uidB: string) {
    clearCache(uidA)
    clearCache(uidB)
}

// ─── Send ─────────────────────────────────────────────────────────────────────

export async function sendConnectionRequest(
    senderUid: string,
    targetUid: string,
    message?: string
): Promise<void> {
    // Guard: already connected or pending
    const status = await getConnectionStatus(senderUid, targetUid)
    if (status !== 'none') return

    const senderDoc = await getDoc(doc(db, 'users', senderUid))
    const senderData = senderDoc.data()
    const senderName = senderData
        ? `${senderData.firstName || ''} ${senderData.lastName || ''}`.trim() ||
          senderData.email
        : 'Someone'

    const batch = writeBatch(db)

    // Write connectionRequest doc under TARGET's sub-collection
    // Doc ID = senderUid so we can always look it up directionally
    batch.set(
        doc(db, 'users', targetUid, 'connectionRequests', senderUid),
        {
            from: senderUid,
            fromName: senderName,
            fromEmail: senderData?.email ?? '',
            sentAt: serverTimestamp(),
            status: 'pending',
            ...(message ? { message } : {}),
        }
    )

    // ⚡ FIX: Also mirror into sender's /sentRequests/{targetUid} for
    // efficient outgoing-status lookup (one query vs N individual getDoc reads)
    batch.set(
        doc(db, 'users', senderUid, 'sentRequests', targetUid),
        {
            to: targetUid,
            sentAt: serverTimestamp(),
            status: 'pending',
            ...(message ? { message } : {}),
        }
    )

    await batch.commit()

    // Track analytics
    trackConnectionSent(senderUid, targetUid)

    // ✅ Send in-app + push notification
    await sendNotificationWithPush(
        targetUid,
        buildConnectionRequestNotif(senderName, senderUid, senderData?.photoURL ?? null)
    )
}

export async function updateConnectionRequestNote(
    senderUid: string,
    targetUid: string,
    message: string
): Promise<void> {
    const batch = writeBatch(db)
    batch.update(
        doc(db, 'users', targetUid, 'connectionRequests', senderUid),
        { message }
    )
    batch.update(
        doc(db, 'users', senderUid, 'sentRequests', targetUid),
        { message }
    )
    await batch.commit()
}

// ─── Accept ───────────────────────────────────────────────────────────────────

export async function acceptConnectionRequest(
    receiverUid: string,
    senderUid: string
): Promise<void> {
    const requestRef = doc(
        db, 'users', receiverUid, 'connectionRequests', senderUid
    )
    const requestSnap = await getDoc(requestRef)
    if (!requestSnap.exists()) return

    const data = requestSnap.data()
    const fromName = (data.fromName as string) || 'Someone'

    const receiverDoc = await getDoc(doc(db, 'users', receiverUid))
    const receiverData = receiverDoc.data()
    const receiverName = receiverData
        ? `${receiverData.firstName || ''} ${receiverData.lastName || ''}`.trim() ||
          receiverData.email
        : 'Someone'

    const batch = writeBatch(db)

    // ✅ Write to BOTH sides' friends sub-collections
    batch.set(doc(db, 'users', receiverUid, 'friends', senderUid), {
        userId: senderUid,
        name: fromName,
        addedAt: serverTimestamp(),
        status: 'active',
    })
    batch.set(doc(db, 'users', senderUid, 'friends', receiverUid), {
        userId: receiverUid,
        name: receiverName,
        addedAt: serverTimestamp(),
        status: 'active',
    })

    // ✅ Delete the connectionRequest doc
    batch.delete(requestRef)

    // ⚡ FIX: Clean up the sender's sentRequests mirror on accept
    batch.delete(doc(db, 'users', senderUid, 'sentRequests', receiverUid))

    await batch.commit()

    // Bust stale cached reads so UI updates immediately
    bustConnectionCache(receiverUid, senderUid)

    // Track analytics
    trackConnectionAccepted(receiverUid, senderUid)

    // ✅ Send in-app + push notification to sender
    await sendNotificationWithPush(
        senderUid,
        buildConnectionAcceptedNotif(
            receiverName,
            receiverUid,
            receiverData?.photoURL ?? null
        )
    )
}

// ─── Reject ───────────────────────────────────────────────────────────────────

export async function rejectConnectionRequest(
    receiverUid: string,
    senderUid: string
): Promise<void> {
    const requestRef = doc(
        db, 'users', receiverUid, 'connectionRequests', senderUid
    )
    const requestSnap = await getDoc(requestRef)
    if (!requestSnap.exists()) return

    const receiverDoc = await getDoc(doc(db, 'users', receiverUid))
    const receiverData = receiverDoc.data()
    const receiverName = receiverData
        ? `${receiverData.firstName || ''} ${receiverData.lastName || ''}`.trim() ||
          receiverData.email
        : 'Someone'

    const batch = writeBatch(db)
    batch.delete(requestRef)
    // ⚡ FIX: Clean up the sender's sentRequests mirror on reject
    batch.delete(doc(db, 'users', senderUid, 'sentRequests', receiverUid))
    await batch.commit()

    // Bust stale cached reads so UI updates immediately
    bustConnectionCache(receiverUid, senderUid)

    // ✅ Send in-app + push notification to sender
    await sendNotificationWithPush(
        senderUid,
        buildConnectionRejectedNotif(receiverName, receiverUid)
    )
}

// ─── Withdraw ─────────────────────────────────────────────────────────────────

export async function withdrawConnectionRequest(
    senderUid: string,
    targetUserId: string
): Promise<void> {
    const ref = doc(
        db, 'users', targetUserId, 'connectionRequests', senderUid
    )
    const snap = await getDoc(ref)
    if (!snap.exists()) return

    const senderDoc = await getDoc(doc(db, 'users', senderUid))
    const senderData = senderDoc.data()
    const senderName = senderData
        ? `${senderData.firstName || ''} ${senderData.lastName || ''}`.trim() ||
          senderData.email
        : 'Someone'

    const batch = writeBatch(db)
    batch.delete(ref)
    // ⚡ FIX: Clean up the sender's sentRequests mirror on withdraw
    batch.delete(doc(db, 'users', senderUid, 'sentRequests', targetUserId))
    await batch.commit()

    // Bust stale cached reads so UI updates immediately
    bustConnectionCache(senderUid, targetUserId)

    // ✅ Send in-app + push notification to target
    await sendNotificationWithPush(
        targetUserId,
        buildConnectionWithdrawnNotif(senderName, senderUid)
    )
}

// ─── Remove connection (unfriend) ─────────────────────────────────────────────

export async function removeConnection(
    myUid: string,
    otherUid: string
): Promise<void> {
    const batch = writeBatch(db)
    batch.delete(doc(db, 'users', myUid, 'friends', otherUid))
    batch.delete(doc(db, 'users', otherUid, 'friends', myUid))
    await batch.commit()
}
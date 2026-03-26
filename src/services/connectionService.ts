import {
    doc,
    getDoc,
    deleteDoc,
    writeBatch,
    serverTimestamp,
    collection,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
    buildNotificationDoc,
    buildConnectionAcceptedNotif,
    buildConnectionRejectedNotif,
    buildConnectionWithdrawnNotif,
    buildConnectionRequestNotif,  // ← we add this below
} from '@/services/notificationService'

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
    // 1. Check friends (both sides should have it, check mine)
    const friendSnap = await getDoc(doc(db, 'users', myUid, 'friends', otherUid))
    if (friendSnap.exists()) return 'connected'

    // 2. Check if I sent a request to them
    const outSnap = await getDoc(
        doc(db, 'users', otherUid, 'connectionRequests', myUid)
    )
    if (outSnap.exists()) return 'pending_out'

    // 3. Check if they sent a request to me
    const inSnap = await getDoc(
        doc(db, 'users', myUid, 'connectionRequests', otherUid)
    )
    if (inSnap.exists()) return 'pending_in'

    return 'none'
}

// ─── Send ─────────────────────────────────────────────────────────────────────

export async function sendConnectionRequest(
    senderUid: string,
    targetUid: string
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
        }
    )

    // Notify target using unified service
    buildNotificationDoc(
        batch,
        targetUid,
        buildConnectionRequestNotif(senderName, senderUid, senderData?.photoURL ?? null)
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

    // ✅ Notify sender
    buildNotificationDoc(
        batch,
        senderUid,
        buildConnectionAcceptedNotif(
            receiverName,
            receiverUid,
            receiverData?.photoURL ?? null
        )
    )

    await batch.commit()
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

    buildNotificationDoc(
        batch,
        senderUid,
        buildConnectionRejectedNotif(receiverName, receiverUid)
    )

    await batch.commit()
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

    buildNotificationDoc(
        batch,
        targetUserId,
        buildConnectionWithdrawnNotif(senderName, senderUid)
    )

    await batch.commit()
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
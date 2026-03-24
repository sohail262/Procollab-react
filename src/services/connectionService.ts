import {
    doc,
    getDoc,
    deleteDoc,
    setDoc,
    addDoc,
    collection,
    writeBatch,
    serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

/**
 * Outgoing request (I sent to them): users/{theirUid}/connectionRequests/{myUid}
 * Incoming (they sent to me): users/{myUid}/connectionRequests/{theirUid}
 */

export async function hasOutgoingRequestTo(
    myUid: string,
    targetUserId: string
): Promise<boolean> {
    const ref = doc(db, 'users', targetUserId, 'connectionRequests', myUid)
    const snap = await getDoc(ref)
    return snap.exists()
}

export async function acceptConnectionRequest(
    receiverUid: string,
    senderUid: string
): Promise<void> {
    const batch = writeBatch(db)

    const requestRef = doc(db, 'users', receiverUid, 'connectionRequests', senderUid)
    const requestSnap = await getDoc(requestRef)
    if (!requestSnap.exists()) return

    const data = requestSnap.data()
    const fromName = (data.fromName as string) || 'Someone'

    const currentUserDoc = await getDoc(doc(db, 'users', receiverUid))
    const currentUserData = currentUserDoc.data()
    const currentUserName = currentUserData
        ? `${currentUserData.firstName || ''} ${currentUserData.lastName || ''}`.trim() || currentUserData.email
        : 'Someone'

    const currentUserFriendRef = doc(db, 'users', receiverUid, 'friends', senderUid)
    batch.set(currentUserFriendRef, {
        userId: senderUid,
        name: fromName,
        addedAt: serverTimestamp(),
        status: 'active',
    })

    const otherUserFriendRef = doc(db, 'users', senderUid, 'friends', receiverUid)
    batch.set(otherUserFriendRef, {
        userId: receiverUid,
        name: currentUserName,
        addedAt: serverTimestamp(),
        status: 'active',
    })

    batch.delete(requestRef)

    const notificationRef = doc(collection(db, 'users', senderUid, 'notifications'))
    batch.set(notificationRef, {
        title: 'Connection Accepted',
        body: `${currentUserName} accepted your connection request!`,
        icon: currentUserData?.photoURL || null,
        url: `/profile/${receiverUid}`,
        timestamp: serverTimestamp(),
        read: false,
        type: 'connection_accepted',
    })

    await batch.commit()
}

export async function rejectConnectionRequest(
    receiverUid: string,
    senderUid: string
): Promise<void> {
    const currentUserDoc = await getDoc(doc(db, 'users', receiverUid))
    const currentUserData = currentUserDoc.data()
    const currentUserName = currentUserData
        ? `${currentUserData.firstName || ''} ${currentUserData.lastName || ''}`.trim() || currentUserData.email
        : 'Someone'

    await deleteDoc(doc(db, 'users', receiverUid, 'connectionRequests', senderUid))

    await setDoc(doc(collection(db, 'users', senderUid, 'notifications')), {
        title: 'Connection Request Declined',
        body: `${currentUserName} declined your connection request.`,
        timestamp: serverTimestamp(),
        read: false,
        type: 'connection_rejected',
    })
}

/** Remove outgoing request: users/{targetUserId}/connectionRequests/{senderUid} */
export async function withdrawConnectionRequest(
    senderUid: string,
    targetUserId: string
): Promise<void> {
    const ref = doc(db, 'users', targetUserId, 'connectionRequests', senderUid)
    const snap = await getDoc(ref)
    if (!snap.exists()) return

    await deleteDoc(ref)

    await addDoc(collection(db, 'users', targetUserId, 'notifications'), {
        title: 'Connection request withdrawn',
        body: 'A user withdrew their connection request.',
        timestamp: serverTimestamp(),
        read: false,
        type: 'connection_withdrawn',
    })
}

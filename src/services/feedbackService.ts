import { 
    collection, 
    addDoc, 
    getDocs, 
    doc, 
    updateDoc, 
    query, 
    orderBy, 
    where, 
    serverTimestamp,
    deleteDoc
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import { sendNotificationToManyWithPush } from '@/services/notificationTrigger'

export interface FeedbackData {
    id?: string
    type: 'bug' | 'feedback' | 'feature_request'
    message: string
    screenshotURL?: string
    submittedBy: string // uid or 'anonymous'
    submittedByName: string
    submittedByEmail: string
    createdAt: any
    resolved: boolean
    resolvedAt?: any
    resolvedBy?: string
}

/**
 * Notify all admins of a new feedback/bug report
 */
async function notifyAdminsOfFeedback(type: string, message: string) {
    try {
        const usersRef = collection(db, 'users')
        const q = query(usersRef, where('role', '==', 'admin'))
        const snap = await getDocs(q)
        const adminUids = snap.docs.map(doc => doc.id)

        if (adminUids.length > 0) {
            await sendNotificationToManyWithPush(adminUids, {
                title: type === 'bug' ? '🚨 New Bug Reported' : '💬 New Feedback Received',
                body: `"${message.substring(0, 60)}${message.length > 60 ? '...' : ''}"`,
                type: type === 'bug' ? 'warning' : 'info',
                url: '/admin?tab=feedback',
            })
        }
    } catch (err) {
        console.error('Error notifying admins:', err)
    }
}

/**
 * Submit feedback or bug report
 */
export async function submitFeedback(
    type: 'bug' | 'feedback' | 'feature_request',
    message: string,
    screenshotFile: File | null,
    user: { uid: string; displayName?: string | null; email?: string | null } | null,
    isAnonymous: boolean
): Promise<void> {
    let screenshotURL = ''

    // 1. Upload screenshot if exists
    if (screenshotFile && user) {
        const fileExtension = screenshotFile.name.split('.').pop()
        const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExtension}`
        const storageRef = ref(storage, `users/${user.uid}/feedbacks/${uniqueFileName}`)
        const uploadResult = await uploadBytes(storageRef, screenshotFile)
        screenshotURL = await getDownloadURL(uploadResult.ref)
    }

    // 2. Prepare user details
    const submittedBy = isAnonymous || !user ? 'anonymous' : user.uid
    const submittedByName = isAnonymous || !user ? 'Anonymous' : (user.displayName || 'User')
    const submittedByEmail = isAnonymous || !user ? '' : (user.email || '')

    // 3. Write feedback to Firestore
    await addDoc(collection(db, 'feedbacks'), {
        type,
        message,
        screenshotURL,
        submittedBy,
        submittedByName,
        submittedByEmail,
        createdAt: serverTimestamp(),
        resolved: false,
    })

    // 4. Send background notification to Admins
    // We don't await this so user submission is not delayed
    notifyAdminsOfFeedback(type, message)
}

/**
 * Load all feedbacks for Admin view
 */
export async function loadFeedbacks(): Promise<FeedbackData[]> {
    const feedbackRef = collection(db, 'feedbacks')
    const q = query(feedbackRef, orderBy('createdAt', 'desc'))
    const snap = await getDocs(q)
    return snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    })) as FeedbackData[]
}

/**
 * Mark a feedback as resolved/dismissed
 */
export async function resolveFeedback(feedbackId: string, adminUid: string, resolvedState: boolean = true): Promise<void> {
    const ref = doc(db, 'feedbacks', feedbackId)
    await updateDoc(ref, {
        resolved: resolvedState,
        resolvedAt: serverTimestamp(),
        resolvedBy: adminUid,
    })
}

/**
 * Delete feedback report and its associated screenshot from storage
 */
export async function deleteFeedback(feedbackId: string, screenshotURL?: string): Promise<void> {
    // 1. Delete screenshot from Firebase Storage if URL exists
    if (screenshotURL) {
        try {
            const imageRef = ref(storage, screenshotURL)
            await deleteObject(imageRef)
            console.log('[FeedbackService] Screenshot deleted successfully')
        } catch (storageError) {
            console.warn('[FeedbackService] Failed to delete screenshot from storage (might already be deleted):', storageError)
        }
    }

    // 2. Delete Firestore document
    const feedbackRef = doc(db, 'feedbacks', feedbackId)
    await deleteDoc(feedbackRef)
}

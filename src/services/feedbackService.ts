import { 
    collection, 
    addDoc, 
    getDocs, 
    getDoc,
    doc, 
    updateDoc, 
    query, 
    orderBy, 
    where, 
    serverTimestamp,
    deleteDoc,
    writeBatch
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import { sendNotificationToManyWithPush, sendNotificationWithPush } from '@/services/notificationTrigger'

export interface FeedbackData {
    id?: string
    type: 'bug' | 'feedback' | 'feature_request'
    message: string
    screenshotURL?: string
    submittedBy: string // uid or 'anonymous'
    submittedByName: string
    submittedByEmail: string
    submittedByUid?: string // Always stores user UID if logged in, even if anonymous
    createdAt: any
    resolved: boolean
    resolvedAt?: any
    resolvedBy?: string
    adminReply?: string
    repliedAt?: any
    repliedBy?: string
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
    const submittedByUid = user ? user.uid : 'anonymous'

    // 3. Write feedback to Firestore
    await addDoc(collection(db, 'feedbacks'), {
        type,
        message,
        screenshotURL,
        submittedBy,
        submittedByName,
        submittedByEmail,
        submittedByUid,
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
 * Mark a feedback as resolved/dismissed and notify the user
 */
export async function resolveFeedback(
    feedbackOrId: FeedbackData | string,
    adminUid: string,
    resolvedState: boolean = true
): Promise<void> {
    let feedback: FeedbackData
    if (typeof feedbackOrId === 'string') {
        const feedbackRef = doc(db, 'feedbacks', feedbackOrId)
        const snap = await getDoc(feedbackRef)
        if (!snap.exists()) {
            throw new Error('Feedback not found')
        }
        feedback = { id: snap.id, ...snap.data() } as FeedbackData
    } else {
        feedback = feedbackOrId
    }

    if (!feedback.id) return

    // 1. Update document in Firestore
    const ref = doc(db, 'feedbacks', feedback.id)
    await updateDoc(ref, {
        resolved: resolvedState,
        resolvedAt: serverTimestamp(),
        resolvedBy: adminUid,
    })

    // 2. If resolving, notify the submitter (including anonymous users via submittedByUid)
    if (resolvedState) {
        const targetUid = feedback.submittedByUid || feedback.submittedBy
        if (targetUid && targetUid !== 'anonymous') {
            let notifTitle = '💬 Feedback Reviewed'
            let notifBody = 'Thank you for sharing your feedback! We have reviewed it and appreciate you taking the time to help us improve the platform.'
            let notifType: 'info' | 'success' | 'warning' = 'info'

            if (feedback.type === 'bug') {
                notifTitle = '🚨 Bug Report Resolved'
                notifBody = 'Thanks for reporting this bug! We have resolved the issue. Let us know if you run into anything else.'
                notifType = 'success'
            } else if (feedback.type === 'feature_request') {
                notifTitle = '💡 Feature Suggestion Reviewed'
                notifBody = 'Thanks for this feature suggestion! We have reviewed your idea and appreciate your input on how to improve the platform.'
                notifType = 'success'
            }

            try {
                await sendNotificationWithPush(targetUid, {
                    title: notifTitle,
                    body: notifBody,
                    type: notifType,
                    url: '/feedback',
                })
            } catch (err) {
                console.warn('Failed to send resolve notification:', err)
            }
        }
    }
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

/**
 * Send a reply to feedback and notify the user
 */
export async function replyToFeedback(
    feedback: FeedbackData,
    replyMessage: string,
    adminUid: string,
    markAsResolved: boolean = false
): Promise<void> {
    const targetUid = feedback.submittedByUid || feedback.submittedBy
    if (!feedback.id || !targetUid || targetUid === 'anonymous') {
        throw new Error('Cannot reply to anonymous submissions with no user ID')
    }

    // 1. Update the Firestore document with the reply details
    const feedbackRef = doc(db, 'feedbacks', feedback.id)
    const updateData: any = {
        adminReply: replyMessage,
        repliedAt: serverTimestamp(),
        repliedBy: adminUid,
    }
    if (markAsResolved) {
        updateData.resolved = true
        updateData.resolvedAt = serverTimestamp()
        updateData.resolvedBy = adminUid
    }
    await updateDoc(feedbackRef, updateData)

    // 2. Format title and type based on feedback type
    let notifTitle = markAsResolved ? '💬 Feedback Reviewed' : '💬 Feedback Response'
    let notifType: 'info' | 'success' | 'warning' = 'info'
    
    if (feedback.type === 'bug') {
        notifTitle = markAsResolved ? '🚨 Bug Report Resolved' : '🚨 Bug Report Response'
        notifType = 'success'
    } else if (feedback.type === 'feature_request') {
        notifTitle = markAsResolved ? '💡 Feature Suggestion Reviewed' : '💡 Feature Request Response'
        notifType = 'success'
    }

    // 3. Trigger the notification
    await sendNotificationWithPush(targetUid, {
        title: notifTitle,
        body: replyMessage,
        type: notifType,
        url: '/feedback',
    })
}

/**
 * Send a reply to MULTIPLE feedbacks (sharing the same message) and notify all users via a single multicast push.
 */
export async function replyToFeedbackGroup(
    feedbacks: FeedbackData[],
    replyMessage: string,
    adminUid: string,
    markAsResolved: boolean = false
): Promise<void> {
    if (feedbacks.length === 0) return

    // 1. Prepare batch write for Firestore
    const batch = writeBatch(db)

    // Update each feedback document in the batch
    feedbacks.forEach((feedback) => {
        if (!feedback.id) return
        const feedbackRef = doc(db, 'feedbacks', feedback.id)
        const updateData: any = {
            adminReply: replyMessage,
            repliedAt: serverTimestamp(),
            repliedBy: adminUid,
        }
        if (markAsResolved) {
            updateData.resolved = true
            updateData.resolvedAt = serverTimestamp()
            updateData.resolvedBy = adminUid
        }
        batch.update(feedbackRef, updateData)
    })

    // Commit the updates
    await batch.commit()

    // 2. Gather all recipient user UIDs (excluding anonymous guest submissions)
    const recipientUserIds = feedbacks
        .map((f) => f.submittedByUid || f.submittedBy)
        .filter((uid): uid is string => !!uid && uid !== 'anonymous')

    // 3. Send multicast notifications if there are valid users
    if (recipientUserIds.length > 0) {
        let notifTitle = markAsResolved ? '💬 Feedback Reviewed' : '💬 Feedback Response'
        let notifType: 'info' | 'success' | 'warning' = 'info'
        
        // Use type of first item as representative
        const type = feedbacks[0].type
        if (type === 'bug') {
            notifTitle = markAsResolved ? '🚨 Bug Report Resolved' : '🚨 Bug Report Response'
            notifType = 'success'
        } else if (type === 'feature_request') {
            notifTitle = markAsResolved ? '💡 Feature Suggestion Reviewed' : '💡 Feature Request Response'
            notifType = 'success'
        }

        try {
            await sendNotificationToManyWithPush(recipientUserIds, {
                title: notifTitle,
                body: replyMessage,
                type: notifType,
                url: '/feedback',
            })
        } catch (err) {
            console.warn('Failed to send group multicast notification:', err)
        }
    }
}

import { collection, getDocs, writeBatch, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { generateDefaultUsername, isUsernameTaken, generateUniqueProjectSlug } from '@/lib/urlUtils'

export interface MigrationProgress {
    usersChecked: number
    usersUpdated: number
    projectsChecked: number
    projectsUpdated: number
}

/**
 * Iterates through all users and projects in Firestore to populate missing 
 * usernames, slugs, and privacy settings with default values.
 */
export async function runSchemaMigration(): Promise<MigrationProgress> {
    const progress: MigrationProgress = {
        usersChecked: 0,
        usersUpdated: 0,
        projectsChecked: 0,
        projectsUpdated: 0
    }

    // 1. Migrate Users
    const usersCol = collection(db, 'users')
    const usersSnapshot = await getDocs(usersCol)
    progress.usersChecked = usersSnapshot.size

    let userBatch = writeBatch(db)
    let userBatchCount = 0

    for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data()
        let needsUpdate = false
        const updates: any = {}

        if (!userData.username) {
            const firstName = userData.firstName || userData.displayName?.split(' ')[0] || ''
            const lastName = userData.lastName || userData.displayName?.split(' ')[1] || ''
            const email = userData.email || ''
            
            let baseUsername = generateDefaultUsername(firstName, lastName, email)
            
            // Verify and ensure uniqueness
            let isTaken = await isUsernameTaken(baseUsername, userDoc.id)
            let retries = 0
            while (isTaken && retries < 15) {
                baseUsername = generateDefaultUsername(firstName, lastName, email)
                isTaken = await isUsernameTaken(baseUsername, userDoc.id)
                retries++
            }
            
            updates.username = baseUsername
            needsUpdate = true
        }

        if (!userData.profileVisibility) {
            updates.profileVisibility = 'public'
            needsUpdate = true
        }

        if (needsUpdate) {
            userBatch.update(doc(db, 'users', userDoc.id), updates)
            userBatchCount++
            progress.usersUpdated++

            // Firestore batch limit is 500 operations
            if (userBatchCount >= 450) {
                await userBatch.commit()
                userBatch = writeBatch(db)
                userBatchCount = 0
            }
        }
    }

    if (userBatchCount > 0) {
        await userBatch.commit()
    }

    // 2. Migrate Projects
    const projectsCol = collection(db, 'projects')
    const projectsSnapshot = await getDocs(projectsCol)
    progress.projectsChecked = projectsSnapshot.size

    let projectBatch = writeBatch(db)
    let projectBatchCount = 0

    for (const projectDoc of projectsSnapshot.docs) {
        const projectData = projectDoc.data()
        let needsUpdate = false
        const updates: any = {}

        if (!projectData.slug) {
            const title = projectData.title || 'untitled-project'
            const slug = await generateUniqueProjectSlug(title, projectDoc.id)
            updates.slug = slug
            needsUpdate = true
        }

        if (!projectData.projectVisibility) {
            updates.projectVisibility = 'public'
            needsUpdate = true
        }

        if (needsUpdate) {
            projectBatch.update(doc(db, 'projects', projectDoc.id), updates)
            projectBatchCount++
            progress.projectsUpdated++

            if (projectBatchCount >= 450) {
                await projectBatch.commit()
                projectBatch = writeBatch(db)
                projectBatchCount = 0
            }
        }
    }

    if (projectBatchCount > 0) {
        await projectBatch.commit()
    }

    return progress
}

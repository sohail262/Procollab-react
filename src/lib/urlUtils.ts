import { collection, query, where, getDocs, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase'

/**
 * Converts a text string (e.g. project title) into a URL-friendly slug.
 */
export function slugify(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // remove non-word, non-space, non-hyphen chars
        .replace(/[\s_]+/g, '-')   // replace spaces and underscores with a single hyphen
        .replace(/-+/g, '-')       // replace multiple hyphens with a single hyphen
        .replace(/^-+|-+$/g, '')   // trim hyphens from ends
}

/**
 * Generates a default username base based on first name, last name, or email.
 */
export function generateDefaultUsername(firstName: string, lastName: string, email?: string): string {
    let base = ''
    if (firstName || lastName) {
        base = `${firstName || ''}_${lastName || ''}`
    } else if (email) {
        base = email.split('@')[0]
    } else {
        base = 'user'
    }
    
    // Clean base: only lowercase alphanumeric, underscore, hyphen
    const cleanBase = base
        .toLowerCase()
        .replace(/[^\w-]/g, '') // strip special characters
        .replace(/_+/g, '_')
        .substring(0, 20)
    
    const randomSuffix = Math.floor(1000 + Math.random() * 9000) // 4 digits
    return `${cleanBase || 'user'}_${randomSuffix}`
}

/**
 * Checks if a username is already taken by another user.
 */
export async function isUsernameTaken(username: string, currentUid?: string): Promise<boolean> {
    const cleanUsername = username.toLowerCase().trim()
    if (!cleanUsername) return true

    const q = query(
        collection(db, 'users'),
        where('username', '==', cleanUsername),
        limit(1)
    )
    const querySnapshot = await getDocs(q)
    if (querySnapshot.empty) return false

    const doc = querySnapshot.docs[0]
    if (currentUid && doc.id === currentUid) return false

    return true
}

/**
 * Checks if a project slug is already taken by another project.
 */
export async function isProjectSlugTaken(slug: string, currentProjectId?: string): Promise<boolean> {
    const cleanSlug = slug.toLowerCase().trim()
    if (!cleanSlug) return true

    const q = query(
        collection(db, 'projects'),
        where('slug', '==', cleanSlug),
        limit(1)
    )
    const querySnapshot = await getDocs(q)
    if (querySnapshot.empty) return false

    const doc = querySnapshot.docs[0]
    if (currentProjectId && doc.id === currentProjectId) return false

    return true
}

/**
 * Generates a unique project slug. Appends a short suffix if the primary slug is taken.
 */
export async function generateUniqueProjectSlug(title: string, currentProjectId?: string): Promise<string> {
    const primarySlug = slugify(title)
    const taken = await isProjectSlugTaken(primarySlug, currentProjectId)
    if (!taken) return primarySlug

    const randomSuffix = Math.random().toString(36).substring(2, 7) // 5 chars
    return `${primarySlug}-${randomSuffix}`
}

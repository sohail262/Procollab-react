// Firebase configuration
import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getDatabase } from 'firebase/database'
import { getAnalytics, isSupported } from 'firebase/analytics'

// Validate required environment variables
const requiredEnvVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID'
]

for (const envVar of requiredEnvVars) {
    if (!import.meta.env[envVar] && !firebaseConfig[envVar.replace('VITE_FIREBASE_', '').toLowerCase() as keyof typeof firebaseConfig]) {
        console.warn(`Missing environment variable: ${envVar}`)
    }
}

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDBUImEHJh2V_kblqlOVgKICjUP_P02gcc',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'projectmap-f1155.firebaseapp.com',
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://projectmap-f1155-default-rtdb.firebaseio.com',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'projectmap-f1155',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'projectmap-f1155.firebasestorage.app',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '907011304023',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:907011304023:web:3b0a3b22b6ace96fdc9112',
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-45SKG36DW1'
}

// ✅ Prevent duplicate app initialization (important for FCM)
const app = getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApp()

// Initialize Firebase services
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export const database = getDatabase(app)

// ✅ P1 FIX: Enable Firestore offline persistence via IndexedDB.
//
// What this does:
//   Every document read from Firestore is automatically persisted to the browser's
//   IndexedDB. On subsequent page loads, reads are served from the local cache
//   first (sub-millisecond) and then updated in the background if the server has
//   newer data. This eliminates cold-start Firestore reads for returning users.
//
// Expected impact:
//   - Dashboard: saves ~6–8 Firestore reads per revisit (all cached data served locally)
//   - Profile:   saves ~3–5 reads (user doc, projects, friends)
//   - First load:  data appears instantly from cache; server syncs silently
//   - Offline:    app remains fully readable (no hard error on network loss)
//
// Error handling:
//   - failed-precondition: another tab is open in the same browser session.
//     Firestore only allows one "primary" tab for IndexedDB at a time.
//     We fall back gracefully — the session still works, just without persistence.
//   - unimplemented: browser does not support IndexedDB (e.g., private/incognito
//     mode in Firefox). Again, graceful fallback — no persistence, no crash.
enableIndexedDbPersistence(db).catch(err => {
    if (err.code === 'failed-precondition') {
        // Multiple tabs open — only the first tab gets persistence.
        // Subsequent tabs still work normally, just without offline cache.
        console.warn('[Firebase] Offline persistence unavailable (multiple tabs open).')
    } else if (err.code === 'unimplemented') {
        // Browser does not support IndexedDB (e.g., Firefox private mode).
        console.warn('[Firebase] Offline persistence not supported in this browser.')
    } else {
        console.error('[Firebase] enableIndexedDbPersistence error:', err)
    }
})

// ✅ Export app — required by fcmService.ts for getMessaging(app)
export { app }

// ✅ Initialize Analytics (only in browser environments that support it)
export let analytics: ReturnType<typeof getAnalytics> | null = null
isSupported().then(supported => {
    if (supported) analytics = getAnalytics(app)
}).catch(() => { /* silently skip if analytics not supported */ })

export default app
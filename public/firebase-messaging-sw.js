/**
 * Firebase Messaging Service Worker
 *
 * DUPLICATE PREVENTION:
 * - App FOREGROUND → onMessage() in fcmService.ts handles it
 *   → Shows in-app toast only, NO browser push shown
 * - App BACKGROUND/CLOSED → This SW handles it
 *   → Shows ONE browser push notification
 *
 * CONFIG NOTE:
 * Service Workers run outside Vite's build pipeline.
 * VITE_* env vars are NOT available here.
 * We hardcode the Firebase config (it's public/client-side safe).
 */

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

// ✅ Hardcoded — SW cannot access Vite env vars
// These are PUBLIC client-side keys, safe to include here
firebase.initializeApp({
    apiKey: 'AIzaSyDBUImEHJh2V_kblqlOVgKICjUP_P02gcc',
    authDomain: 'projectmap-f1155.firebaseapp.com',
    databaseURL: 'https://projectmap-f1155-default-rtdb.firebaseio.com',
    projectId: 'projectmap-f1155',
    storageBucket: 'projectmap-f1155.firebasestorage.app',
    messagingSenderId: '907011304023',
    appId: '1:907011304023:web:3b0a3b22b6ace96fdc9112',
    measurementId: 'G-45SKG36DW1',
})

const messaging = firebase.messaging()

// ─── Background message handler ──────────────────────────
// Fires ONLY when app is in background or closed.
// FCM automatically suppresses this when app is in foreground
// and delivers to onMessage() instead — preventing duplicates.
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background message received:', payload)

    const notificationId =
        payload.data?.notificationId ||
        payload.data?.firestoreId ||
        `fcm-${Date.now()}`

    const notificationTitle =
        payload.notification?.title ||
        payload.data?.title ||
        'ProCollab'

    const notificationBody =
        payload.notification?.body ||
        payload.data?.body ||
        'You have a new notification'

    const type = payload.data?.type || 'info'
    let actions = [
        { action: 'view', title: 'Open' },
        { action: 'dismiss', title: 'Dismiss' },
    ]

    if (type === 'connection_request') {
        actions = [
            { action: 'accept', title: 'Accept' },
            { action: 'view', title: 'View Profile' },
        ]
    } else if (type === 'warning') {
        actions = [
            { action: 'view', title: 'View' },
            { action: 'dismiss', title: 'Dismiss' },
        ]
    } else if (type === 'info') {
        actions = [
            { action: 'view', title: 'View Details' },
            { action: 'dismiss', title: 'Dismiss' },
        ]
    }

    const notificationOptions = {
        body: notificationBody,
        icon: '/images/logoo_procollab.png',
        badge: '/images/logoo_procollab.png',
        // ✅ tag = same ID replaces duplicate browser notifications
        tag: notificationId,
        renotify: false,
        requireInteraction: false,
        silent: false,
        data: {
            url: payload.data?.url || '/',
            notificationId,
            type: payload.data?.type || 'info',
            projectId: payload.data?.projectId || null,
        },
        actions,
    }

    // ✅ Close existing notification with same tag before showing
    // Prevents stacking duplicates if FCM retries
    event.waitUntil(
        self.registration
            .getNotifications({ tag: notificationId })
            .then(existing => {
                existing.forEach(n => n.close())
                return self.registration.showNotification(
                    notificationTitle,
                    notificationOptions
                )
            })
    )
})

// ─── Notification click handler ───────────────────────────
self.addEventListener('notificationclick', (event) => {
    event.notification.close()

    const action = event.action
    const notifData = event.notification.data || {}
    let urlToOpen = notifData.url || '/'

    if (action === 'dismiss') return

    if (action === 'accept') {
        urlToOpen = `${urlToOpen}${urlToOpen.includes('?') ? '&' : '?'}action=accept`
    }

    event.waitUntil(
        self.clients
            .matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                const existing = clientList.find(client =>
                    client.url.includes(self.location.origin)
                )
                if (existing) {
                    existing.focus()
                    return existing.navigate(self.location.origin + urlToOpen)
                }
                return self.clients.openWindow(
                    self.location.origin + urlToOpen
                )
            })
    )
})

// ─── SW lifecycle ─────────────────────────────────────────
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...')
    event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...')
    event.waitUntil(self.clients.claim())
})
# FCM Setup Instructions for ProCollab

## 🚀 Quick Setup Guide

### Step 1: Deploy Cloud Functions
```bash
# Navigate to functions directory
cd functions

# Install dependencies
npm install

# Go back to root
cd ..

# Deploy functions
firebase deploy --only functions
```

### Step 2: Get VAPID Key
1. Go to [Firebase Console](https://console.firebase.google.com/project/projectmap-f1155/settings/cloudmessaging)
2. Under "Web Push certificates", copy your VAPID key
3. If no key exists, click "Generate key pair"

### Step 3: Update Environment Variables
Add to your `.env` file:
```env
VITE_FIREBASE_VAPID_KEY=YOUR_ACTUAL_VAPID_KEY_HERE
```

### Step 4: Restart Development Server
```bash
npm run dev
```

## 🧪 Testing FCM

### Method 1: Using Admin Dashboard
1. Login as admin
2. Go to `/admin`
3. Use the FCM Test Panel on the overview tab
4. Fill in title and body
5. Click "Test FCM"

### Method 2: Using Cloud Function Directly
```bash
curl -X POST https://us-central1-projectmap-f1155.cloudfunctions.net/testFCM \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "YOUR_USER_ID",
    "title": "Test Notification",
    "body": "This is a test!"
  }'
```

### Method 3: Using Browser Console
```javascript
// In browser console (when logged in)
fetch('https://us-central1-projectmap-f1155.cloudfunctions.net/testFCM', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'YOUR_USER_ID',
    title: 'Test Notification',
    body: 'This is a test!'
  })
})
.then(r => r.json())
.then(console.log)
```

## 🔍 Troubleshooting

### 401 Error (VAPID Key Issue)
- **Problem**: `fcmregistrations.googleapis.com 401 error`
- **Solution**: Update VAPID key in `.env` file and restart dev server

### No FCM Tokens Found
- **Problem**: User has no FCM tokens registered
- **Solution**: 
  1. Grant notification permission in browser
  2. Check browser console for FCM registration logs
  3. Verify `useFCM` hook is working

### Cloud Function Not Found
- **Problem**: Function deployment failed
- **Solution**: 
  1. Check `firebase deploy --only functions` output
  2. Verify functions are deployed: `firebase functions:list`
  3. Check function logs: `firebase functions:log`

### Service Worker Issues
- **Problem**: Background notifications not working
- **Solution**:
  1. Check if `/firebase-messaging-sw.js` is accessible
  2. Verify service worker registration in DevTools
  3. Clear browser cache and re-register

## 📊 Monitoring

### Check Function Logs
```bash
# View all function logs
firebase functions:log

# View specific function logs
firebase functions:log --only processFCMQueue
```

### Check FCM Token Storage
1. Go to Firestore Console
2. Navigate to `users/{userId}/fcmTokens`
3. Verify tokens are being stored

### Check Notification Queue
1. Go to Firestore Console
2. Navigate to `fcmQueue` collection
3. Check if notifications are being queued and processed

## ✅ Success Indicators

When FCM is working correctly, you should see:

1. **Browser Console**: 
   - `[FCM] Token registered successfully`
   - `[useFCM] Initialized for user: {userId}`
   - `[FCM] Foreground listener active`

2. **Firestore**: 
   - Tokens in `/users/{userId}/fcmTokens`
   - Queue items processed in `/fcmQueue`

3. **Function Logs**:
   - `[FCM] Processing queue item: {queueId}`
   - `[FCM] Success: X, Failures: 0`

4. **Notifications**:
   - Foreground: Toast notifications in app
   - Background: Browser push notifications

## 🔧 Advanced Configuration

### Custom Notification Icons
Update in `functions/src/index.js`:
```javascript
icon: messageData?.icon || '/icons/icon-192x192.png',
badge: '/icons/badge-72x72.png',
```

### Notification Actions
Modify service worker in `public/firebase-messaging-sw.js`:
```javascript
actions: [
    { action: 'view', title: 'View' },
    { action: 'dismiss', title: 'Dismiss' },
    { action: 'reply', title: 'Reply' }
]
```

### Rate Limiting
Adjust in `functions/src/index.js`:
```javascript
// Add rate limiting logic
const rateLimiter = new Map();
// Implementation details...
```

## 📱 Production Deployment

### Environment Variables
Set in your hosting platform:
```env
VITE_FIREBASE_VAPID_KEY=your_production_vapid_key
```

### HTTPS Requirement
- FCM requires HTTPS in production
- Service Worker must be served over HTTPS
- Firebase Hosting provides HTTPS by default

### Domain Verification
- Verify your domain in Firebase Console
- Add domain to authorized domains list

---

**Need Help?** Check the browser console for detailed error messages and refer to [Firebase FCM Documentation](https://firebase.google.com/docs/cloud-messaging/js/client).
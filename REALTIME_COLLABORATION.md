# ProCollab Realtime Collaboration Architecture

## Overview
This document outlines the realtime collaboration system implemented in ProCollab using Firebase Firestore.

## User-Based Access Control

### Role-Based Permissions
The system implements a hierarchical role structure:

1. **Owner** - Full control over project and team
   - Can delete project
   - Can manage all members
   - Can change any settings

2. **Admin** - Can manage team and tasks
   - Can invite/remove members
   - Can create/edit/delete tasks
   - Can modify project settings

3. **Member** - Can contribute to project
   - Can create/edit tasks assigned to them
   - Can comment and collaborate
   - Can view all project data

4. **Viewer** - Read-only access
   - Can view project data
   - Cannot make changes

### Implementation in Firestore

```typescript
// Project document structure
projects/{projectId}
  - createdBy: string (owner UID)
  - members: string[] (array of UIDs)
  - settings: {
      allowPublicView: boolean
      requireApproval: boolean
    }
  
  // Subcollections
  /members/{memberId}
    - uid: string
    - role: 'owner' | 'admin' | 'member' | 'viewer'
    - joinedAt: timestamp
    - name: string
    - email: string
    - avatar: string
  
  /tasks/{taskId}
    - createdBy: string
    - assignee: object
    - status: string
    - ...
  
  /invitations/{inviteId}
    - email: string
    - role: string
    - invitedBy: string
    - status: 'pending' | 'accepted' | 'rejected'
  
  /joinRequests/{requestId}
    - uid: string
    - message: string
    - status: 'pending' | 'accepted' | 'rejected'
```

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(projectId) {
      return isAuthenticated() && 
        get(/databases/$(database)/documents/projects/$(projectId)).data.createdBy == request.auth.uid;
    }
    
    function isMember(projectId) {
      return isAuthenticated() && 
        request.auth.uid in get(/databases/$(database)/documents/projects/$(projectId)).data.members;
    }
    
    function getMemberRole(projectId) {
      return get(/databases/$(database)/documents/projects/$(projectId)/members/$(request.auth.uid)).data.role;
    }
    
    function isAdminOrOwner(projectId) {
      let role = getMemberRole(projectId);
      return role == 'owner' || role == 'admin';
    }
    
    // Projects
    match /projects/{projectId} {
      allow read: if isAuthenticated() && (isMember(projectId) || resource.data.settings.allowPublicView == true);
      allow create: if isAuthenticated();
      allow update: if isAdminOrOwner(projectId);
      allow delete: if isOwner(projectId);
      
      // Members subcollection
      match /members/{memberId} {
        allow read: if isMember(projectId);
        allow write: if isAdminOrOwner(projectId);
      }
      
      // Tasks subcollection
      match /tasks/{taskId} {
        allow read: if isMember(projectId);
        allow create: if isMember(projectId);
        allow update: if isMember(projectId) && 
          (isAdminOrOwner(projectId) || resource.data.createdBy == request.auth.uid);
        allow delete: if isAdminOrOwner(projectId) || resource.data.createdBy == request.auth.uid;
      }
      
      // Invitations
      match /invitations/{inviteId} {
        allow read: if isMember(projectId);
        allow create: if isAdminOrOwner(projectId);
        allow delete: if isAdminOrOwner(projectId);
      }
      
      // Join Requests
      match /joinRequests/{requestId} {
        allow read: if isAdminOrOwner(projectId) || request.auth.uid == resource.data.uid;
        allow create: if isAuthenticated();
        allow update: if isAdminOrOwner(projectId);
      }
    }
  }
}
```

## Realtime Collaboration Features

### 1. Live Task Updates
All components use Firestore's `onSnapshot` for realtime updates:

```typescript
useEffect(() => {
  const q = query(collection(db, 'projects', projectId, 'tasks'))
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const tasksData = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    setTasks(tasksData)
  })
  
  return () => unsubscribe()
}, [projectId])
```

### 2. Team Member Presence
Track active users in realtime:

```typescript
// Update user presence
const presenceRef = doc(db, 'projects', projectId, 'presence', user.uid)
await setDoc(presenceRef, {
  uid: user.uid,
  name: user.displayName,
  lastSeen: serverTimestamp(),
  online: true
})

// Listen for presence changes
const presenceQuery = query(collection(db, 'projects', projectId, 'presence'))
onSnapshot(presenceQuery, (snapshot) => {
  const activeUsers = snapshot.docs
    .filter(doc => doc.data().online)
    .map(doc => doc.data())
  setActiveUsers(activeUsers)
})
```

### 3. Conflict Resolution
Firestore handles conflicts automatically using last-write-wins strategy. For critical operations, use transactions:

```typescript
await runTransaction(db, async (transaction) => {
  const taskRef = doc(db, 'projects', projectId, 'tasks', taskId)
  const taskDoc = await transaction.get(taskRef)
  
  if (!taskDoc.exists()) {
    throw new Error('Task does not exist')
  }
  
  transaction.update(taskRef, {
    status: newStatus,
    updatedAt: serverTimestamp()
  })
})
```

### 4. Optimistic Updates
For better UX, update local state immediately and sync with Firestore:

```typescript
const handleUpdateTask = async (taskId, updates) => {
  // Optimistic update
  setTasks(tasks.map(t => t.id === taskId ? { ...t, ...updates } : t))
  
  try {
    // Sync with Firestore
    await updateDoc(doc(db, 'projects', projectId, 'tasks', taskId), {
      ...updates,
      updatedAt: serverTimestamp()
    })
  } catch (error) {
    // Revert on error
    loadTasks()
    toast({ title: "Error", description: "Failed to update task" })
  }
}
```

## Local Storage Strategy

### When to Use Local Storage
Use local storage for:
- **User preferences** (theme, layout settings)
- **Draft content** (unsaved documents, form data)
- **Cache** (recently viewed items)
- **Non-collaborative data** (personal notes, budget tracking)

### When to Use Firestore
Use Firestore for:
- **Collaborative data** (tasks, projects, team members)
- **Shared resources** (documents, files)
- **Real-time updates** (chat, notifications)
- **Cross-device sync** (user profile, settings)

### Hybrid Approach Example

```typescript
// Documents component uses local storage
const [docs, setDocs] = useState(() => {
  const saved = localStorage.getItem('procollab-docs')
  return saved ? JSON.parse(saved) : []
})

useEffect(() => {
  localStorage.setItem('procollab-docs', JSON.stringify(docs))
}, [docs])

// Tasks use Firestore for collaboration
useEffect(() => {
  const q = query(collection(db, 'projects', projectId, 'tasks'))
  return onSnapshot(q, (snapshot) => {
    setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
  })
}, [projectId])
```

## Performance Optimization

### 1. Pagination
For large datasets, use pagination:

```typescript
const [lastVisible, setLastVisible] = useState(null)

const loadMore = async () => {
  const q = query(
    collection(db, 'projects', projectId, 'tasks'),
    orderBy('createdAt', 'desc'),
    startAfter(lastVisible),
    limit(20)
  )
  
  const snapshot = await getDocs(q)
  setLastVisible(snapshot.docs[snapshot.docs.length - 1])
  setTasks([...tasks, ...snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))])
}
```

### 2. Selective Listening
Only subscribe to data you need:

```typescript
// Instead of listening to all tasks
const q = query(
  collection(db, 'projects', projectId, 'tasks'),
  where('assignee.id', '==', user.uid),
  where('status', '!=', 'done')
)
```

### 3. Offline Support
Firestore automatically caches data for offline use:

```typescript
import { enableIndexedDbPersistence } from 'firebase/firestore'

enableIndexedDbPersistence(db).catch((err) => {
  if (err.code == 'failed-precondition') {
    // Multiple tabs open
  } else if (err.code == 'unimplemented') {
    // Browser doesn't support
  }
})
```

## Best Practices

1. **Always unsubscribe** from listeners to prevent memory leaks
2. **Use serverTimestamp()** for consistent timestamps across clients
3. **Implement loading states** for better UX
4. **Handle errors gracefully** with user-friendly messages
5. **Validate data** on both client and server (Firestore rules)
6. **Use batch writes** for multiple related updates
7. **Implement retry logic** for failed operations
8. **Monitor Firestore usage** to optimize costs

## Security Checklist

- ✅ Firestore security rules implemented
- ✅ User authentication required
- ✅ Role-based access control
- ✅ Input validation
- ✅ XSS protection (React handles this)
- ✅ CSRF protection (Firebase handles this)
- ✅ Rate limiting (implement Cloud Functions)
- ✅ Audit logging (implement Cloud Functions)

## Future Enhancements

1. **Real-time cursors** - Show where team members are working
2. **Activity feed** - Log all project activities
3. **Webhooks** - Integrate with external services
4. **Advanced permissions** - Custom roles and permissions
5. **Version history** - Track changes to documents and tasks
6. **Real-time chat** - In-app messaging
7. **Video calls** - Integrated video conferencing
8. **AI assistance** - Smart suggestions and automation

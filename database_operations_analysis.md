# Database Read/Write Operations Analysis

This document provides a comprehensive analysis of all database operations performed by each page in the ProCollab application.

## Database Collections Overview

The application uses Firebase Firestore with the following main collections:
- `users` - User profiles and authentication data
- `projects` - Project information and metadata
- `reports` - Content moderation reports
- `inviteTokens` - Project invitation tokens
- `moderationQueue` - Content awaiting admin review
- `announcements` - Platform-wide announcements

### Sub-collections:
- `users/{uid}/applications` - User's project applications
- `users/{uid}/notifications` - User notifications
- `users/{uid}/friends` - User connections/network
- `users/{uid}/connectionRequests` - Incoming connection requests
- `users/{uid}/savedProjects` - Bookmarked projects
- `users/{uid}/joinedProjects` - Projects user has joined
- `projects/{id}/members` - Project team members
- `projects/{id}/applications` - Applications to join project
- `projects/{id}/invitations` - Project invitations
- `projects/{id}/tasks` - Project tasks (Kanban/Gantt)

## Page-by-Page Analysis

### 1. AdminDashboard.tsx

**Database Reads:**
- `loadPlatformStats()` - Aggregated platform statistics
- `loadAllUsers()` - All user documents for management
- `loadAllProjects()` - All project documents for oversight
- `loadAnnouncements()` - Platform announcements
- `loadGrowthData(30)` - Growth metrics for last 30 days
- `loadAdminLogs()` - Admin activity logs
- `loadModerationQueue()` - Content pending review
- `reports` collection - User-submitted reports (ordered by createdAt desc)

**Database Writes:**
- `updateUserRole(userId, role)` - Update user role (admin/member)
- `toggleUserDisabled(userId, disabled)` - Enable/disable user accounts
- `deleteUser(userId)` - Remove user account
- `updateProjectStatus(projectId, status)` - Change project status
- `toggleProjectFeatured(projectId, featured)` - Feature/unfeature projects
- `deleteProject(projectId)` - Remove projects
- `createAnnouncement()` - Create platform announcements
- `updateAnnouncement(id, data)` - Modify announcements
- `deleteAnnouncement(id)` - Remove announcements
- `logAdminAction()` - Log administrative actions
- `reviewModerationItem()` - Approve/reject moderated content
- `reports/{id}` - Update report status (resolved/dismissed)

### 2. Applications.tsx

**Database Reads:**
- `users/{uid}/applications` - User's project applications (ordered by appliedAt desc)
- For each application, fetches project title and details

**Database Writes:**
- `users/{uid}/applications/{id}` - Delete withdrawn applications
- `projects/{projectId}/applications` - Remove application from project side
- Cleanup operations when withdrawing applications

### 3. CreateProject.tsx

**Database Reads:**
- Content moderation analysis (via `analyzeProjectContent()`)

**Database Writes:**
- `projects` collection - Create new project document with:
  - Basic info (title, description, status, etc.)
  - Team details (teamSize, maxMembers, currentMembers)
  - Skills and requirements
  - Moderation metadata (score, flags, status)
- `moderationQueue` collection - Add project for review if flagged
- Validation and sanitization of all input data

### 4. Dashboard.tsx

**Database Reads:**
- `loadDashboardStats(userId)` - User's dashboard statistics
- `loadRecentActivity(userId)` - Recent user activity
- `loadRecommendedProjects(userId)` - Personalized project recommendations
- `loadMyProjects(userId)` - User's created projects (limited to 3)
- `loadMyApplications(userId)` - User's applications (limited to 3)
- `users/{uid}/notifications` - Real-time notification subscription

**Database Writes:**
- None (read-only dashboard)

### 5. Discover.tsx

**Database Reads:**
- `loadPaginatedUsers()` - Paginated user discovery with infinite scroll
- `loadPaginatedProjects()` - Paginated project discovery
- `users/{uid}/friends` - User's friend connections
- `users/{uid}/connectionRequests` - Incoming connection requests
- External APIs for trending topics (Hacker News, Dev.to, NewsAPI)

**Database Writes:**
- `sendConnectionRequest()` - Send connection requests between users
- Connection status updates and notifications

### 6. EditProject.tsx

**Database Reads:**
- `projects/{id}` - Load project for editing (with ownership verification)

**Database Writes:**
- `projects/{id}` - Update project with modified data:
  - All project fields (title, description, team size, etc.)
  - Duration handling (multiple format support)
  - Skills and tags arrays
  - Timestamp updates (updatedAt)
- `projects/{id}` - Delete project (if user chooses to delete)

### 7. InviteAccept.tsx

**Database Reads:**
- `inviteTokens/{token}` - Validate invitation token
- `projects/{projectId}` - Load project details for invitation
- Token expiry and status validation

**Database Writes:**
- `projects/{projectId}/members/{uid}` - Add new team member
- `projects/{projectId}` - Update members array and count
- `inviteTokens/{token}` - Mark token as consumed
- `projects/{projectId}/invitations/{id}` - Update invitation status
- `users/{uid}/joinedProjects/{projectId}` - Add to user's joined projects
- `users/{ownerId}/notifications` - Notify project owner of acceptance

### 8. Landing.tsx

**Database Reads:**
- None (static marketing page)

**Database Writes:**
- None

### 9. Login.tsx

**Database Reads:**
- Firebase Authentication validation

**Database Writes:**
- Firebase Authentication login
- Session management

### 10. ManageTeam.tsx

**Database Reads:**
- `projects/{id}` - Project details (real-time listener)
- `projects/{id}/members` - Team members (real-time listener)
- `projects/{id}/invitations` - Pending invitations (real-time listener)
- `projects/{id}/applications` - Join requests (real-time listener)
- User profile lookups for application details

**Database Writes:**
- `projects/{id}/invitations` - Create team invitations
- `inviteTokens/{token}` - Global invitation tokens
- `projects/{id}/members/{uid}` - Update member roles and permissions
- `projects/{id}/applications/{id}` - Accept/reject applications
- `users/{uid}/joinedProjects/{projectId}` - Add accepted members
- `users/{uid}/notifications` - Send notifications for team actions
- Batch operations for member removal and cleanup

### 11. MyProjects.tsx

**Database Reads:**
- `projects` collection - Projects created by user (where createdBy == userId)
- `projects` collection - Projects where user is a member (where members array contains userId)
- Ordered by createdAt descending

**Database Writes:**
- None (read-only view)

### 12. Notifications.tsx

**Database Reads:**
- `users/{uid}/notifications` - User notifications with pagination
- Real-time listener with visibility-based pausing
- Paginated loading (20 notifications per page)

**Database Writes:**
- `users/{uid}/notifications/{id}` - Mark individual notifications as read
- `users/{uid}/notifications/{id}` - Delete notifications
- Batch operations for mark all read and clear all

### 13. Profile.tsx

**Database Reads:**
- `users/{profileId}` - User profile data
- `projects` collection - Projects created by the user
- `users/{uid}/applications` - User's applications (if own profile)
- `users/{profileId}/friends` - User's network connections (real-time)
- Connection status checking between users

**Database Writes:**
- `sendConnectionRequest()` - Send connection requests
- `acceptConnectionRequest()` - Accept incoming requests
- `rejectConnectionRequest()` - Decline requests
- `withdrawConnectionRequest()` - Withdraw sent requests
- `users/{uid}` - Delete user account (if own profile)

### 14. ProjectDashboard.tsx

**Database Reads:**
- `projects/{id}` - Project details and configuration
- `projects/{id}/tasks` - Project tasks (real-time listener)
- Permission-based access control for different tabs

**Database Writes:**
- `projects/{id}` - Update project methodology
- Task management operations (through dashboard components)
- Permission-controlled writes based on user role

### 15. ProjectDetails.tsx

**Database Reads:**
- `projects/{id}` - Complete project information
- `users/{createdBy}` - Project creator details
- `projects` collection - Similar projects by discipline
- `users/{uid}/applications` - Check application status
- Membership verification across multiple sources:
  - `projects/{id}` teamMembers map
  - `projects/{id}` members array
  - `projects/{id}/members/{uid}` document
  - `users/{uid}/joinedProjects/{id}` document

**Database Writes:**
- Application withdrawal operations:
  - `users/{uid}/applications/{id}` - Delete user application
  - `projects/{id}/applications/{id}` - Delete project application
- `reports` collection - Submit project reports
- `projects/{id}` - Increment report count
- `users/{ownerId}/notifications` - Notify of reports
- Admin notifications for reports

### 16. Projects.tsx

**Database Reads:**
- `projects` collection - All projects (ordered by createdAt desc)
- Membership checking across multiple sources for "Apply" button logic
- `users/{uid}/joinedProjects` - User's joined projects
- `projects/{id}/members/{uid}` - Member verification

**Database Writes:**
- None (read-only browsing, applications handled by modal)

### 17. Register.tsx

**Database Reads:**
- Firebase Authentication validation

**Database Writes:**
- Firebase Authentication user creation
- `users/{uid}` - Create user profile document with:
  - Personal information (name, email, etc.)
  - Professional details (discipline, role, skills)
  - Social links and bio
  - Avatar configuration

### 18. SavedProjects.tsx

**Database Reads:**
- `users/{uid}/savedProjects` - User's bookmarked projects
- `projects/{id}` - Full project details for each saved project

**Database Writes:**
- None (read-only view, saving handled elsewhere)

### 19. Settings.tsx

**Database Reads:**
- `users/{uid}` - Current user profile data

**Database Writes:**
- `users/{uid}` - Update user profile with:
  - Personal information updates
  - Avatar style and seed configuration
  - Social links and professional details
  - Skills array processing (comma-separated to array)
  - Generated avatar URL updates

## Key Database Patterns

### 1. Real-time Listeners
- Notifications, team management, and dashboard use `onSnapshot()` for real-time updates
- Visibility-based listener pausing to reduce reads
- Automatic cleanup on component unmount

### 2. Pagination
- Infinite scroll implementation in Discover and Notifications
- Cursor-based pagination using `startAfter()`
- Page size limits (typically 20 items per page)

### 3. Membership Verification
- Multiple source checking for robust membership verification:
  - Project root document (teamMembers map, members array)
  - Members sub-collection
  - User's joinedProjects sub-collection

### 4. Permission System
- Role-based access control (owner, admin, member, viewer)
- Granular permissions for different dashboard sections
- Permission verification before reads and writes

### 5. Batch Operations
- Used for complex operations like member removal
- Ensures data consistency across related documents
- Reduces the number of individual write operations

### 6. Content Moderation
- Automated content analysis on project creation
- Moderation queue for admin review
- Risk scoring and flag-based filtering

### 7. Notification System
- Standardized notification schema across all features
- Batch notification creation for multiple recipients
- Read/unread status tracking

## Performance Considerations

1. **Read Optimization:**
   - Pagination to limit data transfer
   - Real-time listeners only where necessary
   - Efficient querying with proper indexing

2. **Write Optimization:**
   - Batch operations for related updates
   - Minimal writes with only changed data
   - Proper error handling and rollback

3. **Security:**
   - Server-side validation and sanitization
   - Permission checks before operations
   - Content moderation pipeline

4. **Scalability:**
   - Sub-collection structure for user-specific data
   - Efficient pagination and infinite scroll
   - Optimized query patterns
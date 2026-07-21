import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { HelmetProvider } from 'react-helmet-async'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AdminRoute } from '@/components/AdminRoute'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Toaster } from '@/components/ui/toaster'
import { usePageTracking } from '@/hooks/usePageTracking'
// Static import — must NOT be lazy so it renders immediately with no blank flash
import { LoadingScreen } from '@/components/LoadingScreen'
// Helper for dynamic imports with auto-reload retry on chunk fetch failures
const lazyWithRetry = <T extends React.ComponentType<any>>(
  componentImport: () => Promise<{ default: T } | any>
) =>
  lazy(async () => {
    const pageHasAlreadyBeenRefreshed = JSON.parse(
      window.sessionStorage.getItem('page-has-been-refreshed') || 'false'
    )
    try {
      const component = await componentImport()
      window.sessionStorage.setItem('page-has-been-refreshed', 'false')
      return component
    } catch (error: any) {
      if (
        !pageHasAlreadyBeenRefreshed &&
        (error?.name === 'TypeError' ||
          error?.message?.includes('Failed to fetch dynamically imported module') ||
          error?.message?.includes('Importing a module script failed'))
      ) {
        window.sessionStorage.setItem('page-has-been-refreshed', 'true')
        window.location.reload()
        return new Promise(() => {})
      }
      window.sessionStorage.setItem('page-has-been-refreshed', 'false')
      throw error;
    }
  })

const InviteAccept = lazyWithRetry(() => import('@/pages/InviteAccept'))
// Lazy load components to reduce initial bundle size
const Landing = lazyWithRetry(() => import('@/pages/Landing').then(module => ({ default: module.Landing })))
const Login = lazyWithRetry(() => import('@/pages/Login').then(module => ({ default: module.Login })))
const Register = lazyWithRetry(() => import('@/pages/Register').then(module => ({ default: module.Register })))
const ForgotPassword = lazyWithRetry(() => import('@/pages/ForgotPassword').then(module => ({ default: module.ForgotPassword })))
const Dashboard = lazyWithRetry(() => import('@/pages/Dashboard').then(module => ({ default: module.Dashboard })))
const Discover = lazyWithRetry(() => import('@/pages/Discover').then(module => ({ default: module.Discover })))
const Projects = lazyWithRetry(() => import('@/pages/Projects').then(module => ({ default: module.Projects })))
const Profile = lazyWithRetry(() => import('@/pages/Profile'))
const MyProjects = lazyWithRetry(() => import('@/pages/MyProjects'))
const ProjectDetails = lazyWithRetry(() => import('@/pages/ProjectDetails').then(module => ({ default: module.ProjectDetails })))
const SavedProjects = lazyWithRetry(() => import('@/pages/SavedProjects').then(module => ({ default: module.SavedProjects })))
const CreateProject = lazyWithRetry(() => import('@/pages/CreateProject').then(module => ({ default: module.CreateProject })))
const Settings = lazyWithRetry(() => import('@/pages/Settings').then(module => ({ default: module.Settings })))
const EditProject = lazyWithRetry(() => import('@/pages/EditProject').then(module => ({ default: module.EditProject })))
const ProjectDashboard = lazyWithRetry(() => import('@/pages/ProjectDashboard').then(module => ({ default: module.ProjectDashboard })))
const ManageTeam = lazyWithRetry(() => import('@/pages/ManageTeam').then(module => ({ default: module.ManageTeam })))
const Applications = lazyWithRetry(() => import('@/pages/Applications').then(module => ({ default: module.Applications })))
const AdminDashboard = lazyWithRetry(() => import('@/pages/AdminDashboard').then(module => ({ default: module.AdminDashboard })))
const Notifications = lazyWithRetry(() => import('@/pages/Notifications').then(module => ({ default: module.Notifications })))
const PublicProjectShowcase = lazyWithRetry(() => import('@/pages/PublicProjectShowcase'))
const PublicProfile = lazyWithRetry(() => import('@/pages/PublicProfile'))
const PublicProject = lazyWithRetry(() => import('@/pages/PublicProject'))
const Feedback = lazyWithRetry(() => import('@/pages/Feedback'))
// PageLoader uses the statically-imported LoadingScreen — zero blank-screen flash
const PageLoader = () => <LoadingScreen />

// Inner component that can use Router hooks
function AppRoutes() {
  usePageTracking()
  return (
    <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/invite" element={<InviteAccept />} />
              <Route path="/project/public/:projectId" element={<PublicProjectShowcase />} />
              <Route path="/u/:username" element={<Profile />} />
              <Route path="/projects/:slug" element={<PublicProject />} />

              <Route path="/create-project" element={<CreateProject />} />
              <Route path="/edit-project/:id" element={<EditProject />} />
              <Route path="/project/:id/dashboard" element={<ProjectDashboard />} />
              <Route path="/project/:id/manage-team" element={<ManageTeam />} />
              <Route path="/manage-team/:id" element={<ManageTeam />} />
              <Route path="/settings" element={<Settings />} />
              <Route
                path="/dashboard"
                element={
                  <ErrorBoundary>
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  </ErrorBoundary>
                }
              />
            <Route
              path="/dashboard/projects"
              element={
                <ErrorBoundary>
                  <ProtectedRoute>
                    <MyProjects />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/dashboard/projects/:id"
              element={
                <ErrorBoundary>
                  <ProtectedRoute>
                    <ProjectDashboard />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/dashboard/applications"
              element={
                <ErrorBoundary>
                  <ProtectedRoute>
                    <Applications />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/feedback"
              element={
                <ErrorBoundary>
                  <ProtectedRoute>
                    <Feedback />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/dashboard/notifications"
              element={
                <ErrorBoundary>
                  <ProtectedRoute>
                    <Notifications />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/dashboard/saved"
              element={
                <ErrorBoundary>
                  <ProtectedRoute>
                    <SavedProjects />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/discover"
              element={
                <ErrorBoundary>
                  <Discover />
                </ErrorBoundary>
              }
            />
            <Route
              path="/projects"
              element={
                <ErrorBoundary>
                  <ProtectedRoute>
                    <Projects />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/saved-projects"
              element={
                <ErrorBoundary>
                  <ProtectedRoute>
                    <SavedProjects />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/create-project"
              element={
                <ErrorBoundary>
                  <ProtectedRoute>
                    <CreateProject />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/settings/profile"
              element={
                <ErrorBoundary>
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/profile/:id"
              element={
                <ErrorBoundary>
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/profile"
              element={
                <ErrorBoundary>
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/project/:id"
              element={
                <ErrorBoundary>
                  <ProtectedRoute>
                    <ProjectDetails />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/edit-project/:id"
              element={
                <ErrorBoundary>
                  <ProtectedRoute>
                    <EditProject />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin"
              element={
                <ErrorBoundary>
                  <AdminRoute>
                    <AdminDashboard />
                  </AdminRoute>
                </ErrorBoundary>
              }
            />
          </Routes>
          <Toaster />
        </Suspense>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <HelmetProvider>
        <Router>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </Router>
      </HelmetProvider>
    </ErrorBoundary>
  )
}

export default App

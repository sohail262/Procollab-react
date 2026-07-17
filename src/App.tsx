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
const InviteAccept = lazy(() => import('@/pages/InviteAccept'))
// Lazy load components to reduce initial bundle size
const Landing = lazy(() => import('@/pages/Landing').then(module => ({ default: module.Landing })))
const Login = lazy(() => import('@/pages/Login').then(module => ({ default: module.Login })))
const Register = lazy(() => import('@/pages/Register').then(module => ({ default: module.Register })))
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword').then(module => ({ default: module.ForgotPassword })))
const Dashboard = lazy(() => import('@/pages/Dashboard').then(module => ({ default: module.Dashboard })))
const Discover = lazy(() => import('@/pages/Discover').then(module => ({ default: module.Discover })))
const Projects = lazy(() => import('@/pages/Projects').then(module => ({ default: module.Projects })))
const Profile = lazy(() => import('@/pages/Profile'))
const MyProjects = lazy(() => import('@/pages/MyProjects'))
const ProjectDetails = lazy(() => import('@/pages/ProjectDetails').then(module => ({ default: module.ProjectDetails })))
const SavedProjects = lazy(() => import('@/pages/SavedProjects').then(module => ({ default: module.SavedProjects })))
const CreateProject = lazy(() => import('@/pages/CreateProject').then(module => ({ default: module.CreateProject })))
const Settings = lazy(() => import('@/pages/Settings').then(module => ({ default: module.Settings })))
const EditProject = lazy(() => import('@/pages/EditProject').then(module => ({ default: module.EditProject })))
const ProjectDashboard = lazy(() => import('@/pages/ProjectDashboard').then(module => ({ default: module.ProjectDashboard })))
const ManageTeam = lazy(() => import('@/pages/ManageTeam').then(module => ({ default: module.ManageTeam })))
const Applications = lazy(() => import('@/pages/Applications').then(module => ({ default: module.Applications })))
const AdminDashboard = lazy(() => import('@/pages/AdminDashboard').then(module => ({ default: module.AdminDashboard })))
const Notifications = lazy(() => import('@/pages/Notifications').then(module => ({ default: module.Notifications })))
const PublicProjectShowcase = lazy(() => import('@/pages/PublicProjectShowcase'))
const PublicProfile = lazy(() => import('@/pages/PublicProfile'))
const PublicProject = lazy(() => import('@/pages/PublicProject'))
const Feedback = lazy(() => import('@/pages/Feedback'))
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

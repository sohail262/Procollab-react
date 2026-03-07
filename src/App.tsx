import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AdminRoute } from '@/components/AdminRoute'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Toaster } from '@/components/ui/toaster'

// Lazy load components to reduce initial bundle size
const Landing = lazy(() => import('@/pages/Landing').then(module => ({ default: module.Landing })))
const Login = lazy(() => import('@/pages/Login').then(module => ({ default: module.Login })))
const Register = lazy(() => import('@/pages/Register').then(module => ({ default: module.Register })))
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
const ProfileRedesignTest = lazy(() => import('@/pages/ProfileRedesignTest'))

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
)

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              
              {/* Test Route for Profile Redesign */}
              <Route 
                path="/test/profile-redesign" 
                element={
                  <ErrorBoundary>
                    <ProtectedRoute>
                      <ProfileRedesignTest />
                    </ProtectedRoute>
                  </ErrorBoundary>
                } 
              />
              
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
                  <ProtectedRoute>
                    <Discover />
                  </ProtectedRoute>
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
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  )
}

export default App

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import LandingPage from './pages/LandingPage'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import DatabaseDetail from './pages/DatabaseDetail'
import DatabaseSpreadsheet from './pages/DatabaseSpreadsheet'
import Visualizations from './pages/Visualizations'
import VisualizationDetail from './pages/VisualizationDetail'
import TeamManagement from './pages/TeamManagement'
import AuditLogs from './pages/AuditLogs'
import OAuthCallback from './pages/OAuthCallback'
import Notifications from './pages/Notifications'
import NotificationPreferences from './pages/NotificationPreferences'
import Billing from './pages/Billing'
import DeveloperPortal from './pages/DeveloperPortal'
import DeveloperClients from './pages/DeveloperClients'
import OAuthConsent from './pages/OAuthConsent'
import Layout from './components/Layout'
import ToastContainer from './components/Toast'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

function HomeRoute() {
  return <LandingPage />
}

function App() {
  return (
    <BrowserRouter>
      <ToastContainer />
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/login" element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        } />
        <Route path="/register" element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        } />
        <Route path="/auth/callback/:provider" element={<OAuthCallback />} />
        <Route path="/oauth2/authorize" element={<OAuthConsent />} />
        <Route element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="visualizations" element={<Visualizations />} />
          <Route path="visualizations/:id" element={<VisualizationDetail />} />
          <Route path="databases/:slug" element={<DatabaseDetail />} />
          <Route path="databases/:slug/spreadsheet" element={<DatabaseSpreadsheet />} />
          <Route path="team" element={<TeamManagement />} />
          <Route path="audit-logs" element={<AuditLogs />} />
          <Route path="billing" element={<Billing />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="settings/notifications" element={<NotificationPreferences />} />
          <Route path="developer" element={<DeveloperPortal />} />
          <Route path="developer/clients" element={<DeveloperClients />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

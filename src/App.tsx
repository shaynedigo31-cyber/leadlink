import { Route, Routes } from 'react-router-dom'
import PublicLayout from './layouts/PublicLayout'
import AppLayout from './layouts/AppLayout'
import ProtectedRoute from './components/ProtectedRoute'
import Landing from './pages/Landing'
import About from './pages/About'
import Features from './pages/Features'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import Dashboard from './pages/Dashboard'
import MyOrganizations from './pages/MyOrganizations'
import Discover from './pages/Discover'
import Invitations from './pages/Invitations'
import MyRequests from './pages/MyRequests'
import Notifications from './pages/Notifications'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import OrgDashboard from './pages/OrgDashboard'
import OrgMembers from './pages/OrgMembers'
import OrgStructure from './pages/OrgStructure'
import ActivityLog from './pages/ActivityLog'
import OrgSettings from './pages/OrgSettings'
import ComingSoon from './pages/ComingSoon'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/about" element={<About />} />
        <Route path="/features" element={<Features />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/my-organizations" element={<MyOrganizations />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/invitations" element={<Invitations />} />
          <Route path="/my-requests" element={<MyRequests />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />

          <Route path="/org/:orgId/dashboard" element={<OrgDashboard />} />
          <Route path="/org/:orgId/members" element={<OrgMembers />} />
          <Route path="/org/:orgId/officers" element={<OrgStructure />} />
          <Route path="/org/:orgId/structure" element={<OrgStructure />} />
          <Route path="/org/:orgId/activity" element={<ActivityLog />} />
          <Route path="/org/:orgId/settings" element={<OrgSettings />} />
          <Route path="/org/:orgId/:module" element={<ComingSoon />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

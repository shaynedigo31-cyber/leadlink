import { Route, Routes } from 'react-router-dom'
import PublicLayout from './layouts/PublicLayout'
import AppLayout from './layouts/AppLayout'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import Landing from './pages/Landing'
import About from './pages/About'
import Features from './pages/Features'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import OrgDashboard from './pages/OrgDashboard'
import Discover from './pages/Discover'
import MyRequests from './pages/MyRequests'
import Members from './pages/Members'
import AdminApprovals from './pages/AdminApprovals'
import ComingSoon from './pages/ComingSoon'
import NotFound from './pages/NotFound'

const comingSoon = ['my-organizations', 'invitations', 'notifications', 'profile', 'settings']

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/about" element={<About />} />
        <Route path="/features" element={<Features />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/my-requests" element={<MyRequests />} />
          {comingSoon.map((p) => (
            <Route key={p} path={`/${p}`} element={<ComingSoon />} />
          ))}
          <Route path="/org/:orgId/dashboard" element={<OrgDashboard />} />
          <Route path="/org/:orgId/members" element={<Members />} />
          <Route path="/org/:orgId/:module" element={<ComingSoon />} />
          <Route element={<AdminRoute />}>
            <Route path="/admin/approvals" element={<AdminApprovals />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Only hides the page. The admin functions in the database refuse everyone who is not a platform administrator.
export default function AdminRoute() {
  const { isPlatformAdmin } = useAuth()
  if (!isPlatformAdmin) {
    return (
      <div className="card mx-auto mt-10 max-w-md p-10 text-center">
        <h1 className="text-xl font-bold">Not available</h1>
        <p className="mt-2 text-sm text-muted">This page is for platform administrators.</p>
        <Link to="/dashboard" className="btn-primary mt-6">Back to dashboard</Link>
      </div>
    )
  }
  return <Outlet />
}
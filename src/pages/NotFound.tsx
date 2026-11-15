import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-3xl font-extrabold">Page not found</h1>
      <p className="mt-2 text-sm text-muted">That link doesn’t lead anywhere. Check the address or go back home.</p>
      <Link to="/" className="btn-primary mt-6">Go home</Link>
    </div>
  )
}

import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Restricts /admin to signed-in platform admins (row in public.admins).
 */
export default function AdminRouteGuard({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return null
  if (!user) {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />
  }
  if (!user.is_platform_admin) {
    return <Navigate to="/" replace />
  }
  return children
}

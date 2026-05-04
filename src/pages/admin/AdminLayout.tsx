import { useState } from 'react'
import { NavLink, Outlet, Link } from 'react-router-dom'
import { Settings, Building2, Users, LogOut, Compass, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

const NAV = [
  { to: '/admin/owners', label: 'Business owners', icon: Building2 },
  { to: '/admin/users',  label: 'Users',            icon: Users },
  { to: '/admin/settings', label: 'Site settings',  icon: Settings },
]

export default function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { logout } = useAuth()

  async function handleSignOut() {
    try { await supabase?.auth.signOut() } catch { /* ignore */ }
    logout()
  }

  return (
    <div className="admin-shell">
      {/* ── Top navbar ─────────────────────────────────────────── */}
      <header className="admin-navbar">
        <div className="admin-navbar-inner">

          {/* Brand */}
          <Link to="/admin/owners" className="admin-brand" onClick={() => setMobileOpen(false)}>
            <span className="admin-brand-icon">
              <Compass className="h-5 w-5" aria-hidden />
            </span>
            <span className="admin-brand-text">
              <span className="admin-brand-name">SiyahaBH</span>
              <span className="admin-brand-sub">Admin</span>
            </span>
          </Link>

          {/* Desktop nav links */}
          <nav className="admin-navbar-nav" aria-label="Admin navigation">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn('admin-nav-link', isActive && 'admin-nav-link--active')
                }
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Desktop right actions */}
          <div className="admin-navbar-actions">
            <Link to="/" className="admin-action-link">
              ← Back to site
            </Link>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="admin-signout-btn"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="admin-hamburger"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Gold accent line */}
        <span className="admin-header-accent" aria-hidden="true" />

        {/* Mobile dropdown menu */}
        {mobileOpen && (
          <div className="admin-mobile-menu">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn('admin-mobile-link', isActive && 'admin-mobile-link--active')
                }
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {label}
              </NavLink>
            ))}
            <div className="admin-mobile-divider" />
            <Link to="/" className="admin-mobile-link" onClick={() => setMobileOpen(false)}>
              ← Back to site
            </Link>
            <button
              type="button"
              onClick={() => { setMobileOpen(false); void handleSignOut() }}
              className="admin-mobile-link admin-mobile-signout"
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden />
              Sign out
            </button>
          </div>
        )}
      </header>

      {/* ── Page content ───────────────────────────────────────── */}
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  )
}

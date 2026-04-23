import { Routes, Route, Link, NavLink, Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState, lazy, Suspense } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import Home from './pages/Home'
import { useGbTheme } from './context/ThemeContext'
import Profile from './pages/Profile'
import Posts from './pages/Posts'
import ClientPosts from './pages/ClientPosts'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import { useAuth } from './context/AuthContext'
import { getClientsByAccount } from './lib/clients'
import './App.css'
import './pages/index.css'
import './components/SkeletonLoaders.css'

const MotionNavLink = motion(NavLink)
const BusinessListingPage = lazy(() => import('./pages/BusinessListingPage'))

function App() {
  const location = useLocation()
  const hideChrome = location.pathname.startsWith('/listing/')
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useGbTheme()
  const [isEventOrganizer, setIsEventOrganizer] = useState(false)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    let cancelled = false
    async function loadClientType() {
      if (!user?.account_uuid) {
        if (!cancelled) setIsEventOrganizer(false)
        return
      }
      try {
        const clients = await getClientsByAccount(user.account_uuid)
        const singleClient = Array.isArray(clients) && clients.length === 1 ? clients[0] : null
        if (!cancelled) {
          setIsEventOrganizer(singleClient?.client_type === 'event_organizer')
        }
      } catch {
        if (!cancelled) setIsEventOrganizer(false)
      }
    }
    loadClientType()
    return () => {
      cancelled = true
    }
  }, [user?.account_uuid])

  return (
    <div className="app">
      {!hideChrome && (
      <header className="header">
        <Link to="/" className="logo">SiyahaBH</Link>
        <nav className="nav">
          <motion.button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            whileTap={reducedMotion ? undefined : { scale: 0.92 }}
          >
            {theme === 'dark' ? '☀' : '🌙'}
          </motion.button>
          {user ? (
            <>
              <MotionNavLink to="/" end className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')} whileTap={reducedMotion ? undefined : { scale: 0.97 }}>Home</MotionNavLink>
              <MotionNavLink to="/edit" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')} whileTap={reducedMotion ? undefined : { scale: 0.97 }}>Edit</MotionNavLink>
              <MotionNavLink to="/posts" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')} whileTap={reducedMotion ? undefined : { scale: 0.97 }}>Posts</MotionNavLink>
              {isEventOrganizer && <MotionNavLink to="/events" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')} whileTap={reducedMotion ? undefined : { scale: 0.97 }}>Events</MotionNavLink>}
              <motion.button type="button" className="btn-link" onClick={logout} whileTap={reducedMotion ? undefined : { scale: 0.97 }}>Sign Out</motion.button>
            </>
          ) : (
            <>
              <MotionNavLink to="/signin" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')} whileTap={reducedMotion ? undefined : { scale: 0.97 }}>Sign in</MotionNavLink>
              <MotionNavLink to="/signup" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')} whileTap={reducedMotion ? undefined : { scale: 0.97 }}>Sign up</MotionNavLink>
            </>
          )}
        </nav>
      </header>
      )}
      <main className="main">
        <Routes>
          <Route
            path="/listing/pink-salt-grills"
            element={
              <Suspense fallback={null}>
                <BusinessListingPage />
              </Suspense>
            }
          />
          <Route path="/" element={<Home />} />
          <Route path="/signin" element={user ? <Navigate to="/" replace /> : <SignIn />} />
          <Route path="/signup" element={user ? <Navigate to="/" replace /> : <SignUp />} />
          <Route path="/profile" element={user ? <Profile mode="dashboard" /> : <Navigate to="/signin" replace />} />
          <Route path="/edit" element={user ? <Profile mode="edit" /> : <Navigate to="/signin" replace />} />
          <Route path="/profile/:clientId/posts" element={user ? <ClientPosts /> : <Navigate to="/" replace />} />
          <Route path="/posts" element={user ? <Posts initialSection="posts" showTabs={false} /> : <Navigate to="/" replace />} />
          <Route path="/events" element={user ? <Posts initialSection="events" showTabs={false} /> : <Navigate to="/" replace />} />
        </Routes>
      </main>
      {!hideChrome && (
      <footer className="footer gb-footer">
        <div className="gb-footer-surface">
          <div className="gb-footer-top">
            <div className="gb-footer-brand">
              <div className="gb-footer-mark" aria-hidden>
                <span className="gb-footer-mark-dot" />
                <span className="gb-footer-mark-dot" />
                <span className="gb-footer-mark-dot" />
                <span className="gb-footer-mark-dot" />
              </div>
              <div className="gb-footer-brand-text">
                <div className="gb-footer-logo">SiyahaBH</div>
                <div className="gb-footer-tagline">Find. Book. Explore.</div>
              </div>
            </div>

            <div className="gb-footer-columns">
              <div className="gb-footer-col">
                <div className="gb-footer-col-title">Sitemap</div>
                <NavLink to="/" className="gb-footer-link">Home</NavLink>
                <NavLink to="/edit" className="gb-footer-link">Edit</NavLink>
                <NavLink to="/posts" className="gb-footer-link">Posts</NavLink>
                <NavLink to="/listing/pink-salt-grills" className="gb-footer-link">Sample restaurant listing</NavLink>
              </div>

              <div className="gb-footer-col">
                <div className="gb-footer-col-title">Info</div>
                <a className="gb-footer-link" href="#" onClick={(e) => e.preventDefault()}>FAQs</a>
                <a className="gb-footer-link" href="#" onClick={(e) => e.preventDefault()}>Privacy Policy</a>
                <a className="gb-footer-link" href="#" onClick={(e) => e.preventDefault()}>Terms &amp; Conditions</a>
              </div>

              <div className="gb-footer-col">
                <div className="gb-footer-col-title">Contact</div>
                <a className="gb-footer-link" href="tel:+973" aria-label="Phone">+973</a>
                <a className="gb-footer-link" href="mailto:hello@gobahrain.app">hello@gobahrain.app</a>
                <div className="gb-footer-muted">Kingdom of Bahrain</div>
              </div>
            </div>
          </div>

          <div className="gb-footer-bottom">
            <div className="gb-footer-legal-pill">© {new Date().getFullYear()} SiyahaBH. All rights reserved.</div>
            <div className="gb-footer-social" aria-label="Social links">
              <a className="gb-footer-social-btn" href="#" onClick={(e) => e.preventDefault()} aria-label="LinkedIn">in</a>
              <a className="gb-footer-social-btn" href="#" onClick={(e) => e.preventDefault()} aria-label="WhatsApp">wa</a>
              <a className="gb-footer-social-btn" href="#" onClick={(e) => e.preventDefault()} aria-label="Instagram">ig</a>
            </div>
          </div>
        </div>
      </footer>
      )}
    </div>
  )
}

export default App

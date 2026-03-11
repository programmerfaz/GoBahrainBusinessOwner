import { Routes, Route, Link, NavLink, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Home from './pages/Home'
import Profile from './pages/Profile'
import Posts from './pages/Posts'
import ClientPosts from './pages/ClientPosts'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import { useAuth } from './context/AuthContext'
import { getClientsByAccount } from './lib/clients'
import './App.css'
import './pages/index.css'

function App() {
  const { user, logout } = useAuth()
  const [isEventOrganizer, setIsEventOrganizer] = useState(false)

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
      <header className="header">
        <Link to="/" className="logo">Go Bahrain</Link>
        <nav className="nav">
          {user ? (
            <>
              <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>Home</NavLink>
              <NavLink to="/edit" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>Edit</NavLink>
              <NavLink to="/posts" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>Posts</NavLink>
              {isEventOrganizer && <NavLink to="/events" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>Events</NavLink>}
              <button type="button" className="btn-link" onClick={logout}>Sign Out</button>
            </>
          ) : (
            <>
              <NavLink to="/signin" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>Sign in</NavLink>
              <NavLink to="/signup" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>Sign up</NavLink>
            </>
          )}
        </nav>
      </header>
      <main className="main">
        <Routes>
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
      <footer className="footer">
        <p>Go Bahrain &middot; Tourism &amp; Business Platform &middot; Kingdom of Bahrain</p>
      </footer>
    </div>
  )
}

export default App

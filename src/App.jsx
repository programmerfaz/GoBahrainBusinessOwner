import { Routes, Route, Link, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Profile from './pages/Profile'
import Posts from './pages/Posts'
import ClientPosts from './pages/ClientPosts'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import { useAuth } from './context/AuthContext'
import './App.css'
import './pages/index.css'

function App() {
  const { user, logout } = useAuth()

  return (
    <div className="app">
      <header className="header">
        <Link to="/" className="logo">Go Bahrain</Link>
        <nav className="nav">
          {user ? (
            <>
              <Link to="/">Home</Link>
              <Link to="/profile">Profile</Link>
              <span className="nav-user">{user.name}</span>
              <button type="button" className="btn-link" onClick={logout}>Sign Out</button>
            </>
          ) : (
            <>
              <Link to="/signin">Sign in</Link>
              <Link to="/signup">Sign up</Link>
            </>
          )}
        </nav>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/signin" element={user ? <Navigate to="/profile" replace /> : <SignIn />} />
          <Route path="/signup" element={user ? <Navigate to="/profile" replace /> : <SignUp />} />
          <Route path="/profile" element={user ? <Profile /> : <Navigate to="/signin" replace />} />
          <Route path="/profile/:clientId/posts" element={user ? <ClientPosts /> : <Navigate to="/" replace />} />
          <Route path="/posts" element={user ? <Posts /> : <Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="footer">
        <p>Go Bahrain &middot; Tourism &amp; Business Platform &middot; Kingdom of Bahrain</p>
      </footer>
    </div>
  )
}

export default App

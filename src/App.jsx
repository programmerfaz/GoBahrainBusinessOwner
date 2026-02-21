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
              <button type="button" className="btn btn-link" onClick={logout}>Sign Out</button>
            </>
          ) : (
            <>
              <Link to="/signin">Sign In</Link>
              <Link to="/signup">Sign Up</Link>
            </>
          )}
        </nav>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/profile" element={user ? <Profile /> : <Navigate to="/" replace />} />
          <Route path="/profile/:clientId/posts" element={user ? <ClientPosts /> : <Navigate to="/" replace />} />
          <Route path="/posts" element={user ? <Posts /> : <Navigate to="/" replace />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
        </Routes>
      </main>
      <footer className="footer">
        <p>Go Bahrain — Tourism & Business Platform</p>
      </footer>
    </div>
  )
}

export default App

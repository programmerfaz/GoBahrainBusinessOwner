import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { signIn } from '../lib/auth'
import { useAuth } from '../context/AuthContext'

export default function SignIn() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const reduced = useReducedMotion()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const account = await signIn(email, password)
      login(account)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <motion.div
        className="auth-card"
        initial={reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1>Sign In</h1>
        <p className="auth-subtitle">Welcome back to Go Bahrain</p>

        <form onSubmit={handleSubmit} className="auth-form" autoComplete="off">
          {error && <div className="auth-error">{error}</div>}

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="off"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="new-password"
            />
          </label>

          <motion.button type="submit" className="btn btn-primary" disabled={loading} whileTap={reduced ? undefined : { scale: 0.98 }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </motion.button>
        </form>

        <p className="auth-footer">
          Don&apos;t have an account? <Link to="/signup">Sign up</Link>
        </p>

        <div className="auth-note" role="note" aria-label="Account request note">
          <p className="auth-note-title">Need account access?</p>
          <p className="auth-note-text">
            Email <a href="mailto:gobahraintourism@gmail.com">gobahraintourism@gmail.com</a> with your business name and a short description of who you are to receive your credentials.
          </p>
        </div>
      </motion.div>
    </div>
  )
}

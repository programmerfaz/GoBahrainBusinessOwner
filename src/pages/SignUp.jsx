import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { signUp } from '../lib/auth'
import { useAuth } from '../context/AuthContext'

export default function SignUp() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const reduced = useReducedMotion()
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    clientType: 'restaurant',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const account = await signUp(form)
      login(account)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Sign up failed')
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
        <h1>Sign Up</h1>
        <p className="auth-subtitle">Create your SiyahaBH account</p>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}

          <label>
            Name
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Your name"
              required
            />
          </label>

          <label>
            Email
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </label>

          <label>
            Phone
            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="+973 3212 3456"
            />
          </label>

          <label>
            Business type
            <select
              name="clientType"
              value={form.clientType}
              onChange={handleChange}
              aria-label="Select business type"
            >
              <option value="restaurant">Restaurant</option>
              <option value="place">Place</option>
              <option value="event_organizer">Event organizer</option>
            </select>
          </label>

          <label>
            Password
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </label>

          <motion.button type="submit" className="btn btn-primary" disabled={loading} whileTap={reduced ? undefined : { scale: 0.98 }}>
            {loading ? 'Creating account...' : 'Sign Up'}
          </motion.button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/signin">Sign in</Link>
        </p>
      </motion.div>
    </div>
  )
}

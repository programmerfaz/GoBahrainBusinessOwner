import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getClientsByAccount } from '../lib/clients'

export default function Home() {
  const { user } = useAuth()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user?.account_uuid) return
    setLoading(true)
    setError('')
    getClientsByAccount(user.account_uuid)
      .then(setClients)
      .catch((err) => setError(err.message || 'Failed to load clients'))
      .finally(() => setLoading(false))
  }, [user?.account_uuid])

  if (!user) {
    return (
      <div className="page home landing">
        <section className="hero">
          <h1>Go Bahrain</h1>
          <p>Sign in to access your business dashboard.</p>
          <div className="cta-buttons">
            <Link to="/signin" className="btn btn-primary">Sign In</Link>
            <Link to="/signup" className="btn btn-outline">Sign Up</Link>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="page home dashboard">
      <section className="hero">
        <h1>Dashboard</h1>
        <p>Welcome back, {user.name}. Manage your profile, add posts, and reach visitors in Bahrain.</p>
      </section>

      <section className="clients-section">
        <h2>Your Clients</h2>
        {loading && <p className="clients-loading">Loading clients...</p>}
        {error && <div className="auth-error">{error}</div>}
        {!loading && !error && clients.length === 0 && (
          <p className="clients-empty">No clients yet.</p>
        )}
        {!loading && !error && clients.length > 0 && (
          <ul className="clients-list">
            {clients.map((c) => (
              <li key={c.client_a_uuid} className="client-card">
                <div className="client-name">{c.business_name || c.name || 'Unnamed'}</div>
                <dl className="client-details">
                  {Object.entries(c)
                    .filter(([key]) => key !== 'account_a_uuid')
                    .map(([key, value]) => {
                      if (value == null) return null
                      const labels = { client_a_uuid: 'Client ID', business_name: 'Business', client_type: 'Type', price_range: 'Price Range', client_image: 'Image' }
                      const label = labels[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
                      const display = Array.isArray(value) ? value.join(', ') : String(value)
                      return (
                        <div key={key}>
                          <dt>{label}</dt>
                          <dd className={key === 'client_a_uuid' ? 'client-id' : ''}>{display}</dd>
                        </div>
                      )
                    })}
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

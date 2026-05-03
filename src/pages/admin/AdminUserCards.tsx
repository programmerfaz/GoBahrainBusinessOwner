import { useEffect, useState, useMemo } from 'react'
import { Mail, Search, Phone } from 'lucide-react'
import { fetchAdminAccounts, type AdminAccountRow } from '@/lib/adminApi'

function initials(name: string) {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

function UserCard({ a }: { a: AdminAccountRow }) {
  return (
    <li className="admin-card">
      <div className="admin-card-banner admin-card-banner--user">
        <div className="admin-card-avatar">{initials(a.user_name || a.email)}</div>
        <span className="admin-card-type-badge">{a.account_type || 'account'}</span>
      </div>

      <div className="admin-card-body">
        <h3 className="admin-card-title">{a.user_name || '—'}</h3>

        <div className="admin-card-meta">
          <div className="admin-card-meta-row">
            <Mail className="admin-card-meta-icon" aria-hidden />
            <span className="admin-card-meta-val">{a.email}</span>
          </div>
          {a.phone ? (
            <div className="admin-card-meta-row">
              <Phone className="admin-card-meta-icon" aria-hidden />
              <span className="admin-card-meta-val">{a.phone}</span>
            </div>
          ) : null}
          {a.auth_id ? (
            <div className="admin-card-meta-row">
              <span className="admin-card-meta-label">Auth ID</span>
              <span className="admin-card-meta-val admin-card-mono">{a.auth_id.slice(0, 16)}…</span>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  )
}

function CardSkeleton() {
  return (
    <li className="admin-card admin-card-skeleton">
      <div className="admin-card-banner admin-skel-banner" />
      <div className="admin-card-body">
        <div className="admin-skel-line w-40" />
        <div className="admin-skel-line w-full mt-2" />
      </div>
    </li>
  )
}

export default function AdminUserCards() {
  const [rows, setRows] = useState<AdminAccountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetchAdminAccounts()
      .then((data) => { if (!cancelled) setRows(data) })
      .catch((e: Error) => { if (!cancelled) setError(e.message || 'Could not load accounts') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [tick])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return rows
    return rows.filter(
      (r) =>
        (r.email || '').toLowerCase().includes(s) ||
        (r.user_name || '').toLowerCase().includes(s) ||
        (r.phone || '').toLowerCase().includes(s) ||
        (r.account_type || '').toLowerCase().includes(s),
    )
  }, [rows, q])

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">Users</h2>
          <p className="admin-page-sub">All registered accounts from your database.</p>
        </div>
        <div className="admin-search-wrap">
          <Search className="admin-search-icon" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by email or name…"
            className="admin-search-input"
          />
        </div>
      </div>

      {!loading && !error && (
        <div className="admin-stat-bar">
          <span className="admin-stat-chip">
            <span className="admin-stat-n">{rows.length}</span> total
          </span>
          {q && (
            <span className="admin-stat-chip">
              <span className="admin-stat-n">{filtered.length}</span> matching
            </span>
          )}
          <button className="admin-reload-btn" onClick={() => setTick((t) => t + 1)} title="Reload data">
            ↻ Reload
          </button>
        </div>
      )}

      {error ? (
        <div className="admin-alert-error">
          {error}
          <button className="admin-reload-btn" style={{ marginLeft: 12 }} onClick={() => setTick((t) => t + 1)}>
            ↻ Retry
          </button>
        </div>
      ) : null}

      <ul className="admin-card-grid">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
          : filtered.length === 0 && !q
            ? (
              <li className="admin-empty" style={{ flexDirection: 'column', gap: 12 }}>
                <span>No accounts found.</span>
                <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                  If you expect data here, run migration <strong>019_fix_admin_rpc_volatile.sql</strong> in the Supabase SQL Editor, then{' '}
                  <button className="admin-reload-btn" onClick={() => setTick((t) => t + 1)}>↻ Reload</button>.
                </span>
              </li>
            )
            : filtered.length === 0
              ? <li className="admin-empty">No results for &ldquo;{q}&rdquo;.</li>
              : filtered.map((a) => <UserCard key={a.account_uuid} a={a} />)}
      </ul>
    </div>
  )
}

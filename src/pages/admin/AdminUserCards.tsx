import { useEffect, useState, useMemo } from 'react'
import { Mail, Search, Phone } from 'lucide-react'
import { fetchAdminAccounts, setOwnerProfileDisabledAdmin, type AdminAccountRow } from '@/lib/adminApi'
import { useAuth } from '@/context/AuthContext'

function initials(name: string) {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

function isBusinessOwnerAccountType(t: string | null | undefined) {
  return String(t ?? 'client').toLowerCase() === 'client'
}

function needsClientApproval(a: AdminAccountRow) {
  return isBusinessOwnerAccountType(a.account_type) && a.account_approved === false
}

function UserCard({ a, onRefresh }: { a: AdminAccountRow; onRefresh: () => void }) {
  const { user: authUser } = useAuth()
  const [disableBusy, setDisableBusy] = useState(false)
  const [disableErr, setDisableErr] = useState('')
  const profileOff = a.owner_profile_disabled === true
  const isAdminUser = a.is_platform_admin === true
  const pending = needsClientApproval(a)
  const isSelf = Boolean(authUser?.account_uuid && authUser.account_uuid === a.account_uuid)
  const canToggleDisable = !isAdminUser && !(isSelf && !profileOff)

  async function handleSetDisabled(nextDisabled: boolean) {
    if (isAdminUser) return
    if (isSelf && nextDisabled) return
    setDisableErr('')
    setDisableBusy(true)
    try {
      await setOwnerProfileDisabledAdmin(a.account_uuid, nextDisabled)
      onRefresh()
    } catch (e) {
      setDisableErr(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setDisableBusy(false)
    }
  }

  return (
    <li className={`admin-card${profileOff ? ' admin-card--profile-off' : ''}`}>
      <div className="admin-card-banner admin-card-banner--user">
        <div className="admin-card-avatar">{initials(a.user_name || a.email)}</div>
        <span className="admin-card-type-badge">{a.account_type || 'account'}</span>
        {(pending || profileOff || isAdminUser) ? (
          <div className="admin-card-status-pills">
            {isAdminUser ? (
              <span className="admin-card-admin-pill" title="Cannot disable platform admin accounts">Admin</span>
            ) : null}
            {pending ? (
              <span className="admin-card-pending-pill" title="Business owner is not approved yet">Pending</span>
            ) : null}
            {profileOff ? (
              <span className="admin-card-disabled-pill" title="This account cannot edit or post until re-enabled">Disabled</span>
            ) : null}
          </div>
        ) : null}
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

        <div className="admin-card-disable-row">
          <p className="admin-card-disable-hint">
            {isAdminUser
              ? 'Platform administrators cannot be disabled from the console.'
              : profileOff
                ? 'This account’s profile is off: they can browse but cannot edit or post.'
                : isSelf
                  ? 'You can disable other users here; use another admin session to change your own account.'
                  : 'Turn off this account’s ability to edit profile and posts (they can still sign in).'}
          </p>
          <button
            type="button"
            className={profileOff ? 'admin-enable-profile-btn' : 'admin-disable-profile-btn'}
            disabled={disableBusy || !canToggleDisable}
            title={
              isAdminUser
                ? 'Platform admins cannot be disabled'
                : isSelf && !profileOff
                  ? 'Cannot disable your own account while signed in'
                  : undefined
            }
            onClick={() => void handleSetDisabled(!profileOff)}
          >
            {disableBusy ? 'Saving…' : profileOff ? 'Enable profile' : 'Disable profile'}
          </button>
          {disableErr ? <p className="admin-card-approve-err">{disableErr}</p> : null}
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

  const pendingCount = useMemo(() => rows.filter(needsClientApproval).length, [rows])

  const disabledProfileCount = useMemo(
    () => rows.filter((r) => r.owner_profile_disabled === true).length,
    [rows],
  )

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">Users</h2>
          <p className="admin-page-sub">All registered accounts. Disable profile to block editing and posts for any account type.</p>
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
          {pendingCount > 0 && (
            <span className="admin-stat-chip admin-stat-chip--pending">
              <span className="admin-stat-n">{pendingCount}</span> pending approval
            </span>
          )}
          {disabledProfileCount > 0 && (
            <span className="admin-stat-chip admin-stat-chip--disabled">
              <span className="admin-stat-n">{disabledProfileCount}</span> profile disabled
            </span>
          )}
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
                  If you expect data here, run migrations <strong>019</strong> and <strong>024</strong> in the Supabase SQL Editor, then{' '}
                  <button className="admin-reload-btn" onClick={() => setTick((t) => t + 1)}>↻ Reload</button>.
                </span>
              </li>
            )
            : filtered.length === 0
              ? <li className="admin-empty">No results for &ldquo;{q}&rdquo;.</li>
              : filtered.map((a) => <UserCard key={a.account_uuid} a={a} onRefresh={() => setTick((t) => t + 1)} />)}
      </ul>
    </div>
  )
}

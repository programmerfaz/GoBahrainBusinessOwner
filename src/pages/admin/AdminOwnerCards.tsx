import { useEffect, useState, useMemo } from 'react'
import { Mail, MapPin, Search, Phone } from 'lucide-react'
import { approveAdminAccount, fetchAdminClients, setOwnerProfileDisabledAdmin, type AdminClientRow } from '@/lib/adminApi'

const TYPE_COLORS: Record<string, string> = {
  restaurant: 'linear-gradient(135deg, #92400e 0%, #b45309 60%, #d97706 100%)',
  place: 'linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 60%, #3b82f6 100%)',
  event_organizer: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 60%, #a78bfa 100%)',
  client: 'linear-gradient(135deg, #065f46 0%, #059669 60%, #34d399 100%)',
}
const DEFAULT_GRADIENT = 'linear-gradient(135deg, #18181b 0%, #3f3f46 100%)'

function typeGradient(t: string) {
  return TYPE_COLORS[t?.toLowerCase()] ?? DEFAULT_GRADIENT
}

function typeLabel(t: string) {
  if (!t) return 'Business'
  const map: Record<string, string> = {
    restaurant: 'Restaurant',
    place: 'Place',
    event_organizer: 'Event org.',
    client: 'Client',
  }
  return map[t.toLowerCase()] ?? t.charAt(0).toUpperCase() + t.slice(1)
}

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

function OwnerCard({ c, onRefresh }: { c: AdminClientRow; onRefresh: () => void }) {
  const tags = Array.isArray(c.tags) ? c.tags.slice(0, 5) : []
  const [approveBusy, setApproveBusy] = useState(false)
  const [approveErr, setApproveErr] = useState('')
  const [disableBusy, setDisableBusy] = useState(false)
  const [disableErr, setDisableErr] = useState('')
  const needsApproval = c.account_approved === false && isBusinessOwnerAccountType(c.owner_account_type)
  const profileOff = c.owner_profile_disabled === true

  async function handleApprove() {
    setApproveErr('')
    setApproveBusy(true)
    try {
      await approveAdminAccount(c.account_a_uuid)
      onRefresh()
    } catch (e) {
      setApproveErr(e instanceof Error ? e.message : 'Approve failed')
    } finally {
      setApproveBusy(false)
    }
  }

  async function handleSetDisabled(nextDisabled: boolean) {
    setDisableErr('')
    setDisableBusy(true)
    try {
      await setOwnerProfileDisabledAdmin(c.account_a_uuid, nextDisabled)
      onRefresh()
    } catch (e) {
      setDisableErr(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setDisableBusy(false)
    }
  }

  return (
    <li className={`admin-card${profileOff ? ' admin-card--profile-off' : ''}`}>
      <div className="admin-card-banner" style={{ background: typeGradient(c.client_type) }}>
        <div className="admin-card-avatar">{initials(c.business_name || 'Business')}</div>
        <span className="admin-card-type-badge">{typeLabel(c.client_type)}</span>
        {(needsApproval || profileOff) ? (
          <div className="admin-card-status-pills">
            {needsApproval ? (
              <span className="admin-card-pending-pill" title="Owner signed up but is not approved yet">Pending</span>
            ) : null}
            {profileOff ? (
              <span className="admin-card-disabled-pill" title="This account cannot edit or post until re-enabled">Disabled</span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="admin-card-body">
        <h3 className="admin-card-title">{c.business_name || 'Untitled'}</h3>
        {c.description ? (
          <p className="admin-card-desc">{c.description}</p>
        ) : null}

        <div className="admin-card-meta">
          {c.account_email ? (
            <div className="admin-card-meta-row">
              <Mail className="admin-card-meta-icon" aria-hidden />
              <span className="admin-card-meta-val">{c.account_email}</span>
            </div>
          ) : null}
          {c.account_user_name ? (
            <div className="admin-card-meta-row">
              <span className="admin-card-meta-label">Owner</span>
              <span className="admin-card-meta-val">{c.account_user_name}</span>
            </div>
          ) : null}
          {c.account_phone ? (
            <div className="admin-card-meta-row">
              <Phone className="admin-card-meta-icon" aria-hidden />
              <span className="admin-card-meta-val">{c.account_phone}</span>
            </div>
          ) : null}
          {c.lat != null && c.long != null ? (
            <div className="admin-card-meta-row">
              <MapPin className="admin-card-meta-icon" aria-hidden />
              <span className="admin-card-meta-val">
                {Number(c.lat).toFixed(4)}, {Number(c.long).toFixed(4)}
              </span>
            </div>
          ) : null}
          {c.price_range ? (
            <div className="admin-card-meta-row">
              <span className="admin-card-meta-label">Range</span>
              <span className="admin-card-meta-val">{c.price_range}</span>
            </div>
          ) : null}
        </div>

        {tags.length > 0 ? (
          <div className="admin-card-tags">
            {tags.map((t: unknown, i: number) => (
              <span key={i} className="admin-card-tag">{String(t)}</span>
            ))}
          </div>
        ) : null}

        {needsApproval ? (
          <div className="admin-card-approve-row">
            <p className="admin-card-approve-hint">This business owner is waiting for approval before they can edit or post.</p>
            <button
              type="button"
              className="admin-approve-account-btn"
              disabled={approveBusy}
              onClick={() => void handleApprove()}
            >
              {approveBusy ? 'Approving…' : 'Approve account'}
            </button>
            {approveErr ? <p className="admin-card-approve-err">{approveErr}</p> : null}
          </div>
        ) : null}

        <div className="admin-card-disable-row">
          <p className="admin-card-disable-hint">
            {profileOff
              ? 'This account’s profile is off: they can browse but cannot edit or post.'
              : 'Turn off this account’s ability to edit profile and posts (they can still sign in).'}
          </p>
          <button
            type="button"
            className={profileOff ? 'admin-enable-profile-btn' : 'admin-disable-profile-btn'}
            disabled={disableBusy}
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
        <div className="admin-skel-line w-48" />
        <div className="admin-skel-line w-full mt-2" />
        <div className="admin-skel-line w-3/4 mt-1" />
      </div>
    </li>
  )
}

export default function AdminOwnerCards() {
  const [rows, setRows] = useState<AdminClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetchAdminClients()
      .then((data) => { if (!cancelled) setRows(data) })
      .catch((e: Error) => { if (!cancelled) setError(e.message || 'Could not load businesses') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [tick])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return rows
    return rows.filter(
      (r) =>
        (r.business_name || '').toLowerCase().includes(s) ||
        (r.account_email || '').toLowerCase().includes(s) ||
        (r.client_type || '').toLowerCase().includes(s) ||
        (r.account_user_name || '').toLowerCase().includes(s),
    )
  }, [rows, q])

  const pendingCount = useMemo(
    () => rows.filter((r) => r.account_approved === false && isBusinessOwnerAccountType(r.owner_account_type)).length,
    [rows],
  )

  const disabledProfileCount = useMemo(
    () => rows.filter((r) => r.owner_profile_disabled === true).length,
    [rows],
  )

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">Business owners</h2>
          <p className="admin-page-sub">Every client profile linked to an account. Approve new signups so owners can edit and post.</p>
        </div>
        <div className="admin-search-wrap">
          <Search className="admin-search-icon" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email, or type…"
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
                <span>No business profiles found.</span>
                <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                  If you expect data here, run migration <strong>019_fix_admin_rpc_volatile.sql</strong> in the Supabase SQL Editor, then{' '}
                  <button className="admin-reload-btn" onClick={() => setTick((t) => t + 1)}>↻ Reload</button>.
                </span>
              </li>
            )
            : filtered.length === 0
              ? <li className="admin-empty">No results for &ldquo;{q}&rdquo;.</li>
              : filtered.map((c) => <OwnerCard key={c.client_a_uuid} c={c} onRefresh={() => setTick((t) => t + 1)} />)}
      </ul>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getClientsByAccount, getClientFull, fetchTagsFromPinecone } from '../lib/clients'
import { submitProfile } from '../lib/submitProfile'
import { updateProfile } from '../lib/updateProfile'
import { deleteProfile } from '../lib/deleteProfile'

const CLIENT_FIELDS = [
  { key: 'business_name', label: 'Business Name', type: 'text', required: true },
  { key: 'description', label: 'Description', type: 'textarea', required: false },
  { key: 'rating', label: 'Rating', type: 'text', required: false, placeholder: 'e.g. 4.5' },
  { key: 'price_range', label: 'Price Range', type: 'text', required: false, placeholder: 'e.g. 3-8 BHD' },
  { key: 'client_image', label: 'Image URL', type: 'text', required: false },
  { key: 'lat', label: 'Latitude', type: 'text', required: false },
  { key: 'long', label: 'Longitude', type: 'text', required: false },
  { key: 'timings', label: 'Timings', type: 'text', required: false, placeholder: 'e.g. 10AM-11PM (or use Opening/Closing below)' },
  { key: 'tags', label: 'Tags', type: 'text', required: false, placeholder: 'comma-separated, e.g. pizza, italian' },
]

const CLIENT_TYPE_OPTIONS = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'place', label: 'Place' },
  { value: 'event_organizer', label: 'Event Organizer' },
  { value: 'none', label: 'None' },
]

const RESTAURANT_FIELDS = [
  { key: 'cuisine', label: 'Cuisine', type: 'text', required: true, placeholder: 'e.g. Italian, American' },
  { key: 'meal_type', label: 'Meal Type', type: 'text', required: false, placeholder: 'e.g. Lunch, Dinner' },
  { key: 'food_type', label: 'Food Type', type: 'text', required: false, placeholder: 'Veg, Non Veg, Seafood' },
  { key: 'speciality', label: 'Speciality', type: 'text', required: false, placeholder: 'e.g. Margherita Pizza' },
  { key: 'isfoodtruck', label: 'Food Truck', type: 'checkbox', required: false },
]

const PLACE_CLIENT_FIELDS = [
  { key: 'category', label: 'Category', type: 'text', required: true, placeholder: 'e.g. nature, cultural, leisure' },
  { key: 'indoor_outdoor', label: 'Indoor / Outdoor', type: 'select', required: true, options: [
    { value: '', label: 'Select...' },
    { value: 'indoor', label: 'Indoor' },
    { value: 'outdoor', label: 'Outdoor' },
  ]},
]

const PLACE_FIELDS = [
  { key: 'place_name', label: 'Place Name', type: 'text', required: true, placeholder: 'e.g. Coral Beach' },
  { key: 'place_description', label: 'Place Description', type: 'textarea', required: false },
  { key: 'opening_time', label: 'Opening Time', type: 'time', required: false },
  { key: 'closing_time', label: 'Closing Time', type: 'time', required: false },
  { key: 'entry_cost', label: 'Entry Cost', type: 'text', required: false },
  { key: 'suitable_for', label: 'Suitable For', type: 'text', required: false },
]

const EVENT_ORGANIZER_FIELDS = [
  { key: 'event_type', label: 'Event Type', type: 'text', required: true },
  { key: 'event_indoor_outdoor', label: 'Indoor / Outdoor', type: 'select', required: true, options: [
    { value: '', label: 'Select...' },
    { value: 'indoor', label: 'Indoor' },
    { value: 'outdoor', label: 'Outdoor' },
  ]},
]

const EVENT_FIELDS = [
  { key: 'event_name', label: 'Event Name', type: 'text', required: true },
  { key: 'venue', label: 'Venue', type: 'text', required: false },
  { key: 'start_date', label: 'Start Date', type: 'date', required: false },
  { key: 'end_date', label: 'End Date', type: 'date', required: false },
  { key: 'start_time', label: 'Start Time', type: 'time', required: false },
  { key: 'end_time', label: 'End Time', type: 'time', required: false },
]

const emptyForm = () => ({
  ...Object.fromEntries(CLIENT_FIELDS.map((f) => [f.key, ''])),
  client_type_choice: '',
  ...Object.fromEntries(RESTAURANT_FIELDS.map((f) => [f.key, f.type === 'checkbox' ? false : ''])),
  ...Object.fromEntries(PLACE_CLIENT_FIELDS.filter((f) => f.type !== 'select').map((f) => [f.key, ''])),
  indoor_outdoor: '',
  ...Object.fromEntries(PLACE_FIELDS.map((f) => [f.key, ''])),
  ...Object.fromEntries(EVENT_ORGANIZER_FIELDS.filter((f) => f.type !== 'select').map((f) => [f.key, ''])),
  event_indoor_outdoor: '',
  ...Object.fromEntries(EVENT_FIELDS.map((f) => [f.key, ''])),
  event_uuid: '',
})

function profileToForm(p) {
  const f = emptyForm()
  CLIENT_FIELDS.forEach(({ key }) => {
    const v = p[key]
    if (key === 'tags') return
    f[key] = v != null ? String(v) : ''
  })
  f.client_type_choice = p.client_type === 'client' ? 'none' : (p.client_type || '')
  if (p.client_type === 'restaurant') {
    RESTAURANT_FIELDS.forEach(({ key }) => {
      const v = p[key]
      f[key] = key === 'isfoodtruck' ? !!v : (v != null ? String(v) : '')
    })
  } else if (p.client_type === 'place') {
    f.category = p.category ?? ''
    f.indoor_outdoor = p.indoor_outdoor ?? ''
    f.place_name = p.place_name ?? p.name ?? ''
    f.place_description = p.place_description ?? p.description ?? ''
    f.opening_time = p.opening_time != null ? String(p.opening_time).slice(0, 5) : ''
    f.closing_time = p.closing_time != null ? String(p.closing_time).slice(0, 5) : ''
    f.entry_cost = p.entry_cost ?? ''
    f.suitable_for = p.suitable_for ?? ''
  } else if (p.client_type === 'event_organizer') {
    f.event_type = p.event_type ?? ''
    f.event_indoor_outdoor = p.indoor_outdoor ?? ''
    const ev = Array.isArray(p.events) && p.events[0] ? p.events[0] : {}
    f.event_uuid = ev.event_uuid ?? ''
    f.event_name = ev.event_name ?? ''
    f.venue = ev.venue ?? ''
    f.start_date = ev.start_date != null ? String(ev.start_date).slice(0, 10) : ''
    f.end_date = ev.end_date != null ? String(ev.end_date).slice(0, 10) : ''
    f.start_time = ev.start_time != null ? String(ev.start_time).slice(0, 5) : ''
    f.end_time = ev.end_time != null ? String(ev.end_time).slice(0, 5) : ''
  }
  if (Array.isArray(p.tags)) {
    f.tags = p.tags.join(', ')
  } else if (p.tags != null && p.tags !== '') {
    const s = String(p.tags).trim()
    if (s.startsWith('[')) {
      try {
        const arr = JSON.parse(s)
        f.tags = Array.isArray(arr) ? arr.join(', ') : s
      } catch {
        f.tags = s
      }
    } else {
      f.tags = s
    }
  } else {
    f.tags = ''
  }
  return f
}

export default function Profile() {
  const { user } = useAuth()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingClient, setLoadingClient] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState({ supabase: false, pinecone: false })
  const [pineconeError, setPineconeError] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingClientId, setEditingClientId] = useState(null)
  const [form, setForm] = useState(emptyForm())

  useEffect(() => {
    if (!user?.account_uuid) return
    setLoading(true)
    setError('')
    getClientsByAccount(user.account_uuid)
      .then(setClients)
      .catch((err) => setError(err.message || 'Failed to load clients'))
      .finally(() => setLoading(false))
  }, [user?.account_uuid])

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  async function handleStartEdit(clientUuid) {
    setLoadingClient(clientUuid)
    setError('')
    try {
      const [full, pineconeTags] = await Promise.all([
        getClientFull(clientUuid),
        fetchTagsFromPinecone(clientUuid),
      ])
      if (!full) {
        setError('Client not found')
        return
      }
      const hasTags = full.tags != null && full.tags !== '' && !(Array.isArray(full.tags) && full.tags.length === 0)
      const merged = hasTags ? full : { ...full, tags: Array.isArray(pineconeTags) && pineconeTags.length ? pineconeTags : full.tags }
      setForm(profileToForm(merged))
      setEditingClientId(clientUuid)
      setShowCreateForm(false)
    } catch (err) {
      setError(err.message || 'Failed to load client')
    } finally {
      setLoadingClient(null)
    }
  }

  function handleCancelEdit() {
    setEditingClientId(null)
    setForm(emptyForm())
  }

  async function handleDelete(clientUuid) {
    if (!window.confirm('Delete this profile? This will remove it from Supabase and Pinecone permanently.')) return
    setDeletingId(clientUuid)
    setError('')
    try {
      await deleteProfile(clientUuid)
      setClients((prev) => prev.filter((c) => c.client_a_uuid !== clientUuid))
    } catch (err) {
      setError(err.message || 'Failed to delete profile')
    } finally {
      setDeletingId(null)
    }
  }

  function handleCancelCreate() {
    setShowCreateForm(false)
    setForm(emptyForm())
  }

  async function handleSubmitCreate(e) {
    e.preventDefault()
    if (!user?.account_uuid || !form.client_type_choice) {
      setError('Please select a client type.')
      return
    }
    if (form.client_type_choice === 'restaurant' && !form.cuisine?.trim()) {
      setError('Cuisine is required for Restaurant.')
      return
    }
    if (form.client_type_choice === 'place' && (!form.category?.trim() || !form.indoor_outdoor)) {
      setError('Category and Indoor/Outdoor are required for Place.')
      return
    }
    if (form.client_type_choice === 'event_organizer' && (!form.event_type?.trim() || !form.event_indoor_outdoor)) {
      setError('Event Type and Indoor/Outdoor are required for Event Organizer.')
      return
    }
    setError('')
    setPineconeError('')
    setLoading(true)
    setSuccess({ supabase: false, pinecone: false })
    try {
      const { supabaseOk, pineconeOk, pineconeError: pe } = await submitProfile(form, user.account_uuid)
      setSuccess({ supabase: !!supabaseOk, pinecone: !!pineconeOk })
      if (!pineconeOk && pe) setPineconeError(pe)
      getClientsByAccount(user.account_uuid).then(setClients)
      setTimeout(() => {
        setShowCreateForm(false)
        setForm(emptyForm())
        setSuccess({ supabase: false, pinecone: false })
        setPineconeError('')
      }, 2000)
    } catch (err) {
      setError(err.message || 'Failed to save profile')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmitUpdate(e) {
    e.preventDefault()
    if (!editingClientId || !form.client_type_choice) {
      setError('Please select a client type.')
      return
    }
    if (form.client_type_choice === 'restaurant' && !form.cuisine?.trim()) {
      setError('Cuisine is required for Restaurant.')
      return
    }
    if (form.client_type_choice === 'place' && (!form.category?.trim() || !form.indoor_outdoor)) {
      setError('Category and Indoor/Outdoor are required for Place.')
      return
    }
    if (form.client_type_choice === 'event_organizer' && (!form.event_type?.trim() || !form.event_indoor_outdoor)) {
      setError('Event Type and Indoor/Outdoor are required for Event Organizer.')
      return
    }
    setError('')
    setPineconeError('')
    setLoading(true)
    setSuccess({ supabase: false, pinecone: false })
    try {
      const { supabaseOk, pineconeOk, pineconeError: pe } = await updateProfile(form, editingClientId)
      setSuccess({ supabase: !!supabaseOk, pinecone: !!pineconeOk })
      if (!pineconeOk && pe) setPineconeError(pe)
      getClientsByAccount(user.account_uuid).then(setClients)
      setTimeout(() => {
        setEditingClientId(null)
        setForm(emptyForm())
        setSuccess({ supabase: false, pinecone: false })
        setPineconeError('')
      }, 2000)
    } catch (err) {
      setError(err.message || 'Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  const showRestaurantFields = form.client_type_choice === 'restaurant'
  const showPlaceFields = form.client_type_choice === 'place'
  const showEventOrganizerFields = form.client_type_choice === 'event_organizer'

  if (!user) return null

  const isEditing = !!editingClientId

  return (
    <div className="page profile dashboard">
      <section className="hero">
        <h1>Profile</h1>
        <p>Manage your business profiles. Create new clients or update existing ones.</p>
      </section>

      <section className="clients-section">
        <div className="clients-section-header">
          <h2>Your Clients</h2>
          {!showCreateForm && !isEditing && (
            <button type="button" className="btn btn-primary" onClick={() => { setShowCreateForm(true); setEditingClientId(null); setForm(emptyForm()); setError(''); }}>
              Create Profile
            </button>
          )}
        </div>

        {loading && <p className="clients-loading">Loading clients...</p>}
        {error && <div className="auth-error">{error}</div>}
        {(success.supabase || success.pinecone) && (
          <div className="auth-success">
            {success.supabase && <p>Saved to Supabase successfully.</p>}
            {success.pinecone && <p>Saved to Pinecone successfully.</p>}
            {pineconeError && <p className="auth-warn">Pinecone: {pineconeError}</p>}
          </div>
        )}

        {!loading && !error && clients.length === 0 && !showCreateForm && (
          <p className="clients-empty">No clients yet. Create your first profile.</p>
        )}

        {!loading && !error && clients.length > 0 && !showCreateForm && !isEditing && (
          <div className="profile-cards-grid">
            {clients.map((c, i) => {
              const gradientClass = ['gradient-purple', 'gradient-green', 'gradient-orange'][i % 3]
              const name = c.business_name || c.name || 'Unnamed'
              return (
                <div key={c.client_a_uuid} className={`profile-card ${gradientClass}`}>
                  <div className="profile-card-top">
                    <span className="profile-card-type">{c.client_type || 'Business'}</span>
                    <h3 className="profile-card-title">{name}</h3>
                    {c.description && <p className="profile-card-desc">{String(c.description).slice(0, 80)}{c.description?.length > 80 ? '…' : ''}</p>}
                  </div>
                  <div className="profile-card-bottom">
                    <div className="profile-card-meta">
                      {c.client_type && <span>{c.client_type}</span>}
                      {c.price_range && <span>{c.price_range}</span>}
                    </div>
                    <div className="profile-card-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline btn-card"
                        onClick={() => handleStartEdit(c.client_a_uuid)}
                        disabled={loadingClient === c.client_a_uuid}
                      >
                        {loadingClient === c.client_a_uuid ? 'Loading...' : 'Update'}
                      </button>
                      <Link to={`/profile/${c.client_a_uuid}/posts`} className="btn btn-sm btn-primary btn-card">
                        Posts
                      </Link>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger btn-card"
                        onClick={() => handleDelete(c.client_a_uuid)}
                        disabled={deletingId === c.client_a_uuid}
                      >
                        {deletingId === c.client_a_uuid ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {(showCreateForm || isEditing) && (
          <form onSubmit={isEditing ? handleSubmitUpdate : handleSubmitCreate} className="profile-form">
            <button
              type="button"
              className="back-link"
              onClick={isEditing ? handleCancelEdit : handleCancelCreate}
            >
              ← Back to profiles
            </button>
            <h3>{isEditing ? 'Update Profile' : 'Create Profile'}</h3>
            {CLIENT_FIELDS.map((f) => (
              <label key={f.key}>
                {f.label} {f.required && '*'}
                {f.type === 'textarea' ? (
                  <textarea name={f.key} value={form[f.key] || ''} onChange={handleChange} placeholder={f.placeholder} rows={3} />
                ) : (
                  <input type={f.type} name={f.key} value={form[f.key] ?? ''} onChange={handleChange} placeholder={f.placeholder} required={f.required} />
                )}
              </label>
            ))}

            <div className="form-group">
              <span className="form-label">Type of Client</span>
              <div className="client-type-buttons">
                {CLIENT_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`btn-type ${form.client_type_choice === opt.value ? 'active' : ''}`}
                    onClick={() => setForm((prev) => ({ ...prev, client_type_choice: opt.value }))}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {showRestaurantFields && (
              <div className="restaurant-fields">
                <h4>Restaurant Details</h4>
                {RESTAURANT_FIELDS.map((f) => (
                  <label key={f.key}>
                    {f.label} {f.required && '*'}
                    {f.type === 'checkbox' ? (
                      <input type="checkbox" name={f.key} checked={form[f.key] || false} onChange={handleChange} />
                    ) : (
                      <input type="text" name={f.key} value={form[f.key] || ''} onChange={handleChange} placeholder={f.placeholder} required={f.required} />
                    )}
                  </label>
                ))}
              </div>
            )}

            {showPlaceFields && (
              <div className="place-fields">
                <h4>Place Client Details</h4>
                {PLACE_CLIENT_FIELDS.map((f) => (
                  <label key={f.key}>
                    {f.label} {f.required && '*'}
                    {f.type === 'select' ? (
                      <select name={f.key} value={form[f.key] || ''} onChange={handleChange} required={f.required}>
                        {f.options.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : (
                      <input type="text" name={f.key} value={form[f.key] || ''} onChange={handleChange} placeholder={f.placeholder} required={f.required} />
                    )}
                  </label>
                ))}
                <h4>Place Details</h4>
                {PLACE_FIELDS.map((f) => (
                  <label key={f.key}>
                    {f.label} {f.required && '*'}
                    {f.type === 'textarea' ? (
                      <textarea name={f.key} value={form[f.key] || ''} onChange={handleChange} placeholder={f.placeholder} rows={3} />
                    ) : f.type === 'time' ? (
                      <input type="time" name={f.key} value={form[f.key] || ''} onChange={handleChange} />
                    ) : (
                      <input type={f.type || 'text'} name={f.key} value={form[f.key] || ''} onChange={handleChange} placeholder={f.placeholder} required={f.required} />
                    )}
                  </label>
                ))}
              </div>
            )}

            {showEventOrganizerFields && (
              <div className="event-organizer-fields">
                <h4>Event Organizer Details</h4>
                {EVENT_ORGANIZER_FIELDS.map((f) => (
                  <label key={f.key}>
                    {f.label} {f.required && '*'}
                    {f.type === 'select' ? (
                      <select name={f.key} value={form[f.key] || ''} onChange={handleChange} required={f.required}>
                        {f.options.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : (
                      <input type="text" name={f.key} value={form[f.key] || ''} onChange={handleChange} placeholder={f.placeholder} required={f.required} />
                    )}
                  </label>
                ))}
                <h4>Event Details</h4>
                {EVENT_FIELDS.map((f) => (
                  <label key={f.key}>
                    {f.label} {f.required && '*'}
                    {f.type === 'date' ? (
                      <input type="date" name={f.key} value={form[f.key] || ''} onChange={handleChange} />
                    ) : f.type === 'time' ? (
                      <input type="time" name={f.key} value={form[f.key] || ''} onChange={handleChange} />
                    ) : (
                      <input type="text" name={f.key} value={form[f.key] || ''} onChange={handleChange} placeholder={f.placeholder} required={f.required} />
                    )}
                  </label>
                ))}
              </div>
            )}

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : (isEditing ? 'Update' : 'Create')}
              </button>
              <button type="button" className="btn btn-outline" onClick={isEditing ? handleCancelEdit : handleCancelCreate}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}

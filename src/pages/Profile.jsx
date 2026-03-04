import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '../context/AuthContext'
import { getClientsByAccount, getClientFull, fetchTagsFromPinecone } from '../lib/clients'
import { submitProfile } from '../lib/submitProfile'
import { updateProfile } from '../lib/updateProfile'
import { deleteProfile } from '../lib/deleteProfile'
import { uploadProfileImage, uploadEventImage, ensureProfileImagesBucket, ensureEventImagesBucket } from '../lib/profileImages'
import { api } from '../config/api'

const CLIENT_FIELDS = [
  { key: 'business_name', label: 'Business Name', type: 'text', required: true },
  { key: 'description', label: 'Description', type: 'textarea', required: false },
  { key: 'price_range', label: 'Price Range', type: 'text', required: false, placeholder: 'e.g. 3-8 BHD' },
  { key: 'client_image', label: 'Profile Image', type: 'image_upload', required: false },
  { key: 'lat', label: 'Latitude', type: 'text', required: false },
  { key: 'long', label: 'Longitude', type: 'text', required: false },
  { key: 'timings', label: 'Timings', type: 'text', required: false, placeholder: 'e.g. 10AM-11PM (or use Opening/Closing below)' },
  { key: 'tags', label: 'Tags', type: 'text', required: false, placeholder: 'comma-separated, e.g. pizza, italian' },
]

const RESTAURANT_FIELDS = [
  { key: 'cuisine', label: 'Cuisine', type: 'text', required: true, placeholder: 'e.g. Italian, American' },
  { key: 'meal_type', label: 'Meal Type', type: 'text', required: false, placeholder: 'e.g. Lunch, Dinner' },
  { key: 'food_type', label: 'Food Type', type: 'text', required: false, placeholder: 'Veg, Non Veg, Seafood' },
  { key: 'speciality', label: 'Speciality', type: 'text', required: false, placeholder: 'e.g. Margherita Pizza' },
  { key: 'isfoodtruck', label: 'Food Truck', type: 'checkbox', required: false },
]

const emptyBranch = () => ({
  area_name: '',
  lat: '',
  long: '',
})

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
  { key: 'name', label: 'Name', type: 'text', required: false, placeholder: 'Display name' },
  { key: 'image', label: 'Event Image', type: 'image', required: false },
  { key: 'status', label: 'Status', type: 'select', required: false, options: [
    { value: '', label: 'Select...' },
    { value: 'coming_soon', label: 'Coming Soon' },
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
    { value: 'postponed', label: 'Postponed' },
  ]},
  { key: 'venue', label: 'Venue', type: 'text', required: false },
  { key: 'lat', label: 'Latitude', type: 'text', required: false, placeholder: 'e.g. 26.2285' },
  { key: 'long', label: 'Longitude', type: 'text', required: false, placeholder: 'e.g. 50.5860' },
  { key: 'start_date', label: 'Start Date', type: 'date', required: false },
  { key: 'end_date', label: 'End Date', type: 'date', required: false },
  { key: 'start_time', label: 'Start Time', type: 'time', required: false },
  { key: 'end_time', label: 'End Time', type: 'time', required: false },
]

const emptyForm = () => ({
  ...Object.fromEntries(CLIENT_FIELDS.map((f) => [f.key, ''])),
  rating: '',
  client_type_choice: '',
  ...Object.fromEntries(RESTAURANT_FIELDS.map((f) => [f.key, f.type === 'checkbox' ? false : ''])),
  branch: [],
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
  f.rating = p.rating != null ? String(p.rating) : ''
  f.client_type_choice = p.client_type === 'client' ? 'none' : (p.client_type || '')
  if (p.client_type === 'restaurant') {
    RESTAURANT_FIELDS.forEach(({ key }) => {
      const v = p[key]
      f[key] = key === 'isfoodtruck' ? !!v : (v != null ? String(v) : '')
    })
    let branches = []
    if (Array.isArray(p.branch)) {
      branches = p.branch
    } else if (typeof p.branch === 'string' && p.branch.trim()) {
      try {
        const parsed = JSON.parse(p.branch)
        if (Array.isArray(parsed)) branches = parsed
      } catch {}
    }
    f.branch = branches
      .map((b) => ({
        area_name: String(b?.area_name ?? b?.name ?? b?.area ?? '').trim(),
        lat: String(b?.lat ?? '').trim(),
        long: String(b?.long ?? '').trim(),
      }))
      .filter((b) => b.area_name || b.lat || b.long)
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
    f.name = ev.name ?? ev.event_name ?? ''
    f.image = ev.image ?? ''
    f.status = ev.status ?? ''
    f.venue = ev.venue ?? ''
    f.lat = ev.lat ?? ''
    f.long = ev.long ?? ''
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

function resolveClientImageUrl(raw) {
  const value = String(raw || '').trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:')) {
    return value
  }
  const normalizedPath = value.replace(/^\/+/, '')
  return `${api.supabase.url}/storage/v1/object/public/gobahrain-profile-images/${normalizedPath}`
}

export default function Profile() {
  const { user } = useAuth()
  const [clients, setClients] = useState([])
  const [displayClient, setDisplayClient] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingClient, setLoadingClient] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState({ supabase: false, pinecone: false })
  const [pineconeError, setPineconeError] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingClientId, setEditingClientId] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadingClientImage, setUploadingClientImage] = useState(false)
  const [expandedQrClient, setExpandedQrClient] = useState(null)
  const [updatingHeaderImage, setUpdatingHeaderImage] = useState(false)
  const [branchResolvingIndex, setBranchResolvingIndex] = useState(null)
  const headerImageInputRef = useRef(null)

  useEffect(() => {
    if (!user?.account_uuid) return
    setLoading(true)
    setError('')
    ensureProfileImagesBucket().catch(() => {})
    ensureEventImagesBucket().catch(() => {})
    getClientsByAccount(user.account_uuid)
      .then(setClients)
      .catch((err) => setError(err.message || 'Failed to load clients'))
      .finally(() => setLoading(false))
  }, [user?.account_uuid])

  useEffect(() => {
    if (!clients.length) {
      setDisplayClient(null)
      return
    }
    const clientUuid = clients[0]?.client_a_uuid
    if (!clientUuid) {
      setDisplayClient(clients[0] || null)
      return
    }
    getClientFull(clientUuid)
      .then((full) => setDisplayClient(full || clients[0] || null))
      .catch(() => setDisplayClient(clients[0] || null))
  }, [clients])

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  function handleBranchChange(index, key, value) {
    setForm((prev) => {
      const current = Array.isArray(prev.branch) ? prev.branch : []
      const next = [...current]
      next[index] = { ...(next[index] || emptyBranch()), [key]: value }
      return { ...prev, branch: next }
    })
  }

  function handleAddBranch() {
    setForm((prev) => ({
      ...prev,
      branch: [...(Array.isArray(prev.branch) ? prev.branch : []), emptyBranch()],
    }))
  }

  function handleRemoveBranch(index) {
    setForm((prev) => ({
      ...prev,
      branch: (Array.isArray(prev.branch) ? prev.branch : []).filter((_, i) => i !== index),
    }))
  }

  async function handleResolveBranch(index) {
    const row = (Array.isArray(form.branch) ? form.branch : [])[index] || emptyBranch()
    const hasArea = String(row.area_name || '').trim().length > 0
    setError('')
    setBranchResolvingIndex(index)
    try {
      let area = String(row.area_name || '').trim()
      let lat = String(row.lat || '').trim()
      let lng = String(row.long || '').trim()

      // 1) If no area typed, try browser geolocation + reverse geocode
      if (!hasArea && typeof navigator !== 'undefined' && navigator.geolocation) {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          })
        })
        lat = Number(position.coords.latitude).toFixed(6)
        lng = Number(position.coords.longitude).toFixed(6)

        const revUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`
        const r = await fetch(revUrl)
        const data = await r.json()
        const addr = data.address || {}
        area =
          addr.suburb ||
          addr.neighbourhood ||
          addr.city_district ||
          addr.city ||
          addr.town ||
          addr.village ||
          area
      } else {
        // 2) If area is typed, search by text (Bahrain scoped)
        const query = area || ''
        if (!query) {
          setError('Enter branch area name first or allow location access.')
          return
        }
        const q = encodeURIComponent(`${query}, Bahrain`)
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${q}`)
        const data = await r.json()
        const hit = Array.isArray(data) ? data[0] : null
        if (!hit) {
          setError('Area not found. Try a more specific branch area name.')
          return
        }
        const addr = hit.address || {}
        area =
          addr.suburb ||
          addr.neighbourhood ||
          addr.city_district ||
          addr.city ||
          addr.town ||
          addr.village ||
          query
        lat = Number(hit.lat).toFixed(6)
        lng = Number(hit.lon).toFixed(6)
      }

      handleBranchChange(index, 'area_name', area)
      handleBranchChange(index, 'lat', lat)
      handleBranchChange(index, 'long', lng)
    } catch (err) {
      setError(err.message || 'Failed to resolve branch location')
    } finally {
      setBranchResolvingIndex(null)
    }
  }

  async function handleEventImageChange(e) {
    const file = e.target.files?.[0]
    if (!file || !user?.account_uuid) return
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (e.g. JPG, PNG).')
      return
    }
    setError('')
    setUploadingImage(true)
    try {
      const accountOrClient = editingClientId || user.account_uuid
      const url = await uploadEventImage(file, accountOrClient)
      setForm((prev) => ({ ...prev, image: url }))
    } catch (err) {
      setError(err.message || 'Image upload failed')
    } finally {
      setUploadingImage(false)
      e.target.value = ''
    }
  }

  async function handleClientImageChange(e) {
    const file = e.target.files?.[0]
    if (!file || !user?.account_uuid) return
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (e.g. JPG, PNG).')
      return
    }
    setError('')
    setUploadingClientImage(true)
    try {
      const accountOrClient = editingClientId || user.account_uuid
      const url = await uploadProfileImage(file, accountOrClient)
      setForm((prev) => ({ ...prev, client_image: url }))
    } catch (err) {
      setError(err.message || 'Image upload failed')
    } finally {
      setUploadingClientImage(false)
      e.target.value = ''
    }
  }

  async function handleHeaderImageEdit(e) {
    const file = e.target.files?.[0]
    const c = displayClient || clients[0]
    const clientUuid = c?.client_a_uuid
    if (!file || !clientUuid) return
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (e.g. JPG, PNG).')
      return
    }
    setError('')
    setSuccess({ supabase: false, pinecone: false })
    setPineconeError('')
    setUpdatingHeaderImage(true)
    try {
      const url = await uploadProfileImage(file, clientUuid)
      const patchForm = profileToForm(c)
      patchForm.client_image = url
      patchForm.client_type_choice = c.client_type === 'client' ? 'none' : (c.client_type || patchForm.client_type_choice)
      await updateProfile(patchForm, clientUuid, { skipPinecone: true })
      const refreshed = await getClientFull(clientUuid)
      setDisplayClient(refreshed || { ...c, client_image: url })
      setClients((prev) => prev.map((x) => (x.client_a_uuid === clientUuid ? { ...x, client_image: url } : x)))
    } catch (err) {
      setError(err.message || 'Failed to update profile image')
    } finally {
      setUpdatingHeaderImage(false)
      e.target.value = ''
    }
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
        <p>{clients.length === 0 ? 'Create your business profile.' : 'Update your business profile.'}</p>
      </section>

      <section className="clients-section">
        <div className="clients-section-header">
          <h2>Your Profile</h2>
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

        {!loading && !error && clients.length > 0 && !showCreateForm && !isEditing && (() => {
          const c = displayClient || clients[0]
          const name = c.business_name || c.name || 'Unnamed'
          const typeLabel = (c.client_type || 'business').replace(/_/g, ' ')
          const clientImageUrl = resolveClientImageUrl(c.client_image)
          const tagsArr = Array.isArray(c.tags) ? c.tags : (c.tags && typeof c.tags === 'string') ? c.tags.split(',').map(t => t.trim()).filter(Boolean) : []
          return (
            <div className="profile-view">
              <div className="profile-view-cover">
                <div className="profile-view-image-wrap">
                  {clientImageUrl ? (
                    <img src={clientImageUrl} alt={name} className="profile-view-image" />
                  ) : (
                    <div className="profile-view-image profile-view-image-placeholder">
                      <span className="profile-view-image-initial">{name.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  <input
                    ref={headerImageInputRef}
                    type="file"
                    accept="image/*"
                    className="profile-view-image-input"
                    onChange={handleHeaderImageEdit}
                  />
                  <button
                    type="button"
                    className="profile-view-image-edit"
                    onClick={() => headerImageInputRef.current?.click()}
                    disabled={updatingHeaderImage}
                  >
                    {updatingHeaderImage ? 'Updating...' : 'Edit photo'}
                  </button>
                </div>
                <h2 className="profile-view-name">{name}</h2>
                <span className="profile-view-type-pill">{typeLabel}</span>
              </div>
              <div className="profile-view-body">
                <div className="profile-view-content">
                  {c.description && (
                    <div className="profile-view-block">
                      <h4 className="profile-view-label">About</h4>
                      <p className="profile-view-description">{c.description}</p>
                    </div>
                  )}
                  <div className="profile-view-details">
                    {c.price_range && (
                      <div className="profile-view-detail">
                        <span className="profile-view-detail-label">Price range</span>
                        <span className="profile-view-detail-value">{c.price_range}</span>
                      </div>
                    )}
                    {c.timings && (
                      <div className="profile-view-detail">
                        <span className="profile-view-detail-label">Hours</span>
                        <span className="profile-view-detail-value">{c.timings}</span>
                      </div>
                    )}
                    {c.rating != null && c.rating !== '' && (
                      <div className="profile-view-detail">
                        <span className="profile-view-detail-label">Rating</span>
                        <span className="profile-view-detail-value">{c.rating}</span>
                      </div>
                    )}
                  </div>
                  {tagsArr.length > 0 && (
                    <div className="profile-view-block">
                      <h4 className="profile-view-label">Tags</h4>
                      <div className="profile-view-tags">
                        {tagsArr.map((tag, i) => (
                          <span key={i} className="profile-view-tag">{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="profile-view-qr-inline"
                  onClick={() => setExpandedQrClient(c)}
                  title="Tap to expand QR code"
                  aria-label={`Show QR code for ${name}`}
                >
                  <QRCodeSVG value={c.qrcode || c.client_a_uuid} size={140} level="M" />
                  <span className="profile-view-qr-inline-label">Tap to expand</span>
                </button>
              </div>
              <div className="profile-view-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleStartEdit(c.client_a_uuid)}
                  disabled={loadingClient === c.client_a_uuid}
                >
                  {loadingClient === c.client_a_uuid ? 'Loading...' : 'Update profile'}
                </button>
                <Link to="/" className="btn btn-outline">
                  Posts
                </Link>
                <button
                  type="button"
                  className="btn btn-danger-outline"
                  onClick={() => handleDelete(c.client_a_uuid)}
                  disabled={deletingId === c.client_a_uuid}
                >
                  {deletingId === c.client_a_uuid ? 'Deleting...' : 'Delete profile'}
                </button>
              </div>
            </div>
          )
        })()}

        {expandedQrClient && (
          <div
            className="qr-modal-backdrop"
            onClick={() => setExpandedQrClient(null)}
            role="presentation"
          >
            <div className="qr-modal-content" onClick={(e) => e.stopPropagation()}>
              <h3 className="qr-modal-title">{expandedQrClient.business_name || expandedQrClient.name || 'Profile'}</h3>
              <QRCodeSVG value={expandedQrClient.qrcode || expandedQrClient.client_a_uuid} size={220} level="M" className="qr-modal-svg" />
              <p className="qr-modal-id">{expandedQrClient.qrcode || expandedQrClient.client_a_uuid}</p>
              <button type="button" className="btn btn-sm btn-outline qr-modal-close" onClick={() => setExpandedQrClient(null)}>
                Close
              </button>
            </div>
          </div>
        )}

        {(showCreateForm || isEditing || (clients.length === 0 && !loading)) && (
          <form onSubmit={isEditing ? handleSubmitUpdate : handleSubmitCreate} className="profile-form">
            {clients.length > 0 && (
              <button
                type="button"
                className="back-link"
                onClick={isEditing ? handleCancelEdit : handleCancelCreate}
              >
                ← Back to profile
              </button>
            )}
            <h3>{isEditing ? 'Update Profile' : 'Create Profile'}</h3>
            {CLIENT_FIELDS.map((f) => (
              f.type === 'image_upload' ? (
                <div key={f.key} className="form-group client-image-group">
                  <span className="form-label">{f.label}</span>
                  <p className="form-hint">Upload an image from your device. It will be stored in Supabase.</p>
                  <div className="event-image-upload">
                    <label className="file-upload-label">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleClientImageChange}
                        disabled={uploadingClientImage}
                        className="event-image-input"
                      />
                      <span className="file-upload-btn">{uploadingClientImage ? 'Uploading…' : 'Choose image from device'}</span>
                    </label>
                    {form.client_image ? (
                      <div className="event-image-preview">
                        <img src={form.client_image} alt="Profile" />
                        <span className="event-image-url-note">Uploaded. Select another file to replace.</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <label key={f.key}>
                  {f.label} {f.required && '*'}
                  {f.type === 'textarea' ? (
                    <textarea name={f.key} value={form[f.key] || ''} onChange={handleChange} placeholder={f.placeholder} rows={3} />
                  ) : (
                    <input type={f.type} name={f.key} value={form[f.key] ?? ''} onChange={handleChange} placeholder={f.placeholder} required={f.required} />
                  )}
                </label>
              )
            ))}

            <div className="form-group">
              <span className="form-label">Type of Client</span>
              <p className="client-type-readonly" aria-live="polite">
                {form.client_type_choice === 'none' || !form.client_type_choice
                  ? 'Client'
                  : (form.client_type_choice || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </p>
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
                <div className="branch-section">
                  <div className="branch-section-header">
                    <h5>Branches</h5>
                    <button type="button" className="btn btn-sm btn-outline" onClick={handleAddBranch}>
                      Add Branch
                    </button>
                  </div>
                  {(Array.isArray(form.branch) ? form.branch : []).length === 0 && (
                    <p className="branch-empty">No branches added yet.</p>
                  )}
                  {(Array.isArray(form.branch) ? form.branch : []).map((b, index) => (
                    <div key={index} className="branch-row">
                      <label>
                        Area name
                        <input
                          type="text"
                          value={b.area_name || ''}
                          onChange={(e) => handleBranchChange(index, 'area_name', e.target.value)}
                          placeholder="e.g. Juffair, Manama"
                        />
                      </label>
                      <label>
                        Latitude
                        <input
                          type="text"
                          value={b.lat || ''}
                          onChange={(e) => handleBranchChange(index, 'lat', e.target.value)}
                          placeholder="26.2285"
                        />
                      </label>
                      <label>
                        Longitude
                        <input
                          type="text"
                          value={b.long || ''}
                          onChange={(e) => handleBranchChange(index, 'long', e.target.value)}
                          placeholder="50.5860"
                        />
                      </label>
                      <div className="branch-row-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() => handleResolveBranch(index)}
                          disabled={branchResolvingIndex === index}
                        >
                          {branchResolvingIndex === index ? 'Locating...' : 'Auto Locate'}
                        </button>
                        <button type="button" className="btn btn-sm btn-danger" onClick={() => handleRemoveBranch(index)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
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
                <div className="form-group event-image-group">
                  <span className="form-label">Event Image</span>
                  <p className="form-hint">Upload an image from your device. It will be stored in Supabase.</p>
                  <div className="event-image-upload">
                    <label className="file-upload-label">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleEventImageChange}
                        disabled={uploadingImage}
                        className="event-image-input"
                      />
                      <span className="file-upload-btn">{uploadingImage ? 'Uploading…' : 'Choose image from device'}</span>
                    </label>
                    {form.image ? (
                      <div className="event-image-preview">
                        <img src={form.image} alt="Event" />
                        <span className="event-image-url-note">Uploaded. Select another file to replace.</span>
                      </div>
                    ) : null}
                  </div>
                </div>
                {EVENT_FIELDS.filter((f) => f.type !== 'image').map((f) => (
                  <label key={f.key}>
                    {f.label} {f.required && '*'}
                    {f.type === 'select' ? (
                      <select name={f.key} value={form[f.key] || ''} onChange={handleChange} required={f.required}>
                        {f.options?.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : f.type === 'date' ? (
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

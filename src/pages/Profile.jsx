import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '../context/AuthContext'
import { getClientsByAccount, getClientFull, fetchTagsFromPinecone } from '../lib/clients'
import { submitProfile } from '../lib/submitProfile'
import { updateProfile } from '../lib/updateProfile'
import { uploadProfileImage, uploadEventImage, ensureProfileImagesBucket, ensureEventImagesBucket } from '../lib/profileImages'
import { api } from '../config/api'
import MapPicker from '../components/MapPicker'
import OwnerLocationPicker from '../components/OwnerLocationPicker'

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

const PRICE_PRESETS = [
  { label: 'Budget', value: '1-3 BHD' },
  { label: 'Mid', value: '3-7 BHD' },
  { label: 'Premium', value: '8-20 BHD' },
  { label: 'Luxury', value: '20+ BHD' },
]

const DEFAULT_HOURS = { open: '10:00', close: '22:00', is24: false }
const TAG_OPTIONS = [
  'sightseeing',
  'instagram',
  'leisure',
  'nature',
  'historical',
  'cultural',
  'adventure',
  'family-friendly',
]
const CUISINE_OPTIONS = [
  'Arabic / Middle Eastern',
  'Indian',
  'American',
  'Italian',
  'Chinese',
  'Japanese',
  'Thai',
  'Turkish',
  'Lebanese',
  'Filipino',
]
const MEAL_TYPE_OPTIONS = ['Breakfast', 'Lunch', 'Dinner', 'Snack']
const FOOD_TYPE_OPTIONS = [
  'Non-Vegetarian',
  'Vegetarian',
  'Vegan',
  'Seafood',
  'BBQ / Grilled',
  'Fast Food',
  'Healthy Food',
  'Street Food',
  'Desserts / Sweets',
  'Cafe / Bakery',
]

function normalizePriceRangeText(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/–/g, '-')
    .toLowerCase()
}

function parseTags(value) {
  return String(value || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => t.replace(/^#/, ''))
    .filter(Boolean)
}

function formatAllowedTags(value) {
  const optionMap = new Map(TAG_OPTIONS.map((t) => [t.toLowerCase(), t]))
  const seen = new Set()
  const normalized = []
  for (const tag of parseTags(value)) {
    const key = String(tag || '').toLowerCase()
    const allowed = optionMap.get(key)
    if (!allowed || seen.has(key)) continue
    seen.add(key)
    normalized.push(allowed)
  }
  return normalized.join(', ')
}

function parseCommaList(value) {
  const seen = new Set()
  const out = []
  for (const item of String(value || '').split(',')) {
    const normalized = String(item || '').trim()
    if (!normalized) continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(normalized)
  }
  return out
}

function toTwo(n) {
  return String(n).padStart(2, '0')
}

function to24Hour(h, m = '00', period = 'am') {
  let hour = Number(h)
  if (!Number.isFinite(hour)) return null
  const p = String(period || '').toLowerCase()
  if (p === 'pm' && hour < 12) hour += 12
  if (p === 'am' && hour === 12) hour = 0
  return `${toTwo(hour)}:${toTwo(Number(m) || 0)}`
}

function parseTimings(value) {
  const text = String(value || '').trim()
  if (!text) return null
  if (/24\s*hours?/i.test(text)) {
    return { ...DEFAULT_HOURS, is24: true }
  }
  const m24 = text.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/)
  if (m24) return { open: m24[1], close: m24[2], is24: false }
  const m12 = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i)
  if (m12) {
    const open = to24Hour(m12[1], m12[2] || '00', m12[3])
    const close = to24Hour(m12[4], m12[5] || '00', m12[6])
    if (open && close) return { open, close, is24: false }
  }
  return null
}

function timingsText(hours) {
  return hours.is24 ? '24 Hours' : `${hours.open} - ${hours.close}`
}

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
  lng: '',
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
  f.lng = p.lng != null ? String(p.lng) : (p.long != null ? String(p.long) : '')
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
  const [error, setError] = useState('')
  const [success, setSuccess] = useState({ supabase: false, pinecone: false })
  const [pineconeError, setPineconeError] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingClientId, setEditingClientId] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadingClientImage, setUploadingClientImage] = useState(false)
  const [clientImagePreview, setClientImagePreview] = useState('')
  const [eventImagePreview, setEventImagePreview] = useState('')
  const [pendingClientImageFile, setPendingClientImageFile] = useState(null)
  const [pendingEventImageFile, setPendingEventImageFile] = useState(null)
  const [hours, setHours] = useState(DEFAULT_HOURS)
  const [tagDraft, setTagDraft] = useState('')
  const [cuisineDraft, setCuisineDraft] = useState('')
  const [mealTypeDraft, setMealTypeDraft] = useState('')
  const [foodTypeDraft, setFoodTypeDraft] = useState('')
  const [expandedQrClient, setExpandedQrClient] = useState(null)
  const [updatingHeaderImage, setUpdatingHeaderImage] = useState(false)
  const headerImageInputRef = useRef(null)
  const clientImageInputRef = useRef(null)
  const eventImageInputRef = useRef(null)

  useEffect(() => {
    return () => {
      if (clientImagePreview?.startsWith('blob:')) URL.revokeObjectURL(clientImagePreview)
    }
  }, [clientImagePreview])

  useEffect(() => {
    return () => {
      if (eventImagePreview?.startsWith('blob:')) URL.revokeObjectURL(eventImagePreview)
    }
  }, [eventImagePreview])

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

  function handlePricePreset(value) {
    setForm((prev) => ({
      ...prev,
      price_range: value,
    }))
  }

  function isPresetActive(value) {
    return normalizePriceRangeText(form.price_range) === normalizePriceRangeText(value)
  }

  function toggleTagOption(tag) {
    const selected = parseTags(formatAllowedTags(form.tags))
    const key = String(tag || '').toLowerCase()
    const exists = selected.some((t) => t.toLowerCase() === key)
    const next = exists
      ? selected.filter((t) => t.toLowerCase() !== key)
      : [...selected, tag]
    setForm((prev) => ({ ...prev, tags: next.join(', ') }))
  }

  function isTagSelected(tag) {
    const selected = parseTags(formatAllowedTags(form.tags))
    return selected.some((t) => t.toLowerCase() === String(tag || '').toLowerCase())
  }

  function addRestaurantTag(raw) {
    const nextTag = String(raw || '').trim().replace(/^#/, '').replace(/\s+/g, '')
    if (!nextTag) return
    const existing = parseTags(form.tags)
    if (existing.some((t) => t.toLowerCase() === nextTag.toLowerCase())) return
    setForm((prev) => ({ ...prev, tags: [...existing, nextTag].join(', ') }))
  }

  function removeRestaurantTag(tagToRemove) {
    const next = parseTags(form.tags).filter((t) => t.toLowerCase() !== String(tagToRemove).toLowerCase())
    setForm((prev) => ({ ...prev, tags: next.join(', ') }))
  }

  function handleRestaurantTagKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault()
      if (!tagDraft.trim()) return
      addRestaurantTag(tagDraft)
      setTagDraft('')
    }
    if (e.key === 'Backspace' && !tagDraft.trim()) {
      const existing = parseTags(form.tags)
      const last = existing[existing.length - 1]
      if (last) removeRestaurantTag(last)
    }
  }

  function isCuisineSelected(value) {
    const selected = parseCommaList(form.cuisine)
    return selected.some((x) => x.toLowerCase() === String(value || '').toLowerCase())
  }

  function setCuisineList(nextList) {
    setForm((prev) => ({ ...prev, cuisine: nextList.join(', ') }))
  }

  function toggleCuisineOption(value) {
    const selected = parseCommaList(form.cuisine)
    const key = String(value || '').toLowerCase()
    const exists = selected.some((x) => x.toLowerCase() === key)
    const next = exists
      ? selected.filter((x) => x.toLowerCase() !== key)
      : [...selected, value]
    setCuisineList(next)
  }

  function removeCuisine(value) {
    const key = String(value || '').toLowerCase()
    const next = parseCommaList(form.cuisine).filter((x) => x.toLowerCase() !== key)
    setCuisineList(next)
  }

  function addManualCuisine(raw) {
    const manual = String(raw || '').trim()
    if (!manual) return
    const selected = parseCommaList(form.cuisine)
    if (selected.some((x) => x.toLowerCase() === manual.toLowerCase())) return
    setCuisineList([...selected, manual])
  }

  function handleCuisineDraftKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (!cuisineDraft.trim()) return
      addManualCuisine(cuisineDraft)
      setCuisineDraft('')
    }
  }

  function isMealTypeSelected(value) {
    const selected = parseCommaList(form.meal_type)
    return selected.some((x) => x.toLowerCase() === String(value || '').toLowerCase())
  }

  function setMealTypeList(nextList) {
    setForm((prev) => ({ ...prev, meal_type: nextList.join(', ') }))
  }

  function toggleMealTypeOption(value) {
    const selected = parseCommaList(form.meal_type)
    const key = String(value || '').toLowerCase()
    const exists = selected.some((x) => x.toLowerCase() === key)
    const next = exists
      ? selected.filter((x) => x.toLowerCase() !== key)
      : [...selected, value]
    setMealTypeList(next)
  }

  function removeMealType(value) {
    const key = String(value || '').toLowerCase()
    const next = parseCommaList(form.meal_type).filter((x) => x.toLowerCase() !== key)
    setMealTypeList(next)
  }

  function addManualMealType(raw) {
    const manual = String(raw || '').trim()
    if (!manual) return
    const selected = parseCommaList(form.meal_type)
    if (selected.some((x) => x.toLowerCase() === manual.toLowerCase())) return
    setMealTypeList([...selected, manual])
  }

  function handleMealTypeDraftKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (!mealTypeDraft.trim()) return
      addManualMealType(mealTypeDraft)
      setMealTypeDraft('')
    }
  }

  function isFoodTypeSelected(value) {
    const selected = parseCommaList(form.food_type)
    return selected.some((x) => x.toLowerCase() === String(value || '').toLowerCase())
  }

  function setFoodTypeList(nextList) {
    setForm((prev) => ({ ...prev, food_type: nextList.join(', ') }))
  }

  function toggleFoodTypeOption(value) {
    const selected = parseCommaList(form.food_type)
    const key = String(value || '').toLowerCase()
    const exists = selected.some((x) => x.toLowerCase() === key)
    const next = exists
      ? selected.filter((x) => x.toLowerCase() !== key)
      : [...selected, value]
    setFoodTypeList(next)
  }

  function removeFoodType(value) {
    const key = String(value || '').toLowerCase()
    const next = parseCommaList(form.food_type).filter((x) => x.toLowerCase() !== key)
    setFoodTypeList(next)
  }

  function addManualFoodType(raw) {
    const manual = String(raw || '').trim()
    if (!manual) return
    const selected = parseCommaList(form.food_type)
    if (selected.some((x) => x.toLowerCase() === manual.toLowerCase())) return
    setFoodTypeList([...selected, manual])
  }

  function handleFoodTypeDraftKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (!foodTypeDraft.trim()) return
      addManualFoodType(foodTypeDraft)
      setFoodTypeDraft('')
    }
  }

  useEffect(() => {
    const parsed = parseTimings(form.timings)
    if (!parsed) return
    setHours((prev) => (
      prev.open === parsed.open && prev.close === parsed.close && prev.is24 === parsed.is24
        ? prev
        : parsed
    ))
  }, [form.timings])

  function handleHours24Toggle(e) {
    const checked = !!e.target.checked
    setHours((prev) => {
      const next = { ...prev, is24: checked }
      setForm((f) => ({ ...f, timings: timingsText(next) }))
      return next
    })
  }

  function handleOpenTimeChange(e) {
    const open = e.target.value
    setHours((prev) => {
      const next = { ...prev, open }
      setForm((f) => ({ ...f, timings: timingsText(next) }))
      return next
    })
  }

  function handleCloseTimeChange(e) {
    const close = e.target.value
    setHours((prev) => {
      const next = { ...prev, close }
      setForm((f) => ({ ...f, timings: timingsText(next) }))
      return next
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

  async function handleEventImageChange(e) {
    const file = e.target.files?.[0]
    if (!file || !user?.account_uuid) return
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (e.g. JPG, PNG).')
      return
    }
    setError('')
    const localPreview = URL.createObjectURL(file)
    setEventImagePreview((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
      return localPreview
    })
    setPendingEventImageFile(file)
    e.target.value = ''
  }

  async function handleClientImageChange(e) {
    const file = e.target.files?.[0]
    if (!file || !user?.account_uuid) return
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (e.g. JPG, PNG).')
      return
    }
    setError('')
    const localPreview = URL.createObjectURL(file)
    setClientImagePreview((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
      return localPreview
    })
    setPendingClientImageFile(file)
    e.target.value = ''
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
      setClientImagePreview('')
      setEventImagePreview('')
      setPendingClientImageFile(null)
      setPendingEventImageFile(null)
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
    setClientImagePreview('')
    setEventImagePreview('')
    setPendingClientImageFile(null)
    setPendingEventImageFile(null)
  }

  function handleCancelCreate() {
    setShowCreateForm(false)
    setForm(emptyForm())
    setClientImagePreview('')
    setEventImagePreview('')
    setPendingClientImageFile(null)
    setPendingEventImageFile(null)
  }

  async function uploadPendingImages(baseForm, ownerId) {
    let next = { ...baseForm }
    if (pendingClientImageFile) {
      setUploadingClientImage(true)
      const url = await uploadProfileImage(pendingClientImageFile, ownerId)
      next.client_image = url
    }
    if (pendingEventImageFile) {
      setUploadingImage(true)
      const url = await uploadEventImage(pendingEventImageFile, ownerId)
      next.image = url
    }
    return next
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
      const normalizedTags = form.client_type_choice === 'restaurant'
        ? parseTags(form.tags).join(', ')
        : formatAllowedTags(form.tags)
      const formWithUploads = await uploadPendingImages({ ...form, tags: normalizedTags }, user.account_uuid)
      const { supabaseOk, pineconeOk, pineconeError: pe } = await submitProfile(formWithUploads, user.account_uuid)
      setSuccess({ supabase: !!supabaseOk, pinecone: !!pineconeOk })
      if (!pineconeOk && pe) setPineconeError(pe)
      getClientsByAccount(user.account_uuid).then(setClients)
      setTimeout(() => {
        setShowCreateForm(false)
        setForm(emptyForm())
        setSuccess({ supabase: false, pinecone: false })
        setPineconeError('')
        setClientImagePreview('')
        setEventImagePreview('')
        setPendingClientImageFile(null)
        setPendingEventImageFile(null)
      }, 2000)
    } catch (err) {
      setError(err.message || 'Failed to save profile')
    } finally {
      setLoading(false)
      setUploadingClientImage(false)
      setUploadingImage(false)
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
      const normalizedTags = form.client_type_choice === 'restaurant'
        ? parseTags(form.tags).join(', ')
        : formatAllowedTags(form.tags)
      const formWithUploads = await uploadPendingImages({ ...form, tags: normalizedTags }, editingClientId)
      const { supabaseOk, pineconeOk, pineconeError: pe } = await updateProfile(formWithUploads, editingClientId)
      setSuccess({ supabase: !!supabaseOk, pinecone: !!pineconeOk })
      if (!pineconeOk && pe) setPineconeError(pe)
      getClientsByAccount(user.account_uuid).then(setClients)
      setTimeout(() => {
        setEditingClientId(null)
        setForm(emptyForm())
        setSuccess({ supabase: false, pinecone: false })
        setPineconeError('')
        setClientImagePreview('')
        setEventImagePreview('')
        setPendingClientImageFile(null)
        setPendingEventImageFile(null)
      }, 2000)
    } catch (err) {
      setError(err.message || 'Failed to update profile')
    } finally {
      setLoading(false)
      setUploadingClientImage(false)
      setUploadingImage(false)
    }
  }

  const showRestaurantFields = form.client_type_choice === 'restaurant'
  const showPlaceFields = form.client_type_choice === 'place'
  const showEventOrganizerFields = form.client_type_choice === 'event_organizer'

  if (!user) return null

  const isEditing = !!editingClientId

  return (
    <div className="pf-page">
      {/* ── Toasts ── */}
      {error && <div className="pf-toast pf-toast-error">{error}</div>}
      {(success.supabase || success.pinecone) && (
        <div className="pf-toast pf-toast-success">
          Profile saved successfully!
          {pineconeError && <span className="pf-toast-sub"> (search index pending)</span>}
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && clients.length === 0 && (
        <div className="pf-skeleton-wrap">
          <div className="pf-skeleton pf-skeleton-banner" />
          <div className="pf-skeleton-body">
            <div className="pf-skeleton pf-skeleton-avatar" />
            <div className="pf-skeleton-lines">
              <div className="pf-skeleton pf-skeleton-line w60" />
              <div className="pf-skeleton pf-skeleton-line w40" />
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ PROFILE CARD (read-only view) ══════════════ */}
      {!loading && clients.length > 0 && !showCreateForm && !isEditing && (() => {
        const c = displayClient || clients[0]
        const name = c.business_name || c.name || 'Unnamed'
        const typeLabel = (c.client_type || 'business').replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())
        const clientImageUrl = resolveClientImageUrl(c.client_image)
        const tagsArr = Array.isArray(c.tags) ? c.tags : (c.tags && typeof c.tags === 'string') ? c.tags.split(',').map(t => t.trim()).filter(Boolean) : []
        const initial = name.charAt(0).toUpperCase()
        const qrValue = String(c.qrcode || c.client_a_uuid || '').trim()

        const stats = [
          c.price_range && { icon: '💰', label: 'Price', value: c.price_range },
          c.timings    && { icon: '🕐', label: 'Hours',  value: c.timings },
          c.cuisine    && { icon: '🍽️', label: 'Cuisine', value: c.cuisine },
          c.category   && { icon: '📍', label: 'Category', value: c.category },
        ].filter(Boolean)

        return (
          <>
            <div className="pf-card">
              <div className="pf-card-accent" aria-hidden />

              <div className="pf-hero">
                <div className="pf-hero-main">
                  <div className="pf-identity">
                    <div className="pf-avatar-wrap">
                      {clientImageUrl
                        ? <img src={clientImageUrl} alt={name} className="pf-avatar" />
                        : <div className="pf-avatar pf-avatar-init">{initial}</div>
                      }
                      <input ref={headerImageInputRef} type="file" accept="image/*" className="pf-hidden-input" onChange={handleHeaderImageEdit} />
                      <button
                        type="button"
                        className="pf-avatar-edit"
                        onClick={() => headerImageInputRef.current?.click()}
                        disabled={updatingHeaderImage}
                        title="Change photo"
                        aria-label="Change photo"
                      >
                        {updatingHeaderImage
                          ? <span className="pf-spinner" aria-hidden />
                          : <CameraIcon size={14} />
                        }
                      </button>
                    </div>

                    <div className="pf-identity-info">
                      <div className="pf-name-row">
                        <h1 className="pf-name">{name}</h1>
                        <span className="pf-type-chip">{typeLabel}</span>
                      </div>
                      {c.description ? (
                        <p className="pf-tagline">{c.description}</p>
                      ) : (
                        <p className="pf-tagline pf-tagline-empty">Add a short description to make your profile stand out.</p>
                      )}
                    </div>
                  </div>

                  <div className="pf-identity-actions">
                    <button
                      type="button"
                      className="pf-btn pf-btn-primary"
                      onClick={() => handleStartEdit(c.client_a_uuid)}
                      disabled={loadingClient === c.client_a_uuid}
                    >
                      {loadingClient === c.client_a_uuid
                        ? <><span className="pf-spinner" aria-hidden /> Loading…</>
                        : <>✏️ Edit Profile</>
                      }
                    </button>
                    <Link to="/posts" className="pf-btn pf-btn-ghost">📋 My Posts</Link>
                  </div>
                </div>

                <div className="pf-qr-panel">
                  <span className="pf-section-label">Share Profile</span>
                  <div className="pf-qr-subtitle">Scan to open this business profile instantly.</div>
                  <div className="pf-qr-block" onClick={() => qrValue && setExpandedQrClient(c)} role="button" tabIndex={0} aria-label="Expand QR code" onKeyDown={(e) => e.key === 'Enter' && qrValue && setExpandedQrClient(c)}>
                    {qrValue ? (
                      <>
                        <QRCodeSVG
                          value={qrValue}
                          size={132}
                          level="M"
                          bgColor="#ffffff"
                          fgColor="#111111"
                          marginSize={4}
                        />
                        <span className="pf-qr-hint">Tap to expand</span>
                      </>
                    ) : (
                      <span className="pf-qr-hint">QR not available yet</span>
                    )}
                  </div>
                </div>
              </div>

              {stats.length > 0 && (
                <div className="pf-stats">
                  {stats.map((s, i) => (
                    <div key={i} className="pf-stat">
                      <span className="pf-stat-icon">{s.icon}</span>
                      <div>
                        <span className="pf-stat-label">{s.label}</span>
                        <span className="pf-stat-value">{s.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="pf-body">
                <div className={`pf-section pf-tags-panel${tagsArr.length === 0 ? ' is-empty' : ''}`}>
                  <span className="pf-section-label">Tags</span>
                  {tagsArr.length > 0 ? (
                    <div className="pf-tags">
                      {tagsArr.map((tag, i) => <span key={i} className="pf-tag">#{tag}</span>)}
                    </div>
                  ) : (
                    <p className="pf-empty-text">No tags added yet.</p>
                  )}
                </div>
              </div>
            </div>

            {/* QR modal */}
            {expandedQrClient && (
              <div className="pf-modal-backdrop" onClick={() => setExpandedQrClient(null)} role="presentation">
                <div className="pf-modal" onClick={(e) => e.stopPropagation()}>
                  <h3 className="pf-modal-title">{expandedQrClient.business_name || expandedQrClient.name || 'Profile'}</h3>
                  <QRCodeSVG
                    value={String(expandedQrClient.qrcode || expandedQrClient.client_a_uuid || '').trim()}
                    size={260}
                    level="M"
                    bgColor="#ffffff"
                    fgColor="#111111"
                    marginSize={4}
                  />
                  <p className="pf-modal-id">{String(expandedQrClient.qrcode || expandedQrClient.client_a_uuid || '').trim()}</p>
                  <button type="button" className="pf-btn pf-btn-ghost" onClick={() => setExpandedQrClient(null)}>Close</button>
                </div>
              </div>
            )}
          </>
        )
      })()}

      {/* ══════════════ EDIT / CREATE FORM ══════════════ */}
      {(showCreateForm || isEditing || (clients.length === 0 && !loading)) && (
        <form onSubmit={isEditing ? handleSubmitUpdate : handleSubmitCreate} className="pf-form">

          {/* Form header */}
          <div className="pf-form-header">
            {clients.length > 0 && (
              <button type="button" className="pf-back" onClick={isEditing ? handleCancelEdit : handleCancelCreate}>
                ← Back
              </button>
            )}
            <div>
              <h2 className="pf-form-title">{isEditing ? 'Update Profile' : 'Create your profile'}</h2>
              <p className="pf-form-sub">Fill in your business details below.</p>
            </div>
            {form.client_type_choice && form.client_type_choice !== 'none' && (
              <span className="pf-type-chip pf-type-chip-sm">
                {(form.client_type_choice).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
            )}
          </div>

          <div className="pf-form-layout">
            {/* ── Left: photo widget ── */}
            <div className="pf-form-photo-col">
              <div
                className="pf-photo-widget"
                role="button"
                tabIndex={0}
                onClick={() => !uploadingClientImage && clientImageInputRef.current?.click()}
                onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !uploadingClientImage) { e.preventDefault(); clientImageInputRef.current?.click() } }}
                aria-label="Upload business photo"
              >
                <input ref={clientImageInputRef} type="file" accept="image/*" onChange={handleClientImageChange} disabled={uploadingClientImage} className="pf-hidden-input" aria-hidden />
                {(clientImagePreview || form.client_image) ? (
                  <>
                    <img src={clientImagePreview || form.client_image} alt="Profile" className="pf-photo-img" />
                    <div className="pf-photo-overlay">
                      {uploadingClientImage ? <span className="pf-spinner pf-spinner-lg" /> : <><CameraIcon size={20} /><span>Change photo</span></>}
                    </div>
                  </>
                ) : (
                  <div className="pf-photo-empty">
                    <CameraIcon size={36} />
                    <span className="pf-photo-empty-title">{uploadingClientImage ? 'Uploading…' : 'Add logo / photo'}</span>
                    <span className="pf-photo-empty-hint">Click to upload</span>
                  </div>
                )}
              </div>
              <p className="pf-photo-tip">JPG, PNG or WebP · Max 5 MB</p>
            </div>

            {/* ── Right: fields ── */}
            <div className="pf-form-fields-col">

              {/* Core info section */}
              <div className="pf-section-block">
                <div className="pf-section-head">
                  <span className="pf-section-head-icon">🏢</span>
                  <span className="pf-section-head-label">Business Info</span>
                </div>
                <div className="pf-grid">
                  <div className="pf-field pf-field-full">
                    <label className="pf-label" htmlFor="f-business_name">Business Name <span className="pf-required">*</span></label>
                    <input id="f-business_name" className="pf-input" type="text" name="business_name" value={form.business_name || ''} onChange={handleChange} placeholder="Your business name" required />
                  </div>
                  <div className="pf-field pf-field-full">
                    <label className="pf-label" htmlFor="f-description">Description</label>
                    <textarea id="f-description" className="pf-input pf-textarea" name="description" value={form.description || ''} onChange={handleChange} placeholder="What makes your business special?" rows={3} />
                  </div>
                  <div className="pf-field">
                    <label className="pf-label" htmlFor="f-price_range">Price Range</label>
                    <div className="pf-price-range">
                      <div className="pf-price-preset-list">
                        {PRICE_PRESETS.map((preset) => (
                          <button
                            key={preset.value}
                            type="button"
                            className={`pf-price-preset ${isPresetActive(preset.value) ? 'is-active' : ''}`}
                            onClick={() => handlePricePreset(preset.value)}
                          >
                            <span>{preset.label}</span>
                            <small>{preset.value}</small>
                          </button>
                        ))}
                      </div>
                      <input
                        id="f-price_range"
                        className="pf-input pf-price-custom-input"
                        type="text"
                        name="price_range"
                        value={form.price_range || ''}
                        onChange={handleChange}
                        placeholder="Custom e.g. 8-15 BHD"
                      />
                    </div>
                  </div>
                  <div className="pf-field">
                    <label className="pf-label" htmlFor="f-timings">Opening Hours</label>
                    <div className="pf-hours-wrap">
                      <label className="pf-checkbox-label">
                        <input
                          type="checkbox"
                          className="pf-checkbox"
                          checked={hours.is24}
                          onChange={handleHours24Toggle}
                        />
                        <span>24 Hours</span>
                      </label>
                      <div className="pf-hours-row">
                        <input
                          id="f-opening_time"
                          className="pf-input"
                          type="time"
                          value={hours.open}
                          onChange={handleOpenTimeChange}
                          disabled={hours.is24}
                        />
                        <span className="pf-hours-sep">to</span>
                        <input
                          id="f-closing_time"
                          className="pf-input"
                          type="time"
                          value={hours.close}
                          onChange={handleCloseTimeChange}
                          disabled={hours.is24}
                        />
                      </div>
                      <input id="f-timings" type="hidden" name="timings" value={form.timings || ''} readOnly />
                    </div>
                  </div>
                  <div className="pf-field">
                    <label className="pf-label" htmlFor="f-tags">Tags</label>
                    {showRestaurantFields ? (
                      <div className="pf-tags-input-wrap">
                        <div className="pf-tag-options" id="f-tags">
                          {parseTags(form.tags).map((tag) => (
                            <span key={tag.toLowerCase()} className="pf-cuisine-chip">
                              <span>#{tag}</span>
                              <button type="button" onClick={() => removeRestaurantTag(tag)} aria-label={`Remove ${tag}`}>×</button>
                            </span>
                          ))}
                          <input
                            className="pf-tags-draft"
                            type="text"
                            value={tagDraft}
                            onChange={(e) => setTagDraft(e.target.value)}
                            onKeyDown={handleRestaurantTagKeyDown}
                            onBlur={() => {
                              if (tagDraft.trim()) {
                                addRestaurantTag(tagDraft)
                                setTagDraft('')
                              }
                            }}
                            placeholder="Add your own tags"
                          />
                        </div>
                        <input type="hidden" name="tags" value={parseTags(form.tags).join(', ')} readOnly />
                      </div>
                    ) : (
                      <div className="pf-tags-input-wrap">
                        <div className="pf-tag-options" id="f-tags">
                          {TAG_OPTIONS.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              className={`pf-tag-option ${isTagSelected(tag) ? 'is-active' : ''}`}
                              onClick={() => toggleTagOption(tag)}
                            >
                              #{tag}
                            </button>
                          ))}
                        </div>
                        <input type="hidden" name="tags" value={formatAllowedTags(form.tags)} readOnly />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Location section */}
              <div className="pf-section-block">
                <div className="pf-section-head">
                  <span className="pf-section-head-icon">📍</span>
                  <span className="pf-section-head-label">Location</span>
                </div>
                <OwnerLocationPicker
                  latitude={form.lat}
                  longitude={form.lng || form.long}
                  onLocationChange={({ latitude, longitude }) => {
                    setForm((prev) => ({ ...prev, lat: latitude, lng: longitude, long: longitude }))
                  }}
                />
                <div className="pf-grid" style={{ marginTop: '0.75rem' }}>
                  <div className="pf-field">
                    <label className="pf-label" htmlFor="f-lat">Latitude</label>
                    <input id="f-lat" className="pf-input" type="text" name="lat" value={form.lat || ''} onChange={handleChange} placeholder="26.2285" inputMode="decimal" />
                  </div>
                  <div className="pf-field">
                    <label className="pf-label" htmlFor="f-lng">Longitude</label>
                    <input id="f-lng" className="pf-input" type="text" name="lng" value={form.lng || form.long || ''} onChange={handleChange} placeholder="50.5860" inputMode="decimal" />
                  </div>
                </div>
                {showRestaurantFields && (
                  <>
                    <div className="pf-location-add-branch">
                      <button type="button" className="pf-btn pf-btn-sm pf-btn-ghost" onClick={handleAddBranch}>+ Add Branch</button>
                    </div>
                    {(Array.isArray(form.branch) ? form.branch : []).length === 0 ? null : (
                      <div className="pf-branches">
                        {(Array.isArray(form.branch) ? form.branch : []).map((b, index) => (
                          <div key={index} className="pf-branch-card">
                            <div className="pf-grid" style={{ marginBottom: '0.75rem' }}>
                              <div className="pf-field pf-field-full">
                                <label className="pf-label">Area name</label>
                                <input className="pf-input" type="text" value={b.area_name || ''} onChange={(e) => handleBranchChange(index, 'area_name', e.target.value)} placeholder="e.g. Juffair, Manama" />
                              </div>
                            </div>
                            <MapPicker
                              lat={b.lat}
                              lng={b.long}
                              height="260px"
                              onChange={(lat, lng, areaName) => {
                                handleBranchChange(index, 'lat', lat)
                                handleBranchChange(index, 'long', lng)
                                if (areaName && !b.area_name) handleBranchChange(index, 'area_name', areaName)
                              }}
                            />
                            <div className="pf-grid" style={{ marginTop: '0.75rem' }}>
                              <div className="pf-field">
                                <label className="pf-label">Latitude</label>
                                <input className="pf-input" type="text" value={b.lat || ''} onChange={(e) => handleBranchChange(index, 'lat', e.target.value)} placeholder="26.2285" inputMode="decimal" />
                              </div>
                              <div className="pf-field">
                                <label className="pf-label">Longitude</label>
                                <input className="pf-input" type="text" value={b.long || ''} onChange={(e) => handleBranchChange(index, 'long', e.target.value)} placeholder="50.5860" inputMode="decimal" />
                              </div>
                            </div>
                            <div className="pf-branch-actions">
                              <button type="button" className="pf-btn pf-btn-sm pf-btn-danger" onClick={() => handleRemoveBranch(index)}>Remove</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Restaurant-specific */}
              {showRestaurantFields && (
                <div className="pf-section-block">
                  <div className="pf-section-head">
                    <span className="pf-section-head-icon">🍽️</span>
                    <span className="pf-section-head-label">Restaurant Details</span>
                  </div>
                  <div className="pf-grid">
                    {RESTAURANT_FIELDS.filter(f => f.type !== 'checkbox').map((f) => (
                      <div key={f.key} className={`pf-field${(f.key === 'cuisine' || f.key === 'meal_type' || f.key === 'food_type') ? ' pf-field-full' : ''}`}>
                        <label className="pf-label" htmlFor={`f-${f.key}`}>{f.label}{f.required && <span className="pf-required"> *</span>}</label>
                        {f.key === 'cuisine' ? (
                          <div className="pf-tags-input-wrap">
                            <div className="pf-tag-options">
                              {CUISINE_OPTIONS.map((option) => (
                                <button
                                  key={option}
                                  type="button"
                                  className={`pf-tag-option ${isCuisineSelected(option) ? 'is-active' : ''}`}
                                  onClick={() => toggleCuisineOption(option)}
                                >
                                  {option}
                                </button>
                              ))}
                            </div>
                            {parseCommaList(form.cuisine).length > 0 && (
                              <div className="pf-cuisine-selected">
                                {parseCommaList(form.cuisine).map((item) => (
                                  <span key={item.toLowerCase()} className="pf-cuisine-chip">
                                    <span>{item}</span>
                                    <button type="button" onClick={() => removeCuisine(item)} aria-label={`Remove ${item}`}>×</button>
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="pf-cuisine-manual-row">
                              <input
                                id="f-cuisine"
                                className="pf-input"
                                type="text"
                                value={cuisineDraft}
                                onChange={(e) => setCuisineDraft(e.target.value)}
                                onKeyDown={handleCuisineDraftKeyDown}
                                placeholder="Add cuisine manually"
                              />
                              <button
                                type="button"
                                className="pf-btn pf-btn-sm pf-btn-ghost"
                                onClick={() => {
                                  addManualCuisine(cuisineDraft)
                                  setCuisineDraft('')
                                }}
                              >
                                Add manually
                              </button>
                            </div>
                            <input type="hidden" name="cuisine" value={form.cuisine || ''} readOnly />
                          </div>
                        ) : f.key === 'meal_type' ? (
                          <div className="pf-tags-input-wrap">
                            <div className="pf-tag-options">
                              {MEAL_TYPE_OPTIONS.map((option) => (
                                <button
                                  key={option}
                                  type="button"
                                  className={`pf-tag-option ${isMealTypeSelected(option) ? 'is-active' : ''}`}
                                  onClick={() => toggleMealTypeOption(option)}
                                >
                                  {option}
                                </button>
                              ))}
                            </div>
                            {parseCommaList(form.meal_type).length > 0 && (
                              <div className="pf-cuisine-selected">
                                {parseCommaList(form.meal_type).map((item) => (
                                  <span key={item.toLowerCase()} className="pf-cuisine-chip">
                                    <span>{item}</span>
                                    <button type="button" onClick={() => removeMealType(item)} aria-label={`Remove ${item}`}>×</button>
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="pf-cuisine-manual-row">
                              <input
                                id="f-meal_type"
                                className="pf-input"
                                type="text"
                                value={mealTypeDraft}
                                onChange={(e) => setMealTypeDraft(e.target.value)}
                                onKeyDown={handleMealTypeDraftKeyDown}
                                placeholder="Add meal type manually"
                              />
                              <button
                                type="button"
                                className="pf-btn pf-btn-sm pf-btn-ghost"
                                onClick={() => {
                                  addManualMealType(mealTypeDraft)
                                  setMealTypeDraft('')
                                }}
                              >
                                Add manually
                              </button>
                            </div>
                            <input type="hidden" name="meal_type" value={form.meal_type || ''} readOnly />
                          </div>
                        ) : f.key === 'food_type' ? (
                          <div className="pf-tags-input-wrap">
                            <div className="pf-tag-options">
                              {FOOD_TYPE_OPTIONS.map((option) => (
                                <button
                                  key={option}
                                  type="button"
                                  className={`pf-tag-option ${isFoodTypeSelected(option) ? 'is-active' : ''}`}
                                  onClick={() => toggleFoodTypeOption(option)}
                                >
                                  {option}
                                </button>
                              ))}
                            </div>
                            {parseCommaList(form.food_type).length > 0 && (
                              <div className="pf-cuisine-selected">
                                {parseCommaList(form.food_type).map((item) => (
                                  <span key={item.toLowerCase()} className="pf-cuisine-chip">
                                    <span>{item}</span>
                                    <button type="button" onClick={() => removeFoodType(item)} aria-label={`Remove ${item}`}>×</button>
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="pf-cuisine-manual-row">
                              <input
                                id="f-food_type"
                                className="pf-input"
                                type="text"
                                value={foodTypeDraft}
                                onChange={(e) => setFoodTypeDraft(e.target.value)}
                                onKeyDown={handleFoodTypeDraftKeyDown}
                                placeholder="Add food type manually"
                              />
                              <button
                                type="button"
                                className="pf-btn pf-btn-sm pf-btn-ghost"
                                onClick={() => {
                                  addManualFoodType(foodTypeDraft)
                                  setFoodTypeDraft('')
                                }}
                              >
                                Add manually
                              </button>
                            </div>
                            <input type="hidden" name="food_type" value={form.food_type || ''} readOnly />
                          </div>
                        ) : (
                          <input id={`f-${f.key}`} className="pf-input" type="text" name={f.key} value={form[f.key] || ''} onChange={handleChange} placeholder={f.placeholder} required={f.required} />
                        )}
                      </div>
                    ))}
                    <div className="pf-field pf-field-checkbox">
                      <label className="pf-checkbox-label">
                        <input type="checkbox" name="isfoodtruck" checked={form.isfoodtruck || false} onChange={handleChange} className="pf-checkbox" />
                        <span>This is a food truck</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Place-specific */}
              {showPlaceFields && (
                <div className="pf-section-block">
                  <div className="pf-section-head">
                    <span className="pf-section-head-icon">🗺️</span>
                    <span className="pf-section-head-label">Place Details</span>
                  </div>
                  <div className="pf-grid">
                    {PLACE_CLIENT_FIELDS.map((f) => (
                      <div key={f.key} className="pf-field">
                        <label className="pf-label" htmlFor={`f-${f.key}`}>{f.label}{f.required && <span className="pf-required"> *</span>}</label>
                        {f.type === 'select'
                          ? <select id={`f-${f.key}`} className="pf-input" name={f.key} value={form[f.key] || ''} onChange={handleChange} required={f.required}>
                              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          : <input id={`f-${f.key}`} className="pf-input" type="text" name={f.key} value={form[f.key] || ''} onChange={handleChange} placeholder={f.placeholder} required={f.required} />
                        }
                      </div>
                    ))}
                    {PLACE_FIELDS.map((f) => (
                      <div key={f.key} className={`pf-field${f.type === 'textarea' ? ' pf-field-full' : ''}`}>
                        <label className="pf-label" htmlFor={`f-${f.key}`}>{f.label}{f.required && <span className="pf-required"> *</span>}</label>
                        {f.type === 'textarea'
                          ? <textarea id={`f-${f.key}`} className="pf-input pf-textarea" name={f.key} value={form[f.key] || ''} onChange={handleChange} placeholder={f.placeholder} rows={3} />
                          : <input id={`f-${f.key}`} className="pf-input" type={f.type || 'text'} name={f.key} value={form[f.key] || ''} onChange={handleChange} placeholder={f.placeholder} required={f.required} />
                        }
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Event-organizer-specific */}
              {showEventOrganizerFields && (
                <div className="pf-section-block">
                  <div className="pf-section-head">
                    <span className="pf-section-head-icon">🎪</span>
                    <span className="pf-section-head-label">Event Organizer Details</span>
                  </div>
                  <div className="pf-grid">
                    {EVENT_ORGANIZER_FIELDS.map((f) => (
                      <div key={f.key} className="pf-field">
                        <label className="pf-label" htmlFor={`f-${f.key}`}>{f.label}{f.required && <span className="pf-required"> *</span>}</label>
                        {f.type === 'select'
                          ? <select id={`f-${f.key}`} className="pf-input" name={f.key} value={form[f.key] || ''} onChange={handleChange} required={f.required}>
                              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          : <input id={`f-${f.key}`} className="pf-input" type="text" name={f.key} value={form[f.key] || ''} onChange={handleChange} placeholder={f.placeholder} required={f.required} />
                        }
                      </div>
                    ))}
                  </div>

                  <div className="pf-section-head" style={{ marginTop: '1.5rem' }}>
                    <span className="pf-section-head-icon">📅</span>
                    <span className="pf-section-head-label">Event Details</span>
                  </div>
                  {/* Event image */}
                  <div className="pf-event-image-row">
                    <div
                      className="pf-event-photo-widget"
                      role="button"
                      tabIndex={0}
                      onClick={() => !uploadingImage && eventImageInputRef.current?.click()}
                      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !uploadingImage) { e.preventDefault(); eventImageInputRef.current?.click() } }}
                      aria-label="Upload event image"
                    >
                      <input ref={eventImageInputRef} type="file" accept="image/*" onChange={handleEventImageChange} disabled={uploadingImage} className="pf-hidden-input" aria-hidden />
                      {(eventImagePreview || form.image) ? (
                        <>
                          <img src={eventImagePreview || form.image} alt="Event" className="pf-photo-img" />
                          <div className="pf-photo-overlay">
                            {uploadingImage ? <span className="pf-spinner pf-spinner-lg" /> : <><CameraIcon size={16} /><span>Change</span></>}
                          </div>
                        </>
                      ) : (
                        <div className="pf-photo-empty">
                          <CameraIcon size={24} />
                          <span className="pf-photo-empty-title">{uploadingImage ? 'Uploading…' : 'Event image'}</span>
                          <span className="pf-photo-empty-hint">Click to upload</span>
                        </div>
                      )}
                    </div>
                    <div className="pf-grid pf-event-fields">
                      {EVENT_FIELDS.filter((f) => f.type !== 'image').map((f) => (
                        <div key={f.key} className={`pf-field${f.type === 'textarea' ? ' pf-field-full' : ''}`}>
                          <label className="pf-label" htmlFor={`f-${f.key}`}>{f.label}{f.required && <span className="pf-required"> *</span>}</label>
                          {f.type === 'select'
                            ? <select id={`f-${f.key}`} className="pf-input" name={f.key} value={form[f.key] || ''} onChange={handleChange} required={f.required}>
                                {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            : <input id={`f-${f.key}`} className="pf-input" type={f.type === 'date' ? 'date' : f.type === 'time' ? 'time' : 'text'} name={f.key} value={form[f.key] || ''} onChange={handleChange} placeholder={f.placeholder} required={f.required} />
                          }
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Submit */}
              <div className="pf-form-footer">
                <button type="submit" className="pf-btn pf-btn-primary pf-btn-lg" disabled={loading}>
                  {loading ? <><span className="pf-spinner" aria-hidden /> Saving…</> : (isEditing ? '✓ Save changes' : '✓ Create profile')}
                </button>
                {clients.length > 0 && (
                  <button type="button" className="pf-btn pf-btn-ghost" onClick={isEditing ? handleCancelEdit : handleCancelCreate}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}

function CameraIcon({ size = 24 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

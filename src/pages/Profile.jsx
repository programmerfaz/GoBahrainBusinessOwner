import { useState, useEffect, useRef, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './ProfileDashboard.css'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '../context/AuthContext'
import { getClientsByAccount, getClientFull, fetchTagsFromPinecone } from '../lib/clients'
import { getPostsByClient } from '../lib/posts'
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

/** Orbit band items for the profile “What your listing says” radial (order matches previous inline logic). */
function buildAboutOrbitItems(c) {
  if (!c || typeof c !== 'object') return []
  const items = []
  if (String(c.price_range || '').trim()) {
    const pr = String(c.price_range).replace(/\s*BHD\s*$/i, '').trim()
    items.push({
      key: 'price_range',
      label: 'Price Range',
      subline: 'What visitors can expect',
      value: `${pr} BHD`,
      icon: 'price',
    })
  }
  if (String(c.timings || '').trim()) {
    items.push({
      key: 'timings',
      label: 'Opening Hours',
      subline: "When you're open",
      value: String(c.timings).trim(),
      icon: 'clock',
    })
  }
  if (String(c.cuisine || '').trim()) {
    items.push({
      key: 'cuisine',
      label: 'Cuisine',
      subline: "What's on the menu",
      value: String(c.cuisine).trim(),
      icon: 'cuisine',
    })
  }
  if (String(c.meal_type || '').trim()) {
    items.push({
      key: 'meal_type',
      label: 'Meal Type',
      subline: 'Breakfast, lunch & more',
      value: String(c.meal_type).trim(),
      icon: 'meal',
    })
  }
  if (String(c.food_type || '').trim()) {
    items.push({
      key: 'food_type',
      label: 'Food Type',
      subline: 'Diet and style',
      value: String(c.food_type).trim(),
      icon: 'food',
    })
  }
  if (String(c.speciality || '').trim()) {
    items.push({
      key: 'speciality',
      label: 'Speciality',
      subline: "What you're known for",
      value: String(c.speciality).trim(),
      icon: 'star',
    })
  }
  if (String(c.category || '').trim() && !c.cuisine) {
    items.push({
      key: 'category',
      label: 'Category',
      subline: 'Type of place',
      value: String(c.category).trim(),
      icon: 'grid',
    })
  }
  return items
}

/**
 * Orbit radius + box size from satellite count and viewport so cards do not overlap each other or the hub.
 * Chord between adjacent centers = 2*r*sin(π/n); we require that to exceed card width × clearance.
 */
function computeAboutOrbitLayout(n, innerWidth) {
  const HUB_R = 88
  const GAP = 28
  const SIDE = 56
  const maxBox = Math.max(280, innerWidth - SIDE)
  const clearance = 1.15

  if (n < 1) return { orbitR: 160, boxPx: 520, satW: 200 }

  let satW = Math.min(222, Math.max(150, Math.round(innerWidth * 0.34)))

  const requiredR = (sw) => {
    if (n === 1) return Math.ceil(HUB_R + sw / 2 + 20)
    const fromChord = (clearance * sw) / (2 * Math.sin(Math.PI / n))
    const fromHub = HUB_R + sw / 2 + 20
    return Math.ceil(Math.max(fromChord, fromHub))
  }

  let orbitR = requiredR(satW)
  let boxPx = Math.ceil(2 * (orbitR + satW / 2 + GAP))

  let guard = 0
  while (guard < 56) {
    orbitR = requiredR(satW)
    boxPx = Math.ceil(2 * (orbitR + satW / 2 + GAP))
    const halfExtent = orbitR + satW / 2 + GAP
    if (boxPx <= maxBox && halfExtent <= maxBox / 2 + 1) break
    if (satW <= 132) break
    satW -= 4
    guard += 1
  }

  orbitR = requiredR(satW)
  boxPx = Math.min(maxBox, Math.ceil(2 * (orbitR + satW / 2 + GAP)))

  return { orbitR, boxPx, satW }
}

const PRICE_PRESETS = [
  { label: 'Affordable', value: '1-3 BHD' },
  { label: 'Mid-range', value: '3-7 BHD' },
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
  'beach',
  'parks',
  'scenic',
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
  'International',
  'Cafe',
  'Pakistani',
  'Asian',
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

// Place-only fields; name, description, opening/closing come from Business Info above
const PLACE_FIELDS = [
  { key: 'entry_cost', label: 'Entry Cost', type: 'number', required: false, min: 0, step: 'any' },
  { key: 'suitable_for', label: 'Suitable For', type: 'text', required: false },
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
    // Single source: name/description/hours come from Business Info; avoid asking twice
    const name = p.business_name ?? p.place_name ?? p.name ?? ''
    const desc = p.description ?? p.place_description ?? ''
    f.business_name = name
    f.description = desc
    f.place_name = name
    f.place_description = desc
    f.category = p.category ?? ''
    f.indoor_outdoor = p.indoor_outdoor ?? ''
    f.opening_time = p.opening_time != null ? String(p.opening_time).slice(0, 5) : ''
    f.closing_time = p.closing_time != null ? String(p.closing_time).slice(0, 5) : ''
    f.timings = p.timings || (f.opening_time && f.closing_time ? `${f.opening_time} - ${f.closing_time}` : '')
    f.entry_cost = p.entry_cost ?? ''
    f.suitable_for = p.suitable_for ?? ''
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

export default function Profile({ mode }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isDashboard = mode === 'dashboard'
  const isEditPage = mode === 'edit'
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
  const [profilePosts, setProfilePosts] = useState([])
  const [profilePostsLoading, setProfilePostsLoading] = useState(false)
  const headerImageInputRef = useRef(null)
  const clientImageInputRef = useRef(null)
  const eventImageInputRef = useRef(null)

  const [orbitLayoutWidth, setOrbitLayoutWidth] = useState(() =>
    typeof globalThis.window !== 'undefined' ? globalThis.window.innerWidth : 1024
  )
  useEffect(() => {
    const onResize = () => setOrbitLayoutWidth(globalThis.window.innerWidth)
    onResize()
    globalThis.window.addEventListener('resize', onResize)
    return () => globalThis.window.removeEventListener('resize', onResize)
  }, [])

  // ── Cinematic scroll animations ──
  useEffect(() => {
    if (!isDashboard) return

    // 1. IntersectionObserver: reveal sections as they enter the viewport
    const revealNodes = Array.from(document.querySelectorAll('.hd-reveal, .hd-band, .hd-actions-band'))
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            io.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -8% 0px' }
    )
    revealNodes.forEach((n) => io.observe(n))

    // 2. Parallax: hero fades + slides up as you scroll past it
    //    Only opacity + transform — no blur (triggers full repaint)
    const hero = document.querySelector('.hd-hero')
    let rafId = null
    const onScroll = () => {
      if (rafId) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        const scrollY = globalThis.window.scrollY
        if (!hero) return
        const heroH = hero.offsetHeight
        const progress = Math.min(scrollY / (heroH * 0.85), 1)
        hero.style.opacity = String(Math.max(0, 1 - progress * 0.9))
        hero.style.transform = `translateY(${progress * 28}px) scale(${1 - progress * 0.015})`
      })
    }

    globalThis.window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      io.disconnect()
      globalThis.window.removeEventListener('scroll', onScroll)
      if (rafId) cancelAnimationFrame(rafId)
      // Reset hero style on unmount
      if (hero) { hero.style.opacity = ''; hero.style.transform = ''; }
    }
  }, [isDashboard, displayClient?.client_a_uuid])

  const aboutOrbitLayoutProbe = useMemo(
    () => buildAboutOrbitItems(displayClient || clients[0] || {}),
    [displayClient, clients]
  )
  const aboutOrbitLayoutMetrics = useMemo(
    () => computeAboutOrbitLayout(aboutOrbitLayoutProbe.length, orbitLayoutWidth),
    [aboutOrbitLayoutProbe.length, orbitLayoutWidth]
  )

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

  useEffect(() => {
    if (!isDashboard || !displayClient?.client_a_uuid) {
      setProfilePosts([])
      return
    }
    setProfilePostsLoading(true)
    getPostsByClient(displayClient.client_a_uuid)
      .then((list) => setProfilePosts(Array.isArray(list) ? list.slice(0, 6) : []))
      .catch(() => setProfilePosts([]))
      .finally(() => setProfilePostsLoading(false))
  }, [isDashboard, displayClient?.client_a_uuid])

  // On Edit page: populate form from displayClient when we have data
  useEffect(() => {
    if (!isEditPage || !displayClient || !clients.length) return
    setForm(profileToForm(displayClient))
    setEditingClientId(displayClient.client_a_uuid)
  }, [isEditPage, displayClient?.client_a_uuid, clients.length])

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
    setError('')
    setPineconeError('')
    setLoading(true)
    setSuccess({ supabase: false, pinecone: false })
    try {
      const normalizedTags = form.client_type_choice === 'restaurant'
        ? parseTags(form.tags).join(', ')
        : formatAllowedTags(form.tags)
      let formWithUploads = await uploadPendingImages({ ...form, tags: normalizedTags }, user.account_uuid)
      if (form.client_type_choice === 'place') {
        formWithUploads = {
          ...formWithUploads,
          place_name: formWithUploads.business_name || formWithUploads.place_name || '',
          place_description: formWithUploads.description || formWithUploads.place_description || '',
          opening_time: hours.open || '',
          closing_time: hours.close || '',
        }
      }
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
    setError('')
    setPineconeError('')
    setLoading(true)
    setSuccess({ supabase: false, pinecone: false })
    try {
      const normalizedTags = form.client_type_choice === 'restaurant'
        ? parseTags(form.tags).join(', ')
        : formatAllowedTags(form.tags)
      let formWithUploads = await uploadPendingImages({ ...form, tags: normalizedTags }, editingClientId)
      if (form.client_type_choice === 'place') {
        formWithUploads = {
          ...formWithUploads,
          place_name: formWithUploads.business_name || formWithUploads.place_name || '',
          place_description: formWithUploads.description || formWithUploads.place_description || '',
          opening_time: hours.open || '',
          closing_time: hours.close || '',
        }
      }
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
        navigate('/', { replace: true })
      }, 1200)
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

      {/* Dashboard empty state: no profile yet */}
      {isDashboard && !loading && clients.length === 0 && (
        <div className="pf-empty-dashboard">
          <h2 className="pf-form-title">No profile yet</h2>
          <p className="pf-form-sub">Create your business profile to get started.</p>
          <Link to="/edit" className="pf-btn pf-btn-primary pf-btn-lg">Create profile</Link>
        </div>
      )}

      {/* ══════════════ HOME DASHBOARD ══════════════ */}
      {!loading && clients.length > 0 && isDashboard && (() => {
        const c = displayClient || clients[0]
        const name = c.business_name || c.name || 'Unnamed'
        const typeLabel = (c.client_type || 'business').replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())
        const clientImageUrl = resolveClientImageUrl(c.client_image)
        const initial = name.charAt(0).toUpperCase()
        const qrValue = String(c.qrcode || c.client_a_uuid || '').trim()
        const tagsArr = Array.isArray(c.tags) ? c.tags : (typeof c.tags === 'string' && c.tags) ? c.tags.split(',').map(t => t.trim()).filter(Boolean) : []
        const branches = Array.isArray(c.branch) ? c.branch : (typeof c.branch === 'object' && c.branch !== null) ? [c.branch] : []
        const activeBranches = branches.filter(b => b && (b.area_name || b.lat || b.long))
        const lat = parseFloat(c.lat ?? activeBranches[0]?.lat)
        const lng = parseFloat(c.lng ?? c.long ?? activeBranches[0]?.long)
        const hasCoords = !Number.isNaN(lat) && !Number.isNaN(lng)
        const mapsUrl = hasCoords ? `https://www.google.com/maps?q=${lat},${lng}` : null
        const osmUrl = hasCoords ? `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.02},${lat - 0.02},${lng + 0.02},${lat + 0.02}&layer=mapnik&marker=${lat},${lng}` : null

        const DETAIL_SUBLINES = {
          'Price Range': 'What visitors can expect to spend',
          'Hours': 'When you\'re open',
          'Cuisine': 'What\'s on the menu',
          'Meal Type': 'Breakfast, lunch, dinner & more',
          'Food Type': 'Diet and style',
          'Speciality': 'What you\'re known for',
          'Category': 'Type of place',
          'Indoor / Outdoor': 'Setting',
          'Place': 'Location or area',
          'Entry Cost': 'Admission or entry fee',
          'Suitable For': 'Who it\'s best for',
          'Event Type': 'Kind of event',
          'Venue': 'Where it happens',
          'Status': 'Current status',
        }
        const detailItems = []
        const add = (label, value, icon) => { if (value != null && String(value).trim() !== '') detailItems.push({ label, value: String(value).trim(), icon, subline: DETAIL_SUBLINES[label] }) }
        add('Price Range', c.price_range, 'price')
        add('Hours', c.timings, 'clock')
        add('Cuisine', c.cuisine, 'cuisine')
        add('Meal Type', c.meal_type, 'meal')
        add('Food Type', c.food_type, 'food')
        add('Speciality', c.speciality, 'star')
        add('Category', c.category, 'grid')
        add('Indoor / Outdoor', c.indoor_outdoor, 'door')
        add('Place', c.place_name, 'pin')
        add('Entry Cost', c.entry_cost, 'price')
        add('Suitable For', c.suitable_for, 'people')
        add('Event Type', c.event_type, 'event')
        add('Indoor / Outdoor', c.indoor_outdoor, 'door')
        add('Venue', c.venue ?? c.events?.[0]?.venue, 'pin')
        add('Status', c.status ?? c.events?.[0]?.status, 'star')

        const descSnippet = c.description
          ? (c.description.length > 220 ? c.description.slice(0, 220).trim() + '…' : c.description)
          : null

        const aboutOrbitItems = buildAboutOrbitItems(c)

        return (
          <>
            <div className="hd-page">

              {/* ── HERO ── */}
              <header className="hd-hero">
                <div className="hd-hero-mesh" aria-hidden="true" />

                {/* QR — direct child of hero so position:absolute works cleanly */}
                {qrValue && (
                  <button
                    type="button"
                    className="hd-hero-qr"
                    onClick={() => setExpandedQrClient(c)}
                    aria-label="Open QR code"
                    title="Scan to open listing"
                  >
                    <QRCodeSVG value={qrValue} size={80} level="M" bgColor="#F7F0E3" fgColor="#0A1929" marginSize={2} />
                    <span className="hd-hero-qr-sub">Scan</span>
                  </button>
                )}

                {/* Top bar */}
                <div className="hd-hero-topbar">
                  <p className="hd-hero-eyebrow">Your Listing</p>
                </div>

                {/* Center: logo + massive name */}
                <div className="hd-hero-center">
                  <div className="hd-hero-avatar">
                    {clientImageUrl
                      ? <img src={clientImageUrl} alt={name} />
                      : <span>{initial}</span>}
                  </div>
                  <h1 className="hd-hero-name">{name}</h1>
                </div>

                {/* Bottom: type badge centered between two lines */}
                <div className="hd-hero-bottom">
                  <span className="hd-hero-bottom-line" aria-hidden="true" />
                  <span className="hd-hero-badge">{typeLabel}</span>
                  <span className="hd-hero-bottom-line" aria-hidden="true" />
                </div>
              </header>

              {/* ── MARQUEE TICKER ── */}
              <div className="hd-marquee" aria-hidden="true">
                <div className="hd-marquee-track">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <span key={i} className="hd-marquee-item">
                      <span className="hd-marquee-name">{name}</span>
                      <span className="hd-marquee-sep">◆</span>
                      <span className="hd-marquee-type">{typeLabel}</span>
                      <span className="hd-marquee-sep">●</span>
                      <span className="hd-marquee-name">Go Bahrain</span>
                      <span className="hd-marquee-sep">◆</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* ── ABOUT ── */}
              {(descSnippet || aboutOrbitItems.length > 0) && (
                <div className="hd-band">
                  <div
                    className={`hd-about-grid${aboutOrbitItems.length === 0 ? ' hd-about-grid--solo' : ' hd-about-grid--with-orbit'}`}
                  >
                    <div className="hd-about-left">
                      {descSnippet && (
                        <>
                          <p className="hd-band-label">Summary</p>
                          <p className="hd-band-sub">{descSnippet}</p>
                        </>
                      )}
                    </div>
                    <div className="hd-about-right">
                      {aboutOrbitItems.length > 0 && (
                        <section
                          className="hd-about-orbit-radial"
                          aria-labelledby="about-orbit-title"
                          style={{
                            '--orbit-r-dynamic': `${aboutOrbitLayoutMetrics.orbitR}px`,
                            '--orbit-box-dynamic': `${aboutOrbitLayoutMetrics.boxPx}px`,
                            '--sat-w-dynamic': `${aboutOrbitLayoutMetrics.satW}px`,
                          }}
                        >
                          <div className="hd-about-orbit-hub">
                            <h2 id="about-orbit-title" className="hd-about-orbit-hub-title">
                              What your listing says
                            </h2>
                          </div>
                          {aboutOrbitItems.map((item, i) => {
                            const step = 360 / aboutOrbitItems.length
                            const angleDeg = step * i - 90
                            return (
                              <article
                                key={item.key}
                                className="hd-about-orbit-satellite"
                                style={{
                                  '--orbit-angle': `${angleDeg}deg`,
                                  '--orbit-enter-delay': `${160 + i * 58}ms`,
                                }}
                              >
                                <div className="hd-about-orbit-sat-inner">
                                  <div className="hd-about-orbit-sat-head">
                                    <div className="hd-detail-icon-wrap hd-about-orbit-sat-icon" aria-hidden>
                                      <HdDetailIcon type={item.icon} />
                                    </div>
                                    <div className="hd-about-orbit-sat-labels">
                                      <span className="hd-detail-label">{item.label}</span>
                                      <span className="hd-detail-subline">{item.subline}</span>
                                    </div>
                                  </div>
                                  <p className="hd-about-orbit-sat-value">{item.value}</p>
                                </div>
                              </article>
                            )
                          })}
                        </section>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── DETAILS ── */}
              {detailItems.length > 0 && (
                <div className="hd-band">
                  <div className="hd-band-header-row">
                    <p className="hd-band-label">Details</p>
                    <Link to="/edit" className="hd-action-btn hd-action-btn-primary">Edit Profile</Link>
                  </div>
                  <h2 className="hd-band-title">Opening hours, pricing & more</h2>
                  <p className="hd-band-sub">Everything at a glance — what you offer and how to find you.</p>
                  <div className="hd-details-split">
                    {detailItems.map((item, i) => (
                      <div key={i} className="hd-detail-row hd-detail-row--stagger" style={{ '--stagger': i }}>
                        {/* Value on top — big & bold */}
                        <span className="hd-detail-value">
                          {item.label === 'Price Range' && item.value
                            ? <>{item.value.replace(/\s*BHD\s*$/i, '').trim()}<span className="hd-detail-currency"> BHD</span></>
                            : item.value}
                        </span>
                        {/* Label + icon below */}
                        <div className="hd-detail-row-top">
                          <div className="hd-detail-icon-wrap">
                            <HdDetailIcon type={item.icon} />
                          </div>
                          <div className="hd-detail-label-wrap">
                            <span className="hd-detail-label">
                              {item.label}
                              {item.label === 'Price Range' && <span className="hd-detail-hint"> · per person</span>}
                            </span>
                            {item.subline && <span className="hd-detail-subline">{item.subline}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── GALLERY ── */}
              <div className="hd-band">
                <div className="hd-band-header-row">
                  <p className="hd-band-label">Gallery</p>
                  <Link to="/posts" className="hd-action-btn hd-action-btn-secondary">+ Create Post</Link>
                </div>
                <h2 className="hd-band-title">Menu Highlights</h2>
                <p className="hd-band-sub">Your latest posts — hover to explore.</p>
                {profilePostsLoading ? (
                  <p style={{color:'rgba(255,255,255,0.3)',fontSize:'0.875rem'}}>Loading…</p>
                ) : profilePosts.length === 0 ? (
                  <div className="hd-mosaic">
                    <div className="hd-mosaic-main">
                      <div className="hd-mosaic-ph"><span className="hd-mosaic-ph-text">Add photos</span></div>
                    </div>
                    <div className="hd-mosaic-item">
                      <div className="hd-mosaic-ph"><span className="hd-mosaic-ph-text">Add photos</span></div>
                    </div>
                    <div className="hd-mosaic-item">
                      <div className="hd-mosaic-ph"><span className="hd-mosaic-ph-text">Add photos</span></div>
                    </div>
                  </div>
                ) : (
                  <div className="hd-mosaic">
                    {profilePosts.slice(0, 3).map((post, i) => (
                      <div key={post.post_uuid || i} className={i === 0 ? 'hd-mosaic-main' : 'hd-mosaic-item'}>
                        {post.post_image
                          ? <img src={post.post_image} alt="" loading="lazy" />
                          : <div className="hd-mosaic-ph"><span className="hd-mosaic-ph-text">No image</span></div>
                        }
                        <div className="hd-mosaic-caption">
                          <span>{post.description || '—'}</span>
                        </div>
                      </div>
                    ))}
                    {profilePosts.length < 2 && (
                      <div className="hd-mosaic-item">
                        <div className="hd-mosaic-ph"><span className="hd-mosaic-ph-text">Add photos</span></div>
                      </div>
                    )}
                    {profilePosts.length < 3 && (
                      <div className="hd-mosaic-item">
                        <div className="hd-mosaic-ph"><span className="hd-mosaic-ph-text">Add photos</span></div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── TAGS ── */}
              {tagsArr.length > 0 && (
                <div className="hd-band">
                  <p className="hd-band-label">Tags</p>
                  <h2 className="hd-band-title">How visitors find you</h2>
                  <p className="hd-band-sub">Search keywords that connect your listing to the right audience.</p>
                  <div className="hd-tags-row">
                    {tagsArr.map((tag, i) => (
                      <span key={i} className="hd-tag">#{String(tag).replace(/^#/, '')}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* ── LOCATIONS ── */}
              {(activeBranches.length > 0 || hasCoords) && (
                <div className="hd-band">
                  <p className="hd-band-label">Locations</p>
                  <h2 className="hd-band-title">Where to find us</h2>
                  <p className="hd-band-sub">Tap a location to get directions from your current position.</p>
                  <div className="hd-locations-grid">
                    {osmUrl && (
                      <div className="hd-map-wrap">
                        <iframe
                          title="Map"
                          src={osmUrl}
                          className="hd-map-iframe"
                          loading="lazy"
                          sandbox="allow-scripts allow-same-origin"
                        />
                      </div>
                    )}
                    <div className="hd-locations-list">
                      {activeBranches.length > 0 ? activeBranches.map((b, i) => (
                        <div key={i} className="hd-location-entry">
                          <span className="hd-location-idx">Location {i + 1}</span>
                          <span className="hd-location-name">{b.area_name || `Branch ${i + 1}`}</span>
                          {b.area_name && <span className="hd-location-addr">{b.area_name}, Bahrain</span>}
                          {b.lat && b.long && (
                            <a href={`https://www.google.com/maps?q=${b.lat},${b.long}`} target="_blank" rel="noopener noreferrer" className="hd-link-directions">
                              Get directions →
                            </a>
                          )}
                        </div>
                      )) : (
                        <div className="hd-location-entry">
                          <span className="hd-location-idx">Location 1</span>
                          <span className="hd-location-name">Manama, Bahrain</span>
                          <span className="hd-location-addr">Bahrain</span>
                          {mapsUrl && (
                            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="hd-link-directions">
                              Get directions →
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── EMPTY STATE ── */}
              {detailItems.length === 0 && tagsArr.length === 0 && !descSnippet && (
                <div className="hd-empty-band">
                  <h2 className="hd-empty-title">Build your profile</h2>
                  <p className="hd-empty-text">Add details, tags, and locations so customers can discover you.</p>
                </div>
              )}

            </div>

            {expandedQrClient && (
              <div className="pf-modal-backdrop vp-modal-bg" onClick={() => setExpandedQrClient(null)} role="presentation">
                <div className="pf-modal vp-modal" onClick={(e) => e.stopPropagation()}>
                  <h3 className="pf-modal-title">{expandedQrClient.business_name || expandedQrClient.name || 'Profile'}</h3>
                  <QRCodeSVG value={String(expandedQrClient.qrcode || expandedQrClient.client_a_uuid || '').trim()} size={260} level="M" bgColor="#F7F0E3" fgColor="#0A1929" marginSize={4} />
                  <p className="pf-modal-id">Scan to open this profile</p>
                  <button type="button" className="vp-btn vp-btn-gold" onClick={() => setExpandedQrClient(null)}>Close</button>
                </div>
              </div>
            )}
          </>
        )
      })()}

      {/* ══════════════ VISIT PROFILE (public / tourism layout – not for home) ══════════════ */}
      {!loading && clients.length > 0 && !isDashboard && !isEditPage && !showCreateForm && !isEditing && (() => {
        const c = displayClient || clients[0]
        const name = c.business_name || c.name || 'Unnamed'
        const nameParts = name.trim().split(/\s+/)
        const nameFirst = nameParts.slice(0, -1).join(' ')
        const nameLast = nameParts.length > 1 ? nameParts[nameParts.length - 1] : name
        const typeLabel = (c.client_type || 'business').replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())
        const clientImageUrl = resolveClientImageUrl(c.client_image)
        const tagsArr = Array.isArray(c.tags) ? c.tags : (c.tags && typeof c.tags === 'string') ? c.tags.split(',').map(t => t.trim()).filter(Boolean) : []
        const initial = name.charAt(0).toUpperCase()
        const qrValue = String(c.qrcode || c.client_a_uuid || '').trim()
        const branches = Array.isArray(c.branch) ? c.branch : (typeof c.branch === 'object' && c.branch !== null) ? [c.branch] : []
        const lat = parseFloat(c.lat ?? branches[0]?.lat)
        const lng = parseFloat(c.lng ?? c.long ?? branches[0]?.long)
        const hasCoords = !Number.isNaN(lat) && !Number.isNaN(lng)
        const mapsUrl = hasCoords ? `https://www.google.com/maps?q=${lat},${lng}` : null
        const osmUrl = hasCoords ? `https://www.openstreetmap.org/export/embed.html?bbox=${lng-0.02},${lat-0.02},${lng+0.02},${lat+0.02}&layer=mapnik&marker=${lat},${lng}` : null

        const boardingItems = [
          c.price_range && { icon: '💰', label: 'Price', value: c.price_range },
          c.timings && { icon: '🕐', label: 'Hours', value: c.timings },
          c.cuisine && { icon: '🍽', label: 'Cuisine', value: c.cuisine },
        ].filter(Boolean)

        const stampRows = []
        const add = (l, v) => { if (v != null && String(v).trim() !== '') stampRows.push({ label: l, value: String(v).trim() }) }
        add('Meal type', c.meal_type)
        add('Food type', c.food_type)
        add('Speciality', c.speciality)
        add('Category', c.category)
        if (c.rating) add('Rating', c.rating)
        add('Indoor / Outdoor', c.indoor_outdoor)

        const whyVisitQuote = c.description
          ? (c.description.length > 120 ? c.description.slice(0, 120).trim() + '…' : c.description)
          : 'A must-visit on your Bahrain itinerary.'

        return (
          <>
            <div className="vp">
              <header className="vp-hero">
                <div className="vp-hero-bg" style={clientImageUrl ? { backgroundImage: `url(${clientImageUrl})` } : undefined} aria-hidden />
                <div className="vp-hero-gradient" aria-hidden />
                <div className="vp-hero-lattice" aria-hidden />
                <div className="vp-hero-inner">
                  <span className="vp-badge">
                    <span className="vp-badge-star" aria-hidden>★</span>
                    Traveler&apos;s Pick
                  </span>
                  <div className="vp-logo-ring">
                    {clientImageUrl ? <img src={clientImageUrl} alt="" className="vp-logo" /> : <div className="vp-logo vp-logo-init">{initial}</div>}
                  </div>
                  <h1 className="vp-title">
                    {nameFirst && <span className="vp-title-shimmer">{nameFirst} </span>}
                    <span className="vp-title-gold">{nameLast}</span>
                  </h1>
                  <p className="vp-type">{typeLabel}</p>
                  <div className="vp-hero-actions">
                    <button type="button" className="vp-btn vp-btn-gold" onClick={() => handleStartEdit(c.client_a_uuid)} disabled={loadingClient === c.client_a_uuid}>{loadingClient === c.client_a_uuid ? 'Loading…' : 'Edit Profile'}</button>
                    <Link to="/posts" className="vp-btn vp-btn-outline">Create Post</Link>
                    <button type="button" className="vp-btn vp-btn-outline" onClick={() => qrValue && setExpandedQrClient(c)} disabled={!qrValue}>Share</button>
                  </div>
                </div>
              </header>

              {boardingItems.length > 0 && (
                <section className="vp-boarding">
                  <div className="vp-boarding-strip">
                    {boardingItems.map((item, i) => (
                      <div key={i} className="vp-boarding-cell">
                        <span className="vp-boarding-label">{item.icon} {item.label}</span>
                        <span className="vp-boarding-value">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <div className="vp-main">
                <section className="vp-section vp-about">
                  <div className="vp-about-grid">
                    <div className="vp-about-desc">
                      <h2 className="vp-heading">About</h2>
                      <p className="vp-section-intro">A short intro for travelers and locals discovering your place</p>
                      <p className="vp-desc">{c.description || 'Add a description in Edit Profile to tell visitors why they should visit.'}</p>
                    </div>
                    <div className="vp-why-visit">
                      <div className="vp-why-border" aria-hidden />
                      <p className="vp-why-quote">&ldquo;{whyVisitQuote}&rdquo;</p>
                      <span className="vp-why-label">Why visit</span>
                    </div>
                  </div>
                </section>

                {stampRows.length > 0 && (
                  <section className="vp-section">
                    <h2 className="vp-heading">Details</h2>
                    <p className="vp-section-intro">What to expect — meal types, specialities, and more</p>
                    <dl className="vp-detail-list">
                      {stampRows.map((row, i) => (
                        <div key={i} className="vp-detail-row">
                          <dt className="vp-detail-label">{row.label}</dt>
                          <dd className="vp-detail-value">{row.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                )}

                {branches.length > 0 && (
                  <section className="vp-section">
                    <h2 className="vp-heading">Locations</h2>
                    <p className="vp-section-intro">Find this spot on the map — open in Google Maps for directions</p>
                    <div className="vp-branch-list">
                      {branches.filter(b => b && (b.area_name || b.lat || b.long)).map((b, i) => (
                        <div key={i} className="vp-branch-row">
                          <div className="vp-branch-info">
                            <strong className="vp-branch-name">{b.area_name || b.name || `Branch ${i + 1}`}</strong>
                            {(b.lat && b.long) && <span className="vp-branch-coords">{b.lat}, {b.long}</span>}
                          </div>
                          {(b.lat && b.long) && <a href={`https://www.google.com/maps?q=${b.lat},${b.long}`} target="_blank" rel="noopener noreferrer" className="vp-btn vp-btn-outline vp-btn-sm">Map</a>}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {hasCoords && !branches.length && (
                  <section className="vp-section">
                    <h2 className="vp-heading">Location</h2>
                    <p className="vp-section-intro">Where to find you — open in Maps for directions</p>
                    <div className="vp-map-block">
                      {osmUrl && (
                        <div className="vp-map-wrap">
                          <iframe title="Map" src={osmUrl} className="vp-map-iframe" loading="lazy" />
                        </div>
                      )}
                      <p className="vp-address">Manama, Bahrain</p>
                      {mapsUrl && <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="vp-btn vp-btn-outline vp-btn-sm">Open in Maps</a>}
                    </div>
                  </section>
                )}

                <section className="vp-section">
                  <h2 className="vp-heading">Tags</h2>
                  <p className="vp-section-intro">Topics and vibes — how people might discover you</p>
                  {tagsArr.length > 0 ? (
                    <div className="vp-tags">
                      {tagsArr.map((tag, i) => (
                        <span key={i} className="vp-tag">
                          {String(tag).replace(/^#/, '')}
                        </span>
                      ))}
                    </div>
                  ) : <p className="vp-empty">No tags yet.</p>}
                </section>

                <section className="vp-section">
                  <h2 className="vp-heading">Latest posts</h2>
                  <p className="vp-section-intro">Recent updates and highlights from your profile</p>
                  {profilePostsLoading && <p className="vp-empty">Loading…</p>}
                  {!profilePostsLoading && profilePosts.length === 0 && <p className="vp-empty">No posts yet.</p>}
                  {!profilePostsLoading && profilePosts.length > 0 && (
                    <div className="vp-posts">
                      {profilePosts.map((p, i) => (
                        <article key={p.post_uuid || p.id} className="vp-post" style={{ animationDelay: `${i * 0.06}s` }}>
                          <div className="vp-post-img">{p.post_image ? <img src={p.post_image} alt="" /> : <div className="vp-post-ph" />}</div>
                          <p className="vp-post-cap">{p.description || '—'}</p>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              <footer className="vp-seal">
                <div className="vp-seal-circle">
                  <span className="vp-seal-palm" aria-hidden>🌴</span>
                  <span className="vp-seal-text">Kingdom of Bahrain</span>
                  <span className="vp-seal-sub">Go Bahrain</span>
                </div>
              </footer>
            </div>

            {expandedQrClient && (
              <div className="pf-modal-backdrop vp-modal-bg" onClick={() => setExpandedQrClient(null)} role="presentation">
                <div className="pf-modal vp-modal" onClick={(e) => e.stopPropagation()}>
                  <h3 className="pf-modal-title">{expandedQrClient.business_name || expandedQrClient.name || 'Profile'}</h3>
                  <QRCodeSVG value={String(expandedQrClient.qrcode || expandedQrClient.client_a_uuid || '').trim()} size={260} level="M" bgColor="#F7F0E3" fgColor="#0A1929" marginSize={4} />
                  <p className="pf-modal-id">Scan to open this profile</p>
                  <button type="button" className="vp-btn vp-btn-gold" onClick={() => setExpandedQrClient(null)}>Close</button>
                </div>
              </div>
            )}
          </>
        )
      })()}

      {/* ══════════════ EDIT / CREATE FORM ══════════════ */}
      {(isEditPage || (!isEditPage && (showCreateForm || isEditing || (clients.length === 0 && !loading)))) && (
        <form onSubmit={isEditing ? handleSubmitUpdate : handleSubmitCreate} className="pf-form">

          {/* Form header */}
          <div className="pf-form-header">
            <div>
              <h2 className="pf-form-title">{isEditing ? 'Update Profile' : 'Create your profile'}</h2>
              <p className="pf-form-sub">{isEditPage ? 'Update your business details below.' : 'Fill in your business details below.'}</p>
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
                          : <input id={`f-${f.key}`} className="pf-input" type={f.type || 'text'} name={f.key} value={form[f.key] ?? ''} onChange={handleChange} placeholder={f.placeholder} required={f.required} min={f.min} step={f.step} inputMode={f.type === 'number' ? 'decimal' : undefined} />
                        }
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit */}
              <div className="pf-form-footer">
                <button type="submit" className="pf-btn pf-btn-primary pf-btn-lg" disabled={loading}>
                  {loading ? <><span className="pf-spinner" aria-hidden /> Saving…</> : (isEditing ? 'Save changes' : 'Create profile')}
                </button>
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

function HdPencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function HdPostsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function HdShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  )
}

function HdPinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function HdDetailIcon({ type }) {
  const p = { viewBox: '0 0 24 24', width: '18', height: '18', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
  switch (type) {
    case 'price':
      return <svg {...p}><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M2 10h20M2 14h20M6 10v4M10 10v4M14 10v4M18 10v4" /></svg>
    case 'clock':
      return <svg {...p}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
    case 'cuisine':
      return <svg {...p}><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" /></svg>
    case 'meal':
      return <svg {...p}><path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" /></svg>
    case 'food':
      return <svg {...p}><path d="M3 11l19-9-9 19-2-8-8-2z" /></svg>
    case 'star':
      return <svg {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
    case 'grid':
      return <svg {...p}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
    case 'door':
      return <svg {...p}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
    case 'pin':
      return <svg {...p}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
    case 'people':
      return <svg {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
    case 'event':
      return <svg {...p}><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
    default:
      return <svg {...p}><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
  }
}

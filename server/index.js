import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')
dotenv.config({ path: path.join(rootDir, '.env') })
dotenv.config({ path: path.join(rootDir, '.env.local') })
import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'

const app = express()
app.use(cors({ origin: '*' }))
app.use(express.json())

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://zonhaprelkjyjugpqfdn.supabase.co'
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvbmhhcHJlbGtqeWp1Z3BxZmRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3OTE1MDUsImV4cCI6MjA4NjM2NzUwNX0.vPJEdSZzZzNo-69QV-e7pKDyAC9rFYLdpJPiwgiQR3o'
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
// Server reads non-VITE names; many .env files only set VITE_* for the browser — use both.
const openaiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY
const pineconeKey = process.env.PINECONE_API_KEY || process.env.VITE_PINECONE_API_KEY
const pineconeHost = process.env.PINECONE_HOST || process.env.VITE_PINECONE_HOST

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null

const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } })
  : null

function sanitizePathSegment(value, fallback = 'file') {
  const v = String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '')
  return v || fallback
}

/** Remove null/empty strings/empty objects for a smaller, cleaner JSON payload to the summarizer */
function stripEmptyDeep(value) {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'string') {
    const t = value.trim()
    return t === '' ? undefined : t
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) {
    const arr = value.map(stripEmptyDeep).filter((v) => v !== undefined)
    return arr.length ? arr : undefined
  }
  if (typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      const s = stripEmptyDeep(v)
      if (s !== undefined) out[k] = s
    }
    return Object.keys(out).length ? out : undefined
  }
  return undefined
}

/**
 * Writes ai_summary via SECURITY DEFINER RPC only — same anon Supabase client as other profile RPCs (no service role).
 * Summary is stored in Supabase only (NOT Pinecone).
 */
async function persistClientAiSummary(clientUuid, summaryText) {
  const id = String(clientUuid || '').trim()
  if (!id) return { ok: false, error: 'Missing client id' }
  const text = String(summaryText || '').trim()
  if (!text) return { ok: false, error: 'Empty summary' }
  if (!supabase) return { ok: false, error: 'Supabase not configured' }

  const { error: rpcError } = await supabase.rpc('set_client_ai_summary', {
    p_client_uuid: id,
    p_summary: text,
  })
  if (!rpcError) return { ok: true, error: null }

  const rpcMsg = rpcError.message || String(rpcError)
  const missingFn = rpcError.code === '42883' || /set_client_ai_summary|function .* does not exist/i.test(rpcMsg)
  if (missingFn) {
    return {
      ok: false,
      error:
        'Could not save ai_summary: run migration 014 (ai_summary column) and 015_set_client_ai_summary_rpc.sql in the Supabase SQL editor.',
    }
  }
  return { ok: false, error: rpcMsg }
}

/**
 * Fetches full profile via RPC, asks OpenAI for a multi-paragraph summary, persists to client.ai_summary.
 * Never throws. Intended right after Supabase profile writes (before or after Pinecone).
 */
async function refreshClientAiSummary(clientUuid) {
  try {
    const id = String(clientUuid || '').trim()
    if (!id || !openaiKey) {
      return { aiSummaryOk: false, aiSummaryError: !openaiKey ? 'OPENAI_API_KEY not set' : 'Missing client id' }
    }
    if (!supabase) {
      return { aiSummaryOk: false, aiSummaryError: 'Supabase not configured' }
    }

    const { data: fullProfile, error: fetchError } = await supabase.rpc('get_client_full', { p_client_uuid: id })
    if (fetchError || fullProfile == null) {
      return { aiSummaryOk: false, aiSummaryError: fetchError?.message || 'Failed to fetch profile' }
    }

    const profile = typeof fullProfile === 'string' ? JSON.parse(fullProfile) : fullProfile
    // Do not feed prior ai_summary into the model (summary is Supabase-only, not search-indexed).
    const { ai_summary: _priorSummary, ...profileWithoutSummary } = profile
    const stripped = stripEmptyDeep(profileWithoutSummary) || {}
    const payload = {
      ...stripped,
      client_a_uuid: stripped.client_a_uuid || id,
      business_name: String(stripped.business_name || profile.business_name || profile.name || '').trim(),
      client_type: String(stripped.client_type || profile.client_type || '').trim(),
    }
    const model = process.env.OPENAI_SUMMARY_MODEL || 'gpt-4o-mini'

    function clampSummaryToWordLimit(text, maxWords) {
      const s = String(text || '').trim()
      if (!s) return ''
      const words = s.split(/\s+/).filter(Boolean)
      if (words.length <= maxWords) return s
      return `${words.slice(0, maxWords).join(' ')}…`
    }

    let summaryText = ''
    try {
      const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0.25,
          // ~300–350 words target (hard-capped again below)
          max_tokens: 650,
          messages: [
            {
              role: 'system',
              content:
                'You write SHORT business profile summaries for Go Bahrain (Bahrain local discovery directory). You will receive one JSON object with stored fields for a client (base profile plus type-specific fields and, for event organizers, an events array). Write 1–2 short paragraphs (optionally a final short bullet list with key facts). Prioritize the most important information; do NOT try to mention every field. Omit absent/empty fields. Stay strictly factual — do not invent information. HARD LIMIT: 300–350 words maximum. If you exceed the limit, rewrite shorter before answering.',
            },
            {
              role: 'user',
              content: JSON.stringify(payload),
            },
          ],
        }),
      })
      if (!chatRes.ok) {
        const errBody = await chatRes.text()
        return { aiSummaryOk: false, aiSummaryError: `OpenAI chat failed: ${errBody.slice(0, 500)}` }
      }
      const chatData = await chatRes.json()
      const choice0 = chatData?.choices?.[0]
      summaryText = String(choice0?.message?.content || '').trim()
      if (!summaryText) {
        const fr = choice0?.finish_reason ?? ''
        return {
          aiSummaryOk: false,
          aiSummaryError: `Empty summary from model (finish_reason=${fr || 'unknown'}). Try a shorter description or OPENAI_SUMMARY_MODEL=gpt-4o-mini.`,
        }
      }
    } catch (e) {
      return { aiSummaryOk: false, aiSummaryError: String(e?.message || e) }
    }

    summaryText = clampSummaryToWordLimit(summaryText, 350)
    const persist = await persistClientAiSummary(id, summaryText)
    if (!persist.ok) {
      console.error('[AI summary] persist failed for client', id, persist.error)
      return { aiSummaryOk: false, aiSummaryError: persist.error || 'Failed to save summary' }
    }
    console.log('[AI summary] stored for client', id)
    return { aiSummaryOk: true, aiSummaryError: null }
  } catch (e) {
    console.error('[AI summary] unexpected failure for client', clientUuid, e)
    return { aiSummaryOk: false, aiSummaryError: String(e?.message || e) }
  }
}

app.post('/api/upload-image', express.raw({ type: 'image/*', limit: '8mb' }), async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY is required on server for reliable image upload.' })
    }

    const bucket = String(req.query.bucket || '').trim()
    const accountUuid = sanitizePathSegment(req.query.accountUuid, 'anon')
    const prefix = sanitizePathSegment(req.query.prefix, '')
    const extRaw = String(req.query.ext || 'jpg').toLowerCase()
    const ext = extRaw.replace(/[^a-z0-9]/g, '') || 'jpg'
    const contentType = String(req.headers['content-type'] || 'application/octet-stream')
    const allowedBuckets = new Set(['event-images', 'gobahrain-profile-images', 'gobahrain-post-images'])

    if (!allowedBuckets.has(bucket)) {
      return res.status(400).json({ error: 'Invalid bucket' })
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: 'Missing image body' })
    }

    const objectPath = prefix
      ? `${prefix}/${accountUuid}/${crypto.randomUUID()}.${ext}`
      : `${accountUuid}/${crypto.randomUUID()}.${ext}`

    const { error } = await supabaseAdmin.storage.from(bucket).upload(objectPath, req.body, {
      cacheControl: '3600',
      upsert: false,
      contentType,
    })
    if (error) return res.status(400).json({ error: error.message || 'Upload failed' })

    const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(objectPath)
    return res.json({ publicUrl: data.publicUrl, path: objectPath, bucket })
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Upload failed' })
  }
})

function buildSemanticText(raw) {
  const p = raw && typeof raw === 'object' ? { ...raw } : {}
  const parts = []
  if (p.business_name) parts.push(`${p.business_name} is a ${p.client_type || 'client'} in Bahrain.`)
  if (p.description) parts.push(`Description: ${p.description}.`)
  if (p.cuisine) parts.push(`Cuisine: ${p.cuisine}.`)
  if (p.meal_type) parts.push(`Meal types: ${p.meal_type}.`)
  if (p.food_type) parts.push(`Food type: ${p.food_type}.`)
  if (p.speciality) parts.push(`Speciality: ${p.speciality}.`)
  if (typeof p.isfoodtruck === 'boolean') parts.push(`Food truck: ${p.isfoodtruck}.`)
  if (p.category) parts.push(`Category: ${p.category}.`)
  if (p.event_type) parts.push(`Event type: ${p.event_type}.`)
  if (p.indoor_outdoor) parts.push(`Indoor or outdoor: ${p.indoor_outdoor}.`)
  if (p.rating) parts.push(`Rating: ${p.rating} out of 5.`)
  if (p.price_range) parts.push(`Price range: ${p.price_range}.`)
  if (Array.isArray(p.tags) && p.tags.length) parts.push(`Tags: ${p.tags.join(', ')}.`)
  if (p.lat && p.long) parts.push(`Located at latitude ${p.lat} and longitude ${p.long}.`)
  if (p.timings) parts.push(`Opening hours: ${p.timings}.`)
  if (p.openclosed_state) parts.push(`Status: ${p.openclosed_state}.`)
  if (p.place_name) parts.push(`Place: ${p.place_name}.`)
  if (p.suitable_for) parts.push(`Suitable for: ${p.suitable_for}.`)
  if (p.event_name) parts.push(`Event: ${p.event_name}.`)
  if (p.venue) parts.push(`Venue: ${p.venue}.`)
  if (Array.isArray(p.branch) && p.branch.length) {
    const text = p.branch
      .map((b) => `${b?.area_name || 'Area'} (${b?.lat || '-'}, ${b?.long || '-'})`)
      .join('; ')
    parts.push(`Branches: ${text}.`)
  }
  if (p.start_date) parts.push(`Starts: ${p.start_date}.`)
  if (p.end_date) parts.push(`Ends: ${p.end_date}.`)
  if (p.start_time) parts.push(`Start time: ${p.start_time}.`)
  if (p.end_time) parts.push(`End time: ${p.end_time}.`)
  const joined = parts.join('\n').trim()
  if (joined) return joined
  const id = p.client_a_uuid || p.event_uuid || ''
  return id ? `Business listing ${id} in Bahrain.` : 'Business listing in Bahrain.'
}

/** Keys to exclude from Pinecone metadata (internal IDs + non-search assets) */
const PINECONE_METADATA_EXCLUDE = new Set([
  'account_a_uuid',
  'place_uuid',
  'event_uuid',
  'client_image',
  'image',
  /** Supabase-only narrative; never index in Pinecone */
  'ai_summary',
  // Location is packed into location_json below.
  'lat',
  'long',
  'lng',
  'branch',
])

function buildLocationJson(p) {
  const main = {}
  const lat = String(p?.lat ?? '').trim()
  const lng = String(p?.lng ?? p?.long ?? '').trim()
  if (lat) main.latitude = lat
  if (lng) main.longitude = lng

  const branchesArray = Array.isArray(p?.branch) ? p.branch : []
  const branches = {}
  branchesArray.forEach((b, i) => {
    const key = `area${i + 1}`
    branches[key] = {
      name: String(b?.area_name ?? '').trim(),
      latitude: String(b?.lat ?? '').trim(),
      longitude: String(b?.long ?? '').trim(),
    }
  })

  return JSON.stringify({
    main_location: main,
    branches,
  })
}

/** Unified metadata — same as create: client + subtype, full payload, no duplicates */
function buildMetadataFromPayload(p) {
  const metadata = {}
  for (const [k, v] of Object.entries(p)) {
    if (PINECONE_METADATA_EXCLUDE.has(k) || v == null) continue
    if (Array.isArray(v)) metadata[k] = v.map((item) => (typeof item === 'object' ? JSON.stringify(item) : String(item)))
    else if (typeof v === 'boolean' || typeof v === 'number') metadata[k] = v
    else metadata[k] = String(v)
  }
  metadata.location_json = buildLocationJson(p)
  return metadata
}

function normalizeBranches(raw) {
  const arr = Array.isArray(raw)
    ? raw
    : (typeof raw === 'string' && raw.trim()
      ? (() => { try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : [] } catch { return [] } })()
      : [])
  return arr
    .map((b) => ({
      area_name: String(b?.area_name ?? b?.name ?? '').trim(),
      lat: String(b?.lat ?? '').trim(),
      long: String(b?.long ?? '').trim(),
    }))
    .filter((b) => b.area_name || b.lat || b.long)
}

function readLongitude(form) {
  return String(form?.lng ?? form?.long ?? '').trim() || null
}

/** DB enum / RPC may use `event`; forms and Pinecone merge logic use `event_organizer`. */
function normalizeClientTypeChoice(raw) {
  const s = String(raw || '').trim().toLowerCase()
  if (s === 'event') return 'event_organizer'
  return s
}

/** Same as normalizeClientTypeChoice for profile JSON from Supabase. */
function normalizeClientTypeFromProfile(t) {
  const s = String(t || '').trim().toLowerCase()
  if (s === 'event') return 'event_organizer'
  return s || 'client'
}

/** Build unified merged payload from fetched profile — same structure as create */
function buildMergedPayloadFromProfile(profile, tags) {
  const effectiveType = normalizeClientTypeFromProfile(profile.client_type)
  const tagsArr = Array.isArray(profile.tags) ? profile.tags : (typeof profile.tags === 'string' && profile.tags) ? profile.tags.split(',').map(t => t.trim()).filter(Boolean) : (tags || [])
  const base = {
    client_a_uuid: profile.client_a_uuid,
    account_a_uuid: profile.account_a_uuid,
    business_name: profile.business_name || '',
    description: profile.description || '',
    rating: profile.rating ?? '',
    price_range: profile.price_range ?? '',
    client_type: effectiveType === 'none' ? 'client' : effectiveType,
    client_image: profile.client_image || null,
    lat: profile.lat ?? '',
    long: profile.long ?? '',
    lng: profile.long ?? '',
    timings: profile.timings ?? '',
    tags: tagsArr,
    openclosed_state: 'open',
    record_type: 'client',
  }
  if (effectiveType === 'restaurant') {
    return {
      ...base,
      cuisine: profile.cuisine || '',
      meal_type: profile.meal_type || '',
      food_type: profile.food_type || '',
      speciality: profile.speciality || '',
      isfoodtruck: profile.isfoodtruck ?? false,
      branch: normalizeBranches(profile.branch),
    }
  }
  if (effectiveType === 'place') {
    const placeName = profile.place_name || profile.name || ''
    return { ...base, category: profile.category || '', indoor_outdoor: profile.indoor_outdoor || '', place_uuid: profile.place_uuid || '', name: placeName, place_name: placeName, place_description: profile.place_description || profile.description || '', opening_time: profile.opening_time ?? '', closing_time: profile.closing_time ?? '', entry_cost: profile.entry_cost ?? '', suitable_for: profile.suitable_for || '' }
  }
  // event_organizer (DB may label as event): event_type/indoor_outdoor on client; events[] for multi-vector
  if (effectiveType === 'event_organizer') {
    const evBase = { ...base, event_type: profile.event_type || '', indoor_outdoor: profile.indoor_outdoor || '', record_type: 'event' }
    const events = Array.isArray(profile.events) ? profile.events : []
    if (events.length === 0) return { ...evBase }
    return events.map((ev) => ({
      ...evBase,
      event_uuid: ev.event_uuid,
      event_name: ev.event_name || '',
      venue: ev.venue || '',
      start_date: ev.start_date ?? '',
      end_date: ev.end_date ?? '',
      start_time: ev.start_time ?? '',
      end_time: ev.end_time ?? '',
    }))
  }
  return base
}

const PINECONE_DELETE_BATCH = 1000

/** Delete by vector ids (chunked). Pinecone accepts at most 1000 ids per request; missing ids are a no-op. */
async function pineconeDelete(pcHost, pcKey, ids) {
  const base = pcHost.replace(/\/$/, '')
  const unique = [...new Set((Array.isArray(ids) ? ids : []).map((id) => String(id || '').trim()).filter(Boolean))]
  if (unique.length === 0) return true
  for (let i = 0; i < unique.length; i += PINECONE_DELETE_BATCH) {
    const chunk = unique.slice(i, i + PINECONE_DELETE_BATCH)
    const res = await fetch(`${base}/vectors/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Api-Key': pcKey, 'X-Pinecone-Api-Version': '2025-10' },
      body: JSON.stringify({ ids: chunk }),
    })
    if (!res.ok) return false
  }
  return true
}

/** Remove all vectors for this client via metadata (mutually exclusive from ids in one call — separate POST). */
async function pineconeDeleteByClientMetadata(pcHost, pcKey, clientUuid) {
  const id = String(clientUuid || '').trim()
  if (!id) return true
  const res = await fetch(`${pcHost.replace(/\/$/, '')}/vectors/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Api-Key': pcKey, 'X-Pinecone-Api-Version': '2025-10' },
    body: JSON.stringify({ filter: { client_a_uuid: { $eq: id } } }),
  })
  return res.ok
}

async function pineconeUpsertPayloads(payloads) {
  if (!openaiKey || !pineconeKey || !pineconeHost) {
    return {
      pineconeOk: false,
      pineconeError: 'OPENAI_API_KEY, PINECONE_API_KEY, PINECONE_HOST must be set in server .env',
    }
  }

  if (!Array.isArray(payloads) || payloads.length === 0) {
    return { pineconeOk: false, pineconeError: 'No profile payloads to index' }
  }

  let pineconeError = null

  for (const mergedPayload of payloads) {
    const vectorId = String(mergedPayload.event_uuid || mergedPayload.client_a_uuid || '').trim()
    if (!vectorId) {
      pineconeError = 'Missing vector id (client_a_uuid or event_uuid)'
      return { pineconeOk: false, pineconeError }
    }

    const text = buildSemanticText(mergedPayload)
    const openaiRes = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
    })
    if (!openaiRes.ok) {
      pineconeError = `OpenAI failed: ${await openaiRes.text()}`
      return { pineconeOk: false, pineconeError }
    }
    const openaiData = await openaiRes.json()
    const embedding = openaiData?.data?.[0]?.embedding
    if (!Array.isArray(embedding)) {
      pineconeError = 'Invalid embedding from OpenAI'
      return { pineconeOk: false, pineconeError }
    }

    const metadata = buildMetadataFromPayload(mergedPayload)
    const pcUrl = `${pineconeHost.replace(/\/$/, '')}/vectors/upsert`
    const pcRes = await fetch(pcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': pineconeKey,
        'X-Pinecone-Api-Version': '2025-10',
      },
      body: JSON.stringify({ vectors: [{ id: vectorId, values: embedding, metadata }] }),
    })
    if (!pcRes.ok) {
      const pcText = await pcRes.text()
      const dim = embedding.length
      pineconeError = `Pinecone failed: ${pcText} (embedding length=${dim}; index must be ${dim} dims — this app uses OpenAI text-embedding-3-small → usually 1536)`
      return { pineconeOk: false, pineconeError }
    }
  }

  return { pineconeOk: true, pineconeError: null }
}

async function refreshPineconeFromClient(clientUuid, tags = null) {
  const { data: fullProfile, error: fetchError } = await supabase.rpc('get_client_full', {
    p_client_uuid: clientUuid,
  })
  if (fetchError || !fullProfile) {
    return { pineconeOk: false, pineconeError: fetchError?.message || 'Failed to fetch profile', profile: null }
  }

  const profile = typeof fullProfile === 'string' ? JSON.parse(fullProfile) : fullProfile
  const mergedResult = buildMergedPayloadFromProfile(profile, tags)
  const payloads = Array.isArray(mergedResult) ? mergedResult : [mergedResult]

  if (openaiKey && pineconeKey && pineconeHost) {
    const idsToDelete = [clientUuid]
    const eff = normalizeClientTypeFromProfile(profile.client_type)
    if (eff === 'event_organizer' && Array.isArray(profile.events)) {
      profile.events.forEach((ev) => {
        if (ev?.event_uuid) idsToDelete.push(ev.event_uuid)
      })
    }
    try {
      // Wipe every vector tagged with this client (covers multi-event rows and rewrites without listing orphans).
      await pineconeDeleteByClientMetadata(pineconeHost, pineconeKey, clientUuid)
    } catch {
      // Older rows may lack client_a_uuid in metadata; id delete below still clears known ids.
    }
    try {
      // Always delete by id (no pre-fetch): fetch-gated delete skipped removals when fetch failed or URL limits hit.
      await pineconeDelete(pineconeHost, pineconeKey, idsToDelete)
    } catch {
      // Continue to upsert so DB updates are not blocked by Pinecone.
    }
  }

  const { pineconeOk, pineconeError } = await pineconeUpsertPayloads(payloads)
  return { pineconeOk, pineconeError, profile }
}

function buildMergedPayload(clientRow, typeChoice, typeData) {
  const base = {
    client_a_uuid: clientRow.client_a_uuid,
    account_a_uuid: clientRow.account_a_uuid,
    business_name: clientRow.business_name,
    description: clientRow.description || '',
    rating: clientRow.rating || '',
    price_range: clientRow.price_range || '',
    client_type: typeChoice === 'none' ? 'client' : typeChoice,
    client_image: clientRow.client_image || null,
    lat: clientRow.lat || '',
    long: clientRow.long || '',
    lng: clientRow.long || '',
    timings: clientRow.timings || '',
    tags: Array.isArray(clientRow.tags) ? clientRow.tags : (clientRow.tags ? String(clientRow.tags).split(',').map(t => t.trim()).filter(Boolean) : []),
    openclosed_state: 'open',
    record_type: 'client',
  }
  return { ...base, ...typeData }
}

// Profile create/update: two tables per type. Supabase = client first, then subtype.
// - Restaurant: client → restaurant_client
// - Place: client → place (category, indoor_outdoor on place)
// - Event organizer: client → events (event_type, indoor_outdoor on events)
// Pinecone: upsert one vector per profile = combined client + subtype payload (semantic text + metadata).
app.post('/api/submit-profile', async (req, res) => {
  console.log('[Submit] Request received')
  try {
    const { form, accountUuid } = req.body
    if (!form || !accountUuid) {
      return res.status(400).json({ error: 'Missing form or accountUuid' })
    }

    const clientUuid = crypto.randomUUID()
    const typeChoice = normalizeClientTypeChoice(form.client_type_choice || '')

    const tags = form.tags
      ? String(form.tags).split(',').map(t => t.trim()).filter(Boolean)
      : []

    const clientRow = {
      client_a_uuid: clientUuid,
      account_a_uuid: accountUuid,
      business_name: form.business_name?.trim() || '',
      description: form.description?.trim() || null,
      rating: String(form.rating ?? '').trim() || null,
      price_range: form.price_range?.trim() || null,
      client_type: typeChoice === 'none' ? 'client' : typeChoice,
      client_image: String(form.client_image ?? '').trim() || null,
      lat: String(form.lat ?? '').trim() || null,
      long: readLongitude(form),
      timings: form.timings?.trim() || null,
      tags,
    }

    let pRestaurant = null
    let pPlaceClient = null
    let pPlace = null
    let pEvent = null

    if (typeChoice === 'restaurant') {
      const branches = normalizeBranches(form.branch)
      pRestaurant = {
        cuisine: form.cuisine?.trim() || '',
        meal_type: form.meal_type?.trim() || '',
        food_type: form.food_type?.trim() || '',
        speciality: form.speciality?.trim() || '',
        isfoodtruck: !!form.isfoodtruck,
        branch: branches,
      }
    } else if (typeChoice === 'place') {
      const placeUuid = crypto.randomUUID()
      pPlaceClient = { category: form.category?.trim() || '', indoor_outdoor: form.indoor_outdoor || '' }
      pPlace = {
        place_uuid: placeUuid,
        name: (form.place_name || form.business_name || '').trim() || '',
        description: (form.place_description || form.description || '').trim() || '',
        opening_time: form.opening_time?.trim() || '',
        closing_time: form.closing_time?.trim() || '',
        entry_cost: form.entry_cost?.trim() || '0',
        suitable_for: form.suitable_for?.trim() || '',
      }
    } else if (typeChoice === 'event_organizer') {
      // Profile only stores organizer details; events are created on the Posts page
      pEvent = {
        event_type: form.event_type?.trim() || '',
        indoor_outdoor: form.event_indoor_outdoor || '',
      }
    }

    const pClientForDb = {
      client_a_uuid: clientUuid,
      account_a_uuid: accountUuid,
      business_name: form.business_name?.trim() || '',
      description: form.description?.trim() || null,
      rating: String(form.rating ?? '').trim() || null,
      price_range: form.price_range?.trim() || null,
      client_type: typeChoice === 'none' ? 'client' : typeChoice,
      client_image: String(form.client_image ?? '').trim() || null,
      lat: String(form.lat ?? '').trim() || null,
      long: readLongitude(form),
      timings: form.timings?.trim() || null,
      tags,
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured', pineconeError: 'SUPABASE_URL and SUPABASE_ANON_KEY required' })
    }

    const { data: clientData, error: clientError } = await supabase.rpc('create_client_profile', {
      p_client: pClientForDb,
      p_type_choice: typeChoice,
      p_restaurant: pRestaurant,
      p_place_client: pPlaceClient,
      p_place: pPlace,
      p_event: pEvent,
    })

    if (clientError) {
      return res.status(500).json({ error: clientError.message, supabaseOk: false })
    }

    if (typeChoice === 'restaurant') {
      const { error: branchError } = await supabase.rpc('set_restaurant_branches', {
        p_client_uuid: clientUuid,
        p_branch: pRestaurant?.branch || [],
      })
      if (branchError) {
        return res.status(500).json({ error: branchError.message, supabaseOk: false })
      }
    }

    // AI summary stored in Supabase only (not Pinecone)
    const aiSummaryMeta = await refreshClientAiSummary(clientUuid)
    const { pineconeOk, pineconeError } = await refreshPineconeFromClient(clientUuid, tags)
    return res.json({ clientData, supabaseOk: true, pineconeOk, pineconeError, ...aiSummaryMeta })
  } catch (e) {
    return res.status(500).json({ error: String(e), pineconeError: String(e) })
  }
})

app.put('/api/update-profile', async (req, res) => {
  console.log('[Update] Request received')
  try {
    const { form, client_a_uuid, skipPinecone = false } = req.body
    if (!form || !client_a_uuid) {
      return res.status(400).json({ error: 'Missing form or client_a_uuid' })
    }

    const typeChoice = normalizeClientTypeChoice(form.client_type_choice || '')
    const tags = form.tags ? String(form.tags).split(',').map(t => t.trim()).filter(Boolean) : []

    let pRestaurant = null
    let pPlaceClient = null
    let pPlace = null
    let pEvent = null

    if (typeChoice === 'restaurant') {
      const branches = normalizeBranches(form.branch)
      pRestaurant = {
        cuisine: form.cuisine?.trim() || '',
        meal_type: form.meal_type?.trim() || '',
        food_type: form.food_type?.trim() || '',
        speciality: form.speciality?.trim() || '',
        isfoodtruck: !!form.isfoodtruck,
        branch: branches,
      }
    } else if (typeChoice === 'place') {
      pPlaceClient = { category: form.category?.trim() || '', indoor_outdoor: form.indoor_outdoor || '' }
      pPlace = {
        name: (form.place_name || form.business_name || '').trim() || '',
        description: (form.place_description || form.description || '').trim() || '',
        opening_time: form.opening_time?.trim() || '',
        closing_time: form.closing_time?.trim() || '',
        entry_cost: form.entry_cost?.trim() || '0',
        suitable_for: form.suitable_for?.trim() || '',
      }
    } else if (typeChoice === 'event_organizer') {
      // Profile only updates organizer details; events are created/edited on the Posts page
      pEvent = {
        event_type: form.event_type?.trim() || '',
        indoor_outdoor: form.event_indoor_outdoor || '',
      }
    }

    const pClientForDb = {
      client_a_uuid,
      business_name: form.business_name?.trim() || '',
      description: form.description?.trim() || null,
      rating: String(form.rating ?? '').trim() || null,
      price_range: form.price_range?.trim() || null,
      client_type: typeChoice === 'none' ? 'client' : typeChoice,
      client_image: String(form.client_image ?? '').trim() || null,
      lat: String(form.lat ?? '').trim() || null,
      long: readLongitude(form),
      timings: form.timings?.trim() || null,
      tags,
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured', pineconeError: 'SUPABASE_URL and SUPABASE_ANON_KEY required' })
    }

    const { error: updateError } = await supabase.rpc('update_client_profile', {
      p_client: pClientForDb,
      p_type_choice: typeChoice,
      p_restaurant: pRestaurant,
      p_place_client: pPlaceClient,
      p_place: pPlace,
      p_event: pEvent,
    })

    if (updateError) {
      return res.status(500).json({ error: updateError.message, supabaseOk: false })
    }

    if (typeChoice === 'restaurant') {
      const { error: branchError } = await supabase.rpc('set_restaurant_branches', {
        p_client_uuid: client_a_uuid,
        p_branch: pRestaurant?.branch || [],
      })
      if (branchError) {
        return res.status(500).json({ error: branchError.message, supabaseOk: false })
      }
    }

    if (skipPinecone) {
      const aiSummaryMeta = await refreshClientAiSummary(client_a_uuid)
      return res.json({
        supabaseOk: true,
        pineconeOk: false,
        pineconeError: null,
        ...aiSummaryMeta,
      })
    }

    const aiSummaryMeta = await refreshClientAiSummary(client_a_uuid)
    let { pineconeOk, pineconeError } = await refreshPineconeFromClient(client_a_uuid, tags)

    // Fallback: if refresh-from-db fails, upsert directly from current request payload.
    if (!pineconeOk) {
      let mergedPayload = { ...pClientForDb, tags }
      if (typeChoice === 'restaurant' && pRestaurant) {
        mergedPayload = buildMergedPayload(pClientForDb, typeChoice, pRestaurant)
      } else if (typeChoice === 'place' && pPlaceClient && pPlace) {
        mergedPayload = buildMergedPayload(pClientForDb, typeChoice, {
          ...pPlaceClient,
          ...pPlace,
          place_name: pPlace.name,
          place_description: pPlace.description,
        })
      } else if (typeChoice === 'event_organizer' && pEvent) {
        mergedPayload = buildMergedPayload(pClientForDb, typeChoice, {
          ...pEvent,
          record_type: 'event',
          indoor_outdoor: pEvent.indoor_outdoor || pEvent.event_indoor_outdoor || '',
        })
      }

      const fallbackPayloads = Array.isArray(mergedPayload) ? mergedPayload : [mergedPayload]
      const fallbackResult = await pineconeUpsertPayloads(fallbackPayloads)
      if (fallbackResult.pineconeOk) {
        pineconeOk = true
        pineconeError = null
      } else if (fallbackResult.pineconeError) {
        pineconeError = pineconeError
          ? `${pineconeError} | Fallback upsert failed: ${fallbackResult.pineconeError}`
          : `Fallback upsert failed: ${fallbackResult.pineconeError}`
      }
    }

    if (!pineconeOk) {
      console.warn('[Pinecone] update-profile index failed for', client_a_uuid, pineconeError)
    }
    return res.json({ supabaseOk: true, pineconeOk, pineconeError, ...aiSummaryMeta })
  } catch (e) {
    return res.status(500).json({ error: String(e), pineconeError: String(e) })
  }
})

app.post('/api/create-event', async (req, res) => {
  try {
    const { client_a_uuid, event } = req.body
    if (!client_a_uuid || !event) return res.status(400).json({ error: 'Missing client_a_uuid or event payload' })
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured' })

    const eventPayload = {
      event_uuid: event.event_uuid || crypto.randomUUID(),
      event_name: event.event_name?.trim() || '',
      name: event.event_name?.trim() || event.name?.trim() || '',
      status: event.status?.trim() || 'coming_soon',
      venue: event.venue?.trim() || '',
      image: String(event.image ?? '').trim() || null,
      lat: String(event.lat ?? '').trim() || null,
      long: String(event.long ?? '').trim() || null,
      start_date: event.start_date?.trim() || '',
      end_date: event.end_date?.trim() || '',
      start_time: event.start_time?.trim() || '',
      end_time: event.end_time?.trim() || '',
      event_type: event.event_type?.trim() || '',
      indoor_outdoor: event.indoor_outdoor || event.event_indoor_outdoor || '',
    }

    const { data: fullProfile, error: fetchError } = await supabase.rpc('get_client_full', { p_client_uuid: client_a_uuid })
    if (fetchError || !fullProfile) return res.status(404).json({ error: 'Client profile not found' })
    const profile = typeof fullProfile === 'string' ? JSON.parse(fullProfile) : fullProfile
    if (normalizeClientTypeFromProfile(profile.client_type) !== 'event_organizer') {
      return res.status(400).json({ error: 'Create event is allowed only for event organizer profiles' })
    }

    const { data: eventData, error: eventError } = await supabase.rpc('create_event_for_client', {
      p_client_uuid: client_a_uuid,
      p_event: eventPayload,
    })
    if (eventError) {
      return res.status(500).json({ error: eventError.message, supabaseOk: false })
    }

    const tags = Array.isArray(profile.tags)
      ? profile.tags
      : (typeof profile.tags === 'string' ? profile.tags.split(',').map((t) => t.trim()).filter(Boolean) : [])
    const aiSummaryMeta = await refreshClientAiSummary(client_a_uuid)
    const { pineconeOk, pineconeError } = await refreshPineconeFromClient(client_a_uuid, tags)

    return res.json({ event: eventData, supabaseOk: true, pineconeOk, pineconeError, ...aiSummaryMeta })
  } catch (e) {
    return res.status(500).json({ error: String(e), pineconeError: String(e) })
  }
})

app.put('/api/update-event', async (req, res) => {
  try {
    const { client_a_uuid, event_uuid, event } = req.body
    if (!client_a_uuid || !event_uuid || !event) {
      return res.status(400).json({ error: 'Missing client_a_uuid, event_uuid or event payload' })
    }
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured' })

    const { data: fullProfile, error: fetchError } = await supabase.rpc('get_client_full', { p_client_uuid: client_a_uuid })
    if (fetchError || !fullProfile) return res.status(404).json({ error: 'Client profile not found' })
    const profile = typeof fullProfile === 'string' ? JSON.parse(fullProfile) : fullProfile
    if (normalizeClientTypeFromProfile(profile.client_type) !== 'event_organizer') {
      return res.status(400).json({ error: 'Update event is allowed only for event organizer profiles' })
    }

    const eventPayload = {
      event_name: event.event_name?.trim() || '',
      name: event.event_name?.trim() || event.name?.trim() || '',
      status: event.status?.trim() || '',
      venue: event.venue?.trim() || '',
      image: String(event.image ?? '').trim() || null,
      lat: String(event.lat ?? '').trim() || null,
      long: String(event.long ?? '').trim() || null,
      start_date: event.start_date?.trim() || '',
      end_date: event.end_date?.trim() || '',
      start_time: event.start_time?.trim() || '',
      end_time: event.end_time?.trim() || '',
      event_type: event.event_type?.trim() || '',
      indoor_outdoor: event.indoor_outdoor || event.event_indoor_outdoor || '',
    }

    const { data: eventData, error: eventError } = await supabase.rpc('update_event_for_client', {
      p_client_uuid: client_a_uuid,
      p_event_uuid: event_uuid,
      p_event: eventPayload,
    })
    if (eventError) {
      return res.status(500).json({ error: eventError.message, supabaseOk: false })
    }

    const tags = Array.isArray(profile.tags)
      ? profile.tags
      : (typeof profile.tags === 'string' ? profile.tags.split(',').map((t) => t.trim()).filter(Boolean) : [])
    const aiSummaryMeta = await refreshClientAiSummary(client_a_uuid)
    const { pineconeOk, pineconeError } = await refreshPineconeFromClient(client_a_uuid, tags)

    return res.json({ event: eventData, supabaseOk: true, pineconeOk, pineconeError, ...aiSummaryMeta })
  } catch (e) {
    return res.status(500).json({ error: String(e), pineconeError: String(e) })
  }
})

app.delete('/api/delete-profile', async (req, res) => {
  try {
    const { client_a_uuid } = req.body
    if (!client_a_uuid) {
      return res.status(400).json({ error: 'Missing client_a_uuid' })
    }

    let pineconeOk = false
    if (pineconeKey && pineconeHost) {
      const idsToDelete = [client_a_uuid]
      try {
        const { data: profile } = (supabase ? await supabase.rpc('get_client_full', { p_client_uuid: client_a_uuid }) : { data: null }) || {}
        const p = typeof profile === 'string' ? JSON.parse(profile || '{}') : (profile || {})
        if (Array.isArray(p.events)) p.events.forEach((ev) => { if (ev?.event_uuid) idsToDelete.push(ev.event_uuid) })
      } catch (_) {}
      pineconeOk = await pineconeDelete(pineconeHost, pineconeKey, idsToDelete)
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured', supabaseOk: false })
    }

    const { error: deleteError } = await supabase.rpc('delete_client_profile', {
      p_client_uuid: client_a_uuid,
    })

    if (deleteError) {
      return res.status(500).json({ error: deleteError.message, supabaseOk: false })
    }

    return res.json({ supabaseOk: true, pineconeOk })
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
})

app.get('/api/client/:id/pinecone-tags', async (req, res) => {
  const { id } = req.params
  if (!id || !pineconeKey || !pineconeHost) return res.json({ tags: [] })
  try {
    const url = `${pineconeHost.replace(/\/$/, '')}/vectors/fetch?ids=${encodeURIComponent(id)}`
    const r = await fetch(url, { headers: { 'Api-Key': pineconeKey, 'X-Pinecone-Api-Version': '2025-10' } })
    if (!r.ok) return res.json({ tags: [] })
    const body = await r.json()
    const tags = body.vectors?.[id]?.metadata?.tags
    return res.json({ tags: Array.isArray(tags) ? tags : [] })
  } catch {
    return res.json({ tags: [] })
  }
})

/** Quick check: env loaded + optional live OpenAI + Pinecone upsert (set PINECONE_DEBUG=1 for probe). */
app.get('/api/health', (req, res) => {
  let hostLabel = null
  try {
    if (pineconeHost) hostLabel = new URL(pineconeHost).hostname
  } catch {
    hostLabel = 'invalid URL'
  }
  res.json({
    ok: true,
    searchIndex: {
      openaiKeyLoaded: Boolean(openaiKey),
      pineconeKeyLoaded: Boolean(pineconeKey),
      pineconeHostLoaded: Boolean(pineconeHost),
      pineconeHostname: hostLabel,
    },
    aiSummary: {
      openaiKeyLoaded: Boolean(openaiKey),
      supabaseConfigured: Boolean(supabase),
      note: 'On Save: OpenAI chat → public.set_client_ai_summary RPC (migration 015) → ai_summary column (014). Not stored in Pinecone.',
    },
    note:
      'Profile saves call OpenAI embeddings then Pinecone upsert. Index dimension must match the embedding (text-embedding-3-small → 1536). GET /api/health/pinecone-probe?debug=1 requires PINECONE_DEBUG=1 in .env.',
  })
})

/**
 * One-off or bulk backfill: generate and store ai_summary for a client (same logic as save).
 * If REGENERATE_AI_SUMMARY_SECRET is set, require header x-regenerate-ai-summary-secret with that value.
 */
app.post('/api/regenerate-ai-summary', async (req, res) => {
  try {
    const expected = process.env.REGENERATE_AI_SUMMARY_SECRET
    const sent = String(req.headers['x-regenerate-ai-summary-secret'] || req.body?.secret || '')
    if (expected && sent !== expected) {
      return res.status(403).json({ error: 'Invalid or missing x-regenerate-ai-summary-secret header' })
    }
    const clientUuid = String(req.body?.client_a_uuid || '').trim()
    if (!clientUuid) {
      return res.status(400).json({ error: 'Missing client_a_uuid in JSON body' })
    }
    const out = await refreshClientAiSummary(clientUuid)
    return res.status(out.aiSummaryOk ? 200 : 422).json(out)
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) })
  }
})

app.get('/api/health/pinecone-probe', async (req, res) => {
  if (process.env.PINECONE_DEBUG !== '1' || req.query.debug !== '1') {
    return res.status(403).json({
      error: 'Add PINECONE_DEBUG=1 to .env, restart server, then open /api/health/pinecone-probe?debug=1',
    })
  }
  if (!openaiKey || !pineconeKey || !pineconeHost) {
    return res.status(400).json({
      step: 'config',
      ok: false,
      detail: 'Missing OPENAI_API_KEY and/or PINECONE_API_KEY and/or PINECONE_HOST',
    })
  }
  const probeId = 'gobahrain-probe-delete-me'
  try {
    const openaiRes = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: 'health check' }),
    })
    const openaiText = await openaiRes.text()
    if (!openaiRes.ok) {
      return res.status(200).json({ ok: false, step: 'openai', status: openaiRes.status, detail: openaiText.slice(0, 800) })
    }
    const openaiData = JSON.parse(openaiText)
    const embedding = openaiData?.data?.[0]?.embedding
    if (!Array.isArray(embedding)) {
      return res.status(200).json({ ok: false, step: 'openai', detail: 'No embedding array in response' })
    }
    const pcUrl = `${pineconeHost.replace(/\/$/, '')}/vectors/upsert`
    const pcRes = await fetch(pcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': pineconeKey,
        'X-Pinecone-Api-Version': '2025-10',
      },
      body: JSON.stringify({
        vectors: [{ id: probeId, values: embedding, metadata: { probe: true } }],
      }),
    })
    const pcText = await pcRes.text()
    if (!pcRes.ok) {
      return res.status(200).json({
        ok: false,
        step: 'pinecone',
        embeddingDimensions: embedding.length,
        pineconeStatus: pcRes.status,
        detail: pcText.slice(0, 1200),
        hint:
          embedding.length !== 1536
            ? 'Unexpected embedding size; check OpenAI model.'
            : 'If error mentions dimension mismatch, create a new Pinecone index with dimension 1536 or fix the existing index.',
      })
    }
    await fetch(`${pineconeHost.replace(/\/$/, '')}/vectors/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': pineconeKey,
        'X-Pinecone-Api-Version': '2025-10',
      },
      body: JSON.stringify({ ids: [probeId] }),
    }).catch(() => {})
    return res.json({
      ok: true,
      embeddingDimensions: embedding.length,
      message: 'OpenAI + Pinecone upsert succeeded; probe vector removed.',
    })
  } catch (e) {
    return res.status(500).json({ ok: false, step: 'exception', detail: String(e?.message || e) })
  }
})

const port = Number(process.env.BACKEND_PORT || process.env.PORT || 4000)
app.listen(port, () => {
  console.log(`Server on http://localhost:${port}`)
  console.log(
    `[Search index] OpenAI: ${openaiKey ? 'key loaded' : 'MISSING'} | Pinecone: ${pineconeKey && pineconeHost ? 'key+host loaded' : 'MISSING'}`
  )
})

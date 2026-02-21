import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })
import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'

const app = express()
app.use(cors({ origin: '*' }))
app.use(express.json())

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://zonhaprelkjyjugpqfdn.supabase.co'
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvbmhhcHJlbGtqeWp1Z3BxZmRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3OTE1MDUsImV4cCI6MjA4NjM2NzUwNX0.vPJEdSZzZzNo-69QV-e7pKDyAC9rFYLdpJPiwgiQR3o'
const openaiKey = process.env.OPENAI_API_KEY
const pineconeKey = process.env.PINECONE_API_KEY
const pineconeHost = process.env.PINECONE_HOST

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null

function buildSemanticText(p) {
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
  if (p.start_date) parts.push(`Starts: ${p.start_date}.`)
  if (p.end_date) parts.push(`Ends: ${p.end_date}.`)
  if (p.start_time) parts.push(`Start time: ${p.start_time}.`)
  if (p.end_time) parts.push(`End time: ${p.end_time}.`)
  return parts.join('\n')
}

/** Keys to exclude from Pinecone metadata (internal IDs only) */
const PINECONE_METADATA_EXCLUDE = new Set(['account_a_uuid', 'client_a_uuid', 'place_uuid', 'event_uuid'])

/** Unified metadata — same as create: client + subtype, full payload, no duplicates */
function buildMetadataFromPayload(p) {
  const metadata = {}
  for (const [k, v] of Object.entries(p)) {
    if (PINECONE_METADATA_EXCLUDE.has(k) || v == null) continue
    if (Array.isArray(v)) metadata[k] = v.map(String)
    else if (typeof v === 'boolean' || typeof v === 'number') metadata[k] = v
    else metadata[k] = String(v)
  }
  return metadata
}

/** Build unified merged payload from fetched profile — same structure as create */
function buildMergedPayloadFromProfile(profile, tags) {
  const tagsArr = Array.isArray(profile.tags) ? profile.tags : (typeof profile.tags === 'string' && profile.tags) ? profile.tags.split(',').map(t => t.trim()).filter(Boolean) : (tags || [])
  const base = {
    client_a_uuid: profile.client_a_uuid,
    account_a_uuid: profile.account_a_uuid,
    business_name: profile.business_name || '',
    description: profile.description || '',
    rating: profile.rating ?? '',
    price_range: profile.price_range ?? '',
    client_type: profile.client_type || 'client',
    client_image: profile.client_image || null,
    lat: profile.lat ?? '',
    long: profile.long ?? '',
    timings: profile.timings ?? '',
    tags: tagsArr,
    openclosed_state: 'open',
    record_type: 'client',
  }
  if (profile.client_type === 'restaurant') {
    return { ...base, cuisine: profile.cuisine || '', meal_type: profile.meal_type || '', food_type: profile.food_type || '', speciality: profile.speciality || '', isfoodtruck: profile.isfoodtruck ?? false }
  }
  if (profile.client_type === 'place') {
    const placeName = profile.place_name || profile.name || ''
    return { ...base, category: profile.category || '', indoor_outdoor: profile.indoor_outdoor || '', place_uuid: profile.place_uuid || '', name: placeName, place_name: placeName, place_description: profile.place_description || profile.description || '', opening_time: profile.opening_time ?? '', closing_time: profile.closing_time ?? '', entry_cost: profile.entry_cost ?? '', suitable_for: profile.suitable_for || '' }
  }
  if (profile.client_type === 'event_organizer') {
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

async function pineconeDelete(pcHost, pcKey, ids) {
  const url = `${pcHost.replace(/\/$/, '')}/vectors/delete`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Api-Key': pcKey, 'X-Pinecone-Api-Version': '2025-10' },
    body: JSON.stringify({ ids }),
  })
  return res.ok
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
    timings: clientRow.timings || '',
    tags: Array.isArray(clientRow.tags) ? clientRow.tags : (clientRow.tags ? String(clientRow.tags).split(',').map(t => t.trim()).filter(Boolean) : []),
    openclosed_state: 'open',
    record_type: 'client',
  }
  return { ...base, ...typeData }
}

app.post('/api/submit-profile', async (req, res) => {
  console.log('[Submit] Request received')
  try {
    const { form, accountUuid } = req.body
    if (!form || !accountUuid) {
      return res.status(400).json({ error: 'Missing form or accountUuid' })
    }

    const clientUuid = crypto.randomUUID()
    const typeChoice = form.client_type_choice || ''

    const tags = form.tags
      ? String(form.tags).split(',').map(t => t.trim()).filter(Boolean)
      : []

    const clientRow = {
      client_a_uuid: clientUuid,
      account_a_uuid: accountUuid,
      business_name: form.business_name?.trim() || '',
      description: form.description?.trim() || null,
      rating: form.rating?.trim() || null,
      price_range: form.price_range?.trim() || null,
      client_type: typeChoice === 'none' ? 'client' : typeChoice,
      client_image: form.client_image?.trim() || null,
      lat: form.lat?.trim() || null,
      long: form.long?.trim() || null,
      timings: form.timings?.trim() || null,
      tags,
    }

    let pRestaurant = null
    let pPlaceClient = null
    let pPlace = null
    let pEvent = null

    if (typeChoice === 'restaurant') {
      pRestaurant = {
        cuisine: form.cuisine?.trim() || '',
        meal_type: form.meal_type?.trim() || '',
        food_type: form.food_type?.trim() || '',
        speciality: form.speciality?.trim() || '',
        isfoodtruck: !!form.isfoodtruck,
      }
    } else if (typeChoice === 'place') {
      const placeUuid = crypto.randomUUID()
      pPlaceClient = { category: form.category?.trim() || '', indoor_outdoor: form.indoor_outdoor || '' }
      pPlace = {
        place_uuid: placeUuid,
        name: form.place_name?.trim() || '',
        description: form.place_description?.trim() || '',
        opening_time: form.opening_time?.trim() || '',
        closing_time: form.closing_time?.trim() || '',
        entry_cost: form.entry_cost?.trim() || '0',
        suitable_for: form.suitable_for?.trim() || '',
      }
    } else if (typeChoice === 'event_organizer') {
      const eventUuid = crypto.randomUUID()
      pEvent = {
        event_uuid: eventUuid,
        event_type: form.event_type?.trim() || '',
        indoor_outdoor: form.event_indoor_outdoor || '',
        event_name: form.event_name?.trim() || '',
        venue: form.venue?.trim() || '',
        start_date: form.start_date?.trim() || '',
        end_date: form.end_date?.trim() || '',
        start_time: form.start_time?.trim() || '',
        end_time: form.end_time?.trim() || '',
      }
    }

    const pClientForDb = {
      client_a_uuid: clientUuid,
      account_a_uuid: accountUuid,
      business_name: form.business_name?.trim() || '',
      description: form.description?.trim() || null,
      rating: form.rating?.trim() || null,
      price_range: form.price_range?.trim() || null,
      client_type: typeChoice === 'none' ? 'client' : typeChoice,
      client_image: form.client_image?.trim() || null,
      lat: form.lat?.trim() || null,
      long: form.long?.trim() || null,
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

    let mergedPayload = { ...clientRow }
    mergedPayload.tags = tags
    if (typeChoice === 'restaurant' && pRestaurant) mergedPayload = buildMergedPayload(clientRow, typeChoice, pRestaurant)
    else if (typeChoice === 'place' && pPlaceClient && pPlace) mergedPayload = buildMergedPayload(clientRow, typeChoice, { ...pPlaceClient, ...pPlace, place_name: pPlace.name, place_description: pPlace.description })
    else if (typeChoice === 'event_organizer' && pEvent) mergedPayload = buildMergedPayload(clientRow, typeChoice, { ...pEvent, record_type: 'event' })

    let pineconeOk = false
    let pineconeError = null

    if (!openaiKey || !pineconeKey || !pineconeHost) {
      pineconeError = 'OPENAI_API_KEY, PINECONE_API_KEY, PINECONE_HOST must be set in server .env'
      console.error('[Pinecone]', pineconeError)
    } else {
      const vectorId = typeChoice === 'event_organizer' && pEvent?.event_uuid ? pEvent.event_uuid : mergedPayload.client_a_uuid
      const text = buildSemanticText(mergedPayload)
      const openaiRes = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
      })
      if (!openaiRes.ok) {
        const err = await openaiRes.text()
        pineconeError = `OpenAI failed: ${err}`
        console.error('[OpenAI]', pineconeError)
      } else {
        const openaiData = await openaiRes.json()
        const embedding = openaiData?.data?.[0]?.embedding
        if (!Array.isArray(embedding)) {
          pineconeError = 'Invalid embedding from OpenAI'
        } else {
          const metadata = buildMetadataFromPayload(mergedPayload)
          const pcUrl = `${pineconeHost.replace(/\/$/, '')}/vectors/upsert`
          const pcRes = await fetch(pcUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Api-Key': pineconeKey,
              'X-Pinecone-Api-Version': '2025-10',
            },
            body: JSON.stringify({
              vectors: [{ id: vectorId, values: embedding, metadata }],
            }),
          })
          const pcBody = await pcRes.text()
          if (!pcRes.ok) {
            pineconeError = `Pinecone failed: ${pcBody}`
            console.error('[Pinecone]', pineconeError)
          } else {
            pineconeOk = true
            console.log('[Pinecone] Upserted', mergedPayload.business_name, vectorId)
          }
        }
      }
    }

    return res.json({ clientData, supabaseOk: true, pineconeOk, pineconeError })
  } catch (e) {
    return res.status(500).json({ error: String(e), pineconeError: String(e) })
  }
})

app.put('/api/update-profile', async (req, res) => {
  console.log('[Update] Request received')
  try {
    const { form, client_a_uuid } = req.body
    if (!form || !client_a_uuid) {
      return res.status(400).json({ error: 'Missing form or client_a_uuid' })
    }

    const typeChoice = form.client_type_choice || ''
    const tags = form.tags ? String(form.tags).split(',').map(t => t.trim()).filter(Boolean) : []

    let pRestaurant = null
    let pPlaceClient = null
    let pPlace = null
    let pEvent = null

    if (typeChoice === 'restaurant') {
      pRestaurant = {
        cuisine: form.cuisine?.trim() || '',
        meal_type: form.meal_type?.trim() || '',
        food_type: form.food_type?.trim() || '',
        speciality: form.speciality?.trim() || '',
        isfoodtruck: !!form.isfoodtruck,
      }
    } else if (typeChoice === 'place') {
      pPlaceClient = { category: form.category?.trim() || '', indoor_outdoor: form.indoor_outdoor || '' }
      pPlace = {
        name: form.place_name?.trim() || '',
        description: form.place_description?.trim() || '',
        opening_time: form.opening_time?.trim() || '',
        closing_time: form.closing_time?.trim() || '',
        entry_cost: form.entry_cost?.trim() || '0',
        suitable_for: form.suitable_for?.trim() || '',
      }
    } else if (typeChoice === 'event_organizer') {
      pEvent = {
        event_uuid: form.event_uuid?.trim() || null,
        event_type: form.event_type?.trim() || '',
        indoor_outdoor: form.event_indoor_outdoor || '',
        event_name: form.event_name?.trim() || '',
        venue: form.venue?.trim() || '',
        start_date: form.start_date?.trim() || '',
        end_date: form.end_date?.trim() || '',
        start_time: form.start_time?.trim() || '',
        end_time: form.end_time?.trim() || '',
      }
    }

    const pClientForDb = {
      client_a_uuid,
      business_name: form.business_name?.trim() || '',
      description: form.description?.trim() || null,
      rating: form.rating?.trim() || null,
      price_range: form.price_range?.trim() || null,
      client_type: typeChoice === 'none' ? 'client' : typeChoice,
      client_image: form.client_image?.trim() || null,
      lat: form.lat?.trim() || null,
      long: form.long?.trim() || null,
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

    const { data: fullProfile, error: fetchError } = await supabase.rpc('get_client_full', {
      p_client_uuid: client_a_uuid,
    })

    if (fetchError || !fullProfile) {
      return res.status(500).json({ error: 'Failed to fetch updated profile', pineconeError: fetchError?.message })
    }

    const profile = typeof fullProfile === 'string' ? JSON.parse(fullProfile) : fullProfile
    const mergedResult = buildMergedPayloadFromProfile(profile, tags)
    const payloads = Array.isArray(mergedResult) ? mergedResult : [mergedResult]

    let pineconeOk = false
    let pineconeError = null

    if (!openaiKey || !pineconeKey || !pineconeHost) {
      pineconeError = 'OPENAI_API_KEY, PINECONE_API_KEY, PINECONE_HOST must be set in server .env'
      console.error('[Pinecone]', pineconeError)
    } else {
      const idsToDelete = [client_a_uuid]
      if (profile.client_type === 'event_organizer' && Array.isArray(profile.events)) {
        profile.events.forEach((ev) => { if (ev?.event_uuid) idsToDelete.push(ev.event_uuid) })
      }
      await pineconeDelete(pineconeHost, pineconeKey, idsToDelete)

      for (const mergedPayload of payloads) {
        const vectorId = mergedPayload.event_uuid || client_a_uuid
        const text = buildSemanticText(mergedPayload)
        const openaiRes = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
          body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
        })
        if (!openaiRes.ok) {
          const err = await openaiRes.text()
          pineconeError = `OpenAI failed: ${err}`
          console.error('[OpenAI]', pineconeError)
          break
        }
        const openaiData = await openaiRes.json()
        const embedding = openaiData?.data?.[0]?.embedding
        if (!Array.isArray(embedding)) {
          pineconeError = 'Invalid embedding from OpenAI'
          break
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
          body: JSON.stringify({
            vectors: [{ id: vectorId, values: embedding, metadata }],
          }),
        })
        if (!pcRes.ok) {
          pineconeError = `Pinecone failed: ${await pcRes.text()}`
          console.error('[Pinecone]', pineconeError)
          break
        }
        pineconeOk = true
        console.log('[Pinecone] Updated', mergedPayload.business_name, vectorId)
      }
    }

    return res.json({ supabaseOk: true, pineconeOk, pineconeError })
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

const port = process.env.PORT || 3001
app.listen(port, () => console.log(`Server on http://localhost:${port}`))

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? ''
const PINECONE_API_KEY = Deno.env.get('PINECONE_API_KEY') ?? ''
const PINECONE_HOST = Deno.env.get('PINECONE_HOST') ?? ''

function buildSemanticText(p: Record<string, unknown>): string {
  const parts: string[] = []
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
  return parts.join('\n')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })
  }
  try {
    const { payload } = await req.json()
    const cors = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    if (!payload || !payload.client_a_uuid) {
      return new Response(JSON.stringify({ error: 'Missing payload.client_a_uuid' }), { status: 400, headers: cors })
    }
    if (!OPENAI_API_KEY || !PINECONE_API_KEY || !PINECONE_HOST) {
      return new Response(JSON.stringify({ error: 'Secrets missing', detail: 'OPENAI_API_KEY, PINECONE_API_KEY, PINECONE_HOST must be set in Supabase Edge Function secrets' }), { status: 500, headers: cors })
    }
    const text = buildSemanticText(payload)
    const openaiRes = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
    })
    if (!openaiRes.ok) {
      const err = await openaiRes.text()
      return new Response(JSON.stringify({ error: 'OpenAI failed', detail: err }), { status: 500, headers: cors })
    }
    const openaiData = await openaiRes.json()
    const embedding = openaiData.data?.[0]?.embedding
    if (!Array.isArray(embedding)) {
      return new Response(JSON.stringify({ error: 'Invalid embedding' }), { status: 500, headers: cors })
    }
    const metadata: Record<string, string | number | boolean | string[]> = {}
    for (const [k, v] of Object.entries(payload)) {
      if (v == null) continue
      if (Array.isArray(v)) metadata[k] = v.map(String)
      else if (typeof v === 'boolean' || typeof v === 'number') metadata[k] = v
      else metadata[k] = String(v)
    }
    const pcUrl = `${PINECONE_HOST.replace(/\/$/, '')}/vectors/upsert`
    const pcRes = await fetch(pcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': PINECONE_API_KEY,
      },
      body: JSON.stringify({
        vectors: [{ id: payload.client_a_uuid, values: embedding, metadata }],
      }),
    })
    if (!pcRes.ok) {
      const err = await pcRes.text()
      return new Response(JSON.stringify({ error: 'Pinecone failed', detail: err }), { status: 500, headers: cors })
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: cors })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
  }
})

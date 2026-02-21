import { api } from '../config/api'

/**
 * Submit profile: backend handles Supabase insert + Pinecone upsert
 */
export async function submitProfile(form, accountUuid) {
  const base = api.backendUrl || (typeof location !== 'undefined' ? location.origin : '')
  const res = await fetch(`${base}/api/submit-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ form, accountUuid }),
  })
  const contentType = res.headers.get('content-type')
  if (!contentType?.includes('application/json')) {
    const text = await res.text()
    throw new Error(text?.startsWith('<!') ? 'Backend not reachable. Ensure server is running (npm run server or npm run dev).' : text || 'Submit failed')
  }
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Submit failed')
  return {
    clientData: data.clientData,
    supabaseOk: data.supabaseOk ?? true,
    pineconeOk: data.pineconeOk ?? false,
    pineconeError: data.pineconeError ?? null,
  }
}

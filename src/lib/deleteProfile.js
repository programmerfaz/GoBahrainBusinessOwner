import { api } from '../config/api'

/**
 * Delete profile: removes from Pinecone and Supabase (client + all linked tables)
 */
export async function deleteProfile(clientUuid) {
  const base = api.backendUrl || (typeof location !== 'undefined' ? location.origin : '')
  const res = await fetch(`${base}/api/delete-profile`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_a_uuid: clientUuid }),
  })
  const contentType = res.headers.get('content-type')
  if (!contentType?.includes('application/json')) {
    const text = await res.text()
    throw new Error(text?.startsWith('<!') ? 'Backend not reachable.' : text || 'Delete failed')
  }
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Delete failed')
  return { supabaseOk: data.supabaseOk ?? true, pineconeOk: data.pineconeOk ?? false }
}

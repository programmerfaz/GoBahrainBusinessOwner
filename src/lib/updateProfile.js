import { backendFetch } from './backendFetch'

/**
 * Update profile: backend updates Supabase, fetches full profile, upserts to Pinecone
 */
export async function updateProfile(form, clientUuid, options = {}) {
  const { skipPinecone = false } = options
  const res = await backendFetch('/api/update-profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ form, client_a_uuid: clientUuid, skipPinecone }),
  })
  const contentType = res.headers.get('content-type')
  if (!contentType?.includes('application/json')) {
    const text = await res.text()
    throw new Error(text?.startsWith('<!') ? 'Backend not reachable. Ensure server is running (npm run server or npm run dev).' : text || 'Update failed')
  }
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Update failed')
  return {
    supabaseOk: data.supabaseOk ?? true,
    pineconeOk: data.pineconeOk ?? false,
    pineconeError: data.pineconeError ?? null,
    aiSummaryOk: data.aiSummaryOk ?? false,
    aiSummaryError: data.aiSummaryError ?? null,
  }
}

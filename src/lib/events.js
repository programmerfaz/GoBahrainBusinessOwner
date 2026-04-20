import { backendFetch } from './backendFetch'

/**
 * Create an event for an event-organizer client.
 * Backend inserts into events table and refreshes Pinecone vectors.
 */
export async function createEventForClient(clientUuid, event) {
  const res = await backendFetch('/api/create-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_a_uuid: clientUuid, event }),
  })
  const contentType = res.headers.get('content-type')
  if (!contentType?.includes('application/json')) {
    const text = await res.text()
    throw new Error(text?.startsWith('<!') ? 'Backend not reachable. Ensure server is running (npm run server or npm run dev).' : text || 'Create event failed')
  }
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Create event failed')
  return {
    event: data.event,
    supabaseOk: data.supabaseOk ?? true,
    pineconeOk: data.pineconeOk ?? false,
    pineconeError: data.pineconeError ?? null,
  }
}

export async function updateEventForClient(clientUuid, eventUuid, event) {
  const res = await backendFetch('/api/update-event', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_a_uuid: clientUuid, event_uuid: eventUuid, event }),
  })
  const contentType = res.headers.get('content-type')
  if (!contentType?.includes('application/json')) {
    const text = await res.text()
    throw new Error(text?.startsWith('<!') ? 'Backend not reachable. Ensure server is running (npm run server or npm run dev).' : text || 'Update event failed')
  }
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Update event failed')
  return {
    event: data.event,
    supabaseOk: data.supabaseOk ?? true,
    pineconeOk: data.pineconeOk ?? false,
    pineconeError: data.pineconeError ?? null,
  }
}

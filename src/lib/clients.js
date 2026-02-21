import { supabase } from './supabase'
import { api } from '../config/api'

/**
 * Fetch all clients for an account (uses RPC to bypass RLS)
 */
export async function getClientsByAccount(accountUuid) {
  const { data, error } = await supabase.rpc('get_clients_for_account', {
    p_account_uuid: accountUuid,
  })

  if (error) {
    if (error.code === '42883') {
      const { data: direct } = await supabase
        .from('client')
        .select('*')
        .eq('account_a_uuid', accountUuid)
        .order('business_name')
      return direct || []
    }
    throw error
  }
  const arr = typeof data === 'string' ? JSON.parse(data) : data
  return Array.isArray(arr) ? arr : []
}

/**
 * Fetch a single client with full joined subtype (restaurant_client, place_client+place, event_organizer_client)
 */
export async function getClientFull(clientUuid) {
  const { data, error } = await supabase.rpc('get_client_full', {
    p_client_uuid: clientUuid,
  })
  if (error) throw error
  if (!data) return null
  return typeof data === 'string' ? JSON.parse(data) : data
}

export function fetchTagsFromPinecone(clientUuid) {
  const base = api.backendUrl || (typeof window !== 'undefined' && window.location ? window.location.origin : '')
  if (!base) return Promise.resolve(null)
  return fetch(`${base}/api/client/${clientUuid}/pinecone-tags`)
    .then(r => r.json())
    .then(d => (Array.isArray(d?.tags) && d.tags.length ? d.tags : null))
    .catch(() => null)
}

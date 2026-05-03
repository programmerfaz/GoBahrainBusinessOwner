import { supabase } from './supabase'

export type AdminClientRow = {
  client_a_uuid: string
  account_a_uuid: string
  business_name: string
  description: string | null
  client_type: string
  client_image: string | null
  rating: number | null
  price_range: string | null
  lat: number | null
  long: number | null
  timings: string | null
  qrcode: string | null
  tags: unknown
  account_email: string | null
  account_user_name: string | null
  account_phone: string | null
}

export type AdminAccountRow = {
  account_uuid: string
  email: string
  user_name: string | null
  phone: string | null
  account_type: string | null
  auth_id: string | null
}

export type PlatformSettingsRow = {
  id: number
  privacy_policy: string
  about_us: string
  contact_email: string
  contact_phone: string
  default_language: string
  bahrain_info: string
  updated_at: string
}

function parseRpcJsonArray<T>(data: unknown): T[] {
  if (data == null) return []
  if (Array.isArray(data)) return data as T[]
  if (typeof data === 'string') {
    try {
      const p = JSON.parse(data) as unknown
      return Array.isArray(p) ? (p as T[]) : []
    } catch {
      return []
    }
  }
  return []
}

export async function fetchAdminClients(): Promise<AdminClientRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('admin_list_clients_for_console')
  if (error) {
    if (error.code === '42883') {
      throw new Error('RPC admin_list_clients_for_console not found. Run migration 018 and 019 in Supabase SQL Editor.')
    }
    throw error
  }
  return parseRpcJsonArray<AdminClientRow>(data)
}

export async function fetchAdminAccounts(): Promise<AdminAccountRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('admin_list_accounts_for_console')
  if (error) {
    if (error.code === '42883') {
      throw new Error('RPC admin_list_accounts_for_console not found. Run migration 018 and 019 in Supabase SQL Editor.')
    }
    throw error
  }
  return parseRpcJsonArray<AdminAccountRow>(data)
}

export async function checkAdminRpc(): Promise<{ uid: string | null; isAdmin: boolean }> {
  if (!supabase) return { uid: null, isAdmin: false }
  const { data } = await supabase.rpc('admin_list_clients_for_console')
  const arr = parseRpcJsonArray(data)
  const { data: { user } } = await supabase.auth.getUser()
  return { uid: user?.id ?? null, isAdmin: Array.isArray(arr) }
}

export async function fetchPlatformSettings(): Promise<PlatformSettingsRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('platform_settings').select('*').eq('id', 1).maybeSingle()
  if (error) throw error
  return data as PlatformSettingsRow | null
}

export async function updatePlatformSettings(
  patch: Partial<
    Pick<
      PlatformSettingsRow,
      'privacy_policy' | 'about_us' | 'contact_email' | 'contact_phone' | 'default_language' | 'bahrain_info'
    >
  >,
): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured')
  const { error } = await supabase.from('platform_settings').update(patch).eq('id', 1)
  if (error) throw error
}

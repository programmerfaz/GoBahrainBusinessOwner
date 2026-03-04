import { createClient } from '@supabase/supabase-js'
import { api } from '../config/api'

let client = null
try {
  const url = api.supabase?.url
  const key = api.supabase?.anonKey
  if (url && key && typeof key === 'string' && key.length > 20) {
    client = createClient(url, key)
  }
} catch (e) {
  console.warn('Supabase client init failed:', e?.message)
}

export const supabase = client

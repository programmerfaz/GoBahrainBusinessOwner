import { createClient } from '@supabase/supabase-js'
import { api } from '../config/api'

export const supabase = createClient(api.supabase.url, api.supabase.anonKey)

/**
 * API keys, URLs, endpoints — single file for easy updates.
 * Change values here when switching environments or keys.
 */

const SUPABASE_DEFAULT_URL = 'https://zonhaprelkjyjugpqfdn.supabase.co'
const SUPABASE_DEFAULT_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvbmhhcHJlbGtqeWp1Z3BxZmRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3OTE1MDUsImV4cCI6MjA4NjM2NzUwNX0.vPJEdSZzZzNo-69QV-e7pKDyAC9rFYLdpJPiwgiQR3o'

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim() || SUPABASE_DEFAULT_URL
const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim() || SUPABASE_DEFAULT_ANON_KEY

export const api = {
  // Backend API — use '' to hit Vite proxy in dev; set VITE_API_URL for production
  backendUrl: import.meta.env.VITE_API_URL ?? '',

  // Supabase
  supabase: {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
  },

  // OpenAI (optional — use .env to override)
  openai: {
    apiKey: import.meta.env.VITE_OPENAI_API_KEY ?? '',
  },

  // Pinecone
  pinecone: {
    apiKey: import.meta.env.VITE_PINECONE_API_KEY ?? '',
    host: import.meta.env.VITE_PINECONE_HOST ?? '',
  },
}

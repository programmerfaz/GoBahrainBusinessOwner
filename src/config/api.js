/**
 * API keys, URLs, endpoints — single file for easy updates.
 * Change values here when switching environments or keys.
 */

const SUPABASE_PROJECT_ID = 'zonhaprelkjyjugpqfdn'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvbmhhcHJlbGtqeWp1Z3BxZmRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3OTE1MDUsImV4cCI6MjA4NjM2NzUwNX0.vPJEdSZzZzNo-69QV-e7pKDyAC9rFYLdpJPiwgiQR3o'

export const api = {
  // Backend API — use '' to hit Vite proxy in dev; set VITE_API_URL for production
  backendUrl: import.meta.env.VITE_API_URL ?? '',

  // Supabase
  supabase: {
    url: `https://${SUPABASE_PROJECT_ID}.supabase.co`,
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

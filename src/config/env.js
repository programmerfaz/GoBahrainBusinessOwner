/**
 * Re-exports from api.js — use api.js for all keys/endpoints.
 * @deprecated Prefer: import { api } from './config/api'
 */
import { api } from './api'

export const env = {
  get openaiApiKey() {
    return api.openai.apiKey
  },
  get pineconeApiKey() {
    return api.pinecone.apiKey
  },
  get pineconeHost() {
    return api.pinecone.host
  },
  get supabaseUrl() {
    return api.supabase.url
  },
  get supabaseAnonKey() {
    return api.supabase.anonKey
  },
}

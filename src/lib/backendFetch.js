import { api } from '../config/api'

function backendBase() {
  const b = api.backendUrl || (typeof location !== 'undefined' ? location.origin : '') || ''
  return String(b).replace(/\/$/, '')
}

/**
 * fetch() to the Express backend. Surfaces a helpful message when the connection fails
 * (browser often reports only "TypeError: fetch failed").
 */
export async function backendFetch(path, init = {}) {
  const p = path.startsWith('/') ? path : `/${path}`
  const base = backendBase()
  const url = base ? `${base}${p}` : p

  try {
    return await fetch(url, { ...init })
  } catch (e) {
    const name = e?.name || ''
    const msg = String(e?.message || e || '')
    const looksNetwork =
      name === 'TypeError' ||
      /fetch failed|failed to fetch|networkerror|load failed|network request failed|econnrefused/i.test(msg)
    if (looksNetwork) {
      throw new Error(
        `Cannot reach the API (${url}). Run the full stack with npm run dev (starts Express + Vite), or run npm run server in another terminal. If you use a separate API host, set VITE_API_URL in .env to that base URL (e.g. http://localhost:4000).`,
      )
    }
    throw e
  }
}

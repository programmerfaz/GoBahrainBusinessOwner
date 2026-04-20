/**
 * Backfill client.ai_summary for many rows (export never ran the app save pipeline).
 *
 * Usage:
 *   1) Start backend: npm run server  (or npm run dev)
 *   2) Ensure .env has OPENAI_API_KEY (or VITE_OPENAI_API_KEY), Supabase URL + anon key,
 *      and migrations 014 (ai_summary column) + 015 (set_client_ai_summary RPC) applied in Supabase.
 *   3) From repo root:
 *        node scripts/backfill-ai-summaries.mjs ./clients-export.csv
 *      Or:
 *        node scripts/backfill-ai-summaries.mjs --uuids "uuid1,uuid2,uuid3"
 *
 * Optional: REGENERATE_AI_SUMMARY_SECRET in .env — then set the same in header via env for script (see fetch below).
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
dotenv.config({ path: path.join(root, '.env') })
dotenv.config({ path: path.join(root, '.env.local') })

const port = Number(process.env.BACKEND_PORT || process.env.PORT || 4000)
const baseUrl = String(process.env.BACKEND_URL || `http://localhost:${port}`).replace(/\/$/, '')
const secret = process.env.REGENERATE_AI_SUMMARY_SECRET || ''

const UUID_RE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i

function collectUuids(argv) {
  if (argv[2] === '--uuids' && argv[3]) {
    return argv[3]
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  const filePath = argv[2]
  if (!filePath) return []
  const text = fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf8')
  const out = []
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t || /^client_a_uuid/i.test(t)) continue
    const m = t.match(UUID_RE)
    if (m) out.push(m[1].toLowerCase())
  }
  return [...new Set(out)]
}

async function regenerate(clientUuid) {
  const r = await fetch(`${baseUrl}/api/regenerate-ai-summary`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(secret ? { 'x-regenerate-ai-summary-secret': secret } : {}),
    },
    body: JSON.stringify({ client_a_uuid: clientUuid }),
  })
  let data = {}
  try {
    data = await r.json()
  } catch {
    data = {}
  }
  return { ok: r.ok && data.aiSummaryOk, status: r.status, data }
}

const uuids = collectUuids(process.argv)
if (uuids.length === 0) {
  console.error('Usage:')
  console.error('  node scripts/backfill-ai-summaries.mjs path/to/export.csv')
  console.error('  node scripts/backfill-ai-summaries.mjs --uuids "uuid1,uuid2"')
  process.exit(1)
}

console.log(`Backfill ${uuids.length} clients via ${baseUrl}/api/regenerate-ai-summary`)

let okN = 0
let failN = 0
for (let i = 0; i < uuids.length; i++) {
  const id = uuids[i]
  process.stdout.write(`[${i + 1}/${uuids.length}] ${id} … `)
  const { ok, status, data } = await regenerate(id)
  if (ok) {
    okN++
    console.log('OK')
  } else {
    failN++
    console.log(`FAIL (${status}) ${data.aiSummaryError || data.error || JSON.stringify(data)}`)
  }
  await new Promise((r) => setTimeout(r, 700))
}

console.log(`Done. OK=${okN} FAIL=${failN}`)

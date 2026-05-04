#!/usr/bin/env node
/**
 * Creates Supabase Auth users (password via Auth) and upserts public.admins.
 * Default list: Admin_fazil@gmail.com, admin_esmail@gmail.com (password 121212).
 * Requires migration 017_admins_table.sql applied first.
 *
 * Env: SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
 *
 * If the Auth user already exists, this script still sets password to 121212 and
 * email_confirm true so "Invalid login credentials" can be fixed by re-running.
 */
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL (or VITE_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY in .env')
  console.error('')
  console.error('You do not need this script or the service role to set up admins. Use the Dashboard path:')
  console.error('  npm run admin:setup-help')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const admins = [
  { email: 'Admin_fazil@gmail.com', display_name: 'Admin Fazil', role: 'super_admin' },
  /** Same admin as before if you used Admin_esmail@gmail.com — Auth matches case-insensitively. */
  { email: 'admin_esmail@gmail.com', display_name: 'Admin Esmail', role: 'super_admin' },
]

const password = '121212'

async function ensureAuthUser(email, displayName) {
  const list = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (list.error) throw list.error
  const found = list.data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (found) {
    const { error: updErr } = await supabase.auth.admin.updateUserById(found.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: displayName },
    })
    if (updErr) throw updErr
    return { user: found, created: false }
  }

  const created = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: displayName },
  })
  if (created.error) throw created.error
  return { user: created.data.user, created: true }
}

async function main() {
  for (const row of admins) {
    const { user, created } = await ensureAuthUser(row.email, row.display_name)
    const up = await supabase.from('admins').upsert(
      {
        admin_id: user.id,
        display_name: row.display_name,
        role: row.role,
      },
      { onConflict: 'admin_id' },
    )
    if (up.error) throw up.error
    console.log(created ? 'Created Auth user + admin row:' : 'Linked existing Auth user:', row.email, '→', user.id)
  }
  console.log('Done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

import { supabase } from './supabase'

/** Map account row to app shape: ensure .name for display (from user_name) */
function accountForApp(account) {
  if (!account) return null
  return { ...account, name: account.user_name ?? account.name ?? '' }
}

/**
 * Sign up — uses Supabase Auth, then creates account + client via RPC (no trigger).
 * account_type is always 'client'. clientType: 'place' | 'restaurant' | 'event_organizer' (dropdown).
 */
export async function signUp({ email, password, name, phone, clientType }) {
  if (!supabase) throw new Error('Supabase is not configured. Add VITE_SUPABASE_ANON_KEY to your .env file.')

  const trimmedEmail = String(email || '').trim()
  const trimmedPassword = String(password || '').trim()
  const trimmedName = String(name || '').trim()
  const trimmedPhone = String(phone || '').trim()
  const trimmedClientType = String(clientType || 'restaurant').trim() || 'restaurant'

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: trimmedEmail,
    password: trimmedPassword,
    options: {
      data: {
        name: trimmedName,
        phone: trimmedPhone,
        client_type: trimmedClientType,
      },
    },
  })

  if (authError) throw authError
  if (!authData?.user?.id) throw new Error('Sign up failed: no user returned')

  if (authData.session) {
    const { data: accountRow, error: rpcError } = await supabase.rpc('create_my_account_and_client', {
      p_email: trimmedEmail,
      p_name: trimmedName,
      p_phone: trimmedPhone,
      p_client_type: trimmedClientType,
    })
    if (rpcError) throw new Error(rpcError.message || 'Could not create account. Try again.')
    if (accountRow) return accountForApp(accountRow)
    const { data: fetched } = await supabase.from('account').select('*').maybeSingle()
    if (fetched) return accountForApp(fetched)
  }

  throw new Error('Check your email to confirm your account, then sign in.')
}

/**
 * Sign in — uses Supabase Auth, then loads account. Never creates account on sign-in (avoids 409).
 * If account exists by email but auth_id was missing, link_auth_to_existing_account links it.
 */
export async function signIn(email, password) {
  if (!supabase) throw new Error('Supabase is not configured. Add VITE_SUPABASE_ANON_KEY to your .env file.')

  const trimmedEmail = String(email || '').trim()
  const trimmedPassword = String(password || '').trim()

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: trimmedEmail,
    password: trimmedPassword,
  })

  if (authError) throw new Error(authError.message || 'Invalid email or password')
  if (!authData?.user?.id) throw new Error('Invalid email or password')

  let accountRow = (await supabase.from('account').select('*').maybeSingle()).data
  if (accountRow) return accountForApp(accountRow)

  // Account not found by auth_id (e.g. old account or auth_id never set). Link existing account to this user.
  const { data: linked } = await supabase.rpc('link_auth_to_existing_account', { p_email: trimmedEmail })
  if (linked) return accountForApp(linked)

  accountRow = (await supabase.from('account').select('*').maybeSingle()).data
  if (accountRow) return accountForApp(accountRow)

  throw new Error('Account not found. Please sign up first.')
}

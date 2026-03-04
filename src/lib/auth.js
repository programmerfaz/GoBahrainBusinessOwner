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
 * Sign in — uses Supabase Auth, then loads account by auth_id (RLS returns current user's row).
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

  const user = authData.user
  const meta = user?.user_metadata || {}
  const { data: created, error: rpcError } = await supabase.rpc('create_my_account_and_client', {
    p_email: user?.email ?? '',
    p_name: meta.name ?? meta.user_name ?? '',
    p_phone: meta.phone ?? '',
    p_client_type: meta.client_type ?? 'restaurant',
  })
  if (!rpcError && created) return accountForApp(created)
  accountRow = (await supabase.from('account').select('*').maybeSingle()).data
  if (accountRow) return accountForApp(accountRow)

  throw new Error('Account not found. Please sign up first.')
}

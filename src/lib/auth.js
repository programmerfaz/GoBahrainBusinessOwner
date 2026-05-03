import { supabase } from './supabase'

/** Map raw Supabase Auth errors into clean, user-facing messages. */
function friendlyAuthError(err, fallback = 'Something went wrong. Please try again.') {
  const msg = String(err?.message || '').toLowerCase()
  const code = String(err?.code || err?.status || '').toLowerCase()

  if (
    code === 'invalid_credentials' ||
    msg.includes('invalid login') ||
    msg.includes('invalid credentials')
  ) {
    return 'The email or password you entered is incorrect.'
  }
  if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) {
    return 'Please confirm your email before signing in. Check your inbox for the confirmation link.'
  }
  if (code === 'user_not_found' || msg.includes('user not found')) {
    return "We couldn't find an account with that email."
  }
  if (code === 'over_request_rate_limit' || msg.includes('too many') || msg.includes('rate limit')) {
    return 'Too many attempts. Please wait a moment and try again.'
  }
  if (code === 'weak_password' || msg.includes('password')) {
    if (msg.includes('weak') || msg.includes('at least') || msg.includes('characters')) {
      return 'Please choose a stronger password (at least 8 characters).'
    }
  }
  if (code === 'user_already_exists' || msg.includes('already registered') || msg.includes('already exists')) {
    return 'An account with this email already exists. Try signing in instead.'
  }
  if (msg.includes('failed to fetch') || msg.includes('network')) {
    return 'Network issue — check your connection and try again.'
  }
  return fallback
}

/** Map account row to app shape: ensure .name for display (from user_name) */
function accountForApp(account) {
  if (!account) return null
  return {
    ...account,
    name: account.user_name ?? account.name ?? '',
    is_platform_admin: account.is_platform_admin === true,
  }
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

  if (authError) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[auth] sign-up failed:', {
        code: authError.code ?? authError.status ?? null,
        message: authError.message ?? null,
      })
    }
    throw new Error(friendlyAuthError(authError, "We couldn't create your account. Please try again."))
  }
  if (!authData?.user?.id) throw new Error("We couldn't create your account. Please try again.")

  if (authData.session) {
    const { data: accountRow, error: rpcError } = await supabase.rpc('create_my_account_and_client', {
      p_email: trimmedEmail,
      p_name: trimmedName,
      p_phone: trimmedPhone,
      p_client_type: trimmedClientType,
    })
    if (rpcError) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[auth] create_my_account_and_client failed:', rpcError)
      }
      throw new Error("We couldn't finish setting up your account. Please try again.")
    }
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
  // GoTrue stores emails lowercased; signing in with mixed case can fail if the client sends a variant.
  const emailForAuth = trimmedEmail.toLowerCase()

  let authData = null
  let authError = null
  const trySignIn = async (addr) => {
    const r = await supabase.auth.signInWithPassword({ email: addr, password: trimmedPassword })
    authData = r.data
    authError = r.error
  }

  await trySignIn(emailForAuth)
  if (authError && trimmedEmail !== emailForAuth) {
    await trySignIn(trimmedEmail)
  }

  if (authError) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[auth] sign-in failed:', {
        code: authError.code ?? authError.status ?? null,
        message: authError.message ?? null,
      })
    }
    throw new Error(friendlyAuthError(authError, 'The email or password you entered is incorrect.'))
  }
  if (!authData?.user?.id) throw new Error('The email or password you entered is incorrect.')

  const { data: adminRow } = await supabase.from('admins').select('admin_id, display_name, role').eq('admin_id', authData.user.id).maybeSingle()

  if (adminRow?.admin_id) {
    const u = authData.user
    return accountForApp({
      is_platform_admin: true,
      account_uuid: null,
      email: u.email ?? emailForAuth,
      user_name: adminRow.display_name || u.user_metadata?.full_name || u.user_metadata?.name || 'Admin',
      auth_id: u.id,
      phone: '',
    })
  }

  let accountRow = (await supabase.from('account').select('*').maybeSingle()).data
  if (accountRow) return accountForApp(accountRow)

  // Account not found by auth_id (e.g. old account or auth_id never set). Link existing account to this user.
  const { data: linked } = await supabase.rpc('link_auth_to_existing_account', { p_email: emailForAuth })
  if (linked) return accountForApp(linked)

  accountRow = (await supabase.from('account').select('*').maybeSingle()).data
  if (accountRow) return accountForApp(accountRow)

  throw new Error('Account not found. Please sign up first.')
}

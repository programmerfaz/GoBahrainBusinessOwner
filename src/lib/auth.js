import { supabase } from './supabase'

/**
 * Sign up — insert new account into public.account
 */
export async function signUp({ email, password, name, phone }) {
  const { data, error } = await supabase
    .from('account')
    .insert({
      account_uuid: crypto.randomUUID(),
      email: email.trim(),
      password: password,
      name: name.trim(),
      phone: phone.trim(),
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Sign in — tries direct query first, then RPC if RLS blocks
 */
export async function signIn(email, password) {
  const trimmedEmail = String(email || '').trim()
  const trimmedPassword = String(password || '').trim()

  const { data: directData, error: directError } = await supabase
    .from('account')
    .select('*')
    .eq('email', trimmedEmail)
    .eq('password', trimmedPassword)
    .maybeSingle()

  if (!directError && directData) return directData

  const { data: rpcData, error: rpcError } = await supabase.rpc('sign_in', {
    check_email: trimmedEmail,
    check_password: trimmedPassword,
  })

  if (!rpcError && rpcData) return rpcData
  if (rpcError?.code === '42883') {
    throw new Error('RLS may be blocking. Run supabase/functions/sign_in.sql in Supabase SQL Editor, then try again.')
  }
  if (rpcError) throw rpcError

  throw new Error('Invalid email or password')
}

import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { accountForApp } from '../lib/auth'

const AuthContext = createContext(null)

const STORAGE_KEY = 'gobahrain_account'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setUser(JSON.parse(stored))
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!supabase || loading || !user?.account_uuid || user.is_platform_admin) return
    const accountUuid = user.account_uuid

    async function sync() {
      const { data, error } = await supabase
        .from('account')
        .select('*')
        .eq('account_uuid', accountUuid)
        .maybeSingle()
      if (error || !data) return
      const next = accountForApp(data)
      setUser((prev) => {
        if (!prev?.account_uuid || prev.account_uuid !== accountUuid) return prev
        const merged = { ...prev, ...next, name: next.name || prev.name }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
        return merged
      })
    }

    void sync()
    const onVis = () => {
      if (document.visibilityState === 'visible') void sync()
    }
    document.addEventListener('visibilitychange', onVis)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      void sync()
    })
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      subscription.unsubscribe()
    }
  }, [loading, user?.account_uuid, user?.is_platform_admin])

  function login(account) {
    setUser(account)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(account))
  }

  function logout() {
    try {
      void supabase?.auth.signOut()
    } catch {
      /* ignore */
    }
    setUser(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

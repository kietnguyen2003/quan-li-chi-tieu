import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../service/supabase/create-client'
import { AuthContext } from './auth-context'
import { getAuthErrorMessage } from './auth-utils'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState<string | null>(null)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)
  const sessionVersion = useRef(0)
  const mounted = useRef(false)

  const retrySession = useCallback(async () => {
    if (!supabase) return
    const version = ++sessionVersion.current
    setLoading(true)
    setError(null)
    try {
      const { data, error: sessionError } = await supabase.auth.getSession()
      if (!mounted.current || version !== sessionVersion.current) return
      if (sessionError) throw sessionError
      setUser(data.session?.user ?? null)
    } catch (sessionError) {
      if (mounted.current && version === sessionVersion.current) {
        setError(getAuthErrorMessage(sessionError))
      }
    } finally {
      if (mounted.current && version === sessionVersion.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    if (!supabase) return () => { mounted.current = false }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted.current) return
      sessionVersion.current += 1
      setUser(session?.user ?? null)
      setLoading(false)
      setError(null)
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true)
      if (event === 'SIGNED_OUT') setIsPasswordRecovery(false)
    })
    // Defer to avoid synchronous state updates in the effect and let the
    // subscription capture any event that occurs while session loading runs.
    void Promise.resolve().then(() => {
      if (mounted.current) return retrySession()
    })
    return () => {
      mounted.current = false
      sessionVersion.current += 1
      subscription.unsubscribe()
    }
  }, [retrySession])

  const signOut = useCallback(async () => {
    if (!supabase) return
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' })
    if (signOutError) throw signOutError
    if (mounted.current) {
      sessionVersion.current += 1
      setUser(null)
      setError(null)
      setLoading(false)
      setIsPasswordRecovery(false)
    }
  }, [])

  const clearPasswordRecovery = useCallback(() => setIsPasswordRecovery(false), [])

  return (
    <AuthContext.Provider value={{ user, loading, error, isPasswordRecovery, clearPasswordRecovery, retrySession, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

const AuthContext = createContext(null)

function getErrorMessage(error) {
  return typeof error?.message === 'string' && error.message
    ? error.message
    : 'Terjadi kesalahan autentikasi. Silakan coba lagi.'
}

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    session: null,
    user: null,
    profile: null,
    isLoading: true,
    error: null,
  })
  const requestId = useRef(0)
  const currentSession = useRef(null)

  const applySession = useCallback(async (nextSession) => {
    const request = ++requestId.current
    const session = nextSession ?? null
    const user = session?.user ?? null
    currentSession.current = session

    if (!user) {
      setState({ session: null, user: null, profile: null, isLoading: false, error: null })
      return
    }

    setState({ session, user, profile: null, isLoading: true, error: null })

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, role, is_active, full_name')
        .eq('id', user.id)
        .maybeSingle()

      if (error) throw error
      if (request !== requestId.current) return

      setState({ session, user, profile, isLoading: false, error: null })
    } catch (error) {
      if (request !== requestId.current) return
      setState({
        session,
        user,
        profile: null,
        isLoading: false,
        error: getErrorMessage(error),
      })
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    let authEventRevision = 0

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      authEventRevision += 1
      requestId.current += 1
      currentSession.current = session ?? null

      const user = session?.user ?? null
      setState({
        session: session ?? null,
        user,
        profile: null,
        isLoading: Boolean(user),
        error: null,
      })

      const revision = authEventRevision
      window.setTimeout(() => {
        if (isMounted && revision === authEventRevision) {
          void applySession(session)
        }
      }, 0)
    })

    void supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!isMounted || authEventRevision > 0) return
        if (error) throw error
        return applySession(data.session)
      })
      .catch((error) => {
        if (!isMounted || authEventRevision > 0) return
        requestId.current += 1
        currentSession.current = null
        setState({
          session: null,
          user: null,
          profile: null,
          isLoading: false,
          error: getErrorMessage(error),
        })
      })

    return () => {
      isMounted = false
      requestId.current += 1
      subscription.unsubscribe()
    }
  }, [applySession])

  const login = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) throw error
  }, [])

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const refreshProfile = useCallback(
    () => applySession(currentSession.current),
    [applySession],
  )

  const hasAccess = Boolean(
    state.user
    && state.profile?.id === state.user.id
    && state.profile.is_active
    && ['admin', 'staff'].includes(state.profile.role),
  )

  const value = useMemo(() => ({
    ...state,
    hasAccess,
    login,
    logout,
    refreshProfile,
  }), [hasAccess, login, logout, refreshProfile, state])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider.')
  return context
}

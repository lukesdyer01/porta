import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'
import { AuthContext, type AuthState } from './context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [sessionResolved, setSessionResolved] = useState(false)
  const [profileResolved, setProfileResolved] = useState(false)

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null)
      setProfileResolved(true)
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, display_name, avatar_path, household_id, role, is_active')
      .eq('id', userId)
      .maybeSingle()

    if (error) console.error('Failed to load profile:', error.message)
    setProfile((data as Profile | null) ?? null)
    setProfileResolved(true)
  }, [])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setSessionResolved(true)
      void loadProfile(data.session?.user.id)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return
      setSession(next)
      setSessionResolved(true)
      setProfileResolved(false)
      void loadProfile(next?.user.id)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const value = useMemo<AuthState>(() => {
    // The profile row is created by a database trigger the instant the account
    // exists, so "session but no profile" is a transient race, not a state the
    // UI should render. Treat it as still loading.
    const loading = !sessionResolved || (Boolean(session) && !profileResolved)

    return {
      session,
      profile,
      loading,
      pending: Boolean(session) && profileResolved && !profile?.is_active,
      isOrganizer: profile?.role === 'organizer',
      refreshProfile: () => loadProfile(session?.user.id),
      signOut: async () => {
        await supabase.auth.signOut()
        setProfile(null)
      },
    }
  }, [session, profile, sessionResolved, profileResolved, loadProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '../supabase/client'

/* ────────────────────────────────────────────────────────────────────────
 * useSession
 *
 * Client hook: wraps Supabase Auth state + the app's profile row. Used
 * by /hits + /hits/[card_id] to know who the player is and render the
 * header accordingly.
 *
 * Returns:
 *   loading: true while initial getUser + profile fetch is in flight
 *   user: Supabase auth user, or null when anonymous
 *   profile: the app-level profile row (display_name, virtual_balance),
 *     or null when anonymous OR while loading
 *   signOut: clears the session cookie
 *   refresh: re-fetch the profile (e.g. after a balance change)
 *
 * The hook listens to onAuthStateChange so a magic-link sign-in in
 * another tab refreshes this tab's state automatically.
 * ──────────────────────────────────────────────────────────────────── */

export type Profile = {
  id: string
  email: string
  display_name: string
  virtual_balance: number
  locale: string
  migrated_from_anon: boolean
  created_at: string
}

export type SessionState = {
  loading: boolean
  user: { id: string; email: string | null } | null
  profile: Profile | null
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

export function useSession(): SessionState {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<SessionState['user']>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/profile/me', { cache: 'no-store' })
      if (res.status === 401) {
        setProfile(null)
        return
      }
      const j = await res.json()
      if (j.ok && j.profile) setProfile(j.profile as Profile)
      else setProfile(null)
    } catch {
      setProfile(null)
    }
  }, [])

  const refresh = useCallback(async () => {
    await fetchProfile()
  }, [fetchProfile])

  const signOut = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }, [])

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    // Initial load: getUser hits Supabase Auth, then profile.
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      if (cancelled) return
      if (data?.user) {
        setUser({ id: data.user.id, email: data.user.email ?? null })
        await fetchProfile()
      } else {
        setUser(null)
        setProfile(null)
      }
      if (!cancelled) setLoading(false)
    })()

    // Listen for sign-in / sign-out events from other tabs or magic-link
    // landings. Re-fetch profile on any session change.
    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email ?? null })
        await fetchProfile()
      } else {
        setUser(null)
        setProfile(null)
      }
    })

    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
  }, [fetchProfile])

  return { loading, user, profile, signOut, refresh }
}

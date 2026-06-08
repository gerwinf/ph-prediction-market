'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '../supabase/client'
import { migrateToProfileBalance } from '../identity/token-balance'

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
  const migrationFiredRef = useRef(false)

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/profile/me', { cache: 'no-store' })
      if (res.status === 401) {
        setProfile(null)
        return
      }
      const j = await res.json()
      if (j.ok && j.profile) {
        const p = j.profile as Profile
        setProfile(p)
        // One-shot anon-to-authed balance migration. Server is idempotent
        // (no-ops if migrated_from_anon already true or profile has activity).
        if (!p.migrated_from_anon && !migrationFiredRef.current) {
          migrationFiredRef.current = true
          await migrateToProfileBalance()
          // Re-fetch profile to reflect the migrated balance.
          const res2 = await fetch('/api/profile/me', { cache: 'no-store' })
          const j2 = await res2.json()
          if (j2.ok && j2.profile) setProfile(j2.profile as Profile)
        }
      } else {
        setProfile(null)
      }
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

    // If the URL still carries a PKCE `code` (e.g. an old magic link that
    // points straight at the app instead of /auth/callback), the SDK
    // performs an async code exchange after mount. Trusting the immediate
    // getUser() in that window would flash "Sign in". Detect the code and
    // let onAuthStateChange drive the final state instead, with a timeout
    // fallback so we never hang in loading.
    const hasPendingCode =
      typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('code')

    // Initial load: getUser hits Supabase Auth, then profile.
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      if (cancelled) return
      if (data?.user) {
        setUser({ id: data.user.id, email: data.user.email ?? null })
        await fetchProfile()
        if (!cancelled) setLoading(false)
      } else if (hasPendingCode) {
        // Don't resolve loading yet — wait for onAuthStateChange after the
        // SDK finishes the exchange. Fallback timer prevents a hang.
        setTimeout(() => {
          if (!cancelled) setLoading(false)
        }, 4000)
      } else {
        setUser(null)
        setProfile(null)
        if (!cancelled) setLoading(false)
      }
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
      // Any settled auth event means we know the answer — stop loading.
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
  }, [fetchProfile])

  return { loading, user, profile, signOut, refresh }
}

/**
 * Browser-side Supabase client.
 *
 * Uses the publishable key (formerly "anon key" pre-2025 renaming). Safe to
 * expose to the client because Row Level Security (RLS) policies on the
 * Supabase database are the actual access boundary.
 *
 * Use this in 'use client' components only. For server-side reads/writes,
 * import from './server' (anon, cookie-bound) or './admin' (service role).
 */
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}

/**
 * Like createClient, but returns null instead of throwing when the
 * NEXT_PUBLIC_SUPABASE_* env vars are missing/empty (e.g. a creds-less local
 * workspace). Callers treat null as "auth unavailable → anonymous mode" so
 * the page renders instead of white-screening.
 */
export function tryCreateClient() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return null
  }
  try {
    return createClient()
  } catch {
    return null
  }
}

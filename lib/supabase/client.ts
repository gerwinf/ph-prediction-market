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

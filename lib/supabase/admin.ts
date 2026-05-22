/**
 * Admin Supabase client — bypasses Row Level Security.
 *
 * Uses the SERVICE_ROLE key. ONLY ever import from server-side code
 * (API routes, server actions, edge functions). NEVER bundle this into
 * a client component — exposing the service role key in the browser
 * is a critical security defect.
 *
 * Use cases:
 * - Writing the audit log (regulatory immutability)
 * - Manual ops dashboard event resolution
 * - Server-side leaderboard recomputation
 * - Administrative migrations / data fixes
 *
 * For normal user-scoped reads/writes, use './server' instead — RLS is
 * the right access control there.
 */
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. ' +
        'Add it to .env.local (get it from Supabase dashboard → Settings → API → service_role).'
    )
  }

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        // Disable Next.js's extended fetch caching. Without this, the
        // Supabase REST GET calls inside route handlers get cached at
        // the Next.js data layer (even with dynamic='force-dynamic' on
        // the route), and writes elsewhere don't invalidate them.
        // Observed: prod /api/events returned stale event ids 6-7
        // after the DB had been cleared.
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, { ...init, cache: 'no-store' }),
      },
    }
  )
}

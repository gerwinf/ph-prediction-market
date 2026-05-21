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
    }
  )
}

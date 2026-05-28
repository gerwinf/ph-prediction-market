/**
 * Server-side Supabase client (for App Router route handlers, server
 * components, server actions).
 *
 * Uses the publishable key BUT bound to the request's cookies, so the
 * authenticated session is recognized. RLS still applies — this client
 * can only do what the signed-in user is permitted to do.
 *
 * For admin operations that bypass RLS (audit log writes, manual ops
 * dashboard, leaderboard writes), use './admin' instead.
 */
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // Ignored if middleware refreshes sessions on every request.
          }
        },
      },
    }
  )
}

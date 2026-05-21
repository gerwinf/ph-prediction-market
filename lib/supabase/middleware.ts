/**
 * Supabase session refresh helper for Next.js middleware.
 *
 * Wired from root `middleware.ts`. Runs on every request to keep the
 * authenticated session cookie fresh. Without this, the JWT expires and
 * users get logged out mid-session.
 */
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the session. We do not block on the result — the cookies are
  // updated as a side effect of getUser() under the hood.
  await supabase.auth.getUser()

  return response
}

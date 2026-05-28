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

  // Fail-safe: if Supabase env vars are missing (e.g. preview deploy or
  // pre-config Vercel env), don't crash the request. The whole site
  // shouldn't 500 just because auth isn't wired up yet. Pages that need
  // a session can still read it from cookies via the per-request server
  // client; this middleware is only for refresh.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) {
    return response
  }

  const supabase = createServerClient(
    url,
    key,
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

  // Refresh the session. Cookies are updated as a side effect of
  // getUser(). Swallow errors — a failed refresh shouldn't 500 the
  // request; the user just won't have an authenticated session.
  try {
    await supabase.auth.getUser()
  } catch (err) {
    console.error('[middleware] supabase.auth.getUser failed:', err)
  }

  return response
}

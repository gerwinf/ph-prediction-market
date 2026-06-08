/**
 * GET /auth/callback?code=<pkce_code>&next=<path>
 *
 * PKCE magic-link landing route. @supabase/ssr defaults to the PKCE flow:
 * the magic link in the email redirects here with a `code` query param.
 * We exchange that code for a session server-side (which writes the auth
 * cookie via the cookie-bound server client), then redirect to `next`
 * (defaults /hits) with the session already set.
 *
 * Without this route the code lands on /hits directly, the SDK attempts
 * an async client-side exchange, and useSession's getUser() fires before
 * it completes — so the header renders "Sign in" even mid-authentication.
 * This is the fix for "sign in still shows when logged in."
 *
 * On exchange error, redirect to /hits?auth_error=1 so the page can
 * surface a toast.
 */
import { NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const nextRaw = url.searchParams.get('next')

  // Open-redirect guard: only allow same-site paths.
  const next = nextRaw && nextRaw.startsWith('/') ? nextRaw : '/hits'

  if (!code) {
    return NextResponse.redirect(new URL('/hits?auth_error=1', url.origin))
  }

  const supabase = createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(new URL('/hits?auth_error=1', url.origin))
  }

  return NextResponse.redirect(new URL(next, url.origin))
}

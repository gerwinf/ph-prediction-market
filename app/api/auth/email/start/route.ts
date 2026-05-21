/**
 * POST /api/auth/email/start
 *
 * Body: { email: string, redirectTo?: string }
 *
 * Triggers Supabase to send a magic-link email. User clicks the link
 * in the email → Supabase verifies the token → redirects back to the
 * app with a session cookie set.
 *
 * Replaces the Twilio SMS OTP path for Phase 0 (Globe carrier filter
 * killed SMS deliverability — see lib/twilio.ts comments).
 *
 * Response:
 *   200 { ok: true }                — magic link sent
 *   400 { ok: false, error: 'invalid_email' }
 *   500 { ok: false, error: 'supabase_error', message: '...' }
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: Request) {
  let body: { email?: string; redirectTo?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 })
  }

  // Where to send the user after they click the magic link. Defaults to
  // /hits (the masa-tier surface). Caller can override via redirectTo —
  // useful when claiming a card mid-session.
  const url = new URL(req.url)
  const redirectTo =
    body.redirectTo && body.redirectTo.startsWith('/')
      ? `${url.origin}${body.redirectTo}`
      : `${url.origin}/hits`

  const supabase = createAdminClient()

  // Use generateLink + manual email send via Supabase's built-in SMTP
  // (configured in Supabase project → Authentication → Email Templates).
  // The default email template fires automatically when we call signInWithOtp
  // on a client. For server-side, we use the admin generateLink + Supabase
  // sends the email automatically when emailRedirectTo is set.
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      // Allow Supabase to auto-create the user on first sign-in.
      shouldCreateUser: true,
    },
  })

  if (error) {
    return NextResponse.json(
      { ok: false, error: 'supabase_error', message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, email })
}

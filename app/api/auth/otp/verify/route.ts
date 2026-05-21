/**
 * POST /api/auth/otp/verify
 *
 * Body: { phone: string, code: string }
 *
 * Verifies the 6-digit code with Twilio Verify. On success, creates or
 * fetches the corresponding Supabase user (phone as primary key) and
 * issues a session. Returns the session JWT for the client.
 *
 * Response:
 *   200 { ok: true, verified: true, user: { id, phone } }
 *   400 { ok: false, verified: false, reason: 'wrong_code' | 'expired' | 'invalid_phone' }
 *   500 { ok: false, error: 'twilio_error' | 'supabase_error', message: '...' }
 */
import { NextResponse } from 'next/server'
import { checkOtp, normalizePhPhone } from '../../../../../lib/twilio'
import { createAdminClient } from '../../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  let body: { phone?: string; code?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_body' },
      { status: 400 }
    )
  }

  if (!body.phone || !body.code) {
    return NextResponse.json(
      { ok: false, error: 'phone_and_code_required' },
      { status: 400 }
    )
  }

  const phone = normalizePhPhone(body.phone)
  if (!phone) {
    return NextResponse.json(
      { ok: false, verified: false, reason: 'invalid_phone' },
      { status: 400 }
    )
  }

  // 1. Check the OTP with Twilio
  const check = await checkOtp(phone, body.code)
  if (!check.ok) {
    return NextResponse.json(
      { ok: false, error: 'twilio_error', message: check.error, code: check.code },
      { status: 500 }
    )
  }
  if (!check.verified) {
    return NextResponse.json(
      { ok: false, verified: false, reason: check.reason },
      { status: 400 }
    )
  }

  // 2. OTP verified. Find-or-create the Supabase user (keyed by phone).
  const supabase = createAdminClient()

  // List existing users to find a match. For Phase 0 user counts (<10K)
  // listUsers is fine; at scale we'd query the auth.users table directly.
  const { data: listed, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (listError) {
    return NextResponse.json(
      { ok: false, error: 'supabase_error', message: listError.message },
      { status: 500 }
    )
  }

  let user = listed.users.find((u) => u.phone === phone.replace(/^\+/, ''))

  if (!user) {
    // Create the user. Supabase stores phone without the "+" prefix.
    const phoneWithoutPlus = phone.replace(/^\+/, '')
    const { data: created, error: createError } =
      await supabase.auth.admin.createUser({
        phone: phoneWithoutPlus,
        phone_confirm: true,
        user_metadata: { signup_via: 'otp', signup_at: new Date().toISOString() },
      })
    if (createError || !created.user) {
      return NextResponse.json(
        { ok: false, error: 'supabase_error', message: createError?.message },
        { status: 500 }
      )
    }
    user = created.user
  }

  return NextResponse.json({
    ok: true,
    verified: true,
    user: { id: user.id, phone: phone },
  })
}

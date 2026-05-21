/**
 * POST /api/auth/otp/start
 *
 * Body: { phone: string }   — accepts PH local (09xxxx) or E.164 (+639xxxx)
 *
 * Triggers Twilio Verify to SMS a 6-digit code to the user. Idempotent —
 * Twilio handles rate-limiting + retry suppression internally.
 *
 * Response:
 *   200 { ok: true, status: 'pending', phone: '+639...' }
 *   400 { ok: false, error: 'invalid_phone' }
 *   429 { ok: false, error: 'rate_limited' }  (passed through from Twilio)
 *   500 { ok: false, error: 'twilio_error', message: '...' }
 */
import { NextResponse } from 'next/server'
import { sendOtp, normalizePhPhone } from '../../../../../lib/twilio'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  let body: { phone?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_body' },
      { status: 400 }
    )
  }

  if (!body.phone || typeof body.phone !== 'string') {
    return NextResponse.json(
      { ok: false, error: 'phone_required' },
      { status: 400 }
    )
  }

  const phone = normalizePhPhone(body.phone)
  if (!phone) {
    return NextResponse.json(
      { ok: false, error: 'invalid_phone', hint: 'use PH format like 09171234567' },
      { status: 400 }
    )
  }

  const result = await sendOtp(phone)
  if (!result.ok) {
    // Map Twilio rate-limit code (20429) → 429
    const isRateLimit = result.code === 20429
    return NextResponse.json(
      { ok: false, error: 'twilio_error', message: result.error, code: result.code },
      { status: isRateLimit ? 429 : 500 }
    )
  }

  return NextResponse.json({ ok: true, status: result.status, phone })
}

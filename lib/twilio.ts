/**
 * Twilio Verify wrapper for phone OTP.
 *
 * Phase 0 identity model: optional phone OTP. First card is anonymous.
 * OTP unlocks leaderboard, history, sharing-with-name. Friction is opt-in.
 *
 * SERVER-SIDE ONLY. Never import from a client component — the auth token
 * is a secret. Use only from /app/api/* route handlers.
 *
 * Reference: https://www.twilio.com/docs/verify/api/verification
 */
import Twilio from 'twilio'

// Lazy-init so a missing env var fails at first use, not module load.
// Critical for build time (where env vars may not be set) vs runtime
// (where they should be).
let _client: ReturnType<typeof Twilio> | null = null

function getClient() {
  if (_client) return _client
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) {
    throw new Error(
      'TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set. ' +
        'Add to .env.local from console.twilio.com.'
    )
  }
  _client = Twilio(sid, token)
  return _client
}

function getVerifyServiceSid() {
  const sid = process.env.TWILIO_VERIFY_SERVICE_SID
  if (!sid) {
    throw new Error(
      'TWILIO_VERIFY_SERVICE_SID not set. Create a Verify Service at ' +
        'console.twilio.com → Verify → Services → Create.'
    )
  }
  return sid
}

export type SendOtpResult =
  | { ok: true; status: 'pending' | 'approved' }
  | { ok: false; error: string; code?: number }

/**
 * Triggers Twilio to send an SMS OTP to the given phone number.
 *
 * Phone must be E.164 format (e.g. "+639171234567" for PH mobile).
 *
 * Returns { ok: true, status: 'pending' } on success — Twilio is now
 * waiting for the user to submit the code via checkOtp().
 */
// DORMANT for Phase 0. Globe carrier filtered every Twilio sender we
// tested (default pool + Hrtech US long code) with error 30008. Bypassing
// to Messages API with explicit messagingServiceSid still routed via
// KonekBuhay alphanumeric, which Globe blocks. Real fix is NTC PH Sender
// ID registration (~2-week lead time) — doesn't fit June 11 WC kickoff.
// Phase 0 uses email magic link instead (app/api/auth/email/*).
// Revisit this file for Phase 1 once NTC Sender ID is registered.
const OTP_CHANNEL: 'sms' | 'whatsapp' = 'sms'

export async function sendOtp(phoneE164: string): Promise<SendOtpResult> {
  try {
    const client = getClient()
    const verification = await client.verify.v2
      .services(getVerifyServiceSid())
      .verifications.create({
        to: phoneE164,
        channel: OTP_CHANNEL,
      })

    return { ok: true, status: verification.status as 'pending' | 'approved' }
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || String(err),
      code: err?.code,
    }
  }
}

export type CheckOtpResult =
  | { ok: true; verified: true }
  | { ok: true; verified: false; reason: 'pending' | 'canceled' | 'expired' }
  | { ok: false; error: string; code?: number }

/**
 * Verifies the user-submitted code against the Twilio Verify service.
 *
 * Returns { ok: true, verified: true } if the code is correct — the
 * caller should then create / link the Supabase user.
 */
export async function checkOtp(
  phoneE164: string,
  code: string
): Promise<CheckOtpResult> {
  try {
    const client = getClient()
    const check = await client.verify.v2
      .services(getVerifyServiceSid())
      .verificationChecks.create({
        to: phoneE164,
        code,
      })

    if (check.status === 'approved') {
      return { ok: true, verified: true }
    }
    return {
      ok: true,
      verified: false,
      reason: check.status as 'pending' | 'canceled' | 'expired',
    }
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || String(err),
      code: err?.code,
    }
  }
}

/**
 * Validates and normalizes a PH phone number to E.164.
 *
 * Accepts:
 *   "09171234567"         (PH local format)
 *   "+639171234567"       (E.164)
 *   "639171234567"        (E.164 without +)
 *   "0917 123 4567"       (spaced)
 *   "0917-123-4567"       (dashed)
 *
 * Returns null if invalid.
 */
export function normalizePhPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('09')) {
    return '+63' + digits.slice(1)
  }
  if (digits.length === 12 && digits.startsWith('639')) {
    return '+' + digits
  }
  if (digits.length === 13 && digits.startsWith('1639')) {
    // user typed +1 prefix by mistake on PH number — defensive
    return '+' + digits.slice(1)
  }
  return null
}

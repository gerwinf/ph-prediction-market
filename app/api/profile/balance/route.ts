/**
 * POST /api/profile/balance
 *
 * Server-authoritative token balance debit/credit for authed users.
 * Body: { delta: number, reason: 'card_buy' | 'card_win' | 'shuffle' | 'admin' }
 *
 * - delta < 0: debit (e.g. card buy, shuffle). Rejected with 402 if would
 *   take balance below 0.
 * - delta > 0: credit (e.g. card win). Always allowed.
 *
 * Returns the new balance. Caller (lib/identity/token-balance.ts when
 * authed) caches it locally for fast reads, but server is the source of
 * truth.
 *
 * Auth required: 401 if no session. Anonymous users continue using
 * localStorage-only path via lib/identity/token-balance.ts.
 *
 * Phase 0 caveat: no idempotency keys. A double-POST under network
 * jitter can double-debit/credit. Phase 1 real-money work introduces a
 * payment_ledger with idempotency keys.
 */
import { NextResponse } from 'next/server'
import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '../../../../lib/supabase/server'
import { createAdminClient } from '../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const VALID_REASONS = new Set(['card_buy', 'card_win', 'shuffle', 'admin'])

type Body = {
  delta?: number
  reason?: string
}

export async function POST(req: Request) {
  noStore()
  const supabase = createClient()
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData?.user) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
  }

  let body: Body = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const delta = typeof body.delta === 'number' ? Math.round(body.delta) : NaN
  if (!Number.isFinite(delta) || delta === 0) {
    return NextResponse.json({ ok: false, error: 'invalid_delta' }, { status: 400 })
  }
  if (!body.reason || !VALID_REASONS.has(body.reason)) {
    return NextResponse.json({ ok: false, error: 'invalid_reason' }, { status: 400 })
  }
  // Defense: cap any single mutation at ±100k to limit a runaway client.
  if (Math.abs(delta) > 100_000) {
    return NextResponse.json({ ok: false, error: 'delta_too_large' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: profile, error: readErr } = await admin
    .from('profiles')
    .select('virtual_balance')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (readErr) {
    return NextResponse.json(
      { ok: false, error: 'db_error', message: readErr.message },
      { status: 500 }
    )
  }
  if (!profile) {
    return NextResponse.json({ ok: false, error: 'profile_not_found' }, { status: 404 })
  }

  const current = profile.virtual_balance as number
  const next = current + delta
  if (next < 0) {
    return NextResponse.json(
      { ok: false, error: 'insufficient_balance', balance: current },
      { status: 402 }
    )
  }

  const { error: updErr } = await admin
    .from('profiles')
    .update({ virtual_balance: next })
    .eq('id', userData.user.id)

  if (updErr) {
    return NextResponse.json(
      { ok: false, error: 'db_error', message: updErr.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, balance: next, delta, reason: body.reason })
}

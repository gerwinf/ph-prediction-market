/**
 * POST /api/ops/markets/[id]/resolve
 *
 * Settle (or void) a binary market's positions. Pays `potential_payout` to the
 * winning side, books the house `hold_amount` (GGR, migration 007 paradigm),
 * and retires the market. Idempotent: the `settle_market` RPC only touches
 * positions where status='open', so a repeat call settles 0.
 *
 * Body: { outcome: 'yes' | 'no' | 'void' }   (void refunds all stakes)
 * Auth: X-Ops-Secret header (same gate as /api/ops/resolve).
 *
 * Response:
 *   200 { ok: true, settled }   settled=0 on a repeat call
 *   400 { ok: false, error: 'invalid_body' | 'invalid_outcome' }
 *   401 { ok: false, error: 'bad_secret' }
 *   500 { ok: false, error: 'no_secret_configured' | 'db_error' }
 */
import { NextResponse } from 'next/server'
import { settleMarket } from '../../../../../../lib/mm/engine'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const expected = process.env.OPS_SHARED_SECRET
  if (!expected) {
    return NextResponse.json({ ok: false, error: 'no_secret_configured' }, { status: 500 })
  }
  if (!constantTimeEqual(req.headers.get('x-ops-secret') || '', expected)) {
    return NextResponse.json({ ok: false, error: 'bad_secret' }, { status: 401 })
  }

  const { id } = await ctx.params
  let body: { outcome?: 'yes' | 'no' | 'void' } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }
  if (!body.outcome || !['yes', 'no', 'void'].includes(body.outcome)) {
    return NextResponse.json({ ok: false, error: 'invalid_outcome' }, { status: 400 })
  }

  const r = await settleMarket(id, body.outcome)
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: 'db_error', message: r.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, settled: r.settled })
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

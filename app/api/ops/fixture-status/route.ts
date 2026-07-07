/**
 * POST /api/ops/fixture-status
 *
 * Ops endpoint. Flips a match_fixture's status between scheduled / live /
 * final / canceled. Saves Jade from writing SQL during a live PBA game.
 *
 * Body: { fixtureId: string, status: 'scheduled'|'live'|'final'|'canceled' }
 *
 * Auth: same X-Ops-Secret header pattern as /api/ops/resolve.
 *
 * Status transitions are unrestricted — operator decides. When flipping
 * to 'final', also sets ends_at = now() so the /api/fixtures windowing
 * logic knows when the game ended.
 *
 * Response:
 *   200 { ok: true, fixture: { id, status, ends_at } }
 *   401 { ok: false, error: 'bad_secret' }
 *   400 { ok: false, error: 'invalid_status' | 'invalid_body' | 'fixture_id_required' }
 *   404 { ok: false, error: 'not_found' }
 *   500 { ok: false, error: 'no_secret_configured' | 'db_error', message }
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { settleFixtureIfNeeded } from '../../../../lib/hits/settle'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = new Set(['scheduled', 'live', 'final', 'canceled'])

type Body = {
  fixtureId?: string
  status?: string
}

export async function POST(req: Request) {
  const expected = process.env.OPS_SHARED_SECRET
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: 'no_secret_configured', message: 'Set OPS_SHARED_SECRET in env' },
      { status: 500 }
    )
  }
  const provided = req.headers.get('x-ops-secret') || ''
  if (!constantTimeEqual(provided, expected)) {
    return NextResponse.json({ ok: false, error: 'bad_secret' }, { status: 401 })
  }

  let body: Body = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const { fixtureId, status } = body
  if (!fixtureId || typeof fixtureId !== 'string') {
    return NextResponse.json({ ok: false, error: 'fixture_id_required' }, { status: 400 })
  }
  if (!status || !VALID_STATUSES.has(status)) {
    return NextResponse.json({ ok: false, error: 'invalid_status' }, { status: 400 })
  }

  // Set ends_at when transitioning to final; clear when reverting away from it.
  const update: { status: string; ends_at?: string | null } = { status }
  if (status === 'final') {
    update.ends_at = new Date().toISOString()
  } else if (status === 'scheduled') {
    // Re-opening a game (rare, but possible if ops mis-flipped). Clear
    // ends_at so windowing logic treats it as future again.
    update.ends_at = null
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('match_fixtures')
    .update(update)
    .eq('id', fixtureId)
    .select('id, status, starts_at, ends_at, match_label')
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { ok: false, error: 'db_error', message: error.message },
      { status: 500 }
    )
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  // GGR settlement: when a match ends, every card that didn't win is pure
  // hold (house keeps the full wager). Settle them inline here rather than
  // via a cron — settlement is event-triggered (match → final), not
  // time-triggered, and Vercel Hobby caps cron at once-per-day anyway.
  // Idempotent: only touches cards not already settled.
  //
  // hold_amount for a no-win card = its full wager (price_php), which varies
  // per row, so we read the candidates then write each. Phase 0 volumes are
  // small (tens–hundreds per match); if this grows, move to a Postgres
  // function doing `set hold_amount = price_php` in one statement.
  let settledCount = 0
  if (status === 'final') {
    const settledAt = new Date().toISOString()
    const { data: candidates, error: readErr } = await admin
      .from('cards')
      .select('id, price_php')
      .eq('match_id', fixtureId)
      .eq('won', false)
      .is('settled_at', null)
    if (readErr) {
      console.error('[fixture-status] no-win settle read failed:', readErr.message)
    } else {
      for (const c of candidates ?? []) {
        const { error: rowErr } = await admin
          .from('cards')
          .update({ hold_amount: c.price_php, settled_at: settledAt })
          .eq('id', c.id)
          .is('settled_at', null) // race-safe: skip if won/settled meanwhile
        if (!rowErr) settledCount++
      }
    }
  }

  // Cancel refund: a canceled game voids every card bought against it. Pre-buy
  // means tokens were already debited, so return them. Authed users get their
  // virtual_balance credited back; anonymous cards (balance lives in the
  // browser's localStorage) are voided without a server-side credit — a Phase 0
  // limitation. Cards are settled with zero hold so GGR doesn't count them.
  // Idempotent: only touches not-yet-settled cards (cancellation is normally
  // pre-tipoff, so in practice that's all of them).
  let refundedCount = 0
  if (status === 'canceled') {
    const canceledAt = new Date().toISOString()
    const { data: cards, error: readErr } = await admin
      .from('cards')
      .select('id, price_php, user_id')
      .eq('match_id', fixtureId)
      .is('settled_at', null)
    if (readErr) {
      console.error('[fixture-status] cancel refund read failed:', readErr.message)
    } else {
      const refundByUser = new Map<string, number>()
      for (const c of cards ?? []) {
        const { error: rowErr } = await admin
          .from('cards')
          .update({ hold_amount: 0, settled_at: canceledAt })
          .eq('id', c.id)
          .is('settled_at', null) // race-safe: skip if settled meanwhile
        if (rowErr) continue
        refundedCount++
        if (c.user_id) {
          refundByUser.set(c.user_id, (refundByUser.get(c.user_id) ?? 0) + (c.price_php as number))
        }
      }
      // Credit each authed user's balance with the sum of their refunds.
      for (const [userId, amount] of refundByUser) {
        const { data: prof } = await admin
          .from('profiles')
          .select('virtual_balance')
          .eq('id', userId)
          .maybeSingle()
        if (!prof) continue
        await admin
          .from('profiles')
          .update({ virtual_balance: (prof.virtual_balance as number) + amount })
          .eq('id', userId)
      }
    }
  }

  // Parimutuel shadow settlement (CEO review 1A trigger #2): record the pool
  // allocation for a final/canceled fixture. Idempotent + never throws.
  if (status === 'final' || status === 'canceled') {
    await settleFixtureIfNeeded(fixtureId, { force: true })
  }

  return NextResponse.json({ ok: true, fixture: data, settled: settledCount, refunded: refundedCount })
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

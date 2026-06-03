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

  return NextResponse.json({ ok: true, fixture: data, settled: settledCount })
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

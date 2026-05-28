/**
 * POST /api/ops/resolve
 *
 * Ops endpoint. Jade hits this during a live game to mark an event as
 * resolved — it writes a row to public.events. All active cards for
 * that match polling /api/events?match=X will see the new event and
 * light up the matching cell.
 *
 * Body: { matchId: string, eventKey: string, payload?: object }
 *
 * Auth: shared secret in the X-Ops-Secret header. Secret is set via
 * the OPS_SHARED_SECRET env var. Right tool for the closed-beta phase
 * — Jade enters the secret once in /ops and it's sent with every fire.
 * Swap back to Supabase-role gating for public launch.
 *
 * Response:
 *   200 { ok: true, event: { id, ... } }
 *   401 { ok: false, error: 'bad_secret' }
 *   500 { ok: false, error: 'no_secret_configured' } — env var missing
 *   400 { ok: false, error: 'invalid_body' | 'unknown_match' }
 *   500 { ok: false, error: 'db_error', message: '...' }
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

type Body = {
  matchId?: string
  eventKey?: string
  payload?: Record<string, unknown>
}

export async function POST(req: Request) {
  // 1) Shared-secret gate. OPS_SHARED_SECRET in env; header
  //    X-Ops-Secret from the caller. Constant-time compare to avoid
  //    timing-based secret extraction (defensive, low-stakes here).
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

  // 3) Parse + validate body.
  let body: Body = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const { matchId, eventKey, payload } = body
  if (!matchId || typeof matchId !== 'string') {
    return NextResponse.json({ ok: false, error: 'match_id_required' }, { status: 400 })
  }
  if (!eventKey || typeof eventKey !== 'string') {
    return NextResponse.json({ ok: false, error: 'event_key_required' }, { status: 400 })
  }

  // 4) Write the event row using admin client (bypasses RLS).
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('events')
    .insert({
      match_id: matchId,
      event_key: eventKey,
      payload: payload ?? null,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23503') {
      return NextResponse.json(
        { ok: false, error: 'unknown_match', message: `match_id=${matchId} not in match_fixtures` },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { ok: false, error: 'db_error', message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, event: data })
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

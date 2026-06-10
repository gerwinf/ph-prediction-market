/**
 * POST /api/ops/fixture-edit
 *
 * Ops override for an auto-published fixture: fix the label, tip-off time, or
 * venue of a scraped PBA game (or any fixture). Status changes go through
 * /api/ops/fixture-status; this only edits descriptive fields.
 *
 * Body: { fixtureId: string, match_label?: string, starts_at?: string (ISO), venue?: string }
 *   At least one editable field must be present.
 *
 * Auth: X-Ops-Secret header, same as /api/ops/fixture-status.
 *
 * Response:
 *   200 { ok: true, fixture: { id, match_label, starts_at, venue, status } }
 *   400 { ok: false, error: 'invalid_body' | 'fixture_id_required' | 'no_fields' | 'invalid_starts_at' }
 *   401 { ok: false, error: 'bad_secret' }
 *   404 { ok: false, error: 'not_found' }
 *   500 { ok: false, error: 'no_secret_configured' | 'db_error', message }
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

type Body = {
  fixtureId?: string
  match_label?: string
  starts_at?: string
  venue?: string
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

  const { fixtureId } = body
  if (!fixtureId || typeof fixtureId !== 'string') {
    return NextResponse.json({ ok: false, error: 'fixture_id_required' }, { status: 400 })
  }

  const update: { match_label?: string; starts_at?: string; venue?: string | null } = {}
  if (typeof body.match_label === 'string' && body.match_label.trim()) {
    update.match_label = body.match_label.trim()
  }
  if (typeof body.venue === 'string') {
    update.venue = body.venue.trim() || null
  }
  if (typeof body.starts_at === 'string' && body.starts_at.trim()) {
    const t = new Date(body.starts_at).getTime()
    if (!Number.isFinite(t)) {
      return NextResponse.json({ ok: false, error: 'invalid_starts_at' }, { status: 400 })
    }
    update.starts_at = new Date(t).toISOString()
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: 'no_fields' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('match_fixtures')
    .update(update)
    .eq('id', fixtureId)
    .select('id, match_label, starts_at, venue, status')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error', message: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, fixture: data })
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

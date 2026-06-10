/**
 * GET /api/ops/fixtures
 *
 * Ops-only listing of fixtures for the override console: every scheduled or
 * live game (any card_type, including private dry-runs), plus games that went
 * final in the last 24h, newest tip-off first. Unlike the public /api/fixtures
 * this isn't window-limited and isn't filtered, so ops sees the full slate.
 *
 * Auth: X-Ops-Secret header, same as the other /api/ops routes.
 *
 * Response:
 *   200 { ok: true, fixtures: Fixture[] }
 *   401 { ok: false, error: 'bad_secret' }
 *   500 { ok: false, error: 'no_secret_configured' | 'db_error', message }
 */
import { NextResponse } from 'next/server'
import { unstable_noStore as noStore } from 'next/cache'
import { createAdminClient } from '../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const DAY_MS = 24 * 60 * 60 * 1000

export async function GET(req: Request) {
  noStore()
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

  const admin = createAdminClient()
  const recentFinalMin = new Date(Date.now() - DAY_MS).toISOString()
  const { data, error } = await admin
    .from('match_fixtures')
    .select('id, card_type, match_label, starts_at, ends_at, status, venue, source')
    .or(`status.eq.scheduled,status.eq.live,and(status.eq.final,starts_at.gte.${recentFinalMin})`)
    .order('starts_at', { ascending: true })

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error', message: error.message }, { status: 500 })
  }
  return NextResponse.json(
    { ok: true, fixtures: data ?? [] },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

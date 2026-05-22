/**
 * GET /api/fixtures
 *
 * Returns match_fixtures grouped by status, scoped to a rolling window
 * around "now". Used by /hits picker to choose between live mode +
 * demo mode entry points.
 *
 * Response:
 *   200 { ok: true, live: Fixture[], upcoming: Fixture[], finished: Fixture[] }
 *     live      — status='live'
 *     upcoming  — status='scheduled', starts_at within next 8h
 *     finished  — status='final', ends_at within last 4h (or starts_at if no ends_at)
 *   500 { ok: false, error: 'db_error', message }
 */
import { NextResponse } from 'next/server'
import { unstable_noStore as noStore } from 'next/cache'
import { createAdminClient } from '../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const HOURS = 60 * 60 * 1000
const UPCOMING_WINDOW_MS = 8 * HOURS
const FINISHED_WINDOW_MS = 4 * HOURS

export async function GET() {
  noStore()
  const admin = createAdminClient()
  const now = new Date()
  const upcomingMax = new Date(now.getTime() + UPCOMING_WINDOW_MS).toISOString()
  const finishedMin = new Date(now.getTime() - FINISHED_WINDOW_MS).toISOString()

  const { data, error } = await admin
    .from('match_fixtures')
    .select('id, card_type, match_label, starts_at, ends_at, status')
    .or(
      `status.eq.live,and(status.eq.scheduled,starts_at.lte.${upcomingMax}),and(status.eq.final,starts_at.gte.${finishedMin})`
    )
    .not('id', 'like', 'private-%')  // hide private dry-run games from public picker
    .order('starts_at', { ascending: true })

  if (error) {
    return NextResponse.json(
      { ok: false, error: 'db_error', message: error.message },
      { status: 500 }
    )
  }

  const live: typeof data = []
  const upcoming: typeof data = []
  const finished: typeof data = []
  for (const row of data ?? []) {
    if (row.status === 'live') live.push(row)
    else if (row.status === 'scheduled') upcoming.push(row)
    else if (row.status === 'final') finished.push(row)
  }

  return NextResponse.json(
    { ok: true, live, upcoming, finished },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'CDN-Cache-Control': 'no-store',
        'Vercel-CDN-Cache-Control': 'no-store',
      },
    }
  )
}

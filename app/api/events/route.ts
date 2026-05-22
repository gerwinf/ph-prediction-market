/**
 * GET /api/events?match=<match_id>&since=<event_id>
 *
 * Public endpoint. Active card pages poll this every ~3s to find new
 * events for their match. Cells matching an event_key in the response
 * flip to lit.
 *
 * `since` is the last event id the client has seen, so we only return
 * the delta. On first poll, omit it to get the full history.
 *
 * Response:
 *   200 { ok: true, events: [{ id, event_key, payload, resolved_at }, ...] }
 *   400 { ok: false, error: 'match_required' }
 *   500 { ok: false, error: 'db_error', message: '...' }
 */
import { NextResponse } from 'next/server'
import { unstable_noStore as noStore } from 'next/cache'
import { createAdminClient } from '../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function GET(req: Request) {
  noStore()
  const url = new URL(req.url)
  const matchId = url.searchParams.get('match')
  const sinceRaw = url.searchParams.get('since')
  const since = sinceRaw ? Number(sinceRaw) : 0

  if (!matchId) {
    return NextResponse.json({ ok: false, error: 'match_required' }, { status: 400 })
  }

  const admin = createAdminClient()
  let query = admin
    .from('events')
    .select('id, event_key, payload, resolved_at')
    .eq('match_id', matchId)
    .order('resolved_at', { ascending: true })

  if (since > 0) {
    query = query.gt('id', since)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json(
      { ok: false, error: 'db_error', message: error.message },
      { status: 500 }
    )
  }

  // Explicit no-store. `dynamic = 'force-dynamic'` alone doesn't always
  // win against Vercel's edge cache for SSR'd API routes — we observed
  // stale event lists in /ops + player cards. Belt + suspenders.
  return NextResponse.json(
    { ok: true, events: data ?? [] },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'CDN-Cache-Control': 'no-store',
        'Vercel-CDN-Cache-Control': 'no-store',
      },
    }
  )
}

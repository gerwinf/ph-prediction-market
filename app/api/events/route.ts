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
import { syncFifaEvents } from '../../../lib/hits/feed-fifa'
import { syncApiFootballEvents } from '../../../lib/hits/feed-apifootball'

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

  // World Cup fixtures self-feed from FIFA's live timeline: this poll (cards
  // hit it every ~3s) lazily pulls the timeline behind a 20s TTL, maps it to
  // event keys, and inserts anything new before we read — same table-is-the-
  // cache pattern as /api/prices, no cron needed. Never throws; a broken feed
  // just means cells stop lighting until /ops fires manually.
  await syncFifaEvents(matchId)
  // Supplementary: API-Football fills the FIFA-blind keys (VAR, missed
  // pens). No-ops without API_FOOTBALL_KEY, off-live fixtures, or inside
  // its own 240s TTL — free-plan quota is 100 requests/day.
  await syncApiFootballEvents(matchId)

  const admin = createAdminClient()
  // Filter to events whose stamp has reached "now". The demo fixture
  // (demo-pba-perpetual) pre-seeds events with future resolved_at on
  // card buy so they trickle out naturally. Ops-fired live events
  // always insert with resolved_at = now(), so this filter is a no-op
  // for the live path.
  const nowIso = new Date().toISOString()
  let query = admin
    .from('events')
    .select('id, event_key, payload, resolved_at')
    .eq('match_id', matchId)
    .lte('resolved_at', nowIso)
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

  // Real fixtures: concurrent lambda instances can race the feed sync's
  // read-then-insert and duplicate an event_key (observed: corner-count-10
  // ×4 on wc-por-esp). Cells dedupe client-side but the ticker repeats, so
  // collapse to first occurrence here. Demo fixtures are EXCLUDED — they
  // legitimately re-fire the same keys forever (seed-events top-up loop).
  let events = data ?? []
  if (!matchId.startsWith('demo-')) {
    const seen = new Set<string>()
    events = events.filter((e) => {
      if (seen.has(e.event_key)) return false
      seen.add(e.event_key)
      return true
    })
  }

  // Explicit no-store. `dynamic = 'force-dynamic'` alone doesn't always
  // win against Vercel's edge cache for SSR'd API routes — we observed
  // stale event lists in /ops + player cards. Belt + suspenders.
  return NextResponse.json(
    { ok: true, events },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'CDN-Cache-Control': 'no-store',
        'Vercel-CDN-Cache-Control': 'no-store',
      },
    }
  )
}

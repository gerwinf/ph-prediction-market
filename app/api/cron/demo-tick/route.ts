/**
 * GET /api/cron/demo-tick
 *
 * Vercel-cron-triggered. Fires one event into the demo-pba-perpetual
 * match's events table so casual visitors (and devs verifying the server-
 * side flow) see real events flow without /ops involvement.
 *
 * Auth: CRON_SECRET header (Vercel cron sends Authorization: Bearer
 * <CRON_SECRET>). Reject anything else with 401.
 *
 * Schedule: every 2 minutes via vercel.json cron (every 1 min on Vercel
 * Pro; Hobby tier is throttled to daily — confirm at deploy).
 *
 * Selection logic:
 *   1. Read last 30 events for demo-pba-perpetual to know what fired recently
 *   2. Pick a random event from buildPoolForMatch (the match-aware pool;
 *      falls back to CANDIDATE_EVENTS for non-pba- match ids — which
 *      includes our demo fixture)
 *   3. Skip if it was in the last 5 fired (no immediate repeats)
 *   4. INSERT new event
 *
 * Pruning: every ~50 ticks, delete events older than the most recent 30
 * for this match. Keeps the events feed short so a player joining mid-
 * stream doesn't see a 10K-event backlog from days of cron firings.
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { buildPoolForMatch } from '../../../../lib/hits/pool-builder'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const DEMO_MATCH_ID = 'demo-pba-perpetual'
const RECENT_WINDOW = 5      // don't repeat events fired in the last N
const READ_WINDOW = 30        // events to look back for variety check
const PRUNE_THRESHOLD = 50    // prune when total events exceeds this
const PRUNE_KEEP = 30         // keep this many newest events after prune

export async function GET(req: Request) {
  // Vercel cron sends Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get('authorization')
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json({ ok: false, error: 'cron_secret_unset' }, { status: 500 })
  }
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Read recent events for this match
  const { data: recent, error: readErr } = await admin
    .from('events')
    .select('id, event_key')
    .eq('match_id', DEMO_MATCH_ID)
    .order('id', { ascending: false })
    .limit(READ_WINDOW)

  if (readErr) {
    return NextResponse.json(
      { ok: false, error: 'db_read_failed', message: readErr.message },
      { status: 500 }
    )
  }

  const recentEvents = recent ?? []
  const recentKeys = new Set(
    recentEvents.slice(0, RECENT_WINDOW).map((e) => e.event_key as string)
  )

  // Pull the candidate pool. For demo-pba-perpetual, buildPoolForMatch
  // falls back to CANDIDATE_EVENTS (no pba- prefix → no teams parsed).
  const pool = buildPoolForMatch(DEMO_MATCH_ID)
  const candidates = pool.filter((e) => !recentKeys.has(e.id))
  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, skipped: 'no_unfired_candidate' })
  }

  // Random pick weighted by rarity (common 4x, uncommon 2x, rare 1x).
  // Cheap weighting via tiered expansion.
  const weighted: typeof candidates = []
  for (const c of candidates) {
    const weight = c.rarity === 'common' ? 4 : c.rarity === 'uncommon' ? 2 : 1
    for (let i = 0; i < weight; i++) weighted.push(c)
  }
  const picked = weighted[Math.floor(Math.random() * weighted.length)]

  // INSERT the event
  const { error: insertErr } = await admin
    .from('events')
    .insert({ match_id: DEMO_MATCH_ID, event_key: picked.id, payload: {} })

  if (insertErr) {
    return NextResponse.json(
      { ok: false, error: 'db_insert_failed', message: insertErr.message },
      { status: 500 }
    )
  }

  // Periodic prune so a new player doesn't see 10K events on first poll.
  let pruned = 0
  if (recentEvents.length >= PRUNE_THRESHOLD && recentEvents[PRUNE_KEEP]) {
    const keepFromId = recentEvents[PRUNE_KEEP].id as number
    const { error: pruneErr, count } = await admin
      .from('events')
      .delete({ count: 'exact' })
      .eq('match_id', DEMO_MATCH_ID)
      .lt('id', keepFromId)
    if (pruneErr) {
      // Pruning failure is non-fatal — log and continue
      console.error('[demo-tick] prune failed:', pruneErr.message)
    } else {
      pruned = count ?? 0
    }
  }

  return NextResponse.json({
    ok: true,
    fired: picked.id,
    label: picked.label,
    pruned,
  })
}

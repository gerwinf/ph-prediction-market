/**
 * Demo event scheduling.
 *
 * Vercel Hobby tier caps cron at once-per-day, so the original per-minute
 * cron approach (b993ce2) was DOA. Instead, we seed N events with
 * staggered future resolved_at timestamps each time a player buys a card
 * against the demo fixture. /api/events filters resolved_at <= now() so
 * the future ones stay hidden until their stamp crosses real time.
 *
 * The demo experience: first event fires immediately, then one every
 * ~30s for ~7 minutes total. Plenty of cells to potentially complete
 * a row on a freshly bought card.
 *
 * Idempotent-ish: counts existing future events; only tops up if below
 * MIN_FUTURE. So two players buying at the same moment don't get
 * 30 events scheduled in parallel.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildPoolForMatch } from '../hits/pool-builder'

const DEMO_MATCH_ID = 'demo-pba-perpetual'
const MIN_FUTURE_EVENTS = 12 // top up only when fewer than this many are pending
const TOP_UP_TO = 15         // refill to this many on top-up
const STAGGER_SECONDS = 30   // gap between fires
const PRUNE_OLDER_THAN_MIN = 30 // delete events older than N min so the events table doesn't grow forever

export async function ensureDemoEvents(
  admin: SupabaseClient,
  matchId: string = DEMO_MATCH_ID
): Promise<{ added: number; pruned: number; futureCount: number }> {
  const nowIso = new Date().toISOString()

  // Count future-stamped events still pending
  const { data: future, error: futureErr } = await admin
    .from('events')
    .select('id, event_key, resolved_at')
    .eq('match_id', matchId)
    .gt('resolved_at', nowIso)
    .order('resolved_at', { ascending: true })

  if (futureErr) {
    // Don't break the buy on a seeding failure — just bail with zero state.
    console.error('[seed-events] future read failed:', futureErr.message)
    return { added: 0, pruned: 0, futureCount: 0 }
  }

  const futureCount = future?.length ?? 0
  if (futureCount >= MIN_FUTURE_EVENTS) {
    // Already enough events in the pipeline.
    return { added: 0, pruned: 0, futureCount }
  }

  // How many more to add
  const need = TOP_UP_TO - futureCount

  // Pick from the pool, avoiding the last 5 fired (no immediate repeats)
  const { data: recent } = await admin
    .from('events')
    .select('event_key')
    .eq('match_id', matchId)
    .lt('resolved_at', nowIso)
    .order('id', { ascending: false })
    .limit(5)
  const recentKeys = new Set((recent ?? []).map((r) => r.event_key as string))
  // Also avoid currently-scheduled future events
  const pendingKeys = new Set((future ?? []).map((r) => r.event_key as string))

  const pool = buildPoolForMatch(matchId)
  const candidates = pool.filter((e) => !recentKeys.has(e.id) && !pendingKeys.has(e.id))
  if (candidates.length === 0) {
    return { added: 0, pruned: 0, futureCount }
  }

  // Rarity-weighted picks for variety
  const weighted: typeof candidates = []
  for (const c of candidates) {
    const weight = c.rarity === 'common' ? 4 : c.rarity === 'uncommon' ? 2 : 1
    for (let i = 0; i < weight; i++) weighted.push(c)
  }

  // Where to start scheduling — if no existing future events, fire the
  // first one almost immediately so the player gets fast feedback.
  // Otherwise continue from the last scheduled timestamp.
  const baseMs =
    future && future.length > 0
      ? new Date(future[future.length - 1].resolved_at).getTime()
      : Date.now()

  const rows: Array<{ match_id: string; event_key: string; payload: object; resolved_at: string }> = []
  const seenInBatch = new Set<string>()
  let attempts = 0
  while (rows.length < need && attempts < need * 4) {
    attempts++
    const pick = weighted[Math.floor(Math.random() * weighted.length)]
    if (seenInBatch.has(pick.id)) continue
    seenInBatch.add(pick.id)

    // First new event: fire ~5s out so the user sees a cell move quickly
    // after their card mounts and starts polling. Subsequent events: stagger.
    const offsetMs =
      future && future.length > 0
        ? (rows.length + 1) * STAGGER_SECONDS * 1000
        : rows.length === 0
          ? 5_000
          : 5_000 + rows.length * STAGGER_SECONDS * 1000

    rows.push({
      match_id: matchId,
      event_key: pick.id,
      payload: {},
      resolved_at: new Date(baseMs + offsetMs).toISOString(),
    })
  }

  if (rows.length === 0) {
    return { added: 0, pruned: 0, futureCount }
  }

  const { error: insertErr } = await admin.from('events').insert(rows)
  if (insertErr) {
    console.error('[seed-events] insert failed:', insertErr.message)
    return { added: 0, pruned: 0, futureCount }
  }

  // Opportunistic prune of OLD events (already-fired, > 30 min stale) so
  // the events table doesn't accumulate forever.
  const pruneCutoff = new Date(Date.now() - PRUNE_OLDER_THAN_MIN * 60_000).toISOString()
  const { error: pruneErr, count: prunedCount } = await admin
    .from('events')
    .delete({ count: 'exact' })
    .eq('match_id', matchId)
    .lt('resolved_at', pruneCutoff)

  if (pruneErr) {
    console.error('[seed-events] prune failed:', pruneErr.message)
  }

  return {
    added: rows.length,
    pruned: prunedCount ?? 0,
    futureCount: futureCount + rows.length,
  }
}

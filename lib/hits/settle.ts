import type { GameEvent } from './types'
import { allocate, toPoolCard, type Allocation } from './pool'
import { settleCardsIfFinal } from './settle-fixed'
import { selectStaleLiveToFinalize, type LiveWindowFixture } from './fixture-window'

/**
 * Fixture settlement — shadow phase.
 *
 * `computeMatchSettlement` is PURE (unit-tested); `settleFixtureIfNeeded` is
 * the never-throw IO wrapper invoked from every trigger the CEO review made
 * mandatory (1A — settlement must be inevitable):
 *   1. settle-on-read: /api/events polls (piggybacks the existing feed sync)
 *   2. /api/ops/fixture-status flipping a fixture final/canceled
 *   3. the daily maintain-catalog cron (catch-up + settlement_lag warning)
 *
 * Shadow phase writes ONE pool_settlements summary row (atomic insert;
 * UNIQUE(match_id) absorbs concurrent triggers) and credits nothing. The
 * credited pass (phase 3) ships as a Postgres RPC — see migration 013.
 */

export type SettleCardRow = { id: string; price_php: number; cells: GameEvent[] }

export function computeMatchSettlement(
  cards: SettleCardRow[],
  eventKeys: string[],
  reserveCentavos: number,
  opts: { canceled?: boolean } = {}
): Allocation {
  const keySet = new Set(eventKeys)
  const poolCards = cards.map((c) => toPoolCard(c, keySet))
  return allocate(poolCards, reserveCentavos, { refund: opts.canceled === true })
}

// Per-instance TTL so the 3s card poll doesn't re-check settled state
// constantly. Idempotency lives in the DB (unique constraint), not here.
const lastCheckAt = new Map<string, number>()
const CHECK_TTL_MS = 30_000

/** Real sports fixtures only — demo and daily fixtures never settle pools. */
function isSettleable(matchId: string): boolean {
  return matchId.startsWith('wc-') || matchId.startsWith('pba-')
}

/**
 * Settle-on-read: if the fixture is final (or canceled) and has no settlement
 * row yet, compute and record one. Idempotent, race-safe, never throws.
 * Pass `force: true` from ops/cron triggers to bypass the read TTL.
 */
export async function settleFixtureIfNeeded(
  matchId: string,
  opts: { force?: boolean } = {}
): Promise<void> {
  try {
    if (!isSettleable(matchId)) return
    const last = lastCheckAt.get(matchId) ?? 0
    if (!opts.force && Date.now() - last < CHECK_TTL_MS) return
    lastCheckAt.set(matchId, Date.now())

    const { createAdminClient } = await import('../supabase/admin')
    const admin = createAdminClient()

    const { data: fixture } = await admin
      .from('match_fixtures')
      .select('status, settlement_mode')
      .eq('id', matchId)
      .maybeSingle()
    if (!fixture) return
    const status = fixture.status as string
    if (status !== 'final' && status !== 'canceled') return

    const { data: existing } = await admin
      .from('pool_settlements')
      .select('id')
      .eq('match_id', matchId)
      .maybeSingle()
    if (existing) return

    const [{ data: cards }, { data: events }, { data: ledger }] = await Promise.all([
      admin.from('cards').select('id, price_php, cells').eq('match_id', matchId),
      admin.from('events').select('event_key').eq('match_id', matchId),
      admin.from('pool_reserve_ledger').select('amount_centavos'),
    ])
    if (!cards || cards.length === 0) return // nothing sold — nothing to settle

    const eventKeys = Array.from(new Set((events ?? []).map((e) => e.event_key as string)))
    const reserveCentavos = (ledger ?? []).reduce(
      (s, r) => s + Number(r.amount_centavos ?? 0),
      0
    )

    const a = computeMatchSettlement(
      cards as SettleCardRow[],
      eventKeys,
      reserveCentavos,
      { canceled: status === 'canceled' }
    )

    // Shadow phase: settlement_mode 'fixed' fixtures get a shadow row only.
    // 'parimutuel' fixtures will call the settle_parimutuel_credit RPC here
    // (phase 3); until that ships they also record shadow (never credit).
    const { error } = await admin.from('pool_settlements').insert({
      match_id: matchId,
      mode: a.refund ? 'refund' : 'shadow',
      vt_centavos: a.vtCentavos,
      fee_centavos: a.feeCentavos,
      reserve_drawn_centavos: a.reserveDrawnCentavos,
      surplus_centavos: a.surplusCentavos,
      weight_centavos: a.weightCentavos,
      u: a.u,
      winners: a.winners,
      cards: cards.length,
      payouts: a.payouts,
    })
    if (error) {
      // 23505 = another instance settled first — exactly what UNIQUE is for.
      if (error.code !== '23505') {
        console.error('[hits/settle] insert failed:', matchId, error.message)
      }
      return
    }
    console.info(
      `[hits/settle] shadow-settled ${matchId}: cards=${cards.length} winners=${a.winners} ` +
      `u=${a.u.toFixed(4)} vt=₱${(a.vtCentavos / 100).toFixed(2)} ` +
      `surplus→reserve=₱${(a.surplusCentavos / 100).toFixed(2)}`
    )
  } catch (err) {
    // Settlement must never break the calling poll/route.
    console.error('[hits/settle] error:', matchId, err)
  }
}

/**
 * Cron catch-up: force clearly-over `live` fixtures to `final` so they stop
 * pinning the /hits hero as the live game AND their cards finally settle.
 *
 * Fixtures only leave `live` when explicitly finalized — PBA is ops-only, and
 * the WC FIFA sync runs only while a card page is polling. A game whose viewers
 * left before full-time (or that the feed never resolved) is stranded `live`
 * indefinitely. This runs before sweepUnsettledFixtures in the daily cron, so
 * the rows it flips get settled in the same pass. Idempotent (only touches
 * still-`live` rows), never throws. Returns a summary for the cron log.
 */
export async function finalizeStaleLiveFixtures(): Promise<{ checked: number; finalized: number }> {
  try {
    const { createAdminClient } = await import('../supabase/admin')
    const admin = createAdminClient()
    const { data: liveRows } = await admin
      .from('match_fixtures')
      .select('id, status, starts_at, ends_at')
      .eq('status', 'live')
    if (!liveRows || liveRows.length === 0) return { checked: 0, finalized: 0 }

    const staleIds = selectStaleLiveToFinalize(liveRows as LiveWindowFixture[], Date.now())
    let finalized = 0
    for (const id of staleIds) {
      // Mirror ops finalization: stamp ends_at so settlement_lag warnings and
      // the finished window have a real timestamp. Race-safe — only flips a row
      // still `live`, so a concurrent ops/feed final wins and this no-ops.
      const { error, count } = await admin
        .from('match_fixtures')
        .update({ status: 'final', ends_at: new Date().toISOString() }, { count: 'exact' })
        .eq('id', id)
        .eq('status', 'live')
      if (error) {
        console.error('[hits/settle] finalize stale-live failed:', id, error.message)
        continue
      }
      if (count && count > 0) {
        finalized++
        console.info(`[hits/settle] finalized stale-live fixture ${id} (no live→final trigger fired)`)
      }
    }
    return { checked: liveRows.length, finalized }
  } catch (err) {
    console.error('[hits/settle] finalize stale-live sweep error:', err)
    return { checked: 0, finalized: 0 }
  }
}

/**
 * Cron sweep (CEO review 1A #3): shadow-settle anything final that slipped
 * through, and warn on settlement lag. Returns a summary for the cron log.
 */
export async function sweepUnsettledFixtures(): Promise<{ checked: number; settled: number }> {
  try {
    const { createAdminClient } = await import('../supabase/admin')
    const admin = createAdminClient()
    const { data: finals } = await admin
      .from('match_fixtures')
      .select('id, ends_at')
      .in('status', ['final', 'canceled'])
      .order('ends_at', { ascending: false })
      .limit(50)
    if (!finals) return { checked: 0, settled: 0 }

    const { data: settled } = await admin.from('pool_settlements').select('match_id')
    const settledSet = new Set((settled ?? []).map((s) => s.match_id as string))

    let count = 0
    for (const f of finals) {
      const id = f.id as string
      if (!isSettleable(id) || settledSet.has(id)) continue
      const endedAt = f.ends_at ? Date.parse(f.ends_at as string) : NaN
      if (Number.isFinite(endedAt) && Date.now() - endedAt > 60 * 60 * 1000) {
        console.warn(`[hits/settle] settlement_lag: ${id} final >1h without settlement`)
      }
      await settleFixtureIfNeeded(id, { force: true })
      count++
    }
    // Fixed-odds book: settle cards for EVERY final fixture (not just those
    // missing a shadow row) — a fixture can be shadow-settled yet still have
    // unsettled cards. Per-card `.is('settled_at', null)` keeps it idempotent.
    for (const f of finals) {
      const id = f.id as string
      if (isSettleable(id)) await settleCardsIfFinal(id, { force: true })
    }
    return { checked: finals.length, settled: count }
  } catch (err) {
    console.error('[hits/settle] sweep error:', err)
    return { checked: 0, settled: 0 }
  }
}

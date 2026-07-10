import type { GameEvent } from './types'
import { bestPayout, rareCellIndices } from './payouts'

/**
 * Fixed-odds card settlement — the LIVE payout book (distinct from the shadow
 * parimutuel engine in settle.ts / pool.ts).
 *
 * A card pays `price × best line multiplier` (5×/5×/10×/250×) if any pattern
 * completes from the events fired for its match, else 0 and the house holds
 * the full wager. The outcome is recomputed server-side from cells∩events —
 * it NEVER trusts the client-set `cards.won` flag, so an unclaimed winning
 * board is paid, not banked as a loss.
 *
 * `computeFixedSettlement` is pure + unit-tested; `settleCardsIfFinal` is the
 * never-throw IO wrapper wired into the same "settlement must be inevitable"
 * triggers as the shadow engine (events-poll settle-on-read, cron sweep, ops
 * fixture-status). Before this existed, only the manual ops endpoint settled
 * cards, so feed-finalized fixtures (World Cup auto-finalizes on MATCH_END)
 * left every card unsettled — no GGR, no payout.
 */

export type FixedSettleCard = {
  id: string
  price_php: number
  cells: GameEvent[]
  user_id?: string | null
}

export type FixedOutcome = {
  id: string
  won: boolean
  winPattern: string | null
  scorePhp: number
  holdAmountPhp: number
  userId: string | null
  pricePhp: number
}

/** Hit set from a card's cells ∩ the match's fired event keys. Free cell (12)
 *  is always in — mirrors toPoolCard / the /won route exactly. */
function hitIndices(cells: GameEvent[], eventKeys: Set<string>): Set<number> {
  const hits = new Set<number>([12])
  ;(cells ?? []).forEach((cell, idx) => {
    if (cell && cell.id && eventKeys.has(cell.id)) hits.add(idx)
  })
  return hits
}

export function computeFixedSettlement(card: FixedSettleCard, eventKeys: Set<string>): FixedOutcome {
  // Rainbow (rare) cells double a pattern's payout — pass rareCellIndices so a
  // sweep-settled win pays identically to a client /won claim.
  const best = bestPayout(hitIndices(card.cells, eventKeys), card.price_php, rareCellIndices(card.cells ?? []))
  const won = best.pattern !== null
  const scorePhp = won ? best.payoutPhp : 0
  return {
    id: card.id,
    won,
    winPattern: won ? best.pattern!.kind : null,
    scorePhp,
    holdAmountPhp: card.price_php - scorePhp,
    userId: card.user_id ?? null,
    pricePhp: card.price_php,
  }
}

export function computeFixedSettlements(cards: FixedSettleCard[], eventKeys: string[]): FixedOutcome[] {
  const keys = new Set(eventKeys)
  return cards.map((c) => computeFixedSettlement(c, keys))
}

// Per-instance TTL so the 3s card poll doesn't re-scan a fully-settled match
// every tick. Real idempotency lives in the DB (`.is('settled_at', null)`).
const lastCheckAt = new Map<string, number>()
const CHECK_TTL_MS = 30_000

/**
 * Settle every not-yet-settled card of a FINAL fixture against its fired
 * events. Writes score/won/win_pattern/hold_amount/settled_at, and credits
 * authed winners' profiles.virtual_balance (anon balances are localStorage —
 * credited when the player opens the card, via the idempotent /won path).
 *
 * Idempotent, race-safe, never throws. `force: true` bypasses the read TTL
 * (ops/cron triggers). Canceled fixtures are refunded by the ops route, not
 * here, so this handles `final` only.
 */
export async function settleCardsIfFinal(
  matchId: string,
  opts: { force?: boolean } = {}
): Promise<{ settled: number; paidPhp: number }> {
  const result = { settled: 0, paidPhp: 0 }
  try {
    const last = lastCheckAt.get(matchId) ?? 0
    if (!opts.force && Date.now() - last < CHECK_TTL_MS) return result
    lastCheckAt.set(matchId, Date.now())

    const { createAdminClient } = await import('../supabase/admin')
    const admin = createAdminClient()

    const { data: fixture } = await admin
      .from('match_fixtures')
      .select('status')
      .eq('id', matchId)
      .maybeSingle()
    if (!fixture || fixture.status !== 'final') return result

    const [{ data: cards }, { data: events }] = await Promise.all([
      admin.from('cards').select('id, price_php, cells, user_id').eq('match_id', matchId).is('settled_at', null),
      admin.from('events').select('event_key').eq('match_id', matchId),
    ])
    if (!cards || cards.length === 0) return result

    const eventKeys = Array.from(new Set((events ?? []).map((e) => e.event_key as string)))
    const outcomes = computeFixedSettlements(cards as FixedSettleCard[], eventKeys)
    const settledAt = new Date().toISOString()

    for (const o of outcomes) {
      // Race guard: only settle a row still unsettled. `.select()` tells us
      // whether WE won the race — credit the balance only then, so a
      // concurrent /won claim can't double-credit.
      const { data: updated, error: updErr } = await admin
        .from('cards')
        .update({
          won: o.won,
          win_pattern: o.winPattern,
          score: o.scorePhp,
          hold_amount: o.holdAmountPhp,
          settled_at: settledAt,
        })
        .eq('id', o.id)
        .is('settled_at', null)
        .select('id')
        .maybeSingle()
      if (updErr || !updated) continue // lost the race or errored — skip

      result.settled++
      result.paidPhp += o.scorePhp

      // Authed winner: credit the card OWNER's balance (card.user_id), not a
      // request user — this runs with no session.
      if (o.won && o.userId) {
        const { data: prof } = await admin
          .from('profiles')
          .select('virtual_balance')
          .eq('id', o.userId)
          .maybeSingle()
        if (prof) {
          await admin
            .from('profiles')
            .update({ virtual_balance: (prof.virtual_balance as number) + o.scorePhp })
            .eq('id', o.userId)
        }
      }
    }
    return result
  } catch (err) {
    console.error('[hits/settle-fixed] error:', matchId, err)
    return result
  }
}

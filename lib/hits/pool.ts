import type { GameEvent } from './types'
import { detectWins } from './payouts'

/**
 * Parimutuel pool allocation — the core of the Hits settlement engine
 * (docs/superpowers/specs/2026-07-07-hits-parimutuel-design.md).
 *
 * Because a winner's cap equals its claim weight (cap_i = w_i = mult_i ×
 * stake_i), capped proportional allocation collapses to a closed form — no
 * iterative water-filling. Everyone receives the same fraction of their cap:
 *
 *   fee     = round(h · vT)                    h = 6% takeout (spec §3/§4)
 *   avail   = (vT − fee) + reserveDraw         reserve tops payouts up to caps
 *   u       = min(1, avail / W)                W = Σ claim weights
 *   pay_i   = floor(w_i · u)                   integer centavos
 *   surplus = avail − Σ pay_i                  → rolls to the reserve
 *
 * All arithmetic is integer centavos. CONSERVATION INVARIANT (property-
 * tested): Σ pay + surplus + fee === vT + reserveDrawn, exactly.
 *
 * This same function is the UI's live estimator (run over current winners
 * mid-game) — engine and display cannot drift.
 */

export const HOLD_RATE = 0.06
export const PAGCOR_SHARE = 0.15 // of the hold (spec §4); remainder is operator margin

/** A card's settlement-relevant state at (or during) resolution. */
export type PoolCard = {
  id: string
  pricePhp: number
  /** Non-free cells lit by fired events. */
  litCells: number
  /** Highest satisfied pattern multiplier (250/10/5), or 0 if no pattern. */
  bestMultiplier: number
}

export type Allocation = {
  /** Uniform payout fraction: 1 while the reserve covers all caps. */
  u: number
  vtCentavos: number
  feeCentavos: number
  /** Amount actually drawn from the rollover reserve (≤ reserve balance). */
  reserveDrawnCentavos: number
  /** (vT − fee) + reserveDrawn — what winners share. */
  availCentavos: number
  weightCentavos: number
  /** cardId → payout in centavos (only cards with weight > 0 appear). */
  payouts: Record<string, number>
  /** Undistributed remainder → next game's reserve. */
  surplusCentavos: number
  winners: number
  refund: boolean
}

// Consolation tuning (decided 2026-07-08 from the first two shadow
// settlements): unbounded 1×/lit-cell inverted the tier ordering — a
// 13-lit-cell "loser" out-earned a completed row (13× > 5×) — and burned
// ~₱165 of seed per card on busy matches. Floor 3 keeps sub-3-cell cards at
// zero; cap 4 keeps consolation strictly below the lowest pattern tier (5×).
export const CONSOLATION_FLOOR_CELLS = 3
export const CONSOLATION_CAP_MULT = 4

/**
 * Claim weight in centavos. Highest satisfied tier, non-additive; the
 * consolation tier weighs 1× per lit cell, floored at
 * CONSOLATION_FLOOR_CELLS and capped at CONSOLATION_CAP_MULT × stake.
 */
export function claimWeightCentavos(card: PoolCard): number {
  const stakeCentavos = Math.round(card.pricePhp * 100)
  if (card.bestMultiplier > 0) return card.bestMultiplier * stakeCentavos
  if (card.litCells >= CONSOLATION_FLOOR_CELLS) {
    return Math.min(card.litCells, CONSOLATION_CAP_MULT) * stakeCentavos
  }
  return 0
}

/** 15% of the hold remits as the PAGCOR/RGS share; 85% is operator margin. */
export function feeSplitCentavos(feeCentavos: number): { pagcor: number; operator: number } {
  const pagcor = Math.round(feeCentavos * PAGCOR_SHARE)
  return { pagcor, operator: feeCentavos - pagcor }
}

/**
 * Allocate a settled (or in-progress, for estimates) game's treasury.
 *
 * `refund: true` (cancelled/postponed fixture, spec §3): every card gets its
 * stake back, no fee, no reserve movement.
 */
export function allocate(
  cards: PoolCard[],
  reserveCentavos: number,
  opts: { refund?: boolean } = {}
): Allocation {
  const vtCentavos = cards.reduce((s, c) => s + Math.round(c.pricePhp * 100), 0)

  if (opts.refund) {
    return {
      u: 1,
      vtCentavos,
      feeCentavos: 0,
      reserveDrawnCentavos: 0,
      availCentavos: vtCentavos,
      weightCentavos: vtCentavos,
      payouts: Object.fromEntries(cards.map((c) => [c.id, Math.round(c.pricePhp * 100)])),
      surplusCentavos: 0,
      winners: cards.length,
      refund: true,
    }
  }

  const feeCentavos = Math.round(vtCentavos * HOLD_RATE)
  const organic = vtCentavos - feeCentavos

  const weights = cards
    .map((c) => ({ id: c.id, w: claimWeightCentavos(c) }))
    .filter((x) => x.w > 0)
  const weightCentavos = weights.reduce((s, x) => s + x.w, 0)

  // Draw from the reserve only what's needed to reach full caps.
  const reserveDrawnCentavos = Math.max(0, Math.min(reserveCentavos, weightCentavos - organic))
  const availCentavos = organic + reserveDrawnCentavos

  const payouts: Record<string, number> = {}
  let paid = 0
  if (weightCentavos > 0) {
    const capped = availCentavos >= weightCentavos
    for (const { id, w } of weights) {
      // floor() puts rounding dust into surplus (→ reserve), never over-pays.
      const pay = capped ? w : Math.floor((w * availCentavos) / weightCentavos)
      payouts[id] = pay
      paid += pay
    }
  }

  return {
    u: weightCentavos === 0 ? 1 : Math.min(1, availCentavos / weightCentavos),
    vtCentavos,
    feeCentavos,
    reserveDrawnCentavos,
    availCentavos,
    weightCentavos,
    payouts,
    surplusCentavos: availCentavos - paid,
    winners: weights.length,
    refund: false,
  }
}

/**
 * Derive a card's PoolCard state from its stored cells and the match's fired
 * event keys — the same rule the live card page uses (cell.id ∈ keys, free
 * cell always in).
 */
export function toPoolCard(
  card: { id: string; price_php: number; cells: GameEvent[] },
  eventKeys: Set<string>
): PoolCard {
  const hits = new Set<number>([12])
  card.cells.forEach((cell, idx) => {
    if (eventKeys.has(cell.id)) hits.add(idx)
  })
  const wins = detectWins(hits)
  const bestMultiplier = wins.reduce((m, w) => Math.max(m, w.multiplier), 0)
  return {
    id: card.id,
    pricePhp: card.price_php,
    litCells: hits.size - 1, // exclude the free cell
    bestMultiplier,
  }
}

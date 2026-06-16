/**
 * Pure fixed-odds market-maker math. Zero IO — all correctness lives here.
 *
 * The house quotes a probability `p` (YES); a bet locks a decimal multiplier
 * (overround = the house margin). Payouts floor — the house always rounds down,
 * the standard bookmaker convention, which also guarantees a placed bet's hold
 * is never accidentally negative from rounding. See the design spec section
 * "Odds + margin" (docs/superpowers/specs/2026-06-16-cold-start-market-maker-design.md).
 */
export const EPS = 1e-4
export const MARGIN_DEFAULT = 0.05
export const MIN_STAKE_PHP = 10

const clampP = (p: number) => Math.min(1 - EPS, Math.max(EPS, p))

/** Decimal multipliers for both sides given YES probability `p` and margin `m`. */
export function multipliers(p: number, margin: number): { yes: number; no: number } {
  const q = clampP(p)
  return {
    yes: (1 / q) * (1 - margin),
    no: (1 / (1 - q)) * (1 - margin),
  }
}

/** Floor payout — house always rounds down. */
export function payout(stake: number, mult: number): number {
  return Math.floor(stake * mult)
}

/** Clamp a Polymarket reference into a usable probability; fall back to `prior`. */
export function anchorPrice(reference: number | null, prior: number): number {
  if (reference == null || Number.isNaN(reference)) return prior
  return clampP(reference)
}

/**
 * Would booking `payoutAmt` on `side` for `stake` push net house exposure past
 * `cap`? Net exposure on a side = (sum of that side's payouts) − (total stakes),
 * since the losing side's stakes offset the winning side's payouts.
 */
export function wouldBreachCap(
  book: { exposureYes: number; exposureNo: number; cap: number },
  side: 'yes' | 'no',
  stake: number,
  payoutAmt: number,
  cap: number,
): boolean {
  const addedNet = payoutAmt - stake
  const current = side === 'yes' ? book.exposureYes : book.exposureNo
  return current + addedNet > cap
}

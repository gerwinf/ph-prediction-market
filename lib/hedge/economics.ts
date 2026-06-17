/**
 * Pre-hedge engine — pure economics. Zero IO.
 *
 * The mirror market has a YES token priced in (0,1). Hula quotes a two-sided
 * market around the Polymarket mid `m`: bid = m − s/2, ask = m + s/2. Every fill
 * is offset on Polymarket at ≈ m + σ (hedge slippage), so the locked margin per
 * fill is N·(s/2 − σ). The whole business is the inequality s/2 > σ.
 *
 * See docs/superpowers/specs/2026-06-17-pre-hedge-engine-v0-spec.md §2.
 */
export const TICK = 0.01

const clamp = (p: number) => Math.min(1 - TICK, Math.max(TICK, p))

/** Hula's two-sided quote around the Polymarket mid. */
export function quotes(mid: number, spread: number): { bid: number; ask: number } {
  const half = spread / 2
  return { bid: clamp(mid - half), ask: clamp(mid + half) }
}

/** Margin locked per fill: the markup (s/2) minus the hedge slippage (σ), × size. */
export function lockedMargin(size: number, spread: number, slippage: number): number {
  return size * (spread / 2 - slippage)
}

/** The whole business: the half-spread markup must strictly beat hedge slippage. */
export function isProfitable(spread: number, slippage: number): boolean {
  return spread / 2 > slippage
}

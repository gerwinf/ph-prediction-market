/**
 * Pre-hedge engine — risk/inventory ledger. Pure accounting, zero IO; the single
 * source of truth for exposure, capital, and P&L.
 *
 * Convention (Hula's books, in YES contracts):
 *   userNet  = net YES the user side is long against Hula (user buy YES → +N).
 *   hedgeNet = net YES Hula holds on Polymarket as the offset    (hedge buy → +N).
 *   netExposure = userNet − hedgeNet  → 0 when every fill is hedged.
 *   equity(m)   = cash + (hedgeNet − userNet)·m
 *               fully hedged ⇒ equity = cash = Σ locked margin (no price risk);
 *               unhedged     ⇒ equity swings with the mid m (directional risk).
 *
 * See docs/superpowers/specs/2026-06-17-pre-hedge-engine-v0-spec.md §6.
 */
export type Side = 'buy' | 'sell'

export type LedgerState = {
  cash: number // realized cash (user premiums in, hedge cost out)
  userNet: number // net YES users are long vs Hula
  hedgeNet: number // net YES Hula holds on Polymarket
  capitalDeployed: number // USDC tied up in the hedge position
  spreadCaptured: number // cumulative gross markup charged over mid
}

export function emptyLedger(): LedgerState {
  return { cash: 0, userNet: 0, hedgeNet: 0, capitalDeployed: 0, spreadCaptured: 0 }
}

/**
 * A user fill against Hula. `hulaPrice` is the quoted bid/ask, `mid` the
 * reference at fill time (for the gross-markup accounting). Buy = user buys YES
 * from Hula (Hula receives premium, goes short to the user → userNet +size).
 */
export function applyUserFill(
  s: LedgerState,
  side: Side,
  size: number,
  hulaPrice: number,
  mid: number,
): LedgerState {
  if (side === 'buy') {
    return {
      ...s,
      cash: s.cash + size * hulaPrice,
      userNet: s.userNet + size,
      spreadCaptured: s.spreadCaptured + size * (hulaPrice - mid),
    }
  }
  return {
    ...s,
    cash: s.cash - size * hulaPrice,
    userNet: s.userNet - size,
    spreadCaptured: s.spreadCaptured + size * (mid - hulaPrice),
  }
}

/**
 * The offsetting Polymarket fill. `side` mirrors the user fill (a user buy is
 * hedged by a Poly buy of YES). Buy deploys working capital; sell frees it.
 */
export function applyHedge(s: LedgerState, side: Side, size: number, polyPrice: number): LedgerState {
  if (side === 'buy') {
    return {
      ...s,
      cash: s.cash - size * polyPrice,
      hedgeNet: s.hedgeNet + size,
      capitalDeployed: s.capitalDeployed + size * polyPrice,
    }
  }
  return {
    ...s,
    cash: s.cash + size * polyPrice,
    hedgeNet: s.hedgeNet - size,
    capitalDeployed: s.capitalDeployed - size * polyPrice,
  }
}

/** Net directional exposure in YES contracts. ~0 when fully hedged. */
export function netExposure(s: LedgerState): number {
  return s.userNet - s.hedgeNet
}

/** Mark-to-market equity at mid `m`. Fully hedged ⇒ equals realized cash. */
export function equity(s: LedgerState, mid: number): number {
  return s.cash + (s.hedgeNet - s.userNet) * mid
}

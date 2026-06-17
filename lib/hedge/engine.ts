/**
 * Pre-hedge engine — SIM mode orchestration (M1).
 *
 * Ties the pure economics + ledger together: quotes off the live mid, processes
 * user fills, and (when hedging is ON) simulates the offsetting Polymarket fill
 * at mid ± σ. Enforces the hard invariant from the spec §4.3 — net exposure may
 * never exceed E_max; a fill that would breach it is REJECTED rather than
 * accepted as un-hedgeable flow.
 *
 * The `pendingHedge` reservation (eng-review F1) is modelled here so the real
 * engine (M2) inherits it: size is reserved before the hedge and released on
 * confirm. In SIM the hedge is synchronous so it nets out within `fill()`, but
 * the E_max check already counts reserved-but-unconfirmed size.
 *
 * Real order-posting (M2) replaces `simulateHedge` with a Polymarket FAK order +
 * two-phase write + hedge-fail policy; the ledger/exposure contract is identical.
 *
 * See docs/superpowers/specs/2026-06-17-pre-hedge-engine-v0-spec.md §2,§4.
 */
import { quotes } from './economics'
import {
  emptyLedger,
  applyUserFill,
  applyHedge,
  netExposure,
  equity,
  type LedgerState,
  type Side,
} from './ledger'

export type EngineConfig = {
  spread: number // s
  slippage: number // σ, the simulated hedge slippage
  eMax: number // max |net exposure| in contracts
  hedging: boolean // ON → offset every fill; OFF → accumulate (the contrast)
}

export type FillResult =
  | { ok: true; ledger: LedgerState; netExposure: number; hedged: boolean }
  | { ok: false; reason: 'e_max' }

export class HedgeEngine {
  private ledger = emptyLedger()
  private pendingHedge = 0
  private cfg: EngineConfig

  constructor(cfg: EngineConfig) {
    this.cfg = { ...cfg }
  }

  /** Hula's two-sided quote around the current Polymarket mid. */
  quote(mid: number) {
    return quotes(mid, this.cfg.spread)
  }

  setHedging(on: boolean) {
    this.cfg.hedging = on
  }

  /**
   * Process a user fill at the current mid. Rejects (without mutating state) if
   * accepting would push net exposure past E_max. When hedging is ON, the fill
   * is offset immediately so exposure returns to its prior level.
   */
  fill(side: Side, size: number, mid: number): FillResult {
    const signed = side === 'buy' ? size : -size
    // Exposure that would remain AFTER the (possible) hedge. Hedging on ⇒ the
    // offset cancels this fill, so net is unchanged; off ⇒ it grows by `signed`.
    const projected = this.cfg.hedging
      ? netExposure(this.ledger)
      : netExposure(this.ledger) + signed
    if (Math.abs(projected) + this.pendingHedge > this.cfg.eMax) {
      return { ok: false, reason: 'e_max' }
    }

    const { bid, ask } = this.quote(mid)
    this.ledger = applyUserFill(this.ledger, side, size, side === 'buy' ? ask : bid, mid)

    let hedged = false
    if (this.cfg.hedging) {
      this.pendingHedge += size // reserve (F1) — released on confirm below
      const polyPrice = side === 'buy' ? mid + this.cfg.slippage : mid - this.cfg.slippage
      this.ledger = applyHedge(this.ledger, side, size, polyPrice)
      this.pendingHedge -= size
      hedged = true
    }

    return { ok: true, ledger: this.ledger, netExposure: netExposure(this.ledger), hedged }
  }

  /** Mark-to-market equity at a given mid (for the equity-vs-spread plot). */
  equityAt(mid: number): number {
    return equity(this.ledger, mid)
  }

  state() {
    return {
      ledger: this.ledger,
      netExposure: netExposure(this.ledger),
      pendingHedge: this.pendingHedge,
      spreadCaptured: this.ledger.spreadCaptured,
      capitalDeployed: this.ledger.capitalDeployed,
    }
  }
}

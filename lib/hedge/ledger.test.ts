import { describe, test, expect } from 'vitest'
import { emptyLedger, applyUserFill, applyHedge, netExposure, equity } from './ledger'

// The core proof: a fully-hedged round-trip carries ~zero exposure and the
// equity collapses to the locked spread (independent of where the mid goes).
describe('hedged round-trip', () => {
  test('user buys YES, hedge buys YES on Poly → exposure 0, equity == locked margin', () => {
    const m = 0.5, s = 0.02, N = 100, sigma = 0.005
    let st = emptyLedger()
    st = applyUserFill(st, 'buy', N, m + s / 2, m) // user buys at ask 0.51
    st = applyHedge(st, 'buy', N, m + sigma) // hedge buys at 0.505
    expect(netExposure(st)).toBeCloseTo(0, 9)
    // equity is flat regardless of where the mid moves — no price risk
    expect(equity(st, 0.5)).toBeCloseTo(0.5, 9) // N*(s/2 - sigma) = 100*0.005
    expect(equity(st, 0.9)).toBeCloseTo(0.5, 9)
    expect(equity(st, 0.1)).toBeCloseTo(0.5, 9)
  })

  test('spreadCaptured tracks the gross markup over mid', () => {
    const m = 0.5, s = 0.02, N = 100
    let st = applyUserFill(emptyLedger(), 'buy', N, m + s / 2, m)
    expect(st.spreadCaptured).toBeCloseTo(N * (s / 2), 9) // 100*0.01 = 1.0
  })
})

// Hedging OFF: exposure accumulates and equity is a random walk on the mid.
describe('unhedged fill', () => {
  test('carries directional exposure; equity swings with the mid', () => {
    const m = 0.5, s = 0.02, N = 100
    const st = applyUserFill(emptyLedger(), 'buy', N, m + s / 2, m) // Hula short N YES
    expect(netExposure(st)).toBeCloseTo(N, 9)
    const atFill = equity(st, m)
    expect(equity(st, 0.9)).toBeLessThan(atFill) // mid up → short loses
    expect(equity(st, 0.1)).toBeGreaterThan(atFill) // mid down → short gains
  })
})

// A sell frees capital (symmetric to a buy deploying it).
describe('capital', () => {
  test('hedge buy deploys capital; hedge sell frees it', () => {
    let st = emptyLedger()
    st = applyHedge(st, 'buy', 100, 0.5)
    expect(st.capitalDeployed).toBeCloseTo(50, 9)
    st = applyHedge(st, 'sell', 100, 0.5)
    expect(st.capitalDeployed).toBeCloseTo(0, 9)
  })
})

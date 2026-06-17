import { describe, test, expect } from 'vitest'
import { TICK, quotes, lockedMargin, isProfitable } from './economics'

describe('quotes', () => {
  test('bid/ask straddle the mid by half the spread', () => {
    expect(quotes(0.5, 0.02)).toEqual({ bid: 0.49, ask: 0.51 })
  })
  test('clamps into [TICK, 1-TICK] so quotes never leave (0,1)', () => {
    expect(quotes(0.99, 0.02).ask).toBe(1 - TICK) // 1.00 -> 0.99
    expect(quotes(0.005, 0.02).bid).toBe(TICK) // -0.005 -> 0.01
  })
})

describe('lockedMargin', () => {
  test('locks N·(s/2 − σ) — the markup minus hedge slippage', () => {
    expect(lockedMargin(100, 0.02, 0.005)).toBeCloseTo(0.5, 9) // 100*(0.01-0.005)
  })
  test('goes negative when slippage eats the markup', () => {
    expect(lockedMargin(100, 0.02, 0.02)).toBeLessThan(0)
  })
})

describe('isProfitable', () => {
  test('the whole business: s/2 must beat σ', () => {
    expect(isProfitable(0.02, 0.005)).toBe(true)
    expect(isProfitable(0.02, 0.01)).toBe(false) // s/2 == σ, not strictly greater
    expect(isProfitable(0.02, 0.02)).toBe(false)
  })
})

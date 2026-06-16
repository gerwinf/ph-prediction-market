import { describe, test, expect } from 'vitest'
import {
  EPS, MARGIN_DEFAULT, MIN_STAKE_PHP,
  multipliers, payout, anchorPrice, wouldBreachCap,
} from './odds'

describe('multipliers', () => {
  test('expected house hold equals the margin (5% edge)', () => {
    // margin m = expected hold fraction: offered odds = fair*(1-m), so a bet at
    // true probability p has expected payout stake*(1-m) => hold = stake*m.
    const p = 0.5, m = 0.05, stake = 100
    const { yes } = multipliers(p, m)
    const expectedPayout = p * stake * yes
    expect(stake - expectedPayout).toBeCloseTo(stake * m, 6) // hold == 5
  })
  test('higher YES probability => lower YES multiplier', () => {
    expect(multipliers(0.8, 0.05).yes).toBeLessThan(multipliers(0.5, 0.05).yes)
  })
  test('clamps p into (0,1) so multipliers never blow up', () => {
    expect(Number.isFinite(multipliers(0, 0.05).yes)).toBe(true)
    expect(Number.isFinite(multipliers(1, 0.05).no)).toBe(true)
  })
})

describe('payout', () => {
  test('floors (house rounds down — bookmaker convention)', () => {
    expect(payout(20, 1.85)).toBe(37) // 20*1.85 = 37.0
    expect(payout(7, 1.85)).toBe(12)  // 12.95 -> 12
  })
})

describe('anchorPrice', () => {
  test('clamps reference into [EPS, 1-EPS]', () => {
    expect(anchorPrice(0, 0.5)).toBe(EPS)
    expect(anchorPrice(1, 0.5)).toBe(1 - EPS)
  })
  test('falls back to prior when reference is null/NaN', () => {
    expect(anchorPrice(null, 0.42)).toBe(0.42)
    expect(anchorPrice(NaN, 0.42)).toBe(0.42)
  })
})

describe('wouldBreachCap', () => {
  const book = { exposureYes: 0, exposureNo: 0, cap: 100 }
  test('exact cap allowed, cap+1 rejected', () => {
    // potential net exposure on YES = payout - stake
    expect(wouldBreachCap(book, 'yes', /*stake*/100, /*payoutAmt*/200, 100)).toBe(false) // net 100 == cap
    expect(wouldBreachCap(book, 'yes', 100, 201, 100)).toBe(true)  // net 101 > cap
  })
  test('exposes the constants', () => {
    expect(MIN_STAKE_PHP).toBe(10)
    expect(MARGIN_DEFAULT).toBe(0.05)
  })
})

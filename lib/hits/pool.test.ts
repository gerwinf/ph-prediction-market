import { describe, it, expect } from 'vitest'
import {
  allocate,
  claimWeightCentavos,
  feeSplitCentavos,
  toPoolCard,
  type PoolCard,
} from './pool'
import { generateCard } from './card-generator'

const card = (id: string, pricePhp: number, bestMultiplier: number, litCells = 0): PoolCard => ({
  id, pricePhp, bestMultiplier, litCells,
})

/** The conservation invariant every allocation must satisfy, exactly. */
function assertConservation(cards: PoolCard[], reserve: number) {
  const a = allocate(cards, reserve)
  const paid = Object.values(a.payouts).reduce((s, p) => s + p, 0)
  expect(paid + a.surplusCentavos + a.feeCentavos).toBe(a.vtCentavos + a.reserveDrawnCentavos)
  expect(a.reserveDrawnCentavos).toBeLessThanOrEqual(reserve)
  expect(a.surplusCentavos).toBeGreaterThanOrEqual(0)
  for (const c of cards) {
    const pay = a.payouts[c.id] ?? 0
    expect(pay).toBeLessThanOrEqual(claimWeightCentavos(c)) // cap is a hard ceiling
  }
  return a
}

describe('claimWeightCentavos', () => {
  it('uses the highest tier multiplier, non-additively', () => {
    expect(claimWeightCentavos(card('a', 20, 250))).toBe(250 * 2000)
    expect(claimWeightCentavos(card('a', 50, 10))).toBe(10 * 5000)
  })
  it('consolation (interpretation Y): 1× per lit cell when no pattern', () => {
    expect(claimWeightCentavos(card('a', 20, 0, 4))).toBe(4 * 2000)
    expect(claimWeightCentavos(card('a', 20, 0, 1))).toBe(2000)
  })
  it('zero for a card with nothing lit', () => {
    expect(claimWeightCentavos(card('a', 20, 0, 0))).toBe(0)
  })
})

describe('allocate — closed form', () => {
  it('healthy reserve → u = 1 and every winner gets exactly its cap (fixed-odds feel)', () => {
    const cards = [card('w1', 20, 5), card('w2', 50, 10), card('l1', 20, 0, 0)]
    const a = assertConservation(cards, 10_000_000) // ₱100k reserve
    expect(a.u).toBe(1)
    expect(a.payouts.w1).toBe(5 * 2000)
    expect(a.payouts.w2).toBe(10 * 5000)
    expect(a.payouts.l1).toBeUndefined()
    expect(a.winners).toBe(2)
  })
  it('draws from the reserve only what caps need', () => {
    // vT = ₱40 → organic = 3760c; caps = 10000c → needs 6240c from reserve.
    const cards = [card('w', 20, 5), card('l', 20, 0, 0)]
    const a = assertConservation(cards, 1_000_000)
    expect(a.reserveDrawnCentavos).toBe(10_000 - 3760)
    expect(a.surplusCentavos).toBe(0)
  })
  it('empty reserve + oversubscribed caps → uniform haircut, dust to surplus', () => {
    const cards = [card('w1', 20, 5), card('w2', 20, 5), card('w3', 20, 10)]
    const a = assertConservation(cards, 0)
    expect(a.u).toBeLessThan(1)
    // Same fraction of each cap (within 1 centavo of exact proportionality).
    const r1 = a.payouts.w1 / claimWeightCentavos(cards[0])
    const r3 = a.payouts.w3 / claimWeightCentavos(cards[2])
    expect(Math.abs(r1 - r3)).toBeLessThan(0.001)
  })
  it('no winners → everything after fee rolls to surplus (the jackpot grows)', () => {
    const cards = [card('l1', 20, 0, 0), card('l2', 50, 0, 0)]
    const a = assertConservation(cards, 500_000)
    expect(a.winners).toBe(0)
    expect(a.reserveDrawnCentavos).toBe(0) // never draw for nobody
    expect(a.surplusCentavos).toBe(a.vtCentavos - a.feeCentavos)
  })
  it('cancelled fixture → full refund, no fee, reserve untouched', () => {
    const cards = [card('a', 20, 5), card('b', 50, 0, 0)]
    const a = allocate(cards, 999_999, { refund: true })
    expect(a.payouts.a).toBe(2000)
    expect(a.payouts.b).toBe(5000)
    expect(a.feeCentavos).toBe(0)
    expect(a.reserveDrawnCentavos).toBe(0)
  })
  it('conservation holds across a structured grid of scenarios', () => {
    const tiers = [0, 5, 10, 250]
    for (const reserve of [0, 137, 5000, 2_000_000]) {
      for (const t1 of tiers) for (const t2 of tiers) {
        assertConservation(
          [card('a', 20, t1, t1 === 0 ? 3 : 0), card('b', 50, t2, t2 === 0 ? 7 : 0), card('c', 20, 0, 0)],
          reserve
        )
      }
    }
  })
})

describe('feeSplitCentavos', () => {
  it('splits the hold 15% PAGCOR / 85% operator, conserving exactly', () => {
    const { pagcor, operator } = feeSplitCentavos(12_000)
    expect(pagcor).toBe(1800)
    expect(pagcor + operator).toBe(12_000)
  })
})

describe('toPoolCard', () => {
  const gen = generateCard('POOLT1', 20, 'sports', 'wc-por-esp-2026-07-06')
  it('derives lit cells from fired event keys, free cell excluded from count', () => {
    const someKey = gen.cells[3].id
    const pc = toPoolCard({ id: 'x', price_php: 20, cells: gen.cells }, new Set([someKey]))
    expect(pc.litCells).toBeGreaterThanOrEqual(1)
    expect(pc.bestMultiplier).toBe(0)
  })
  it('detects a full row through the free cell', () => {
    // Light row 3 (indices 10..14; 12 is free).
    const keys = new Set([10, 11, 13, 14].map((i) => gen.cells[i].id))
    const pc = toPoolCard({ id: 'x', price_php: 20, cells: gen.cells }, keys)
    expect(pc.bestMultiplier).toBeGreaterThanOrEqual(5)
  })
})

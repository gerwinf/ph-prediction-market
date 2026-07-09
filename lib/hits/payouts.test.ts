import { describe, it, expect } from 'vitest'
import {
  bestPayout,
  effectiveMultiplier,
  patternHasRainbow,
  rareCellIndices,
  RAINBOW_MULTIPLIER,
  MULTIPLIERS,
} from './payouts'
import type { GameEvent, WinPattern } from './types'

const ROW0 = new Set([0, 1, 2, 3, 4])
const ROW1 = new Set([5, 6, 7, 8, 9])
const DIAG = new Set([0, 6, 12, 18, 24])

const row0Pattern: WinPattern = {
  kind: 'row',
  index: 0,
  cellIndices: [0, 1, 2, 3, 4],
  multiplier: MULTIPLIERS.row,
  label: 'Row 1',
}

const ev = (id: string, rarity: GameEvent['rarity']): GameEvent => ({
  id,
  label: id,
  category: 'flow',
  rarity,
})

describe('rareCellIndices', () => {
  it('includes only rarity="rare" cells', () => {
    const cells = [ev('a', 'common'), ev('b', 'rare'), ev('c', 'uncommon'), ev('d', 'rare')]
    expect(rareCellIndices(cells)).toEqual(new Set([1, 3]))
  })

  it('never counts the free cell, even if flagged rare', () => {
    const cells = [ev('x', 'rare'), { ...ev('free', 'rare') }]
    expect(rareCellIndices(cells)).toEqual(new Set([0]))
  })
})

describe('patternHasRainbow / effectiveMultiplier', () => {
  it('is false and 1× when no rare cell lies on the pattern', () => {
    expect(patternHasRainbow(row0Pattern, new Set([9]))).toBe(false)
    expect(effectiveMultiplier(row0Pattern, new Set([9]))).toBe(MULTIPLIERS.row)
  })

  it('is true and doubled when a rare cell lies on the pattern', () => {
    expect(patternHasRainbow(row0Pattern, new Set([1]))).toBe(true)
    expect(effectiveMultiplier(row0Pattern, new Set([1]))).toBe(MULTIPLIERS.row * RAINBOW_MULTIPLIER)
  })
})

describe('bestPayout with rainbow bonus', () => {
  it('is unchanged when the card has no rare cells', () => {
    const best = bestPayout(ROW0, 20)
    expect(best.pattern?.kind).toBe('row')
    expect(best.multiplier).toBe(MULTIPLIERS.row)
    expect(best.payoutPhp).toBe(20 * MULTIPLIERS.row)
    expect(best.rainbow).toBe(false)
  })

  it('doubles a winning line that runs through a rainbow cell', () => {
    const best = bestPayout(ROW0, 20, new Set([2]))
    expect(best.rainbow).toBe(true)
    expect(best.multiplier).toBe(MULTIPLIERS.row * RAINBOW_MULTIPLIER)
    expect(best.payoutPhp).toBe(20 * MULTIPLIERS.row * RAINBOW_MULTIPLIER)
  })

  it('selects the pattern with the highest EFFECTIVE payout, not the highest base', () => {
    // Both row0 and row1 complete (base 5× each). row0 carries a rainbow, so
    // its effective payout (10×) must beat plain row1 (5×).
    const hits = new Set([...ROW0, ...ROW1])
    const best = bestPayout(hits, 20, new Set([1])) // rare at idx1 ∈ row0
    expect(best.pattern?.index).toBe(0)
    expect(best.rainbow).toBe(true)
    expect(best.multiplier).toBe(MULTIPLIERS.row * RAINBOW_MULTIPLIER)
  })

  it('a rainbow-free higher tier still wins over a rainbow lower tier when its effective payout is greater', () => {
    // diag (base 10×) with no rainbow = 10× effective; a plain row would be
    // 5×. Doubling the row only reaches 10× — a tie the higher base keeps.
    const hits = new Set([...ROW0, ...DIAG])
    const best = bestPayout(hits, 20, new Set([]))
    expect(best.pattern?.kind).toBe('diag')
    expect(best.multiplier).toBe(MULTIPLIERS.diag)
    expect(best.rainbow).toBe(false)
  })

  it('reports no win with an empty payout when nothing completes', () => {
    const best = bestPayout(new Set([0, 1]), 20, new Set([1]))
    expect(best.pattern).toBeNull()
    expect(best.payoutPhp).toBe(0)
    expect(best.rainbow).toBe(false)
  })
})

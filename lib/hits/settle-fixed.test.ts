import { describe, it, expect } from 'vitest'
import { computeFixedSettlement, computeFixedSettlements, type FixedSettleCard } from './settle-fixed'
import type { GameEvent } from './types'

// Build a 25-cell board. `ids[i]` is the event key that lights cell i; index
// 12 is the free cell (always considered hit). Any id not in eventKeys stays
// pending. Only `id` matters for settlement, so label/category/rarity are stubs.
function board(ids: string[]): GameEvent[] {
  return Array.from({ length: 25 }, (_, i) => ({
    id: ids[i] ?? `x${i}`,
    label: `c${i}`,
    category: 'goal' as GameEvent['category'],
    rarity: 'common' as const,
  }))
}

// A board whose top row (cells 0..4) is lit by e0..e4 → completes Row 1 (5×).
const rowIds = ['e0', 'e1', 'e2', 'e3', 'e4']
const rowWinCard: FixedSettleCard = { id: 'ROW', price_php: 20, cells: board(rowIds), user_id: 'u1' }
// A board with only two of the row cells reachable → no line completes.
const loserCard: FixedSettleCard = { id: 'LOSE', price_php: 50, cells: board(['e0', 'e1']), user_id: null }

describe('computeFixedSettlement — server-authoritative fixed-odds', () => {
  const keys = new Set(['e0', 'e1', 'e2', 'e3', 'e4'])

  it('pays a completed row at 5× and records negative hold', () => {
    const o = computeFixedSettlement(rowWinCard, keys)
    expect(o.won).toBe(true)
    expect(o.winPattern).toBe('row')
    expect(o.scorePhp).toBe(20 * 5)
    expect(o.holdAmountPhp).toBe(20 - 20 * 5) // -80
    expect(o.userId).toBe('u1')
  })

  it('settles a no-win card as pure hold (house keeps the full wager)', () => {
    const o = computeFixedSettlement(loserCard, keys)
    expect(o.won).toBe(false)
    expect(o.winPattern).toBe(null)
    expect(o.scorePhp).toBe(0)
    expect(o.holdAmountPhp).toBe(50)
  })

  it('recomputes the win from cells∩events — never trusts a stale claim flag (bug #2)', () => {
    // The same completed-row board that a client never "claimed": settlement
    // must still detect the win rather than banking it as a loss.
    const o = computeFixedSettlement({ ...rowWinCard, id: 'UNCLAIMED' }, keys)
    expect(o.won).toBe(true)
    expect(o.scorePhp).toBe(100)
  })

  it('doubles a pattern that runs through a rainbow (rare) cell', () => {
    // Same winning row, but cell 2 is rare → 5× becomes 5×2 = 10×.
    const cells = board(rowIds)
    cells[2] = { ...cells[2], rarity: 'rare' }
    const o = computeFixedSettlement({ id: 'RAIN', price_php: 20, cells, user_id: null }, keys)
    expect(o.won).toBe(true)
    expect(o.scorePhp).toBe(20 * 10) // 5× row × 2 rainbow
  })

  it('a board with only the free cell hit does not win', () => {
    const o = computeFixedSettlement(loserCard, new Set<string>())
    expect(o.won).toBe(false)
    expect(o.holdAmountPhp).toBe(50)
  })

  it('conserves value per card: score + hold === wager, always', () => {
    for (const c of [rowWinCard, loserCard]) {
      const o = computeFixedSettlement(c, keys)
      expect(o.scorePhp + o.holdAmountPhp).toBe(c.price_php)
    }
  })

  it('computeFixedSettlements maps a cohort preserving order + ids', () => {
    const out = computeFixedSettlements([rowWinCard, loserCard], ['e0', 'e1', 'e2', 'e3', 'e4'])
    expect(out.map((o) => o.id)).toEqual(['ROW', 'LOSE'])
    expect(out[0].won).toBe(true)
    expect(out[1].won).toBe(false)
  })
})

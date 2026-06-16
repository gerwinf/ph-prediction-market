import { describe, test, expect } from 'vitest'
import { isAnchorDue, headroom, quoteFromBook, ANCHOR_TTL_MS } from './engine'
import type { MarketBook } from './types'

const NOW = 1_000_000_000_000

const book = (over: Partial<MarketBook> = {}): MarketBook => ({
  market_id: 'm1', p: 0.5, margin: 0.05, polymarket_slug: null,
  anchored_at: new Date(NOW).toISOString(), exposure_yes: 0, exposure_no: 0,
  cap: 100, is_stale: false, ...over,
})

describe('isAnchorDue', () => {
  test('due when never anchored', () => {
    expect(isAnchorDue(null, NOW)).toBe(true)
  })
  test('due when older than TTL', () => {
    expect(isAnchorDue(new Date(NOW - ANCHOR_TTL_MS - 1).toISOString(), NOW)).toBe(true)
  })
  test('not due when fresh', () => {
    expect(isAnchorDue(new Date(NOW - 1000).toISOString(), NOW)).toBe(false)
  })
})

describe('headroom', () => {
  test('remaining cap per side, never negative', () => {
    expect(headroom(book({ exposure_yes: 90 }), 'yes')).toBe(10)
    expect(headroom(book({ exposure_yes: 120 }), 'yes')).toBe(0)
  })
})

describe('quoteFromBook', () => {
  test('derives both multipliers and headroom from a book row', () => {
    const q = quoteFromBook(book({ exposure_yes: 40 }))
    expect(q.multiplier_yes).toBeCloseTo(1.9, 6) // (1/0.5)*0.95
    expect(q.headroom_yes).toBe(60)
    expect(q.headroom_no).toBe(100)
  })
})

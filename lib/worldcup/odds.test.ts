import { describe, it, expect } from 'vitest'
import { winnerPct, matchHomePct, allWcSlugs, type PricesMap } from './odds'

const prices: PricesMap = {
  'wc-argentina': { outcomes: [{ name: 'Yes', price: 0.21 }, { name: 'No', price: 0.79 }], is_stale: false, fetched_at: '' },
  'wc-stale': { outcomes: [{ name: 'Yes', price: 0.9 }], is_stale: true, fetched_at: '' },
  'wc-mex-rsa': { outcomes: [{ name: 'Mexico', price: 0.55 }, { name: 'Draw', price: 0.25 }, { name: 'South Africa', price: 0.20 }], is_stale: false, fetched_at: '' },
}

describe('winnerPct', () => {
  it('returns the live Yes probability as a rounded percent', () => {
    expect(winnerPct(prices, 'wc-argentina', 9)).toBe(21)
  })
  it('uses the fallback when the slug is missing', () => {
    expect(winnerPct(prices, 'wc-france', 14)).toBe(14)
  })
  it('uses the fallback when the row is stale', () => {
    expect(winnerPct(prices, 'wc-stale', 30)).toBe(30)
  })
  it('uses the fallback when slug is undefined', () => {
    expect(winnerPct(prices, undefined, 50)).toBe(50)
  })
})

describe('matchHomePct', () => {
  it('matches the home team name (case-insensitive) and returns its rounded percent', () => {
    expect(matchHomePct(prices, 'wc-mex-rsa', 'Mexico', 40)).toBe(55)
  })
  it('falls back when no outcome name contains the home team', () => {
    expect(matchHomePct(prices, 'wc-mex-rsa', 'Brazil', 40)).toBe(40)
  })
  it('falls back when slug missing/undefined', () => {
    expect(matchHomePct(prices, undefined, 'Mexico', 33)).toBe(33)
  })
})

describe('allWcSlugs', () => {
  it('collects and de-dupes defined slugs from contenders and fixtures', () => {
    const slugs = allWcSlugs(
      [{ slug: 'wc-argentina' }, { slug: 'wc-france' }],
      [{ slug: 'wc-mex-rsa' }, { slug: undefined }, { slug: 'wc-argentina' }]
    )
    expect(slugs.sort()).toEqual(['wc-argentina', 'wc-france', 'wc-mex-rsa'])
  })
})

import { describe, it, expect } from 'vitest'
import { winnerPct, matchHomePct, allWcSlugs, formatPeso, compressVol, liveVol, type PricesMap } from './odds'

const prices: PricesMap = {
  'wc-argentina': { outcomes: [{ name: 'Yes', price: 0.21 }, { name: 'No', price: 0.79 }], is_stale: false, fetched_at: '', volume_usd: 73_800_000 },
  'wc-stale': { outcomes: [{ name: 'Yes', price: 0.9 }], is_stale: true, fetched_at: '', volume_usd: 999_999 },
  'wc-mex-rsa': { outcomes: [{ name: 'Mexico', price: 0.55 }, { name: 'Draw', price: 0.25 }, { name: 'South Africa', price: 0.20 }], is_stale: false, fetched_at: '', volume_usd: 80_000 },
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
  it('uses the fallback when the first outcome is not "Yes" (misconfigured slug)', () => {
    expect(winnerPct(prices, 'wc-mex-rsa', 12)).toBe(12)
  })
  it('returns 0% (not the fallback) for a resolved-No market where price is 0', () => {
    const p: PricesMap = { 'wc-x': { outcomes: [{ name: 'Yes', price: 0 }], is_stale: false, fetched_at: '' } }
    expect(winnerPct(p, 'wc-x', 30)).toBe(0)
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
  it('falls back when the row is stale', () => {
    const p: PricesMap = { 'wc-m': { outcomes: [{ name: 'Mexico', price: 0.55 }], is_stale: true, fetched_at: '' } }
    expect(matchHomePct(p, 'wc-m', 'Mexico', 41)).toBe(41)
  })
})

describe('formatPeso', () => {
  it('formats millions with one decimal (matching existing ₱X.XM labels)', () => {
    expect(formatPeso(6_100_000)).toBe('₱6.1M')
    expect(formatPeso(4_000_000)).toBe('₱4.0M')
  })
  it('formats billions with one decimal', () => {
    expect(formatPeso(2_500_000_000)).toBe('₱2.5B')
  })
  it('formats thousands as an integer K', () => {
    expect(formatPeso(940_000)).toBe('₱940K')
  })
  it('formats sub-thousand as an integer peso amount', () => {
    expect(formatPeso(750)).toBe('₱750')
  })
})

describe('compressVol', () => {
  it('maps volume at/below the low anchor to the display floor (₱1.0M)', () => {
    expect(compressVol(100_000)).toBeCloseTo(1_000_000, 0)
    expect(compressVol(10_000)).toBe(1_000_000) // clamped
  })
  it('maps volume at/above the high anchor to the display ceiling (₱9.0M)', () => {
    expect(compressVol(100_000_000)).toBeCloseTo(9_000_000, 0)
    expect(compressVol(500_000_000)).toBe(9_000_000) // clamped
  })
  it('keeps everything inside the band and preserves ordering', () => {
    const big = compressVol(73_800_000) // WC Argentina
    const mid = compressVol(956_039) // BTC market
    const small = compressVol(216_000) // ETH market
    expect(big).toBeGreaterThan(mid)
    expect(mid).toBeGreaterThan(small)
    for (const v of [big, mid, small]) {
      expect(v).toBeGreaterThanOrEqual(1_000_000)
      expect(v).toBeLessThanOrEqual(9_000_000)
    }
  })
})

describe('liveVol', () => {
  it('renders a fresh row USD volume as a compressed peso label', () => {
    expect(liveVol(prices, 'wc-argentina', '₱4.21M')).toBe(formatPeso(compressVol(73_800_000)))
    // Real WC volume ($73.8M) lands near the ceiling, in the same band as the grid.
    expect(liveVol(prices, 'wc-argentina', '₱4.21M')).toBe('₱8.2M')
  })
  it('uses the fallback string when the row is stale', () => {
    expect(liveVol(prices, 'wc-stale', '₱5.2M')).toBe('₱5.2M')
  })
  it('uses the fallback string when the slug is missing', () => {
    expect(liveVol(prices, 'wc-france', '₱4.0M')).toBe('₱4.0M')
  })
  it('uses the fallback string when slug is undefined', () => {
    expect(liveVol(prices, undefined, '₱1.9M')).toBe('₱1.9M')
  })
  it('uses the fallback string when volume_usd is missing, null, or non-positive', () => {
    const p: PricesMap = {
      'wc-novol': { outcomes: [{ name: 'Yes', price: 0.3 }], is_stale: false, fetched_at: '' },
      'wc-nan': { outcomes: [{ name: 'Yes', price: 0.3 }], is_stale: false, fetched_at: '', volume_usd: null },
      'wc-zero': { outcomes: [{ name: 'Yes', price: 0.3 }], is_stale: false, fetched_at: '', volume_usd: 0 },
    }
    expect(liveVol(p, 'wc-novol', '₱2.0M')).toBe('₱2.0M')
    expect(liveVol(p, 'wc-nan', '₱2.0M')).toBe('₱2.0M')
    expect(liveVol(p, 'wc-zero', '₱2.0M')).toBe('₱2.0M')
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

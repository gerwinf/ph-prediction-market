import { describe, test, expect } from 'vitest'
import { selectSlugsToRefresh, buildMirrorRow, PRICE_TTL_MS } from './refresh'

const KNOWN = {
  'wc-arg-alg': 'Argentina Algeria World Cup',
  'nba-okc-sas': 'Thunder Spurs NBA',
}
const NOW = 1_000_000_000_000 // fixed clock

describe('selectSlugsToRefresh', () => {
  test('includes a known slug that has never been fetched', () => {
    const result = selectSlugsToRefresh(['wc-arg-alg'], KNOWN, {}, NOW)
    expect(result).toEqual(['wc-arg-alg'])
  })

  test('includes a known slug whose row is older than the TTL', () => {
    const old = new Date(NOW - PRICE_TTL_MS - 1).toISOString()
    const result = selectSlugsToRefresh(['wc-arg-alg'], KNOWN, { 'wc-arg-alg': old }, NOW)
    expect(result).toEqual(['wc-arg-alg'])
  })

  test('excludes a known slug whose row is still fresh', () => {
    const fresh = new Date(NOW - 1000).toISOString()
    const result = selectSlugsToRefresh(['wc-arg-alg'], KNOWN, { 'wc-arg-alg': fresh }, NOW)
    expect(result).toEqual([])
  })

  test('excludes an unknown slug (no query to refresh it with)', () => {
    const result = selectSlugsToRefresh(['pba-tnt-mer'], KNOWN, {}, NOW)
    expect(result).toEqual([])
  })
})

const NOW_ISO = '2026-06-04T00:00:00.000Z'

describe('buildMirrorRow', () => {
  test('builds a fresh, non-stale row from a fetched price', () => {
    const fresh = {
      query: 'Argentina Algeria World Cup',
      marketId: 'mkt-1',
      question: 'ARG vs ALG',
      outcomes: [{ name: 'Argentina', price: 0.78 }, { name: 'Algeria', price: 0.22 }],
      volumeUsd: 50000,
    }
    const row = buildMirrorRow('wc-arg-alg', fresh, undefined, NOW_ISO)
    expect(row).toEqual({
      event_slug: 'wc-arg-alg',
      source: 'polymarket',
      market_id: 'mkt-1',
      question: 'ARG vs ALG',
      outcomes: fresh.outcomes,
      volume_usd: 50000,
      fetched_at: NOW_ISO,
      is_stale: false,
    })
  })

  test('on fetch failure with a prior row: marks stale but preserves prior outcomes', () => {
    const prior = {
      event_slug: 'wc-arg-alg',
      source: 'polymarket',
      market_id: 'mkt-1',
      question: 'ARG vs ALG',
      outcomes: [{ name: 'Argentina', price: 0.78 }],
      volume_usd: 50000,
      is_stale: false,
      fetched_at: '2026-06-03T00:00:00.000Z',
    }
    const row = buildMirrorRow('wc-arg-alg', undefined, prior, NOW_ISO)
    expect(row.is_stale).toBe(true)
    expect(row.outcomes).toEqual(prior.outcomes)
    expect(row.market_id).toBe('mkt-1')
    expect(row.fetched_at).toBe(NOW_ISO)
  })

  test('on fetch failure with no prior row: stale shell with empty outcomes', () => {
    const row = buildMirrorRow('wc-arg-alg', undefined, undefined, NOW_ISO)
    expect(row.is_stale).toBe(true)
    expect(row.outcomes).toEqual([])
    expect(row.market_id).toBe('')
    expect(row.volume_usd).toBeNull()
  })
})

import { describe, it, expect } from 'vitest'
import { getFixtureById, fixtureVolLabel, resolutionText } from './market'
import type { Fixture } from './state'
import type { PricesMap } from './odds'

const fx: Fixture = {
  id: 'wc-tun-ned',
  home: { name: 'Tunisia', iso: 'tn' },
  away: { name: 'Netherlands', iso: 'nl' },
  group: 'F',
  kickoffISO: '2026-06-25T23:00:00.000Z',
  fallback: { home: 16, draw: 26, away: 58 },
}

describe('getFixtureById', () => {
  it('finds a fixture by id', () => {
    expect(getFixtureById([fx], 'wc-tun-ned')).toBe(fx)
  })
  it('returns null when not found', () => {
    expect(getFixtureById([fx], 'nope')).toBeNull()
  })
  it('returns null for an empty list', () => {
    expect(getFixtureById([], 'wc-tun-ned')).toBeNull()
  })
})

describe('fixtureVolLabel', () => {
  it('uses live Polymarket volume when the slug resolves fresh', () => {
    const prices: PricesMap = {
      'wc-x': { outcomes: [{ name: 'Yes', price: 0.5 }], is_stale: false, fetched_at: 'now', volume_usd: 5_000_000 },
    }
    const out = fixtureVolLabel(prices, { ...fx, slug: 'wc-x' })
    expect(out.live).toBe(true)
    expect(out.label.startsWith('₱')).toBe(true)
  })
  it('falls back to a deterministic indicative label when there is no slug', () => {
    const out = fixtureVolLabel({}, fx)
    expect(out.live).toBe(false)
    expect(out.label.startsWith('₱')).toBe(true)
  })
  it('is deterministic for the same fixture', () => {
    expect(fixtureVolLabel({}, fx).label).toBe(fixtureVolLabel({}, fx).label)
  })
})

describe('resolutionText', () => {
  it('names both teams', () => {
    const t = resolutionText(fx)
    expect(t).toContain('Tunisia')
    expect(t).toContain('Netherlands')
  })
})

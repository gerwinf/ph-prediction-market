import { describe, test, expect } from 'vitest'
import { mapPolymarketEventToCandidate } from './signal-polymarket'

const NOW = Date.UTC(2026, 5, 9) // fixed clock for deterministic ends-soon math
const DAY = 24 * 60 * 60 * 1000

function isoFromNow(days: number): string {
  return new Date(NOW + days * DAY).toISOString()
}

/** A well-formed Gamma event with one parseable Yes/No market. */
function event(overrides: Record<string, unknown> = {}) {
  return {
    slug: 'nba-knicks-2026',
    title: 'Will the Knicks win the 2026 NBA Finals?',
    category: 'Sports',
    volume: 2_000_000,
    endDate: isoFromNow(60), // far out by default → no ends-soon bonus
    markets: [
      {
        id: '553858',
        question: 'Knicks win the 2026 NBA Finals?',
        outcomes: '["Yes","No"]',
        outcomePrices: '["0.78","0.22"]',
        volume: 2_000_000,
      },
    ],
    ...overrides,
  }
}

describe('mapPolymarketEventToCandidate', () => {
  test('returns null below the $50k volume floor', () => {
    expect(mapPolymarketEventToCandidate(event({ volume: 40_000 }), NOW)).toBeNull()
  })

  test('returns null when no market is parseable', () => {
    const bad = event({
      markets: [{ id: '1', question: 'q', outcomes: '["Yes","No"]', outcomePrices: '["x"]', volume: 1 }],
    })
    expect(mapPolymarketEventToCandidate(bad, NOW)).toBeNull()
  })

  test('maps a sports event to a candidate binary market', () => {
    const c = mapPolymarketEventToCandidate(event(), NOW)!
    expect(c).not.toBeNull()
    expect(c.kind).toBe('binary')
    expect(c.status).toBe('candidate')
    expect(c.source).toBe('signal:polymarket')
    expect(c.title).toBe('Will the Knicks win the 2026 NBA Finals?')
    expect(c.category).toBe('sports')
    expect(c.payload.categories).toContain('sports')
    expect(c.payload.fallback_pct).toBe(78)
    expect(c.payload.polymarket_slug).toBe('nba-knicks-2026')
    expect(c.payload.polymarket_market_id).toBe('553858')
  })

  test('interest score = volume component + sports weight (far-out end)', () => {
    // vol 2e6 → log10(2e6/1e4)=2.301 *20 ≈ 46; +15 sports; +0 (ends in 60d)
    const c = mapPolymarketEventToCandidate(event(), NOW)!
    expect(c.interestScore).toBe(46 + 15)
  })

  test('adds the +15 ends-soon bonus when the event ends within 30 days', () => {
    const c = mapPolymarketEventToCandidate(event({ endDate: isoFromNow(10) }), NOW)!
    expect(c.interestScore).toBe(46 + 15 + 15)
  })

  // Neutral title so these isolate the Gamma `category` field (classification
  // keys on category AND title; a sporty title would otherwise dominate).
  const NEUTRAL = 'Will this resolve yes by Dec 31, 2026?'

  test('clamps the volume component at 50', () => {
    // huge volume, "other" category (weight 0), far-out end → score is just the clamp
    const c = mapPolymarketEventToCandidate(
      event({ volume: 50_000_000, category: 'Mentions', title: NEUTRAL, endDate: isoFromNow(60) }),
      NOW,
    )!
    expect(c.interestScore).toBe(50)
    expect(c.category).toBe('trending')
  })

  test('classifies crypto and weather with a +5 weight', () => {
    const crypto = mapPolymarketEventToCandidate(event({ category: 'Crypto', title: NEUTRAL }), NOW)!
    expect(crypto.category).toBe('crypto')
    expect(crypto.interestScore).toBe(46 + 5)

    const weather = mapPolymarketEventToCandidate(event({ category: 'Weather', title: NEUTRAL }), NOW)!
    expect(weather.category).toBe('weather')
    expect(weather.interestScore).toBe(46 + 5)
  })

  test('classifies politics to the world tab with a +10 weight', () => {
    const c = mapPolymarketEventToCandidate(event({ category: 'Politics', title: NEUTRAL }), NOW)!
    expect(c.category).toBe('world')
    expect(c.interestScore).toBe(46 + 10)
  })
})

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

/** A multi-outcome event ("what price will X hit") with bucket sub-markets. */
function multiEvent(overrides: Record<string, unknown> = {}) {
  return {
    slug: 'what-price-will-bitcoin-hit-in-june-2026',
    title: 'What price will Bitcoin hit in June?',
    category: 'Crypto',
    volume: 11_100_000,
    endDate: isoFromNow(20),
    markets: [
      { id: 'btc100', slug: 'btc-100k', question: 'Will Bitcoin reach $100,000 in June?', outcomes: '["Yes","No"]', outcomePrices: '["0.0035","0.9965"]', volume: 1_351_203 },
      { id: 'btcdip', slug: 'btc-dip-575', question: 'Will Bitcoin dip to $57,500 in June?', outcomes: '["Yes","No"]', outcomePrices: '["0.51","0.49"]', volume: 1_029_245 },
      { id: 'btc90', slug: 'btc-90k', question: 'Will Bitcoin reach $90,000 in June?', outcomes: '["Yes","No"]', outcomePrices: '["0.0075","0.9925"]', volume: 236_721 },
    ],
    ...overrides,
  }
}

describe('mapPolymarketEventToCandidate — multi-outcome events', () => {
  test('picks the most-balanced bucket and uses ITS question as the title', () => {
    const c = mapPolymarketEventToCandidate(multiEvent(), NOW)!
    expect(c).not.toBeNull()
    expect(c.title).toBe('Will Bitcoin dip to $57,500 in June?') // Yes 0.51, closest to 50%
    expect(c.payload.fallback_pct).toBe(51)
    expect(c.payload.polymarket_market_id).toBe('btcdip')
    expect(c.payload.polymarket_slug).toBe('btc-dip-575')
    expect(c.category).toBe('crypto')
  })

  test('drops the event when every bucket is extreme (no meaningful binary)', () => {
    const allExtreme = multiEvent({
      markets: [
        { id: 'a', question: 'Will Bitcoin reach $100,000 in June?', outcomes: '["Yes","No"]', outcomePrices: '["0.003","0.997"]', volume: 900_000 },
        { id: 'b', question: 'Will Bitcoin reach $90,000 in June?', outcomes: '["Yes","No"]', outcomePrices: '["0.02","0.98"]', volume: 800_000 },
      ],
    })
    expect(mapPolymarketEventToCandidate(allExtreme, NOW)).toBeNull()
  })
})

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

  test('returns null for a resolved event (closed=true)', () => {
    expect(mapPolymarketEventToCandidate(event({ closed: true }), NOW)).toBeNull()
  })

  test('returns null for an event whose endDate has already passed', () => {
    expect(mapPolymarketEventToCandidate(event({ endDate: isoFromNow(-1) }), NOW)).toBeNull()
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

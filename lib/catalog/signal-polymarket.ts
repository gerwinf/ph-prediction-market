/**
 * Polymarket trending → catalog candidate (pure mapping).
 *
 * Given one Gamma `/events` event, produce a `binary` candidate market for the
 * curation queue (or null to drop it). Pure and deterministic — the cron route
 * supplies `nowMs`, so this is unit-testable like `parseMarket`.
 *
 * Drops events below a $50k volume floor and events with no parseable Yes/No
 * market. The interest score biases PH-relevant, soon-resolving, liquid markets
 * toward the top of the queue — but a human still approves/rejects each one.
 */
import { parseMarket } from '../oracle/polymarket'
import type { BinaryPayload } from './types'

const VOLUME_FLOOR_USD = 50_000
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export type SignalCandidate = {
  kind: 'binary'
  category: string
  title: string
  status: 'candidate'
  source: 'signal:polymarket'
  interestScore: number
  payload: BinaryPayload
}

/**
 * Landing tab + score weight for an event, biasing PH-relevant categories up.
 * Keyword match runs against the Gamma `category` plus the event title.
 */
function classify(category: string, title: string): { tab: string; weight: number } {
  const hay = `${category} ${title}`.toLowerCase()
  const has = (...words: string[]) => words.some((w) => hay.includes(w))

  if (has('sport', 'nba', 'nfl', 'soccer', 'football', 'boxing', 'basketball', 'world cup', 'ufc'))
    return { tab: 'sports', weight: 15 }
  if (has('politic', 'election', 'president', 'senate', 'war', 'geopolitic', 'government'))
    return { tab: 'world', weight: 10 }
  if (has('culture', 'music', 'movie', 'celebrity', 'award', 'tv', 'pop'))
    return { tab: 'popcult', weight: 10 }
  if (has('crypto', 'bitcoin', 'btc', 'ethereum', 'eth', 'token', 'coin'))
    return { tab: 'crypto', weight: 5 }
  if (has('weather', 'temperature', 'hurricane', 'storm', 'climate'))
    return { tab: 'weather', weight: 5 }
  return { tab: 'trending', weight: 0 }
}

/** Volume component of the score: clamp(log10(vol/10k) * 20, 0, 50). */
function volumeScore(volumeUsd: number): number {
  if (volumeUsd <= 0) return 0
  const raw = Math.round(Math.log10(volumeUsd / 10_000) * 20)
  return Math.max(0, Math.min(50, raw))
}

/** '$1.2M' / '$120K' / '$900' style label for a USD volume. */
function formatUsdVol(volumeUsd: number): string {
  if (volumeUsd >= 1_000_000) return `$${(volumeUsd / 1_000_000).toFixed(1)}M`
  if (volumeUsd >= 1_000) return `$${Math.round(volumeUsd / 1_000)}K`
  return `$${Math.round(volumeUsd)}`
}

export function mapPolymarketEventToCandidate(event: unknown, nowMs: number): SignalCandidate | null {
  if (!event || typeof event !== 'object') return null
  const e = event as Record<string, unknown>

  const volumeUsd = Number(e.volume)
  if (!Number.isFinite(volumeUsd) || volumeUsd < VOLUME_FLOOR_USD) return null

  const markets = Array.isArray(e.markets) ? e.markets : []
  if (markets.length === 0) return null

  const title = typeof e.title === 'string' ? e.title : ''
  if (!title) return null

  // Drop resolved / past events. Polymarket's `active=true` does NOT exclude
  // resolved markets, and all-time-volume ordering surfaces huge historical
  // ones (2024 US election, last season's UCL/Premier League). Belt-and-
  // suspenders alongside the `closed=false` query param.
  if (e.closed === true) return null
  if (typeof e.endDate === 'string') {
    const end = new Date(e.endDate).getTime()
    if (Number.isFinite(end) && end < nowMs) return null
  }

  // Parse every sub-market, keeping the raw alongside (we need its own question
  // and slug for multi-outcome events).
  const candidates = markets
    .map((m) => ({ raw: m as Record<string, unknown>, parsed: parseMarket(m, title, { skipVolumeFloor: true }) }))
    .filter((c): c is { raw: Record<string, unknown>; parsed: NonNullable<typeof c.parsed> } => c.parsed !== null)
  if (candidates.length === 0) return null

  const yesOf = (c: (typeof candidates)[number]) => c.parsed.outcomes[0]?.price ?? 0
  const isMulti = markets.length > 1

  // Single-market event: the event title IS the yes/no question — keep it.
  // Multi-outcome event ("what price will X hit", "who wins"): each sub-market
  // is one bucket. Pick the most *balanced* bucket (Yes closest to 50% — the
  // most interesting line) and use ITS own question, so the title and price
  // agree instead of pairing a scalar title with a stray near-0 bucket.
  const chosen = isMulti
    ? candidates.reduce((best, c) => (Math.abs(yesOf(c) - 0.5) < Math.abs(yesOf(best) - 0.5) ? c : best))
    : [...candidates].sort((a, b) => Number(b.raw.volume ?? 0) - Number(a.raw.volume ?? 0))[0]

  const yesPrice = yesOf(chosen)

  // Drop multi-outcome events with no meaningful binary (every bucket near 0/100
  // — e.g. far-out price strikes). A genuine single binary at any price is fine.
  if (isMulti && (yesPrice < 0.05 || yesPrice > 0.95)) return null

  const cardTitle = isMulti && typeof chosen.raw.question === 'string' ? chosen.raw.question : title
  const marketSlug =
    isMulti && typeof chosen.raw.slug === 'string'
      ? chosen.raw.slug
      : typeof e.slug === 'string'
        ? e.slug
        : undefined

  const category = typeof e.category === 'string' ? e.category : ''
  const { tab, weight } = classify(category, cardTitle)

  let endsSoon = false
  if (typeof e.endDate === 'string') {
    const diff = new Date(e.endDate).getTime() - nowMs
    endsSoon = Number.isFinite(diff) && diff >= 0 && diff <= THIRTY_DAYS_MS
  }

  const interestScore = volumeScore(volumeUsd) + (endsSoon ? 15 : 0) + weight

  const payload: BinaryPayload = {
    categories: [tab],
    cat: tab.charAt(0).toUpperCase() + tab.slice(1),
    fallback_pct: Math.round(yesPrice * 100),
    vol_label: formatUsdVol(volumeUsd),
    polymarket_market_id: chosen.parsed.marketId,
    ...(marketSlug ? { polymarket_slug: marketSlug } : {}),
  }

  return {
    kind: 'binary',
    category: tab,
    title: cardTitle,
    status: 'candidate',
    source: 'signal:polymarket',
    interestScore,
    payload,
  }
}

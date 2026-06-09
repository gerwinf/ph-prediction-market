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

  // Pick the most-liquid market that parses to a usable Yes/No price. The event
  // volume already cleared our floor, so individual market volume is ignored.
  const parsed = [...markets]
    .sort((a, b) => Number((b as Record<string, unknown>)?.volume ?? 0) - Number((a as Record<string, unknown>)?.volume ?? 0))
    .map((m) => parseMarket(m, title, { skipVolumeFloor: true }))
    .find((p) => p !== null)
  if (!parsed) return null

  const category = typeof e.category === 'string' ? e.category : ''
  const { tab, weight } = classify(category, title)

  let endsSoon = false
  if (typeof e.endDate === 'string') {
    const diff = new Date(e.endDate).getTime() - nowMs
    endsSoon = Number.isFinite(diff) && diff >= 0 && diff <= THIRTY_DAYS_MS
  }

  const interestScore = volumeScore(volumeUsd) + (endsSoon ? 15 : 0) + weight

  const slug = typeof e.slug === 'string' ? e.slug : undefined
  const payload: BinaryPayload = {
    categories: [tab],
    cat: tab.charAt(0).toUpperCase() + tab.slice(1),
    fallback_pct: Math.round((parsed.outcomes[0]?.price ?? 0) * 100),
    vol_label: formatUsdVol(volumeUsd),
    polymarket_market_id: parsed.marketId,
    ...(slug ? { polymarket_slug: slug } : {}),
  }

  return {
    kind: 'binary',
    category: tab,
    title,
    status: 'candidate',
    source: 'signal:polymarket',
    interestScore,
    payload,
  }
}

/**
 * Lazy-refresh policy for mirror_prices.
 *
 * We can't run a sub-daily cron (Vercel Hobby caps cron at once-per-day), so
 * /api/prices refreshes on read: when a requested slug's cached row is missing
 * or older than the TTL, we re-fetch from Polymarket and upsert. This module
 * holds the pure decision of *which* requested slugs are due for a refresh.
 */

import type { MirrorPrice } from './polymarket'

export const PRICE_TTL_MS = 10 * 60 * 1000 // 10 minutes

export type MirrorRow = {
  event_slug: string
  source: string
  market_id: string
  question: string
  outcomes: unknown
  volume_usd: number | null
  fetched_at: string
  is_stale: boolean
}

/**
 * Build the mirror_prices row to upsert for a slug. When `fresh` is present,
 * the row is current and non-stale. When the fetch failed (`fresh` undefined),
 * the row is marked stale but preserves the prior outcomes/metadata if any —
 * so a transient Polymarket outage never blanks a previously-known price.
 */
export function buildMirrorRow(
  slug: string,
  fresh: MirrorPrice | undefined,
  prior: Partial<MirrorRow> | undefined,
  nowIso: string,
): MirrorRow {
  if (fresh) {
    return {
      event_slug: slug,
      source: 'polymarket',
      market_id: fresh.marketId,
      question: fresh.question,
      outcomes: fresh.outcomes,
      volume_usd: fresh.volumeUsd,
      fetched_at: nowIso,
      is_stale: false,
    }
  }
  return {
    event_slug: slug,
    source: 'polymarket',
    market_id: prior?.market_id ?? '',
    question: prior?.question ?? '',
    outcomes: prior?.outcomes ?? [],
    volume_usd: prior?.volume_usd ?? null,
    fetched_at: nowIso,
    is_stale: true,
  }
}

/**
 * Of the requested slugs, return those that are refreshable (have a known
 * Polymarket query) AND are due (never fetched, or older than the TTL).
 *
 * @param fetchedAt slug → last fetched_at ISO string (absent if no row)
 */
export function selectSlugsToRefresh(
  requested: string[],
  known: Record<string, unknown>,
  fetchedAt: Record<string, string | null | undefined>,
  now: number,
  ttlMs: number = PRICE_TTL_MS,
): string[] {
  return requested.filter((slug) => {
    if (!(slug in known)) return false
    const ts = fetchedAt[slug]
    if (!ts) return true
    return now - new Date(ts).getTime() >= ttlMs
  })
}

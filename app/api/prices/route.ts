/**
 * GET /api/prices?events=wc-arg-alg,nba-okc-sas
 *
 * Returns imported Polymarket reference prices for the requested event slugs:
 *
 *   { "wc-arg-alg": { outcomes, is_stale, fetched_at }, ... }
 *
 * Public — prices are non-sensitive. Lazy refresh: a requested slug whose
 * cached mirror_prices row is missing or older than the TTL is re-fetched from
 * Polymarket inline and upserted. (No cron — Vercel Hobby caps cron at
 * once-per-day; the table is the cache.) Unknown slugs are simply omitted, so
 * an all-unknown request returns {} (never 404).
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../lib/supabase/admin'
import { SLUG_TO_QUERY } from '../../../lib/oracle/slugs'
import { fetchPolymarketPrices } from '../../../lib/oracle/polymarket'
import { selectSlugsToRefresh, buildMirrorRow } from '../../../lib/oracle/refresh'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type Row = {
  event_slug: string
  source: string
  market_id: string
  question: string
  outcomes: unknown
  volume_usd: number | null
  is_stale: boolean
  fetched_at: string
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const slugs = (url.searchParams.get('events') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (slugs.length === 0) return NextResponse.json({})

  const admin = createAdminClient()

  const { data: existing, error: readErr } = await admin
    .from('mirror_prices')
    .select('event_slug, source, market_id, question, outcomes, volume_usd, is_stale, fetched_at')
    .in('event_slug', slugs)
    .eq('source', 'polymarket')

  if (readErr) {
    return NextResponse.json({ error: 'db_read_failed', message: readErr.message }, { status: 500 })
  }

  const bySlug = new Map<string, Row>((existing ?? []).map((r) => [r.event_slug as string, r as Row]))
  const fetchedAt = Object.fromEntries(slugs.map((s) => [s, bySlug.get(s)?.fetched_at ?? null]))

  const toRefresh = selectSlugsToRefresh(slugs, SLUG_TO_QUERY, fetchedAt, Date.now())

  if (toRefresh.length > 0) {
    const prices = await fetchPolymarketPrices(toRefresh.map((s) => SLUG_TO_QUERY[s]))
    const byQuery = new Map(prices.map((p) => [p.query, p]))
    const nowIso = new Date().toISOString()

    const upserts = toRefresh.map((slug) =>
      buildMirrorRow(slug, byQuery.get(SLUG_TO_QUERY[slug]), bySlug.get(slug), nowIso),
    )

    const { error: upsertErr } = await admin
      .from('mirror_prices')
      .upsert(upserts, { onConflict: 'event_slug,source' })

    if (upsertErr) {
      // Non-fatal: fall back to whatever we already had cached.
      console.error('[prices] upsert failed:', upsertErr.message)
    } else {
      for (const u of upserts) bySlug.set(u.event_slug, u)
    }
  }

  const response: Record<string, { outcomes: unknown; is_stale: boolean; fetched_at: string }> = {}
  for (const slug of slugs) {
    const r = bySlug.get(slug)
    if (r) response[slug] = { outcomes: r.outcomes, is_stale: r.is_stale, fetched_at: r.fetched_at }
  }

  return NextResponse.json(response)
}

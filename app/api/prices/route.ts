/**
 * GET /api/prices?events=wc-argentina,wc-france
 *
 * Returns imported Polymarket reference prices for the requested event slugs:
 *
 *   { "wc-argentina": { outcomes, is_stale, fetched_at }, ... }
 *
 * Public — prices are non-sensitive. Lazy refresh: a requested slug whose
 * cached mirror_prices row is missing or older than the TTL is re-fetched from
 * Polymarket (by pinned market id) inline and upserted. (No cron — Vercel Hobby
 * caps cron at once-per-day; the table is the cache.) Slugs without a pinned id
 * in LIVE_MARKETS are simply omitted, so an all-unknown request returns {}
 * (never 404) — and never a wrong search hit.
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../lib/supabase/admin'
import { LIVE_MARKETS } from '../../../lib/oracle/slugs'
import { fetchPolymarketById } from '../../../lib/oracle/polymarket'
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

  const toRefresh = selectSlugsToRefresh(slugs, LIVE_MARKETS, fetchedAt, Date.now())

  if (toRefresh.length > 0) {
    // Prices resolve ONLY by pinned Gamma id (reliable). Slugs without a pinned
    // id never reach here (filtered out by selectSlugsToRefresh against
    // LIVE_MARKETS) — they keep their fallback rather than a wrong search hit.
    const idPrices = await fetchPolymarketById(
      toRefresh.map((s) => ({ slug: s, marketId: LIVE_MARKETS[s].id })),
    )

    const bySlugResult = new Map(idPrices.map((p) => [p.query, p]))
    const nowIso = new Date().toISOString()

    const upserts = toRefresh.map((slug) =>
      buildMirrorRow(slug, bySlugResult.get(slug), bySlug.get(slug), nowIso),
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

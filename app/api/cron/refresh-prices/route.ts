/**
 * GET /api/cron/refresh-prices
 *
 * Manual / warm-up trigger that force-refreshes EVERY known mirror-price slug
 * from Polymarket, ignoring the TTL. Not wired to a Vercel cron schedule:
 * Hobby tier caps cron at once-per-day, so the live refresh path is lazy-on-
 * read in /api/prices. This endpoint exists to pre-warm the cache and for
 * testing:
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/refresh-prices
 *
 * Auth: CRON_SECRET header. Reject anything else with 401.
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { LIVE_MARKETS } from '../../../../lib/oracle/slugs'
import { fetchPolymarketById } from '../../../../lib/oracle/polymarket'
import { buildMirrorRow, type MirrorRow } from '../../../../lib/oracle/refresh'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json({ ok: false, error: 'cron_secret_unset' }, { status: 500 })
  }
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const slugs = Object.keys(LIVE_MARKETS)

  // Pull prior rows so a failed fetch preserves the last known value.
  const { data: existing } = await admin
    .from('mirror_prices')
    .select('event_slug, source, market_id, question, outcomes, volume_usd, is_stale, fetched_at')
    .in('event_slug', slugs)
    .eq('source', 'polymarket')
  const bySlug = new Map<string, Partial<MirrorRow>>(
    (existing ?? []).map((r) => [r.event_slug as string, r as Partial<MirrorRow>]),
  )

  const idPrices = await fetchPolymarketById(
    Object.entries(LIVE_MARKETS).map(([slug, m]) => ({ slug, marketId: m.id })),
  )
  const byResult = new Map(idPrices.map((p) => [p.query, p]))
  const nowIso = new Date().toISOString()

  const rows = slugs.map((slug) =>
    buildMirrorRow(slug, byResult.get(slug), bySlug.get(slug), nowIso),
  )

  const { error: upsertErr } = await admin
    .from('mirror_prices')
    .upsert(rows, { onConflict: 'event_slug,source' })

  if (upsertErr) {
    return NextResponse.json(
      { ok: false, error: 'db_upsert_failed', message: upsertErr.message },
      { status: 500 },
    )
  }

  const refreshed = rows.filter((r) => !r.is_stale).map((r) => r.event_slug)
  const stale = rows.filter((r) => r.is_stale).map((r) => r.event_slug)
  return NextResponse.json({ ok: true, refreshed, stale })
}

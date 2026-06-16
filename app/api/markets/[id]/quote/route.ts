/**
 * GET /api/markets/[id]/quote
 *
 * Current house odds for a binary market: YES probability `p` and both decimal
 * multipliers + remaining exposure headroom. Lazy-anchors `p` to the Polymarket
 * reference on read when the anchor is older than the TTL (reuses the
 * mirror_prices feed; no cron — Vercel Hobby caps cron at once-per-day). A
 * market with no `market_book` row returns 404.
 *
 * Public — quotes are non-sensitive.
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../../lib/supabase/admin'
import { isAnchorDue, quoteFromBook } from '../../../../../lib/mm/engine'
import { anchorPrice } from '../../../../../lib/mm/odds'
import type { MarketBook } from '../../../../../lib/mm/types'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const admin = createAdminClient()

  const { data: book, error } = await admin
    .from('market_book')
    .select('*')
    .eq('market_id', id)
    .maybeSingle()
  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error', message: error.message }, { status: 500 })
  }
  if (!book) return NextResponse.json({ ok: false, error: 'no_book' }, { status: 404 })

  let b = book as MarketBook
  if (b.polymarket_slug && isAnchorDue(b.anchored_at, Date.now())) {
    // Reuse the existing lazy Polymarket refresh: read mirror_prices for the slug.
    const { data: mp } = await admin
      .from('mirror_prices')
      .select('outcomes, is_stale')
      .eq('event_slug', b.polymarket_slug)
      .eq('source', 'polymarket')
      .maybeSingle()
    const ref = pickYesPrice(mp?.outcomes)
    const next = anchorPrice(ref, b.p)
    const isStale = !!mp?.is_stale || ref == null
    await admin
      .from('market_book')
      .update({ p: next, anchored_at: new Date().toISOString(), is_stale: isStale })
      .eq('market_id', id)
    b = { ...b, p: next, is_stale: isStale }
  }

  return NextResponse.json({ ok: true, quote: quoteFromBook(b) })
}

/** First outcome ("Yes") price from a mirror_prices.outcomes array, or null. */
function pickYesPrice(outcomes: unknown): number | null {
  if (!Array.isArray(outcomes) || outcomes.length === 0) return null
  const first = outcomes[0] as { price?: number }
  return typeof first?.price === 'number' ? first.price : null
}

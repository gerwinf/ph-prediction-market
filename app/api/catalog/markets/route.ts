/**
 * GET /api/catalog/markets
 *
 * Public. Returns approved/live binary markets from the catalog, grouped by
 * each landing tab listed in `payload.categories`, ordered by interest_score
 * (descending) within each tab.
 *
 *   { ok: true, byCategory: { sports: [CatalogBinaryMarket, ...], ... } }
 *
 * An empty catalog returns `{ ok: true, byCategory: {} }` — the landing page
 * keeps its hardcoded grid (see app/page.tsx). On a read failure the adapter
 * also yields `[]`, so the response stays `{ ok: true, byCategory: {} }`.
 */
import { NextResponse } from 'next/server'
import { fetchApprovedBinaryMarkets } from '../../../../lib/catalog/read'
import type { CatalogBinaryMarket } from '../../../../lib/catalog/types'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET() {
  const markets = await fetchApprovedBinaryMarkets()

  // markets arrive already sorted by interest_score desc; grouping preserves
  // that order, so each tab's array is highest-interest first.
  const byCategory: Record<string, CatalogBinaryMarket[]> = {}
  for (const m of markets) {
    const tabs = Array.isArray(m.payload?.categories) ? m.payload.categories : []
    for (const tab of tabs) {
      ;(byCategory[tab] ??= []).push(m)
    }
  }

  return NextResponse.json({ ok: true, byCategory })
}

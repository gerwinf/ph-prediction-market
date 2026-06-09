/**
 * GET /api/cron/maintain-catalog
 *
 * Daily catalog maintenance (wired to a once-a-day Vercel cron in vercel.json —
 * daily is plenty for a market catalog, and Hobby allows one cron/day). Runs:
 *   1. ingest    — pull trending Polymarket events into the candidate queue
 *   2. reprice   — refresh fallback_pct for approved markets with a pinned id
 *   3. retire    — close approved/live markets past their closes_at deadline
 *
 * Each step is independent; a failure in one is reported but doesn't block the
 * others. Auth: Authorization: Bearer $CRON_SECRET (Vercel cron sends this
 * automatically when CRON_SECRET is set).
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { ingestSignals, refreshApprovedPrices, retireEndedMarkets } from '../../../../lib/catalog/maintain'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json({ ok: false, error: 'cron_secret_unset' }, { status: 500 })
  }
  if (req.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = Date.now()
  const out: Record<string, unknown> = { ok: true }

  // Run each step independently — one failing shouldn't skip the rest.
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      out[name] = await fn()
    } catch (e) {
      out[name] = { error: e instanceof Error ? e.message : 'unknown' }
    }
  }

  await step('ingest', () => ingestSignals(admin, now))
  await step('reprice', () => refreshApprovedPrices(admin))
  await step('retire', () => retireEndedMarkets(admin, now))

  return NextResponse.json(out)
}

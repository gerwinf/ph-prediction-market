/**
 * GET /api/cron/maintain-catalog
 *
 * Daily catalog maintenance (wired to a once-a-day Vercel cron in vercel.json —
 * daily is plenty for a market catalog, and Hobby allows one cron/day). Runs:
 *   1. ingest    — pull trending Polymarket events into the candidate queue
 *   2. reprice   — refresh fallback_pct for approved markets with a pinned id
 *   3. retire    — close approved/live markets past their closes_at deadline
 *   4. pba        — pull the next PBA game from pba.ph → match_fixtures
 *
 * Each step is independent; a failure in one is reported but doesn't block the
 * others. Auth: Authorization: Bearer $CRON_SECRET (Vercel cron sends this
 * automatically when CRON_SECRET is set).
 */
import { NextResponse } from 'next/server'
import { finalizeStaleLiveFixtures, sweepUnsettledFixtures } from '../../../../lib/hits/settle'
import { ingestUpcomingWcFixtures } from '../../../../lib/hits/fixture-ingest'
import { refreshWcFixtures } from '../../../../lib/worldcup/fixture-refresh'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { ingestSignals, refreshApprovedPrices, retireEndedMarkets } from '../../../../lib/catalog/maintain'
import { fetchPbaSchedule } from '../../../../lib/fixtures/fetch-pba'
import { ingestPbaFixtures } from '../../../../lib/fixtures/maintain'

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
  await step('pba', async () => ingestPbaFixtures(admin, await fetchPbaSchedule(), now))

  // Finalize games stranded at status='live' (no live→final trigger fired —
  // PBA is ops-only, WC's FIFA sync needs an open card page). Runs BEFORE the
  // settlement sweep so the freshly-final rows settle in the same pass, and so
  // /hits stops pinning its hero to a game that ended hours ago.
  await step('finalize_stale_live', () => finalizeStaleLiveFixtures())

  // Settlement catch-up (CEO review 1A trigger #3): shadow-settle any
  // final fixture the lazy triggers missed; warns on settlement_lag >1h.
  await step('settlement_sweep', () => sweepUnsettledFixtures())

  // /hits fixture auto-ingest: create match_fixtures rows for upcoming WC
  // games with both squads registered — the pre-buy funnel (66% of card
  // buys) must never run dry on a missing manual insert. Insert-only.
  await step('wc_fixture_ingest', () => ingestUpcomingWcFixtures())

  // /worldcup board auto-refresh: roll the FIFA-fed wc_fixture catalog rows
  // forward (insert new + prune past), the same way /hits keeps match_fixtures
  // current. Insert-only, so ops odds overrides in /ops/markets survive.
  await step('wc_board_refresh', () => refreshWcFixtures())

  return NextResponse.json(out)
}

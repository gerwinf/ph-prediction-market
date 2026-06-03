/**
 * GET /api/ops/ggr?operator=hula&days=30&target=10000
 *
 * Gross Gaming Revenue summary for the PIGO operator pitch. Aggregates
 * settled cards into wagered / paid / hold, plus projections scaled to a
 * target player count at 2% / 5% / 10% hold rates.
 *
 * GGR = SUM(hold_amount) over settled cards (hold = wager − payout; the
 * house keeps wagers on losses, pays out on wins). settled_at is set by
 * /api/cards/[id]/won (wins) and /api/ops/fixture-status (no-win cards on
 * match end), so only resolved cards count — in-flight cards are excluded.
 *
 * IMPORTANT (pitch honesty): the current payout model is fixed multipliers
 * on virtual tokens (5×/10×/250×) for free-play. Actual operator GGR
 * depends on the real-money payout model (parimutuel vs calibrated house
 * edge), which is NOT yet decided. The projections show the SHAPE of the
 * GGR opportunity scaled from pilot mechanics — they are a model, not
 * observed operator revenue.
 *
 * Auth: X-Ops-Secret header vs OPS_SHARED_SECRET (same as /api/ops/resolve).
 *
 * Response:
 *   200 { ok, actual: { cards_sold, total_wagered, total_paid, total_hold,
 *         hold_pct }, projections: [{ hold_rate, target_players,
 *         projected_ggr }] }
 *   401 { ok: false, error: 'bad_secret' }
 */
import { NextResponse } from 'next/server'
import { unstable_noStore as noStore } from 'next/cache'
import { createAdminClient } from '../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET(req: Request) {
  noStore()
  const expected = process.env.OPS_SHARED_SECRET
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: 'no_secret_configured', message: 'Set OPS_SHARED_SECRET in env' },
      { status: 500 }
    )
  }
  const provided = req.headers.get('x-ops-secret') || ''
  if (!constantTimeEqual(provided, expected)) {
    return NextResponse.json({ ok: false, error: 'bad_secret' }, { status: 401 })
  }

  const url = new URL(req.url)
  const operator = url.searchParams.get('operator') || 'hula'
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days')) || 30))
  const targetPlayers = Math.max(1, Number(url.searchParams.get('target')) || 10_000)

  const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const admin = createAdminClient()
  // Pull settled cards in the window. Aggregating in JS keeps it simple and
  // avoids a Postgres function; Phase 0 volumes are tiny. Move to a SQL
  // aggregate or materialized view if this ever gets large.
  const { data, error } = await admin
    .from('cards')
    .select('price_php, score, hold_amount')
    .eq('operator_id', operator)
    .not('settled_at', 'is', null)
    .gte('settled_at', sinceIso)

  if (error) {
    return NextResponse.json(
      { ok: false, error: 'db_error', message: error.message },
      { status: 500 }
    )
  }

  const rows = data ?? []
  const cardsSold = rows.length
  const totalWagered = rows.reduce((s, r) => s + (r.price_php ?? 0), 0)
  const totalPaid = rows.reduce((s, r) => s + (r.score ?? 0), 0)
  // Prefer stored hold_amount; fall back to wager − payout for any row that
  // predates the column being populated.
  const totalHold = rows.reduce(
    (s, r) => s + (r.hold_amount ?? (r.price_php ?? 0) - (r.score ?? 0)),
    0
  )
  const holdPct = totalWagered > 0 ? Math.round((totalHold / totalWagered) * 1000) / 10 : 0

  // Projection: scale observed wager-per-card to the target player count,
  // then apply the scenario hold rate. Independent of the (volatile)
  // observed hold — these are scenario models for the operator's book.
  const wagerPerCard = cardsSold > 0 ? totalWagered / cardsSold : 0
  const projectedWageredAtTarget = wagerPerCard * targetPlayers
  const projections = [0.02, 0.05, 0.1].map((rate) => ({
    hold_rate: rate,
    target_players: targetPlayers,
    projected_ggr: Math.round(projectedWageredAtTarget * rate),
  }))

  return NextResponse.json(
    {
      ok: true,
      operator,
      window_days: days,
      actual: {
        cards_sold: cardsSold,
        total_wagered: totalWagered,
        total_paid: totalPaid,
        total_hold: totalHold,
        hold_pct: holdPct,
      },
      projections,
      note:
        'Projections are a scenario model scaled from pilot mechanics, not observed operator GGR. Real-money payout model (parimutuel vs house edge) is undecided.',
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

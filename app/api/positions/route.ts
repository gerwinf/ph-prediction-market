/**
 * GET /api/positions
 *
 * The current user's bets ("My bets"). Authed-only — anon users can't bet
 * (sign-in-to-bet, decision D-anon), so an unauthenticated request returns an
 * empty list. Positions are joined to their market title and sorted
 * soonest-resolution first, then newest. Includes a summary of open stake and
 * settled winnings.
 *
 * Response:
 *   200 { ok: true, positions: [...], summary: { openStake, winnings } }
 *   500 { ok: false, error: 'db_error', message }
 */
import { NextResponse } from 'next/server'
import { unstable_noStore as noStore } from 'next/cache'
import { createAdminClient } from '../../../lib/supabase/admin'
import { createClient as createServerSupabase } from '../../../lib/supabase/server'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type PositionRow = {
  id: string
  market_id: string
  side: 'yes' | 'no'
  stake: number
  multiplier: number
  potential_payout: number
  status: 'open' | 'settled' | 'void'
  payout: number | null
  created_at: string
  settled_at: string | null
}

export async function GET() {
  noStore()

  const auth = createServerSupabase()
  const { data: userData } = await auth.auth.getUser()
  const userId = userData?.user?.id ?? null
  if (!userId) {
    return NextResponse.json(
      { ok: true, positions: [], summary: { openStake: 0, winnings: 0 } },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('positions')
    .select('id, market_id, side, stake, multiplier, potential_payout, status, payout, created_at, settled_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error', message: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as PositionRow[]

  // Resolve market titles + closes_at in one lookup (no N+1).
  const marketIds = Array.from(new Set(rows.map((p) => p.market_id)))
  let metaByMarket: Record<string, { title: string; closes_at: string | null }> = {}
  if (marketIds.length > 0) {
    const { data: markets } = await admin
      .from('markets')
      .select('id, title, closes_at')
      .in('id', marketIds)
    metaByMarket = Object.fromEntries(
      (markets ?? []).map((m) => [m.id as string, { title: m.title as string, closes_at: (m.closes_at as string) ?? null }]),
    )
  }

  const positions = rows
    .map((p) => ({
      ...p,
      market_title: metaByMarket[p.market_id]?.title ?? p.market_id,
      closes_at: metaByMarket[p.market_id]?.closes_at ?? null,
    }))
    // soonest-resolution first (nulls last), then newest
    .sort((a, b) => {
      const at = a.closes_at ? new Date(a.closes_at).getTime() : Infinity
      const bt = b.closes_at ? new Date(b.closes_at).getTime() : Infinity
      if (at !== bt) return at - bt
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  const summary = rows.reduce(
    (acc, p) => {
      if (p.status === 'open') acc.openStake += p.stake
      if (p.status === 'settled' && p.payout) acc.winnings += p.payout
      return acc
    },
    { openStake: 0, winnings: 0 },
  )

  return NextResponse.json(
    { ok: true, positions, summary },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

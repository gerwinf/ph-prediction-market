/**
 * POST /api/markets/[id]/bet
 *
 * Place a fixed-odds bet against the house book. Sign-in-to-bet: only authed
 * users can bet (no anon server bets — decision D-anon). The atomic debit +
 * position insert + exposure bump happens in the `place_bet` Postgres RPC
 * (FOR UPDATE); this route just authenticates, validates, and maps the RPC's
 * typed errors to HTTP status.
 *
 * Body: { side: 'yes' | 'no', stakePhp: number }
 *
 * Response:
 *   200 { ok: true, position }
 *   400 { ok: false, error: 'invalid_body' | 'invalid_side' | 'min_stake' }
 *   401 { ok: false, error: 'sign_in_required' }
 *   402 { ok: false, error: 'insufficient_balance' }
 *   404 { ok: false, error: 'no_book' | 'no_profile' }
 *   409 { ok: false, error: 'cap_breach', headroom } | 'market_closed'
 */
import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '../../../../../lib/supabase/server'
import { placeBet } from '../../../../../lib/mm/engine'
import { MIN_STAKE_PHP } from '../../../../../lib/mm/odds'
import type { Side } from '../../../../../lib/mm/types'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params

  // Sign-in-to-bet: no anon server bets.
  const auth = createServerSupabase()
  const { data: userData } = await auth.auth.getUser()
  const userId = userData?.user?.id
  if (!userId) return NextResponse.json({ ok: false, error: 'sign_in_required' }, { status: 401 })

  let body: { side?: Side; stakePhp?: number } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }
  const { side, stakePhp } = body
  if (side !== 'yes' && side !== 'no') {
    return NextResponse.json({ ok: false, error: 'invalid_side' }, { status: 400 })
  }
  if (!stakePhp || stakePhp < MIN_STAKE_PHP) {
    return NextResponse.json({ ok: false, error: 'min_stake', min: MIN_STAKE_PHP }, { status: 400 })
  }

  const r = await placeBet(id, userId, side, Math.floor(stakePhp))
  if (!r.ok) {
    const isCap = r.code.startsWith('cap_breach')
    const status = r.code === 'insufficient_balance'
      ? 402
      : isCap || r.code === 'market_closed'
        ? 409
        : r.code === 'no_book' || r.code === 'no_profile'
          ? 404
          : 400
    const headroom = isCap ? Number(r.code.split(':')[1]) : undefined
    return NextResponse.json({ ok: false, error: isCap ? 'cap_breach' : r.code, headroom }, { status })
  }
  return NextResponse.json({ ok: true, position: r.position })
}

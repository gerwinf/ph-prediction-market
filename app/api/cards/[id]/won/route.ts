/**
 * POST /api/cards/[id]/won
 *
 * Server-computed payout. The request body is intentionally empty — this
 * endpoint is a CLAIM trigger, not a value submitter. The server reads the
 * card's stored cells + the events fired for its match, recomputes which
 * patterns completed via `detectWins`, picks the best via `bestPayout`,
 * and writes the canonical score. This removes the browser cheat surface
 * on cards.score (leaderboard integrity).
 *
 * Response (200):
 *   { ok: true, pattern: 'row'|'col'|'diag'|'full',
 *     payoutPhp: number, multiplier: number, alreadyWon?: boolean }
 *
 * Response (409): { ok: false, error: 'no_win_yet' }
 *   No pattern completes server-side. Either events haven't propagated
 *   (race with the active card's poll), or the caller is fishing. Client
 *   may retry once after a short delay.
 *
 * Response (404): { ok: false, error: 'not_found' }
 * Response (500): { ok: false, error: 'db_error', message }
 *
 * Idempotency: if cards.won === true on first read, return the persisted
 * score without recomputing. Preserves first-win-wins semantics.
 *
 * Auth: anonymous (Phase 0 free-play). No write trust on the client; all
 * trust now lives in the events log + cells column, both server-owned.
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../../lib/supabase/admin'
import { createClient as createServerSupabase } from '../../../../../lib/supabase/server'
import { bestPayout, rareCellIndices } from '../../../../../lib/hits/payouts'
import type { GameEvent } from '../../../../../lib/hits/types'

export const dynamic = 'force-dynamic'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!id) {
    return NextResponse.json({ ok: false, error: 'card_id_required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Read the card row including the columns we need to recompute payout.
  const { data: card, error: readErr } = await admin
    .from('cards')
    .select('id, match_id, cells, price_php, won, win_pattern, score')
    .eq('id', id)
    .maybeSingle()

  if (readErr) {
    return NextResponse.json(
      { ok: false, error: 'db_error', message: readErr.message },
      { status: 500 }
    )
  }
  if (!card) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const pricePhp = card.price_php as number

  // Idempotent path: already claimed. Return persisted score.
  if (card.won) {
    const multiplier = pricePhp > 0 ? Math.round(card.score / pricePhp) : 0
    return NextResponse.json({
      ok: true,
      alreadyWon: true,
      pattern: card.win_pattern as string,
      payoutPhp: card.score as number,
      multiplier,
    })
  }

  // Pull the events fired for this card's match. Server-side admin client
  // so we get every row regardless of RLS posture.
  const { data: events, error: eventsErr } = await admin
    .from('events')
    .select('event_key')
    .eq('match_id', card.match_id)

  if (eventsErr) {
    return NextResponse.json(
      { ok: false, error: 'db_error', message: eventsErr.message },
      { status: 500 }
    )
  }

  const eventKeys = new Set<string>((events ?? []).map((e) => e.event_key as string))

  // Build hitIndices from cells + events. Free cell at index 12 is always
  // in (detectWins also enforces this defensively).
  const cells = (card.cells as GameEvent[]) ?? []
  const hitIndices = new Set<number>([12])
  cells.forEach((cell, idx) => {
    if (cell?.id && eventKeys.has(cell.id)) hitIndices.add(idx)
  })

  // Rainbow bonus: a line completed through a rare cell pays double. Computed
  // from the server-owned cells column so the browser can't fake it.
  const best = bestPayout(hitIndices, pricePhp, rareCellIndices(cells))
  if (!best.pattern) {
    // No pattern completes from the server's view. Race with events poll
    // OR fishing attempt. Either way, no DB write. Client may retry.
    return NextResponse.json({ ok: false, error: 'no_win_yet' }, { status: 409 })
  }

  const settledAt = new Date().toISOString()
  const { error: updErr } = await admin
    .from('cards')
    .update({
      won: true,
      win_pattern: best.pattern.kind,
      score: best.payoutPhp,
      claimed_at: settledAt,
      // GGR: per-card hold = wager − payout. Negative on a win (house pays
      // out more than the wager on this card); summed across all settled
      // cards = Gross Gaming Revenue. settled_at marks it counted.
      hold_amount: pricePhp - best.payoutPhp,
      settled_at: settledAt,
    })
    .eq('id', id)
    .eq('won', false) // belt + suspenders: race-safe — if another writer
                     // beat us to the win, this no-ops and we re-fetch on
                     // the next idempotent path

  if (updErr) {
    return NextResponse.json(
      { ok: false, error: 'db_error', message: updErr.message },
      { status: 500 }
    )
  }

  // Authed users: credit profile.virtual_balance with the canonical
  // payoutPhp. Anonymous users keep the localStorage credit path
  // (handled client-side from this response). Best-effort — the cards
  // row is the audit record; balance is a denormalized cache.
  let balanceAfter: number | null = null
  const authClient = createServerSupabase()
  const { data: userData } = await authClient.auth.getUser()
  if (userData?.user) {
    const { data: prof } = await admin
      .from('profiles')
      .select('virtual_balance')
      .eq('id', userData.user.id)
      .maybeSingle()
    if (prof) {
      const next = (prof.virtual_balance as number) + best.payoutPhp
      await admin
        .from('profiles')
        .update({ virtual_balance: next })
        .eq('id', userData.user.id)
      balanceAfter = next
    }
  }

  return NextResponse.json({
    ok: true,
    pattern: best.pattern.kind,
    payoutPhp: best.payoutPhp,
    multiplier: best.multiplier,
    rainbow: best.rainbow,
    balance: balanceAfter,
  })
}

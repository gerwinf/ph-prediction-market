/**
 * POST /api/private/[gameId]/[slug]/predict
 *
 * Sets a player's predictive-square answer. Used by /ops to adjust
 * each player's predictions before dinner / mid-game.
 *
 * Body: { squareId: string, answer: 'yes' | 'no' }
 *
 * Auth: shared secret in X-Ops-Secret header (same gate as /api/ops/resolve).
 *
 * Response:
 *   200 { ok: true, predictionAnswers: {...} }
 *   401 { ok: false, error: 'bad_secret' }
 *   404 { ok: false, error: 'card_not_found' | 'game_not_found' | 'player_not_found' }
 *   400 { ok: false, error: 'invalid_body' | 'unknown_square' }
 *   500 { ok: false, error: 'db_error', message }
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../../../lib/supabase/admin'
import { getPrivateGame, getPlayer } from '../../../../../../lib/private-games/registry'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, ctx: { params: Promise<{ gameId: string; slug: string }> }) {
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

  const { gameId, slug } = await ctx.params

  const game = getPrivateGame(gameId)
  if (!game) {
    return NextResponse.json({ ok: false, error: 'game_not_found' }, { status: 404 })
  }
  const player = getPlayer(game, slug)
  if (!player) {
    return NextResponse.json({ ok: false, error: 'player_not_found' }, { status: 404 })
  }

  let body: { squareId?: string; answer?: 'yes' | 'no' } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }
  const { squareId, answer } = body
  if (!squareId || (answer !== 'yes' && answer !== 'no')) {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  // Sanity: the square must exist + be predictive + be on this player's card.
  const sq = game.squarePool.find((s) => s.id === squareId)
  if (!sq || sq.type !== 'predictive' || !player.cardSquareIds.includes(squareId)) {
    return NextResponse.json({ ok: false, error: 'unknown_square' }, { status: 400 })
  }

  const cardId = `priv-sake-okada-${slug}` // private games follow this id pattern

  const admin = createAdminClient()
  const { data: existing, error: readErr } = await admin
    .from('cards')
    .select('id, prediction_answers')
    .eq('id', cardId)
    .maybeSingle()

  if (readErr) {
    return NextResponse.json(
      { ok: false, error: 'db_error', message: readErr.message },
      { status: 500 }
    )
  }
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'card_not_found' }, { status: 404 })
  }

  const current = (existing.prediction_answers as Record<string, 'yes' | 'no'>) ?? {}
  const next = { ...current, [squareId]: answer }

  const { error: updErr } = await admin
    .from('cards')
    .update({ prediction_answers: next })
    .eq('id', cardId)

  if (updErr) {
    return NextResponse.json(
      { ok: false, error: 'db_error', message: updErr.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, predictionAnswers: next })
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

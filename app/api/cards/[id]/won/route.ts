/**
 * POST /api/cards/[id]/won
 *
 * Persists a win to the cards row. Called from the active card page
 * when the win modal pops. Idempotent: if `won=true` already, returns
 * success without overwriting (preserves first-win-wins semantics).
 *
 * Body: { pattern: 'row'|'col'|'diag'|'full', payoutPhp: number }
 *
 * Response:
 *   200 { ok: true, alreadyWon?: boolean }
 *   400 { ok: false, error: 'invalid_body' | 'invalid_pattern' }
 *   404 { ok: false, error: 'not_found' }
 *   500 { ok: false, error: 'db_error', message }
 *
 * Note: no auth. Anyone with a card_id can claim a win for it. Anti-cheat
 * verification (compare hits against events fired for the match) lands
 * Phase 1.
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

const VALID_PATTERNS = new Set(['row', 'col', 'diag', 'full'])

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!id) {
    return NextResponse.json({ ok: false, error: 'card_id_required' }, { status: 400 })
  }

  let body: { pattern?: string; payoutPhp?: number } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const { pattern, payoutPhp } = body
  if (!pattern || !VALID_PATTERNS.has(pattern)) {
    return NextResponse.json({ ok: false, error: 'invalid_pattern' }, { status: 400 })
  }
  if (typeof payoutPhp !== 'number' || payoutPhp < 0) {
    return NextResponse.json({ ok: false, error: 'invalid_payout' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Check current state first to preserve idempotency.
  const { data: existing, error: readErr } = await admin
    .from('cards')
    .select('id, won')
    .eq('id', id)
    .maybeSingle()

  if (readErr) {
    return NextResponse.json(
      { ok: false, error: 'db_error', message: readErr.message },
      { status: 500 }
    )
  }
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  if (existing.won) {
    return NextResponse.json({ ok: true, alreadyWon: true })
  }

  const { error: updErr } = await admin
    .from('cards')
    .update({
      won: true,
      win_pattern: pattern,
      score: payoutPhp,
      claimed_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updErr) {
    return NextResponse.json(
      { ok: false, error: 'db_error', message: updErr.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}

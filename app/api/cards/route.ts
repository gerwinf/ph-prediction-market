/**
 * POST /api/cards
 *
 * Create a new card row in Supabase. Used by app/hits/page.tsx after
 * the user clicks Buy. Anonymous: device_id set via cookie, user_id
 * NULL until the user does email signup.
 *
 * Body: { cardId: string, cardType: 'sports' | 'daily', pricePhp: number, matchId?: string }
 *
 * Response:
 *   200 { ok: true, card: { id, ... } }
 *   400 { ok: false, error: 'invalid_body' | 'invalid_card_type' | ... }
 *   500 { ok: false, error: 'db_error', message: '...' }
 *
 * If Supabase is unreachable, returns 500 — caller (the /hits page)
 * falls back to the legacy client-side card generation so the demo
 * doesn't die on a transient backend outage.
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../lib/supabase/admin'
import { getOrCreateDeviceId } from '../../../lib/identity/device-id'
import { generateCard } from '../../../lib/hits/card-generator'
import type { CardType } from '../../../lib/hits/card-types'

export const dynamic = 'force-dynamic'

// Default match ids when the caller hasn't picked a fixture yet. Phase 0
// stopgap until the match-picker UI lands (Day 4). Both ids are seeded
// in supabase/seed.sql.
const DEFAULT_MATCH_BY_TYPE: Record<CardType, string> = {
  sports: 'wc-opening-2026',
  daily: 'daily-2026-07-20',
}

type Body = {
  cardId?: string
  cardType?: string
  pricePhp?: number
  matchId?: string
}

export async function POST(req: Request) {
  let body: Body = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const { cardId, pricePhp } = body
  const cardType = body.cardType as CardType | undefined

  if (!cardId || typeof cardId !== 'string') {
    return NextResponse.json({ ok: false, error: 'card_id_required' }, { status: 400 })
  }
  if (cardType !== 'sports' && cardType !== 'daily') {
    return NextResponse.json({ ok: false, error: 'invalid_card_type' }, { status: 400 })
  }
  if (!pricePhp || pricePhp <= 0) {
    return NextResponse.json({ ok: false, error: 'invalid_price' }, { status: 400 })
  }

  const matchId = body.matchId || DEFAULT_MATCH_BY_TYPE[cardType]

  // Build the card deterministically from cardId + cardType — same
  // formula the active card page uses, so cells stored in DB match
  // what the client renders.
  const card = generateCard(cardId, pricePhp, cardType)

  const deviceId = await getOrCreateDeviceId()

  // Seed for the cells column: store the FNV-derived seed so we can
  // re-derive the board later if the events pool changes.
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('cards')
    .insert({
      id: cardId,
      device_id: deviceId,
      match_id: matchId,
      card_type: cardType,
      board_seed: hashSeed(cardId, cardType),
      cells: card.cells,
      score: 0,
      won: false,
    })
    .select()
    .single()

  if (error) {
    // 23505 = unique_violation: cardId collision (very unlikely with
    // 6-char Crockford ids at Phase 0 volumes). Caller should retry.
    if (error.code === '23505') {
      return NextResponse.json({ ok: false, error: 'card_id_collision' }, { status: 409 })
    }
    // 23503 = foreign_key_violation: match_id doesn't exist in
    // match_fixtures. Surfaces when fixtures aren't seeded yet.
    if (error.code === '23503') {
      return NextResponse.json(
        { ok: false, error: 'unknown_match', message: `match_id=${matchId} not in match_fixtures` },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { ok: false, error: 'db_error', message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, card: data })
}

// 64-bit hash (returned as a positive bigint-compatible number for the
// board_seed column). FNV-1a on cardType:cardId mirrors the client.
function hashSeed(cardId: string, cardType: CardType): number {
  const s = `${cardType}:${cardId}`
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

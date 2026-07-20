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
import { unstable_noStore as noStore } from 'next/cache'
import { createAdminClient } from '../../../lib/supabase/admin'
import { createClient as createServerSupabase } from '../../../lib/supabase/server'
import { getOrCreateDeviceId, readDeviceId } from '../../../lib/identity/device-id'
import { generateCard, newCardId } from '../../../lib/hits/card-generator'
import type { CardType } from '../../../lib/hits/card-types'
import { ensureDemoEvents } from '../../../lib/demo/seed-events'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

/**
 * GET /api/cards?limit=20&offset=0
 *
 * Card history for the current identity. Authed users (Supabase session)
 * see their user_id cards; anonymous users see their device_id cards
 * (user_id NULL). Newest first, server-paginated.
 *
 * Response:
 *   200 { ok: true, cards: [{ id, match_id, match_label, card_type,
 *         price_php, won, win_pattern, score, created_at }], hasMore }
 *   500 { ok: false, error: 'db_error', message }
 */
export async function GET(req: Request) {
  noStore()
  const url = new URL(req.url)
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 20))
  const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0)

  const admin = createAdminClient()

  // Identity: authed → user_id; anon → device_id (user_id NULL).
  const authClient = createServerSupabase()
  const { data: userData } = await authClient.auth.getUser()
  const authedUserId = userData?.user?.id ?? null

  let query = admin
    .from('cards')
    .select('id, match_id, card_type, price_php, won, win_pattern, score, created_at')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit) // fetch one extra to compute hasMore

  if (authedUserId) {
    query = query.eq('user_id', authedUserId)
  } else {
    const deviceId = await readDeviceId()
    if (!deviceId) {
      return NextResponse.json(
        { ok: true, cards: [], hasMore: false },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }
    query = query.eq('device_id', deviceId).is('user_id', null)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json(
      { ok: false, error: 'db_error', message: error.message },
      { status: 500 }
    )
  }

  const rows = data ?? []
  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows

  // Resolve match labels in one lookup (no N+1).
  const matchIds = Array.from(new Set(page.map((c) => c.match_id)))
  let labelByMatch: Record<string, string> = {}
  if (matchIds.length > 0) {
    const { data: fixtures } = await admin
      .from('match_fixtures')
      .select('id, match_label')
      .in('id', matchIds)
    labelByMatch = Object.fromEntries(
      (fixtures ?? []).map((f) => [f.id as string, f.match_label as string])
    )
  }

  const cards = page.map((c) => ({
    ...c,
    match_label: labelByMatch[c.match_id] ?? c.match_id,
  }))

  return NextResponse.json(
    { ok: true, cards, hasMore },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

// Default match ids when the caller hasn't picked a fixture yet — i.e. a plain
// demo buy off the entry page. The sports default is the always-live PBA demo
// fixture (seeded in migration 006); daily is seeded in supabase/seed.sql.
const DEFAULT_MATCH_BY_TYPE: Record<CardType, string> = {
  sports: 'demo-pba-perpetual',
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

  const { pricePhp } = body
  const cardType = body.cardType as CardType | undefined

  if (cardType !== 'sports' && cardType !== 'daily') {
    return NextResponse.json({ ok: false, error: 'invalid_card_type' }, { status: 400 })
  }
  // Stake whitelist (CEO review 3A): under parimutuel, stake IS the claim
  // weight — a client-claimed price is a pool-theft vector. Server owns it.
  if (pricePhp !== 20 && pricePhp !== 50) {
    return NextResponse.json({ ok: false, error: 'invalid_price' }, { status: 400 })
  }

  const matchId = body.matchId || DEFAULT_MATCH_BY_TYPE[cardType]

  // Server-issued card ids (CEO review 3A): fixture-bound buys get a
  // server-generated id — client-chosen ids let a player enumerate boards
  // locally and buy a stacked one. Demo buys may keep a valid client id
  // (no economic surface; also keeps mid-deploy legacy clients working).
  const isFixtureBound = Boolean(body.matchId && !body.matchId.startsWith('demo-'))
  const clientId =
    typeof body.cardId === 'string' && /^[A-Z2-9]{6}$/.test(body.cardId) ? body.cardId : null
  let cardId = !isFixtureBound && clientId ? clientId : newCardId()

  // A card EXPLICITLY bound to a real fixture must not be sold after the
  // final whistle — its cells could never light (observed: post-final buys
  // through shared card links). Default bindings skip the check: a demo
  // buy's match_id is bookkeeping and the client plays the canned timeline.
  if (body.matchId && !body.matchId.startsWith('demo-')) {
    const adminFix = createAdminClient()
    const { data: fix } = await adminFix
      .from('match_fixtures')
      .select('status')
      .eq('id', body.matchId)
      .maybeSingle()
    if (fix && (fix.status === 'final' || fix.status === 'canceled')) {
      return NextResponse.json({ ok: false, error: 'match_final' }, { status: 409 })
    }
  }

  const deviceId = await getOrCreateDeviceId()

  // Authed users: debit profile.virtual_balance server-side BEFORE
  // inserting the card row. Reject with 402 if insufficient. Anonymous
  // users keep the localStorage-debit path (client trusts itself in
  // Phase 0 free-play; balance has no real value).
  const authClient = createServerSupabase()
  const { data: userData } = await authClient.auth.getUser()
  const authedUserId = userData?.user?.id ?? null
  let newBalanceForResponse: number | null = null

  if (authedUserId) {
    const adminPre = createAdminClient()
    const { data: prof, error: profReadErr } = await adminPre
      .from('profiles')
      .select('virtual_balance')
      .eq('id', authedUserId)
      .maybeSingle()
    if (profReadErr) {
      return NextResponse.json(
        { ok: false, error: 'db_error', message: profReadErr.message },
        { status: 500 }
      )
    }
    if (!prof) {
      return NextResponse.json({ ok: false, error: 'profile_not_found' }, { status: 404 })
    }
    const next = (prof.virtual_balance as number) - pricePhp
    if (next < 0) {
      return NextResponse.json(
        { ok: false, error: 'insufficient_balance', balance: prof.virtual_balance },
        { status: 402 }
      )
    }
    const { error: debitErr } = await adminPre
      .from('profiles')
      .update({ virtual_balance: next })
      .eq('id', authedUserId)
    if (debitErr) {
      return NextResponse.json(
        { ok: false, error: 'db_error', message: debitErr.message },
        { status: 500 }
      )
    }
    newBalanceForResponse = next
  }

  // Build the card deterministically from cardId + cardType + matchId —
  // same formula the active card page uses (via the pool-builder), so cells
  // stored in DB match what the client renders for live fixtures. Retry a
  // fresh server id on the (rare) 6-char Crockford collision.
  const supabase = createAdminClient()
  let data: Record<string, unknown> | null = null
  let error: { code?: string; message: string } | null = null
  for (let attempt = 0; attempt < 3; attempt++) {
    const card = generateCard(cardId, pricePhp, cardType, matchId)
    const res = await supabase
      .from('cards')
      .insert({
        id: cardId,
        device_id: deviceId,
        user_id: authedUserId,
        match_id: matchId,
        card_type: cardType,
        board_seed: hashSeed(cardId, cardType),
        cells: card.cells,
        price_php: pricePhp,
        score: 0,
        won: false,
      })
      .select()
      .single()
    data = res.data
    error = res.error
    if (!error || error.code !== '23505') break
    cardId = newCardId() // collision — roll a new id and retry
  }

  if (error) {
    // If authed and we already debited, refund the balance so the user
    // isn't charged for a card that never persisted. Phase 0 best-effort
    // — Phase 1 wraps purchase + balance in a payment_ledger transaction.
    if (authedUserId && newBalanceForResponse !== null) {
      const adminRefund = createAdminClient()
      await adminRefund
        .from('profiles')
        .update({ virtual_balance: newBalanceForResponse + pricePhp })
        .eq('id', authedUserId)
    }
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

  // Demo fixture: seed N future-stamped events so the card lights up
  // naturally over the next ~7 min without needing a cron. Best-effort —
  // a seeding failure shouldn't kill the buy.
  if (matchId === 'demo-pba-perpetual') {
    try {
      await ensureDemoEvents(supabase, matchId)
    } catch (err) {
      console.error('[hits/cards] demo seed failed:', err)
    }
  }

  return NextResponse.json({ ok: true, card: data, balance: newBalanceForResponse })
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

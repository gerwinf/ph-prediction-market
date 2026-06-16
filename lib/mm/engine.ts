/**
 * Server-only market-maker engine. Pulls the service-role admin client, so it
 * must ONLY be imported from server code (route handlers). The pure helpers
 * (isAnchorDue/headroom/quoteFromBook) are safe to unit-test directly; the RPC
 * wrappers touch the DB. (Convention matches lib/supabase/admin.ts — no
 * `server-only` package import, which this repo doesn't depend on.)
 */
import { createAdminClient } from '../supabase/admin'
import { multipliers } from './odds'
import type { MarketBook, Quote, Side } from './types'

export const ANCHOR_TTL_MS = 10 * 60 * 1000 // match mirror_prices TTL

/** Is this book's anchor stale (never anchored, or older than the TTL)? */
export function isAnchorDue(anchoredAt: string | null | undefined, now: number): boolean {
  if (!anchoredAt) return true
  return now - new Date(anchoredAt).getTime() >= ANCHOR_TTL_MS
}

/** Remaining exposure cap on a side — never negative. */
export function headroom(book: MarketBook, side: Side): number {
  const used = side === 'yes' ? book.exposure_yes : book.exposure_no
  return Math.max(0, book.cap - used)
}

/** Build the public quote from a book row. */
export function quoteFromBook(book: MarketBook): Quote {
  const { yes, no } = multipliers(book.p, book.margin)
  return {
    market_id: book.market_id,
    p: book.p,
    multiplier_yes: yes,
    multiplier_no: no,
    headroom_yes: headroom(book, 'yes'),
    headroom_no: headroom(book, 'no'),
    is_stale: book.is_stale,
  }
}

/**
 * Thin wrapper over the place_bet RPC. The RPC does the atomic debit + position
 * insert + exposure bump under FOR UPDATE; here we just map pg exceptions to
 * error codes the route turns into HTTP status.
 */
export async function placeBet(marketId: string, userId: string, side: Side, stake: number) {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('place_bet', {
    p_market_id: marketId,
    p_user_id: userId,
    p_side: side,
    p_stake: stake,
  })
  if (error) return { ok: false as const, code: parsePgError(error.message) }
  return { ok: true as const, position: data }
}

/** Thin wrapper over the settle_market RPC (idempotent). */
export async function settleMarket(marketId: string, outcome: 'yes' | 'no' | 'void') {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('settle_market', {
    p_market_id: marketId,
    p_outcome: outcome,
  })
  if (error) return { ok: false as const, message: error.message }
  return { ok: true as const, settled: data as number }
}

/** Extract our raised-exception tokens (e.g. 'insufficient_balance', 'cap_breach:47'). */
function parsePgError(msg: string): string {
  const m = msg.match(
    /(min_stake|bad_side|no_book|market_closed|cap_breach:-?\d+|insufficient_balance|no_profile)/,
  )
  return m ? m[1] : 'db_error'
}

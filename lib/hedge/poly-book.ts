/**
 * Pre-hedge engine — Polymarket read-only book connector (M0).
 *
 * Reads the live CLOB order book for a YES token (no auth — public read) and
 * derives the mid the quoting service uses. Pure parsing (`bestBidAsk`,
 * `midFromBook`) is unit-tested; `fetchBook` is the thin IO wrapper.
 *
 * This is the read-only half of the connector — M2 adds authenticated order
 * posting via @polymarket/clob-client-v2. Read works from any region (not
 * geoblocked); only order-posting needs an allowed-region host.
 *
 * See docs/superpowers/specs/2026-06-17-pre-hedge-engine-v0-spec.md §3,§7.
 */
const CLOB_URL = 'https://clob.polymarket.com'

export type BookLevel = { price: string | number; size: string | number }
export type Book = { bids: BookLevel[]; asks: BookLevel[] }

/** Best (highest) bid + best (lowest) ask as numbers, or null if one-sided. */
export function bestBidAsk(book: Book): { bid: number; ask: number } | null {
  if (!book.bids?.length || !book.asks?.length) return null
  const bid = Math.max(...book.bids.map((l) => Number(l.price)))
  const ask = Math.min(...book.asks.map((l) => Number(l.price)))
  if (!Number.isFinite(bid) || !Number.isFinite(ask)) return null
  return { bid, ask }
}

/** Midpoint of best bid/ask, or null when there's no two-sided market. */
export function midFromBook(book: Book): number | null {
  const bba = bestBidAsk(book)
  return bba ? (bba.bid + bba.ask) / 2 : null
}

/**
 * Fetch the live book for a CLOB token id. Never throws — returns null on any
 * failure so the quoting service can pull quotes when the venue is unhealthy.
 */
export async function fetchBook(
  tokenId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Book | null> {
  try {
    const res = await fetchImpl(`${CLOB_URL}/book?token_id=${encodeURIComponent(tokenId)}`)
    if (!res.ok) return null
    const raw = (await res.json()) as Partial<Book>
    if (!Array.isArray(raw.bids) || !Array.isArray(raw.asks)) return null
    return { bids: raw.bids, asks: raw.asks }
  } catch {
    return null
  }
}

/** Convenience: live mid for a token, or null if unavailable/one-sided. */
export async function fetchMid(tokenId: string, fetchImpl: typeof fetch = fetch): Promise<number | null> {
  const book = await fetchBook(tokenId, fetchImpl)
  return book ? midFromBook(book) : null
}

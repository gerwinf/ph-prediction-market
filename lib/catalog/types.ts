/**
 * Catalog types — the DB-backed market catalog (migration 009).
 *
 * One `markets` table backs two surfaces:
 *   - `kind: 'binary'`     → landing-grid yes/no markets (app/page.tsx)
 *   - `kind: 'event_cell'` → /hits bingo event tiles (lib/hits)
 *
 * The discriminator is `kind`; `payload` is shaped per-kind (see the two
 * payload types below). Narrowed `CatalogBinaryMarket` / `CatalogEventCell`
 * let read adapters return already-discriminated rows.
 */
import type { EventCategory, GameEvent } from '../hits/types'

export type MarketKind = 'binary' | 'event_cell' | 'wc_fixture' | 'wc_contender'
export type MarketStatus = 'candidate' | 'approved' | 'live' | 'retired'

/**
 * Binary (yes/no) landing market payload.
 * - `categories`: every landing tab this market appears under (e.g.
 *   `['trending', 'sports']`). One market can show in multiple tabs.
 * - `cat`: the short display label shown on the card (e.g. 'World Cup').
 * - `polymarket_slug` / `polymarket_market_id`: present when a live odds feed
 *   backs this market; `fallback_pct` is shown until/unless the feed resolves.
 */
export type BinaryPayload = {
  categories: string[]
  cat: string
  fallback_pct: number
  vol_label: string
  delta?: number
  polymarket_slug?: string
  polymarket_market_id?: string
}

/**
 * Event-cell payload — a /hits bingo tile. Mirrors `GameEvent` plus optional
 * team/player attribution for per-fixture tiles (generic tiles leave them off).
 */
export type EventCellPayload = {
  event_key: string
  label: string
  category: EventCategory
  rarity: GameEvent['rarity']
  team?: string
  player?: string
}

/**
 * World Cup match-card payload (kind='wc_fixture'). Snake_case mirrors the DB;
 * the read adapter maps it to the page's camelCase `Fixture` (lib/worldcup/state).
 * - `kickoff_iso`: ISO 8601 UTC kickoff time. Fixtures render ordered by this.
 * - `slug`: optional LIVE_MARKETS key (lib/oracle/slugs) for a live odds overlay.
 * - `fallback`: curated home/draw/away percentages shown until a live feed resolves.
 */
export type WcFixturePayload = {
  home: { name: string; iso: string }
  away: { name: string; iso: string }
  group: string
  kickoff_iso: string
  venue?: string
  slug?: string
  fallback: { home: number; draw: number; away: number }
}

/**
 * World Cup winner-leaderboard payload (kind='wc_contender'). Snake_case mirrors
 * the DB; the read adapter maps it to the page's camelCase `Contender`.
 * - `fallback_pct`: curated championship probability shown until a live feed resolves.
 * - `vol` / `delta`: curated flavor (market depth label + 24h move in pct points).
 */
export type WcContenderPayload = {
  name: string
  iso: string
  slug?: string
  fallback_pct: number
  vol: string
  delta: number
}

/** A raw catalog row (either kind). */
export type CatalogMarket = {
  id: string
  kind: MarketKind
  category: string | null
  title: string
  fixtureId: string | null
  status: MarketStatus
  interestScore: number
  source: string | null
  payload: BinaryPayload | EventCellPayload | Record<string, unknown>
}

/** A catalog row narrowed to `kind: 'binary'`. */
export type CatalogBinaryMarket = Omit<CatalogMarket, 'kind' | 'payload'> & {
  kind: 'binary'
  payload: BinaryPayload
}

/** A catalog row narrowed to `kind: 'event_cell'`. */
export type CatalogEventCell = Omit<CatalogMarket, 'kind' | 'payload'> & {
  kind: 'event_cell'
  payload: EventCellPayload
}

/** Convert a stored event-cell row back into a `GameEvent` for the /hits pool. */
export function eventCellToGameEvent(p: EventCellPayload): GameEvent {
  return { id: p.event_key, label: p.label, category: p.category, rarity: p.rarity }
}

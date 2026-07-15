import type { GameEvent } from './types'

/**
 * Binder (collection view) helpers — pure derivations for /hits/history.
 *
 * The binder regenerates each card's cells client-side (card generation is
 * deterministic from id+type+match) and lights the mini-grid from the match's
 * fired event keys — same rule as the live card page (cell.id ∈ event keys),
 * free cell always in.
 */

export type BinderCardRow = {
  won: boolean
  score: number
}

export type BinderStats = { cards: number; wins: number; totalWon: number }

export function deriveBinderStats(rows: BinderCardRow[]): BinderStats {
  return {
    cards: rows.length,
    wins: rows.filter((r) => r.won).length,
    totalWon: rows.reduce((sum, r) => sum + (r.won ? r.score : 0), 0),
  }
}

export function binderHitIndices(cells: GameEvent[], eventKeys: Set<string>): Set<number> {
  const hits = new Set<number>([12]) // free cell always in
  cells.forEach((cell, idx) => {
    if (eventKeys.has(cell.id)) hits.add(idx)
  })
  return hits
}

export type BinderPocket = {
  id: string
  match_id: string
  card_type: 'sports' | 'daily'
  price_php: number
}

/**
 * Query params for opening a binder pocket into the card view.
 *
 * Every stored card is bound to a real match_id, so we always open in
 * event-driven ("live") mode against that match. A finished fixture replays
 * its real events and freezes at FINAL; a still-live one keeps ticking. This
 * is what lets the binder show the ACTUAL old game — without `match`+`live`,
 * card-client falls back to the canned Portugal–Spain demo timeline for every
 * pocket. Never `new=1` — a binder open must not re-rip the pack.
 */
export function binderOpenParams(card: BinderPocket): URLSearchParams {
  return new URLSearchParams({
    bet: String(card.price_php),
    type: card.card_type,
    live: '1',
    match: card.match_id,
  })
}

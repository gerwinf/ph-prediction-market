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

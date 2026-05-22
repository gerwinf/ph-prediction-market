/**
 * Registry of private games. Single game for v1; multi-game support
 * is v2 (would need a creation UI + DB-driven registry).
 */
import type { PrivateGame, PrivatePlayer, Square } from './types'
import { HULA_FREE_ID } from './types'
import { SAKE_OKADA_2026_05_22 } from './sake-okada-2026-05-22'

const GAMES: Record<string, PrivateGame> = {
  [SAKE_OKADA_2026_05_22.id]: SAKE_OKADA_2026_05_22,
}

export function getPrivateGame(id: string): PrivateGame | null {
  return GAMES[id] ?? null
}

export function isPrivateGameId(id: string): boolean {
  return id in GAMES
}

export function getPlayer(game: PrivateGame, slug: string): PrivatePlayer | null {
  return game.players.find((p) => p.slug === slug) ?? null
}

/**
 * Resolve a player's 25 squares into full Square objects, preserving
 * order. The `__hula__` free cell is materialized inline as a synthetic
 * Square so the renderer doesn't need special-case handling.
 */
export function resolvePlayerCells(game: PrivateGame, player: PrivatePlayer): Square[] {
  const lookup = new Map(game.squarePool.map((s) => [s.id, s]))
  return player.cardSquareIds.map((id, idx) => {
    if (id === HULA_FREE_ID) {
      return {
        id: HULA_FREE_ID,
        type: 'observational',
        label: 'HULA',
        category: 'either',
        isShared: false,
        notes: `free cell at index ${idx}`,
      }
    }
    const sq = lookup.get(id)
    if (!sq) {
      // Defensive: unknown id, render a stub. Shouldn't happen if
      // sake-okada-...ts is consistent.
      return {
        id,
        type: 'observational',
        label: id,
        category: 'either',
        isShared: false,
      }
    }
    return sq
  })
}

export { GAMES as ALL_PRIVATE_GAMES }

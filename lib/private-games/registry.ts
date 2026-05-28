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
 * Resolve a player's 25 squares into full Square objects.
 *
 * Each player's non-HULA squares are deterministically shuffled using
 * a seed derived from `${game.id}:${player.slug}` so:
 *   1. The same player always sees the same layout (stable across renders)
 *   2. Different players see DIFFERENT layouts (real bingo, not lockstep)
 *
 * The `__hula__` free cell stays at index 12 (center) regardless of
 * shuffle.
 */
export function resolvePlayerCells(game: PrivateGame, player: PrivatePlayer): Square[] {
  const lookup = new Map(game.squarePool.map((s) => [s.id, s]))

  // Separate HULA out so we can re-insert at index 12 after shuffling.
  const nonHula = player.cardSquareIds.filter((id) => id !== HULA_FREE_ID)

  const rng = mulberry32(fnv1a(`${game.id}:${player.slug}`))
  const shuffled = fisherYates(nonHula, rng)

  // Build the final 25-cell array with HULA at index 12.
  const ordered: string[] = []
  for (let i = 0, j = 0; i < 25; i++) {
    if (i === 12) {
      ordered.push(HULA_FREE_ID)
    } else {
      ordered.push(shuffled[j++])
    }
  }

  return ordered.map((id, idx) => {
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

// FNV-1a → mulberry32. Same construction as lib/hits/card-generator.ts;
// duplicated here to keep /private decoupled from /hits per spec rule.
function fnv1a(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}
function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = t
    r = Math.imul(r ^ (r >>> 15), r | 1)
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}
function fisherYates<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export { GAMES as ALL_PRIVATE_GAMES }

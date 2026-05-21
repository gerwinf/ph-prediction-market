import { CARD_TYPES, type CardType } from './card-types'
import type { Card, GameEvent } from './types'

// FNV-1a → mulberry32. Deterministic PRNG seeded from card_id string.
// Same card_id → same card. No backend needed for "share your card" links.
function seedFromString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = t
    r = Math.imul(r ^ (r >>> 15), r | 1)
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const FREE_CELL: GameEvent = {
  id: 'free',
  label: 'HULA',
  category: 'flow',
  rarity: 'common',
}

export function generateCard(cardId: string, pricePhp: number, cardType: CardType = 'sports'): Card {
  const pool = CARD_TYPES[cardType].pool
  // Seed includes the card type so the same id on different types produces
  // different cards — keeps share-links semantically distinct across types.
  const seed = seedFromString(`${cardType}:${cardId}`)
  const rng = mulberry32(seed)
  const picks = shuffle(pool, rng).slice(0, 24)
  const cells: GameEvent[] = []
  for (let i = 0; i < 25; i++) {
    if (i === 12) cells.push(FREE_CELL)
    else cells.push(picks[i < 12 ? i : i - 1])
  }
  return { id: cardId, cells, purchasedAt: Date.now(), pricePhp, type: cardType }
}

// Generate a fresh shareable card_id: 6 chars from a Crockford-friendly alphabet.
const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function newCardId(): string {
  let out = ''
  for (let i = 0; i < 6; i++) {
    out += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)]
  }
  return out
}

export function isFreeCell(idx: number): boolean {
  return idx === 12
}

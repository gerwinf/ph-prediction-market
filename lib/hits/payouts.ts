import type { GameEvent, WinPattern } from './types'

export const MULTIPLIERS = {
  row: 5,
  col: 5,
  diag: 10,
  full: 250,
} as const

// Rainbow (rare) cells are 3× rarer on a card AND represent lower-probability
// real-world events, so a line completed THROUGH one is a rare×rare event —
// we pay it double. Because it fires so seldom, the splashy bonus barely
// moves aggregate RTP (that's the trick: loud prestige, quiet expected cost).
// Virtual-currency house book only for now; the parimutuel shadow (pool.ts)
// deliberately does NOT apply this yet, to keep its banked settlements
// comparable. Tune here once real-money data lands.
export const RAINBOW_MULTIPLIER = 2

// Indices of the "rainbow" cells on a card — rarity 'rare', excluding the
// free cell (which is always common in practice, guarded here defensively).
// Shared by the payout engine, the live board, and the win route so the
// bonus always matches the cells the player actually sees glow.
export function rareCellIndices(cells: GameEvent[]): Set<number> {
  const s = new Set<number>()
  cells.forEach((c, i) => {
    if (c?.rarity === 'rare' && c.id !== 'free') s.add(i)
  })
  return s
}

/** True if any cell on the pattern is a rainbow cell. */
export function patternHasRainbow(pattern: WinPattern, rareIndices: Set<number>): boolean {
  return pattern.cellIndices.some((i) => rareIndices.has(i))
}

/** Pattern's base multiplier, doubled when the line runs through a rainbow. */
export function effectiveMultiplier(pattern: WinPattern, rareIndices: Set<number>): number {
  return pattern.multiplier * (patternHasRainbow(pattern, rareIndices) ? RAINBOW_MULTIPLIER : 1)
}

// All 5 rows + 5 cols + 2 diagonals + full card. Each pattern lists the
// cell indices (0..24) it covers, and the multiplier paid on that hit.
const PATTERNS: WinPattern[] = (() => {
  const ps: WinPattern[] = []
  for (let r = 0; r < 5; r++) {
    ps.push({
      kind: 'row',
      index: r,
      cellIndices: [0, 1, 2, 3, 4].map((c) => r * 5 + c),
      multiplier: MULTIPLIERS.row,
      label: `Row ${r + 1}`,
    })
  }
  for (let c = 0; c < 5; c++) {
    ps.push({
      kind: 'col',
      index: c,
      cellIndices: [0, 1, 2, 3, 4].map((r) => r * 5 + c),
      multiplier: MULTIPLIERS.col,
      label: `Column ${c + 1}`,
    })
  }
  ps.push({
    kind: 'diag',
    index: 0,
    cellIndices: [0, 6, 12, 18, 24],
    multiplier: MULTIPLIERS.diag,
    label: 'Diagonal ↘',
  })
  ps.push({
    kind: 'diag',
    index: 1,
    cellIndices: [4, 8, 12, 16, 20],
    multiplier: MULTIPLIERS.diag,
    label: 'Diagonal ↙',
  })
  ps.push({
    kind: 'full',
    index: 0,
    cellIndices: Array.from({ length: 25 }, (_, i) => i),
    multiplier: MULTIPLIERS.full,
    label: 'Full card',
  })
  return ps
})()

// Returns the win patterns that fully complete given the current set of hit indices.
// Free cell (12) is always considered hit. Highest-multiplier pattern wins; we
// also surface ALL completed patterns so the UI can announce them in order.
export function detectWins(hitIndices: Set<number>): WinPattern[] {
  const hits = new Set(hitIndices)
  hits.add(12) // free cell
  return PATTERNS.filter((p) => p.cellIndices.every((i) => hits.has(i)))
}

// Picks the completed pattern with the highest EFFECTIVE payout — i.e. after
// the rainbow bonus, so a row through a rainbow (10×) beats a plain row (5×).
// `multiplier` and `payoutPhp` are the effective (post-bonus) values; `rainbow`
// flags whether the selected line earned the bonus so the UI can badge it.
export function bestPayout(
  hitIndices: Set<number>,
  pricePhp: number,
  rareIndices: Set<number> = new Set()
): { multiplier: number; payoutPhp: number; pattern: WinPattern | null; rainbow: boolean } {
  const wins = detectWins(hitIndices)
  if (wins.length === 0) return { multiplier: 0, payoutPhp: 0, pattern: null, rainbow: false }
  const best = wins.reduce((a, b) =>
    effectiveMultiplier(a, rareIndices) >= effectiveMultiplier(b, rareIndices) ? a : b
  )
  const rainbow = patternHasRainbow(best, rareIndices)
  const multiplier = effectiveMultiplier(best, rareIndices)
  return { multiplier, payoutPhp: pricePhp * multiplier, pattern: best, rainbow }
}

import type { WinPattern } from './types'

export const MULTIPLIERS = {
  row: 5,
  col: 5,
  diag: 10,
  full: 250,
} as const

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

export function bestPayout(
  hitIndices: Set<number>,
  pricePhp: number
): { multiplier: number; payoutPhp: number; pattern: WinPattern | null } {
  const wins = detectWins(hitIndices)
  if (wins.length === 0) return { multiplier: 0, payoutPhp: 0, pattern: null }
  const best = wins.reduce((a, b) => (a.multiplier >= b.multiplier ? a : b))
  return { multiplier: best.multiplier, payoutPhp: pricePhp * best.multiplier, pattern: best }
}

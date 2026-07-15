import { describe, it, expect } from 'vitest'
import { buildRevealPlan, revealDurationMs, shouldShowRip } from './reveal'
import { deriveBinderStats, binderHitIndices, binderOpenParams } from './binder'
import { generateCard } from './card-generator'

const WC_MATCH = 'wc-por-esp-2026-07-06'

describe('buildRevealPlan', () => {
  const card = generateCard('ABC123', 20, 'sports', WC_MATCH)
  const plan = buildRevealPlan(card.cells)

  it('covers every cell exactly once', () => {
    expect(plan).toHaveLength(25)
    expect(new Set(plan.map((s) => s.idx)).size).toBe(25)
  })
  it('reveals every rare cell after every common cell', () => {
    const lastCommon = Math.max(...plan.filter((s) => !s.rare).map((s) => s.delayMs))
    const rares = plan.filter((s) => s.rare)
    for (const r of rares) expect(r.delayMs).toBeGreaterThan(lastCommon)
  })
  it('treats the free cell as common (never a rare flourish)', () => {
    const freeIdx = card.cells.findIndex((c) => c.id === 'free')
    const freeStep = plan.find((s) => s.idx === freeIdx)!
    expect(freeStep.rare).toBe(false)
  })
  it('is deterministic and bounded (~under 8s, tap-to-skip covers the impatient)', () => {
    expect(buildRevealPlan(card.cells)).toEqual(plan)
    expect(revealDurationMs(plan)).toBeLessThan(8000)
  })
})

describe('shouldShowRip', () => {
  it('plays only on a fresh acquisition at normal speed without reduced motion', () => {
    expect(shouldShowRip({ isNew: true, speed: 1, prefersReducedMotion: false })).toBe(true)
    expect(shouldShowRip({ isNew: false, speed: 1, prefersReducedMotion: false })).toBe(false)
    expect(shouldShowRip({ isNew: true, speed: 8, prefersReducedMotion: false })).toBe(false)
    expect(shouldShowRip({ isNew: true, speed: 1, prefersReducedMotion: true })).toBe(false)
  })
})

describe('deriveBinderStats', () => {
  it('counts cards, wins, and the sum of winning scores', () => {
    const stats = deriveBinderStats([
      { won: true, score: 200 },
      { won: false, score: 0 },
      { won: true, score: 100 },
    ])
    expect(stats).toEqual({ cards: 3, wins: 2, totalWon: 300 })
  })
  it('handles the empty binder', () => {
    expect(deriveBinderStats([])).toEqual({ cards: 0, wins: 0, totalWon: 0 })
  })
})

describe('binderHitIndices', () => {
  const card = generateCard('ABC123', 20, 'sports', WC_MATCH)

  it('always includes the free cell', () => {
    expect(binderHitIndices(card.cells, new Set()).has(12)).toBe(true)
  })
  it('lights exactly the cells whose id matches a fired event key', () => {
    const someCell = card.cells[3]
    const hits = binderHitIndices(card.cells, new Set([someCell.id]))
    expect(hits.has(3)).toBe(true)
    expect(hits.size).toBeGreaterThanOrEqual(2) // idx 3 + free (dupes possible)
    for (const idx of hits) {
      if (idx === 12) continue
      expect(card.cells[idx].id).toBe(someCell.id)
    }
  })
})

describe('binderOpenParams', () => {
  it('always opens against the pocket own match in event-driven mode', () => {
    const p = binderOpenParams({
      id: 'ABC123',
      match_id: 'wc-arg-fra-2026-07-10',
      card_type: 'sports',
      price_php: 20,
    })
    expect(p.get('match')).toBe('wc-arg-fra-2026-07-10')
    expect(p.get('live')).toBe('1')
    expect(p.get('bet')).toBe('20')
    expect(p.get('type')).toBe('sports')
  })
  it('never re-rips the pack (no new=1) so old games just replay', () => {
    const p = binderOpenParams({
      id: 'XYZ',
      match_id: 'daily-2026-07-20',
      card_type: 'daily',
      price_php: 50,
    })
    expect(p.get('new')).toBeNull()
    expect(p.get('match')).toBe('daily-2026-07-20')
    expect(p.get('type')).toBe('daily')
  })
})

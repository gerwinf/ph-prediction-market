import { describe, it, expect } from 'vitest'
import { buildPoolForMatch } from './pool-builder'
import { SAMPLE_MATCH } from './sample-match'
import { generateCard } from './card-generator'
import { teamsFromWcMatchId } from './players-wc'

// The default sports match id used by both the client (app/hits/[card_id]) and
// the server (app/api/cards). Keep in sync with DEFAULT_MATCH_BY_TYPE.
const WC_MATCH = 'wc-por-esp-2026-07-06'

describe('teamsFromWcMatchId', () => {
  it('parses a wc- fixture id to team codes', () => {
    expect(teamsFromWcMatchId(WC_MATCH)).toEqual(['POR', 'ESP'])
  })
  it('returns null for a pba- id (so the basketball path still runs)', () => {
    expect(teamsFromWcMatchId('pba-gin-ros-2026-05-24')).toBeNull()
  })
})

describe('buildPoolForMatch — World Cup fixture', () => {
  const pool = buildPoolForMatch(WC_MATCH)
  const ids = new Set(pool.map((e) => e.id))

  it('returns a football pool large enough to fill a 24-cell card', () => {
    expect(pool.length).toBeGreaterThanOrEqual(24)
  })
  it('includes generic football, per-team, and per-player tiles', () => {
    expect(ids.has('both-teams-score')).toBe(true) // generic
    expect(ids.has('esp-win')).toBe(true)          // team tile
    expect(ids.has('yamal-goal')).toBe(true)       // forward tile
    expect(ids.has('bruno-card')).toBe(true)       // mid tile
  })
  it('does NOT fall back to the basketball pool', () => {
    expect(ids.has('thompson-20')).toBe(false)
    expect(ids.has('ginebra-q1')).toBe(false)
  })
  it('has no duplicate tile ids', () => {
    expect(ids.size).toBe(pool.length)
  })
})

// LOAD-BEARING: every event the demo timeline fires must exist in the demo
// card's pool, or the ticker announces events that light no cell.
describe('SAMPLE_MATCH timeline is covered by the demo pool', () => {
  const ids = new Set(buildPoolForMatch(WC_MATCH).map((e) => e.id))
  for (const ev of SAMPLE_MATCH.timeline) {
    it(`pool contains '${ev.eventId}' (${ev.gameClock})`, () => {
      expect(ids.has(ev.eventId)).toBe(true)
    })
  }
})

describe('generateCard — World Cup sports card', () => {
  const card = generateCard('ABC123', 20, 'sports', WC_MATCH)

  it('builds exactly 25 cells with the free cell centered', () => {
    expect(card.cells).toHaveLength(25)
    expect(card.cells[12].id).toBe('free')
  })
  it('is deterministic for the same id', () => {
    const again = generateCard('ABC123', 20, 'sports', WC_MATCH)
    expect(again.cells.map((c) => c.id)).toEqual(card.cells.map((c) => c.id))
  })
  it('fills non-free cells from the football pool', () => {
    const nonFree = card.cells.filter((_, i) => i !== 12)
    expect(nonFree.every((c) => c.id !== 'free')).toBe(true)
    // At least one recognizably-football tile made the board.
    const footballIds = new Set(buildPoolForMatch(WC_MATCH).map((e) => e.id))
    expect(nonFree.every((c) => footballIds.has(c.id))).toBe(true)
  })
})

describe('basketball path unchanged (regression)', () => {
  it('a pba- match still builds a basketball pool', () => {
    const ids = new Set(buildPoolForMatch('pba-gin-ros-2026-05-24').map((e) => e.id))
    expect(ids.has('thompson-20')).toBe(true)
    expect(ids.has('yamal-goal')).toBe(false)
  })
})

import { describe, it, expect } from 'vitest'
import { buildPoolForMatch } from './pool-builder'
import { SAMPLE_MATCH } from './sample-match'
import { generateCard } from './card-generator'
import { teamsFromWcMatchId } from './players-wc'

// A World Cup fixture id — exercises the football pool path (still live for
// real wc- fixtures).
const WC_MATCH = 'wc-por-esp-2026-07-06'
// The default sports match id used by both the client (app/hits/[card_id]) and
// the server (app/api/cards) for a plain demo buy. Keep in sync with
// DEFAULT_MATCH_BY_TYPE — the demo card's SAMPLE_MATCH timeline draws from this
// pool (the static PBA CANDIDATE_EVENTS).
const DEMO_MATCH = 'demo-pba-perpetual'

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
  const ids = new Set(buildPoolForMatch(DEMO_MATCH).map((e) => e.id))
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

describe('pool v2 gating', () => {
  it('freezes v1 matches (sold cards) on the original pool', async () => {
    const { buildPoolForMatch, isWcPoolV2 } = await import('./pool-builder')
    const v1 = buildPoolForMatch('wc-arg-egy-2026-07-07')
    expect(isWcPoolV2('wc-arg-egy-2026-07-07')).toBe(false)
    expect(v1.some((e) => e.id === 'any-offside')).toBe(false)
  })
  it('gives future matches the easy tiles', async () => {
    const { buildPoolForMatch, isWcPoolV2 } = await import('./pool-builder')
    const v2 = buildPoolForMatch('wc-sui-col-2026-07-07')
    expect(isWcPoolV2('wc-sui-col-2026-07-07')).toBe(true)
    for (const id of ['any-offside', 'corner-5', 'saves-3', 'fouls-10']) {
      expect(v2.some((e) => e.id === id)).toBe(true)
    }
  })
  it('keeps weighted v2 card generation deterministic per card id', async () => {
    const { generateCard } = await import('./card-generator')
    const a = generateCard('WEIGHT1', 20, 'sports', 'wc-sui-col-2026-07-07')
    const b = generateCard('WEIGHT1', 20, 'sports', 'wc-sui-col-2026-07-07')
    expect(a.cells.map((c) => c.id)).toEqual(b.cells.map((c) => c.id))
    expect(new Set(a.cells.map((c) => c.id)).size).toBe(25) // 24 distinct + free
  })
})

describe('pool v2 feed-blind removal', () => {
  it('drops manual-only tiles from v2, keeps them frozen in v1', async () => {
    const { buildPoolForMatch } = await import('./pool-builder')
    const v2ids = new Set(buildPoolForMatch('wc-sui-col-2026-07-07').map((e) => e.id))
    const v1ids = new Set(buildPoolForMatch('wc-arg-egy-2026-07-07').map((e) => e.id))
    for (const id of ['woodwork', 'header-goal', 'free-kick-goal', 'goal-outside-box', 'keeper-save-pen']) {
      expect(v2ids.has(id)).toBe(false)
      expect(v1ids.has(id)).toBe(true)
    }
    // API-Football-covered keys stay in
    for (const id of ['var-review', 'var-overturn', 'penalty-missed']) {
      expect(v2ids.has(id)).toBe(true)
    }
  })
})

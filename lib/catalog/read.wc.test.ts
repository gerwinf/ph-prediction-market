import { describe, test, expect } from 'vitest'
import { mapWcFixtureRow, mapWcFixtureRows, mapWcContenderRow } from './read'

/** A raw markets row as returned by the SELECT in read.ts. */
function fixtureRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'row-uuid-1',
    kind: 'wc_fixture',
    category: null,
    title: 'Spain vs Portugal',
    fixture_id: null,
    status: 'approved',
    interest_score: 0,
    source: 'human',
    payload: {
      home: { name: 'Spain', iso: 'es' },
      away: { name: 'Portugal', iso: 'pt' },
      group: 'E',
      kickoff_iso: '2026-06-18T19:00:00.000Z',
      venue: 'MetLife Stadium',
      slug: 'wc-esp-por',
      fallback: { home: 47, draw: 27, away: 26 },
    },
    ...overrides,
  }
}

function contenderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'row-uuid-2',
    kind: 'wc_contender',
    category: null,
    title: 'Spain',
    fixture_id: null,
    status: 'approved',
    interest_score: 17,
    source: 'human',
    payload: {
      name: 'Spain',
      iso: 'es',
      slug: 'wc-spain',
      fallback_pct: 17,
      vol: '₱5.2M',
      delta: 1,
    },
    ...overrides,
  }
}

describe('mapWcFixtureRow', () => {
  test('maps snake_case payload + row id into the camelCase Fixture shape', () => {
    const f = mapWcFixtureRow(fixtureRow() as never)
    expect(f).toEqual({
      id: 'row-uuid-1',
      home: { name: 'Spain', iso: 'es' },
      away: { name: 'Portugal', iso: 'pt' },
      group: 'E',
      kickoffISO: '2026-06-18T19:00:00.000Z',
      venue: 'MetLife Stadium',
      slug: 'wc-esp-por',
      fallback: { home: 47, draw: 27, away: 26 },
    })
  })

  test('omits optional venue/slug when absent in payload', () => {
    const row = fixtureRow({
      payload: {
        home: { name: 'Germany', iso: 'de' },
        away: { name: 'Japan', iso: 'jp' },
        group: 'D',
        kickoff_iso: '2026-06-19T19:00:00.000Z',
        fallback: { home: 60, draw: 23, away: 17 },
      },
    })
    const f = mapWcFixtureRow(row as never)
    expect('venue' in f).toBe(false)
    expect('slug' in f).toBe(false)
    expect(f.id).toBe('row-uuid-1')
  })
})

describe('mapWcFixtureRows', () => {
  test('sorts ascending by kickoffISO regardless of input order', () => {
    const later = fixtureRow({ id: 'b', payload: { ...fixtureRow().payload, kickoff_iso: '2026-06-20T22:00:00.000Z' } })
    const earlier = fixtureRow({ id: 'a', payload: { ...fixtureRow().payload, kickoff_iso: '2026-06-17T19:00:00.000Z' } })
    const out = mapWcFixtureRows([later, earlier] as never)
    expect(out.map((f) => f.id)).toEqual(['a', 'b'])
  })
})

describe('mapWcContenderRow', () => {
  test('maps snake_case payload into the camelCase Contender shape', () => {
    const c = mapWcContenderRow(contenderRow() as never)
    expect(c).toEqual({
      name: 'Spain',
      iso: 'es',
      slug: 'wc-spain',
      fallbackPct: 17,
      vol: '₱5.2M',
      delta: 1,
    })
  })

  test('omits optional slug when absent', () => {
    const row = contenderRow({
      payload: { name: 'Germany', iso: 'de', fallback_pct: 6, vol: '₱2.1M', delta: -2 },
    })
    const c = mapWcContenderRow(row as never)
    expect('slug' in c).toBe(false)
    expect(c.fallbackPct).toBe(6)
  })
})

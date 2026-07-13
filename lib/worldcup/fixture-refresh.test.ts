import { describe, it, expect } from 'vitest'
import {
  wcFixtureRowsFromFifa,
  planWcFixtureSync,
  type FifaMatch,
  type WcFixtureInsert,
  type ExistingWcRow,
} from './fixture-refresh'

const NOW = new Date('2026-06-16T12:00:00Z')

const match = (over: Partial<FifaMatch>): FifaMatch => ({
  IdMatch: '400128082',
  Date: '2026-06-18T19:00:00Z',
  Home: { IdCountry: 'ESP', TeamName: [{ Locale: 'en-GB', Description: 'Spain' }] },
  Away: { IdCountry: 'POR', TeamName: [{ Locale: 'en-GB', Description: 'Portugal' }] },
  GroupName: [{ Locale: 'en-GB', Description: 'Group E' }],
  StageName: [{ Locale: 'en-GB', Description: 'First stage' }],
  Stadium: {
    Name: [{ Locale: 'en-GB', Description: 'MetLife Stadium' }],
    CityName: [{ Locale: 'en-GB', Description: 'East Rutherford' }],
  },
  ...over,
})

describe('wcFixtureRowsFromFifa', () => {
  it('maps a resolved, in-window match to an insertable wc_fixture row', () => {
    const [row] = wcFixtureRowsFromFifa([match({})], NOW)
    expect(row.kind).toBe('wc_fixture')
    expect(row.category).toBe('worldcup')
    expect(row.title).toBe('Spain vs Portugal')
    expect(row.fixture_id).toBeNull()
    expect(row.status).toBe('approved')
    expect(row.source).toBe('feed:fifa')
    expect(row.reviewed_by).toBe('feed')
    expect(row.payload.home).toEqual({ name: 'Spain', iso: 'es' })
    expect(row.payload.away).toEqual({ name: 'Portugal', iso: 'pt' })
    expect(row.payload.group).toBe('E') // "Group " prefix stripped
    expect(row.payload.kickoff_iso).toBe('2026-06-18T19:00:00.000Z')
    expect(row.payload.venue).toBe('MetLife Stadium, East Rutherford')
    expect(row.payload.fifa_match_id).toBe('400128082')
  })

  it('derives fallback odds that sum to 100 and favour the stronger side', () => {
    const [row] = wcFixtureRowsFromFifa([match({})], NOW)
    const { home, draw, away } = row.payload.fallback
    expect(home + draw + away).toBe(100)
    expect(home).toBeGreaterThan(away) // Spain (94) stronger than Portugal (88)
  })

  it('applies name overrides and flag ISO mapping (e.g. Korea, England)', () => {
    const [row] = wcFixtureRowsFromFifa(
      [
        match({
          Home: { IdCountry: 'KOR', TeamName: [{ Locale: 'en-GB', Description: 'Korea Republic' }] },
          Away: { IdCountry: 'ENG', TeamName: [{ Locale: 'en-GB', Description: 'England' }] },
        }),
      ],
      NOW
    )
    expect(row.payload.home).toEqual({ name: 'South Korea', iso: 'kr' })
    expect(row.payload.away).toEqual({ name: 'England', iso: 'gb' })
  })

  it('skips unresolved (TBD) knockout matches', () => {
    expect(wcFixtureRowsFromFifa([match({ Home: null })], NOW)).toEqual([])
    expect(
      wcFixtureRowsFromFifa([match({ Away: { IdCountry: 'POR', TeamName: [] } })], NOW)
    ).toEqual([])
  })

  it('skips matches beyond the forward horizon but keeps yesterday’s', () => {
    expect(wcFixtureRowsFromFifa([match({ Date: '2026-07-01T19:00:00Z' })], NOW)).toEqual([]) // >8d
    // Kicked off ~yesterday — still shown briefly as "latest result".
    const rows = wcFixtureRowsFromFifa([match({ Date: '2026-06-15T20:00:00Z' })], NOW)
    expect(rows).toHaveLength(1)
    // Two days ago — rolled off.
    expect(wcFixtureRowsFromFifa([match({ Date: '2026-06-14T20:00:00Z' })], NOW)).toEqual([])
  })

  it('caps the board at 12 fixtures, soonest first', () => {
    const many: FifaMatch[] = Array.from({ length: 20 }, (_, i) =>
      match({
        IdMatch: `m-${i}`,
        Date: new Date(NOW.getTime() + (i + 1) * 3 * 60 * 60 * 1000).toISOString(),
      })
    )
    const rows = wcFixtureRowsFromFifa(many, NOW)
    expect(rows).toHaveLength(12)
    expect(rows[0].payload.fifa_match_id).toBe('m-0')
  })
})

describe('planWcFixtureSync (insert-new + prune-past-feed, option B)', () => {
  const cand = (fifaId: string, over: Partial<WcFixtureInsert['payload']> = {}): WcFixtureInsert => ({
    kind: 'wc_fixture',
    category: 'worldcup',
    title: 'A vs B',
    fixture_id: null,
    status: 'approved',
    interest_score: 0,
    source: 'feed:fifa',
    reviewed_by: 'feed',
    payload: {
      home: { name: 'A', iso: 'a' },
      away: { name: 'B', iso: 'b' },
      group: 'A',
      kickoff_iso: '2026-06-18T19:00:00.000Z',
      fallback: { home: 50, draw: 25, away: 25 },
      fifa_match_id: fifaId,
      ...over,
    },
  })

  const existing = (over: Partial<ExistingWcRow>): ExistingWcRow => ({
    id: 'row-1',
    source: 'feed:fifa',
    fifaMatchId: 'm-1',
    kickoffISO: '2026-06-18T19:00:00.000Z',
    ...over,
  })

  it('inserts only candidates whose FIFA match id is not already present', () => {
    const plan = planWcFixtureSync([cand('m-1'), cand('m-2')], [existing({ fifaMatchId: 'm-1' })], NOW)
    expect(plan.toInsert.map((r) => r.payload.fifa_match_id)).toEqual(['m-2'])
  })

  it('never re-inserts an existing fixture, preserving its ops odds override', () => {
    const plan = planWcFixtureSync([cand('m-1')], [existing({ fifaMatchId: 'm-1' })], NOW)
    expect(plan.toInsert).toEqual([])
  })

  it('prunes feed-sourced rows whose kickoff has rolled past', () => {
    const plan = planWcFixtureSync(
      [],
      [existing({ id: 'old', fifaMatchId: 'm-old', kickoffISO: '2026-06-10T19:00:00.000Z' })],
      NOW
    )
    expect(plan.pruneIds).toEqual(['old'])
  })

  it('never prunes an operator-created row, even when past', () => {
    const plan = planWcFixtureSync(
      [],
      [existing({ id: 'ops', source: 'human', kickoffISO: '2026-06-10T19:00:00.000Z' })],
      NOW
    )
    expect(plan.pruneIds).toEqual([])
  })

  it('never prunes an upcoming feed row (its ops odds override survives)', () => {
    const plan = planWcFixtureSync(
      [],
      [existing({ id: 'live', kickoffISO: '2026-06-20T19:00:00.000Z' })],
      NOW
    )
    expect(plan.pruneIds).toEqual([])
  })
})

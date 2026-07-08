import { describe, it, expect } from 'vitest'
import { wcFixtureRowsFromCalendar } from './fixture-ingest'
import type { FifaCalendarMatch } from './feed-fifa'

const NOW = new Date('2026-07-08T12:00:00Z')

const match = (over: Partial<FifaCalendarMatch>): FifaCalendarMatch => ({
  IdMatch: 'x',
  Date: '2026-07-10T19:00:00Z',
  Home: { IdCountry: 'ESP', TeamName: [{ Locale: 'en-GB', Description: 'Spain' }] },
  Away: { IdCountry: 'BEL', TeamName: [{ Locale: 'en-GB', Description: 'Belgium' }] },
  StageName: [{ Locale: 'en-GB', Description: 'Quarter-final' }],
  ...over,
})

describe('wcFixtureRowsFromCalendar', () => {
  it('maps a resolved, registered, upcoming match to a fixture row', () => {
    const rows = wcFixtureRowsFromCalendar([match({})], NOW)
    expect(rows).toEqual([
      {
        id: 'wc-esp-bel-2026-07-10',
        card_type: 'sports',
        match_label: 'Spain vs Belgium — World Cup 2026 · Quarter-final',
        starts_at: '2026-07-10T19:00:00.000Z',
        status: 'scheduled',
      },
    ])
  })
  it('skips TBD (unresolved) knockout matches', () => {
    expect(wcFixtureRowsFromCalendar([match({ Home: null })], NOW)).toEqual([])
    expect(wcFixtureRowsFromCalendar([match({ Away: { IdCountry: undefined } })], NOW)).toEqual([])
  })
  it('skips matches with an unregistered squad (would get an unlightable pool)', () => {
    const rows = wcFixtureRowsFromCalendar(
      [match({ Away: { IdCountry: 'MEX', TeamName: [{ Locale: 'en-GB', Description: 'Mexico' }] } })],
      NOW
    )
    expect(rows).toEqual([])
  })
  it('skips already-started and beyond-horizon matches', () => {
    expect(wcFixtureRowsFromCalendar([match({ Date: '2026-07-08T10:00:00Z' })], NOW)).toEqual([]) // past
    expect(wcFixtureRowsFromCalendar([match({ Date: '2026-07-25T19:00:00Z' })], NOW)).toEqual([]) // >8d
  })
  it('keeps the id date in UTC even for late-night kickoffs', () => {
    const rows = wcFixtureRowsFromCalendar(
      [match({ Date: '2026-07-12T01:00:00Z', Home: { IdCountry: 'ARG', TeamName: [{ Locale: 'en-GB', Description: 'Argentina' }] }, Away: { IdCountry: 'SUI', TeamName: [{ Locale: 'en-GB', Description: 'Switzerland' }] } })],
      NOW
    )
    expect(rows[0].id).toBe('wc-arg-sui-2026-07-12')
  })
  it('omits the stage suffix when FIFA has none', () => {
    const rows = wcFixtureRowsFromCalendar([match({ StageName: undefined })], NOW)
    expect(rows[0].match_label).toBe('Spain vs Belgium — World Cup 2026')
  })
})

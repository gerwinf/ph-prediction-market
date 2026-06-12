import { describe, it, expect } from 'vitest'
import { matchState, selectSpotlight, flagUrl, countdownParts, type Fixture } from './state'

// Minimal fixture factory — only the fields the helpers read.
function fx(id: string, kickoffISO: string): Fixture {
  return {
    id,
    home: { name: 'Home', iso: 'us' },
    away: { name: 'Away', iso: 'mx' },
    group: 'A',
    kickoffISO,
    fallback: { home: 40, draw: 30, away: 30 },
  }
}

const KICK = '2026-06-12T18:00:00.000Z'
const before = new Date('2026-06-12T17:00:00.000Z')
const during = new Date('2026-06-12T18:45:00.000Z')
const after = new Date('2026-06-12T21:00:00.000Z')

describe('matchState', () => {
  it('is scheduled before kickoff', () => {
    expect(matchState(KICK, before)).toBe('scheduled')
  })
  it('is live within ~120 min of kickoff', () => {
    expect(matchState(KICK, during)).toBe('live')
  })
  it('is final well after kickoff', () => {
    expect(matchState(KICK, after)).toBe('final')
  })
  it('is live exactly at kickoff (lower boundary inclusive)', () => {
    expect(matchState(KICK, new Date(KICK))).toBe('live')
  })
  it('is final exactly at kickoff + 120 min (upper boundary exclusive)', () => {
    expect(matchState(KICK, new Date('2026-06-12T20:00:00.000Z'))).toBe('final')
  })
})

describe('selectSpotlight', () => {
  const live = fx('live', KICK)
  const upcoming = fx('upcoming', '2026-06-13T18:00:00.000Z')
  const done = fx('done', '2026-06-11T18:00:00.000Z')

  it('prefers a live match', () => {
    expect(selectSpotlight([done, upcoming, live], during)?.id).toBe('live')
  })
  it('picks the earliest kickoff when multiple matches are live', () => {
    const liveEarly = fx('early', '2026-06-12T17:00:00.000Z')
    const liveLate = fx('late', '2026-06-12T18:00:00.000Z')
    expect(selectSpotlight([liveLate, liveEarly], during)?.id).toBe('early')
  })
  it('falls back to the nearest upcoming when none live', () => {
    expect(selectSpotlight([done, upcoming], before)?.id).toBe('upcoming')
  })
  it('falls back to the most recent final when none live or upcoming', () => {
    expect(selectSpotlight([done], after)?.id).toBe('done')
  })
  it('returns null for no fixtures', () => {
    expect(selectSpotlight([], during)).toBeNull()
  })
})

describe('flagUrl', () => {
  it('builds a flagcdn URL for an ISO code, lowercased', () => {
    expect(flagUrl('US', 80)).toBe('https://flagcdn.com/w80/us.png')
  })
  it('defaults to width 80', () => {
    expect(flagUrl('mx')).toBe('https://flagcdn.com/w80/mx.png')
  })
})

describe('countdownParts', () => {
  it('decomposes a future kickoff', () => {
    const now = new Date('2026-06-12T16:59:50.000Z') // 1h 0m 10s before KICK
    expect(countdownParts(KICK, now)).toEqual({ d: 0, h: 1, m: 0, s: 10 })
  })
  it('clamps to zero once kickoff has passed', () => {
    expect(countdownParts(KICK, after)).toEqual({ d: 0, h: 0, m: 0, s: 0 })
  })
})

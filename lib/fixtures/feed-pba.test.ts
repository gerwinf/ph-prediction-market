import { describe, test, expect } from 'vitest'
import { mapPbaScheduleToFixtures } from './feed-pba'
import type { RawScheduleGame } from './types'

// Fixed clock: 2026-06-10 12:00 UTC (= 2026-06-10 20:00 PHT).
const NOW = Date.UTC(2026, 5, 10, 12, 0, 0)

function game(overrides: Partial<RawScheduleGame> = {}): RawScheduleGame {
  return {
    dateText: 'Fri, Jun 12',
    timeText: '07:30 PM',
    venue: 'Smart Araneta Coliseum',
    teamA: 'BARANGAY GINEBRA SAN MIGUEL',
    teamB: 'TNT TROPANG 5G',
    ...overrides,
  }
}

describe('mapPbaScheduleToFixtures', () => {
  test('maps a well-formed game to a scheduled sports fixture', () => {
    const [f] = mapPbaScheduleToFixtures([game()], NOW)
    expect(f.card_type).toBe('sports')
    expect(f.status).toBe('scheduled')
    expect(f.source).toBe('feed:pba')
    expect(f.venue).toBe('Smart Araneta Coliseum')
    expect(f.match_label).toBe('Ginebra vs TNT')
  })

  test('converts PH local tip-off to UTC (07:30 PM PHT -> 11:30 UTC)', () => {
    const [f] = mapPbaScheduleToFixtures([game()], NOW)
    expect(f.starts_at).toBe('2026-06-12T11:30:00.000Z')
  })

  test('builds a deterministic id from team codes + PH date', () => {
    const [f] = mapPbaScheduleToFixtures([game()], NOW)
    expect(f.id).toBe('pba-gin-tnt-2026-06-12')
  })

  test('does not misclassify Ginebra (contains "San Miguel") as San Miguel', () => {
    const [f] = mapPbaScheduleToFixtures(
      [game({ teamA: 'BARANGAY GINEBRA SAN MIGUEL', teamB: 'SAN MIGUEL BEERMEN' })],
      NOW
    )
    expect(f.match_label).toBe('Ginebra vs San Miguel')
    expect(f.id).toBe('pba-gin-smb-2026-06-12')
  })

  test('infers next year when the game month is before the current month', () => {
    // now = June 2026; a January game is Jan 2027, not Jan 2026.
    const [f] = mapPbaScheduleToFixtures(
      [game({ dateText: 'Thu, Jan 8', timeText: '05:00 PM' })],
      NOW
    )
    expect(f.starts_at).toBe('2027-01-08T09:00:00.000Z')
  })

  test('drops games that have already started', () => {
    // 2026-06-10 06:00 PM PHT = 10:00 UTC, before NOW (12:00 UTC).
    const out = mapPbaScheduleToFixtures(
      [game({ dateText: 'Wed, Jun 10', timeText: '06:00 PM' })],
      NOW
    )
    expect(out).toHaveLength(0)
  })

  test('dedupes repeated rows for the same game', () => {
    const out = mapPbaScheduleToFixtures([game(), game()], NOW)
    expect(out).toHaveLength(1)
  })

  test('maps all twelve PBA teams to clean labels', () => {
    const pairs: Array<[string, string]> = [
      ['MERALCO BOLTS', 'Meralco'],
      ['MAGNOLIA HOTSHOTS PALE PILSEN', 'Magnolia'],
      ['NLEX ROAD WARRIORS', 'NLEX'],
      ['NORTHPORT BATANG PIER', 'NorthPort'],
      ['CONVERGE FIBERXERS', 'Converge'],
      ['PHOENIX SUPER LPG FUEL MASTERS', 'Phoenix'],
      ['RAIN OR SHINE ELASTO PAINTERS', 'Rain or Shine'],
      ['TERRAFIRMA DYIP', 'Terrafirma'],
      ['BLACKWATER BOSSING', 'Blackwater'],
    ]
    for (const [raw, expected] of pairs) {
      const [f] = mapPbaScheduleToFixtures([game({ teamA: raw, teamB: 'TNT TROPANG 5G' })], NOW)
      expect(f.match_label).toBe(`${expected} vs TNT`)
    }
  })

  test('handles an unknown team without throwing', () => {
    const [f] = mapPbaScheduleToFixtures(
      [game({ teamA: 'GUEST KOREA SELECTION', teamB: 'TNT TROPANG 5G' })],
      NOW
    )
    expect(f.match_label).toContain('vs TNT')
    expect(f.id).toMatch(/^pba-[a-z0-9]+-tnt-2026-06-12$/)
  })

  test('skips rows with an unparseable date or time instead of throwing', () => {
    const out = mapPbaScheduleToFixtures(
      [game({ dateText: 'TBD' }), game({ timeText: 'TBA' }), game()],
      NOW
    )
    expect(out).toHaveLength(1)
  })
})

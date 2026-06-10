import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parsePbaScheduleHtml } from './fetch-pba'

const sample = readFileSync(
  new URL('./__fixtures__/pba-schedule-sample.html', import.meta.url),
  'utf-8'
)

describe('parsePbaScheduleHtml', () => {
  test('extracts the game from real pba.ph markup', () => {
    const games = parsePbaScheduleHtml(sample)
    expect(games).toHaveLength(1)
    expect(games[0]).toEqual({
      dateText: 'Fri, Jun 12',
      timeText: '07:30 PM',
      venue: 'Smart Araneta Coliseum',
      teamA: 'BARANGAY GINEBRA SAN MIGUEL',
      teamB: 'TNT TROPANG 5G',
    })
  })

  test('ignores the commented-out "WEEK | MONTH" heading', () => {
    // The sample ships `<!-- <h2>WEEK 4 | FEBRUARY</h2> -->`; the date must be
    // the real "Fri, Jun 12", not the commented week label.
    const games = parsePbaScheduleHtml(sample)
    expect(games[0].dateText).not.toContain('WEEK')
  })

  test('returns [] for empty or scheduleless markup instead of throwing', () => {
    expect(parsePbaScheduleHtml('')).toEqual([])
    expect(parsePbaScheduleHtml('<div>no games today</div>')).toEqual([])
  })

  test('parses multiple games rendered under one date', () => {
    const twoGames = sample.replace(
      '</section>',
      `<div class="schedule-day"><h2>Sun, Jun 14</h2>
        <div class="schedule-time-venue"><p>05:00 PM</p><p>PhilSports Arena</p></div>
        <div class="schedule-teams">
          <div class="schedule-team"><p class="ms-3">MERALCO BOLTS</p></div>
          <div class="schedule-team"><p class="ms-3">SAN MIGUEL BEERMEN</p></div>
        </div>
      </div></section>`
    )
    const games = parsePbaScheduleHtml(twoGames)
    expect(games).toHaveLength(2)
    expect(games[1].teamA).toBe('MERALCO BOLTS')
    expect(games[1].venue).toBe('PhilSports Arena')
  })
})

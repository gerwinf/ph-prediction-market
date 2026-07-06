import { describe, it, expect } from 'vitest'
import {
  mapFifaTimeline,
  fixtureStatusFromTimeline,
  scoreFromTimeline,
  wcCodesFromMatchId,
  type FifaTimelineEvent,
  type MatchContext,
} from './feed-fifa'
import timeline from './__fixtures__/fifa-timeline-mex-eng.json'

/* Real captured timeline: WC 2026 R16, Mexico 2–3 England (2026-07-06).
 * Story: Rice booked 1'; Bellingham 36' & 38' (0-2); Quiñones 42' (1-2);
 * HT 1-2; red card 54'; Kane pen 60' (1-3); pen given 67'; Jiménez pen 69'
 * (2-3); 14 corners; 6 yellows; no ET. England (away) won, never behind. */
const MEX_ENG: MatchContext = {
  homeIdTeam: '43911', // Mexico
  awayIdTeam: '43942', // England
  homeCode: 'MEX',
  awayCode: 'ENG',
}
const events = timeline.Event as FifaTimelineEvent[]
const keys = new Set(mapFifaTimeline(events, MEX_ENG).map((m) => m.eventKey))

describe('mapFifaTimeline — real Mexico vs England timeline', () => {
  it('maps the scoring shape', () => {
    expect(keys.has('eng-first')).toBe(true) // Bellingham opened
    expect(keys.has('mex-first')).toBe(false)
    expect(keys.has('both-teams-score')).toBe(true)
    expect(keys.has('over-2-goals')).toBe(true) // 5 goals
    expect(keys.has('under-2-goals')).toBe(false)
    expect(keys.has('first-goal-15')).toBe(false) // opener came 36'
    expect(keys.has('injury-time-goal')).toBe(false) // no stoppage goals
  })
  it('maps penalties, cards, corners', () => {
    expect(keys.has('penalty-given')).toBe(true)
    expect(keys.has('penalty-scored')).toBe(true) // Kane 60'
    expect(keys.has('red-card')).toBe(true) // 54'
    expect(keys.has('yellow-card')).toBe(true)
    expect(keys.has('three-yellows')).toBe(true) // 6 bookings
    expect(keys.has('corner-count-10')).toBe(true) // 14 corners
  })
  it('maps half-time and full-time flow', () => {
    expect(keys.has('eng-half-lead')).toBe(true) // 1-2 at the break
    expect(keys.has('mex-half-lead')).toBe(false)
    expect(keys.has('nil-nil-half')).toBe(false)
    expect(keys.has('eng-win')).toBe(true)
    expect(keys.has('mex-win')).toBe(false)
    expect(keys.has('comeback-win')).toBe(false) // England never trailed
    expect(keys.has('clean-sheet')).toBe(false) // 2-3
    expect(keys.has('goes-to-et')).toBe(false)
  })
  it('never emits a key twice', () => {
    const all = mapFifaTimeline(events, MEX_ENG).map((m) => m.eventKey)
    expect(new Set(all).size).toBe(all.length)
  })
  it('carries minute + description for the ticker', () => {
    const first = mapFifaTimeline(events, MEX_ENG).find((m) => m.eventKey === 'eng-first')!
    expect(first.minute).toContain('36')
    expect(first.description).toContain('BELLINGHAM')
  })
})

describe('mapFifaTimeline — POR/ESP player mapping (synthetic FIFA-shaped events)', () => {
  const POR_ESP: MatchContext = {
    homeIdTeam: '43963',
    awayIdTeam: '43969',
    homeCode: 'POR',
    awayCode: 'ESP',
  }
  const ev = (over: Partial<FifaTimelineEvent>): FifaTimelineEvent => ({
    EventId: 'x', Type: 0, MatchMinute: "10'", Period: 3,
    HomeGoals: 0, AwayGoals: 0, ...over,
    EventDescription: [{ Locale: 'en-GB', Description: over.EventDescription?.[0]?.Description ?? '' }],
  })
  const d = (s: string) => [{ Locale: 'en-GB', Description: s }]

  it('matches players by normalized name (diacritics + FIFA caps)', () => {
    const out = mapFifaTimeline(
      [
        ev({ Type: 0, IdTeam: '43969', AwayGoals: 1, EventDescription: d('Lamine YAMAL (Spain) scores!!') }),
        ev({ Type: 2, IdTeam: '43963', EventDescription: d('Bruno FERNANDES (Portugal) is booked by the referee.') }),
        ev({ Type: 0, IdTeam: '43963', HomeGoals: 1, AwayGoals: 1, MatchMinute: "70'", EventDescription: d('Gonçalo RAMOS (Portugal) scores!!') }),
      ],
      POR_ESP
    )
    const k = new Set(out.map((m) => m.eventKey))
    expect(k.has('yamal-goal')).toBe(true)
    expect(k.has('yamal-sot')).toBe(true) // goal implies SoT
    expect(k.has('esp-first')).toBe(true)
    expect(k.has('bruno-card')).toBe(true)
    expect(k.has('gramos-goal')).toBe(true) // Gonçalo Ramos, diacritic-normalized
    expect(k.has('both-teams-score')).toBe(true)
  })

  it('fires a brace on the second goal by the same player', () => {
    const out = mapFifaTimeline(
      [
        ev({ Type: 0, IdTeam: '43969', AwayGoals: 1, EventDescription: d('Lamine YAMAL (Spain) scores!!') }),
        ev({ Type: 0, IdTeam: '43969', AwayGoals: 2, MatchMinute: "55'", EventDescription: d('Lamine YAMAL (Spain) scores!!') }),
      ],
      POR_ESP
    )
    const k = new Set(out.map((m) => m.eventKey))
    expect(k.has('yamal-brace')).toBe(true)
  })

  it('maps attempt-followed-by-save to the shooter shot-on-target', () => {
    const out = mapFifaTimeline(
      [
        ev({ Type: 12, IdTeam: '43969', EventDescription: d('Lamine YAMAL (Spain) attempts an effort on goal.') }),
        ev({ Type: 57, IdTeam: '43963', EventDescription: d('The goalkeeper of Portugal pulls off a save.') }),
      ],
      POR_ESP
    )
    expect(out.map((m) => m.eventKey)).toContain('yamal-sot')
  })

  it('fires first-goal-15 only for a real early goal (not stoppage notation)', () => {
    const early = mapFifaTimeline(
      [ev({ Type: 0, IdTeam: '43963', HomeGoals: 1, MatchMinute: "9'", EventDescription: d('X scores') })],
      POR_ESP
    )
    expect(early.map((m) => m.eventKey)).toContain('first-goal-15')
    const stoppage = mapFifaTimeline(
      [ev({ Type: 0, IdTeam: '43963', HomeGoals: 1, MatchMinute: "45'+2'", EventDescription: d('X scores') })],
      POR_ESP
    )
    const k = new Set(stoppage.map((m) => m.eventKey))
    expect(k.has('first-goal-15')).toBe(false)
    expect(k.has('injury-time-goal')).toBe(true)
  })

  it('decides a penalty-shootout winner from HomePenaltyGoals', () => {
    const out = mapFifaTimeline(
      [ev({ Type: 26, HomeGoals: 1, AwayGoals: 1, HomePenaltyGoals: 4, AwayPenaltyGoals: 3, MatchMinute: "120'" })],
      POR_ESP
    )
    const k = new Set(out.map((m) => m.eventKey))
    expect(k.has('por-win')).toBe(true)
    expect(k.has('esp-win')).toBe(false)
    expect(k.has('under-2-goals')).toBe(true) // 1-1
  })
})

describe('wcCodesFromMatchId', () => {
  it('parses any wc fixture id, not just curated squads', () => {
    expect(wcCodesFromMatchId('wc-por-esp-2026-07-06')).toEqual(['POR', 'ESP'])
    expect(wcCodesFromMatchId('wc-mex-eng-2026-07-06')).toEqual(['MEX', 'ENG'])
  })
  it('rejects non-wc and malformed ids', () => {
    expect(wcCodesFromMatchId('pba-gin-ros-2026-05-24')).toBeNull()
    expect(wcCodesFromMatchId('wc-por-esp')).toBeNull()
    expect(wcCodesFromMatchId('demo-pba-perpetual')).toBeNull()
  })
})

describe('fixtureStatusFromTimeline', () => {
  it('walks scheduled → live → final off timeline content', () => {
    expect(fixtureStatusFromTimeline([])).toBe('scheduled')
    expect(fixtureStatusFromTimeline([{ Type: 7 }])).toBe('live')
    expect(fixtureStatusFromTimeline(events)).toBe('final') // real finished match
  })
})

describe('scoreFromTimeline', () => {
  it('returns the last reported score of the real match', () => {
    expect(scoreFromTimeline(events)).toEqual({ home: 2, away: 3 }) // MEX 2–3 ENG
  })
  it('returns null before anything reports a score', () => {
    expect(scoreFromTimeline([])).toBeNull()
    expect(scoreFromTimeline([{ Type: 7 }])).toBeNull() // period start, no goals fields
  })
  it('reads the latest event carrying goals, skipping trailing ones without', () => {
    expect(
      scoreFromTimeline([
        { Type: 0, HomeGoals: 1, AwayGoals: 0 },
        { Type: 2 }, // booking without goals fields
      ])
    ).toEqual({ home: 1, away: 0 })
  })
})

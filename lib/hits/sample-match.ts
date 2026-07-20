import type { Match } from './types'

// 90-second simulated PBA game (Ginebra vs Rain or Shine). A full game
// compressed. Used by /hits/[card_id] when not in ?live=1 mode. Events fire
// at atMs offsets from page mount.
//
// INVARIANT: every eventId below must exist in the pool that
// buildPoolForMatch('demo-pba-perpetual') returns (the static PBA
// CANDIDATE_EVENTS pool) — otherwise the ticker fires an event that lights no
// cell. Enforced by lib/hits/pool-builder.test.ts.

export const SAMPLE_MATCH: Match = {
  id: 'demo-pba-gin-ros',
  league: "PBA · Commissioner's Cup",
  home: 'Ginebra',
  homeColor: '#c8102e',
  away: 'Rain or Shine',
  awayColor: '#fbbf24',
  tipoff: 'Tonight · 7:30 PM PHT',
  durationMs: 90_000,
  // `score` = running [home, away] points after the event — drives the demo
  // scoreboard the same way home_score/away_score on the fixture row does
  // for a live game.
  timeline: [
    { atMs:  4_000, gameClock: 'Q1',       eventId: 'tiongson-3ball',  description: 'Tiongson splashes an early triple', score: [0, 3] },
    { atMs: 10_000, gameClock: 'Q1',       eventId: 'thompson-steal',  description: 'Thompson steals it, coast-to-coast', score: [4, 3] },
    { atMs: 16_000, gameClock: 'End Q1',   eventId: 'ros-q1',          description: 'Rain or Shine grab the first', score: [18, 22] },
    { atMs: 22_000, gameClock: 'Q2',       eventId: 'brownlee-dunk',   description: 'Brownlee flushes it home', score: [28, 30] },
    { atMs: 30_000, gameClock: 'Halftime', eventId: 'ros-halftime',    description: 'Rain or Shine lead at the break', score: [44, 49] },
    { atMs: 38_000, gameClock: 'Q3',       eventId: 'thompson-20',     description: 'Thompson hits 20, Ginebra surging', score: [57, 58] },
    { atMs: 46_000, gameClock: 'Q3',       eventId: 'ros-import-20',   description: 'RoS import answers with 20', score: [63, 66] },
    { atMs: 54_000, gameClock: 'End Q3',   eventId: 'run-10-0',        description: '10-0 Ginebra run flips it', score: [73, 66] },
    { atMs: 60_000, gameClock: 'Q4',       eventId: 'lead-changes-5',  description: 'Fifth lead change of the night', score: [78, 79] },
    { atMs: 66_000, gameClock: 'Q4',       eventId: 'brownlee-25',     description: 'Brownlee crosses 25', score: [85, 82] },
    { atMs: 74_000, gameClock: 'Q4',       eventId: 'nambatac-15',     description: 'Nambatac keeps RoS alive', score: [87, 88] },
    { atMs: 82_000, gameClock: "Q4 0:20",  eventId: 'clutch-ft-make',  description: 'Ginebra splash clutch free throws', score: [92, 90] },
    { atMs: 88_000, gameClock: 'Final',    eventId: 'ginebra-q4',      description: 'Ginebra steal the fourth · Ginebra 96, RoS 91', score: [96, 91] },
  ],
}

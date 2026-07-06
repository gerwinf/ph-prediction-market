import type { Match } from './types'

// 90-second simulated World Cup Round of 16 match (Portugal vs Spain). 90 match
// minutes compressed. Used by /hits/[card_id] when not in ?live=1 mode. Events
// fire at atMs offsets from page mount.
//
// INVARIANT: every eventId below must exist in the pool that
// buildPoolForMatch('wc-por-esp-2026-07-06') returns — otherwise the ticker
// fires an event that lights no cell. Enforced by lib/hits/pool-builder.test.ts.

export const SAMPLE_MATCH: Match = {
  id: 'wc-por-esp-r16',
  league: 'FIFA World Cup 2026 · Round of 16',
  home: 'Portugal',
  homeColor: '#006600',
  away: 'Spain',
  awayColor: '#c60b1e',
  tipoff: 'Tonight · 3:00 AM PHT',
  durationMs: 90_000,
  timeline: [
    { atMs:  4_000, gameClock: "6'",     eventId: 'yamal-sot',        description: 'Yamal forces an early save' },
    { atMs: 10_000, gameClock: "12'",    eventId: 'first-goal-15',    description: 'Spain break the deadlock early' },
    { atMs: 16_000, gameClock: "23'",    eventId: 'esp-first',        description: 'Spain score first' },
    { atMs: 22_000, gameClock: "34'",    eventId: 'bruno-card',       description: 'Bruno Fernandes booked' },
    { atMs: 30_000, gameClock: 'HT',     eventId: 'esp-half-lead',    description: 'Spain lead at the break' },
    { atMs: 38_000, gameClock: "52'",    eventId: 'leao-goal',        description: 'Leão equalizes for Portugal' },
    { atMs: 46_000, gameClock: "61'",    eventId: 'both-teams-score', description: 'Both teams have scored' },
    { atMs: 54_000, gameClock: "68'",    eventId: 'var-review',       description: 'VAR checks a penalty shout' },
    { atMs: 60_000, gameClock: "70'",    eventId: 'penalty-given',    description: 'Penalty to Spain' },
    { atMs: 66_000, gameClock: "71'",    eventId: 'yamal-goal',       description: 'Yamal converts from the spot' },
    { atMs: 74_000, gameClock: "84'",    eventId: 'yellow-card',      description: 'Late booking as it gets tense' },
    { atMs: 82_000, gameClock: "90+3'",  eventId: 'injury-time-goal', description: 'Portugal push in stoppage time' },
    { atMs: 88_000, gameClock: 'FT',     eventId: 'esp-win',          description: 'Spain edge it · Spain 2, Portugal 1' },
  ],
}

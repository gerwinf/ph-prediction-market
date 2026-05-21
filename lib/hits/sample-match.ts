import type { Match } from './types'

// 90-second simulated PBA Comm's Cup semis match (Ginebra vs Rain or
// Shine). 48 game minutes compressed. Used by /hits/[card_id] when not
// in ?live=1 mode. Events fire at atMs offsets from page mount.
// All eventIds must exist in lib/hits/events.ts CANDIDATE_EVENTS pool.

export const SAMPLE_MATCH: Match = {
  id: 'gin-ros-cc-semi-g3',
  league: "PBA Comm's Cup · Semis",
  home: 'Ginebra',
  homeColor: '#c8102e',
  away: 'Rain or Shine',
  awayColor: '#fbbf24',
  tipoff: 'Sunday · 7:00 PM PHT',
  durationMs: 90_000,
  timeline: [
    { atMs:  3_000, gameClock: 'Q1 11:32', eventId: 'first-min-3',       description: 'Asistio opens with a deep three' },
    { atMs:  8_000, gameClock: 'Q1 09:14', eventId: 'early-timeout',     description: 'Coach Cone calls early TO' },
    { atMs: 14_000, gameClock: 'Q1 03:11', eventId: 'brownlee-dunk',     description: 'Brownlee posters RoS import' },
    { atMs: 18_000, gameClock: 'Q1 00:00', eventId: 'ginebra-q1',        description: 'Ginebra takes Q1, 28–24' },
    { atMs: 24_000, gameClock: 'Q2 08:42', eventId: 'travel',            description: 'Travel on Rain or Shine' },
    { atMs: 31_000, gameClock: 'Q2 03:50', eventId: 'belga-rebound',     description: 'Belga grabs his 10th board' },
    { atMs: 36_000, gameClock: 'HALF',     eventId: 'ginebra-halftime',  description: 'Ginebra leads at half 55–51' },
    { atMs: 42_000, gameClock: 'Q3 09:20', eventId: 'asistio-3ball',     description: 'Asistio drops his 3rd three' },
    { atMs: 48_000, gameClock: 'Q3 05:33', eventId: 'coach-challenge',   description: 'Austria challenges a charge call' },
    { atMs: 54_000, gameClock: 'Q3 02:01', eventId: 'fastbreak-dunk',    description: 'Steal → fastbreak slam' },
    { atMs: 60_000, gameClock: 'Q3 00:00', eventId: 'q35-points',        description: 'Rain or Shine drops 38 in Q3' },
    { atMs: 67_000, gameClock: 'Q4 07:14', eventId: 'lead-changes-5',    description: '6th lead change' },
    { atMs: 72_000, gameClock: 'Q4 04:08', eventId: 'mamuyac-clutch',    description: 'Mamuyac clutch basket!' },
    { atMs: 78_000, gameClock: 'Q4 01:22', eventId: 'fouled-out',        description: 'Thompson fouls out' },
    { atMs: 83_000, gameClock: 'Q4 00:08', eventId: 'clutch-ft-make',    description: 'Brownlee 2-for-2 from the line' },
    { atMs: 88_000, gameClock: 'FINAL',    eventId: 'total-200',         description: 'Final · Ginebra 108, RoS 102' },
  ],
}

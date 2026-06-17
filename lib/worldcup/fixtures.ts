import type { Fixture, Team } from './state'

export type Contender = {
  name: string
  iso: string        // ISO 3166-1 alpha-2, lowercase (flagcdn key)
  slug?: string      // winner-market slug in lib/oracle/slugs.ts LIVE_MARKETS
  fallbackPct: number
  vol: string        // curated market-depth label (PH-scale), Polymarket-style
  delta: number      // curated 24h move in pct points (+/-); 0 = flat
}

// Winner leaderboard. Live odds overlay onto fallbackPct where `slug` resolves.
// Ordered high→low by fallback; the page re-sorts by live pct after overlay.
// `vol`/`delta` are curated flavor (market depth + 24h move) — Polymarket-style.
export const CONTENDERS: Contender[] = [
  { name: 'Spain',       iso: 'es', slug: 'wc-spain',     fallbackPct: 17, vol: '₱5.2M', delta: 1 },
  { name: 'France',      iso: 'fr', slug: 'wc-france',    fallbackPct: 16, vol: '₱4.8M', delta: -1 },
  { name: 'Argentina',   iso: 'ar', slug: 'wc-argentina', fallbackPct: 12, vol: '₱6.1M', delta: 2 },
  { name: 'Brazil',      iso: 'br', slug: 'wc-brazil',    fallbackPct: 11, vol: '₱3.4M', delta: -1 },
  // England has no alpha-2 of its own; 'gb' renders the Union Jack on flagcdn.
  { name: 'England',     iso: 'gb', slug: 'wc-england',   fallbackPct: 10, vol: '₱2.9M', delta: 1 },
  { name: 'Portugal',    iso: 'pt',                        fallbackPct: 7,  vol: '₱1.8M', delta: 0 },
  { name: 'Germany',     iso: 'de',                        fallbackPct: 6,  vol: '₱2.1M', delta: -2 },
  { name: 'Netherlands', iso: 'nl',                        fallbackPct: 5,  vol: '₱1.5M', delta: 1 },
]

const T = (name: string, iso: string): Team => ({ name, iso })

// Spotlight + match grid, ordered by kickoff. These are real WC 2026 group-stage
// fixtures (groups, teams, venues, kickoff times verified against the published
// schedule); only the `fallback` odds are curated. A `slug` would point at a
// pinned match market in lib/oracle/slugs.ts (LIVE_MARKETS) when one exists; none
// do today, so every match shows its fallback. Refresh as matchdays pass.
export const FIXTURES: Fixture[] = [
  {
    id: 'wc-eng-cro',
    // England has no alpha-2 of its own; 'gb' renders the Union Jack on flagcdn.
    home: T('England', 'gb'),
    away: T('Croatia', 'hr'),
    group: 'L',
    kickoffISO: '2026-06-17T20:00:00.000Z',
    venue: 'AT&T Stadium, Dallas',
    fallback: { home: 52, draw: 26, away: 22 },
  },
  {
    id: 'wc-mex-kor',
    home: T('Mexico', 'mx'),
    away: T('South Korea', 'kr'),
    group: 'A',
    kickoffISO: '2026-06-19T01:00:00.000Z',
    venue: 'Estadio Akron, Guadalajara',
    fallback: { home: 50, draw: 27, away: 23 },
  },
  {
    id: 'wc-bra-hai',
    home: T('Brazil', 'br'),
    away: T('Haiti', 'ht'),
    group: 'C',
    kickoffISO: '2026-06-20T00:30:00.000Z',
    venue: 'Lincoln Financial Field, Philadelphia',
    fallback: { home: 82, draw: 13, away: 5 },
  },
  {
    id: 'wc-ger-civ',
    home: T('Germany', 'de'),
    away: T('Ivory Coast', 'ci'),
    group: 'E',
    kickoffISO: '2026-06-20T20:00:00.000Z',
    venue: 'BMO Field, Toronto',
    fallback: { home: 68, draw: 20, away: 12 },
  },
  {
    id: 'wc-esp-ksa',
    home: T('Spain', 'es'),
    away: T('Saudi Arabia', 'sa'),
    group: 'H',
    kickoffISO: '2026-06-21T16:00:00.000Z',
    venue: 'Mercedes-Benz Stadium, Atlanta',
    fallback: { home: 80, draw: 14, away: 6 },
  },
]

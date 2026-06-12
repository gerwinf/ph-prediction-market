import type { Fixture, Team } from './state'

export type Contender = {
  name: string
  iso: string        // ISO 3166-1 alpha-2, lowercase (flagcdn key)
  slug?: string      // winner-market slug in lib/oracle/slugs.ts LIVE_MARKETS
  fallbackPct: number
}

// Winner leaderboard. Live odds overlay onto fallbackPct where `slug` resolves.
// Ordered high→low by fallback; the page re-sorts by live pct after overlay.
export const CONTENDERS: Contender[] = [
  { name: 'Spain',       iso: 'es', slug: 'wc-spain',     fallbackPct: 17 },
  { name: 'France',      iso: 'fr', slug: 'wc-france',    fallbackPct: 16 },
  { name: 'Argentina',   iso: 'ar', slug: 'wc-argentina', fallbackPct: 12 },
  { name: 'Brazil',      iso: 'br', slug: 'wc-brazil',    fallbackPct: 11 },
  // England has no alpha-2 of its own; 'gb' renders the Union Jack on flagcdn.
  { name: 'England',     iso: 'gb', slug: 'wc-england',   fallbackPct: 10 },
  { name: 'Portugal',    iso: 'pt',                        fallbackPct: 7 },
  { name: 'Germany',     iso: 'de',                        fallbackPct: 6 },
  { name: 'Netherlands', iso: 'nl',                        fallbackPct: 5 },
]

const T = (name: string, iso: string): Team => ({ name, iso })

// Spotlight + match grid. `slug` points at a SLUG_TO_QUERY match market when one
// exists; otherwise the curated `fallback` odds are shown. Keep kickoffISO times
// realistic and refresh as matchdays pass.
export const FIXTURES: Fixture[] = [
  {
    id: 'wc-mex-rsa',
    home: T('Mexico', 'mx'),
    away: T('South Africa', 'za'),
    group: 'A',
    kickoffISO: '2026-06-12T22:00:00.000Z',
    venue: 'Estadio Azteca',
    slug: 'wc-mex-rsa',
    fallback: { home: 55, draw: 25, away: 20 },
  },
  {
    id: 'wc-arg-alg',
    home: T('Argentina', 'ar'),
    away: T('Algeria', 'dz'),
    group: 'J',
    kickoffISO: '2026-06-17T01:00:00.000Z',
    venue: 'Arrowhead Stadium',
    slug: 'wc-arg-alg',
    fallback: { home: 68, draw: 20, away: 12 },
  },
  {
    id: 'wc-esp-por',
    home: T('Spain', 'es'),
    away: T('Portugal', 'pt'),
    group: 'E',
    kickoffISO: '2026-06-18T19:00:00.000Z',
    venue: 'MetLife Stadium',
    fallback: { home: 47, draw: 27, away: 26 },
  },
  {
    id: 'wc-bra-fra',
    home: T('Brazil', 'br'),
    away: T('France', 'fr'),
    group: 'C',
    kickoffISO: '2026-06-20T22:00:00.000Z',
    venue: 'SoFi Stadium',
    fallback: { home: 41, draw: 28, away: 31 },
  },
]

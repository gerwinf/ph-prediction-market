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

// Spotlight + match grid, ordered by kickoff. Real FIFA World Cup 2026 group-stage
// fixtures (refreshed 2026-06-19; kickoffs in UTC). A `slug` would point at a pinned
// match market in lib/oracle/slugs.ts (LIVE_MARKETS) when one exists; none do today,
// so every match shows its curated `fallback` odds. Refresh as matchdays pass — or
// seed the catalog (scripts/seed-worldcup-catalog.ts) to manage these from
// /ops/markets without a deploy.
export const FIXTURES: Fixture[] = [
  {
    id: 'wc-arg-aut',
    home: T('Argentina', 'ar'),
    away: T('Austria', 'at'),
    group: 'J',
    kickoffISO: '2026-06-22T17:00:00.000Z',
    venue: 'AT&T Stadium, Arlington',
    fallback: { home: 72, draw: 18, away: 10 },
  },
  {
    id: 'wc-fra-irq',
    home: T('France', 'fr'),
    away: T('Iraq', 'iq'),
    group: 'I',
    kickoffISO: '2026-06-22T21:00:00.000Z',
    venue: 'Lincoln Financial Field, Philadelphia',
    fallback: { home: 82, draw: 12, away: 6 },
  },
  {
    id: 'wc-por-uzb',
    home: T('Portugal', 'pt'),
    away: T('Uzbekistan', 'uz'),
    group: 'K',
    kickoffISO: '2026-06-23T17:00:00.000Z',
    venue: 'NRG Stadium, Houston',
    fallback: { home: 74, draw: 17, away: 9 },
  },
  {
    id: 'wc-eng-gha',
    home: T('England', 'gb'),
    away: T('Ghana', 'gh'),
    group: 'L',
    kickoffISO: '2026-06-23T20:00:00.000Z',
    venue: 'Gillette Stadium, Foxborough',
    fallback: { home: 68, draw: 20, away: 12 },
  },
  {
    id: 'wc-pan-cro',
    home: T('Panama', 'pa'),
    away: T('Croatia', 'hr'),
    group: 'L',
    kickoffISO: '2026-06-23T23:00:00.000Z',
    venue: 'BMO Field, Toronto',
    fallback: { home: 18, draw: 25, away: 57 },
  },
  {
    id: 'wc-cze-mex',
    home: T('Czechia', 'cz'),
    away: T('Mexico', 'mx'),
    group: 'A',
    kickoffISO: '2026-06-24T23:00:00.000Z',
    venue: 'Estadio Azteca, Mexico City',
    fallback: { home: 31, draw: 30, away: 39 },
  },
]

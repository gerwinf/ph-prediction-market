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

// Spotlight + match grid, ordered by kickoff. A `slug` would point at a pinned
// match market in lib/oracle/slugs.ts (LIVE_MARKETS) when one exists; none do
// today, so every match shows its curated `fallback` odds. Keep kickoffISO times
// realistic and refresh as matchdays pass.
export const FIXTURES: Fixture[] = [
  {
    id: 'wc-arg-cro',
    home: T('Argentina', 'ar'),
    away: T('Croatia', 'hr'),
    group: 'J',
    kickoffISO: '2026-06-17T19:00:00.000Z',
    venue: 'Arrowhead Stadium',
    fallback: { home: 58, draw: 24, away: 18 },
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
    id: 'wc-ger-jpn',
    home: T('Germany', 'de'),
    away: T('Japan', 'jp'),
    group: 'D',
    kickoffISO: '2026-06-19T19:00:00.000Z',
    venue: 'Lincoln Financial Field',
    fallback: { home: 60, draw: 23, away: 17 },
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

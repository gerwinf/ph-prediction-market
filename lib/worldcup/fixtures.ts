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
// fixtures (refreshed 2026-06-24; kickoffs in UTC). A `slug` would point at a pinned
// match market in lib/oracle/slugs.ts (LIVE_MARKETS) when one exists; none do today,
// so every match shows its curated `fallback` odds. Refresh as matchdays pass — or
// seed the catalog (scripts/seed-worldcup-catalog.ts) to manage these from
// /ops/markets without a deploy.
export const FIXTURES: Fixture[] = [
  {
    id: 'wc-tun-ned',
    home: T('Tunisia', 'tn'),
    away: T('Netherlands', 'nl'),
    group: 'F',
    kickoffISO: '2026-06-25T23:00:00.000Z',
    venue: 'Arrowhead Stadium, Kansas City',
    fallback: { home: 16, draw: 26, away: 58 },
  },
  {
    id: 'wc-nor-fra',
    home: T('Norway', 'no'),
    away: T('France', 'fr'),
    group: 'I',
    kickoffISO: '2026-06-26T19:00:00.000Z',
    venue: 'Gillette Stadium, Foxborough',
    fallback: { home: 24, draw: 27, away: 49 },
  },
  {
    id: 'wc-cro-gha',
    home: T('Croatia', 'hr'),
    away: T('Ghana', 'gh'),
    group: 'L',
    kickoffISO: '2026-06-27T21:00:00.000Z',
    venue: 'Lincoln Financial Field, Philadelphia',
    fallback: { home: 55, draw: 26, away: 19 },
  },
  {
    id: 'wc-pan-eng',
    home: T('Panama', 'pa'),
    away: T('England', 'gb'),
    group: 'L',
    kickoffISO: '2026-06-27T21:00:00.000Z',
    venue: 'MetLife Stadium, East Rutherford',
    fallback: { home: 14, draw: 22, away: 64 },
  },
  {
    id: 'wc-col-por',
    home: T('Colombia', 'co'),
    away: T('Portugal', 'pt'),
    group: 'K',
    kickoffISO: '2026-06-27T23:30:00.000Z',
    venue: 'Hard Rock Stadium, Miami',
    fallback: { home: 30, draw: 28, away: 42 },
  },
  {
    id: 'wc-jor-arg',
    home: T('Jordan', 'jo'),
    away: T('Argentina', 'ar'),
    group: 'J',
    kickoffISO: '2026-06-28T03:00:00.000Z',
    venue: 'AT&T Stadium, Arlington',
    fallback: { home: 8, draw: 16, away: 76 },
  },
]

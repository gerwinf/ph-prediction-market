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
  // Germany (v Paraguay) and Netherlands (v Morocco) were knocked out on penalties
  // in the Round of 32 (2026-06-29/30), so they're dropped. Replaced by the next
  // still-alive favorites by winner odds: USA (+2500), Mexico (+3000), Belgium (+3500).
  { name: 'USA',         iso: 'us',                        fallbackPct: 4,  vol: '₱2.4M', delta: 3 },
  { name: 'Mexico',      iso: 'mx',                        fallbackPct: 3,  vol: '₱1.9M', delta: 2 },
  { name: 'Belgium',     iso: 'be',                        fallbackPct: 2,  vol: '₱1.6M', delta: 2 },
]

const T = (name: string, iso: string): Team => ({ name, iso })

// Spotlight + match grid, ordered by kickoff. Real FIFA World Cup 2026 Round of 16
// fixtures (refreshed 2026-07-03; kickoffs in UTC, converted from the published ET
// times — EDT is UTC−4). A `slug` would point at a pinned match market in
// lib/oracle/slugs.ts (LIVE_MARKETS) when one exists; none do today, so every match
// shows its curated `fallback` odds (regulation result; "draw" = level after 90').
// Refresh as rounds pass — or seed the catalog (scripts/seed-worldcup-catalog.ts) to
// manage these from /ops/markets without a deploy.
export const FIXTURES: Fixture[] = [
  {
    id: 'wc-can-mar',
    home: T('Canada', 'ca'),
    away: T('Morocco', 'ma'),
    group: 'Round of 16',
    kickoffISO: '2026-07-04T17:00:00.000Z',
    venue: 'NRG Stadium, Houston',
    fallback: { home: 33, draw: 30, away: 37 },
  },
  {
    id: 'wc-par-fra',
    home: T('Paraguay', 'py'),
    away: T('France', 'fr'),
    group: 'Round of 16',
    kickoffISO: '2026-07-04T21:00:00.000Z',
    venue: 'Lincoln Financial Field, Philadelphia',
    fallback: { home: 18, draw: 26, away: 56 },
  },
  {
    id: 'wc-bra-nor',
    home: T('Brazil', 'br'),
    away: T('Norway', 'no'),
    group: 'Round of 16',
    kickoffISO: '2026-07-05T20:00:00.000Z',
    venue: 'MetLife Stadium, East Rutherford',
    fallback: { home: 52, draw: 26, away: 22 },
  },
  {
    id: 'wc-mex-eng',
    home: T('Mexico', 'mx'),
    away: T('England', 'gb'),
    group: 'Round of 16',
    kickoffISO: '2026-07-06T00:00:00.000Z',
    venue: 'Estadio Azteca, Mexico City',
    fallback: { home: 30, draw: 28, away: 42 },
  },
  {
    id: 'wc-por-esp',
    home: T('Portugal', 'pt'),
    away: T('Spain', 'es'),
    group: 'Round of 16',
    kickoffISO: '2026-07-06T19:00:00.000Z',
    venue: 'AT&T Stadium, Arlington',
    fallback: { home: 32, draw: 28, away: 40 },
  },
  {
    id: 'wc-usa-bel',
    home: T('USA', 'us'),
    away: T('Belgium', 'be'),
    group: 'Round of 16',
    kickoffISO: '2026-07-06T21:00:00.000Z',
    venue: 'Lumen Field, Seattle',
    fallback: { home: 34, draw: 27, away: 39 },
  },
]

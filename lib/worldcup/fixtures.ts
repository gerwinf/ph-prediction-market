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

// Spotlight + match grid, ordered by kickoff. Real FIFA World Cup 2026 knockout-stage
// fixtures (refreshed 2026-07-06; the two remaining Round of 16 ties + the confirmed
// quarter-finals. Kickoffs in UTC, converted from the published ET times — EDT is
// UTC−4). A `slug` would point at a pinned match market in
// lib/oracle/slugs.ts (LIVE_MARKETS) when one exists; none do today, so every match
// shows its curated `fallback` odds (regulation result; "draw" = level after 90').
// Refresh as rounds pass — or seed the catalog (scripts/seed-worldcup-catalog.ts) to
// manage these from /ops/markets without a deploy.
export const FIXTURES: Fixture[] = [
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
  {
    id: 'wc-fra-mar',
    home: T('France', 'fr'),
    away: T('Morocco', 'ma'),
    group: 'Quarter-final',
    kickoffISO: '2026-07-09T20:00:00.000Z',
    venue: 'Gillette Stadium, Foxborough',
    fallback: { home: 48, draw: 27, away: 25 },
  },
  {
    id: 'wc-esp-bel',
    home: T('Spain', 'es'),
    away: T('Belgium', 'be'),
    group: 'Quarter-final',
    kickoffISO: '2026-07-10T19:00:00.000Z',
    venue: 'SoFi Stadium, Los Angeles',
    fallback: { home: 55, draw: 26, away: 19 },
  },
  {
    id: 'wc-nor-eng',
    home: T('Norway', 'no'),
    away: T('England', 'gb'),
    group: 'Quarter-final',
    kickoffISO: '2026-07-11T21:00:00.000Z',
    venue: 'Hard Rock Stadium, Miami',
    fallback: { home: 32, draw: 28, away: 40 },
  },
  {
    id: 'wc-arg-sui',
    home: T('Argentina', 'ar'),
    away: T('Switzerland', 'ch'),
    group: 'Quarter-final',
    kickoffISO: '2026-07-13T00:00:00.000Z',
    venue: 'Arrowhead Stadium, Kansas City',
    fallback: { home: 60, draw: 24, away: 16 },
  },
]

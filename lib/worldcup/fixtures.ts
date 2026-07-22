import type { Fixture, Team } from './state'

export type Contender = {
  name: string
  iso: string        // ISO 3166-1 alpha-2, lowercase (flagcdn key)
  slug?: string      // winner-market slug in lib/oracle/slugs.ts LIVE_MARKETS
  fallbackPct: number
  vol: string        // curated market-depth label (PH-scale), Polymarket-style
  delta: number      // curated 24h move in pct points (+/-); 0 = flat
}

// Winner leaderboard — the tournament is decided (final 2026-07-19). Spain
// lifted the Cup, beating Argentina in the final; the four semi-finalists
// remain, champion first, so the page's high→low sort reads as final standings.
// Slugs are dropped now the market is resolved: the live overlay would only
// re-price a settled market, so the curated 100/0 result is authoritative.
// `vol`/`delta` are curated flavor (market depth + 24h move) — Polymarket-style.
export const CONTENDERS: Contender[] = [
  { name: 'Spain',     iso: 'es', fallbackPct: 100, vol: '₱5.2M', delta: 0 }, // champions
  { name: 'Argentina', iso: 'ar', fallbackPct: 0,   vol: '₱6.1M', delta: 0 }, // runners-up
  { name: 'France',    iso: 'fr', fallbackPct: 0,   vol: '₱4.8M', delta: 0 }, // third place
  // England has no alpha-2 of its own; 'gb' renders the Union Jack on flagcdn.
  { name: 'England',   iso: 'gb', fallbackPct: 0,   vol: '₱2.9M', delta: 0 }, // fourth
]

const T = (name: string, iso: string): Team => ({ name, iso })

// Spotlight + match grid, ordered by kickoff. FIFA World Cup 2026 climax — the
// two semi-finals, the third-place play-off, and the final (refreshed
// 2026-07-22, all now full-time; the page's spotlight surfaces the most recent
// final, so the champion's match leads). Kickoffs in UTC, converted from the
// published ET times (EDT is UTC−4). A `slug` would point at a pinned match
// market in lib/oracle/slugs.ts (LIVE_MARKETS) when one exists; none do here,
// so every match shows its curated `fallback` odds (regulation result; "draw" =
// level after 90'). Seed the catalog (scripts/seed-worldcup-catalog.ts) to
// manage these from /ops/markets without a deploy.
export const FIXTURES: Fixture[] = [
  {
    id: 'wc-sf-esp-fra',
    home: T('Spain', 'es'),
    away: T('France', 'fr'),
    group: 'Semi-final',
    kickoffISO: '2026-07-14T19:00:00.000Z',
    venue: 'AT&T Stadium, Arlington',
    fallback: { home: 42, draw: 29, away: 29 },
  },
  {
    id: 'wc-sf-arg-eng',
    home: T('Argentina', 'ar'),
    away: T('England', 'gb'),
    group: 'Semi-final',
    kickoffISO: '2026-07-15T19:00:00.000Z',
    venue: 'Mercedes-Benz Stadium, Atlanta',
    fallback: { home: 44, draw: 28, away: 28 },
  },
  {
    id: 'wc-3p-fra-eng',
    home: T('France', 'fr'),
    away: T('England', 'gb'),
    group: 'Third-place play-off',
    kickoffISO: '2026-07-18T16:00:00.000Z',
    venue: 'Hard Rock Stadium, Miami',
    fallback: { home: 37, draw: 28, away: 35 },
  },
  {
    id: 'wc-final-esp-arg',
    home: T('Spain', 'es'),
    away: T('Argentina', 'ar'),
    group: 'Final',
    kickoffISO: '2026-07-19T19:00:00.000Z',
    venue: 'MetLife Stadium, New York',
    fallback: { home: 40, draw: 28, away: 32 },
  },
]

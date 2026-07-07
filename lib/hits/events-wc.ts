import type { GameEvent } from './types'

/* ────────────────────────────────────────────────────────────────────────
 * World Cup 2026 football event pool — the /hits "sports" theme for the
 * knockout window. Mirrors lib/hits/events.ts (the PBA pool) but for football.
 *
 * These are the MATCH-AGNOSTIC tiles: they can fire on any fixture regardless
 * of who's playing. Per-team and per-player tiles are composed on top in
 * lib/hits/pool-builder.ts from lib/hits/players-wc.ts, so a card reflects the
 * two teams actually on the pitch.
 *
 * Categories reuse the sport-agnostic set (scoring / play / foul / coaching /
 * flow / team). If a cell references something that doesn't happen, it just
 * won't light up — no error.
 * ──────────────────────────────────────────────────────────────────────── */

export const WC_GENERIC_EVENTS: GameEvent[] = [
  // ───── Scoring shape ─────
  { id: 'first-goal-15',    label: 'Goal in the first 15′',       category: 'scoring',  rarity: 'common' },
  { id: 'both-teams-score', label: 'Both teams score',            category: 'scoring',  rarity: 'common' },
  { id: 'over-2-goals',     label: '3+ goals in the match',       category: 'scoring',  rarity: 'common' },
  { id: 'under-2-goals',    label: 'Under 2.5 goals',             category: 'scoring',  rarity: 'uncommon' },
  { id: 'goal-outside-box', label: 'Goal from outside the box',   category: 'scoring',  rarity: 'uncommon' },
  { id: 'header-goal',      label: 'Header goal',                 category: 'scoring',  rarity: 'uncommon' },
  { id: 'free-kick-goal',   label: 'Direct free-kick goal',       category: 'scoring',  rarity: 'rare' },
  { id: 'sub-scores',       label: 'A substitute scores',         category: 'scoring',  rarity: 'uncommon' },

  // ───── Set pieces / penalties ─────
  { id: 'penalty-given',    label: 'Penalty awarded',             category: 'play',     rarity: 'uncommon' },
  { id: 'penalty-scored',   label: 'Penalty scored',              category: 'scoring',  rarity: 'uncommon' },
  { id: 'penalty-missed',   label: 'Penalty missed or saved',     category: 'play',     rarity: 'rare' },
  { id: 'keeper-save-pen',  label: 'Keeper saves a penalty',      category: 'play',     rarity: 'rare' },
  { id: 'corner-count-10',  label: '10+ corners combined',        category: 'play',     rarity: 'common' },
  { id: 'woodwork',         label: 'Shot hits the post or bar',   category: 'play',     rarity: 'uncommon' },

  // ───── Cards / fouls ─────
  { id: 'yellow-card',      label: 'Any yellow card',             category: 'foul',     rarity: 'common' },
  { id: 'three-yellows',    label: '3+ yellow cards',             category: 'foul',     rarity: 'common' },
  { id: 'red-card',         label: 'Red card shown',              category: 'foul',     rarity: 'rare' },

  // ───── VAR / officiating ─────
  { id: 'var-review',       label: 'VAR review',                  category: 'coaching', rarity: 'common' },
  { id: 'var-overturn',     label: 'VAR overturns a call',        category: 'coaching', rarity: 'uncommon' },

  // ───── Match flow ─────
  { id: 'nil-nil-half',     label: '0–0 at half-time',            category: 'flow',     rarity: 'uncommon' },
  { id: 'injury-time-goal', label: 'Goal in stoppage time',       category: 'flow',     rarity: 'uncommon' },
  { id: 'comeback-win',     label: 'A team wins from behind',     category: 'flow',     rarity: 'rare' },
  { id: 'goes-to-et',       label: 'Match goes to extra time',    category: 'flow',     rarity: 'rare' },

  // ───── Team-flow (works for either side) ─────
  { id: 'clean-sheet',      label: 'A team keeps a clean sheet',  category: 'team',     rarity: 'common' },
]

/**
 * Pool v2 "bread and butter" tiles — the POR–ESP calibration miss: a 1–0
 * match fired only 13 of ~63 tiles → ~5 lit cells/card → zero winners on 38
 * cards. These are HIGH-frequency moments (most fire in most matches), all
 * auto-detectable from FIFA timeline types we already parse (offside 15,
 * corner 16, foul 18, sub 5, save 57). Only merged into pools for matches
 * NOT in WC_POOL_V1_MATCHES (pool changes reshuffle cells under sold cards).
 */
export const WC_EASY_EVENTS: GameEvent[] = [
  { id: 'any-offside',     label: 'Offside flag raised',       category: 'play',     rarity: 'common' },
  { id: 'corner-5',        label: '5+ corners combined',       category: 'play',     rarity: 'common' },
  { id: 'first-corner-10', label: 'Corner in the first 10′',   category: 'play',     rarity: 'common' },
  { id: 'saves-3',         label: 'Keeper makes 3+ saves',     category: 'play',     rarity: 'common' },
  { id: 'fouls-10',        label: '10+ fouls in the match',    category: 'foul',     rarity: 'common' },
  { id: 'sub-before-60',   label: 'Substitution before 60′',   category: 'coaching', rarity: 'common' },
]

/**
 * Matches whose cards were sold on the v1 pool. A card's cells regenerate
 * deterministically from the pool, so these pools are FROZEN forever —
 * add a match id here before changing pool composition if it has sold cards.
 */
export const WC_POOL_V1_MATCHES = new Set([
  'wc-por-esp-2026-07-06',
  'wc-usa-bel-2026-07-07',
  'wc-arg-egy-2026-07-07',
])

/**
 * Tiles NO feed can auto-detect (FIFA has no type; API-Football carries no
 * shot detail) — they only ever fire via manual /ops. Excluded from v2
 * pools so cards don't carry cells that realistically never light; kept in
 * WC_GENERIC_EVENTS because frozen v1 pools still reference them.
 * (var-review/var-overturn/penalty-missed are NOT here — the API-Football
 * sync auto-fires those.)
 */
export const WC_FEED_BLIND_IDS = new Set([
  'woodwork',
  'header-goal',
  'free-kick-goal',
  'goal-outside-box',
  'keeper-save-pen',
])

export const WC_EVENT_BY_ID: Record<string, GameEvent> = Object.fromEntries(
  [...WC_GENERIC_EVENTS, ...WC_EASY_EVENTS].map((e) => [e.id, e])
)

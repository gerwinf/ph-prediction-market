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

export const WC_EVENT_BY_ID: Record<string, GameEvent> = Object.fromEntries(
  WC_GENERIC_EVENTS.map((e) => [e.id, e])
)

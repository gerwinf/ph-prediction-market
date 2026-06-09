/**
 * Match-aware event pool builder.
 *
 * Given a PBA match_id, returns an event pool composed of:
 *   - generic basketball drama tiles (always)
 *   - per-team tiles for both teams in this fixture (drawn from
 *     lib/hits/players.ts current-form rosters)
 *
 * Falls back to the static CANDIDATE_EVENTS pool when match_id can't
 * be parsed (unknown fixture, daily card, no match context). This
 * keeps existing share URLs working and is the safety net for any
 * codepath we haven't migrated yet.
 *
 * Why this exists: the Sunday May 24 calibration miss showed our
 * static pool over-weighted Brownlee/Mikey (quiet) and under-weighted
 * Thompson/Tiongson/Nambatac/M.Jones (hot). Per-match composition
 * lets the pool match the actual rotation on a given night without
 * rotating event-keys.
 */
import type { GameEvent } from './types'
import { CANDIDATE_EVENTS } from './events'
import { eventCellToGameEvent } from '../catalog/types'
import {
  PLAYERS_BY_TEAM,
  TEAMS,
  teamsFromMatchId,
  type Player,
  type TeamCode,
} from './players'

/**
 * Generic basketball drama tiles — fire on any PBA game regardless of
 * which teams are playing. Curated subset of `CANDIDATE_EVENTS` —
 * intentionally narrower than the full static pool so per-team tiles
 * have room.
 */
const GENERIC_TILES: GameEvent[] = CANDIDATE_EVENTS.filter((e) => {
  // Drop all player-name and team-name tiles — those come from the
  // builder per-match. Keep flow, foul, coaching, and generic drama.
  const id = e.id
  return (
    e.category === 'flow' ||
    e.category === 'foul' ||
    e.category === 'coaching' ||
    id.startsWith('any-') ||
    id.startsWith('total-') ||
    id.startsWith('overtime') ||
    id === 'fouled-out' ||
    id === 'buzzer-beater' ||
    id === 'first-min-3' ||
    id === 'four-point-play' ||
    id === 'q3-blowout' ||
    id === 'halftime-tied' ||
    id === 'lead-changes-5' ||
    id === 'lead-changes-10' ||
    id === 'run-10-0' ||
    id === 'q35-points' ||
    id === 'poster-dunk' ||
    id === 'behind-back' ||
    id === 'fastbreak-dunk' ||
    id === 'air-ball' ||
    id === 'no-look' ||
    id === 'and-one' ||
    id === 'crowd-erupts' ||
    id === 'travel' ||
    id === 'goaltend' ||
    id === 'import-vs-import' ||
    id === 'local-leads-team'
  )
})

function playerTiles(player: Player): GameEvent[] {
  const name = player.shortName ?? player.name
  if (player.type === 'star') {
    return [
      { id: `${player.id}-20`,     label: `${name} scores 20+`,           category: 'scoring', rarity: 'common' },
      { id: `${player.id}-clutch`, label: `${name} clutch shot Q4`,       category: 'scoring', rarity: 'uncommon' },
      { id: `${player.id}-steal`,  label: `${name} steal → fastbreak`,    category: 'play',    rarity: 'common' },
    ]
  }
  if (player.type === 'import') {
    return [
      { id: `${player.id}-20`,     label: `${name} scores 20+`,           category: 'scoring', rarity: 'common' },
      { id: `${player.id}-double`, label: `${name} double-double`,        category: 'scoring', rarity: 'common' },
      { id: `${player.id}-dunk`,   label: `${name} dunks`,                category: 'play',    rarity: 'uncommon' },
    ]
  }
  // role
  return [
    { id: `${player.id}-15`,       label: `${name} scores 15+`,           category: 'scoring', rarity: 'uncommon' },
    { id: `${player.id}-energy`,   label: `${name} hustle play (steal/dive)`, category: 'play', rarity: 'common' },
  ]
}

function teamTiles(team: TeamCode): GameEvent[] {
  const short = TEAMS[team].short
  const lower = team.toLowerCase()
  return [
    { id: `${lower}-q1`,         label: `${short} wins Q1`,         category: 'team', rarity: 'common' },
    { id: `${lower}-halftime`,   label: `${short} leads at half`,   category: 'team', rarity: 'common' },
    { id: `${lower}-q4`,         label: `${short} wins Q4`,         category: 'team', rarity: 'common' },
  ]
}

/**
 * Build the pool for a given match id. Includes ALL events that COULD
 * fire — the card generator shuffles + samples 24 from this.
 */
export function buildPoolForMatch(matchId: string): GameEvent[] {
  const teams = teamsFromMatchId(matchId)
  if (!teams) return CANDIDATE_EVENTS

  const tiles: GameEvent[] = [...GENERIC_TILES]
  for (const team of teams) {
    tiles.push(...teamTiles(team))
    for (const player of PLAYERS_BY_TEAM[team]) {
      tiles.push(...playerTiles(player))
    }
  }
  return tiles
}

/**
 * Catalog-aware pool builder (server-only path).
 *
 * Reads approved/live event-cells from the markets catalog and merges them
 * over GENERIC_TILES (catalog wins on id collision). Falls back to the sync
 * `buildPoolForMatch(matchId)` whenever the catalog is empty or unreachable —
 * so /hits is unchanged until the catalog is seeded.
 *
 * The catalog read is dynamically imported because it pulls the service-role
 * admin client; pool-builder is otherwise reachable from the client bundle
 * (card-generator → this module) and must stay free of server-only imports.
 *
 * Determinism is safe: a card's `cells` are persisted at purchase (migration
 * 001) and settlement reads the persisted cells, so changing the pool later
 * never affects already-sold cards.
 */
export async function buildPoolForMatchAsync(
  matchId: string,
  fixtureId?: string | null,
): Promise<GameEvent[]> {
  try {
    const { fetchApprovedEventCellsForFixture } = await import('../catalog/read')
    const cells = await fetchApprovedEventCellsForFixture(fixtureId ?? null)
    if (cells.length === 0) return buildPoolForMatch(matchId)

    const byId = new Map<string, GameEvent>()
    for (const t of GENERIC_TILES) byId.set(t.id, t)
    for (const c of cells) {
      const e = eventCellToGameEvent(c.payload)
      byId.set(e.id, e)
    }
    return Array.from(byId.values())
  } catch {
    return buildPoolForMatch(matchId)
  }
}

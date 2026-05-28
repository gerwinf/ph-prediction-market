/**
 * PBA current-form rosters per team.
 *
 * Used by lib/hits/pool-builder.ts to compose match-aware event pools
 * so cards reference the players who are actually playing on a given
 * night, not stale stars (Sunday May 24 calibration miss: Brownlee
 * quiet, Thompson hot — pool didn't reflect it).
 *
 * Update workflow: when rotations change between series, edit this
 * file and re-deploy. Cheap. No DB migration.
 *
 * `id` is the canonical event-key prefix (used by sample timelines +
 * ops console). Keep it stable across rosters so existing share URLs
 * don't break when a player rotates out.
 */

export type TeamCode = 'GIN' | 'TNT' | 'MER' | 'ROS'

export type PlayerType = 'star' | 'role' | 'import'

export type Player = {
  id: string        // event-key prefix (e.g. 'thompson')
  name: string      // display name on cell label
  team: TeamCode
  type: PlayerType
  /** Optional shorthand for cell labels; defaults to `name` */
  shortName?: string
}

export const TEAMS: Record<TeamCode, { full: string; short: string; color: string }> = {
  GIN: { full: 'Barangay Ginebra', short: 'Ginebra',     color: '#c8102e' },
  TNT: { full: 'TNT Tropang Giga',  short: 'TNT',         color: '#1f5c8f' },
  MER: { full: 'Meralco Bolts',     short: 'Meralco',     color: '#f59e0b' },
  ROS: { full: 'Rain or Shine',     short: 'Rain or Shine', color: '#fbbf24' },
}

export const PLAYERS: Player[] = [
  // ───── Ginebra ─────
  { id: 'thompson',         name: 'Scottie Thompson',    team: 'GIN', type: 'star',   shortName: 'Thompson' },
  { id: 'brownlee',         name: 'Justin Brownlee',     team: 'GIN', type: 'import', shortName: 'Brownlee' },
  { id: 'standhardinger',   name: 'Christian Standhardinger', team: 'GIN', type: 'star', shortName: 'Standhardinger' },
  { id: 'aguilar',          name: 'Japeth Aguilar',      team: 'GIN', type: 'role',   shortName: 'Japeth' },

  // ───── Rain or Shine ─────
  { id: 'ros-import',       name: 'M. Jones',            team: 'ROS', type: 'import', shortName: 'RoS import' },
  { id: 'tiongson',         name: 'Andrei Caracut Tiongson', team: 'ROS', type: 'star', shortName: 'Tiongson' },
  { id: 'nambatac',         name: 'Rey Nambatac',        team: 'ROS', type: 'star',   shortName: 'Nambatac' },
  { id: 'norwood',          name: 'Gabe Norwood',        team: 'ROS', type: 'role',   shortName: 'Norwood' },
  { id: 'mocon',            name: 'Adrian Wong Mocon',   team: 'ROS', type: 'role',   shortName: 'Mocon' },

  // ───── TNT ─────
  { id: 'mikey',            name: 'Mikey Williams',      team: 'TNT', type: 'star',   shortName: 'Mikey' },
  { id: 'pogoy',            name: 'Roger Pogoy',         team: 'TNT', type: 'star',   shortName: 'Pogoy' },
  { id: 'oftana',           name: 'Calvin Oftana',       team: 'TNT', type: 'role',   shortName: 'Oftana' },
  { id: 'castro',           name: 'Jayson Castro',       team: 'TNT', type: 'role',   shortName: 'Castro' },
  { id: 'tnt-import',       name: 'TNT import',          team: 'TNT', type: 'import', shortName: 'TNT import' },

  // ───── Meralco ─────
  { id: 'newsome',          name: 'Chris Newsome',       team: 'MER', type: 'star',   shortName: 'Newsome' },
  { id: 'hodge',            name: 'Cliff Hodge',         team: 'MER', type: 'role',   shortName: 'Hodge' },
  { id: 'banchero',         name: 'Bong Quinto',         team: 'MER', type: 'role',   shortName: 'Banchero' },
  { id: 'meralco-import',   name: 'Meralco import',      team: 'MER', type: 'import', shortName: 'Meralco import' },
]

export const PLAYERS_BY_TEAM: Record<TeamCode, Player[]> = PLAYERS.reduce(
  (acc, p) => {
    acc[p.team].push(p)
    return acc
  },
  { GIN: [] as Player[], TNT: [] as Player[], MER: [] as Player[], ROS: [] as Player[] }
)

/**
 * Parse `pba-<away>-<home>-<date>` style match ids back to team codes.
 * Returns null when the id doesn't match the convention.
 *
 *   pba-gin-ros-2026-05-24  → ['GIN', 'ROS']
 *   pba-tnt-mer-2026-05-24  → ['TNT', 'MER']
 */
const TEAM_CODES_LOWER: Record<string, TeamCode> = {
  gin: 'GIN',
  tnt: 'TNT',
  mer: 'MER',
  ros: 'ROS',
}

export function teamsFromMatchId(matchId: string): [TeamCode, TeamCode] | null {
  if (!matchId.startsWith('pba-')) return null
  const parts = matchId.split('-')
  if (parts.length < 3) return null
  const a = TEAM_CODES_LOWER[parts[1]?.toLowerCase()]
  const b = TEAM_CODES_LOWER[parts[2]?.toLowerCase()]
  if (!a || !b) return null
  return [a, b]
}

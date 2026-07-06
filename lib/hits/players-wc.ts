/**
 * World Cup 2026 squads for the /hits football theme.
 *
 * Mirrors lib/hits/players.ts (the PBA rosters) but for football: used by
 * lib/hits/pool-builder.ts to compose match-aware event pools so a card
 * references the players actually on the pitch for a given fixture.
 *
 * `id` is the canonical event-key prefix (e.g. 'yamal'). Keep it stable so
 * existing share URLs don't break when a squad changes. Scope is intentionally
 * narrow — just the teams we theme /hits around right now (Round of 16:
 * Portugal vs Spain). Add teams here + to WC_TEAM_CODES_LOWER to support more.
 */

export type WcTeamCode = 'POR' | 'ESP'

// Football positions drive which tiles pool-builder generates per player
// (forwards get goal/shot tiles, mids get assist/book, defenders get book).
export type WcPos = 'forward' | 'mid' | 'defender'

export type WcPlayer = {
  id: string        // event-key prefix (e.g. 'yamal')
  name: string      // display name on the cell label
  team: WcTeamCode
  pos: WcPos
  /** Optional shorthand for cell labels; defaults to `name` */
  shortName?: string
}

export const WC_TEAMS: Record<WcTeamCode, { full: string; short: string; color: string }> = {
  POR: { full: 'Portugal', short: 'Portugal', color: '#006600' },
  ESP: { full: 'Spain', short: 'Spain', color: '#c60b1e' },
}

export const WC_PLAYERS: WcPlayer[] = [
  // ───── Portugal ─────
  { id: 'bruno',    name: 'Bruno Fernandes', team: 'POR', pos: 'mid',      shortName: 'Bruno' },
  { id: 'leao',     name: 'Rafael Leão',     team: 'POR', pos: 'forward',  shortName: 'Leão' },
  { id: 'bernardo', name: 'Bernardo Silva',  team: 'POR', pos: 'mid',      shortName: 'B. Silva' },
  { id: 'gramos',   name: 'Gonçalo Ramos',   team: 'POR', pos: 'forward',  shortName: 'G. Ramos' },
  { id: 'rubendias',name: 'Rúben Dias',      team: 'POR', pos: 'defender', shortName: 'Rúben Dias' },

  // ───── Spain ─────
  { id: 'yamal',    name: 'Lamine Yamal',    team: 'ESP', pos: 'forward',  shortName: 'Yamal' },
  { id: 'pedri',    name: 'Pedri',           team: 'ESP', pos: 'mid',      shortName: 'Pedri' },
  { id: 'nico',     name: 'Nico Williams',   team: 'ESP', pos: 'forward',  shortName: 'Nico' },
  { id: 'morata',   name: 'Álvaro Morata',   team: 'ESP', pos: 'forward',  shortName: 'Morata' },
  { id: 'rodri',    name: 'Rodri',           team: 'ESP', pos: 'mid',      shortName: 'Rodri' },
]

export const WC_PLAYERS_BY_TEAM: Record<WcTeamCode, WcPlayer[]> = WC_PLAYERS.reduce(
  (acc, p) => {
    acc[p.team].push(p)
    return acc
  },
  { POR: [] as WcPlayer[], ESP: [] as WcPlayer[] }
)

// Lower-case FIFA-ish codes used in match ids (wc-<home>-<away>-<date>).
const WC_TEAM_CODES_LOWER: Record<string, WcTeamCode> = {
  por: 'POR',
  esp: 'ESP',
}

/**
 * Parse `wc-<home>-<away>-<date>` style match ids to team codes.
 * Returns null when the id isn't a recognized WC fixture.
 *
 *   wc-por-esp-2026-07-06  → ['POR', 'ESP']
 */
export function teamsFromWcMatchId(matchId: string): [WcTeamCode, WcTeamCode] | null {
  if (!matchId.startsWith('wc-')) return null
  const parts = matchId.split('-')
  if (parts.length < 3) return null
  const a = WC_TEAM_CODES_LOWER[parts[1]?.toLowerCase()]
  const b = WC_TEAM_CODES_LOWER[parts[2]?.toLowerCase()]
  if (!a || !b) return null
  return [a, b]
}

/**
 * World Cup 2026 squads for the /hits football theme.
 *
 * Mirrors lib/hits/players.ts (the PBA rosters) but for football: used by
 * lib/hits/pool-builder.ts to compose match-aware event pools so a card
 * references the players actually on the pitch for a given fixture.
 *
 * `id` is the canonical event-key prefix (e.g. 'yamal'). Keep it stable so
 * existing share URLs don't break when a squad changes. Scope: every team
 * still alive in the knockout bracket (add teams to WC_TEAMS + WC_PLAYERS as
 * rounds progress — codes/lookup tables derive from WC_TEAMS automatically).
 *
 * ⚠️ Never change an EXISTING team's squad while its fixture is live/selling:
 * pools generate card cells deterministically, so edits reshuffle cells under
 * already-bought cards. Adding NEW teams is always safe.
 */

export type WcTeamCode =
  | 'POR' | 'ESP'          // R16 Jul 6
  | 'USA' | 'BEL'          // R16 Jul 7
  | 'ARG' | 'EGY'          // R16 Jul 7
  | 'SUI' | 'COL'          // R16 Jul 7
  | 'FRA' | 'MAR'          // QF Jul 9
  | 'NOR' | 'ENG'          // QF Jul 11

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
  USA: { full: 'USA', short: 'USA', color: '#b31942' },
  BEL: { full: 'Belgium', short: 'Belgium', color: '#ed2939' },
  ARG: { full: 'Argentina', short: 'Argentina', color: '#75aadb' },
  EGY: { full: 'Egypt', short: 'Egypt', color: '#ce1126' },
  SUI: { full: 'Switzerland', short: 'Switzerland', color: '#d52b1e' },
  COL: { full: 'Colombia', short: 'Colombia', color: '#fcd116' },
  FRA: { full: 'France', short: 'France', color: '#0055a4' },
  MAR: { full: 'Morocco', short: 'Morocco', color: '#c1272d' },
  NOR: { full: 'Norway', short: 'Norway', color: '#ba0c2f' },
  ENG: { full: 'England', short: 'England', color: '#ce1124' },
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

  // ───── USA ─────
  { id: 'pulisic',    name: 'Christian Pulisic', team: 'USA', pos: 'forward',  shortName: 'Pulisic' },
  { id: 'balogun',    name: 'Folarin Balogun',   team: 'USA', pos: 'forward',  shortName: 'Balogun' },
  { id: 'mckennie',   name: 'Weston McKennie',   team: 'USA', pos: 'mid',      shortName: 'McKennie' },
  { id: 'tadams',     name: 'Tyler Adams',       team: 'USA', pos: 'mid',      shortName: 'T. Adams' },
  { id: 'arobinson',  name: 'Antonee Robinson',  team: 'USA', pos: 'defender', shortName: 'A. Robinson' },

  // ───── Belgium ─────
  { id: 'debruyne',   name: 'Kevin De Bruyne',   team: 'BEL', pos: 'mid',      shortName: 'De Bruyne' },
  { id: 'doku',       name: 'Jérémy Doku',       team: 'BEL', pos: 'forward',  shortName: 'Doku' },
  { id: 'lukaku',     name: 'Romelu Lukaku',     team: 'BEL', pos: 'forward',  shortName: 'Lukaku' },
  { id: 'trossard',   name: 'Leandro Trossard',  team: 'BEL', pos: 'mid',      shortName: 'Trossard' },
  { id: 'faes',       name: 'Wout Faes',         team: 'BEL', pos: 'defender', shortName: 'Faes' },

  // ───── Argentina ─────
  { id: 'messi',      name: 'Lionel Messi',      team: 'ARG', pos: 'forward',  shortName: 'Messi' },
  { id: 'jalvarez',   name: 'Julián Álvarez',    team: 'ARG', pos: 'forward',  shortName: 'J. Álvarez' },
  { id: 'enzo',       name: 'Enzo Fernández',    team: 'ARG', pos: 'mid',      shortName: 'Enzo' },
  { id: 'macallister',name: 'Alexis Mac Allister', team: 'ARG', pos: 'mid',    shortName: 'Mac Allister' },
  { id: 'cromero',    name: 'Cristian Romero',   team: 'ARG', pos: 'defender', shortName: 'C. Romero' },

  // ───── Egypt ─────
  { id: 'salah',      name: 'Mohamed Salah',     team: 'EGY', pos: 'forward',  shortName: 'Salah' },
  { id: 'marmoush',   name: 'Omar Marmoush',     team: 'EGY', pos: 'forward',  shortName: 'Marmoush' },
  { id: 'mostafa',    name: 'Mostafa Mohamed',   team: 'EGY', pos: 'forward',  shortName: 'Mostafa' },
  { id: 'ashour',     name: 'Emam Ashour',       team: 'EGY', pos: 'mid',      shortName: 'Ashour' },
  { id: 'abdelmonem', name: 'Mohamed Abdelmonem', team: 'EGY', pos: 'defender', shortName: 'Abdelmonem' },

  // ───── Switzerland ─────
  { id: 'xhaka',      name: 'Granit Xhaka',      team: 'SUI', pos: 'mid',      shortName: 'Xhaka' },
  { id: 'embolo',     name: 'Breel Embolo',      team: 'SUI', pos: 'forward',  shortName: 'Embolo' },
  { id: 'ndoye',      name: 'Dan Ndoye',         team: 'SUI', pos: 'forward',  shortName: 'Ndoye' },
  { id: 'rieder',     name: 'Fabian Rieder',     team: 'SUI', pos: 'mid',      shortName: 'Rieder' },
  { id: 'akanji',     name: 'Manuel Akanji',     team: 'SUI', pos: 'defender', shortName: 'Akanji' },

  // ───── Colombia ─────
  { id: 'luisdiaz',   name: 'Luis Díaz',         team: 'COL', pos: 'forward',  shortName: 'L. Díaz' },
  { id: 'james',      name: 'James Rodríguez',   team: 'COL', pos: 'mid',      shortName: 'James' },
  { id: 'duran',      name: 'Jhon Durán',        team: 'COL', pos: 'forward',  shortName: 'Durán' },
  { id: 'rios',       name: 'Richard Ríos',      team: 'COL', pos: 'mid',      shortName: 'Ríos' },
  { id: 'dmunoz',     name: 'Daniel Muñoz',      team: 'COL', pos: 'defender', shortName: 'D. Muñoz' },

  // ───── France ─────
  { id: 'mbappe',     name: 'Kylian Mbappé',     team: 'FRA', pos: 'forward',  shortName: 'Mbappé' },
  { id: 'dembele',    name: 'Ousmane Dembélé',   team: 'FRA', pos: 'forward',  shortName: 'Dembélé' },
  { id: 'olise',      name: 'Michael Olise',     team: 'FRA', pos: 'mid',      shortName: 'Olise' },
  { id: 'tchouameni', name: 'Aurélien Tchouaméni', team: 'FRA', pos: 'mid',    shortName: 'Tchouaméni' },
  { id: 'saliba',     name: 'William Saliba',    team: 'FRA', pos: 'defender', shortName: 'Saliba' },

  // ───── Morocco ─────
  { id: 'ennesyri',   name: 'Youssef En-Nesyri', team: 'MAR', pos: 'forward',  shortName: 'En-Nesyri' },
  { id: 'rahimi',     name: 'Soufiane Rahimi',   team: 'MAR', pos: 'forward',  shortName: 'Rahimi' },
  { id: 'brahim',     name: 'Brahim Díaz',       team: 'MAR', pos: 'mid',      shortName: 'Brahim' },
  { id: 'ounahi',     name: 'Azzedine Ounahi',   team: 'MAR', pos: 'mid',      shortName: 'Ounahi' },
  { id: 'hakimi',     name: 'Achraf Hakimi',     team: 'MAR', pos: 'defender', shortName: 'Hakimi' },

  // ───── Norway ─────
  { id: 'haaland',    name: 'Erling Haaland',    team: 'NOR', pos: 'forward',  shortName: 'Haaland' },
  { id: 'odegaard',   name: 'Martin Ødegaard',   team: 'NOR', pos: 'mid',      shortName: 'Ødegaard' },
  { id: 'sorloth',    name: 'Alexander Sørloth', team: 'NOR', pos: 'forward',  shortName: 'Sørloth' },
  { id: 'berge',      name: 'Sander Berge',      team: 'NOR', pos: 'mid',      shortName: 'Berge' },
  { id: 'ajer',       name: 'Kristoffer Ajer',   team: 'NOR', pos: 'defender', shortName: 'Ajer' },

  // ───── England ─────
  { id: 'kane',       name: 'Harry Kane',        team: 'ENG', pos: 'forward',  shortName: 'Kane' },
  { id: 'saka',       name: 'Bukayo Saka',       team: 'ENG', pos: 'forward',  shortName: 'Saka' },
  { id: 'bellingham', name: 'Jude Bellingham',   team: 'ENG', pos: 'mid',      shortName: 'Bellingham' },
  { id: 'rice',       name: 'Declan Rice',       team: 'ENG', pos: 'mid',      shortName: 'Rice' },
  { id: 'stones',     name: 'John Stones',       team: 'ENG', pos: 'defender', shortName: 'Stones' },
]

export const WC_PLAYERS_BY_TEAM: Record<WcTeamCode, WcPlayer[]> = WC_PLAYERS.reduce(
  (acc, p) => {
    acc[p.team].push(p)
    return acc
  },
  Object.fromEntries(
    (Object.keys(WC_TEAMS) as WcTeamCode[]).map((t) => [t, [] as WcPlayer[]])
  ) as Record<WcTeamCode, WcPlayer[]>
)

// Lower-case FIFA-ish codes used in match ids (wc-<home>-<away>-<date>).
const WC_TEAM_CODES_LOWER: Record<string, WcTeamCode> = Object.fromEntries(
  (Object.keys(WC_TEAMS) as WcTeamCode[]).map((t) => [t.toLowerCase(), t])
)

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

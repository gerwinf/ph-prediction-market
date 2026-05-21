import type { GameEvent } from './types'

/* ────────────────────────────────────────────────────────────────────────
 * PBA Commissioner's Cup semis event pool — covers all 4 semi teams
 * (Ginebra, Rain or Shine, TNT, Meralco) so Jade can run either series
 * from /ops without a code change.
 *
 * Eliminated this round, removed from pool:
 *   - CJ Perez, June Mar Fajardo, Calvin Abueva (San Miguel)
 *
 * If a card cell references a player who isn't in the specific game
 * tipping off, that tile just won't light up — no error, no panic.
 * Taglish labels lean masa. Re-tune player names per series on the
 * day if Jade flags rotation gaps.
 * ──────────────────────────────────────────────────────────────────── */

export const CANDIDATE_EVENTS: GameEvent[] = [
  // ───── Ginebra ─────
  { id: 'brownlee-25',         label: 'Brownlee scores 25+',         category: 'scoring',  rarity: 'common' },
  { id: 'brownlee-dunk',       label: 'Brownlee dunks',              category: 'play',     rarity: 'common' },
  { id: 'brownlee-tech',       label: 'Brownlee technical foul',     category: 'foul',     rarity: 'rare' },
  { id: 'brownlee-clutch3',    label: 'Brownlee clutch 3 sa Q4',     category: 'scoring',  rarity: 'rare' },
  { id: 'thompson-trip',       label: 'Scottie Thompson triple-dub', category: 'scoring',  rarity: 'rare' },
  { id: 'thompson-steal',      label: 'Scottie Thompson steal → fastbreak', category: 'play', rarity: 'uncommon' },
  { id: 'standhardinger-20',   label: 'Standhardinger scores 20+',   category: 'scoring',  rarity: 'common' },

  // ───── Rain or Shine ─────
  { id: 'ros-import-25',       label: 'RoS import scores 25+',       category: 'scoring',  rarity: 'common' },
  { id: 'ros-import-dunk',     label: 'RoS import dunks',            category: 'play',     rarity: 'uncommon' },
  { id: 'belga-rebound',       label: 'Beau Belga 10+ rebounds',     category: 'scoring',  rarity: 'uncommon' },
  { id: 'asistio-3ball',       label: 'Anton Asistio 3+ threes',     category: 'scoring',  rarity: 'uncommon' },
  { id: 'mamuyac-clutch',      label: 'Mamuyac clutch basket Q4',    category: 'scoring',  rarity: 'rare' },

  // ───── TNT ─────
  { id: 'mikey-3ball',         label: 'Mikey Williams 5+ threes',    category: 'scoring',  rarity: 'uncommon' },
  { id: 'mikey-25',            label: 'Mikey Williams scores 25+',   category: 'scoring',  rarity: 'common' },
  { id: 'pogoy-20',            label: 'Roger Pogoy scores 20+',      category: 'scoring',  rarity: 'common' },
  { id: 'oftana-clutch3',      label: 'Oftana clutch 3 sa Q4',       category: 'scoring',  rarity: 'rare' },
  { id: 'tnt-import-25',       label: 'TNT import scores 25+',       category: 'scoring',  rarity: 'common' },

  // ───── Meralco ─────
  { id: 'newsome-20',          label: 'Newsome scores 20+',          category: 'scoring',  rarity: 'common' },
  { id: 'newsome-dunk',        label: 'Newsome poster dunk',         category: 'play',     rarity: 'uncommon' },
  { id: 'hodge-block',         label: 'Cliff Hodge monster block',   category: 'play',     rarity: 'uncommon' },
  { id: 'meralco-import-25',   label: 'Meralco import scores 25+',   category: 'scoring',  rarity: 'common' },

  // ───── Team quarter / game-flow (works for any of the 4) ─────
  { id: 'ginebra-q1',          label: 'Ginebra wins Q1',             category: 'team',     rarity: 'common' },
  { id: 'ginebra-halftime',    label: 'Ginebra leads at half',       category: 'team',     rarity: 'common' },
  { id: 'ginebra-q4',          label: 'Ginebra wins Q4',             category: 'team',     rarity: 'common' },
  { id: 'ros-q1',              label: 'Rain or Shine wins Q1',       category: 'team',     rarity: 'common' },
  { id: 'ros-halftime',        label: 'Rain or Shine leads at half', category: 'team',     rarity: 'common' },
  { id: 'tnt-q1',              label: 'TNT wins Q1',                 category: 'team',     rarity: 'common' },
  { id: 'tnt-halftime',        label: 'TNT leads at half',           category: 'team',     rarity: 'common' },
  { id: 'tnt-q4',              label: 'TNT wins Q4',                 category: 'team',     rarity: 'common' },
  { id: 'meralco-q1',          label: 'Meralco wins Q1',             category: 'team',     rarity: 'common' },
  { id: 'meralco-halftime',    label: 'Meralco leads at half',       category: 'team',     rarity: 'common' },

  // ───── Generic basketball drama (any game) ─────
  { id: 'overtime',            label: 'OT, may dagdag laro',         category: 'flow',     rarity: 'rare' },
  { id: 'fouled-out',          label: 'May player na nag-foul out',  category: 'foul',     rarity: 'common' },
  { id: 'total-200',           label: 'Combined points 200+',        category: 'scoring',  rarity: 'common' },
  { id: 'total-under180',      label: 'Combined points under 180',   category: 'scoring',  rarity: 'uncommon' },
  { id: 'buzzer-beater',       label: 'Buzzer beater any quarter',   category: 'play',     rarity: 'rare' },
  { id: 'first-min-3',         label: '3-ball sa unang minute',      category: 'play',     rarity: 'uncommon' },
  { id: 'flagrant',            label: 'Flagrant foul tinawag',       category: 'foul',     rarity: 'rare' },
  { id: 'coach-challenge',     label: 'Coach challenge sa ref',      category: 'coaching', rarity: 'common' },
  { id: 'early-timeout',       label: 'Timeout sa unang 3 mins',     category: 'coaching', rarity: 'common' },
  { id: 'bench-scuffle',       label: 'Banatang bench / staredown',  category: 'foul',     rarity: 'rare' },
  { id: 'four-point-play',     label: '4-point play (sino man)',     category: 'scoring',  rarity: 'rare' },
  { id: 'q3-blowout',          label: 'Margin > 15 pagkatapos Q3',   category: 'team',     rarity: 'uncommon' },
  { id: 'halftime-tied',       label: 'Tabla sa half',               category: 'flow',     rarity: 'rare' },
  { id: 'lead-changes-5',      label: '5+ lead changes',             category: 'flow',     rarity: 'common' },
  { id: 'clutch-ft-make',      label: 'Pasok ang clutch FT',         category: 'play',     rarity: 'common' },
  { id: 'clutch-ft-miss',      label: 'Sablay ang clutch FT',        category: 'play',     rarity: 'uncommon' },
  { id: 'travel',              label: 'Travel tinawag',              category: 'foul',     rarity: 'common' },
  { id: 'goaltend',            label: 'Goaltending tinawag',         category: 'foul',     rarity: 'uncommon' },
  { id: 'poster-dunk',         label: 'Poster dunk',                 category: 'play',     rarity: 'uncommon' },
  { id: 'behind-back',         label: 'Behind-the-back assist',      category: 'play',     rarity: 'uncommon' },
  { id: 'fastbreak-dunk',      label: 'Steal → fastbreak',           category: 'play',     rarity: 'uncommon' },
  { id: 'air-ball',            label: 'Air ball — nakakapaktol',     category: 'play',     rarity: 'common' },
  { id: 'q35-points',          label: '35+ points sa isang quarter', category: 'scoring',  rarity: 'uncommon' },
  { id: 'no-look',             label: 'No-look pass, pasok ang basket', category: 'play',  rarity: 'rare' },
  { id: 'ejection',            label: 'Player o coach na-eject',     category: 'foul',     rarity: 'rare' },
  { id: 'and-one',             label: 'And-one play',                category: 'scoring',  rarity: 'common' },
]

export const EVENT_BY_ID: Record<string, GameEvent> = Object.fromEntries(
  CANDIDATE_EVENTS.map((e) => [e.id, e])
)

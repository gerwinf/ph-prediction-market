import type { GameEvent } from './types'

export const CANDIDATE_EVENTS: GameEvent[] = [
  { id: 'brownlee-25',     label: 'Brownlee scores 25+',          category: 'scoring',  rarity: 'common' },
  { id: 'brownlee-dunk',   label: 'Brownlee dunks',                category: 'play',     rarity: 'common' },
  { id: 'brownlee-tech',   label: 'Brownlee technical foul',       category: 'foul',     rarity: 'rare' },
  { id: 'brownlee-block',  label: 'Brownlee block in paint',       category: 'play',     rarity: 'uncommon' },
  { id: 'perez-20',        label: 'CJ Perez scores 20+',           category: 'scoring',  rarity: 'common' },
  { id: 'perez-clutch3',   label: 'Perez clutch 3 in Q4',          category: 'scoring',  rarity: 'rare' },
  { id: 'fajardo-15reb',   label: 'Fajardo 15+ rebounds',          category: 'scoring',  rarity: 'common' },
  { id: 'fajardo-block',   label: 'Fajardo monster block',         category: 'play',     rarity: 'uncommon' },
  { id: 'thompson-trip',   label: 'Thompson triple-double',        category: 'scoring',  rarity: 'rare' },
  { id: 'mikey-3ball',     label: 'Mikey Williams 5+ threes',      category: 'scoring',  rarity: 'uncommon' },
  { id: 'abueva-tech',     label: 'Abueva technical foul',         category: 'foul',     rarity: 'uncommon' },
  { id: 'ginebra-q1',      label: 'Ginebra wins Q1',               category: 'team',     rarity: 'common' },
  { id: 'ginebra-halftime',label: 'Ginebra leads at half',         category: 'team',     rarity: 'common' },
  { id: 'ginebra-q4',      label: 'Ginebra wins Q4',               category: 'team',     rarity: 'common' },
  { id: 'smb-q1',          label: 'San Miguel wins Q1',            category: 'team',     rarity: 'common' },
  { id: 'smb-halftime',    label: 'San Miguel leads at half',      category: 'team',     rarity: 'common' },
  { id: 'overtime',        label: 'Game goes to overtime',         category: 'flow',     rarity: 'rare' },
  { id: 'fouled-out',      label: 'A player fouls out',            category: 'foul',     rarity: 'common' },
  { id: 'total-200',       label: 'Combined points 200+',          category: 'scoring',  rarity: 'common' },
  { id: 'total-under180',  label: 'Combined points under 180',     category: 'scoring',  rarity: 'uncommon' },
  { id: 'buzzer-beater',   label: 'Buzzer beater any quarter',     category: 'play',     rarity: 'rare' },
  { id: 'first-min-3',     label: '3-ball in first minute',        category: 'play',     rarity: 'uncommon' },
  { id: 'flagrant',        label: 'Flagrant foul called',          category: 'foul',     rarity: 'rare' },
  { id: 'coach-challenge', label: 'Coach challenges a call',       category: 'coaching', rarity: 'common' },
  { id: 'early-timeout',   label: 'Timeout in first 3 min',        category: 'coaching', rarity: 'common' },
  { id: 'bench-scuffle',   label: 'Bench scuffle / staredown',     category: 'foul',     rarity: 'rare' },
  { id: 'four-point-play', label: '4-point play (anyone)',         category: 'scoring',  rarity: 'rare' },
  { id: 'q3-blowout',      label: 'Margin > 15 after Q3',          category: 'team',     rarity: 'uncommon' },
  { id: 'halftime-tied',   label: 'Game tied at half',             category: 'flow',     rarity: 'rare' },
  { id: 'lead-changes-5',  label: '5+ lead changes',               category: 'flow',     rarity: 'common' },

  { id: 'clutch-ft-make',  label: 'Clutch FT make',                category: 'play',     rarity: 'common' },
  { id: 'clutch-ft-miss',  label: 'Clutch FT miss',                category: 'play',     rarity: 'uncommon' },
  { id: 'travel',          label: 'A travel called',               category: 'foul',     rarity: 'common' },
  { id: 'goaltend',        label: 'A goaltend called',             category: 'foul',     rarity: 'uncommon' },
  { id: 'poster-dunk',     label: 'Poster dunk',                   category: 'play',     rarity: 'uncommon' },
  { id: 'behind-back',     label: 'Behind-the-back assist',        category: 'play',     rarity: 'uncommon' },
  { id: 'fastbreak-dunk',  label: 'Steal → fastbreak',             category: 'play',     rarity: 'uncommon' },
  { id: 'air-ball',        label: 'An air ball',                   category: 'play',     rarity: 'common' },
  { id: 'q35-points',      label: '35+ points in a quarter',       category: 'scoring',  rarity: 'uncommon' },
  { id: 'no-look',         label: 'No-look pass scores',           category: 'play',     rarity: 'rare' },
]

export const EVENT_BY_ID: Record<string, GameEvent> = Object.fromEntries(
  CANDIDATE_EVENTS.map((e) => [e.id, e])
)

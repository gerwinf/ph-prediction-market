import type { GameEvent } from './types'

/**
 * Daily card event pool — Hula Hits cross-domain edition.
 *
 * Mix: weather 6 / news 5 / celebrity 16 / financial 6 / cultural 7 = 40.
 * Celebrity-heavy per masa-tier audience read. All events resolve from
 * publicly observable sources (PAGASA, BSP, PSE, ABS-CBN/GMA, X/Instagram).
 */
export const DAILY_EVENTS: GameEvent[] = [
  // Weather (6)
  { id: 'd-signal-1',     label: 'Typhoon Signal raised today', category: 'flow', rarity: 'uncommon' },
  { id: 'd-rain-25mm',    label: 'Manila rain > 25mm',           category: 'flow', rarity: 'common' },
  { id: 'd-heat-42',      label: 'Heat index > 42°C',            category: 'flow', rarity: 'common' },
  { id: 'd-class-susp',   label: 'NCR class suspensions',        category: 'flow', rarity: 'uncommon' },
  { id: 'd-thunderstorm', label: 'PAGASA thunderstorm warning',  category: 'flow', rarity: 'common' },
  { id: 'd-visayas-storm',label: 'Storm signal in Visayas',      category: 'flow', rarity: 'rare' },

  // News & politics (5)
  { id: 'd-pbbm-press',   label: 'PBBM holds press briefing',    category: 'team', rarity: 'common' },
  { id: 'd-senate-early', label: 'Senate adjourns before 5 PM',  category: 'team', rarity: 'uncommon' },
  { id: 'd-doh-advisory', label: 'DOH issues advisory today',    category: 'team', rarity: 'uncommon' },
  { id: 'd-house-bill',   label: 'House passes a bill today',    category: 'team', rarity: 'uncommon' },
  { id: 'd-bsp-stmt',     label: 'BSP releases statement',       category: 'team', rarity: 'rare' },

  // Celebrity & showbiz (16)
  { id: 'd-bini-trend',   label: 'BINI trends on X tonight',     category: 'play', rarity: 'common' },
  { id: 'd-sb19-trend',   label: 'SB19 trends on X',             category: 'play', rarity: 'uncommon' },
  { id: 'd-bea-ig',       label: 'Bea Alonzo posts on IG',       category: 'play', rarity: 'common' },
  { id: 'd-sarah-news',   label: 'Sarah Geronimo in news',       category: 'play', rarity: 'common' },
  { id: 'd-dpads-news',   label: 'Daniel Padilla in news',       category: 'play', rarity: 'uncommon' },
  { id: 'd-anne-showtime',label: 'Anne Curtis on Showtime',      category: 'play', rarity: 'common' },
  { id: 'd-vice-show',    label: 'Vice Ganda new episode',       category: 'play', rarity: 'common' },
  { id: 'd-coco-news',    label: 'Coco Martin in news',          category: 'play', rarity: 'uncommon' },
  { id: 'd-kathniel',     label: 'KathNiel trends',              category: 'play', rarity: 'uncommon' },
  { id: 'd-marian-tv',    label: 'Marian Rivera on TV',          category: 'play', rarity: 'common' },
  { id: 'd-liza-holly',   label: 'Liza Soberano in Hollywood',   category: 'play', rarity: 'rare' },
  { id: 'd-toni-post',    label: 'Toni Gonzaga posts today',     category: 'play', rarity: 'common' },
  { id: 'd-abunda',       label: 'Boy Abunda drops interview',   category: 'play', rarity: 'uncommon' },
  { id: 'd-celeb-romance',label: 'Celebrity engagement rumor',   category: 'play', rarity: 'rare' },
  { id: 'd-pbb-twist',    label: 'PBB / reality TV twist',       category: 'play', rarity: 'uncommon' },
  { id: 'd-mmff-bo',      label: 'MMFF box-office milestone',    category: 'play', rarity: 'rare' },

  // Financial (6)
  { id: 'd-psei-green',   label: 'PSEi closes green',            category: 'scoring', rarity: 'common' },
  { id: 'd-psei-8500',    label: 'PSEi closes > 8,500',          category: 'scoring', rarity: 'uncommon' },
  { id: 'd-usdphp-low',   label: 'USD/PHP closes < 56',          category: 'scoring', rarity: 'uncommon' },
  { id: 'd-usdphp-high',  label: 'USD/PHP closes > 57',          category: 'scoring', rarity: 'uncommon' },
  { id: 'd-btc-100k',     label: 'BTC closes > $100k',           category: 'scoring', rarity: 'common' },
  { id: 'd-eth-3500',     label: 'ETH closes > $3,500',          category: 'scoring', rarity: 'common' },

  // Cultural & daily life (7)
  { id: 'd-mrt-down',     label: 'MRT-3 breakdown today',        category: 'foul', rarity: 'common' },
  { id: 'd-traffic-red',  label: 'Manila Code Red traffic',      category: 'foul', rarity: 'common' },
  { id: 'd-pba-tonight',  label: 'PBA game tonight',             category: 'flow', rarity: 'common' },
  { id: 'd-boxer-news',   label: 'PH boxer in news',             category: 'flow', rarity: 'uncommon' },
  { id: 'd-mlbb-intl',    label: 'MLBB intl fixture today',      category: 'flow', rarity: 'uncommon' },
  { id: 'd-doh-cases',    label: 'DOH: 1,000+ flu cases',        category: 'foul', rarity: 'uncommon' },
  { id: 'd-new-movie',    label: 'New movie opens in NCR',       category: 'flow', rarity: 'common' },
]

export const DAILY_EVENT_BY_ID: Record<string, GameEvent> = Object.fromEntries(
  DAILY_EVENTS.map((e) => [e.id, e])
)

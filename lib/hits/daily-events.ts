import type { GameEvent } from './types'

/**
 * Daily card event pool — Hula Hits cross-domain edition.
 *
 * Revised 2026-05-21 after the 5-sample-cards exercise surfaced systematic
 * pool dead weight (typhoon-only events in May, sports events that belong
 * on the sports card, December-only MMFF, etc.). Cuts 9 dead-weight events,
 * adds 9 May-applicable replacements. Final ratio:
 *
 *   weather 3 / news 8 / celebrity 16 / financial 8 / cultural 5 = 40 events
 *
 * Celebrity ratio preserved per masa-tier read. All events resolve from
 * publicly observable sources (PAGASA, BSP, PSE, ABS-CBN/GMA, X/Instagram,
 * NAIA, MMDA). Seasonal applicability tagging (full Phase 1B work) deferred
 * until validation closes.
 */
export const DAILY_EVENTS: GameEvent[] = [
  // Weather (3) — May-applicable only; dropped typhoon-season events
  { id: 'd-rain-25mm',    label: 'Manila rain > 25mm',           category: 'flow', rarity: 'common' },
  { id: 'd-heat-42',      label: 'Heat index > 42°C',            category: 'flow', rarity: 'common' },
  { id: 'd-thunderstorm', label: 'PAGASA thunderstorm warning',  category: 'flow', rarity: 'common' },

  // News & politics (8) — added 3 to cover Mon-Tue thin news days
  { id: 'd-pbbm-press',   label: 'PBBM holds press briefing',    category: 'team', rarity: 'common' },
  { id: 'd-senate-early', label: 'Senate adjourns before 5 PM',  category: 'team', rarity: 'uncommon' },
  { id: 'd-doh-advisory', label: 'DOH issues advisory today',    category: 'team', rarity: 'uncommon' },
  { id: 'd-house-bill',   label: 'House passes a bill today',    category: 'team', rarity: 'uncommon' },
  { id: 'd-bsp-stmt',     label: 'BSP releases statement',       category: 'team', rarity: 'rare' },
  { id: 'd-naia-delay',   label: 'NAIA flight delay reported',   category: 'team', rarity: 'common' },
  { id: 'd-bir-memo',     label: 'BIR releases tax memo',        category: 'team', rarity: 'uncommon' },
  { id: 'd-doh-cases',    label: 'DOH: 1,000+ flu cases',        category: 'team', rarity: 'uncommon' },

  // Celebrity & showbiz (16) — swapped MMFF + PBB + Liza-Hollywood for
  // evergreen daily-show + active-poster events
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
  { id: 'd-toni-post',    label: 'Toni Gonzaga posts today',     category: 'play', rarity: 'common' },
  { id: 'd-abunda',       label: 'Boy Abunda drops interview',   category: 'play', rarity: 'uncommon' },
  { id: 'd-celeb-romance',label: 'Celebrity engagement rumor',   category: 'play', rarity: 'rare' },
  { id: 'd-bianca-post',  label: 'Bianca Gonzalez posts today',  category: 'play', rarity: 'common' },
  { id: 'd-eatbulaga',    label: 'Eat Bulaga viral moment',      category: 'play', rarity: 'common' },
  { id: 'd-magandang',    label: 'Magandang Buhay airs today',   category: 'play', rarity: 'common' },

  // Financial (8) — added gold + oil for breadth, direction-only labels
  { id: 'd-psei-green',   label: 'PSEi closes green',            category: 'scoring', rarity: 'common' },
  { id: 'd-psei-up1',     label: 'PSEi closes up 1%+',           category: 'scoring', rarity: 'uncommon' },
  { id: 'd-usdphp-strong',label: 'Peso strengthens today',       category: 'scoring', rarity: 'uncommon' },
  { id: 'd-usdphp-weak',  label: 'Peso weakens today',           category: 'scoring', rarity: 'uncommon' },
  { id: 'd-btc-green',    label: 'BTC closes green today',       category: 'scoring', rarity: 'common' },
  { id: 'd-eth-green',    label: 'ETH closes green today',       category: 'scoring', rarity: 'common' },
  { id: 'd-gold-up',      label: 'Gold price moves up today',    category: 'scoring', rarity: 'common' },
  { id: 'd-oil-move',     label: 'Brent oil moves 1%+',          category: 'scoring', rarity: 'common' },

  // Cultural & daily life (5) — sports events removed (those live on the
  // sports card); kept Manila-life + replaced with brownout event
  { id: 'd-mrt-down',     label: 'MRT-3 breakdown today',        category: 'foul', rarity: 'common' },
  { id: 'd-traffic-red',  label: 'Manila Code Red traffic',      category: 'foul', rarity: 'common' },
  { id: 'd-brownout',     label: 'NCR brownout reported',        category: 'foul', rarity: 'uncommon' },
  { id: 'd-mall-sale',    label: 'Major mall sale today',        category: 'flow', rarity: 'common' },
  { id: 'd-new-movie',    label: 'New movie opens in NCR',       category: 'flow', rarity: 'uncommon' },
]

export const DAILY_EVENT_BY_ID: Record<string, GameEvent> = Object.fromEntries(
  DAILY_EVENTS.map((e) => [e.id, e])
)

import type { GameEvent, Match } from './types'
import { WC_GENERIC_EVENTS } from './events-wc'
import { SAMPLE_MATCH } from './sample-match'
import { DAILY_EVENTS } from './daily-events'
import { DAILY_SAMPLE } from './daily-sample'

export type CardType = 'sports' | 'daily'

export type CardTypeMeta = {
  type: CardType
  label: string             // 'Sports' / 'Daily'
  sublabel: string          // 'PBA Comm's Cup' / 'MANILA · TODAY'
  tagline: string           // 'Tonight · 7 PM' (sports) — daily uses dateLabel/windowLabel instead
  pool: GameEvent[]
  sample: Match
  // Daily-anchor fields (only used when type === 'daily')
  dateLabel?: string        // 'Wed · May 21'
  windowLabel?: string      // '6 AM → MIDNIGHT'
}

export const CARD_TYPES: Record<CardType, CardTypeMeta> = {
  sports: {
    type: 'sports',
    label: 'Sports',
    sublabel: SAMPLE_MATCH.league,
    tagline: SAMPLE_MATCH.tipoff,
    pool: WC_GENERIC_EVENTS,
    sample: SAMPLE_MATCH,
  },
  daily: {
    type: 'daily',
    label: 'Daily',
    sublabel: DAILY_SAMPLE.league,
    tagline: DAILY_SAMPLE.tipoff,
    pool: DAILY_EVENTS,
    sample: DAILY_SAMPLE,
    dateLabel: 'Wed · May 21',
    windowLabel: '6 AM → MIDNIGHT',
  },
}

export function resolveCardType(raw: string | null | undefined): CardType {
  return raw === 'daily' ? 'daily' : 'sports'
}

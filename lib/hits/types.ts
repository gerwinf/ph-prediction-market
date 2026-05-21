export type EventCategory =
  | 'scoring'
  | 'play'
  | 'foul'
  | 'coaching'
  | 'flow'
  | 'team'

export type GameEvent = {
  id: string
  label: string
  category: EventCategory
  rarity: 'common' | 'uncommon' | 'rare'
}

export type CellState = 'pending' | 'hit' | 'free'

export type Card = {
  id: string
  cells: GameEvent[]
  purchasedAt: number
  pricePhp: number
  type: 'sports' | 'daily'
}

export type TimelineEvent = {
  atMs: number
  gameClock: string
  eventId: string
  description: string
}

export type Match = {
  id: string
  league: string
  home: string
  homeColor: string
  away: string
  awayColor: string
  tipoff: string
  durationMs: number
  timeline: TimelineEvent[]
}

export type WinPatternKind = 'row' | 'col' | 'diag' | 'full'

export type WinPattern = {
  kind: WinPatternKind
  index: number
  cellIndices: number[]
  multiplier: number
  label: string
}

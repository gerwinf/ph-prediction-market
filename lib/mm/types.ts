/**
 * Shared market-maker types. Mirrors migration 012 (`market_book`, `positions`)
 * and the public quote shape returned by GET /api/markets/[id]/quote.
 */
export type Side = 'yes' | 'no'

export type MarketBook = {
  market_id: string // uuid
  p: number // YES probability in (0,1)
  margin: number // expected house hold fraction, e.g. 0.05
  polymarket_slug: string | null
  anchored_at: string // ISO
  exposure_yes: number
  exposure_no: number
  cap: number
  is_stale: boolean
}

export type Position = {
  id: string
  user_id: string | null
  device_id: string | null
  market_id: string
  side: Side
  stake: number
  multiplier: number
  potential_payout: number
  status: 'open' | 'settled' | 'void'
  payout: number | null
  hold_amount: number | null
  created_at: string
  settled_at: string | null
}

export type Quote = {
  market_id: string
  p: number
  multiplier_yes: number
  multiplier_no: number
  headroom_yes: number
  headroom_no: number
  is_stale: boolean
}

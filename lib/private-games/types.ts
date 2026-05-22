/**
 * Private game types — founding-team dry-run mechanic.
 *
 * Mirrors the spec at .context/attachments/rw1ogx/. Cards are
 * pre-assigned (not deterministically generated from a seed like /hits)
 * because each player gets a curated mix of shared + personalized
 * squares.
 */

export type SquareType = 'observational' | 'predictive'

export type SquareCategory = 'sake_bar' | 'casino' | 'either' | 'prediction'

export type Square = {
  id: string
  type: SquareType
  /** Display text on the cell. */
  label: string
  category: SquareCategory
  /** True when the square appears on multiple players' cards. */
  isShared: boolean
  /** Optional resolution rules / disambiguation. */
  notes?: string
}

export type PrivatePlayer = {
  slug: string
  displayName: string
  /**
   * 25 square IDs in display order. Index 12 is reserved for the
   * `__hula__` free cell.
   */
  cardSquareIds: string[]
}

export type PrivateGame = {
  id: string
  title: string
  description?: string
  startsAt: string
  endsAt: string
  kittyTotalPhp: number
  payouts: {
    /** First player to complete any 5-in-a-row (rows / cols / diagonals all count). */
    firstBingoPhp: number
    /** Second player to bingo. Must be a different player from 1st. */
    secondBingoPhp: number
    /** End-of-night: most correct YES/NO predictions. Ties split. Independent prize. */
    predictionKingPhp: number
    /**
     * Full Card jackpot starts at this amount, then accumulates any
     * unclaimed bingo prizes during the night. If still unclaimed at
     * end-of-night, rolls to the most-marked observational tiebreaker.
     */
    fullCardBasePhp: number
    /** Human-readable description of the rollover chain. */
    rolloverNote: string
    observationalTiebreaker: 'most_marked' | 'first_to_claim'
  }
  players: PrivatePlayer[]
  squarePool: Square[]
}

/** Special id reserved for the center free cell at index 12. */
export const HULA_FREE_ID = '__hula__' as const

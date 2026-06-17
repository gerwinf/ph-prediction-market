import { describe, test, expect } from 'vitest'
import { bestBidAsk, midFromBook } from './poly-book'

// Polymarket CLOB /book returns price/size as strings, multiple levels per side.
const book = {
  bids: [
    { price: '0.48', size: '1000' },
    { price: '0.49', size: '500' },
  ],
  asks: [
    { price: '0.52', size: '800' },
    { price: '0.51', size: '300' },
  ],
}

describe('bestBidAsk', () => {
  test('best bid is the highest bid price, best ask the lowest ask price', () => {
    expect(bestBidAsk(book)).toEqual({ bid: 0.49, ask: 0.51 })
  })
  test('returns null when either side is empty (no two-sided market)', () => {
    expect(bestBidAsk({ bids: [], asks: book.asks })).toBeNull()
    expect(bestBidAsk({ bids: book.bids, asks: [] })).toBeNull()
  })
})

describe('midFromBook', () => {
  test('mid is the midpoint of best bid and best ask', () => {
    expect(midFromBook(book)).toBeCloseTo(0.5, 9)
  })
  test('null on an empty/one-sided book', () => {
    expect(midFromBook({ bids: [], asks: [] })).toBeNull()
  })
})

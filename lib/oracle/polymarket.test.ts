import { describe, test, expect } from 'vitest'
import { parseMarket, fetchPolymarketPrices, fetchPolymarketById } from './polymarket'

describe('parseMarket', () => {
  test('parses comma-separated outcomePrices into structured outcomes', () => {
    const raw = {
      id: 'mkt-1',
      question: 'Argentina vs Algeria — winner',
      outcomes: 'Argentina,Algeria',
      outcomePrices: '0.78,0.22',
      volume: 50000,
      endDate: '2026-07-20T00:00:00Z',
    }

    const result = parseMarket(raw, 'Argentina Algeria World Cup')

    expect(result).toEqual({
      query: 'Argentina Algeria World Cup',
      marketId: 'mkt-1',
      question: 'Argentina vs Algeria — winner',
      outcomes: [
        { name: 'Argentina', price: 0.78 },
        { name: 'Algeria', price: 0.22 },
      ],
      volumeUsd: 50000,
      endDate: '2026-07-20T00:00:00Z',
    })
  })

  test('endDate is null when the market has none', () => {
    const raw = { id: 'm', question: 'q', outcomes: 'Yes,No', outcomePrices: '0.5,0.5', volume: 50000 }
    expect(parseMarket(raw, 'q')?.endDate).toBeNull()
  })

  test('parses JSON-array-string format (real Gamma shape) into structured outcomes', () => {
    const raw = {
      id: 'mkt-2',
      question: 'Lakers vs Thunder',
      outcomes: '["Lakers", "Thunder"]',
      outcomePrices: '["0.41", "0.59"]',
      volume: '120000',
    }

    const result = parseMarket(raw, 'Lakers Thunder NBA')

    expect(result?.outcomes).toEqual([
      { name: 'Lakers', price: 0.41 },
      { name: 'Thunder', price: 0.59 },
    ])
    expect(result?.volumeUsd).toBe(120000)
  })

  test('returns null for markets below the volume floor', () => {
    const raw = {
      id: 'mkt-3',
      question: 'Illiquid market',
      outcomes: 'Yes,No',
      outcomePrices: '0.5,0.5',
      volume: 9999,
    }

    expect(parseMarket(raw, 'whatever')).toBeNull()
  })

  test('skipVolumeFloor keeps a curated market below the floor', () => {
    const raw = {
      id: 'mkt-4',
      question: 'Curated low-volume market',
      outcomes: '["Yes", "No"]',
      outcomePrices: '["0.6", "0.4"]',
      volume: 12,
    }

    const result = parseMarket(raw, 'wc-argentina', { skipVolumeFloor: true })
    expect(result?.outcomes[0]).toEqual({ name: 'Yes', price: 0.6 })
  })
})

describe('fetchPolymarketById', () => {
  test('fetches each market by id and tags the result with the app slug', async () => {
    const byId: Record<string, unknown> = {
      '558938': { id: '558938', question: 'Will Argentina win the 2026 FIFA World Cup?', outcomes: '["Yes","No"]', outcomePrices: '["0.09","0.91"]', volume: '500000' },
      '553858': { id: '553858', question: 'Will the Knicks win the 2026 NBA Finals?', outcomes: '["Yes","No"]', outcomePrices: '["0.78","0.22"]', volume: '300000' },
    }
    const fakeFetch = async (url: string | URL | Request) => {
      const id = String(url).split('/').pop() ?? ''
      return { ok: true, json: async () => byId[id] } as Response
    }

    const result = await fetchPolymarketById(
      [
        { slug: 'wc-argentina', marketId: '558938' },
        { slug: 'nba-knicks', marketId: '553858' },
      ],
      fakeFetch as typeof fetch,
    )

    expect(result).toHaveLength(2)
    const arg = result.find((r) => r.query === 'wc-argentina')
    expect(arg?.outcomes[0]).toEqual({ name: 'Yes', price: 0.09 })
  })

  test('skips a market that returns a non-ok response (no throw)', async () => {
    const fakeFetch = async () => ({ ok: false, json: async () => ({}) } as Response)
    const result = await fetchPolymarketById([{ slug: 'wc-argentina', marketId: '558938' }], fakeFetch as typeof fetch)
    expect(result).toEqual([])
  })
})

describe('fetchPolymarketPrices', () => {
  test('returns empty array (no rethrow) when the fetch fails', async () => {
    const failingFetch = async () => {
      throw new Error('network down')
    }

    const result = await fetchPolymarketPrices(['Argentina Algeria'], failingFetch as typeof fetch)

    expect(result).toEqual([])
  })

  test('maps successful responses across multiple queries into a flat list', async () => {
    const byQuery: Record<string, unknown[]> = {
      'Argentina Algeria': [
        { id: 'a1', question: 'ARG vs ALG', outcomes: 'Argentina,Algeria', outcomePrices: '0.78,0.22', volume: 50000 },
      ],
      'Lakers Thunder': [
        { id: 'l1', question: 'LAL vs OKC', outcomes: 'Lakers,Thunder', outcomePrices: '0.41,0.59', volume: 80000 },
      ],
    }
    const fakeFetch = async (url: string | URL | Request) => {
      const u = new URL(String(url))
      const search = u.searchParams.get('search') ?? ''
      return {
        ok: true,
        json: async () => byQuery[search] ?? [],
      } as Response
    }

    const result = await fetchPolymarketPrices(
      ['Argentina Algeria', 'Lakers Thunder'],
      fakeFetch as typeof fetch,
    )

    expect(result).toHaveLength(2)
    expect(result.map((r) => r.marketId).sort()).toEqual(['a1', 'l1'])
  })
})

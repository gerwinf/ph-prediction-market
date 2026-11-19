import { describe, expect, it } from 'vitest'
import { businessStories, handoffHref, marketForStory, marketHref, markets, payout, PREVIEW_HOST, stories } from './content'

describe('Bilyonaryo preview', () => {
  it('shares one market record between every story and its Hula page', () => {
    expect(stories).toHaveLength(2)
    expect(new Set(markets.map((market) => market.slug)).size).toBe(2)
    for (const story of stories) {
      const market = marketForStory(story)
      expect(markets).toContain(market)
      expect(market.yes).toBeGreaterThan(0)
      expect(market.yes).toBeLessThan(100)
      expect(market.resolutionUrl).toMatch(/^https:\/\//)
    }
    expect(businessStories).toHaveLength(6)
  })

  it.each([
    [0, 'yes', 100, 222],
    [0, 'no', 500, 909],
    [1, 'yes', 1000, 3333],
    [1, 'no', 100, 142],
  ] as const)('calculates play-point returns including the stake', (index, side, points, expected) => {
    expect(payout(points, markets[index], side)).toBe(expected)
  })

  it('carries the selected side and publisher into the handoff', () => {
    const url = new URL(marketHref(markets[1], 'no'), 'https://hulaan.ph')
    expect(url.pathname).toBe(`/m/${markets[1].slug}`)
    expect(url.searchParams.get('side')).toBe('no')
    expect(url.searchParams.get('src')).toBe('bilyonaryo')
  })

  it('opens Hula from the production newsroom and stays local in previews', () => {
    const path = marketHref(markets[0], 'yes')
    expect(handoffHref(markets[0], 'yes', PREVIEW_HOST)).toBe(`https://hulaan.ph${path}`)
    for (const host of ['localhost', '127.0.0.1', 'preview.vercel.app', 'hulaan.ph']) {
      expect(handoffHref(markets[0], 'yes', host)).toBe(path)
    }
  })
})

import content from './content.json'

export type Market = (typeof content.markets)[number]
export type Story = (typeof content.stories)[number]
export type Side = 'yes' | 'no'
export type Section = 'Top' | 'Politics' | 'Business' | 'Sports'

export const { edition, stories, markets } = content
export const businessStories: { headline: string; url: string; date: string }[] = content.business
export const PREVIEW_HOST = 'bilyonaryo.hulaan.ph'

export function marketForStory(story: Story): Market {
  const market = markets.find((item) => item.id === story.marketId)
  if (!market) throw new Error(`Missing preview market: ${story.marketId}`)
  return market
}

export function marketHref(market: Market, side: Side) {
  return `/m/${market.slug}?side=${side}&src=bilyonaryo`
}

export function payout(points: number, market: Market, side: Side) {
  const price = side === 'yes' ? market.yes : 100 - market.yes
  return Math.floor(points * 100 / price)
}

// The subdomain hosts the newsroom; Hula hosts the market. Keep local and
// Vercel previews self-contained until the custom domain is connected.
export function handoffHref(market: Market, side: Side, hostname: string) {
  const path = marketHref(market, side)
  return hostname === PREVIEW_HOST ? `https://hulaan.ph${path}` : path
}

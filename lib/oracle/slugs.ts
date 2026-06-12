/**
 * Event slug → live Polymarket price.
 *
 * Prices are resolved ONLY by pinned Gamma market id (`LIVE_MARKETS` below,
 * fetched via `fetchPolymarketById` → `GET /markets/<id>`). There is no
 * search-query fallback: Gamma's `?search=` does NOT filter — it returns the
 * same default markets for any query — so a search-resolved "price" is just an
 * unrelated default market (e.g. a WC match slug silently showed a Rihanna-album
 * market). A slug with no pinned id here gets NO price (the surface keeps its
 * fallback_pct) rather than a confidently-wrong one.
 *
 * To curate a new market: open it on polymarket.com, take the slug from the URL,
 * `GET /markets?slug=<slug>` to read its numeric id, then add a row to
 * LIVE_MARKETS and tag the matching market/landing row with that slug. Each is a
 * Yes/No "Will X win?" market, so the headline probability is `outcomes[0]`
 * ("Yes"). `label` is the short caption used in the ticker. IDs verified active
 * 2026-06-08.
 */
export const LIVE_MARKETS: Record<string, { id: string; label: string }> = {
  'wc-argentina': { id: '558938', label: 'Argentina win WC 2026' },
  'wc-france':    { id: '558936', label: 'France win WC 2026' },
  'wc-spain':     { id: '558934', label: 'Spain win WC 2026' },
  'wc-england':   { id: '558935', label: 'England win WC 2026' },
  'wc-brazil':    { id: '558937', label: 'Brazil win WC 2026' },
  'nba-knicks':   { id: '553858', label: 'Knicks win NBA Finals' },
  'nba-spurs':    { id: '553866', label: 'Spurs win NBA Finals' },
  // Crypto + world (Yes/No threshold/outcome markets, verified active 2026-06-08)
  'crypto-btc-120k':   { id: '701494', label: 'BTC tops $120k in 2026' },
  'crypto-eth-5500':   { id: '701545', label: 'ETH tops $5,500 in 2026' },
  'world-china-taiwan': { id: '567621', label: 'China–Taiwan conflict in 2026' },
}

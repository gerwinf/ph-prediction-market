/**
 * Event slug → Polymarket search query.
 *
 * Only globally-traded events have Polymarket order books. World Cup and NBA
 * games do; PBA / MLBB / pool / showbiz do NOT and are intentionally absent —
 * those games degrade to no context strip on /picks.
 *
 * Add an entry here as fixtures with a tradeable global market are added, and
 * point the matching /picks game at the same slug via GAME_TO_SLUG.
 */
export const SLUG_TO_QUERY: Record<string, string> = {
  // World Cup 2026
  'wc-mex-rsa': 'Mexico South Africa World Cup',
  'wc-arg-alg': 'Argentina Algeria World Cup',
  // NBA Conference Finals
  'nba-okc-sas': 'Thunder Spurs NBA',
  'nba-nyk-cle': 'Knicks Cavaliers NBA',
}

/**
 * Curated live markets for the landing page (`app/page.tsx`).
 *
 * Gamma's `?search=` does NOT filter (it returns the same default set for any
 * query), so live odds are pinned to specific, hand-verified market IDs and
 * fetched with `fetchPolymarketById` → `GET /markets/<id>`. Each is a Yes/No
 * "Will X win?" market, so the headline probability is `outcomes[0]` ("Yes").
 *
 * To curate a new market: open it on polymarket.com, take the slug from the URL,
 * `GET /markets?slug=<slug>` to read its numeric id, then add a row here and tag
 * the matching landing-page row with this slug. `label` is the short caption used
 * in the ticker. IDs verified active 2026-06-08.
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

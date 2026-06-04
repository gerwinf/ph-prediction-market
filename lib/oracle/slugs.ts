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

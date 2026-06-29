/* Best-effort live-odds overlay for /worldcup. Everything degrades to the
 * curated fallback: missing slug, stale row, or unparseable outcomes all keep
 * the hand-set number, so the page is never blank or wrong-looking. */

export type Outcome = { name: string; price: number }
export type PriceInfo = { outcomes: Outcome[]; is_stale: boolean; fetched_at: string; volume_usd?: number | null }
export type PricesMap = Record<string, PriceInfo>

// Polymarket volume is global and spans 3+ orders of magnitude ($200K crypto →
// $70M World Cup). Shown raw (converted to pesos) the WC markets read as ₱4.1B
// next to ₱6M PH-local cards — looks like a glitch, not a flex. So the label is
// a *compressed activity index*, not a literal figure: we log-map real USD
// volume onto a believable peso band, preserving order and differentiation
// while keeping every market inside the same visual range as the curated grid.
// Tunable anchors below; the output is always between FLOOR and CEIL.
const VOL_USD_LO = 100_000 // at/below → display floor
const VOL_USD_HI = 100_000_000 // at/above → display ceiling
const VOL_PHP_FLOOR = 1_000_000
const VOL_PHP_CEIL = 9_000_000

// Map a real USD volume to its compressed peso display amount (FLOOR..CEIL).
export function compressVol(usd: number): number {
  const t = Math.min(1, Math.max(0,
    (Math.log(usd) - Math.log(VOL_USD_LO)) / (Math.log(VOL_USD_HI) - Math.log(VOL_USD_LO)),
  ))
  return VOL_PHP_FLOOR * Math.pow(VOL_PHP_CEIL / VOL_PHP_FLOOR, t)
}

// Compact peso label: ₱X.XB / ₱X.XM (one decimal, matching existing curated
// strings like ₱6.1M) / ₱XXXK / ₱X. Input is a peso amount.
export function formatPeso(php: number): string {
  if (php >= 1e9) return `₱${(php / 1e9).toFixed(1)}B`
  if (php >= 1e6) return `₱${(php / 1e6).toFixed(1)}M`
  if (php >= 1e3) return `₱${Math.round(php / 1e3)}K`
  return `₱${Math.round(php)}`
}

function freshRow(prices: PricesMap, slug: string | undefined): PriceInfo | null {
  if (!slug) return null
  const row = prices[slug]
  if (!row || row.is_stale || !Array.isArray(row.outcomes)) return null
  return row
}

// Winner markets are Yes/No; outcomes[0] is "Yes". Returns a rounded percent.
// Name-checks the first outcome so a misconfigured (e.g. match-market) slug
// degrades to the fallback rather than silently returning a wrong probability.
export function winnerPct(prices: PricesMap, slug: string | undefined, fallback: number): number {
  const yes = freshRow(prices, slug)?.outcomes[0]
  if (yes?.name !== 'Yes' || typeof yes.price !== 'number') return fallback
  return Math.round(yes.price * 100)
}

// Match markets vary in outcome naming. Find the outcome whose name contains the
// home team's name (case-insensitive); use its price. Fall back otherwise.
export function matchHomePct(
  prices: PricesMap,
  slug: string | undefined,
  homeName: string,
  fallback: number
): number {
  const row = freshRow(prices, slug)
  if (!row) return fallback
  const needle = homeName.toLowerCase()
  const hit = row.outcomes.find((o) => o.name.toLowerCase().includes(needle))
  return typeof hit?.price === 'number' ? Math.round(hit.price * 100) : fallback
}

// Live Polymarket volume for a slug as a peso label when the row is fresh and
// carries a finite USD volume; otherwise the curated fallback string. Same
// fresh/stale/missing degradation as the percent helpers — never blank.
export function liveVol(prices: PricesMap, slug: string | undefined, fallback: string): string {
  const usd = freshRow(prices, slug)?.volume_usd
  if (typeof usd !== 'number' || !Number.isFinite(usd) || usd <= 0) return fallback
  return formatPeso(compressVol(usd))
}

// Union of all defined slugs across contenders + fixtures, de-duped.
export function allWcSlugs(
  contenders: { slug?: string }[],
  fixtures: { slug?: string }[]
): string[] {
  const set = new Set<string>()
  for (const c of contenders) if (c.slug) set.add(c.slug)
  for (const f of fixtures) if (f.slug) set.add(f.slug)
  return Array.from(set)
}

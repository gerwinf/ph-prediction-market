/* Best-effort live-odds overlay for /worldcup. Everything degrades to the
 * curated fallback: missing slug, stale row, or unparseable outcomes all keep
 * the hand-set number, so the page is never blank or wrong-looking. */

export type Outcome = { name: string; price: number }
export type PriceInfo = { outcomes: Outcome[]; is_stale: boolean; fetched_at: string }
export type PricesMap = Record<string, PriceInfo>

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

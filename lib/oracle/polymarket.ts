/**
 * Polymarket Gamma API price fetcher.
 *
 * Polymarket trades match outcomes (e.g. "Argentina to win") on a public
 * CLOB. We import the implied win probability as a *context* signal next to
 * /picks player props — NOT a 1:1 price mapping and NOT a settlement oracle.
 *
 * Gamma is a public REST API (no key). We resolve prices ONLY by pinned market
 * id (`GET /markets/<id>`) — never by `?search=`, which does not filter and
 * returns unrelated default markets. Each market's `outcomes` and
 * `outcomePrices` arrive as either a JSON-encoded array string
 * (`'["Argentina","Algeria"]'`) or a plain comma-separated string
 * (`'0.78,0.22'`) — we tolerate both.
 *
 * Refresh is lazy-on-read (see app/api/prices) because Vercel Hobby caps cron
 * at once-per-day — same constraint that pushed demo events to seed-on-buy.
 */

export type MirrorOutcome = { name: string; price: number }

export type MirrorPrice = {
  query: string
  marketId: string
  question: string
  outcomes: MirrorOutcome[]
  volumeUsd: number
  endDate: string | null
}

const GAMMA_URL = 'https://gamma-api.polymarket.com/markets'
const VOLUME_FLOOR = 10_000

export type ParseOptions = { skipVolumeFloor?: boolean }

/**
 * Split a Gamma list field that may be a JSON-array string or a bare
 * comma-separated string into trimmed string parts.
 */
function splitListField(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim())
  if (typeof value !== 'string') return []
  const trimmed = value.trim()
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim())
    } catch {
      // fall through to comma split
    }
  }
  return trimmed.split(',').map((s) => s.replace(/^["']|["']$/g, '').trim())
}

/**
 * Parse one raw Gamma market into a MirrorPrice, or null if it can't be
 * parsed or sits below the liquidity floor.
 */
export function parseMarket(raw: unknown, query: string, opts: ParseOptions = {}): MirrorPrice | null {
  if (!raw || typeof raw !== 'object') return null
  const m = raw as Record<string, unknown>

  const rawVolume = Number(m.volume)
  const volumeUsd = Number.isFinite(rawVolume) ? rawVolume : 0
  if (!opts.skipVolumeFloor && volumeUsd < VOLUME_FLOOR) return null

  const names = splitListField(m.outcomes)
  const prices = splitListField(m.outcomePrices).map((p) => Number(p))
  if (names.length === 0 || names.length !== prices.length) return null
  if (prices.some((p) => !Number.isFinite(p))) return null

  const marketId = m.id != null ? String(m.id) : ''
  const question = typeof m.question === 'string' ? m.question : ''
  if (!marketId) return null

  return {
    query,
    marketId,
    question,
    outcomes: names.map((name, i) => ({ name, price: prices[i] })),
    volumeUsd,
    endDate: typeof m.endDate === 'string' ? m.endDate : null,
  }
}

/**
 * Fetch curated markets by their stable Gamma market id (`GET /markets/<id>`,
 * which — unlike `?search=` — reliably returns the one intended market). Each
 * result is tagged with the caller's app `slug` (via MirrorPrice.query) so the
 * price route can key responses by slug. Trusted/curated, so the volume floor
 * is skipped. Never throws — a failed id contributes no row.
 */
export async function fetchPolymarketById(
  items: Array<{ slug: string; marketId: string }>,
  fetchImpl: typeof fetch = fetch,
): Promise<MirrorPrice[]> {
  const results: MirrorPrice[] = []

  await Promise.all(
    items.map(async ({ slug, marketId }) => {
      try {
        const res = await fetchImpl(`${GAMMA_URL}/${marketId}`)
        if (!res.ok) return

        const raw = await res.json()
        const parsed = parseMarket(raw, slug, { skipVolumeFloor: true })
        if (parsed) results.push(parsed)
      } catch {
        // Swallow per-id failures — caller marks the slug stale.
      }
    }),
  )

  return results
}

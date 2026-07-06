/**
 * Landing-page market seed data.
 *
 * Single source of truth for the hardcoded landing grid, extracted out of
 * app/page.tsx so it can be:
 *   1. rendered immediately as the no-flash fallback (app/page.tsx), and
 *   2. inserted into the `markets` catalog (scripts/seed-catalog-from-hardcoded).
 *
 * Pure data only — no imports, no 'use client'. Non-sensitive (it's already
 * shipped to the browser today), so bundling it into the client page is fine.
 */

export type TickerItem = { mkt: string; pct: number; slug?: string }

export const TICKER_DATA: TickerItem[] = [
  { mkt: 'Argentina win WC 2026',                pct: 9,  slug: 'wc-argentina' },
  { mkt: 'BTC tops $120k in 2026',               pct: 11, slug: 'crypto-btc-120k' },
  { mkt: 'France win WC 2026',                   pct: 16, slug: 'wc-france' },
  { mkt: 'Signal No. 3 in Manila before August', pct: 22 },
  { mkt: 'Bea top-5 at Miss Universe 2026',      pct: 48 },
  { mkt: 'Spain win WC 2026',                    pct: 17, slug: 'wc-spain' },
  { mkt: 'SB19 play Lollapalooza 2026',          pct: 92 },
  { mkt: 'USD/PHP closes < 55 by Dec',           pct: 31 },
  { mkt: 'ETH tops $5,500 in 2026',              pct: 8,  slug: 'crypto-eth-5500' },
]

export const CATEGORIES = [
  { key: 'trending', label: 'Trending',    count: 142 },
  { key: 'sports',   label: 'Sports',      count: 38  },
  { key: 'showbiz',  label: 'Showbiz',     count: 24  },
  { key: 'crypto',   label: 'Crypto',      count: 19  },
  { key: 'weather',  label: 'Weather',     count: 11  },
  { key: 'world',    label: 'World',       count: 32  },
  { key: 'popcult',  label: 'Pop culture', count: 18  },
] as const

export type CategoryKey = typeof CATEGORIES[number]['key']

export type MarketRow = { cat: string; q: string; pct: number; d: number; vol: string; slug?: string }

export const MARKETS: Record<CategoryKey, MarketRow[]> = {
  // NOTE: `vol` is no longer rendered anywhere (fabricated figures were cut);
  // it survives only as the curation/interest-ranking input for
  // scripts/seed-catalog-from-hardcoded.
  trending: [
    { cat: 'World Cup', q: 'Argentina win the 2026 FIFA World Cup',            pct: 9,  d: +2,  vol: '₱6.1M', slug: 'wc-argentina' },
    { cat: 'World Cup', q: 'France win the 2026 FIFA World Cup',               pct: 16, d: +3,  vol: '₱4.0M', slug: 'wc-france' },
    { cat: 'Showbiz',   q: 'Bea Millan-Windorski places top-5 at Miss Universe 2026', pct: 48, d: +7, vol: '₱1.3M' },
    { cat: 'Crypto',    q: 'Bitcoin tops $120,000 by Dec 31, 2026',             pct: 11, d: +6,  vol: '₱5.4M', slug: 'crypto-btc-120k' },
    { cat: 'World Cup', q: 'Spain win the 2026 FIFA World Cup',                 pct: 17, d: +3,  vol: '₱1.9M', slug: 'wc-spain' },
    { cat: 'Movies',    q: 'Spider-Man: Brand New Day is the biggest PH opening of 2026', pct: 63, d: +9, vol: '₱934K' },
  ],
  sports: [
    { cat: 'World Cup', q: 'Argentina win the 2026 FIFA World Cup',             pct: 9,  d: +2,  vol: '₱6.1M', slug: 'wc-argentina' },
    { cat: 'World Cup', q: 'Brazil win the 2026 FIFA World Cup',                pct: 14, d: +4,  vol: '₱4.0M', slug: 'wc-brazil' },
    { cat: 'World Cup', q: 'England win the 2026 FIFA World Cup',               pct: 10, d: +1,  vol: '₱2.8M', slug: 'wc-england' },
    { cat: 'World Cup', q: 'Spain win the 2026 FIFA World Cup',                 pct: 11, d: +3,  vol: '₱1.9M', slug: 'wc-spain' },
    { cat: 'Boxing',    q: 'Manny Pacquiao announces a return bout in 2026',     pct: 17, d: +1,  vol: '₱2.7M' },
    { cat: 'F1',        q: "Max Verstappen wins the 2026 Drivers' Championship", pct: 41, d: -6,  vol: '₱783K' },
  ],
  showbiz: [
    { cat: 'Pageant', q: 'Bea Millan-Windorski places top-5 at Miss Universe 2026', pct: 48, d: +7,  vol: '₱1.3M' },
    { cat: 'Movies',  q: 'Spider-Man: Brand New Day is the biggest PH opening of 2026', pct: 63, d: +9, vol: '₱934K' },
    { cat: 'Music',   q: 'SB19 performs at Lollapalooza 2026',                     pct: 92, d: +1,  vol: '₱508K' },
    { cat: 'Awards',  q: 'Dolly de Leon lands another Hollywood lead in 2026',     pct: 34, d: -2,  vol: '₱421K' },
  ],
  crypto: [
    { cat: 'BTC',  q: 'Bitcoin tops $120,000 by Dec 31, 2026',        pct: 11, d: +6, vol: '₱5.4M', slug: 'crypto-btc-120k' },
    { cat: 'ETH',  q: 'Ethereum tops $5,500 by Dec 31, 2026',         pct: 8,  d: -2, vol: '₱2.1M', slug: 'crypto-eth-5500' },
    { cat: 'PHP',  q: 'USD/PHP closes below 55 on Dec 31, 2026',      pct: 31, d: -7, vol: '₱1.8M' },
    { cat: 'BSP',  q: 'BSP cuts rates by 50bps before end of Q3',     pct: 62, d: +4, vol: '₱990K' },
    { cat: 'PSEi', q: 'PSEi crosses 8,000 in 2026',                   pct: 41, d: +1, vol: '₱1.3M' },
    { cat: 'Reg',  q: 'BSP licenses a peso-pegged stablecoin in 2026', pct: 28, d: +9, vol: '₱702K' },
  ],
  weather: [
    { cat: 'Storm',   q: 'Signal No. 3 declared in Metro Manila before August', pct: 22, d: -2,  vol: '₱614K' },
    { cat: 'Storm',   q: 'At least 20 named typhoons by end of 2026',         pct: 67, d: +4,  vol: '₱430K' },
    { cat: 'Heat',    q: 'Heat index in Manila exceeds 50°C this year',       pct: 81, d: +12, vol: '₱290K' },
    { cat: 'Rain',    q: 'Habagat causes class suspensions in NCR this July', pct: 73, d: +3,  vol: '₱204K' },
    { cat: 'Quake',   q: 'Magnitude 6+ earthquake in Luzon in 2026',          pct: 39, d: 0,   vol: '₱338K' },
    { cat: 'Climate', q: 'Manila records its hottest year on record in 2026', pct: 64, d: +8,  vol: '₱176K' },
  ],
  world: [
    { cat: 'US',    q: 'US recession officially declared in 2026',          pct: 34, d: -8,  vol: '₱3.1M' },
    { cat: 'China', q: 'China invades Taiwan by the end of 2026',            pct: 7,  d: -1,  vol: '₱2.0M', slug: 'world-china-taiwan' },
    { cat: 'Tech',  q: 'OpenAI launches a Manila office in 2026',            pct: 14, d: +2,  vol: '₱412K' },
    { cat: 'Space', q: 'SpaceX completes a Mars uncrewed landing in 2026',   pct: 23, d: -4,  vol: '₱890K' },
    { cat: 'AI',    q: 'AI passes the bar exam with 95%+ score in 2026',     pct: 78, d: +11, vol: '₱1.3M' },
    { cat: 'Korea', q: 'BTS reunion world tour announced before 2027',        pct: 56, d: +5,  vol: '₱2.4M' },
  ],
  popcult: [
    { cat: 'Viral', q: 'A Filipino creator hits 50M YouTube subscribers', pct: 36, d: +7, vol: '₱221K' },
    { cat: 'Game',  q: 'GTA VI launches before end of 2026',              pct: 81, d: +4, vol: '₱1.9M' },
    { cat: 'Music', q: 'SB19 performs at Lollapalooza 2026',              pct: 92, d: +1, vol: '₱508K' },
    { cat: 'Award', q: 'A Filipino wins the Magsaysay this year',         pct: 51, d: +1, vol: '₱312K' },
  ],
}

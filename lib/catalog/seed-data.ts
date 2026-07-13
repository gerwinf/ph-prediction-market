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
  { mkt: 'Blacklist win MPL Philippines',        pct: 34 },
  { mkt: 'BTC tops $120k in 2026',               pct: 11, slug: 'crypto-btc-120k' },
  { mkt: 'Ginebra win the PBA Philippine Cup',   pct: 29 },
  { mkt: 'USD/PHP above 60 in 2026',             pct: 27 },
  { mkt: 'Bea top-5 at Miss Universe 2026',      pct: 48 },
  { mkt: 'Spain win WC 2026',                    pct: 17, slug: 'wc-spain' },
  { mkt: 'SB19 play Lollapalooza 2026',          pct: 92 },
  { mkt: 'ETH tops $5,500 in 2026',              pct: 8,  slug: 'crypto-eth-5500' },
]

// Tab counts are derived at render time from the rows actually shown
// (seed grid or catalog merge) — never hardcode an inventory number here.
export const CATEGORIES = [
  { key: 'trending', label: 'Trending' },
  { key: 'sports',   label: 'Sports' },
  { key: 'esports',  label: 'Esports' },
  { key: 'showbiz',  label: 'Showbiz' },
  { key: 'crypto',   label: 'Finance' },
  { key: 'weather',  label: 'Daily life' },
  { key: 'world',    label: 'World' },
  { key: 'popcult',  label: 'Pop culture' },
] as const

export type CategoryKey = typeof CATEGORIES[number]['key']

export type MarketRow = { cat: string; q: string; pct: number; d: number; vol: string; slug?: string }

export const MARKETS: Record<CategoryKey, MarketRow[]> = {
  // NOTE: `vol` is no longer rendered anywhere (fabricated figures were cut);
  // it survives only as the curation/interest-ranking input for
  // scripts/seed-catalog-from-hardcoded.
  trending: [
    { cat: 'PBA',       q: 'Barangay Ginebra win the 2026 PBA Philippine Cup',    pct: 29, d: +4,  vol: '₱4.8M' },
    { cat: 'MLBB',      q: 'AP Bren defend their MLBB world title in 2026',        pct: 28, d: +3,  vol: '₱3.4M' },
    { cat: 'Forex',     q: 'USD/PHP trades above 60 at any point in 2026',         pct: 27, d: +5,  vol: '₱2.3M' },
    { cat: 'Pageant',   q: 'The Philippines makes the Miss Universe 2026 top-3',   pct: 39, d: +4,  vol: '₱1.6M' },
    { cat: 'World Cup', q: 'Argentina win the 2026 FIFA World Cup',                pct: 9,  d: +2,  vol: '₱6.1M', slug: 'wc-argentina' },
    { cat: 'BTC',       q: 'Bitcoin tops $120,000 by Dec 31, 2026',                pct: 11, d: +6,  vol: '₱5.4M', slug: 'crypto-btc-120k' },
  ],
  sports: [
    { cat: 'PBA',       q: 'Barangay Ginebra win the 2026 PBA Philippine Cup',    pct: 29, d: +4,  vol: '₱4.8M' },
    { cat: 'PBA',       q: 'TNT Tropang Giga reach the 2026 PBA Finals',          pct: 41, d: -3,  vol: '₱2.6M' },
    { cat: 'UAAP',      q: 'UP Fighting Maroons win the UAAP Season 89 men’s title', pct: 31, d: +5,  vol: '₱1.4M' },
    { cat: 'NBA',       q: 'Luka Dončić is named 2026-27 NBA MVP',                pct: 18, d: +1,  vol: '₱2.2M' },
    { cat: 'PVL',       q: 'Creamline win the 2026 PVL All-Filipino Conference',   pct: 44, d: +2,  vol: '₱1.1M' },
    { cat: 'Boxing',    q: 'Manny Pacquiao announces a return bout in 2026',       pct: 17, d: +1,  vol: '₱2.7M' },
    { cat: 'World Cup', q: 'Argentina win the 2026 FIFA World Cup',               pct: 9,  d: +2,  vol: '₱6.1M', slug: 'wc-argentina' },
    { cat: 'World Cup', q: 'Spain win the 2026 FIFA World Cup',                   pct: 17, d: +3,  vol: '₱1.9M', slug: 'wc-spain' },
  ],
  esports: [
    { cat: 'MLBB',     q: 'Blacklist International win MPL Philippines this season',    pct: 34, d: +5, vol: '₱2.9M' },
    { cat: 'MLBB',     q: 'AP Bren defend their MLBB world title in 2026',             pct: 28, d: +3, vol: '₱3.4M' },
    { cat: 'MLBB',     q: 'ECHO reach the MPL Philippines grand final this season',    pct: 45, d: -4, vol: '₱1.6M' },
    { cat: 'MLBB',     q: 'A Philippine team wins MLBB gold at the 2026 Esports World Cup', pct: 38, d: +7, vol: '₱2.1M' },
    { cat: 'Valorant', q: 'A Philippine team reaches the 2026 VCT Pacific playoffs',   pct: 52, d: +6, vol: '₱880K' },
    { cat: 'Dota 2',   q: 'TNC Predator qualify for a 2026 Dota 2 Major',             pct: 23, d: +2, vol: '₱540K' },
  ],
  showbiz: [
    { cat: 'Pageant', q: 'Bea Millan-Windorski places top-5 at Miss Universe 2026', pct: 48, d: +7,  vol: '₱1.3M' },
    { cat: 'Pageant', q: 'The Philippines makes the Miss Universe 2026 top-3',       pct: 39, d: +4,  vol: '₱1.6M' },
    { cat: 'Movies',  q: 'Spider-Man: Brand New Day is the biggest PH opening of 2026', pct: 63, d: +9, vol: '₱934K' },
    { cat: 'MMFF',    q: 'A Vice Ganda film tops the 2026 MMFF box office',          pct: 58, d: +2,  vol: '₱720K' },
    { cat: 'Music',   q: 'SB19 performs at Lollapalooza 2026',                       pct: 92, d: +1,  vol: '₱508K' },
    { cat: 'Awards',  q: 'Dolly de Leon lands another Hollywood lead in 2026',       pct: 34, d: -2,  vol: '₱421K' },
  ],
  crypto: [
    { cat: 'Forex', q: 'USD/PHP trades above 60 at any point in 2026',  pct: 27, d: +5, vol: '₱2.3M' },
    { cat: 'Forex', q: 'USD/PHP closes below 55 on Dec 31, 2026',       pct: 31, d: -7, vol: '₱1.8M' },
    { cat: 'Remit', q: 'OFW cash remittances top $40B in 2026',         pct: 64, d: +3, vol: '₱1.0M' },
    { cat: 'BSP',   q: 'BSP cuts rates by 50bps before end of Q3',      pct: 62, d: +4, vol: '₱990K' },
    { cat: 'BTC',   q: 'Bitcoin tops $120,000 by Dec 31, 2026',         pct: 11, d: +6, vol: '₱5.4M', slug: 'crypto-btc-120k' },
    { cat: 'ETH',   q: 'Ethereum tops $5,500 by Dec 31, 2026',          pct: 8,  d: -2, vol: '₱2.1M', slug: 'crypto-eth-5500' },
    { cat: 'PSEi',  q: 'PSEi crosses 8,000 in 2026',                    pct: 41, d: +1, vol: '₱1.3M' },
  ],
  weather: [
    { cat: 'Storm',   q: 'Signal No. 3 declared in Metro Manila before August', pct: 22, d: -2,  vol: '₱614K' },
    { cat: 'Storm',   q: 'At least 20 named typhoons by end of 2026',         pct: 67, d: +4,  vol: '₱430K' },
    { cat: 'Heat',    q: 'Heat index in Manila exceeds 50°C this year',       pct: 81, d: +12, vol: '₱290K' },
    { cat: 'Rain',    q: 'Habagat causes class suspensions in NCR this July', pct: 73, d: +3,  vol: '₱204K' },
    { cat: 'Fuel',    q: 'Diesel drops below ₱50/L in Metro Manila this year', pct: 42, d: -3,  vol: '₱280K' },
    { cat: 'Transit', q: 'The LRT-1 Cavite extension opens to riders in 2026', pct: 61, d: +2,  vol: '₱240K' },
    { cat: 'Quake',   q: 'Magnitude 6+ earthquake in Luzon in 2026',          pct: 39, d: 0,   vol: '₱338K' },
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

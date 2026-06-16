/* Hula app — mock data + helpers
 * Ported from design prototype (data-v2.js). All values are demo-only.
 */

export type MarketBinary = {
  id: string
  cat: string
  catLabel: string
  type: 'binary'
  title: string
  subtitle: string
  yes: number
  no: number
  prevYes: number
  volume: number
  liquidity: number
  movers: number[]
  closes: string
  resolution: string
  img: string
}

export type Market3way = {
  id: string
  cat: string
  catLabel: string
  type: '3way'
  title: string
  subtitle: string
  outcomes: { id: string; label: string; sub: string; price: number; prev: number }[]
  volume: number
  liquidity: number
  movers: { [outcomeId: string]: number[] }
  closes: string
  resolution: string
  img: string
}

export type Market = MarketBinary | Market3way

export const HULA_MARKETS: Market[] = [
  {
    id: 'WC26-ARG-ALG',
    cat: 'Football',
    catLabel: 'World Cup 2026',
    type: '3way',
    title: 'Argentina vs Algeria — Group Stage',
    subtitle: 'Arrowhead Stadium · Jun 17, 9:00 AM PHT',
    outcomes: [
      { id: 'home', label: 'Argentina', sub: 'HOME', price: 71, prev: 69 },
      { id: 'draw', label: 'Draw',      sub: 'DRAW', price: 19, prev: 21 },
      { id: 'away', label: 'Algeria',   sub: 'AWAY', price: 10, prev: 11 },
    ],
    volume: 312500, liquidity: 92800,
    movers: {
      home: [64, 66, 68, 69, 70, 70, 71, 71],
      draw: [24, 23, 22, 21, 20, 20, 19, 19],
      away: [12, 11, 10, 10, 10, 10, 10, 10],
    },
    closes: 'Closes at kickoff · Jun 17, 9:00 AM',
    resolution: 'FIFA-official feed via Pyth oracle',
    img: 'linear-gradient(135deg, #75AADB 0%, #1E3A8A 100%)',
  },
  {
    id: 'PBA-25-FIN-GIN',
    cat: 'PBA',
    catLabel: 'PBA Philippine Cup',
    type: 'binary',
    title: 'Will Ginebra win the PBA Finals?',
    subtitle: 'Best of 7 · Game 4 tonight · Series 2-1',
    yes: 64, no: 36, prevYes: 60,
    volume: 142800, liquidity: 38400,
    movers: [62, 65, 63, 66, 64, 68, 64, 64],
    closes: 'Closes May 8, 2026',
    resolution: 'Official PBA Finals box score · Pyth oracle',
    img: 'linear-gradient(135deg, #B8860B 0%, #6B3410 100%)',
  },
  {
    id: 'MLBB-M7-ECHO',
    cat: 'MLBB',
    catLabel: 'M7 World Championship',
    type: 'binary',
    title: 'Will ECHO win M7?',
    subtitle: 'Group stage · Day 3',
    yes: 48, no: 52, prevYes: 51,
    volume: 89400, liquidity: 24100,
    movers: [52, 50, 49, 48, 49, 47, 48, 48],
    closes: 'Closes Dec 14, 2026',
    resolution: 'Moonton-official bracket · UMA oracle',
    img: 'linear-gradient(135deg, #2563EB 0%, #1E1B4B 100%)',
  },
  {
    id: 'WC26-ARG-CHAMP',
    cat: 'Football',
    catLabel: 'World Cup 2026',
    type: 'binary',
    title: 'Will Argentina defend their World Cup title?',
    subtitle: 'Tournament outright',
    yes: 38, no: 62, prevYes: 36,
    volume: 412500, liquidity: 124800,
    movers: [34, 36, 35, 37, 38, 38, 38, 38],
    closes: 'Closes Jul 19, 2026',
    resolution: 'FIFA-official feed via Pyth oracle',
    img: 'linear-gradient(135deg, #75AADB 0%, #1E3A8A 100%)',
  },
  {
    id: 'PAC-26',
    cat: 'Boxing',
    catLabel: 'Boxing',
    type: 'binary',
    title: 'Will Pacquiao win his next fight?',
    subtitle: 'Comeback bout · Riyadh',
    yes: 58, no: 42, prevYes: 55,
    volume: 67200, liquidity: 18900,
    movers: [52, 54, 53, 56, 55, 58, 57, 58],
    closes: 'Closes fight night',
    resolution: 'WBA/WBC-official decision · UMA oracle',
    img: 'linear-gradient(135deg, #DC2626 0%, #450A0A 100%)',
  },
  {
    id: 'MU-26',
    cat: 'Pageants',
    catLabel: 'Miss Universe 2026',
    type: 'binary',
    title: 'Philippines crowns a Miss Universe top-3 finalist?',
    subtitle: 'Bb. Pilipinas · Coronation Sep 22',
    yes: 71, no: 29, prevYes: 68,
    volume: 56200, liquidity: 14800,
    movers: [66, 68, 69, 70, 71, 72, 71, 71],
    closes: 'Closes Sep 22, 2026',
    resolution: 'Miss Universe Org. official result',
    img: 'linear-gradient(135deg, #DB2777 0%, #581C87 100%)',
  },
  {
    id: 'WC-FIN-26',
    cat: 'Football',
    catLabel: 'World Cup 2026',
    type: 'binary',
    title: 'Will Brazil win the 2026 FIFA World Cup?',
    subtitle: 'Group stage · live now',
    yes: 14, no: 86, prevYes: 12,
    volume: 198400, liquidity: 51200,
    movers: [11, 12, 12, 13, 12, 14, 13, 14],
    closes: 'Closes Jul 19, 2026',
    resolution: 'FIFA-official result · Pyth oracle',
    img: 'linear-gradient(135deg, #009739 0%, #042F1A 100%)',
  },
]

export const HULA_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'Football', label: 'Football' },
  { id: 'PBA', label: 'PBA' },
  { id: 'MLBB', label: 'MLBB' },
  { id: 'Boxing', label: 'Boxing' },
  { id: 'Pageants', label: 'Pageants' },
]

export type OpenPosition = {
  id: string
  marketId: string
  market: string
  outcome: string
  shares: number
  avgPrice: number
  currentPrice: number
  cost: number
  value: number
  status: 'open'
}

export const HULA_POSITIONS_OPEN: OpenPosition[] = [
  {
    id: 'p1', marketId: 'PBA-25-FIN-GIN',
    market: 'Ginebra wins PBA Finals',
    outcome: 'YES', shares: 200, avgPrice: 58, currentPrice: 64,
    cost: 11600, value: 12800, status: 'open',
  },
  {
    id: 'p2', marketId: 'WC26-ARG-ALG',
    market: 'Argentina vs Algeria',
    outcome: 'Argentina (HOME)', shares: 100, avgPrice: 68, currentPrice: 71,
    cost: 6800, value: 7100, status: 'open',
  },
]

export type PendingPosition = {
  id: string
  marketId: string
  market: string
  outcome: string
  shares: number
  avgPrice: number
  cost: number
  status: 'settling'
  note: string
}

export const HULA_POSITIONS_PENDING: PendingPosition[] = [
  {
    id: 'p3', marketId: 'PVL-CHI',
    market: 'Chery Tiggo tops PVL',
    outcome: 'YES', shares: 120, avgPrice: 56,
    cost: 6720, status: 'settling',
    note: 'Awaiting oracle · est. 30 min',
  },
]

export type ResolvedPosition = {
  id: string
  marketId: string
  market: string
  outcome: string
  shares: number
  avgPrice: number
  settledPrice: number
  cost: number
  payout: number
  profit: number
  status: 'won' | 'lost'
  settledAt: string
}

export const HULA_POSITIONS_RESOLVED: ResolvedPosition[] = [
  {
    id: 'p4', marketId: 'PBA-SF-G5',
    market: 'TNT win semis Game 5',
    outcome: 'NO', shares: 150, avgPrice: 60, settledPrice: 100,
    cost: 9000, payout: 15000, profit: 6000, status: 'won',
    settledAt: 'Apr 26',
  },
  {
    id: 'p5', marketId: 'MU-Q4',
    market: 'PH wins Q4 culture poll',
    outcome: 'YES', shares: 80, avgPrice: 64, settledPrice: 0,
    cost: 5120, payout: 0, profit: -5120, status: 'lost',
    settledAt: 'Apr 14',
  },
]

export const peso = (n: number, opts: { sign?: boolean } = {}): string => {
  if (typeof n !== 'number') return n
  const sign = opts.sign && n > 0 ? '+' : ''
  return sign + (n < 0 ? '−' : '') + '₱' + Math.abs(n).toLocaleString('en-PH', { maximumFractionDigits: 0 })
}

export const pesoCents = (n: number): string => {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const sparkPath = (values: number[], w = 80, h = 24): string => {
  if (!values || !values.length) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const step = w / (values.length - 1)
  return values.map((v, i) => {
    const x = i * step
    const y = h - ((v - min) / range) * h
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')
}

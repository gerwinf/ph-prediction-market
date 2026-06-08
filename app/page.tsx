'use client'

import { useState, useEffect, FormEvent } from 'react'

// Live Polymarket odds (see lib/oracle/slugs.ts LIVE_MARKETS) are overlaid onto
// any row carrying a `slug`; untagged (PH-local) rows stay hardcoded. The `pct`
// here is the fallback shown until the fetch resolves (or if it's stale).
type PriceInfo = { outcomes: { name: string; price: number }[]; is_stale: boolean; fetched_at: string }
type PricesMap = Record<string, PriceInfo>

// Returns the live "Yes" probability % for a slug when fresh, else the fallback.
function livePct(prices: PricesMap, slug: string | undefined, fallback: number): number {
  if (!slug) return fallback
  const row = prices[slug]
  if (!row || row.is_stale) return fallback
  const yes = Array.isArray(row.outcomes) ? row.outcomes[0]?.price : undefined
  return typeof yes === 'number' ? Math.round(yes * 100) : fallback
}

type TickerItem = { mkt: string; pct: number; slug?: string }

const TICKER_DATA: TickerItem[] = [
  { mkt: 'Argentina win WC 2026',            pct: 9,  slug: 'wc-argentina' },
  { mkt: 'BTC > ₱4M by Q3',                  pct: 71 },
  { mkt: 'Knicks win NBA Finals',            pct: 78, slug: 'nba-knicks' },
  { mkt: 'Signal No. 3 hits Manila in May',  pct: 22 },
  { mkt: 'Bea top-5 at Miss Universe 2026',  pct: 48 },
  { mkt: 'BINI sells out MOA · Jun 20',      pct: 88 },
  { mkt: 'Ginebra win PBA Comm’s Cup',       pct: 41 },
  { mkt: 'USD/PHP closes < 55 by Dec',       pct: 31 },
  { mkt: 'ECHO win MPL-PH S17',              pct: 44 },
]

const CATEGORIES = [
  { key: 'trending', label: 'Trending',    count: 142 },
  { key: 'sports',   label: 'Sports',      count: 38  },
  { key: 'showbiz',  label: 'Showbiz',     count: 24  },
  { key: 'crypto',   label: 'Crypto',      count: 19  },
  { key: 'weather',  label: 'Weather',     count: 11  },
  { key: 'world',    label: 'World',       count: 32  },
  { key: 'popcult',  label: 'Pop culture', count: 18  },
] as const

type CategoryKey = typeof CATEGORIES[number]['key']

type MarketRow = { cat: string; q: string; pct: number; d: number; vol: string; slug?: string }

const MARKETS: Record<CategoryKey, MarketRow[]> = {
  trending: [
    { cat: 'World Cup', q: 'Argentina win the 2026 FIFA World Cup',            pct: 9,  d: +2,  vol: '₱6.1M', slug: 'wc-argentina' },
    { cat: 'NBA',       q: 'The Knicks win the 2026 NBA Finals',               pct: 78, d: +5,  vol: '₱4.0M', slug: 'nba-knicks' },
    { cat: 'Showbiz',   q: 'Bea Millan-Windorski places top-5 at Miss Universe 2026', pct: 48, d: +7, vol: '₱1.3M' },
    { cat: 'Crypto',    q: 'Bitcoin closes above ₱4M on Dec 31, 2026',          pct: 71, d: +6,  vol: '₱5.4M' },
    { cat: 'MLBB',      q: 'ECHO wins MPL-PH Season 17',                        pct: 44, d: +9,  vol: '₱2.2M' },
    { cat: 'Music',     q: 'BINI sells out the SM MOA Arena on June 20',        pct: 88, d: +3,  vol: '₱1.2M' },
  ],
  sports: [
    { cat: 'World Cup', q: 'Argentina win the 2026 FIFA World Cup',             pct: 9,  d: +2,  vol: '₱6.1M', slug: 'wc-argentina' },
    { cat: 'NBA',       q: 'The Knicks win the 2026 NBA Finals',                pct: 78, d: +5,  vol: '₱4.0M', slug: 'nba-knicks' },
    { cat: 'PBA',       q: 'Ginebra wins the 2026 PBA Commissioner’s Cup',       pct: 41, d: -3,  vol: '₱2.8M' },
    { cat: 'NBA',       q: 'Wembanyama outscores SGA in the West Finals series', pct: 38, d: +4,  vol: '₱1.9M' },
    { cat: 'Boxing',    q: 'Manny Pacquiao announces a return bout in 2026',     pct: 17, d: +1,  vol: '₱2.7M' },
    { cat: 'F1',        q: "Max Verstappen wins the 2026 Drivers' Championship", pct: 41, d: -6,  vol: '₱783K' },
  ],
  showbiz: [
    { cat: 'Pageant', q: 'Bea Millan-Windorski places top-5 at Miss Universe 2026', pct: 48, d: +7,  vol: '₱1.3M' },
    { cat: 'Music',   q: 'BINI sells out the SM MOA Arena on June 20',             pct: 88, d: +3,  vol: '₱1.2M' },
    { cat: 'Movies',  q: 'Toy Story 5 tops ₱150M on its PH opening weekend',       pct: 55, d: +4,  vol: '₱612K' },
    { cat: 'Movies',  q: 'Spider-Man: Brand New Day is the biggest PH opening of 2026', pct: 63, d: +9, vol: '₱934K' },
    { cat: 'Music',   q: 'SB19 performs at Lollapalooza 2026',                     pct: 92, d: +1,  vol: '₱508K' },
    { cat: 'Awards',  q: 'Dolly de Leon lands another Hollywood lead in 2026',     pct: 34, d: -2,  vol: '₱421K' },
  ],
  crypto: [
    { cat: 'BTC',  q: 'Bitcoin > ₱4M by close of Q3 2026',            pct: 71, d: +6, vol: '₱5.4M' },
    { cat: 'ETH',  q: 'Ethereum closes above ₱300k on Dec 31, 2026',  pct: 48, d: -2, vol: '₱2.1M' },
    { cat: 'PHP',  q: 'USD/PHP closes below 55 on Dec 31, 2026',      pct: 31, d: -7, vol: '₱1.8M' },
    { cat: 'BSP',  q: 'BSP cuts rates by 50bps before end of Q3',     pct: 62, d: +4, vol: '₱990K' },
    { cat: 'PSEi', q: 'PSEi crosses 8,000 in 2026',                   pct: 41, d: +1, vol: '₱1.3M' },
    { cat: 'Reg',  q: 'BSP licenses a peso-pegged stablecoin in 2026', pct: 28, d: +9, vol: '₱702K' },
  ],
  weather: [
    { cat: 'Storm',   q: 'Signal No. 3 declared in Metro Manila this May',   pct: 22, d: -2,  vol: '₱614K' },
    { cat: 'Storm',   q: 'At least 20 named typhoons by end of 2026',         pct: 67, d: +4,  vol: '₱430K' },
    { cat: 'Heat',    q: 'Heat index in Manila exceeds 50°C this year',       pct: 81, d: +12, vol: '₱290K' },
    { cat: 'Rain',    q: 'Habagat causes class suspensions in NCR this June', pct: 73, d: +3,  vol: '₱204K' },
    { cat: 'Quake',   q: 'Magnitude 6+ earthquake in Luzon in 2026',          pct: 39, d: 0,   vol: '₱338K' },
    { cat: 'Climate', q: 'Manila records its hottest year on record in 2026', pct: 64, d: +8,  vol: '₱176K' },
  ],
  world: [
    { cat: 'US',    q: 'US recession officially declared in 2026',          pct: 34, d: -8,  vol: '₱3.1M' },
    { cat: 'China', q: 'China and Taiwan see armed conflict before 2027',    pct: 11, d: -1,  vol: '₱2.0M' },
    { cat: 'Tech',  q: 'OpenAI launches a Manila office in 2026',            pct: 14, d: +2,  vol: '₱412K' },
    { cat: 'Space', q: 'SpaceX completes a Mars uncrewed landing in 2026',   pct: 23, d: -4,  vol: '₱890K' },
    { cat: 'AI',    q: 'AI passes the bar exam with 95%+ score in 2026',     pct: 78, d: +11, vol: '₱1.3M' },
    { cat: 'Korea', q: 'BTS reunion world tour announced before 2027',        pct: 56, d: +5,  vol: '₱2.4M' },
  ],
  popcult: [
    { cat: 'Music', q: 'BINI sells out the SM MOA Arena on June 20',      pct: 88, d: +3, vol: '₱1.2M' },
    { cat: 'Movie', q: 'Toy Story 5 tops ₱150M on its PH opening weekend', pct: 55, d: +4, vol: '₱612K' },
    { cat: 'Viral', q: 'A Filipino creator hits 50M YouTube subscribers', pct: 36, d: +7, vol: '₱221K' },
    { cat: 'Game',  q: 'GTA VI launches before end of 2026',              pct: 81, d: +4, vol: '₱1.9M' },
    { cat: 'Music', q: 'SB19 performs at Lollapalooza 2026',              pct: 92, d: +1, vol: '₱508K' },
    { cat: 'Award', q: 'A Filipino wins the Magsaysay this year',         pct: 51, d: +1, vol: '₱312K' },
  ],
}

function LogoMono() {
  return <span className="logo-mono">H</span>
}

function LogoWordmark({ size }: { size?: number }) {
  return (
    <span className="logo-wordmark" style={size ? { fontSize: size } : undefined}>
      Hula<span className="dot">.</span>
    </span>
  )
}

function LogoLockup() {
  return (
    <span className="logo-lockup">
      <LogoMono />
      <LogoWordmark />
    </span>
  )
}

function Ticker({ prices }: { prices: PricesMap }) {
  const items = [...TICKER_DATA, ...TICKER_DATA]
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        {items.map((it, i) => (
          <span className="ticker-item" key={i}>
            <span className="ticker-dot" />
            <span className="lbl">{it.mkt}</span>
            <span className="pct">{livePct(prices, it.slug, it.pct)}%</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function Nav({ onBurger }: { onBurger: () => void }) {
  const scrollToWaitlist = (e: React.MouseEvent) => {
    e.preventDefault()
    document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' })
  }
  return (
    <nav className="nav shell">
      <div className="nav-l">
        <LogoLockup />
        <div className="nav-links">
          <a href="#markets">Markets</a>
          <a href="#markets">Sports</a>
          <a href="#markets">Showbiz</a>
          <a href="#how">How it works</a>
        </div>
      </div>
      <div className="nav-r">
        <a className="btn btn-primary" href="#waitlist" onClick={scrollToWaitlist}>Hulaan na →</a>
        <button className="nav-burger" type="button" aria-label="Open menu" onClick={onBurger}>
          <i /><i /><i />
        </button>
      </div>
    </nav>
  )
}

function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  const go = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    onClose()
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 80)
  }

  return (
    <div className={'mobile-menu' + (open ? ' open' : '')} aria-hidden={!open}>
      <div className="mobile-menu-head">
        <LogoLockup />
        <button className="mobile-menu-close" type="button" aria-label="Close menu" onClick={onClose}>×</button>
      </div>
      <div className="mobile-menu-links">
        <a href="#markets" onClick={go('markets')}>Markets</a>
        <a href="#how" onClick={go('how')}>How it works</a>
        <a href="#waitlist" onClick={go('waitlist')}>Reserve handle</a>
      </div>
      <div className="mobile-menu-foot">
        <a className="btn btn-primary btn-lg" href="#waitlist" onClick={go('waitlist')}>Hulaan na →</a>
      </div>
    </div>
  )
}

function FeaturedCard({ prices }: { prices: PricesMap }) {
  const yes = livePct(prices, 'wc-argentina', 64)
  const no = 100 - yes
  return (
    <div className="featured">
      <div className="featured-head">
        <span className="featured-tag">Featured · World Cup 2026</span>
        <span className="featured-vol">VOL ₱4.21M</span>
      </div>
      <h3 className="featured-q">Will Argentina win the 2026 FIFA World Cup?</h3>
      <div className="featured-bar">
        <i className="yes" style={{ width: yes + '%' }} />
        <i className="no" style={{ width: no + '%' }} />
      </div>
      <div className="featured-legend">
        <span className="yes"><strong>YES</strong> ₱{yes} · {yes}%</span>
        <span className="no"><strong>NO</strong> ₱{no} · {no}%</span>
      </div>
      <div className="featured-bet">
        <button className="bet-btn yes" type="button">
          <span className="lbl">Buy YES</span>
          <span className="val">₱{yes}.00</span>
        </button>
        <button className="bet-btn no" type="button">
          <span className="lbl">Buy NO</span>
          <span className="val">₱{no}.00</span>
        </button>
      </div>
    </div>
  )
}

function EmailForm({ id, variant = 'hero' }: { id?: string; variant?: 'hero' | 'cta' }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('loading')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        setStatus('success')
        setEmail('')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <form id={id} className="email-form" onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.ph"
        disabled={status === 'loading'}
        required
      />
      <button
        type="submit"
        className={'btn btn-lg ' + (variant === 'cta' ? 'btn-primary' : 'btn-accent')}
        disabled={status === 'loading' || !email.trim()}
      >
        {status === 'loading' ? 'Loading…' : status === 'success' ? "You're in" : 'Reserve handle →'}
      </button>
      {status === 'success' && <div className="msg">Salamat — we&apos;ll be in touch.</div>}
      {status === 'error' && <div className="msg error">Something broke. Try again.</div>}
    </form>
  )
}

function Hero({ prices }: { prices: PricesMap }) {
  return (
    <section className="hero shell">
      <div className="hero-grid">
        <div>
          <div className="eyebrow">
            <span className="dot" />
            Pre-launch · Reserve a handle
          </div>
          <h1 className="h1">
            The market for <em>what happens next.</em>
          </h1>
          <p className="lede">
            Hula is the Philippines&apos; prediction market — trade the outcome of basketball, boxing, billboards, and the biggest stories of the day. Real money, real probabilities, regulated locally.
          </p>
          <EmailForm id="waitlist" variant="hero" />
          <div style={{ marginTop: 14 }}>
            <span className="cta-meta" style={{ paddingLeft: 0 }}>First 1,000 founding members · zero fees for life · 21+</span>
          </div>
        </div>
        <FeaturedCard prices={prices} />
      </div>
    </section>
  )
}

function MarketCard({ m, prices }: { m: MarketRow; prices: PricesMap }) {
  const pct = livePct(prices, m.slug, m.pct)
  const yesPrice = pct
  const noPrice = 100 - pct
  return (
    <article className="card">
      <div className="card-head">
        <span className="card-cat">{m.cat}</span>
        <span className="card-vol">VOL {m.vol}</span>
      </div>
      <h3 className="card-q">{m.q}</h3>
      <div className="card-prob">
        <span className="pct">{pct}%</span>
        <span className="pct-lbl">chance</span>
      </div>
      <div className="card-bar"><i style={{ width: pct + '%' }} /></div>
      <div className="card-actions">
        <button className="bet-btn yes" type="button">
          <span className="lbl">YES</span>
          <span className="val">₱{yesPrice}</span>
        </button>
        <button className="bet-btn no" type="button">
          <span className="lbl">NO</span>
          <span className="val">₱{noPrice}</span>
        </button>
      </div>
    </article>
  )
}

function Markets({ prices }: { prices: PricesMap }) {
  const [active, setActive] = useState<CategoryKey>('trending')
  const cards = MARKETS[active]
  return (
    <section id="markets" className="section shell">
      <div className="section-head">
        <div>
          <div className="section-kicker">Live Markets</div>
          <h2 className="section-title">Today&apos;s odds, settled in pesos.</h2>
        </div>
      </div>
      <div className="cat-tabs">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            className={'cat-tab' + (c.key === active ? ' active' : '')}
            onClick={() => setActive(c.key)}
          >
            {c.label}<span className="count">{c.count}</span>
          </button>
        ))}
      </div>
      <div className="market-grid">
        {cards.map((m, i) => <MarketCard key={i} m={m} prices={prices} />)}
      </div>
    </section>
  )
}

function HowItWorks() {
  const steps = [
    { n: '01', t: 'Pumili ng hula.',  d: 'Browse hundreds of live markets — sports, showbiz, weather, world events. Each one is a yes-or-no question with real odds.' },
    { n: '02', t: 'Bumili ng share.', d: 'A YES or NO share costs from ₱1 to ₱99, depending on the market price. The price is the probability.' },
    { n: '03', t: 'Kunin ang bayad.', d: 'If your prediction is correct, every share pays out ₱100. Sell anytime, settled to GCash, Maya, or your bank.' },
  ]
  return (
    <section id="how" className="section shell">
      <div className="section-head">
        <div>
          <div className="section-kicker">Paano gumagana</div>
          <h2 className="section-title">How a hula works.</h2>
        </div>
      </div>
      <div className="steps">
        {steps.map((s) => (
          <div key={s.n} className="step">
            <div className="step-num">— {s.n}</div>
            <h3 className="step-t">{s.t}</h3>
            <p className="step-d">{s.d}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Pullquote() {
  return (
    <section className="pull">
      <div className="shell">
        <p className="pull-q">
          Hindi lang ito panghuhula. <em>It&apos;s a market.</em>
        </p>
        <div className="pull-by">— Hula manifesto · 2026</div>
      </div>
    </section>
  )
}

function Stats() {
  const data = [
    { n: '₱412M', l: 'Volume traded · 30d' },
    { n: '184K',  l: 'Active hulers' },
    { n: '1,420', l: 'Live markets' },
    { n: '98.2%', l: 'Settlement on time' },
  ]
  return (
    <section className="section shell">
      <div className="section-head">
        <div>
          <div className="section-kicker">By the numbers</div>
          <h2 className="section-title">The market is liquid.</h2>
        </div>
        <span className="cta-meta" style={{ paddingLeft: 0 }}>Illustrative · pre-launch</span>
      </div>
      <div className="stats">
        {data.map((s, i) => (
          <div key={i} className="stat">
            <div className="stat-n">{s.n}</div>
            <div className="stat-l">{s.l}</div>
          </div>
        ))}
      </div>
      <div className="compliance">
        <span className="badge">21+</span>
        <div>
          <strong>Hula will operate under PAGCOR oversight.</strong>{' '}
          Markets will be open only to Philippine residents 21 years and above. Government employees, AFP/PNP personnel, and persons in the NDRP will not be eligible. Magdiwang nang responsable — when the fun stops, stop.
        </div>
      </div>
    </section>
  )
}

function CtaStrip() {
  return (
    <section className="cta-strip shell">
      <h2>
        Hulaan <em>na.</em>
      </h2>
      <p>
        Reserve a handle in 60 seconds. Founding members get zero fees for life and first dibs on Day-1 markets.
      </p>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <EmailForm variant="cta" />
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="foot">
      <div className="shell">
        <div className="foot-grid">
          <div className="foot-col foot-logo">
            <LogoMono />
            <div className="foot-tag">
              The market for what happens next, made in the Philippines.
            </div>
          </div>
          <div className="foot-col">
            <h5>Markets</h5>
            <ul>
              <li><a href="#markets">Sports</a></li>
              <li><a href="#markets">Showbiz</a></li>
              <li><a href="#markets">Crypto</a></li>
              <li><a href="#markets">Weather</a></li>
              <li><a href="#markets">World</a></li>
            </ul>
          </div>
          <div className="foot-col">
            <h5>Hula</h5>
            <ul>
              <li><a href="#how">How it works</a></li>
              <li><a href="#waitlist">Reserve handle</a></li>
              <li><a href="#">Press</a></li>
            </ul>
          </div>
          <div className="foot-col">
            <h5>Legal</h5>
            <ul>
              <li><a href="#">Terms</a></li>
              <li><a href="#">Privacy</a></li>
              <li><a href="#">PAGCOR pathway</a></li>
              <li><a href="#">Responsible gaming</a></li>
              <li><a href="#">21+ policy</a></li>
            </ul>
          </div>
        </div>
        <div className="foot-bottom">
          <span>© 2026 Hula Pilipinas, Inc. · Manila, PH</span>
          <span>v2.0 · pre-launch</span>
        </div>
      </div>
    </footer>
  )
}

// Slugs to fetch live = the union of every tagged row across all surfaces.
const LIVE_SLUGS = Array.from(
  new Set([
    ...TICKER_DATA.map((t) => t.slug),
    ...Object.values(MARKETS).flat().map((m) => m.slug),
    'wc-argentina', // FeaturedCard
  ].filter(Boolean) as string[]),
)

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [prices, setPrices] = useState<PricesMap>({})

  // Pull live Polymarket odds once on mount. Best-effort: on any failure the
  // surfaces keep their hardcoded fallbacks — no flash, no error state.
  useEffect(() => {
    if (LIVE_SLUGS.length === 0) return
    let cancelled = false
    fetch(`/api/prices?events=${LIVE_SLUGS.join(',')}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: PricesMap) => { if (!cancelled) setPrices(data) })
      .catch(() => { /* keep fallbacks */ })
    return () => { cancelled = true }
  }, [])

  return (
    <main className="hula-v2">
      <Ticker prices={prices} />
      <Nav onBurger={() => setMenuOpen(true)} />
      <Hero prices={prices} />
      <Markets prices={prices} />
      <HowItWorks />
      <Pullquote />
      <Stats />
      <CtaStrip />
      <Footer />
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </main>
  )
}

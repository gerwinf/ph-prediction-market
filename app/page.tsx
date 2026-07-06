'use client'

import { useState, useEffect, FormEvent } from 'react'
import Link from 'next/link'
import {
  CATEGORIES,
  MARKETS as SEED_MARKETS,
  TICKER_DATA,
  type CategoryKey,
  type MarketRow,
} from '../lib/catalog/seed-data'
import type { CatalogBinaryMarket } from '../lib/catalog/types'
import { liveVol } from '../lib/worldcup/odds'

// Live Polymarket odds (see lib/oracle/slugs.ts LIVE_MARKETS) are overlaid onto
// any row carrying a `slug`; untagged (PH-local) rows stay hardcoded. The `pct`
// here is the fallback shown until the fetch resolves (or if it's stale).
type PriceInfo = { outcomes: { name: string; price: number }[]; is_stale: boolean; fetched_at: string; volume_usd?: number | null }
type PricesMap = Record<string, PriceInfo>

// Returns the live "Yes" probability % for a slug when fresh, else the fallback.
function livePct(prices: PricesMap, slug: string | undefined, fallback: number): number {
  if (!slug) return fallback
  const row = prices[slug]
  if (!row || row.is_stale) return fallback
  const yes = Array.isArray(row.outcomes) ? row.outcomes[0]?.price : undefined
  return typeof yes === 'number' ? Math.round(yes * 100) : fallback
}

// Map a catalog binary market into the landing-grid MarketRow shape. The
// hardcoded SEED_MARKETS render first (no flash); any tab the catalog returns
// non-empty replaces that tab's slice on mount (see Home).
function toMarketRow(m: CatalogBinaryMarket): MarketRow {
  const p = m.payload
  return {
    cat: p.cat ?? m.category ?? '',
    q: m.title,
    pct: typeof p.fallback_pct === 'number' ? p.fallback_pct : 0,
    d: typeof p.delta === 'number' ? p.delta : 0,
    vol: p.vol_label ?? '',
    slug: p.polymarket_slug,
  }
}

// Union of every tagged slug across the ticker + current market grid (+ the
// FeaturedCard). Recomputed when the catalog merge changes the grid.
function liveSlugs(markets: Record<CategoryKey, MarketRow[]>): string[] {
  return Array.from(
    new Set(
      [
        ...TICKER_DATA.map((t) => t.slug),
        ...Object.values(markets).flat().map((m) => m.slug),
        'wc-argentina', // FeaturedCard
      ].filter(Boolean) as string[],
    ),
  )
}

// Marquee spotlight for the current "big event." This is the one knob to turn
// when the next major event takes over the highlight slot (Olympics, national
// elections, an NBA Finals run…): point `href` at its hub and rewrite the copy.
// Set to `null` to drop the spotlight section, nav pill, and hero link entirely.
type FeaturedEventConfig = {
  tag: string        // mono kicker, e.g. "Featured event · Live now"
  title: string      // wordmark lead, e.g. "World Cup"
  titleEm: string    // accented tail, e.g. "2026"
  blurb: string
  href: string       // route to the event hub
  cta: string        // button label
  meta: string       // small mono note under the CTA
}

const FEATURED_EVENT: FeaturedEventConfig | null = {
  tag: 'Featured event · Live now',
  title: 'World Cup',
  titleEm: '2026',
  blurb:
    'Every match and every contender, priced live and settled in pesos — from the group stage to the final.',
  href: '/worldcup',
  cta: 'Enter the hub →',
  meta: 'Live odds · 48 nations',
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
          {FEATURED_EVENT && (
            <Link className="nav-event" href={FEATURED_EVENT.href}>
              {FEATURED_EVENT.title} {FEATURED_EVENT.titleEm}
            </Link>
          )}
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
        {FEATURED_EVENT && (
          <Link className="mobile-menu-event" href={FEATURED_EVENT.href} onClick={onClose}>
            {FEATURED_EVENT.title} {FEATURED_EVENT.titleEm} →
          </Link>
        )}
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
        <span className="featured-vol">VOL {liveVol(prices, 'wc-argentina', '₱4.21M')}</span>
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

// Reusable highlight band for the current marquee event (see FEATURED_EVENT).
// Renders nothing when no event is configured. Sits between the hero and the
// live-market grid so the biggest story of the moment gets top billing.
function FeaturedEvent() {
  const e = FEATURED_EVENT
  if (!e) return null
  return (
    <section className="section shell event-section">
      <Link href={e.href} className="event-spotlight">
        <div className="event-spotlight-l">
          <span className="event-tag"><span className="event-dot" />{e.tag}</span>
          <h2 className="event-title">{e.title} <em>{e.titleEm}</em></h2>
          <p className="event-blurb">{e.blurb}</p>
        </div>
        <div className="event-spotlight-r">
          <span className="event-cta">{e.cta}</span>
          <span className="event-meta">{e.meta}</span>
        </div>
      </Link>
    </section>
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
          {FEATURED_EVENT ? (
            <Link href={FEATURED_EVENT.href} className="eyebrow eyebrow-link">
              <span className="dot" />
              {FEATURED_EVENT.title} {FEATURED_EVENT.titleEm} is live →
            </Link>
          ) : (
            <div className="eyebrow">
              <span className="dot" />
              Reserve a handle
            </div>
          )}
          <h1 className="h1">
            The market for <em>what happens next.</em>
          </h1>
          <p className="lede">
            Hula is the first Filipino prediction market — trade the outcome of basketball, boxing, billboards, and the biggest stories of the day. Real odds, settled in pesos. Pre-launch — reserve your handle for Day 1.
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
        <span className="card-vol">VOL {liveVol(prices, m.slug, m.vol)}</span>
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

function Markets({ prices, markets }: { prices: PricesMap; markets: Record<CategoryKey, MarketRow[]> }) {
  const [active, setActive] = useState<CategoryKey>('trending')
  const cards = markets[active]
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

// Single source of truth for the visible FAQ *and* the FAQPage JSON-LD below.
// Answers are written as self-contained, quotable sentences — the format answer
// engines (ChatGPT, Perplexity, Google AI Overviews) lift and cite. Regulatory
// wording mirrors the compliance copy in <Stats/> (pre-launch, PAGCOR oversight)
// — REVIEW the legality answer before any change to real-money/licensing status.
const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: 'What is Hula?',
    a: 'Hula is the first Filipino prediction market — a platform where you trade real odds on the outcome of Philippine sports, showbiz, weather, and world events, with prices settled in pesos.',
  },
  {
    q: 'What is a prediction market?',
    a: 'A prediction market lets people buy and sell shares in the outcome of a future event. Each share costs from ₱1 to ₱99, and the price reflects the market’s estimated probability of that outcome. A correct prediction pays out ₱100 per share.',
  },
  {
    q: 'What can I trade on Hula?',
    a: 'Hula offers markets on the PBA, international boxing, the MMFF, weather, cryptocurrency, and the FIFA World Cup — each framed as a yes-or-no question with live, real-time odds.',
  },
  {
    q: 'How is Hula different from sports betting?',
    a: 'Unlike a fixed-odds sportsbook, Hula is a market: prices move with supply and demand, you trade against other users rather than the house, and you can buy or sell your position anytime before an event settles.',
  },
  {
    q: 'Is Hula legal and regulated in the Philippines?',
    a: 'Hula is pre-launch and will operate under PAGCOR oversight. Markets will be open only to Philippine residents aged 21 and above; government employees, AFP/PNP personnel, and persons in the NDRP will not be eligible.',
  },
  {
    q: 'How do I get paid out?',
    a: 'Each winning share pays ₱100. You can sell a position anytime before settlement, with payouts cashed out to GCash, Maya, or your bank.',
  },
]

function Faq() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  }
  return (
    <section id="faq" className="section shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="section-head">
        <div>
          <div className="section-kicker">Mga tanong</div>
          <h2 className="section-title">Frequently asked.</h2>
        </div>
      </div>
      <div className="faq">
        {FAQ_ITEMS.map((item) => (
          <details key={item.q} className="faq-item">
            <summary className="faq-q">{item.q}</summary>
            <p className="faq-a">{item.a}</p>
          </details>
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

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [prices, setPrices] = useState<PricesMap>({})
  const [markets, setMarkets] = useState<Record<CategoryKey, MarketRow[]>>(SEED_MARKETS)

  // Merge approved catalog markets over the hardcoded grid. Best-effort: any
  // failure or empty tab keeps the SEED_MARKETS fallback for that tab — the
  // hardcoded grid renders first so there's no flash.
  useEffect(() => {
    let cancelled = false
    fetch('/api/catalog/markets')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.ok) return
        const byCategory = (data.byCategory ?? {}) as Record<string, CatalogBinaryMarket[]>
        setMarkets((prev) => {
          const next = { ...prev }
          for (const c of CATEGORIES) {
            const rows = byCategory[c.key]
            if (rows && rows.length > 0) next[c.key] = rows.map(toMarketRow)
          }
          return next
        })
      })
      .catch(() => { /* keep hardcoded grid */ })
    return () => { cancelled = true }
  }, [])

  // Pull live Polymarket odds for the merged grid. Best-effort: on any failure
  // the surfaces keep their fallbacks. Re-runs when the catalog merge changes
  // which slugs are present.
  useEffect(() => {
    const slugs = liveSlugs(markets)
    if (slugs.length === 0) return
    let cancelled = false
    fetch(`/api/prices?events=${slugs.join(',')}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: PricesMap) => { if (!cancelled) setPrices(data) })
      .catch(() => { /* keep fallbacks */ })
    return () => { cancelled = true }
  }, [markets])

  return (
    <main className="hula-v2">
      <Ticker prices={prices} />
      <Nav onBurger={() => setMenuOpen(true)} />
      <Hero prices={prices} />
      <FeaturedEvent />
      <Markets prices={prices} markets={markets} />
      <HowItWorks />
      <Pullquote />
      <Stats />
      <Faq />
      <CtaStrip />
      <Footer />
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </main>
  )
}

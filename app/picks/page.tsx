'use client'

import { useState, FormEvent } from 'react'

/* ────────────────────────────────────────────────────────────────────────
 * /picks — predictive-skill-contest prototype
 *
 * Soft-launch dress rehearsal for the Hula Phase 0 product. Mock data,
 * hardcoded multipliers (PrizePicks-shape), no real settlement. Captures
 * willingness-to-pay signal via /api/waitlist?source=picks.
 * Not linked from / — share URL manually for validation tests only.
 * ──────────────────────────────────────────────────────────────────────── */

type Sport = 'wc' | 'pba' | 'nba' | 'mlbb'

type Prop = {
  id: string
  sport: Sport
  game: string
  when: string
  player: string
  stat: string
  line: number
  unit: string
}

const SPORT_LABEL: Record<Sport, string> = {
  wc:   'World Cup 2026',
  pba:  'PBA · Governors’ Cup',
  nba:  'NBA Finals',
  mlbb: 'MLBB · MPL-PH S18',
}

const PROPS: Prop[] = [
  // ─── World Cup — Argentina vs Mexico, June 11 group stage opener
  { id: 'wc-messi-goals', sport: 'wc',
    game: 'Argentina vs Mexico · Group C', when: 'Jun 11 · 8:00 PM PHT',
    player: 'Lionel Messi', stat: 'Goals', line: 0.5, unit: 'goals' },
  { id: 'wc-total-goals', sport: 'wc',
    game: 'Argentina vs Mexico · Group C', when: 'Jun 11 · 8:00 PM PHT',
    player: 'Match total goals', stat: 'Total', line: 2.5, unit: 'goals' },
  { id: 'wc-lautaro-sot', sport: 'wc',
    game: 'Argentina vs Mexico · Group C', when: 'Jun 11 · 8:00 PM PHT',
    player: 'Lautaro Martínez', stat: 'Shots on target', line: 2.5, unit: 'SoT' },

  // ─── PBA Governors' Cup — Ginebra vs TNT
  { id: 'pba-teng-pts', sport: 'pba',
    game: 'Ginebra vs TNT', when: 'Tonight · 7:00 PM PHT',
    player: 'Jeron Teng', stat: 'Points', line: 18.5, unit: 'pts' },
  { id: 'pba-thompson-ast', sport: 'pba',
    game: 'Ginebra vs TNT', when: 'Tonight · 7:00 PM PHT',
    player: 'Scottie Thompson', stat: 'Assists', line: 6.5, unit: 'ast' },
  { id: 'pba-fajardo-reb', sport: 'pba',
    game: 'San Miguel vs Magnolia', when: 'Tonight · 9:30 PM PHT',
    player: 'June Mar Fajardo', stat: 'Rebounds', line: 12.5, unit: 'reb' },

  // ─── NBA Finals — Celtics in finals (per existing memo assumption)
  { id: 'nba-tatum-pts', sport: 'nba',
    game: 'Celtics vs Thunder · Game 5', when: 'Jun 15 · 8:30 AM PHT',
    player: 'Jayson Tatum', stat: 'Points', line: 28.5, unit: 'pts' },
  { id: 'nba-sga-pts', sport: 'nba',
    game: 'Celtics vs Thunder · Game 5', when: 'Jun 15 · 8:30 AM PHT',
    player: 'Shai Gilgeous-Alexander', stat: 'Points', line: 30.5, unit: 'pts' },

  // ─── MLBB MPL-PH
  { id: 'mlbb-echo-maps', sport: 'mlbb',
    game: 'ECHO vs Blacklist Intl', when: 'Tonight · 6:00 PM PHT',
    player: 'ECHO', stat: 'Maps won', line: 2.5, unit: 'maps' },
  { id: 'mlbb-kills', sport: 'mlbb',
    game: 'ECHO vs Blacklist Intl', when: 'Tonight · 6:00 PM PHT',
    player: 'Match total kills', stat: 'Total', line: 28.5, unit: 'kills' },
]

const MULTIPLIERS: Record<number, number> = {
  2: 3,
  3: 5,
  4: 10,
  5: 17,
  6: 25,
}

const ENTRY_SIZES = [100, 500, 1000, 5000] as const

type Pick = 'OVER' | 'UNDER'

function LogoLockup() {
  return (
    <span className="logo-lockup">
      <span className="logo-mono">H</span>
      <span className="logo-wordmark">Hula<span className="dot">.</span></span>
    </span>
  )
}

function SportSection({ sport, props, picks, onToggle }: {
  sport: Sport
  props: Prop[]
  picks: Record<string, Pick>
  onToggle: (id: string, pick: Pick) => void
}) {
  return (
    <section className="picks-sport">
      <div className="picks-sport-head">
        <span className="picks-sport-label">{SPORT_LABEL[sport]}</span>
        <span className="picks-sport-count">{props.length} props</span>
      </div>
      <div className="picks-list">
        {props.map((p) => {
          const selected = picks[p.id]
          return (
            <div key={p.id} className={'picks-card' + (selected ? ' is-selected' : '')}>
              <div className="picks-card-meta">
                <span className="picks-card-game">{p.game}</span>
                <span className="picks-card-when">{p.when}</span>
              </div>
              <div className="picks-card-player">{p.player}</div>
              <div className="picks-card-stat">
                {p.stat} · <span className="picks-card-line">{p.line} {p.unit}</span>
              </div>
              <div className="picks-card-actions">
                <button
                  type="button"
                  className={'picks-btn' + (selected === 'OVER' ? ' picks-btn-over-active' : '')}
                  onClick={() => onToggle(p.id, 'OVER')}
                >
                  <span className="picks-btn-arrow">▲</span> OVER
                </button>
                <button
                  type="button"
                  className={'picks-btn' + (selected === 'UNDER' ? ' picks-btn-under-active' : '')}
                  onClick={() => onToggle(p.id, 'UNDER')}
                >
                  <span className="picks-btn-arrow">▼</span> UNDER
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function CardBar({
  picks, entry, onEntryChange, onLockIn, locked,
}: {
  picks: Record<string, Pick>
  entry: number
  onEntryChange: (n: number) => void
  onLockIn: () => void
  locked: boolean
}) {
  const count = Object.keys(picks).length
  const mult = MULTIPLIERS[count] ?? 0
  const payout = mult * entry
  const canLock = count >= 2 && count <= 6 && !locked

  let status = ''
  if (count === 0) status = 'Tap a prop to start building'
  else if (count === 1) status = 'Add 1 more prop (min 2 picks)'
  else if (count > 6) status = 'Maximum 6 picks per card'

  return (
    <div className={'picks-bar' + (count > 0 ? ' has-picks' : '')} aria-live="polite">
      <div className="shell picks-bar-shell">
        {!canLock && status && (
          <div className="picks-bar-status">{status}</div>
        )}
        {canLock && (
          <>
            <div className="picks-bar-summary">
              <div className="picks-bar-row">
                <span className="picks-bar-lbl">{count} picks</span>
                <span className="picks-bar-mult">× {mult}</span>
              </div>
              <div className="picks-bar-payout">
                <span className="picks-bar-entry">₱{entry.toLocaleString('en-PH')}</span>
                <span className="picks-bar-arrow">→</span>
                <span className="picks-bar-win">₱{payout.toLocaleString('en-PH')}</span>
              </div>
            </div>
            <div className="picks-bar-entries">
              {ENTRY_SIZES.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={'picks-entry-chip' + (entry === n ? ' is-active' : '')}
                  onClick={() => onEntryChange(n)}
                >
                  ₱{n >= 1000 ? `${n / 1000}K` : n}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-accent btn-lg picks-lock-btn"
              onClick={onLockIn}
            >
              Lock in →
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function LockInForm({
  picks, entry, onClose,
}: {
  picks: Record<string, Pick>
  entry: number
  onClose: () => void
}) {
  const [email, setEmail] = useState('')
  const [willPay, setWillPay] = useState<'yes' | 'no' | null>(null)
  const [why, setWhy] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !willPay) return
    setStatus('loading')

    const pickPayload = Object.entries(picks).map(([id, side]) => {
      const p = PROPS.find((pp) => pp.id === id)!
      return { id, player: p.player, stat: p.stat, line: p.line, side }
    })

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          source: 'picks',
          picks: pickPayload,
          entry,
          willPay,
          why: why.trim() || undefined,
        }),
      })
      setStatus(res.ok ? 'success' : 'error')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="picks-lockin">
        <div className="picks-lockin-success">
          <div className="picks-lockin-success-h1">Salamat. We hear you.</div>
          <div className="picks-lockin-success-sub">
            Your input shapes what we ship at World Cup 2026. We&apos;ll reach out before launch.
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Back to picks</button>
        </div>
      </div>
    )
  }

  return (
    <div className="picks-lockin">
      <form className="picks-lockin-form" onSubmit={handleSubmit}>
        <div className="picks-lockin-head">
          <div className="picks-lockin-title">Lock in your card</div>
          <button type="button" className="picks-lockin-close" onClick={onClose} aria-label="Cancel">×</button>
        </div>
        <p className="picks-lockin-note">
          Hula is in pre-launch. No real money moves today &mdash; we&apos;re testing whether this is something you&apos;d actually pay to play. Honest answers help us ship the right product.
        </p>

        <label className="picks-lockin-label">Your email</label>
        <input
          type="email"
          className="picks-lockin-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.ph"
          disabled={status === 'loading'}
          required
        />

        <label className="picks-lockin-label">Would you actually pay ₱{entry.toLocaleString('en-PH')} for this card?</label>
        <div className="picks-lockin-yn">
          <button
            type="button"
            className={'picks-yn-btn' + (willPay === 'yes' ? ' is-yes' : '')}
            onClick={() => setWillPay('yes')}
          >Yes, I&apos;d play this</button>
          <button
            type="button"
            className={'picks-yn-btn' + (willPay === 'no' ? ' is-no' : '')}
            onClick={() => setWillPay('no')}
          >No, not at this price</button>
        </div>

        <label className="picks-lockin-label">Why? <span className="picks-lockin-opt">(optional, one sentence)</span></label>
        <textarea
          className="picks-lockin-textarea"
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          placeholder="e.g. multiplier too low for the risk · entry size right · would prefer NBA props · etc."
          rows={2}
          disabled={status === 'loading'}
        />

        <button
          type="submit"
          className="btn btn-accent btn-lg picks-lockin-submit"
          disabled={status === 'loading' || !email.trim() || !willPay}
        >
          {status === 'loading' ? 'Sending…' : 'Send my feedback →'}
        </button>
        {status === 'error' && (
          <div className="picks-lockin-err">Something broke. Try again.</div>
        )}
      </form>
    </div>
  )
}

export default function PicksPage() {
  const [picks, setPicks] = useState<Record<string, Pick>>({})
  const [entry, setEntry] = useState<number>(500)
  const [showLockIn, setShowLockIn] = useState(false)

  const togglePick = (id: string, side: Pick) => {
    setPicks((cur) => {
      const next = { ...cur }
      if (next[id] === side) delete next[id]
      else next[id] = side
      return next
    })
  }

  const sports: Sport[] = ['wc', 'pba', 'nba', 'mlbb']

  return (
    <main className="hula-v2 picks-page">
      {/* Top nav — simplified, no burger / no nav links. */}
      <div className="picks-topnav">
        <div className="shell picks-topnav-inner">
          <LogoLockup />
          <span className="picks-demo-badge">Demo · pre-launch</span>
        </div>
      </div>

      {/* Hero */}
      <section className="shell picks-hero">
        <div className="eyebrow">
          <span className="dot" />
          World Cup 2026 soft launch · Jun 11
        </div>
        <h1 className="h1 picks-h1">Build your card. <em>Win up to 25×.</em></h1>
        <p className="lede">
          Pick OVER or UNDER on 2 to 6 player props. Stack picks for a bigger multiplier. PAGCOR predictive-skill contest, peso-native, settled to GCash within the hour.
        </p>
        <div className="picks-multikey">
          <span><strong>2</strong>×3</span>
          <span><strong>3</strong>×5</span>
          <span><strong>4</strong>×10</span>
          <span><strong>5</strong>×17</span>
          <span><strong>6</strong>×25</span>
        </div>
      </section>

      {/* Prop sections by sport */}
      <div className="shell picks-body">
        {sports.map((s) => (
          <SportSection
            key={s}
            sport={s}
            props={PROPS.filter((p) => p.sport === s)}
            picks={picks}
            onToggle={togglePick}
          />
        ))}

        {/* Bottom spacer so the sticky bar doesn't cover the last card */}
        <div style={{ height: 200 }} />
      </div>

      {/* Sticky card-builder bar */}
      <CardBar
        picks={picks}
        entry={entry}
        onEntryChange={setEntry}
        onLockIn={() => setShowLockIn(true)}
        locked={showLockIn}
      />

      {/* Lock-in overlay */}
      {showLockIn && (
        <LockInForm
          picks={picks}
          entry={entry}
          onClose={() => setShowLockIn(false)}
        />
      )}
    </main>
  )
}

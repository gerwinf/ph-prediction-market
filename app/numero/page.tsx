'use client'

import { useState, useEffect, useMemo, FormEvent } from 'react'

/* ────────────────────────────────────────────────────────────────────────
 * /numero — NumeroHula (sub-brand of Hula)
 *
 * Pick-3 parimutuel digit game. 4 bet types over a single draw.
 * Resolution = SHA256(nist_pulse || draw_id) mod 1000 (mocked for prototype).
 * 15-min prime / 30-min off-peak cadence. ₱20 stake floor. 18% rake.
 * Not linked from /. Share URL manually for validation tests only.
 * ──────────────────────────────────────────────────────────────────────── */

const RAKE = 0.18
const STAKE_PER_PICK = 20

type BetType = 'last1' | 'last2' | 'last3s' | 'last3b'

type BetTypeMeta = {
  key: BetType
  label: string
  short: string
  gridSize: number
  payoutX: number
  mockPoolPHP: number
  blurb: string
}

const BET_TYPES: BetTypeMeta[] = [
  { key: 'last1',  label: 'Last Digit',      short: 'Last 1', gridSize: 10,   payoutX: 9,   mockPoolPHP: 8440,  blurb: 'On-ramp · 1 in 10 chance' },
  { key: 'last2',  label: 'Last 2',          short: 'Last 2', gridSize: 100,  payoutX: 85,  mockPoolPHP: 24120, blurb: 'Classic · 1 in 100 chance' },
  { key: 'last3s', label: 'Last 3 Straight', short: 'Last 3', gridSize: 1000, payoutX: 800, mockPoolPHP: 16800, blurb: 'Moonshot · 1 in 1,000 chance · ₱20 → ₱16,000' },
  { key: 'last3b', label: 'Last 3 Box',      short: 'Box 3',  gridSize: 220,  payoutX: 140, mockPoolPHP: 5980,  blurb: 'Cover · any 3 distinct digits · 1 in 167 chance' },
]

type Pick = { id: string; betType: BetType; outcome: string }

// Mock NIST pulse + recent winners
const SAMPLE_NIST_PULSE = '8a3f7e29b4d1c0a6f5e2b8d4a7c1f3e6b9d2a5c8f1e4b7d0a3c6f9e2b5d8a1c4'
const NEXT_DRAW = { drawId: '2026-05-13-1815-0001', nextPulse: 4892412, scheduledIn: 8 * 60 + 14 /* 8:14 */ }

const RECENT_WINNERS = [
  { num: '247', when: '7:30 PM', pulse: 4892401, payout: '₱2,180/winner', kind: 'paid' as const },
  { num: '918', when: '7:15 PM', pulse: 4892386, payout: 'jackpot rolled →',  kind: 'rolled' as const },
  { num: '042', when: '7:00 PM', pulse: 4892371, payout: '₱3,450/winner', kind: 'paid' as const },
  { num: '631', when: '6:45 PM', pulse: 4892356, payout: '₱870/winner',   kind: 'paid' as const },
  { num: '189', when: '6:30 PM', pulse: 4892341, payout: 'jackpot rolled →',  kind: 'rolled' as const },
]

/* Mock pool-share % per outcome (for last1 and last2 cells).
   Sums to 100 in each bet type. Deterministic so re-renders stay stable. */
function mockPoolShare(betType: BetType, outcome: string): number {
  // Stable hash from outcome string → pseudo-random 1-12% range
  let h = 0
  for (let i = 0; i < outcome.length; i++) h = (h * 31 + outcome.charCodeAt(i)) & 0xffff
  const base = (h % 100) / 100
  if (betType === 'last1') return Math.round((7 + base * 8) * 10) / 10 // 7-15% range across 10 cells
  if (betType === 'last2') return Math.round((0.4 + base * 1.6) * 10) / 10 // 0.4-2.0% range across 100 cells
  return 0
}

const fmtPHP = (n: number) => '₱' + n.toLocaleString('en-PH')

/* ─── Logo lockup — visual lineage to parent Hula ───────────────────── */

function LogoLockup() {
  return (
    <span className="logo-lockup numerohula-lockup">
      <span className="logo-mono">H</span>
      <span className="numerohula-wordmark">
        <span className="numerohula-word">NumeroHula<span className="dot">.</span></span>
        <span className="numerohula-tag">by Hula</span>
      </span>
    </span>
  )
}

/* ─── Draw countdown + recent winners ───────────────────────────────── */

function DrawCountdown({ secondsLeft }: { secondsLeft: number }) {
  const m = Math.floor(secondsLeft / 60)
  const s = secondsLeft % 60
  const mm = m.toString().padStart(2, '0')
  const ss = s.toString().padStart(2, '0')

  return (
    <div className="numero-countdown shell">
      <div className="numero-countdown-row">
        <div className="numero-countdown-block">
          <span className="numero-countdown-lbl">Next draw in</span>
          <span className="numero-countdown-val">{mm}:{ss}</span>
        </div>
        <div className="numero-countdown-meta">
          <span className="numero-pulse-hint">Settles by NIST pulse #{NEXT_DRAW.nextPulse.toLocaleString('en-US')}</span>
          <span className="numero-drawid">Draw ID · {NEXT_DRAW.drawId}</span>
        </div>
      </div>
      <div className="numero-recent">
        <span className="numero-recent-lbl">Recent draws</span>
        <div className="numero-recent-list">
          {RECENT_WINNERS.map((w) => (
            <span key={w.pulse} className={'numero-recent-pill numero-recent-' + w.kind}>
              <span className="numero-recent-num">{w.num}</span>
              <span className="numero-recent-meta">{w.when} · pulse #{w.pulse.toLocaleString('en-US')} · {w.payout}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── "How is the number drawn?" disclosure ─────────────────────────── */

function HowItDraws() {
  const [open, setOpen] = useState(false)
  return (
    <div className="numero-how shell">
      <div className="numero-trust-tagline">
        <div className="numero-trust-title">Powered by NIST Beacon randomness</div>
        <div className="numero-trust-sub">Public at verifiable ang bawat draw.</div>
      </div>
      <button type="button" className="numero-how-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? '▾' : '▸'} How is the winning number drawn?
      </button>
      {open && (
        <div className="numero-how-body">
          <p className="numero-how-lede">
            US federal randomness standard (NIST). Every 60 seconds, NIST publishes a fresh signed random value at <code>beacon.nist.gov</code>. Hula commits to a future pulse number <em>before</em> the pulse exists, then computes the winning number deterministically. Anyone can verify any past draw.
          </p>
          <pre className="numero-how-eq">
            <span className="numero-how-eq-lhs">winning_number</span>
            <span className="numero-how-eq-op">=</span>
            <span className="numero-how-eq-rhs">SHA256(nist_pulse ‖ draw_id) mod 1000</span>
          </pre>
          <div className="numero-how-sample">
            <div className="numero-how-row"><span className="numero-how-row-lbl">draw_id</span><code>{NEXT_DRAW.drawId}</code></div>
            <div className="numero-how-row"><span className="numero-how-row-lbl">pulse #</span><code>{NEXT_DRAW.nextPulse.toLocaleString('en-US')}</code></div>
            <div className="numero-how-row"><span className="numero-how-row-lbl">pulse value</span><code className="numero-how-hex">{SAMPLE_NIST_PULSE.slice(0, 32)}…</code></div>
            <div className="numero-how-row"><span className="numero-how-row-lbl">winning number</span><code className="numero-how-winner">— (revealed at draw time)</code></div>
          </div>
          <a href="https://beacon.nist.gov" target="_blank" rel="noopener noreferrer" className="numero-how-link">
            Open beacon.nist.gov →
          </a>
        </div>
      )}
    </div>
  )
}

/* ─── Bet type tabs ─────────────────────────────────────────────────── */

function BetTypeTabs({ active, onChange }: { active: BetType; onChange: (b: BetType) => void }) {
  return (
    <div className="numero-tabs" role="tablist">
      {BET_TYPES.map((bt) => (
        <button
          key={bt.key}
          type="button"
          role="tab"
          aria-selected={active === bt.key}
          className={'numero-tab' + (active === bt.key ? ' is-active' : '')}
          onClick={() => onChange(bt.key)}
        >
          <span className="numero-tab-name">{bt.short}</span>
          <span className="numero-tab-x">~{bt.payoutX}×</span>
        </button>
      ))}
    </div>
  )
}

/* ─── Number grids per bet type ─────────────────────────────────────── */

function GridLast1({ picks, toggle }: { picks: Pick[]; toggle: (outcome: string) => void }) {
  const selected = new Set(picks.filter((p) => p.betType === 'last1').map((p) => p.outcome))
  return (
    <div className="numero-grid numero-grid-10">
      {Array.from({ length: 10 }, (_, i) => String(i)).map((n) => {
        const share = mockPoolShare('last1', n)
        return (
          <button
            key={n}
            type="button"
            className={'numero-cell' + (selected.has(n) ? ' is-active' : '')}
            onClick={() => toggle(n)}
          >
            <span className="numero-cell-n">{n}</span>
            <span className="numero-cell-share">{share}%</span>
          </button>
        )
      })}
    </div>
  )
}

function GridLast2({ picks, toggle }: { picks: Pick[]; toggle: (outcome: string) => void }) {
  const selected = new Set(picks.filter((p) => p.betType === 'last2').map((p) => p.outcome))
  return (
    <div className="numero-grid numero-grid-100">
      {Array.from({ length: 100 }, (_, i) => i.toString().padStart(2, '0')).map((n) => (
        <button
          key={n}
          type="button"
          className={'numero-cell numero-cell-sm' + (selected.has(n) ? ' is-active' : '')}
          onClick={() => toggle(n)}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

function GridLast3s({ picks, addPick, removePick }: {
  picks: Pick[]
  addPick: (outcome: string) => void
  removePick: (outcome: string) => void
}) {
  const [val, setVal] = useState('')
  const myPicks = picks.filter((p) => p.betType === 'last3s')

  const handleAdd = () => {
    const padded = val.padStart(3, '0')
    if (!/^\d{3}$/.test(padded)) return
    if (myPicks.some((p) => p.outcome === padded)) {
      setVal('')
      return
    }
    addPick(padded)
    setVal('')
  }
  const handleQuickPick = () => {
    let n = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    let attempts = 0
    while (myPicks.some((p) => p.outcome === n) && attempts < 50) {
      n = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
      attempts++
    }
    addPick(n)
  }

  return (
    <div className="numero-input-block">
      <div className="numero-input-row">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={3}
          value={val}
          onChange={(e) => setVal(e.target.value.replace(/\D/g, '').slice(0, 3))}
          placeholder="000"
          className="numero-input-num"
        />
        <button type="button" className="numero-input-add" onClick={handleAdd} disabled={!val.trim()}>Add</button>
        <button type="button" className="numero-input-qp" onClick={handleQuickPick}>Quick Pick</button>
      </div>
      {myPicks.length > 0 && (
        <div className="numero-chips">
          {myPicks.map((p) => (
            <button key={p.id} type="button" className="numero-chip" onClick={() => removePick(p.outcome)}>
              {p.outcome} <span className="numero-chip-x">×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function GridLast3b({ picks, addPick, removePick }: {
  picks: Pick[]
  addPick: (outcome: string) => void
  removePick: (outcome: string) => void
}) {
  // Current pick being built — selection of distinct digits (up to 3)
  const [staging, setStaging] = useState<Set<string>>(new Set())
  const myPicks = picks.filter((p) => p.betType === 'last3b')

  const toggle = (d: string) => {
    setStaging((cur) => {
      const next = new Set(cur)
      if (next.has(d)) next.delete(d)
      else if (next.size < 3) next.add(d)
      return next
    })
  }

  const commit = () => {
    if (staging.size !== 3) return
    const key = Array.from(staging).sort().join('-')
    if (myPicks.some((p) => p.outcome === key)) {
      setStaging(new Set())
      return
    }
    addPick(key)
    setStaging(new Set())
  }

  return (
    <div className="numero-box-block">
      <div className="numero-box-hint">Pick any 3 distinct digits. Covers all 6 permutations (₱20 each pick).</div>
      <div className="numero-grid numero-grid-10">
        {Array.from({ length: 10 }, (_, i) => String(i)).map((d) => (
          <button
            key={d}
            type="button"
            className={'numero-cell' + (staging.has(d) ? ' is-active' : '')}
            onClick={() => toggle(d)}
            disabled={!staging.has(d) && staging.size >= 3}
          >
            <span className="numero-cell-n">{d}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="numero-box-commit"
        onClick={commit}
        disabled={staging.size !== 3}
      >
        {staging.size === 3 ? `Add pick (${Array.from(staging).sort().join('·')})` : `Pick ${3 - staging.size} more digit${3 - staging.size === 1 ? '' : 's'}`}
      </button>
      {myPicks.length > 0 && (
        <div className="numero-chips">
          {myPicks.map((p) => (
            <button key={p.id} type="button" className="numero-chip" onClick={() => removePick(p.outcome)}>
              {p.outcome.split('-').join(' · ')} <span className="numero-chip-x">×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Bet type card (header + grid) ─────────────────────────────────── */

function BetTypeCard({
  bt, picks, addPick, removePick, toggleOutcome,
}: {
  bt: BetTypeMeta
  picks: Pick[]
  addPick: (outcome: string) => void
  removePick: (outcome: string) => void
  toggleOutcome: (outcome: string) => void
}) {
  return (
    <section className="numero-bet-card shell">
      <div className="numero-bet-head">
        <div>
          <div className="numero-bet-title">{bt.label}</div>
          <div className="numero-bet-blurb">{bt.blurb}</div>
        </div>
        <div className="numero-bet-meta">
          <span className="numero-payout-pill">~{bt.payoutX}× payout</span>
          <span className="numero-pool">Pool: {fmtPHP(bt.mockPoolPHP)}</span>
        </div>
      </div>
      <div className="numero-bet-body">
        {bt.key === 'last1'  && <GridLast1  picks={picks} toggle={toggleOutcome} />}
        {bt.key === 'last2'  && <GridLast2  picks={picks} toggle={toggleOutcome} />}
        {bt.key === 'last3s' && <GridLast3s picks={picks} addPick={addPick} removePick={removePick} />}
        {bt.key === 'last3b' && <GridLast3b picks={picks} addPick={addPick} removePick={removePick} />}
      </div>
    </section>
  )
}

/* ─── Sticky card-builder bar ───────────────────────────────────────── */

function CardBar({ picks, onLockIn, locked }: { picks: Pick[]; onLockIn: () => void; locked: boolean }) {
  const n = picks.length
  const stake = n * STAKE_PER_PICK

  // Aggregate per bet type
  const byType = useMemo(() => {
    const acc: Record<BetType, number> = { last1: 0, last2: 0, last3s: 0, last3b: 0 }
    picks.forEach((p) => { acc[p.betType]++ })
    return acc
  }, [picks])

  const projectedMax = BET_TYPES.reduce((acc, bt) => {
    if (byType[bt.key] > 0) return Math.max(acc, bt.payoutX * STAKE_PER_PICK)
    return acc
  }, 0)

  const canLock = n >= 1 && !locked
  const status = n === 0 ? 'Pumili ng numero · Tap a cell to start' : ''

  return (
    <div className={'numero-bar' + (n > 0 ? ' has-picks' : '')} aria-live="polite">
      <div className="shell numero-bar-shell">
        {!canLock && status && <div className="numero-bar-status">{status}</div>}
        {canLock && (
          <>
            <div className="numero-bar-summary">
              <div className="numero-bar-row">
                <span className="numero-bar-lbl">{n} pick{n === 1 ? '' : 's'}</span>
                <span className="numero-bar-stake">{fmtPHP(stake)}</span>
              </div>
              <div className="numero-bar-row">
                <span className="numero-bar-lbl">Max win if you hit</span>
                <span className="numero-bar-win">{fmtPHP(projectedMax)}</span>
              </div>
              <div className="numero-bar-breakdown">
                {BET_TYPES.map((bt) => byType[bt.key] > 0 && (
                  <span key={bt.key} className="numero-bar-chip">
                    {bt.short} ×{byType[bt.key]}
                  </span>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-accent btn-lg numero-lock-btn"
              onClick={onLockIn}
            >
              Lock in card · {fmtPHP(stake)} →
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/* ─── Lock-in modal ─────────────────────────────────────────────────── */

function LockInForm({ picks, onClose }: { picks: Pick[]; onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [willPay, setWillPay] = useState<'yes' | 'no' | null>(null)
  const [prefFreq, setPrefFreq] = useState<'yes' | 'no' | null>(null)
  const [prefBetType, setPrefBetType] = useState<BetType | ''>('')
  const [why, setWhy] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const stake = picks.length * STAKE_PER_PICK

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !willPay || !prefFreq) return
    setStatus('loading')

    const pickPayload = picks.map((p) => ({
      betType: p.betType,
      outcome: p.outcome,
      stake: STAKE_PER_PICK,
    }))

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          source: 'numero',
          picks: pickPayload,
          entry: stake,
          willPay,
          prefFreq,
          prefBetType: prefBetType || undefined,
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
            Your input shapes what we ship at NumeroHula launch. We&apos;ll reach out before the soft launch.
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Back to numbers</button>
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
          NumeroHula is in pre-launch. No real money moves today &mdash; we&apos;re testing whether this is something you&apos;d actually pay to play.
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

        <label className="picks-lockin-label">Would you actually pay {fmtPHP(stake)} for this card?</label>
        <div className="picks-lockin-yn">
          <button type="button" className={'picks-yn-btn' + (willPay === 'yes' ? ' is-yes' : '')} onClick={() => setWillPay('yes')}>Yes, I&apos;d play</button>
          <button type="button" className={'picks-yn-btn' + (willPay === 'no' ? ' is-no' : '')} onClick={() => setWillPay('no')}>No, not at this price</button>
        </div>

        <label className="picks-lockin-label">Would you play multiple times per day?</label>
        <div className="picks-lockin-yn">
          <button type="button" className={'picks-yn-btn' + (prefFreq === 'yes' ? ' is-yes' : '')} onClick={() => setPrefFreq('yes')}>Yes, multi-times</button>
          <button type="button" className={'picks-yn-btn' + (prefFreq === 'no' ? ' is-no' : '')} onClick={() => setPrefFreq('no')}>No, once is enough</button>
        </div>

        <label className="picks-lockin-label">Which bet type would you play most? <span className="picks-lockin-opt">(optional)</span></label>
        <div className="numero-pref-grid">
          {BET_TYPES.map((bt) => (
            <button
              key={bt.key}
              type="button"
              className={'numero-pref-btn' + (prefBetType === bt.key ? ' is-active' : '')}
              onClick={() => setPrefBetType(prefBetType === bt.key ? '' : bt.key)}
            >
              <span className="numero-pref-name">{bt.short}</span>
              <span className="numero-pref-x">~{bt.payoutX}×</span>
            </button>
          ))}
        </div>

        <label className="picks-lockin-label">Why? <span className="picks-lockin-opt">(optional, one sentence)</span></label>
        <textarea
          className="picks-lockin-textarea"
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          placeholder="e.g. ₱20 too low for the suspense · prefer livestreamed · would play if 5 min cadence · etc."
          rows={2}
          disabled={status === 'loading'}
        />

        <button
          type="submit"
          className="btn btn-accent btn-lg picks-lockin-submit"
          disabled={status === 'loading' || !email.trim() || !willPay || !prefFreq}
        >
          {status === 'loading' ? 'Sending…' : 'Send my feedback →'}
        </button>
        {status === 'error' && <div className="picks-lockin-err">Something broke. Try again.</div>}
      </form>
    </div>
  )
}

/* ─── Root page ─────────────────────────────────────────────────────── */

export default function NumeroPage() {
  const [active, setActive] = useState<BetType>('last1')
  const [picks, setPicks] = useState<Pick[]>([])
  const [showLockIn, setShowLockIn] = useState(false)
  const [countdown, setCountdown] = useState(NEXT_DRAW.scheduledIn)

  // Tick the countdown every second (cosmetic only)
  useEffect(() => {
    const id = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : NEXT_DRAW.scheduledIn)), 1000)
    return () => clearInterval(id)
  }, [])

  const toggleOutcome = (outcome: string) => {
    setPicks((cur) => {
      const exists = cur.find((p) => p.betType === active && p.outcome === outcome)
      if (exists) return cur.filter((p) => p !== exists)
      return [...cur, { id: `${active}-${outcome}-${Date.now()}`, betType: active, outcome }]
    })
  }
  const addPick = (outcome: string) => {
    setPicks((cur) => [...cur, { id: `${active}-${outcome}-${Date.now()}`, betType: active, outcome }])
  }
  const removePick = (outcome: string) => {
    setPicks((cur) => cur.filter((p) => !(p.betType === active && p.outcome === outcome)))
  }

  const activeBet = BET_TYPES.find((bt) => bt.key === active)!

  return (
    <main className="hula-v2 picks-page numero-page">
      {/* Top nav — NumeroHula lockup with parent-brand lineage */}
      <div className="picks-topnav">
        <div className="shell picks-topnav-inner">
          <LogoLockup />
          <span className="picks-demo-badge">Demo · pre-launch</span>
        </div>
      </div>

      {/* Hero — simple, clean, understandable in 3 seconds */}
      <section className="shell picks-hero">
        <div className="eyebrow">
          <span className="dot" />
          NUMEROHULA
        </div>
        <h1 className="h1 picks-h1">
          Hula kada game. <em>Sahod kada oras.</em>
        </h1>
        <ul className="numero-promise">
          <li>Every <strong>15 minutes</strong> ang draw.</li>
          <li><strong>₱20 lang</strong> ang taya.</li>
          <li><strong>82% balik</strong> sa players.</li>
          <li><strong>Fair</strong> at <strong>transparent</strong> ang resulta.</li>
        </ul>
      </section>

      <DrawCountdown secondsLeft={countdown} />
      <HowItDraws />

      <BetTypeTabs active={active} onChange={setActive} />
      <BetTypeCard
        bt={activeBet}
        picks={picks}
        addPick={addPick}
        removePick={removePick}
        toggleOutcome={toggleOutcome}
      />

      {/* Bottom spacer so the sticky bar doesn't cover the last cell */}
      <div style={{ height: 220 }} />

      <CardBar picks={picks} onLockIn={() => setShowLockIn(true)} locked={showLockIn} />

      {showLockIn && <LockInForm picks={picks} onClose={() => setShowLockIn(false)} />}
    </main>
  )
}

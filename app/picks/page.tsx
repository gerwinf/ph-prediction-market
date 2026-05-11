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

type Sport = 'wc' | 'pba' | 'nba' | 'mlbb' | 'pool'

type Prop = {
  id: string
  sport: Sport
  kind: 'player' | 'team'
  game: string
  when: string
  player: string
  team?: string
  stat: string
  line: number
  unit: string
  photo?: string
  badge?: string
  badgeBg?: string
  badgeFg?: string
}

const SPORT_LABEL: Record<Sport, string> = {
  wc:   'World Cup 2026',
  pba:  'PBA · Commissioner’s Cup',
  nba:  'NBA · Conf. Semifinals',
  mlbb: 'MLBB · MPL-PH 2026',
  pool: 'Pool · Pro Tour 2026',
}

const PROPS: Prop[] = [
  // ─── World Cup 2026 — REAL fixtures verified vs Wikipedia (draw was Dec 2025)

  // Jun 11 · Tournament opener: Mexico vs South Africa, Group A, Estadio Azteca
  { id: 'wc-lozano-sot', sport: 'wc', kind: 'player',
    game: 'Mexico vs South Africa · Group A · opener', when: 'Jun 11 · 3:00 AM PHT',
    player: 'Hirving Lozano', team: 'MEX', stat: 'Shots on target', line: 1.5, unit: 'SoT',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Hirving_Lozano.png/200px-Hirving_Lozano.png' },
  { id: 'wc-alvarez-tackles', sport: 'wc', kind: 'player',
    game: 'Mexico vs South Africa · Group A · opener', when: 'Jun 11 · 3:00 AM PHT',
    player: 'Edson Álvarez', team: 'MEX', stat: 'Tackles', line: 3.5, unit: 'tackles',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Edson_%C3%81lvarez.png/200px-Edson_%C3%81lvarez.png' },
  { id: 'wc-mex-total-goals', sport: 'wc', kind: 'team',
    game: 'Mexico vs South Africa · Group A · opener', when: 'Jun 11 · 3:00 AM PHT',
    player: 'Match total goals', team: 'MEX · RSA', stat: 'Both teams · Total', line: 2.5, unit: 'goals',
    badge: 'VS', badgeBg: '#0f2419', badgeFg: '#f5f1e3' },

  // Jun 16 (Jun 17 PHT) · Argentina vs Algeria, Group J, Arrowhead Stadium Kansas City
  { id: 'wc-messi-goals', sport: 'wc', kind: 'player',
    game: 'Argentina vs Algeria · Group J', when: 'Jun 17 · 9:00 AM PHT',
    player: 'Lionel Messi', team: 'ARG', stat: 'Goals', line: 0.5, unit: 'goals',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Lionel_Messi_White_House_2026_%283x4_cropped%29.jpg/200px-Lionel_Messi_White_House_2026_%283x4_cropped%29.jpg' },
  { id: 'wc-lautaro-sot', sport: 'wc', kind: 'player',
    game: 'Argentina vs Algeria · Group J', when: 'Jun 17 · 9:00 AM PHT',
    player: 'Lautaro Martínez', team: 'ARG', stat: 'Shots on target', line: 2.5, unit: 'SoT',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Lautaro_Martinez_ARGENTINA_VS_VENEZUELA_2017.jpg/200px-Lautaro_Martinez_ARGENTINA_VS_VENEZUELA_2017.jpg' },
  { id: 'wc-mahrez-goals', sport: 'wc', kind: 'player',
    game: 'Argentina vs Algeria · Group J', when: 'Jun 17 · 9:00 AM PHT',
    player: 'Riyad Mahrez', team: 'ALG', stat: 'Goals', line: 0.5, unit: 'goals',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Mahrez_2021.jpg/200px-Mahrez_2021.jpg' },

  // ─── PBA Commissioner's Cup (2026, ongoing — second conference of PBA Season 50)
  // Ginebra is the defending champ. Brownlee is the long-time Ginebra import.
  { id: 'pba-brownlee-pts', sport: 'pba', kind: 'player',
    game: 'Ginebra vs TNT · Manila Clasico', when: 'Tonight · 7:00 PM PHT',
    player: 'Justin Brownlee', team: 'GIN', stat: 'Points (import)', line: 28.5, unit: 'pts',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Brownlee_w._bottle_SEA_Games_2023_%28cropped%29.png/200px-Brownlee_w._bottle_SEA_Games_2023_%28cropped%29.png' },
  { id: 'pba-thompson-ast', sport: 'pba', kind: 'player',
    game: 'Ginebra vs TNT · Manila Clasico', when: 'Tonight · 7:00 PM PHT',
    player: 'Scottie Thompson', team: 'GIN', stat: 'Assists', line: 6.5, unit: 'ast',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/PBA_-_Scottie_Thompson_-_2021.jpg/200px-PBA_-_Scottie_Thompson_-_2021.jpg' },
  { id: 'pba-pogoy-pts', sport: 'pba', kind: 'player',
    game: 'Ginebra vs TNT · Manila Clasico', when: 'Tonight · 7:00 PM PHT',
    player: 'RR Pogoy', team: 'TNT', stat: 'Points', line: 19.5, unit: 'pts',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/8/87/Bongbong_Marcos_in_Dominican_Republic_v_Philippines_FBWC_2_Pogoy_%28cropped%29.jpg' },
  { id: 'pba-fajardo-reb', sport: 'pba', kind: 'player',
    game: 'San Miguel vs Magnolia', when: 'Tomorrow · 9:30 PM PHT',
    player: 'June Mar Fajardo', team: 'SMB', stat: 'Rebounds', line: 12.5, unit: 'reb',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/June_Mar_Fajardo_2026.jpg/200px-June_Mar_Fajardo_2026.jpg' },
  { id: 'pba-ginebra-pts', sport: 'pba', kind: 'team',
    game: 'Ginebra vs TNT · Manila Clasico', when: 'Tonight · 7:00 PM PHT',
    player: 'Barangay Ginebra', team: 'GIN', stat: 'Team total points', line: 102.5, unit: 'pts',
    badge: 'GIN', badgeBg: '#B22234', badgeFg: '#ffffff' },

  // ─── Pool · Pro Tour 2026 — Biado, Chua, Filler are all real active tour players

  { id: 'pool-biado-racks', sport: 'pool', kind: 'player',
    game: 'Biado vs Filler · race to 9', when: 'Sat · 9:00 PM PHT',
    player: 'Carlo Biado', team: 'PH', stat: 'Racks won', line: 5.5, unit: 'racks',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Carlo_Biado_2018.jpg/200px-Carlo_Biado_2018.jpg' },
  { id: 'pool-filler-racks', sport: 'pool', kind: 'player',
    game: 'Biado vs Filler · race to 9', when: 'Sat · 9:00 PM PHT',
    player: 'Joshua Filler', team: 'DE', stat: 'Racks won', line: 4.5, unit: 'racks',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Joshua_Filler_straight_pool.jpg/200px-Joshua_Filler_straight_pool.jpg' },
  { id: 'pool-chua-racks', sport: 'pool', kind: 'player',
    game: 'Chua vs Shaw · race to 9', when: 'Sat · 6:00 PM PHT',
    player: 'Johann Chua', team: 'PH', stat: 'Racks won', line: 4.5, unit: 'racks',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Maldives_Open_2023_Final_-_Johann_Chua.jpg/200px-Maldives_Open_2023_Final_-_Johann_Chua.jpg' },
  { id: 'pool-total-racks', sport: 'pool', kind: 'team',
    game: 'Biado vs Filler · race to 9', when: 'Sat · 9:00 PM PHT',
    player: 'Match total racks', team: 'PH · DE', stat: 'Both players · Total', line: 13.5, unit: 'racks',
    badge: 'VS', badgeBg: '#0f2419', badgeFg: '#f5f1e3' },

  // ─── NBA — REAL Conference Semifinals (Round 2) in progress May 2026
  // Round 2 East: Pistons-Cavs and Knicks-76ers. West: Thunder-Lakers and Spurs-Wolves.
  // Lakers vs Thunder is the marquee for PH (LeBron / Luka vs SGA).

  { id: 'nba-sga-pts', sport: 'nba', kind: 'player',
    game: 'Thunder vs Lakers · Conf. Semis', when: 'This week · 8:30 AM PHT',
    player: 'Shai Gilgeous-Alexander', team: 'OKC', stat: 'Points', line: 31.5, unit: 'pts',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Shai_Gilgeous-Alexander_-_Thunder_vs._Wizards.png/200px-Shai_Gilgeous-Alexander_-_Thunder_vs._Wizards.png' },
  { id: 'nba-luka-pts', sport: 'nba', kind: 'player',
    game: 'Thunder vs Lakers · Conf. Semis', when: 'This week · 8:30 AM PHT',
    player: 'Luka Dončić', team: 'LAL', stat: 'Points', line: 28.5, unit: 'pts',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Luka_Doncic_%2851914951721%29_%28cropped1%29.jpg/200px-Luka_Doncic_%2851914951721%29_%28cropped1%29.jpg' },
  { id: 'nba-lebron-ast', sport: 'nba', kind: 'player',
    game: 'Thunder vs Lakers · Conf. Semis', when: 'This week · 8:30 AM PHT',
    player: 'LeBron James', team: 'LAL', stat: 'Assists', line: 7.5, unit: 'ast',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/LeBron_James_%2851959977144%29_%28cropped2%29.jpg/200px-LeBron_James_%2851959977144%29_%28cropped2%29.jpg' },

  // ─── MLBB MPL-PH 2026 — ECHO vs Blacklist remains the marquee rivalry

  { id: 'mlbb-echo-maps', sport: 'mlbb', kind: 'team',
    game: 'ECHO vs Blacklist Intl', when: 'Tonight · 6:00 PM PHT',
    player: 'ECHO', team: 'ECHO', stat: 'Maps won', line: 2.5, unit: 'maps',
    badge: 'E', badgeBg: '#1E3A8A', badgeFg: '#ffffff' },
  { id: 'mlbb-kills', sport: 'mlbb', kind: 'team',
    game: 'ECHO vs Blacklist Intl', when: 'Tonight · 6:00 PM PHT',
    player: 'Match total kills', team: 'ECHO · BLI', stat: 'Both teams · Total', line: 28.5, unit: 'kills',
    badge: 'VS', badgeBg: '#0f2419', badgeFg: '#f5f1e3' },
]

const MULTIPLIERS: Record<number, number> = {
  2: 3,
  3: 5,
  4: 10,
  5: 17,
  6: 25,
}

const ENTRY_SIZES = [100, 500, 1000, 5000] as const

type Pick = 'MORE' | 'LESS'

function LogoLockup() {
  return (
    <span className="logo-lockup">
      <span className="logo-mono">H</span>
      <span className="logo-wordmark">Hula<span className="dot">.</span></span>
    </span>
  )
}

function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function PropAvatar({ prop }: { prop: Prop }) {
  const [photoFailed, setPhotoFailed] = useState(false)
  const showPhoto = prop.kind === 'player' && prop.photo && !photoFailed
  const showTeamBadge = prop.kind === 'team'
  const initials = initialsFor(prop.player)

  if (showPhoto) {
    return (
      <span className="picks-avatar picks-avatar-photo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={prop.photo} alt={prop.player} onError={() => setPhotoFailed(true)} />
      </span>
    )
  }

  if (showTeamBadge) {
    return (
      <span
        className="picks-avatar picks-avatar-team"
        style={{
          background: prop.badgeBg ?? 'var(--ink)',
          color: prop.badgeFg ?? 'var(--bg)',
        }}
      >
        {prop.badge ?? initials}
      </span>
    )
  }

  return (
    <span className="picks-avatar picks-avatar-initials">
      {initials}
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
            <div key={p.id} className={'picks-card' + (selected ? ' is-selected' : '') + (p.kind === 'team' ? ' picks-card-team' : '')}>
              <div className="picks-card-meta">
                <span className="picks-card-game">{p.game}</span>
                <span className="picks-card-when">{p.when}</span>
              </div>
              <div className="picks-card-body">
                <PropAvatar prop={p} />
                <div className="picks-card-text">
                  <div className="picks-card-player">
                    {p.player}
                    {p.kind === 'team' && <span className="picks-card-kind">TEAM</span>}
                  </div>
                  <div className="picks-card-stat">
                    {p.stat} · <span className="picks-card-line">{p.line} {p.unit}</span>
                  </div>
                </div>
              </div>
              <div className="picks-card-actions">
                <button
                  type="button"
                  className={'picks-btn' + (selected === 'MORE' ? ' picks-btn-more-active' : '')}
                  onClick={() => onToggle(p.id, 'MORE')}
                >
                  <span className="picks-btn-arrow">▲</span> MORE
                </button>
                <button
                  type="button"
                  className={'picks-btn' + (selected === 'LESS' ? ' picks-btn-less-active' : '')}
                  onClick={() => onToggle(p.id, 'LESS')}
                >
                  <span className="picks-btn-arrow">▼</span> LESS
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

type PrefMode = 'power' | 'flex' | null

function LockInForm({
  picks, entry, onClose,
}: {
  picks: Record<string, Pick>
  entry: number
  onClose: () => void
}) {
  const [email, setEmail] = useState('')
  const [willPay, setWillPay] = useState<'yes' | 'no' | null>(null)
  const [prefMode, setPrefMode] = useState<PrefMode>(null)
  const [why, setWhy] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !willPay || !prefMode) return
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
          prefMode,
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

        <label className="picks-lockin-label">If you could pick the rules — which would you play?</label>
        <div className="picks-lockin-yn picks-lockin-mode">
          <button
            type="button"
            className={'picks-mode-btn' + (prefMode === 'power' ? ' is-active' : '')}
            onClick={() => setPrefMode('power')}
          >
            <span className="picks-mode-name">All-must-hit</span>
            <span className="picks-mode-sub">Hit every pick. Up to 25× payout. Miss 1 → lose entry.</span>
          </button>
          <button
            type="button"
            className={'picks-mode-btn' + (prefMode === 'flex' ? ' is-active' : '')}
            onClick={() => setPrefMode('flex')}
          >
            <span className="picks-mode-name">Miss-and-still-win</span>
            <span className="picks-mode-sub">Miss 1–2 picks, still win a smaller payout (up to ~10×).</span>
          </button>
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
          disabled={status === 'loading' || !email.trim() || !willPay || !prefMode}
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

  const sports: Sport[] = ['wc', 'pba', 'pool', 'nba', 'mlbb']

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
          Pick MORE or LESS on 2 to 6 player and team props. Stack picks for a bigger multiplier. PAGCOR predictive-skill contest, peso-native, settled to GCash within the hour.
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

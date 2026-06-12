'use client'

import { useState, useEffect, FormEvent } from 'react'

/* ────────────────────────────────────────────────────────────────────────
 * /picks — predictive-skill-contest prototype
 *
 * Soft-launch dress rehearsal for the Hula Phase 0 product. Mock data,
 * hardcoded multipliers (PrizePicks-shape), no real settlement. Captures
 * willingness-to-pay signal via /api/waitlist?source=picks.
 * Not linked from / — share URL manually for validation tests only.
 * ──────────────────────────────────────────────────────────────────────── */

type Sport = 'wc' | 'pba' | 'nba' | 'mlbb' | 'pool' | 'showbiz'

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

// Wikipedia Special:FilePath redirect — returns a real cached thumbnail at the
// closest available width. Works in browsers (the /thumb/.../200px- format
// returns 400 unless that exact size was pre-generated; FilePath redirects to
// whatever IS available).
const wp = (filename: string, width = 240) =>
  `https://en.wikipedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=${width}`

// Team-colored stripe — solves the no-player-photo IP problem (no team logos
// either, just the team's primary brand color as a 4px left-edge band). Adds
// visual recognition without any licensing risk.
const TEAM_COLOR: Record<string, string> = {
  // WC 2026 — group stage live
  BRA:  '#009739',  // Brazil green
  MAR:  '#c1272d',  // Morocco red
  USA:  '#3c3b6e',  // USA navy
  PAR:  '#d52b1e',  // Paraguay red
  ESP:  '#aa151b',  // Spain red
  CPV:  '#003893',  // Cape Verde blue
  // PBA
  GIN:  '#c8102e',  // Ginebra red
  TNT:  '#e87a1e',  // TNT orange
  SMB:  '#0a3d8f',  // San Miguel blue
  MAG:  '#1f7a3a',  // Magnolia green
  // NBA — Finals
  NYK:  '#f58426',  // Knicks orange
  SAS:  '#111111',  // Spurs black/silver
  // MLBB
  ECHO: '#1E3A8A',
  BLI:  '#111111',
  // Pool
  PH:   '#003f87',  // PH flag blue
  DE:   '#000000',  // Germany
}
const stripeFor = (team?: string): string | null => {
  if (!team) return null
  // Multi-team strings like "MEX · RSA" or "ARG · ALG" — use first team's color
  const first = team.split('·')[0]?.trim() || team.trim()
  return TEAM_COLOR[first] ?? null
}

const SPORT_LABEL: Record<Sport, string> = {
  wc:      'World Cup 2026 · Group Stage',
  pba:     'PBA · Comm’s Cup Finals',
  nba:     'NBA · Finals',
  mlbb:    'MLBB · MSC 2026 · Paris',
  pool:    'Pool · Pro Tour 2026',
  showbiz: 'Showbiz · Kultura',
}

const PROPS: Prop[] = [
  // ─── World Cup 2026 — group stage LIVE (verified vs ESPN/FIFA schedule Jun 2026)
  // ET kickoffs converted to PHT (+12h). Neymar is out injured for Brazil.

  // Jun 13 ET · Brazil vs Morocco, Group C, MetLife Stadium (East Rutherford)
  { id: 'wc-vini-sot', sport: 'wc', kind: 'player',
    game: 'Brazil vs Morocco · Group C', when: 'Jun 14 · 6:00 AM PHT',
    player: 'Vinícius Júnior', team: 'BRA', stat: 'Shots on target', line: 1.5, unit: 'SoT',
    photo: wp('2023 05 06 Final de la Copa del Rey - 52879242230 (cropped).jpg') },
  { id: 'wc-raphinha-goals', sport: 'wc', kind: 'player',
    game: 'Brazil vs Morocco · Group C', when: 'Jun 14 · 6:00 AM PHT',
    player: 'Raphinha', team: 'BRA', stat: 'Goals', line: 0.5, unit: 'goals',
    photo: wp('Raphael Dias Belloli 2023.jpg') },
  { id: 'wc-bra-total-goals', sport: 'wc', kind: 'team',
    game: 'Brazil vs Morocco · Group C', when: 'Jun 14 · 6:00 AM PHT',
    player: 'Match total goals', team: 'BRA · MAR', stat: 'Both teams · Total', line: 2.5, unit: 'goals',
    badge: 'VS', badgeBg: '#0f2419', badgeFg: '#f5f1e3' },

  // Jun 12 ET · USA vs Paraguay, Group D, SoFi Stadium (Inglewood)
  { id: 'wc-pulisic-sot', sport: 'wc', kind: 'player',
    game: 'USA vs Paraguay · Group D', when: 'Jun 13 · 9:00 AM PHT',
    player: 'Christian Pulisic', team: 'USA', stat: 'Shots on target', line: 1.5, unit: 'SoT',
    photo: wp('Christian Pulisic USMNT v Belgium Mar 28 2026-73 (cropped).jpg') },

  // Jun 15 ET · Spain vs Cape Verde, Group H, Mercedes-Benz Stadium (Atlanta)
  // Yamal eased back from injury (~15–20 min) — low line.
  { id: 'wc-yamal-sot', sport: 'wc', kind: 'player',
    game: 'Spain vs Cape Verde · Group H', when: 'Jun 16 · 1:00 AM PHT',
    player: 'Lamine Yamal', team: 'ESP', stat: 'Shots on target', line: 0.5, unit: 'SoT',
    photo: wp('Lamine Yamal in 2025.jpg') },

  // ─── PBA Commissioner's Cup FINALS — Ginebra vs TNT (best-of-7, live Jun 2026)
  // Verified Jun 2026: TNT & Ginebra advanced from the semis; remaining games
  // Jun 14 (G6) / Jun 17 (G7) if necessary.
  { id: 'pba-brownlee-pts', sport: 'pba', kind: 'player',
    game: 'Ginebra vs TNT · Comm’s Cup Finals', when: 'Jun 14 · 7:30 PM PHT',
    player: 'Justin Brownlee', team: 'GIN', stat: 'Points (import)', line: 28.5, unit: 'pts',
    photo: wp('Brownlee w. bottle SEA Games 2023 (cropped).png') },
  { id: 'pba-thompson-ast', sport: 'pba', kind: 'player',
    game: 'Ginebra vs TNT · Comm’s Cup Finals', when: 'Jun 14 · 7:30 PM PHT',
    player: 'Scottie Thompson', team: 'GIN', stat: 'Assists', line: 6.5, unit: 'ast',
    photo: wp('PBA - Scottie Thompson - 2021.jpg') },
  { id: 'pba-pogoy-pts', sport: 'pba', kind: 'player',
    game: 'Ginebra vs TNT · Comm’s Cup Finals', when: 'Jun 14 · 7:30 PM PHT',
    player: 'RR Pogoy', team: 'TNT', stat: 'Points', line: 19.5, unit: 'pts',
    photo: wp('Bongbong Marcos in Dominican Republic v Philippines FBWC 2 Pogoy (cropped).jpg') },
  { id: 'pba-ginebra-pts', sport: 'pba', kind: 'team',
    game: 'Ginebra vs TNT · Comm’s Cup Finals', when: 'Jun 14 · 7:30 PM PHT',
    player: 'Barangay Ginebra', team: 'GIN', stat: 'Team total points', line: 102.5, unit: 'pts',
    badge: 'GIN', badgeBg: '#B22234', badgeFg: '#ffffff' },

  // ─── Pool · Pro Tour 2026 — Biado, Chua, Filler are all real active tour players

  { id: 'pool-biado-racks', sport: 'pool', kind: 'player',
    game: 'Biado vs Filler · race to 9', when: 'Sat · 9:00 PM PHT',
    player: 'Carlo Biado', team: 'PH', stat: 'Racks won', line: 5.5, unit: 'racks',
    photo: wp('Carlo Biado 2018.jpg') },
  { id: 'pool-filler-racks', sport: 'pool', kind: 'player',
    game: 'Biado vs Filler · race to 9', when: 'Sat · 9:00 PM PHT',
    player: 'Joshua Filler', team: 'DE', stat: 'Racks won', line: 4.5, unit: 'racks',
    photo: wp('Joshua Filler straight pool.jpg') },
  { id: 'pool-chua-racks', sport: 'pool', kind: 'player',
    game: 'Chua vs Shaw · race to 9', when: 'Sat · 6:00 PM PHT',
    player: 'Johann Chua', team: 'PH', stat: 'Racks won', line: 4.5, unit: 'racks',
    photo: wp('Maldives Open 2023 Final - Johann Chua.jpg') },
  { id: 'pool-total-racks', sport: 'pool', kind: 'team',
    game: 'Biado vs Filler · race to 9', when: 'Sat · 9:00 PM PHT',
    player: 'Match total racks', team: 'PH · DE', stat: 'Both players · Total', line: 13.5, unit: 'racks',
    badge: 'VS', badgeBg: '#0f2419', badgeFg: '#f5f1e3' },

  // ─── NBA FINALS — Knicks vs Spurs, live Jun 2026 (Knicks lead the series).
  // Game 5 Jun 13 ET = Jun 14 PHT; G6 Jun 17 / G7 Jun 20 PHT if necessary.
  { id: 'nba-brunson-pts', sport: 'nba', kind: 'player',
    game: 'Knicks vs Spurs · NBA Finals', when: 'Jun 14 · 8:30 AM PHT',
    player: 'Jalen Brunson', team: 'NYK', stat: 'Points', line: 28.5, unit: 'pts',
    photo: wp('Jalen Brunson 2023 (cropped).jpg') },
  { id: 'nba-towns-reb', sport: 'nba', kind: 'player',
    game: 'Knicks vs Spurs · NBA Finals', when: 'Jun 14 · 8:30 AM PHT',
    player: 'Karl-Anthony Towns', team: 'NYK', stat: 'Rebounds', line: 11.5, unit: 'reb',
    photo: wp('Karl-Anthony Towns (51914283512) (cropped) (cropped).jpg') },
  { id: 'nba-wemby-blk', sport: 'nba', kind: 'player',
    game: 'Knicks vs Spurs · NBA Finals', when: 'Jun 14 · 8:30 AM PHT',
    player: 'Victor Wembanyama', team: 'SAS', stat: 'Blocks', line: 3.5, unit: 'blk',
    photo: wp('Victor Wembanyama San Antonio Spurs 2024.jpg') },
  { id: 'nba-wemby-pts', sport: 'nba', kind: 'player',
    game: 'Knicks vs Spurs · NBA Finals', when: 'Jun 14 · 8:30 AM PHT',
    player: 'Victor Wembanyama', team: 'SAS', stat: 'Points', line: 24.5, unit: 'pts',
    photo: wp('Victor Wembanyama San Antonio Spurs 2024.jpg') },

  // ─── MLBB — MSC 2026 (Mid-Season Cup), Paris, early Jul 2026.
  // ECHO carries the PH flag; lines illustrative.
  { id: 'mlbb-echo-maps', sport: 'mlbb', kind: 'team',
    game: 'ECHO · MSC 2026 group stage', when: 'Early Jul · Paris',
    player: 'ECHO', team: 'ECHO', stat: 'Maps won', line: 2.5, unit: 'maps',
    badge: 'E', badgeBg: '#1E3A8A', badgeFg: '#ffffff' },
  { id: 'mlbb-kills', sport: 'mlbb', kind: 'team',
    game: 'ECHO vs Blacklist · MSC 2026', when: 'Early Jul · Paris',
    player: 'Match total kills', team: 'ECHO · BLI', stat: 'Both teams · Total', line: 28.5, unit: 'kills',
    badge: 'VS', badgeBg: '#0f2419', badgeFg: '#f5f1e3' },

  // ─── Showbiz · Kultura — real upcoming PH cultural events.
  // Lines illustrative (same standard as the sports lines); events verified
  // mid-May 2026 (sources in ~/.claude/plans/goofy-percolating-turing.md).
  { id: 'sb-bini-songs', sport: 'showbiz', kind: 'player',
    game: 'BINI · SM MOA Arena · Manila', when: 'Jun 20 · 8:00 PM PHT',
    player: 'BINI', team: 'BINI', stat: 'Setlist songs', line: 24.5, unit: 'songs',
    badge: 'BINI', badgeBg: '#E84393', badgeFg: '#ffffff' },
  { id: 'sb-bea-placement', sport: 'showbiz', kind: 'player',
    game: 'Miss Universe 2026 · Puerto Rico', when: 'Nov 2026',
    player: 'Bea Millan-Windorski', team: 'PH', stat: 'Final placement (lower = better)', line: 5.5, unit: 'place',
    badge: 'MUP', badgeBg: '#7b1fa2', badgeFg: '#ffffff' },
  { id: 'sb-ts5-gross', sport: 'showbiz', kind: 'player',
    game: 'PH cinemas nationwide', when: 'Opens Jun 19',
    player: 'Toy Story 5', team: 'FILM', stat: 'PH opening weekend', line: 145.5, unit: '₱M',
    badge: 'TS5', badgeBg: '#1565c0', badgeFg: '#ffffff' },
  { id: 'sb-spiderman-gross', sport: 'showbiz', kind: 'player',
    game: 'PH cinemas nationwide', when: 'Opens Jul 31',
    player: 'Spider-Man: Brand New Day', team: 'FILM', stat: 'PH opening weekend', line: 220.5, unit: '₱M',
    badge: 'SPD', badgeBg: '#c62828', badgeFg: '#ffffff' },
]

// Power Play multipliers — all picks must hit
const POWER_MULT: Record<number, number> = {
  2: 3, 3: 5, 4: 10, 5: 17, 6: 25,
}

// Flex Play multipliers — partial-credit. Number is the all-hit ceiling;
// miss-1 and miss-2 fallbacks are lower. Flex requires 3+ picks.
const FLEX_HIT: Record<number, number> = {
  3: 2.25, 4: 5, 5: 10, 6: 25,
}

const ENTRY_SIZES = [100, 500, 1000, 5000] as const

type Pick = 'MORE' | 'LESS'
type Mode = 'power' | 'flex'

function multFor(mode: Mode, n: number): number {
  if (n < 2 || n > 6) return 0
  if (mode === 'flex' && n >= 3) return FLEX_HIT[n] ?? 0
  return POWER_MULT[n] ?? 0
}

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
        <img
          src={prop.photo}
          alt={prop.player}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setPhotoFailed(true)}
        />
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
          const stripe = stripeFor(p.team)
          return (
            <div key={p.id} className={'picks-card' + (selected ? ' is-selected' : '') + (p.kind === 'team' ? ' picks-card-team' : '')}>
              {stripe && <span className="picks-card-stripe" style={{ background: stripe }} aria-hidden />}
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
  picks, entry, onEntryChange, mode, onModeChange, onLockIn, locked,
}: {
  picks: Record<string, Pick>
  entry: number
  onEntryChange: (n: number) => void
  mode: Mode
  onModeChange: (m: Mode) => void
  onLockIn: () => void
  locked: boolean
}) {
  const count = Object.keys(picks).length
  const mult = multFor(mode, count)
  const payout = Math.round(mult * entry)
  const canLock = count >= 2 && count <= 6 && !locked
  const flexAvailable = count >= 3

  let status = ''
  if (count === 0) status = 'Pumili ng prop para magsimula'
  else if (count === 1) status = 'Add 1 more (min 2 picks)'
  else if (count > 6) status = 'Max 6 picks per card'

  return (
    <div className={'picks-bar' + (count > 0 ? ' has-picks' : '')} aria-live="polite">
      <div className="shell picks-bar-shell">
        {!canLock && status && (
          <div className="picks-bar-status">{status}</div>
        )}
        {canLock && (
          <>
            {/* Power / Flex mode toggle — primary product surface */}
            <div className="picks-bar-modes" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'power'}
                className={'picks-mode-pill' + (mode === 'power' ? ' is-active' : '')}
                onClick={() => onModeChange('power')}
              >
                <span className="picks-mode-pill-name">Power</span>
                <span className="picks-mode-pill-sub">All must hit</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'flex'}
                className={'picks-mode-pill' + (mode === 'flex' ? ' is-active' : '') + (!flexAvailable ? ' is-disabled' : '')}
                onClick={() => flexAvailable && onModeChange('flex')}
                disabled={!flexAvailable}
                title={!flexAvailable ? 'Flex needs 3+ picks' : 'Miss 1, smaller payout'}
              >
                <span className="picks-mode-pill-name">Flex</span>
                <span className="picks-mode-pill-sub">Miss 1, lower pay</span>
              </button>
            </div>

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
              Lock in {mode === 'power' ? 'Power' : 'Flex'} →
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
  const [mode, setMode] = useState<Mode>('power')
  const [showLockIn, setShowLockIn] = useState(false)

  const togglePick = (id: string, side: Pick) => {
    setPicks((cur) => {
      const next = { ...cur }
      if (next[id] === side) delete next[id]
      else next[id] = side
      return next
    })
  }

  // Flex requires 3+ picks — auto-revert to Power if user drops below that
  const pickCount = Object.keys(picks).length
  useEffect(() => {
    if (pickCount < 3 && mode === 'flex') setMode('power')
  }, [pickCount, mode])

  const sports: Sport[] = ['wc', 'pba', 'nba', 'mlbb', 'pool', 'showbiz']

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
          World Cup 2026 · Group stage live now
        </div>
        <h1 className="h1 picks-h1">
          Hula kada game. <em>Sahod kada oras.</em>
        </h1>
        <p className="lede">
          Pumili ng <strong>MORE</strong> or <strong>LESS</strong> sa 2–6 player props. Mas marami, mas malaki ang multiplier — up to <strong>×25</strong>. PBA, MLBB, World Cup, NBA, Pool. Bayad sa GCash bago mag-dinner, sigurado.
        </p>
        <div className="picks-trust-chips">
          <span className="picks-trust-chip"><span className="picks-trust-dot" />PAGCOR-licensed</span>
          <span className="picks-trust-chip"><span className="picks-trust-dot" />Peso-native, no crypto</span>
          <span className="picks-trust-chip"><span className="picks-trust-dot" />GCash sa loob ng 60 min</span>
          <span className="picks-trust-chip"><span className="picks-trust-dot" />21+ · Magdiwang nang responsable</span>
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
        mode={mode}
        onModeChange={setMode}
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

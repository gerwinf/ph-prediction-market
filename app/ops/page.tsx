'use client'

import { useEffect, useState } from 'react'
import { CANDIDATE_EVENTS } from '../../lib/hits/events'
import { DAILY_EVENTS } from '../../lib/hits/daily-events'
import { SAKE_OKADA_2026_05_22 } from '../../lib/private-games/sake-okada-2026-05-22'
import type { Square } from '../../lib/private-games/types'

/* ────────────────────────────────────────────────────────────────────────
 * /ops — manual ops console for live event resolution
 *
 * Jade's UI during a PBA / WC game. Pick the match, pick events from
 * the pool, tap to fire. Each tap POSTs to /api/ops/resolve and writes
 * a row to public.events — all active cards polling that match see
 * the new event within 3 seconds and light up matching cells.
 *
 * Auth: shared secret entered once, stored in localStorage. Server
 * checks X-Ops-Secret header against OPS_SHARED_SECRET env var. Right
 * tool for the closed-beta phase. Swap back to Supabase-role gating
 * for public launch when the auth flow has eyes on it.
 *
 * Mobile-friendly: Jade may operate from a phone at the venue.
 * ──────────────────────────────────────────────────────────────────── */

type FiredEvent = {
  id: number
  event_key: string
  resolved_at: string
}

const POOLS = {
  sports: { label: 'PBA / Sports', events: CANDIDATE_EVENTS },
  daily: { label: 'Daily', events: DAILY_EVENTS },
} as const

// Quick-pick fixtures so Jade doesn't have to type the id. Add new ones
// here as new games come up. "Custom" lets her type a one-off id.
//
// pool='private:<gameId>' loads from lib/private-games/registry.
type FixturePool = 'sports' | 'daily' | `private:${string}`
const QUICK_FIXTURES: Array<{ id: string; label: string; pool: FixturePool }> = [
  { id: SAKE_OKADA_2026_05_22.id, label: 'Sake + Okada — May 22 (private)',         pool: `private:${SAKE_OKADA_2026_05_22.id}` },
  // PBA Comm's Cup semis Game 5 — Fri May 29
  { id: 'pba-mer-tnt-2026-05-29', label: 'Meralco vs TNT — Fri May 29 · G5',       pool: 'sports' },
  { id: 'pba-gin-ros-2026-05-29', label: 'Ginebra vs Rain or Shine — Fri May 29 · G5', pool: 'sports' },
  // PBA Comm's Cup semis Game 6 — Sun May 31
  { id: 'pba-ros-gin-2026-05-31', label: 'Rain or Shine vs Ginebra — Sun May 31 · G6', pool: 'sports' },
  { id: 'pba-tnt-mer-2026-05-31', label: 'TNT vs Meralco — Sun May 31 · G6',       pool: 'sports' },
  // Always-on demo fixture for testing the seed-on-buy loop
  { id: 'demo-pba-perpetual',     label: 'Demo · PBA perpetual',                  pool: 'sports' },
  { id: 'daily-2026-07-20',       label: 'Daily — Jul 20',                          pool: 'daily'  },
]

const PRIVATE_GAMES: Record<string, typeof SAKE_OKADA_2026_05_22> = {
  [SAKE_OKADA_2026_05_22.id]: SAKE_OKADA_2026_05_22,
}

const SECRET_KEY = 'hula-ops-secret'

export default function OpsPage() {
  const [secret, setSecret] = useState<string>('')
  const [secretInput, setSecretInput] = useState('')
  const [poolKey, setPoolKey] = useState<FixturePool>('sports')
  const [matchId, setMatchId] = useState('pba-gin-ros-2026-05-29')
  const [fired, setFired] = useState<FiredEvent[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [fixtureStatus, setFixtureStatus] = useState<string | null>(null)
  const [statusBusy, setStatusBusy] = useState(false)

  // Load secret from localStorage on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem(SECRET_KEY) || ''
    if (stored) setSecret(stored)
  }, [])

  // Poll the events I've already fired for this match (so refresh
  // doesn't lose state and duplicate fires are visible).
  useEffect(() => {
    if (!matchId) return
    let cancelled = false

    const tick = async () => {
      try {
        const res = await fetch(`/api/events?match=${encodeURIComponent(matchId)}`)
        const j = await res.json()
        if (!cancelled && j.ok) setFired(j.events)
      } catch {
        /* swallow */
      }
    }
    tick()
    const t = setInterval(tick, 5000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [matchId])

  // Fetch current fixture status when matchId changes so the toggle row
  // can render "Currently: live" etc. Reuses the public /api/fixtures/[id]
  // endpoint — no auth needed for the read.
  useEffect(() => {
    if (!matchId) return
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/fixtures/${encodeURIComponent(matchId)}`, {
          cache: 'no-store',
        })
        const j = await res.json()
        if (!cancelled && j.ok && j.fixture) {
          setFixtureStatus(j.fixture.status as string)
        } else if (!cancelled) {
          setFixtureStatus(null)
        }
      } catch {
        if (!cancelled) setFixtureStatus(null)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [matchId])

  async function setStatus(next: 'scheduled' | 'live' | 'final' | 'canceled') {
    if (statusBusy || !matchId) return
    setErrMsg(null)
    setStatusBusy(true)
    try {
      const res = await fetch('/api/ops/fixture-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Ops-Secret': secret },
        body: JSON.stringify({ fixtureId: matchId, status: next }),
      })
      const j = await res.json()
      if (!j.ok) {
        setErrMsg(j.message || j.error)
        if (j.error === 'bad_secret') clearSecret()
        return
      }
      setFixtureStatus(j.fixture?.status ?? next)
    } finally {
      setStatusBusy(false)
    }
  }

  function saveSecret() {
    if (!secretInput) return
    localStorage.setItem(SECRET_KEY, secretInput)
    setSecret(secretInput)
    setErrMsg(null)
  }

  function clearSecret() {
    localStorage.removeItem(SECRET_KEY)
    setSecret('')
    setSecretInput('')
  }

  async function fireEvent(eventKey: string, payload?: Record<string, unknown>) {
    setErrMsg(null)
    setBusy(eventKey)
    try {
      const body: Record<string, unknown> = { matchId, eventKey }
      if (payload) body.payload = payload
      const res = await fetch('/api/ops/resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Ops-Secret': secret,
        },
        body: JSON.stringify(body),
      })
      const j = await res.json()
      if (!j.ok) {
        setErrMsg(j.message || j.error)
        if (j.error === 'bad_secret') {
          clearSecret()
        }
      } else {
        setFired((prev) => [...prev, j.event])
      }
    } finally {
      setBusy(null)
    }
  }

  async function unfireEvent(eventKey: string) {
    // Delete every event row in `fired` matching this key (covers
    // duplicates and predictive YES+NO toggles). On success we drop
    // them from the local state so the tile re-arms.
    setErrMsg(null)
    setBusy(eventKey)
    const matching = fired.filter((e) => e.event_key === eventKey)
    try {
      for (const ev of matching) {
        const res = await fetch(`/api/ops/events/${ev.id}`, {
          method: 'DELETE',
          headers: { 'X-Ops-Secret': secret },
        })
        const j = await res.json()
        if (!j.ok && j.error !== 'not_found') {
          setErrMsg(j.message || j.error)
          if (j.error === 'bad_secret') clearSecret()
          return
        }
      }
      setFired((prev) => prev.filter((e) => e.event_key !== eventKey))
    } finally {
      setBusy(null)
    }
  }

  async function setPlayerPrediction(
    gameId: string,
    slug: string,
    squareId: string,
    answer: 'yes' | 'no'
  ) {
    setErrMsg(null)
    const res = await fetch(`/api/private/${encodeURIComponent(gameId)}/${encodeURIComponent(slug)}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Ops-Secret': secret,
      },
      body: JSON.stringify({ squareId, answer }),
    })
    const j = await res.json()
    if (!j.ok) {
      setErrMsg(j.message || j.error)
      if (j.error === 'bad_secret') clearSecret()
    }
    return j
  }

  // ----- render branches -----

  if (!secret) {
    return (
      <main style={shell}>
        <h1 style={h1}>Ops console</h1>
        <p style={muted}>Enter the ops secret to continue.</p>
        <input
          type="password"
          value={secretInput}
          onChange={(e) => setSecretInput(e.target.value)}
          placeholder="ops secret"
          style={input}
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && saveSecret()}
        />
        <button onClick={saveSecret} style={btnPrimary}>Continue</button>
        {errMsg && <p style={err}>{errMsg}</p>}
      </main>
    )
  }

  // Resolve the pool. For private games (poolKey === 'private:<gameId>'),
  // pull squares from the registry; otherwise use the legacy POOLS map.
  const isPrivate = poolKey.startsWith('private:')
  const privateGame = isPrivate ? PRIVATE_GAMES[poolKey.slice('private:'.length)] : null
  const pool: Array<{ id: string; label: string; category: string; rarity?: string }> = isPrivate && privateGame
    ? privateGame.squarePool.map((s) => ({
        id: s.id,
        label: s.label,
        category: s.category,
        rarity: s.type === 'predictive' ? 'predictive' : 'observational',
      }))
    : POOLS[poolKey as 'sports' | 'daily'].events as unknown as Array<{ id: string; label: string; category: string; rarity?: string }>
  const firedKeys = new Set(fired.map((e) => e.event_key))

  // For private games, ops can fire a predictive event with YES or NO
  // payload to resolve it at end of night. We surface this as a two-tap
  // workflow: tap the predictive tile → modal-less prompt right there.
  async function firePredictiveResolution(squareId: string, answer: 'yes' | 'no') {
    await fireEvent(squareId, { answer })
  }

  return (
    <main style={shell}>
      <header style={headerRow}>
        <h1 style={h1}>Ops console</h1>
        <button onClick={clearSecret} style={btnGhost}>Sign out</button>
      </header>

      <div style={row}>
        <label style={label}>Fixture</label>
        <select
          value={QUICK_FIXTURES.some((f) => f.id === matchId) ? matchId : '__custom__'}
          onChange={(e) => {
            const v = e.target.value
            if (v === '__custom__') return
            const f = QUICK_FIXTURES.find((x) => x.id === v)
            if (f) {
              setMatchId(f.id)
              setPoolKey(f.pool)
            }
          }}
          style={input}
        >
          {QUICK_FIXTURES.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
          <option value="__custom__">Custom (type below)</option>
        </select>
      </div>

      <div style={row}>
        <label style={label}>Match ID (override)</label>
        <input
          value={matchId}
          onChange={(e) => setMatchId(e.target.value)}
          placeholder="pba-gin-ros-2026-05-24"
          style={input}
        />
      </div>

      {!isPrivate && (
        <div style={row}>
          <label style={label}>Card type</label>
          <select
            value={poolKey}
            onChange={(e) => setPoolKey(e.target.value as FixturePool)}
            style={input}
          >
            <option value="sports">PBA / Sports</option>
            <option value="daily">Daily</option>
          </select>
        </div>
      )}

      <div style={{ ...row, padding: '12px 14px', background: '#0f0f0f', borderRadius: 8, border: '1px solid #1f1f1f' }}>
        <label style={{ ...label, marginBottom: 8 }}>
          Fixture status {fixtureStatus && <span style={{ color: fixtureStatus === 'live' ? '#2d9d57' : fixtureStatus === 'final' ? '#888' : fixtureStatus === 'canceled' ? '#e85a5a' : '#fbbf24' }}>· currently {fixtureStatus.toUpperCase()}</span>}
        </label>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setStatus('scheduled')}
            disabled={statusBusy || fixtureStatus === 'scheduled'}
            style={{ ...predBtn, background: fixtureStatus === 'scheduled' ? '#3b2410' : '#1a1a1a', color: '#fbbf24', flex: 1, border: '1px solid #f59e0b', opacity: fixtureStatus === 'scheduled' ? 0.6 : 1 }}
          >SCHEDULED</button>
          <button
            onClick={() => setStatus('live')}
            disabled={statusBusy || fixtureStatus === 'live'}
            style={{ ...predBtn, background: fixtureStatus === 'live' ? '#0f3a1f' : '#1a1a1a', color: '#86efac', flex: 1, border: '1px solid #2d9d57', opacity: fixtureStatus === 'live' ? 0.6 : 1 }}
          >LIVE</button>
          <button
            onClick={() => setStatus('final')}
            disabled={statusBusy || fixtureStatus === 'final'}
            style={{ ...predBtn, background: fixtureStatus === 'final' ? '#1a1a1a' : '#1a1a1a', color: '#aaa', flex: 1, border: '1px solid #555', opacity: fixtureStatus === 'final' ? 0.6 : 1 }}
          >FINAL</button>
          <button
            onClick={() => setStatus('canceled')}
            disabled={statusBusy || fixtureStatus === 'canceled'}
            style={{ ...predBtn, background: fixtureStatus === 'canceled' ? '#3b1010' : '#1a1a1a', color: '#fca5a5', flex: 'none', padding: '6px 10px', border: '1px solid #7f1d1d', opacity: fixtureStatus === 'canceled' ? 0.6 : 1 }}
          >CXL</button>
        </div>
      </div>

      <p style={muted}>
        Fired this match: <b>{fired.length}</b> event{fired.length === 1 ? '' : 's'}
      </p>

      {errMsg && <p style={err}>{errMsg}</p>}

      <div style={grid}>
        {pool.map((ev) => {
          const lit = firedKeys.has(ev.id)
          const isPredictive = ev.rarity === 'predictive'
          if (isPredictive) {
            return (
              <div
                key={ev.id}
                style={{
                  ...tile,
                  background: lit ? '#3b2410' : '#1a1a1a',
                  borderColor: lit ? '#d97706' : '#f59e0b',
                  cursor: 'default',
                }}
              >
                <div style={tileLabel}>{ev.label}</div>
                <div style={{ ...tileMeta, color: '#fbbf24' }}>
                  PREDICTIVE · {ev.category}{lit && ' · ✓ fired'}
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  {lit ? (
                    <button
                      onClick={() => unfireEvent(ev.id)}
                      disabled={busy === ev.id}
                      style={{ ...predBtn, background: '#3b2410', color: '#fcd34d', flex: 1, border: '1px solid #d97706' }}
                    >↶ UN-FIRE</button>
                  ) : (
                    <>
                      <button
                        onClick={() => firePredictiveResolution(ev.id, 'yes')}
                        disabled={busy === ev.id}
                        style={{ ...predBtn, background: '#065f46', color: '#d1fae5' }}
                      >YES</button>
                      <button
                        onClick={() => firePredictiveResolution(ev.id, 'no')}
                        disabled={busy === ev.id}
                        style={{ ...predBtn, background: '#7f1d1d', color: '#fee2e2' }}
                      >NO</button>
                    </>
                  )}
                </div>
              </div>
            )
          }
          return (
            <button
              key={ev.id}
              onClick={() => (lit ? unfireEvent(ev.id) : fireEvent(ev.id))}
              disabled={busy === ev.id}
              style={{
                ...tile,
                background: lit ? '#1b4332' : '#1a1a1a',
                borderColor: lit ? '#2d9d57' : '#333',
                opacity: busy === ev.id ? 0.5 : 1,
              }}
              title={lit ? 'Click to un-fire' : 'Click to fire'}
            >
              <div style={tileLabel}>{ev.label}</div>
              <div style={tileMeta}>
                {ev.category} · {ev.rarity}
                {lit && ' · ✓ fired (tap to undo)'}
              </div>
            </button>
          )
        })}
      </div>

      {isPrivate && privateGame && (
        <PrivatePredictionsEditor
          game={privateGame}
          onSet={setPlayerPrediction}
        />
      )}
    </main>
  )
}

const shell: React.CSSProperties = {
  maxWidth: 720,
  margin: '0 auto',
  padding: '24px 16px 64px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  color: '#eee',
  background: '#0a0a0a',
  minHeight: '100vh',
}
const headerRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
const h1: React.CSSProperties = { fontSize: 22, fontWeight: 700, margin: '0 0 8px' }
const muted: React.CSSProperties = { color: '#888', fontSize: 14, margin: '4px 0 16px' }
const row: React.CSSProperties = { margin: '12px 0' }
const label: React.CSSProperties = { display: 'block', fontSize: 12, color: '#888', marginBottom: 4 }
const input: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 16,
  background: '#1a1a1a',
  border: '1px solid #333',
  color: '#eee',
  borderRadius: 6,
  boxSizing: 'border-box',
}
const btnPrimary: React.CSSProperties = {
  padding: '10px 16px',
  background: '#2d9d57',
  border: 'none',
  color: 'white',
  fontWeight: 600,
  borderRadius: 6,
  cursor: 'pointer',
  marginTop: 8,
}
const btnGhost: React.CSSProperties = {
  padding: '6px 10px',
  background: 'transparent',
  border: '1px solid #333',
  color: '#888',
  fontSize: 12,
  borderRadius: 4,
  cursor: 'pointer',
}
const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
  gap: 8,
  marginTop: 16,
}
const tile: React.CSSProperties = {
  border: '1px solid',
  borderRadius: 8,
  padding: '12px 10px',
  textAlign: 'left',
  cursor: 'pointer',
  color: '#eee',
  transition: 'background 0.15s, border-color 0.15s',
}
const tileLabel: React.CSSProperties = { fontSize: 13, fontWeight: 600, lineHeight: 1.25 }
const tileMeta: React.CSSProperties = { fontSize: 10, color: '#888', marginTop: 4 }
const err: React.CSSProperties = { color: '#e85a5a', fontSize: 14 }
const predBtn: React.CSSProperties = {
  flex: 1,
  padding: '6px 8px',
  border: 'none',
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.08em',
  cursor: 'pointer',
}

/* ───────────────────────────────────────────────────────────────────
 * Per-player predictions editor (private games only).
 * ─────────────────────────────────────────────────────────────────── */
function PrivatePredictionsEditor({
  game,
  onSet,
}: {
  game: typeof SAKE_OKADA_2026_05_22
  onSet: (gameId: string, slug: string, squareId: string, answer: 'yes' | 'no') => Promise<{ ok: boolean }>
}) {
  // Pull each player's prediction_answers from the cards endpoint once
  // on mount, then update optimistically as ops toggles them.
  const [answers, setAnswers] = useState<Record<string, Record<string, 'yes' | 'no'>>>({})
  const [pending, setPending] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const next: Record<string, Record<string, 'yes' | 'no'>> = {}
      for (const player of game.players) {
        try {
          const res = await fetch(`/api/cards/priv-sake-okada-${player.slug}`, { cache: 'no-store' })
          const j = await res.json()
          if (j.ok) next[player.slug] = (j.card?.prediction_answers as Record<string, 'yes' | 'no'>) ?? {}
        } catch {
          /* swallow */
        }
      }
      if (!cancelled) setAnswers(next)
    })()
    return () => {
      cancelled = true
    }
  }, [game])

  const predictiveSquares = game.squarePool.filter((s) => s.type === 'predictive')

  async function toggle(slug: string, squareId: string, answer: 'yes' | 'no') {
    const key = `${slug}:${squareId}`
    setPending(key)
    setAnswers((prev) => ({
      ...prev,
      [slug]: { ...(prev[slug] ?? {}), [squareId]: answer },
    }))
    await onSet(game.id, slug, squareId, answer)
    setPending(null)
  }

  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>Predictions editor</h2>
      <p style={{ ...tileMeta, fontSize: 11, marginBottom: 12 }}>
        Set each player's prediction. Default is YES. Tap to flip. Only applies to squares on their card.
      </p>
      {game.players.map((player) => {
        const playerAnswers = answers[player.slug] ?? {}
        const playerPredictiveIds = player.cardSquareIds.filter((id) =>
          predictiveSquares.some((s) => s.id === id)
        )
        if (playerPredictiveIds.length === 0) return null
        return (
          <div key={player.slug} style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24', margin: '0 0 6px' }}>
              {player.displayName}
            </h3>
            <div style={{ display: 'grid', gap: 4 }}>
              {playerPredictiveIds.map((squareId) => {
                const sq = predictiveSquares.find((s) => s.id === squareId)
                if (!sq) return null
                const current = playerAnswers[squareId] ?? 'yes'
                const key = `${player.slug}:${squareId}`
                return (
                  <div
                    key={squareId}
                    style={{
                      display: 'flex',
                      gap: 6,
                      padding: '6px 8px',
                      background: '#0f0f0f',
                      borderRadius: 6,
                      border: '1px solid #1f1f1f',
                      alignItems: 'center',
                      opacity: pending === key ? 0.6 : 1,
                    }}
                  >
                    <div style={{ flex: 1, fontSize: 11, lineHeight: 1.3 }}>{sq.label}</div>
                    <button
                      onClick={() => toggle(player.slug, squareId, 'yes')}
                      style={{
                        ...predBtn,
                        background: current === 'yes' ? '#065f46' : '#1a1a1a',
                        color: current === 'yes' ? '#d1fae5' : '#888',
                        flex: 'none',
                        padding: '4px 8px',
                      }}
                    >YES</button>
                    <button
                      onClick={() => toggle(player.slug, squareId, 'no')}
                      style={{
                        ...predBtn,
                        background: current === 'no' ? '#7f1d1d' : '#1a1a1a',
                        color: current === 'no' ? '#fee2e2' : '#888',
                        flex: 'none',
                        padding: '4px 8px',
                      }}
                    >NO</button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </section>
  )
}

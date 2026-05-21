'use client'

import { useEffect, useState } from 'react'
import { CANDIDATE_EVENTS } from '../../lib/hits/events'
import { DAILY_EVENTS } from '../../lib/hits/daily-events'

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
const QUICK_FIXTURES: Array<{ id: string; label: string; pool: 'sports' | 'daily' }> = [
  { id: 'pba-gin-ros-2026-05-24', label: 'Ginebra vs Rain or Shine — Sun May 24', pool: 'sports' },
  { id: 'pba-tnt-mer-2026-05-24', label: 'TNT vs Meralco — Sun May 24',         pool: 'sports' },
  { id: 'daily-2026-07-20',       label: 'Daily — Jul 20',                       pool: 'daily'  },
]

const SECRET_KEY = 'hula-ops-secret'

export default function OpsPage() {
  const [secret, setSecret] = useState<string>('')
  const [secretInput, setSecretInput] = useState('')
  const [poolKey, setPoolKey] = useState<'sports' | 'daily'>('sports')
  const [matchId, setMatchId] = useState('pba-gin-ros-2026-05-24')
  const [fired, setFired] = useState<FiredEvent[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)

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

  async function fireEvent(eventKey: string) {
    setErrMsg(null)
    setBusy(eventKey)
    try {
      const res = await fetch('/api/ops/resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Ops-Secret': secret,
        },
        body: JSON.stringify({ matchId, eventKey }),
      })
      const j = await res.json()
      if (!j.ok) {
        setErrMsg(j.message || j.error)
        // Bad secret: prompt for it again.
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

  const pool = POOLS[poolKey].events
  const firedKeys = new Set(fired.map((e) => e.event_key))

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

      <div style={row}>
        <label style={label}>Card type</label>
        <select
          value={poolKey}
          onChange={(e) => setPoolKey(e.target.value as 'sports' | 'daily')}
          style={input}
        >
          <option value="sports">PBA / Sports</option>
          <option value="daily">Daily</option>
        </select>
      </div>

      <p style={muted}>
        Fired this match: <b>{fired.length}</b> event{fired.length === 1 ? '' : 's'}
      </p>

      {errMsg && <p style={err}>{errMsg}</p>}

      <div style={grid}>
        {pool.map((ev) => {
          const lit = firedKeys.has(ev.id)
          return (
            <button
              key={ev.id}
              onClick={() => fireEvent(ev.id)}
              disabled={busy === ev.id || lit}
              style={{
                ...tile,
                background: lit ? '#1b4332' : '#1a1a1a',
                borderColor: lit ? '#2d9d57' : '#333',
                opacity: busy === ev.id ? 0.5 : 1,
              }}
            >
              <div style={tileLabel}>{ev.label}</div>
              <div style={tileMeta}>
                {ev.category} · {ev.rarity}
                {lit && ' · ✓ fired'}
              </div>
            </button>
          )
        })}
      </div>
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

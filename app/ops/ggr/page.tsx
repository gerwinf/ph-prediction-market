'use client'

import { useEffect, useState, useCallback } from 'react'

/* ────────────────────────────────────────────────────────────────────────
 * /ops/ggr — Gross Gaming Revenue dashboard (PIGO operator pitch artifact)
 *
 * Shows actual settled GGR + scenario projections at 2/5/10% hold scaled
 * to a target player count. Auth: same ops shared secret as /ops, stored
 * in localStorage.
 *
 * GGR honesty: projections are a model scaled from pilot mechanics, NOT
 * observed operator revenue. The page states this plainly so the number
 * isn't oversold in the room.
 * ──────────────────────────────────────────────────────────────────── */

const SECRET_KEY = 'hula-ops-secret'

type GgrData = {
  ok: boolean
  operator: string
  window_days: number
  actual: {
    cards_sold: number
    total_wagered: number
    total_paid: number
    total_hold: number
    hold_pct: number
  }
  projections: Array<{ hold_rate: number; target_players: number; projected_ggr: number }>
  note: string
}

const peso = (n: number) => `₱${n.toLocaleString()}`

export default function GgrDashboard() {
  const [secret, setSecret] = useState('')
  const [secretInput, setSecretInput] = useState('')
  const [target, setTarget] = useState(10000)
  const [data, setData] = useState<GgrData | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem(SECRET_KEY) || ''
    if (stored) setSecret(stored)
  }, [])

  const load = useCallback(async () => {
    if (!secret) return
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch(`/api/ops/ggr?target=${target}`, {
        headers: { 'X-Ops-Secret': secret },
        cache: 'no-store',
      })
      const j = await res.json()
      if (!j.ok) {
        setErr(j.message || j.error)
        if (j.error === 'bad_secret') {
          localStorage.removeItem(SECRET_KEY)
          setSecret('')
        }
        return
      }
      setData(j)
    } catch {
      setErr('Network error')
    } finally {
      setLoading(false)
    }
  }, [secret, target])

  useEffect(() => {
    if (secret) load()
  }, [secret, load])

  if (!secret) {
    return (
      <main style={shell}>
        <h1 style={h1}>GGR dashboard</h1>
        <p style={muted}>Enter the ops secret.</p>
        <input
          type="password"
          value={secretInput}
          onChange={(e) => setSecretInput(e.target.value)}
          placeholder="ops secret"
          style={input}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && secretInput) {
              localStorage.setItem(SECRET_KEY, secretInput)
              setSecret(secretInput)
            }
          }}
        />
        <button
          onClick={() => {
            if (secretInput) {
              localStorage.setItem(SECRET_KEY, secretInput)
              setSecret(secretInput)
            }
          }}
          style={btnPrimary}
        >
          Continue
        </button>
        {err && <p style={errStyle}>{err}</p>}
      </main>
    )
  }

  return (
    <main style={shell}>
      <header style={headerRow}>
        <h1 style={h1}>GGR dashboard</h1>
        <button
          onClick={() => {
            localStorage.removeItem(SECRET_KEY)
            setSecret('')
            setData(null)
          }}
          style={btnGhost}
        >
          Sign out
        </button>
      </header>

      <div style={row}>
        <label style={label}>Target player count (projection)</label>
        <input
          type="number"
          value={target}
          onChange={(e) => setTarget(Math.max(1, Number(e.target.value) || 1))}
          style={input}
        />
      </div>

      {err && <p style={errStyle}>{err}</p>}
      {loading && <p style={muted}>Loading…</p>}

      {data && (
        <>
          <h2 style={h2}>Actual (last {data.window_days} days · {data.operator})</h2>
          <div style={statGrid}>
            <Stat label="Cards sold" value={data.actual.cards_sold.toLocaleString()} />
            <Stat label="Total wagered" value={peso(data.actual.total_wagered)} />
            <Stat label="Total paid out" value={peso(data.actual.total_paid)} />
            <Stat
              label="GGR (hold)"
              value={peso(data.actual.total_hold)}
              accent={data.actual.total_hold >= 0 ? '#2d9d57' : '#e85a5a'}
            />
            <Stat label="Hold %" value={`${data.actual.hold_pct}%`} />
          </div>

          <h2 style={h2}>Projected GGR @ {target.toLocaleString()} players</h2>
          <div style={statGrid}>
            {data.projections.map((p) => (
              <Stat
                key={p.hold_rate}
                label={`${(p.hold_rate * 100).toFixed(0)}% hold`}
                value={peso(p.projected_ggr)}
                accent="#2d9d57"
              />
            ))}
          </div>

          <p style={{ ...muted, marginTop: 20, fontStyle: 'italic', lineHeight: 1.5 }}>
            {data.note}
          </p>
        </>
      )}
    </main>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={statCard}>
      <div style={statLabel}>{label}</div>
      <div style={{ ...statValue, color: accent || '#eee' }}>{value}</div>
    </div>
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
const h2: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: '#888', margin: '24px 0 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }
const muted: React.CSSProperties = { color: '#888', fontSize: 14, margin: '4px 0 16px' }
const row: React.CSSProperties = { margin: '12px 0' }
const label: React.CSSProperties = { display: 'block', fontSize: 12, color: '#888', marginBottom: 4 }
const input: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: 16, background: '#1a1a1a',
  border: '1px solid #333', color: '#eee', borderRadius: 6, boxSizing: 'border-box',
}
const btnPrimary: React.CSSProperties = {
  padding: '10px 16px', background: '#2d9d57', border: 'none', color: 'white',
  fontWeight: 600, borderRadius: 6, cursor: 'pointer', marginTop: 8,
}
const btnGhost: React.CSSProperties = {
  padding: '6px 10px', background: 'transparent', border: '1px solid #333',
  color: '#888', fontSize: 12, borderRadius: 4, cursor: 'pointer',
}
const statGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8,
}
const statCard: React.CSSProperties = {
  background: '#141417', border: '1px solid #222', borderRadius: 10, padding: '14px 16px',
}
const statLabel: React.CSSProperties = { fontSize: 11, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }
const statValue: React.CSSProperties = { fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }
const errStyle: React.CSSProperties = { color: '#e85a5a', fontSize: 14 }

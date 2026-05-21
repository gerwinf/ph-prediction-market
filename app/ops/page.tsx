'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase/client'
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
 * Auth: requires Supabase magic-link login + ops role on the user.
 * The role is set manually in the Supabase dashboard:
 *
 *   update auth.users
 *      set raw_app_meta_data = raw_app_meta_data || '{"ops": true}'
 *    where email = 'jade@...';
 *
 * Mobile-friendly: Jade may operate from a phone at the venue.
 * ──────────────────────────────────────────────────────────────────── */

type SessionState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'not_ops'; email: string }
  | { status: 'ready'; email: string }

type FiredEvent = {
  id: number
  event_key: string
  resolved_at: string
}

const POOLS = {
  sports: { label: 'PBA / Sports', events: CANDIDATE_EVENTS },
  daily: { label: 'Daily', events: DAILY_EVENTS },
} as const

export default function OpsPage() {
  const [session, setSession] = useState<SessionState>({ status: 'loading' })
  const [poolKey, setPoolKey] = useState<'sports' | 'daily'>('sports')
  const [matchId, setMatchId] = useState('wc-opening-2026')
  const [fired, setFired] = useState<FiredEvent[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [emailInput, setEmailInput] = useState('')
  const [emailSent, setEmailSent] = useState(false)

  // 1) Determine auth state on mount + listen for changes.
  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted) return
      if (!user) {
        setSession({ status: 'anonymous' })
        return
      }
      const isOps = (user.app_metadata as { ops?: boolean })?.ops === true
      if (!isOps) {
        setSession({ status: 'not_ops', email: user.email ?? '(no email)' })
        return
      }
      setSession({ status: 'ready', email: user.email ?? '(no email)' })
    }
    check()

    const { data: sub } = supabase.auth.onAuthStateChange(() => check())
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  // 2) Poll the events I've already fired for this match (so refresh
  //    doesn't lose state and so duplicate fires are visible).
  useEffect(() => {
    if (session.status !== 'ready' || !matchId) return
    let cancelled = false

    const tick = async () => {
      try {
        const res = await fetch(`/api/events?match=${encodeURIComponent(matchId)}`)
        const j = await res.json()
        if (!cancelled && j.ok) setFired(j.events)
      } catch {
        /* swallow — next tick will retry */
      }
    }
    tick()
    const t = setInterval(tick, 5000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [matchId, session.status])

  async function sendMagicLink() {
    setErrMsg(null)
    if (!emailInput.includes('@')) {
      setErrMsg('Invalid email')
      return
    }
    const res = await fetch('/api/auth/email/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailInput, redirectTo: '/ops' }),
    })
    const j = await res.json()
    if (j.ok) setEmailSent(true)
    else setErrMsg(j.message || j.error)
  }

  async function fireEvent(eventKey: string) {
    setErrMsg(null)
    setBusy(eventKey)
    try {
      const res = await fetch('/api/ops/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, eventKey }),
      })
      const j = await res.json()
      if (!j.ok) {
        setErrMsg(j.message || j.error)
      } else {
        setFired((prev) => [...prev, j.event])
      }
    } finally {
      setBusy(null)
    }
  }

  // ----- render branches -----

  if (session.status === 'loading') {
    return <div style={shell}>Loading…</div>
  }

  if (session.status === 'anonymous') {
    return (
      <div style={shell}>
        <h1 style={h1}>Ops console</h1>
        <p style={muted}>Sign in with the ops email to continue.</p>
        {emailSent ? (
          <p style={ok}>Magic link sent to {emailInput}. Check your inbox.</p>
        ) : (
          <>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="ops email"
              style={input}
            />
            <button onClick={sendMagicLink} style={btnPrimary}>Send magic link</button>
            {errMsg && <p style={err}>{errMsg}</p>}
          </>
        )}
      </div>
    )
  }

  if (session.status === 'not_ops') {
    return (
      <div style={shell}>
        <h1 style={h1}>Ops console</h1>
        <p style={err}>
          {session.email} doesn't have ops access. Ask Gerwin to set
          <code style={code}>raw_app_meta_data.ops = true</code> on this user.
        </p>
      </div>
    )
  }

  // Ready.
  const pool = POOLS[poolKey].events
  const firedKeys = new Set(fired.map((e) => e.event_key))

  return (
    <div style={shell}>
      <h1 style={h1}>Ops console</h1>
      <p style={muted}>Signed in as {session.email}</p>

      <div style={row}>
        <label style={label}>Card type</label>
        <select value={poolKey} onChange={(e) => setPoolKey(e.target.value as 'sports' | 'daily')} style={select}>
          <option value="sports">PBA / Sports</option>
          <option value="daily">Daily</option>
        </select>
      </div>

      <div style={row}>
        <label style={label}>Match ID</label>
        <input
          value={matchId}
          onChange={(e) => setMatchId(e.target.value)}
          placeholder="wc-opening-2026"
          style={input}
        />
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
}
const select: React.CSSProperties = { ...input }
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
const ok: React.CSSProperties = { color: '#2d9d57', fontSize: 14 }
const err: React.CSSProperties = { color: '#e85a5a', fontSize: 14 }
const code: React.CSSProperties = { background: '#1a1a1a', padding: '2px 6px', borderRadius: 3, margin: '0 4px' }

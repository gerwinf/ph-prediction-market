'use client'

import { useCallback, useEffect, useState } from 'react'

/* ────────────────────────────────────────────────────────────────────────
 * /ops/fixtures — override console for the auto-published PBA schedule
 *
 * The daily feed auto-publishes the next PBA game (status='scheduled'). This
 * page lets ops correct a label/tip-off/venue, add games the feed can't see
 * (via the main /ops console's status flips), or cancel a game — which refunds
 * every pre-bought card. Same shared-secret auth as the rest of /ops.
 * ──────────────────────────────────────────────────────────────────────── */

const SECRET_KEY = 'hula-ops-secret'

type Fixture = {
  id: string
  card_type: string
  match_label: string
  starts_at: string
  ends_at: string | null
  status: string
  venue: string | null
  source: string | null
}

/** ISO UTC → value for <input type="datetime-local"> in the browser's local tz. */
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const off = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - off).toISOString().slice(0, 16)
}

export default function OpsFixturesPage() {
  const [secret, setSecret] = useState('')
  const [secretInput, setSecretInput] = useState('')
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  // Per-fixture edit drafts keyed by id.
  const [drafts, setDrafts] = useState<Record<string, { match_label: string; starts_at: string; venue: string }>>({})

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem(SECRET_KEY) || ''
    if (stored) setSecret(stored)
  }, [])

  const load = useCallback(async () => {
    if (!secret) return
    setErr(null)
    try {
      const res = await fetch('/api/ops/fixtures', { headers: { 'X-Ops-Secret': secret }, cache: 'no-store' })
      const j = await res.json()
      if (!j.ok) {
        setErr(j.message || j.error)
        if (j.error === 'bad_secret') clearSecret()
        return
      }
      setFixtures(j.fixtures)
      // Seed edit drafts from current values.
      const d: Record<string, { match_label: string; starts_at: string; venue: string }> = {}
      for (const f of j.fixtures as Fixture[]) {
        d[f.id] = { match_label: f.match_label, starts_at: toLocalInput(f.starts_at), venue: f.venue ?? '' }
      }
      setDrafts(d)
    } catch {
      setErr('network_error')
    }
  }, [secret])

  useEffect(() => {
    void load()
  }, [load])

  function saveSecret() {
    if (!secretInput) return
    localStorage.setItem(SECRET_KEY, secretInput)
    setSecret(secretInput)
  }
  function clearSecret() {
    localStorage.removeItem(SECRET_KEY)
    setSecret('')
    setSecretInput('')
  }

  async function saveEdit(f: Fixture) {
    const d = drafts[f.id]
    if (!d) return
    setBusy(f.id)
    setErr(null)
    setNote(null)
    try {
      const res = await fetch('/api/ops/fixture-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Ops-Secret': secret },
        body: JSON.stringify({
          fixtureId: f.id,
          match_label: d.match_label,
          starts_at: new Date(d.starts_at).toISOString(),
          venue: d.venue,
        }),
      })
      const j = await res.json()
      if (!j.ok) {
        setErr(j.message || j.error)
        return
      }
      setNote(`Saved ${f.id}`)
      await load()
    } finally {
      setBusy(null)
    }
  }

  async function cancelGame(f: Fixture) {
    if (!window.confirm(`Cancel "${f.match_label}"? This refunds every pre-bought card.`)) return
    setBusy(f.id)
    setErr(null)
    setNote(null)
    try {
      const res = await fetch('/api/ops/fixture-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Ops-Secret': secret },
        body: JSON.stringify({ fixtureId: f.id, status: 'canceled' }),
      })
      const j = await res.json()
      if (!j.ok) {
        setErr(j.message || j.error)
        return
      }
      setNote(`Canceled ${f.id} · refunded ${j.refunded ?? 0} card(s)`)
      await load()
    } finally {
      setBusy(null)
    }
  }

  if (!secret) {
    return (
      <main style={{ maxWidth: 420, margin: '60px auto', padding: 20, fontFamily: 'system-ui' }}>
        <h1>Ops · Fixtures</h1>
        <p>Enter the ops secret.</p>
        <input
          type="password"
          value={secretInput}
          onChange={(e) => setSecretInput(e.target.value)}
          style={{ width: '100%', padding: 10, fontSize: 16 }}
          placeholder="Ops secret"
        />
        <button onClick={saveSecret} style={{ marginTop: 10, padding: '10px 16px' }}>
          Save
        </button>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: 720, margin: '24px auto', padding: 16, fontFamily: 'system-ui' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Ops · Fixtures</h1>
        <span>
          <button onClick={() => load()} style={{ marginRight: 8 }}>Refresh</button>
          <button onClick={clearSecret}>Sign out</button>
        </span>
      </div>
      {err && <p style={{ color: '#b91c1c' }}>Error: {err}</p>}
      {note && <p style={{ color: '#15803d' }}>{note}</p>}
      <p style={{ color: '#666', fontSize: 13 }}>
        Scheduled + live games (and last 24h finals). Times shown/edited in your local timezone.
      </p>

      {fixtures.length === 0 && <p>No fixtures.</p>}

      {fixtures.map((f) => {
        const d = drafts[f.id] ?? { match_label: f.match_label, starts_at: toLocalInput(f.starts_at), venue: f.venue ?? '' }
        const editable = f.status === 'scheduled' || f.status === 'live'
        return (
          <div key={f.id} style={{ border: '1px solid #ddd', borderRadius: 10, padding: 14, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <code style={{ fontSize: 12, color: '#666' }}>{f.id}</code>
              <span style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 600 }}>
                {f.status}
                {f.source ? ` · ${f.source}` : ''}
              </span>
            </div>
            {editable ? (
              <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                <label style={{ fontSize: 12 }}>
                  Label
                  <input
                    value={d.match_label}
                    onChange={(e) => setDrafts((p) => ({ ...p, [f.id]: { ...d, match_label: e.target.value } }))}
                    style={{ width: '100%', padding: 8, fontSize: 14 }}
                  />
                </label>
                <label style={{ fontSize: 12 }}>
                  Tip-off (local time)
                  <input
                    type="datetime-local"
                    value={d.starts_at}
                    onChange={(e) => setDrafts((p) => ({ ...p, [f.id]: { ...d, starts_at: e.target.value } }))}
                    style={{ width: '100%', padding: 8, fontSize: 14 }}
                  />
                </label>
                <label style={{ fontSize: 12 }}>
                  Venue
                  <input
                    value={d.venue}
                    onChange={(e) => setDrafts((p) => ({ ...p, [f.id]: { ...d, venue: e.target.value } }))}
                    style={{ width: '100%', padding: 8, fontSize: 14 }}
                  />
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button disabled={busy === f.id} onClick={() => saveEdit(f)} style={{ padding: '8px 14px' }}>
                    {busy === f.id ? '…' : 'Save'}
                  </button>
                  <button
                    disabled={busy === f.id}
                    onClick={() => cancelGame(f)}
                    style={{ padding: '8px 14px', color: '#b91c1c' }}
                  >
                    Cancel game (refund)
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 8 }}>
                <strong>{f.match_label}</strong>
                <div style={{ fontSize: 13, color: '#666' }}>
                  {new Date(f.starts_at).toLocaleString()} {f.venue ? `· ${f.venue}` : ''}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </main>
  )
}

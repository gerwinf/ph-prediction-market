'use client'

import { useEffect, useState, useCallback } from 'react'

/* ────────────────────────────────────────────────────────────────────────
 * /ops/markets — market catalog curation console
 *
 * Three tabs over the `markets` catalog (migration 009):
 *   - Queue   (candidate)        → Approve / Reject / inline-edit
 *   - Catalog (approved | live)  → edit score/title/category/payload, Retire
 *   - Retired (retired)          → audit, read-only
 *
 * Auth: shared secret entered once, stored in localStorage (same key as the
 * /ops console). Server checks X-Ops-Secret against OPS_SHARED_SECRET. All
 * mutations go through the x-ops-secret-gated /api/ops/markets routes.
 * ──────────────────────────────────────────────────────────────────────── */

type AdminMarket = {
  id: string
  kind: string
  category: string | null
  title: string
  fixtureId: string | null
  status: string
  interestScore: number
  source: string | null
  suggestedBy: string | null
  reviewedBy: string | null
  createdAt: string
  updatedAt: string
  payload: Record<string, unknown>
}

type Tab = 'queue' | 'catalog' | 'retired'

const SECRET_KEY = 'hula-ops-secret'

const TABS: Array<{ key: Tab; label: string; statuses: string[] }> = [
  { key: 'queue', label: 'Queue', statuses: ['candidate'] },
  { key: 'catalog', label: 'Catalog', statuses: ['approved', 'live'] },
  { key: 'retired', label: 'Retired', statuses: ['retired'] },
]

type Draft = { title: string; category: string; interestScore: string; payload: string }

export default function OpsMarketsPage() {
  const [secret, setSecret] = useState('')
  const [secretInput, setSecretInput] = useState('')
  const [markets, setMarkets] = useState<AdminMarket[]>([])
  const [tab, setTab] = useState<Tab>('queue')
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem(SECRET_KEY) || ''
    if (stored) setSecret(stored)
  }, [])

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

  const load = useCallback(async () => {
    if (!secret) return
    setErrMsg(null)
    try {
      const res = await fetch('/api/ops/markets', { headers: { 'X-Ops-Secret': secret } })
      const j = await res.json()
      if (!j.ok) {
        setErrMsg(j.message || j.error)
        if (j.error === 'bad_secret') clearSecret()
        return
      }
      setMarkets(j.markets as AdminMarket[])
    } catch {
      setErrMsg('network error')
    }
  }, [secret])

  useEffect(() => {
    load()
  }, [load])

  async function mutate(path: string, init: RequestInit) {
    setBusyId(path)
    setErrMsg(null)
    try {
      const res = await fetch(path, {
        ...init,
        headers: { 'Content-Type': 'application/json', 'X-Ops-Secret': secret, ...(init.headers || {}) },
      })
      const j = await res.json()
      if (!j.ok) {
        setErrMsg(j.message || j.error)
        if (j.error === 'bad_secret') clearSecret()
        return false
      }
      return true
    } catch {
      setErrMsg('network error')
      return false
    } finally {
      setBusyId(null)
    }
  }

  async function approve(id: string) {
    if (await mutate(`/api/ops/markets/${id}/approve`, { method: 'POST' })) await load()
  }
  async function reject(id: string) {
    if (await mutate(`/api/ops/markets/${id}/reject`, { method: 'POST' })) await load()
  }
  async function retire(id: string) {
    if (await mutate(`/api/ops/markets/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'retired' }) }))
      await load()
  }

  function startEdit(m: AdminMarket) {
    setEditingId(m.id)
    setDraft({
      title: m.title,
      category: m.category ?? '',
      interestScore: String(m.interestScore),
      payload: JSON.stringify(m.payload, null, 2),
    })
  }

  async function saveEdit(id: string) {
    if (!draft) return
    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(draft.payload)
    } catch {
      setErrMsg('payload is not valid JSON')
      return
    }
    const score = Number(draft.interestScore)
    if (!Number.isInteger(score)) {
      setErrMsg('interest score must be an integer')
      return
    }
    const body = {
      title: draft.title,
      category: draft.category.trim() === '' ? null : draft.category.trim(),
      interest_score: score,
      payload,
    }
    if (await mutate(`/api/ops/markets/${id}`, { method: 'PATCH', body: JSON.stringify(body) })) {
      setEditingId(null)
      setDraft(null)
      await load()
    }
  }

  if (!secret) {
    return (
      <main style={shell}>
        <h1 style={h1}>Market catalog</h1>
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

  const active = TABS.find((t) => t.key === tab)!
  const rows = markets
    .filter((m) => active.statuses.includes(m.status))
    .sort((a, b) => b.interestScore - a.interestScore)
  const counts = Object.fromEntries(
    TABS.map((t) => [t.key, markets.filter((m) => t.statuses.includes(m.status)).length]),
  ) as Record<Tab, number>

  return (
    <main style={shell}>
      <header style={headerRow}>
        <h1 style={h1}>Market catalog</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={btnGhost}>Refresh</button>
          <button onClick={clearSecret} style={btnGhost}>Sign out</button>
        </div>
      </header>

      <div style={{ display: 'flex', gap: 6, margin: '12px 0 4px' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setEditingId(null) }}
            style={{
              ...tabBtn,
              background: t.key === tab ? '#1b4332' : '#1a1a1a',
              borderColor: t.key === tab ? '#2d9d57' : '#333',
            }}
          >
            {t.label} <span style={{ color: '#888' }}>{counts[t.key] ?? 0}</span>
          </button>
        ))}
      </div>

      {errMsg && <p style={err}>{errMsg}</p>}
      {rows.length === 0 && <p style={muted}>No markets in {active.label.toLowerCase()}.</p>}

      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        {rows.map((m) => {
          const editing = editingId === m.id
          return (
            <div key={m.id} style={cardBox}>
              {editing && draft ? (
                <>
                  <input
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    style={input}
                    placeholder="title"
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <input
                      value={draft.category}
                      onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                      style={{ ...input, flex: 1 }}
                      placeholder="category"
                    />
                    <input
                      value={draft.interestScore}
                      onChange={(e) => setDraft({ ...draft, interestScore: e.target.value })}
                      style={{ ...input, width: 100 }}
                      placeholder="score"
                      inputMode="numeric"
                    />
                  </div>
                  <textarea
                    value={draft.payload}
                    onChange={(e) => setDraft({ ...draft, payload: e.target.value })}
                    style={{ ...input, marginTop: 8, fontFamily: 'monospace', fontSize: 12, minHeight: 120 }}
                    spellCheck={false}
                  />
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button onClick={() => saveEdit(m.id)} disabled={busyId !== null} style={btnPrimary}>Save</button>
                    <button onClick={() => { setEditingId(null); setDraft(null) }} style={btnGhost}>Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{m.title}</div>
                    <div style={{ ...tileMeta, whiteSpace: 'nowrap' }}>★ {m.interestScore}</div>
                  </div>
                  <div style={tileMeta}>
                    {m.kind} · {m.category ?? '—'} · {m.source ?? 'unknown'} · {m.status}
                    {m.reviewedBy ? ` · reviewed by ${m.reviewedBy}` : ''}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {tab === 'queue' && (
                      <>
                        <button onClick={() => approve(m.id)} disabled={busyId !== null} style={btnApprove}>Approve</button>
                        <button onClick={() => reject(m.id)} disabled={busyId !== null} style={btnReject}>Reject</button>
                      </>
                    )}
                    {tab === 'catalog' && (
                      <button onClick={() => retire(m.id)} disabled={busyId !== null} style={btnReject}>Retire</button>
                    )}
                    {tab !== 'retired' && (
                      <button onClick={() => startEdit(m)} style={btnGhost}>Edit</button>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}

const shell: React.CSSProperties = {
  maxWidth: 760,
  margin: '0 auto',
  padding: '24px 16px 64px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  color: '#eee',
  background: '#0a0a0a',
  minHeight: '100vh',
}
const headerRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
const h1: React.CSSProperties = { fontSize: 22, fontWeight: 700, margin: '0 0 8px' }
const muted: React.CSSProperties = { color: '#888', fontSize: 14, margin: '8px 0' }
const input: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 15,
  background: '#1a1a1a',
  border: '1px solid #333',
  color: '#eee',
  borderRadius: 6,
  boxSizing: 'border-box',
}
const tabBtn: React.CSSProperties = {
  padding: '8px 14px',
  border: '1px solid',
  borderRadius: 6,
  color: '#eee',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}
const cardBox: React.CSSProperties = {
  border: '1px solid #1f1f1f',
  background: '#0f0f0f',
  borderRadius: 8,
  padding: '12px 14px',
}
const tileMeta: React.CSSProperties = { fontSize: 11, color: '#888', marginTop: 4 }
const btnPrimary: React.CSSProperties = {
  padding: '8px 16px',
  background: '#2d9d57',
  border: 'none',
  color: 'white',
  fontWeight: 600,
  borderRadius: 6,
  cursor: 'pointer',
}
const btnGhost: React.CSSProperties = {
  padding: '6px 12px',
  background: 'transparent',
  border: '1px solid #333',
  color: '#aaa',
  fontSize: 13,
  borderRadius: 4,
  cursor: 'pointer',
}
const btnApprove: React.CSSProperties = {
  padding: '6px 14px',
  background: '#065f46',
  border: 'none',
  color: '#d1fae5',
  fontWeight: 600,
  fontSize: 13,
  borderRadius: 4,
  cursor: 'pointer',
}
const btnReject: React.CSSProperties = {
  padding: '6px 14px',
  background: '#7f1d1d',
  border: 'none',
  color: '#fee2e2',
  fontWeight: 600,
  fontSize: 13,
  borderRadius: 4,
  cursor: 'pointer',
}
const err: React.CSSProperties = { color: '#e85a5a', fontSize: 14 }

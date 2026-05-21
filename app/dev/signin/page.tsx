'use client'

import { useState } from 'react'

/* ────────────────────────────────────────────────────────────────────────
 * /dev/signin (DEV ONLY)
 *
 * Quick "type your email, click button, get signed in" page. Bypasses
 * the magic-link URL flow that keeps getting prefetched/consumed by
 * link-preview tools. Calls POST /api/dev/signin which uses the admin
 * SDK to mint + verify a one-shot token server-side, then sets the
 * session cookies on the response.
 *
 * Don't deploy. The /api/dev/signin handler refuses in production
 * regardless.
 * ──────────────────────────────────────────────────────────────────── */

export default function DevSigninPage() {
  const [email, setEmail] = useState('gerwin.fricke@gmail.com')
  const [redirectTo, setRedirectTo] = useState('/ops')
  const [status, setStatus] = useState<'idle' | 'busy' | 'ok' | 'err'>('idle')
  const [msg, setMsg] = useState<string | null>(null)

  async function go() {
    setStatus('busy')
    setMsg(null)
    try {
      const res = await fetch('/api/dev/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, redirectTo }),
        credentials: 'include',
      })
      const j = await res.json()
      if (!res.ok || !j.ok) {
        setStatus('err')
        setMsg(j.message || j.error || 'unknown')
        return
      }
      setStatus('ok')
      setMsg(`Signed in as ${j.email} (${j.userId.slice(0, 8)}...). Redirecting…`)
      setTimeout(() => {
        window.location.href = redirectTo
      }, 600)
    } catch (err: any) {
      setStatus('err')
      setMsg(String(err?.message || err))
    }
  }

  return (
    <main style={shell}>
      <h1 style={h1}>Dev signin</h1>
      <p style={muted}>Skips the magic-link email + URL dance. Works only in dev.</p>

      <label style={label}>Email</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={input}
      />

      <label style={label}>Redirect to</label>
      <input
        type="text"
        value={redirectTo}
        onChange={(e) => setRedirectTo(e.target.value)}
        style={input}
      />

      <button onClick={go} disabled={status === 'busy'} style={btn}>
        {status === 'busy' ? 'Signing in…' : 'Sign in'}
      </button>

      {msg && (
        <p style={status === 'err' ? err : ok}>{msg}</p>
      )}
    </main>
  )
}

const shell: React.CSSProperties = {
  maxWidth: 480,
  margin: '40px auto',
  padding: '0 16px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  color: '#eee',
  background: '#0a0a0a',
  minHeight: '100vh',
}
const h1: React.CSSProperties = { fontSize: 22, fontWeight: 700, marginBottom: 8 }
const muted: React.CSSProperties = { color: '#888', fontSize: 13, marginBottom: 24 }
const label: React.CSSProperties = { display: 'block', fontSize: 12, color: '#888', marginTop: 16, marginBottom: 4 }
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
const btn: React.CSSProperties = {
  marginTop: 20,
  padding: '12px 20px',
  background: '#2d9d57',
  border: 'none',
  color: 'white',
  fontWeight: 600,
  borderRadius: 6,
  cursor: 'pointer',
  width: '100%',
}
const ok: React.CSSProperties = { color: '#2d9d57', marginTop: 16, fontSize: 14 }
const err: React.CSSProperties = { color: '#e85a5a', marginTop: 16, fontSize: 14 }

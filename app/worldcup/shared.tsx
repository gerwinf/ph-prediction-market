'use client'

import { useEffect, useRef, useState } from 'react'
import { flagUrl } from '../../lib/worldcup/state'

/* Shared /worldcup UI — used by the hub (hub.tsx) and the per-fixture market
 * detail page (app/worldcup/[fixtureId]/detail.tsx). Extracted verbatim from
 * hub.tsx; no behavior change. */

export function Flag({ iso, name, size = 80 }: { iso: string; name: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return <span className="wc-flag-chip" style={{ width: size, height: Math.round((size * 3) / 4) }}>{iso.toUpperCase()}</span>
  }
  return (
    <img
      className="wc-flag"
      src={flagUrl(iso, size)}
      alt={name}
      width={size}
      height={Math.round((size * 3) / 4)}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

// Group-stage codes ("A".."L") render as "Group A"; knockout stage names
// (e.g. "Round of 32", "Quarter-final") render as-is.
export function groupLabel(group: string): string {
  return /^[A-Z]$/i.test(group) ? `Group ${group}` : group
}

export function kickoffLabel(kickoffISO: string): string {
  const d = new Date(kickoffISO)
  const day = d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${day} · ${time}`
}

export function WaitlistModal({ context, onClose }: { context: string; onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  // Dismiss on Escape and pull focus into the dialog when it opens.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    inputRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('loading')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'worldcup', why: context }),
      })
      setStatus(res.ok ? 'success' : 'error')
      if (res.ok) setEmail('')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="wc-modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="wc-modal-card" role="dialog" aria-modal="true" aria-labelledby="wc-modal-title">
        <button className="wc-modal-x" onClick={onClose} aria-label="Close">×</button>
        <div className="wc-modal-eyebrow">World Cup 2026</div>
        <h3 className="wc-modal-title" id="wc-modal-title">{context}</h3>
        <p className="wc-modal-sub">
          We&apos;re pre-launch. Drop your email and we&apos;ll let you trade this market the moment we go live.
        </p>
        {status === 'success' ? (
          <div className="wc-modal-done">You&apos;re in — salamat! We&apos;ll be in touch.</div>
        ) : (
          <form className="wc-modal-form" onSubmit={submit}>
            <input
              ref={inputRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.ph"
              disabled={status === 'loading'}
              required
            />
            <button type="submit" className="wc-cta-btn" disabled={status === 'loading' || !email.trim()}>
              {status === 'loading' ? 'Loading…' : 'Notify me →'}
            </button>
            {status === 'error' && <div className="wc-modal-err">Something broke. Try again.</div>}
          </form>
        )}
      </div>
    </div>
  )
}

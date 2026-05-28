'use client'

import { useState } from 'react'
import { track } from '../../lib/analytics/track'
import { useModalA11y } from '../../lib/hooks/useModalA11y'

/* ────────────────────────────────────────────────────────────────────────
 * SignInModal
 *
 * Email magic-link sign-in for /hits. Optional — anonymous play stays
 * supported. When user enters their email, we POST to /api/auth/email/start
 * which triggers Supabase to send the link. User clicks the link in their
 * email → Supabase verifies → lands back on /hits with a session cookie.
 *
 * Two states: form (input) and "check your email" (success).
 * ──────────────────────────────────────────────────────────────────── */

type Props = {
  onClose: () => void
  redirectTo?: string
}

export function SignInModal({ onClose, redirectTo }: Props) {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { containerRef, dialogProps } = useModalA11y({ isOpen: true, onClose })

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validEmail || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/email/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), redirectTo }),
      })
      const j = await res.json()
      if (!j.ok) {
        setError(j.message || 'Hindi tumagos. Subukan ulit.')
        setSubmitting(false)
        return
      }
      track('signin_link_sent', { email_domain: email.split('@')[1] ?? null })
      setSent(true)
    } catch {
      setError('Hindi tumagos. Subukan ulit.')
      setSubmitting(false)
    }
  }

  return (
    <div
      className="hits-win-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={containerRef}
        {...dialogProps}
        aria-labelledby="signin-modal-h"
        className="hits-capture-card"
      >
        {sent ? (
          <>
            <div className="hits-capture-tick">✉</div>
            <h2 id="signin-modal-h" className="hits-capture-h">
              Tingnan mo <em>email mo.</em>
            </h2>
            <p className="hits-capture-sub">
              Pinadalhan ka namin ng link sa <strong>{email}</strong>. Click mo
              para makasign-in. Bumalik ka rito after.
            </p>
            <button type="button" className="hits-capture-skip" onClick={onClose}>
              Sige
            </button>
          </>
        ) : (
          <>
            <div className="hits-capture-eyebrow">Sign in</div>
            <h2 id="signin-modal-h" className="hits-capture-h">
              Save your <em>tokens + ranking.</em>
            </h2>
            <p className="hits-capture-sub">
              Magpapadala kami ng magic link sa email mo. No password, walang
              spam. Anonymous play OK lang din — sign in lang kung gusto mong
              ma-save ang balance + rank.
            </p>
            <form onSubmit={handleSubmit} className="hits-capture-form">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="hits-capture-input"
                autoFocus
                required
              />
              {error && <p className="hits-capture-err">{error}</p>}
              <button
                type="submit"
                className="hits-capture-submit"
                disabled={!validEmail || submitting}
              >
                {submitting ? 'Sending…' : 'Padalhan ako ng link →'}
              </button>
              <button type="button" className="hits-capture-skip" onClick={onClose}>
                Saka na
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

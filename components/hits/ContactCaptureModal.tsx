'use client'

import { useState } from 'react'
import { track } from '../../lib/analytics/track'

/* ────────────────────────────────────────────────────────────────────────
 * ContactCaptureModal
 *
 * Fires at peak motivation: right after a win, or after a player's 3rd
 * card purchase this session. Asks for email (primary) + optional phone
 * with Taglish copy. POSTs to /api/waitlist with source='hits'.
 *
 * Once-per-device gating + trigger logic lives in the parent
 * (/hits/[card_id]). This component is dumb: render → submit → close.
 * ──────────────────────────────────────────────────────────────────── */

type Props = {
  cardId: string
  bet: number
  winPattern?: string
  onClose: () => void
}

export function ContactCaptureModal({ cardId, bet, winPattern, onClose }: Props) {
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validEmail || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          phone: phone.trim() || undefined,
          source: 'hits',
          card_id: cardId,
          win_pattern: winPattern,
          bet,
        }),
      })
      if (!res.ok) {
        setError('Hindi tumagos. Subukan ulit.')
        setSubmitting(false)
        return
      }
      track('contact_capture_submitted', { has_phone: !!phone.trim(), win_pattern: winPattern ?? null }, cardId)
      setSubmitted(true)
      // Brief celebratory hold before closing so the user sees confirmation.
      setTimeout(onClose, 1400)
    } catch {
      setError('Hindi tumagos. Subukan ulit.')
      setSubmitting(false)
    }
  }

  function handleDismiss() {
    track('contact_capture_dismissed', { had_email: email.length > 0 }, cardId)
    onClose()
  }

  return (
    <div
      className="hits-win-backdrop"
      onClick={(e) => e.target === e.currentTarget && handleDismiss()}
    >
      <div className="hits-capture-card">
        {submitted ? (
          <>
            <div className="hits-capture-tick">✓</div>
            <h2 className="hits-capture-h">
              Salamat. <em>Aabisuhan ka.</em>
            </h2>
            <p className="hits-capture-sub">
              Ipapadala namin sa email ang ay launch — at kapag may bagong laro.
            </p>
          </>
        ) : (
          <>
            <div className="hits-capture-eyebrow">
              {winPattern ? '🎉 Panalo ka!' : 'Real-money launch'}
            </div>
            <h2 className="hits-capture-h">
              {winPattern ? (
                <>Drop your email para sa <em>result + early access</em> sa real-money launch.</>
              ) : (
                <>Gusto mong laruin ito <em>for real?</em></>
              )}
            </h2>
            <p className="hits-capture-sub">
              Phase 0 is free-play tokens. When real money launches, you'll get notified first.
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
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="Phone (optional)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="hits-capture-input"
              />
              {error && <p className="hits-capture-err">{error}</p>}
              <button
                type="submit"
                className="hits-capture-submit"
                disabled={!validEmail || submitting}
              >
                {submitting ? 'Sending…' : 'Notify me sa launch →'}
              </button>
              <button type="button" className="hits-capture-skip" onClick={handleDismiss}>
                Saka na
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

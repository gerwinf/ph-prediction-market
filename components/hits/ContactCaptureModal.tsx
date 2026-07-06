'use client'

import { useState } from 'react'
import { track } from '../../lib/analytics/track'
import { useModalA11y } from '../../lib/hooks/useModalA11y'
import { useLang } from '../../lib/hits/i18n/LanguageProvider'

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
  const { t, tx } = useLang()
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { containerRef, dialogProps } = useModalA11y({ isOpen: true, onClose })

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
        setError(t('capture.error'))
        setSubmitting(false)
        return
      }
      track('contact_capture_submitted', { has_phone: !!phone.trim(), win_pattern: winPattern ?? null }, cardId)
      setSubmitted(true)
      // Brief celebratory hold before closing so the user sees confirmation.
      setTimeout(onClose, 1400)
    } catch {
      setError(t('capture.error'))
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
      <div ref={containerRef} {...dialogProps} aria-labelledby="hits-capture-h" className="hits-capture-card">
        {submitted ? (
          <>
            <div className="hits-capture-tick">✓</div>
            <h2 id="hits-capture-h" className="hits-capture-h">
              {tx('capture.doneH')}
            </h2>
            <p className="hits-capture-sub">{tx('capture.doneSub')}</p>
          </>
        ) : (
          <>
            <div className="hits-capture-eyebrow">
              {winPattern ? t('capture.eyebrowWin') : t('capture.eyebrow')}
            </div>
            <h2 id="hits-capture-h" className="hits-capture-h">
              {winPattern ? tx('capture.hWin') : tx('capture.h')}
            </h2>
            <p className="hits-capture-sub">{tx('capture.sub')}</p>
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
                placeholder={t('capture.phonePlaceholder')}
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
                {submitting ? t('capture.sending') : t('capture.submit')}
              </button>
              <button type="button" className="hits-capture-skip" onClick={handleDismiss}>
                {t('common.later')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

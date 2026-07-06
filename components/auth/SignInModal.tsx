'use client'

import { useState } from 'react'
import { track } from '../../lib/analytics/track'
import { useModalA11y } from '../../lib/hooks/useModalA11y'
import { createClient } from '../../lib/supabase/client'
import { useLang } from '../../lib/hits/i18n/LanguageProvider'
import type { StringKey } from '../../lib/hits/i18n/strings'

/* ────────────────────────────────────────────────────────────────────────
 * SignInModal — email + password (traditional auth)
 *
 * Replaced magic-link auth: links were fighting us at every layer (SMTP
 * rate limit, link-preview prefetch consuming single-use tokens, token
 * expiry-on-click, PKCE-vs-implicit flow confusion). Password auth is
 * robust — returning users sign in with NO email sent (zero rate-limit
 * exposure), and with Supabase "Confirm email" disabled, signup returns
 * a session immediately too.
 *
 * Two modes: sign in (default) and create account. Browser client so
 * the session cookie is set client-side and useSession picks it up via
 * onAuthStateChange.
 *
 * REQUIRES (Supabase dashboard): Authentication → Providers → Email →
 * "Confirm email" turned OFF, so signUp returns a session without an
 * email round-trip. If left ON, new signups will need email confirmation
 * (and hit the SMTP rate limit) — the modal handles that case by showing
 * a "check your email" message, but the zero-friction path needs it OFF.
 * ──────────────────────────────────────────────────────────────────── */

type Props = {
  onClose: () => void
  redirectTo?: string
}

type Mode = 'signin' | 'signup'

export function SignInModal({ onClose }: Props) {
  const { t, tx } = useLang()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<StringKey | null>(null)
  const [confirmSent, setConfirmSent] = useState(false)
  const { containerRef, dialogProps } = useModalA11y({ isOpen: true, onClose })

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const validPassword = password.length >= 6
  const canSubmit = validEmail && validPassword && !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    const supabase = createClient()

    try {
      if (mode === 'signup') {
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        })
        if (signUpErr) {
          setError(friendlyError(signUpErr.message))
          setSubmitting(false)
          return
        }
        track('signup_completed', { email_domain: email.split('@')[1] ?? null })
        if (!data.session) {
          // Email confirmation is ON in the project — no session yet.
          setConfirmSent(true)
          setSubmitting(false)
          return
        }
        // Session set — onAuthStateChange in useSession will flip the
        // header; close the modal.
        onClose()
        return
      }

      // Sign in
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signInErr) {
        setError(friendlyError(signInErr.message))
        setSubmitting(false)
        return
      }
      track('signin_completed', { email_domain: email.split('@')[1] ?? null })
      onClose()
    } catch {
      setError('signin.errGeneric')
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
        {confirmSent ? (
          <>
            <div className="hits-capture-tick">✉</div>
            <h2 id="signin-modal-h" className="hits-capture-h">
              {tx('signin.confirmH')}
            </h2>
            <p className="hits-capture-sub">{tx('signin.confirmSub', { email })}</p>
            <button type="button" className="hits-capture-skip" onClick={onClose}>
              {t('signin.confirmOk')}
            </button>
          </>
        ) : (
          <>
            <div className="hits-capture-eyebrow">
              {mode === 'signin' ? t('signin.eyebrowSignin') : t('signin.eyebrowSignup')}
            </div>
            <h2 id="signin-modal-h" className="hits-capture-h">
              {tx('signin.h')}
            </h2>
            <p className="hits-capture-sub">
              {mode === 'signin' ? tx('signin.subSignin') : tx('signin.subSignup')}
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
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                placeholder={mode === 'signin' ? t('signin.passwordSignin') : t('signin.passwordSignup')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="hits-capture-input"
                required
                minLength={6}
              />
              {error && <p className="hits-capture-err">{t(error)}</p>}
              <button type="submit" className="hits-capture-submit" disabled={!canSubmit}>
                {submitting
                  ? t('signin.submitting')
                  : mode === 'signin'
                    ? t('signin.submitSignin')
                    : t('signin.submitSignup')}
              </button>
              <button
                type="button"
                className="hits-capture-skip"
                onClick={() => {
                  setMode((m) => (m === 'signin' ? 'signup' : 'signin'))
                  setError(null)
                }}
              >
                {mode === 'signin'
                  ? t('signin.toggleToSignup')
                  : t('signin.toggleToSignin')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

// Map Supabase's English auth errors to a translation key. Unmapped
// messages fall through to the generic key (the raw Supabase text is
// English-only, so surfacing our own copy is friendlier than echoing it).
function friendlyError(msg: string): StringKey {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials')) return 'signin.errInvalid'
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'signin.errRegistered'
  if (m.includes('password')) return 'signin.errPassword'
  if (m.includes('rate limit')) return 'signin.errRateLimit'
  return 'signin.errGeneric'
}

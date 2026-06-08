'use client'

import { useState } from 'react'
import { track } from '../../lib/analytics/track'
import { useModalA11y } from '../../lib/hooks/useModalA11y'
import { createClient } from '../../lib/supabase/client'

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
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
      setError('May problema. Subukan ulit.')
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
              I-confirm mo <em>email mo.</em>
            </h2>
            <p className="hits-capture-sub">
              Pinadalhan ka namin ng confirmation link sa <strong>{email}</strong>.
              Click mo, tapos balik ka rito para mag-sign in.
            </p>
            <button type="button" className="hits-capture-skip" onClick={onClose}>
              Sige
            </button>
          </>
        ) : (
          <>
            <div className="hits-capture-eyebrow">
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </div>
            <h2 id="signin-modal-h" className="hits-capture-h">
              Save your <em>tokens + ranking.</em>
            </h2>
            <p className="hits-capture-sub">
              {mode === 'signin'
                ? 'Sign in para ma-save ang balance + rank mo across devices. Anonymous play OK lang din.'
                : 'Gumawa ng account para hindi mawala ang tokens + rank mo. Email + password lang.'}
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
                placeholder={mode === 'signin' ? 'Password' : 'Password (6+ chars)'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="hits-capture-input"
                required
                minLength={6}
              />
              {error && <p className="hits-capture-err">{error}</p>}
              <button type="submit" className="hits-capture-submit" disabled={!canSubmit}>
                {submitting
                  ? 'Saglit lang…'
                  : mode === 'signin'
                    ? 'Sign in →'
                    : 'Gumawa ng account →'}
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
                  ? 'Walang account? Gumawa →'
                  : '← May account na? Sign in'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

// Map Supabase's English auth errors to short masa-friendly copy.
function friendlyError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Mali ang email o password.'
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'May account na sa email na ito. Sign in na lang.'
  if (m.includes('password')) return 'Password must be at least 6 characters.'
  if (m.includes('rate limit')) return 'Sobra ang attempts. Subukan ulit mamaya.'
  return msg
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { useLang } from '../../lib/hits/i18n/LanguageProvider'
import { LangToggle } from './LangToggle'

/* ────────────────────────────────────────────────────────────────────────
 * HitsMenu — the single header overflow menu (☰)
 *
 * The /hits headers used to stack chip + sign-in + lang toggle + binder +
 * new-card as siblings and overflowed on small phones. Everything that isn't
 * the brand or the wallet chip now lives here: account (or sign-in), page
 * navigation, and the EN|TL toggle. Closes on outside-click and Escape.
 *
 * Shared by /hits, /hits/[card_id] and /hits/history (DRY). Supersedes
 * AccountMenu.
 * ──────────────────────────────────────────────────────────────────────── */

export type HitsMenuItem = {
  key: string
  label: string
  onSelect: () => void
  danger?: boolean
}

type Props = {
  // null → anon (shows the sign-in item); undefined profile fields never render.
  profile: { displayName: string; email: string } | null
  onSignIn: () => void
  onSignOut: () => void
  // Page-specific navigation items, rendered between account and language.
  items: HitsMenuItem[]
}

export function HitsMenu({ profile, onSignIn, onSignOut, items }: Props) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const select = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }

  return (
    <div className="hits-menu-wrap" ref={wrapRef}>
      <button
        type="button"
        className="hits-menu-btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="hits-menu" role="menu">
          {profile ? (
            <div className="hits-menu-id" title={t('account.signedInAs', { email: profile.email })}>
              <span className="hits-menu-id-name">{profile.displayName}</span>
              <span className="hits-menu-id-email">{profile.email}</span>
            </div>
          ) : (
            <button role="menuitem" className="hits-menu-item" onClick={select(onSignIn)}>
              {t('common.signIn')}
            </button>
          )}
          {items.map((item) => (
            <button
              key={item.key}
              role="menuitem"
              className="hits-menu-item"
              data-danger={item.danger || undefined}
              onClick={select(item.onSelect)}
            >
              {item.label}
            </button>
          ))}
          <div className="hits-menu-lang">
            <LangToggle />
          </div>
          {profile && (
            <button
              role="menuitem"
              className="hits-menu-item hits-menu-signout"
              onClick={select(onSignOut)}
            >
              {t('account.signOut')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'

/* ────────────────────────────────────────────────────────────────────────
 * AccountMenu
 *
 * Signed-in header control. Replaces the old "tap display_name = sign
 * out" pattern (unintuitive, and conflicts with tap-name-to-see-history).
 * Now: tap display_name → dropdown with Card history + Sign out. Closes
 * on outside-click and Escape.
 *
 * Shared by /hits + /hits/[card_id] headers (DRY).
 * ──────────────────────────────────────────────────────────────────── */

type Props = {
  displayName: string
  email: string
  onHistory: () => void
  onSignOut: () => void
}

export function AccountMenu({ displayName, email, onHistory, onSignOut }: Props) {
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

  return (
    <div className="hits-account-wrap" ref={wrapRef}>
      <button
        className="hits-back"
        onClick={() => setOpen((v) => !v)}
        title={`Signed in as ${email}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {displayName} ▾
      </button>
      {open && (
        <div className="hits-account-menu" role="menu">
          <button
            role="menuitem"
            className="hits-account-menu-item"
            onClick={() => {
              setOpen(false)
              onHistory()
            }}
          >
            📋 Card history
          </button>
          <button
            role="menuitem"
            className="hits-account-menu-item hits-account-menu-signout"
            onClick={() => {
              setOpen(false)
              onSignOut()
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

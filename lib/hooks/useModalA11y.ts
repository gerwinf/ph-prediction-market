'use client'

import { useEffect, useRef } from 'react'

/* ────────────────────────────────────────────────────────────────────────
 * useModalA11y
 *
 * Drop-in a11y baseline for modals: escape-to-close, focus trap, restore
 * focus to the previously-focused element when the modal closes, and
 * dialog ARIA attributes. Spread `dialogProps` on the modal's inner card
 * element and attach `containerRef` to the same element.
 *
 * Usage:
 *   const { containerRef, dialogProps } = useModalA11y({ isOpen, onClose })
 *   return (
 *     <div className="backdrop" onClick={...}>
 *       <div ref={containerRef} {...dialogProps} className="card">…</div>
 *     </div>
 *   )
 * ──────────────────────────────────────────────────────────────────── */

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useModalA11y({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isOpen) return
    previouslyFocused.current = (document.activeElement as HTMLElement) ?? null

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const container = containerRef.current
      if (!container) return
      const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
      previouslyFocused.current?.focus?.()
    }
  }, [isOpen, onClose])

  return {
    containerRef,
    dialogProps: { role: 'dialog' as const, 'aria-modal': true as const },
  }
}

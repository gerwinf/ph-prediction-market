/* ────────────────────────────────────────────────────────────────────────
 * HitsBrand — the /hits header lockup
 *
 * Reuses the landing page's logo classes (logo-mono circle + "Hula."
 * wordmark) so the brand reads identically across surfaces, plus a small
 * gold HITS pill to mark the sub-product. Shared by all /hits headers.
 * ──────────────────────────────────────────────────────────────────────── */

export function HitsBrand() {
  return (
    <span className="logo-lockup">
      <span className="logo-mono">H</span>
      <span className="logo-wordmark">
        Hula<span className="dot">.</span>
      </span>
      <span className="hits-brand-tag">Hits</span>
    </span>
  )
}

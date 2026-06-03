/**
 * Relative timestamp formatter. "just now" / "5m ago" / "3h ago" /
 * "2d ago" / "May 31". Used by the wins ticker and card history.
 *
 * For anything older than ~7 days, falls back to an absolute date so
 * "47d ago" never appears (reads worse than the date).
 */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  const m = Math.round(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d <= 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

/**
 * Fixture-source seam types.
 *
 * Mirrors the catalog signal pipeline (`lib/catalog/`): a *source* produces raw
 * rows, a pure *mapper* turns them into `FixtureCandidate`s, and the ingest glue
 * upserts them into `match_fixtures`. PBA is the first source; the shapes here
 * are source-agnostic so a second one (NBA, World Cup) drops in cleanly.
 */

/**
 * One game as scraped from a schedule source, before any normalization. The
 * fields are raw display strings exactly as they appear on the page — parsing
 * (date/time → UTC, team names → ids) is the mapper's job, kept pure so it can
 * be unit-tested against captured samples.
 */
export type RawScheduleGame = {
  /** Date heading, e.g. "Fri, Jun 12" (no year — the mapper infers it). */
  dateText: string
  /** Tip-off time in PH local time, e.g. "07:30 PM". */
  timeText: string
  /** Arena name, e.g. "Smart Araneta Coliseum". */
  venue: string
  /** First-listed team's display name, e.g. "BARANGAY GINEBRA SAN MIGUEL". */
  teamA: string
  /** Second-listed team's display name, e.g. "TNT TROPANG 5G". */
  teamB: string
}

/**
 * A normalized, ready-to-upsert fixture. `id` is deterministic so re-running the
 * feed is idempotent (same game → same row). Always `card_type: 'sports'` and
 * `status: 'scheduled'` for the PBA feed — auto-published, ops can override.
 */
export type FixtureCandidate = {
  id: string
  card_type: 'sports'
  match_label: string
  starts_at: string // ISO 8601 UTC
  status: 'scheduled'
  source: string
  venue: string | null
}

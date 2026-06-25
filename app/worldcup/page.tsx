import { fetchApprovedWcFixtures, fetchApprovedWcContenders } from '../../lib/catalog/read'
import { FIXTURES, CONTENDERS } from '../../lib/worldcup/fixtures'
import WorldCupHub from './hub'

/* ────────────────────────────────────────────────────────────────────────
 * /worldcup — server shell.
 *
 * Reads the operator-curated WC catalog on the SERVER and hands it to the
 * client hub as initial data, so the first paint is already correct — no
 * client-side fetch + swap, no flash of fallback fixtures/odds. Per-kind
 * fallback to the hardcoded data (identical posture to GET /api/worldcup):
 * an empty/erroring catalog still renders exactly as before.
 *
 * Dynamic so every load reflects the latest catalog (the admin read is never
 * shipped to the client — it stays in this server component).
 * ──────────────────────────────────────────────────────────────────────── */

export const dynamic = 'force-dynamic'

export default async function WorldCupPage() {
  const [dbFixtures, dbContenders] = await Promise.all([
    fetchApprovedWcFixtures(),
    fetchApprovedWcContenders(),
  ])

  return (
    <WorldCupHub
      initialFixtures={dbFixtures.length ? dbFixtures : FIXTURES}
      initialContenders={dbContenders.length ? dbContenders : CONTENDERS}
    />
  )
}

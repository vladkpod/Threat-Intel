import type { Db } from "@store";
import { flagClaimStaleness } from "@store";
import type { DecayScanPayload } from "../types.js";

const DEFAULT_STALE_DAYS = 30;

// M6 decay rule: flags REPORTED-tier open claims older than the threshold.
// This function NEVER modifies claim_versions.confidence — it only writes
// to claim_staleness. Decay is a caveat on read, not a score mutation.
export async function handleDecayScan(
  db: Db,
  _payload: DecayScanPayload,
  staleDays = DEFAULT_STALE_DAYS,
): Promise<{ flagged: number }> {
  const thresholdDate = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);

  const staleVersions = await db.query<{ id: number; claim_id: number }>(
    `SELECT cv.id, cv.claim_id
     FROM claim_versions cv
     WHERE cv.evidence_tier = 'REPORTED'
       AND cv.valid_to IS NULL
       AND cv.valid_from < $1::timestamptz
     ORDER BY cv.valid_from ASC`,
    [thresholdDate.toISOString()],
  );

  let flagged = 0;
  for (const row of staleVersions.rows) {
    const caveat =
      `REPORTED-tier claim open for more than ${staleDays} days without ` +
      `confirmation from a higher-tier source. The stored confidence is unchanged; ` +
      `treat this finding with increased caution pending independent confirmation.`;

    const inserted = await flagClaimStaleness(db, row.claim_id, row.id, caveat);
    if (inserted !== null) flagged++;
  }

  return { flagged };
}

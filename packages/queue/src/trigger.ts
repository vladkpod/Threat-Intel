import { TIER_RANK } from "@registry";
import type { Db, EvidenceTier } from "@store";
import { createReviewItem, getReconstructionResult } from "@store";

// Called after recordClaimVersion detects a tier upgrade. If the upgraded claim's
// technique appears in the critical path of the most recent reconstruction for
// this incident, a 'verdict-change' review item is created (pending human approval).
//
// reconstruct() is NEVER called here. Reconstruction resumes only when a human
// approves the verdict-change item via POST /admin/review/:id/approve.
export async function checkAndEnqueueIfCriticalPath(
  db: Db,
  claimId: number,
  prevTier: EvidenceTier,
  newTier: EvidenceTier,
  incidentId: number,
): Promise<void> {
  if (TIER_RANK[newTier] <= TIER_RANK[prevTier]) return;

  const claimRes = await db.query<{ attack_technique: string | null }>(
    `SELECT attack_technique FROM claims WHERE id = $1`,
    [claimId],
  );
  const technique = claimRes.rows[0]?.attack_technique;
  if (!technique) return;

  const result = await getReconstructionResult(db, incidentId);
  if (!result) return;

  const criticalTechniques = result.critical_path_techniques as string[];
  if (!criticalTechniques.includes(technique)) return;

  await createReviewItem(db, {
    feed_job_id: null,
    type: "verdict-change",
    candidate_title: `Critical-path tier upgrade: ${technique}`,
    candidate_text:
      `Claim ${claimId} tier upgraded from ${prevTier} to ${newTier} ` +
      `for technique ${technique}, which is on the critical path of the most ` +
      `recent reconstruction. Human review required before re-reconstruction.`,
    tier_ceiling: newTier,
  });
}

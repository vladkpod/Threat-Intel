import type { Db } from "@store";
import {
  createIncident,
  getReviewItem,
  storeReconstructionResult,
} from "@store";
import { reconstruct } from "@engine";
import type { ReconstructionOutput } from "@engine";
import { enforceSourceCeiling } from "../tier-ceiling.js";
import type { ReconstructionTriggeredPayload } from "../types.js";

type ReconstructFn = (input: unknown) => ReconstructionOutput;

// Architectural enforcement of Invariant 11: the FK guard.
// If the review_queue row is not approved, this throws immediately and
// reconstruction is blocked. There is no code path that bypasses this check.
export async function handleReconstructionTriggered(
  db: Db,
  payload: ReconstructionTriggeredPayload,
  reconstructFn: ReconstructFn = reconstruct,
): Promise<void> {
  const review = await getReviewItem(db, payload.review_queue_id);
  if (!review) {
    throw new Error(
      `Invariant 11: review item ${payload.review_queue_id} not found`,
    );
  }
  if (review.status !== "approved") {
    throw new Error(
      `Invariant 11: review item ${payload.review_queue_id} has status ` +
        `'${review.status}'. Reconstruction requires an approved review_queue row.`,
    );
  }

  // Invariant 12: cap every source's tier_ceiling to the review item's ceiling.
  const sources = payload.reconstruction_input.incident_sources.map((s) => ({
    ...s,
    tier_ceiling: enforceSourceCeiling(s.tier_ceiling, review.tier_ceiling),
  }));

  const engineInput = {
    ...payload.reconstruction_input,
    incident_sources: sources,
  };

  const result = reconstructFn(engineInput);

  const slug = payload.reconstruction_input.incident_name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  const incident = await createIncident(
    db,
    slug,
    payload.reconstruction_input.incident_name,
  );

  // Extract critical-path technique IDs for the re-reconstruction trigger.
  const eb = result.verdict.earliest_breakable_step;
  const criticalPathEnd = eb ?? result.attack_chain.length;
  const criticalPathTechniques = result.attack_chain
    .filter((step) => step.step <= criticalPathEnd)
    .map((step) => step.attack_technique)
    .filter((t): t is string => t !== null && t !== undefined);

  await storeReconstructionResult(
    db,
    incident.id,
    payload.review_queue_id,
    criticalPathTechniques,
    result,
  );
}

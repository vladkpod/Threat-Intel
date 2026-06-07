import type { Db } from "@store";
import { createReviewItem } from "@store";
import type { IncidentDetectedPayload } from "../types.js";

// Invariant 11 implementation: this handler creates one pending review_queue
// row and stops. It does NOT call reconstruct(). It does NOT enqueue
// reconstruction.triggered. The only path to reconstruction is
// POST /admin/review/:id/approve, which is the sole caller of that job type.
export async function handleIncidentDetected(
  db: Db,
  jobId: number,
  payload: IncidentDetectedPayload,
): Promise<void> {
  await createReviewItem(db, {
    feed_job_id: jobId,
    type: "new-incident",
    candidate_title: payload.candidate_title,
    candidate_text: payload.candidate_text,
    tier_ceiling: payload.tier_ceiling,
  });
}

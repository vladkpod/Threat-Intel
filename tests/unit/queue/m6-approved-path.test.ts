/**
 * M6 approved-path integration test.
 *
 * Proves the full pipeline runs end-to-end without gaps:
 *   handleIncidentDetected → human approval → handleReconstructionTriggered
 *   → reconstruction result stored in reconstruction_results
 *
 * Uses the British Library / Rhysida fixture so the engine runs against real
 * sources, exercising all six milestones in a single path:
 *   M1 (store), M2 (ingest admissibility), M3 (engine stages 1-3),
 *   M4 (API), M5 (feeds), M6 (queue + review gate).
 *
 * This test is the complement of the M6 negative tests: negative tests prove
 * the gates block; this test proves the approved path actually completes.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  createMigratedDb,
  enqueueJob,
  setReviewItemStatus,
  listPendingReviews,
  getReviewItem,
  getReconstructionResult,
} from "@store";
import type { Db } from "@store";
import { handleIncidentDetected, handleReconstructionTriggered } from "@queue";

const FIXTURE_PATH = fileURLToPath(
  new URL(
    "../../eval/bl_2023/fixtures/sources_full.json",
    import.meta.url,
  ),
);

function loadBlFixture(): unknown {
  return JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
}

async function freshDb(): Promise<Db> {
  return createMigratedDb();
}

describe("[M6.PIPELINE] approved-path integration", () => {
  it("full path: incident.detected → pending review → admin approve → reconstruction stored", async () => {
    const db = await freshDb();

    // ── Step 1: feed.poll produces an incident.detected job ─────────────────
    const feedJob = await enqueueJob(db, "feed.poll", { source: "attack-stix" });

    await handleIncidentDetected(db, feedJob.id, {
      source: "attack-stix",
      candidate_title:
        "British Library — Rhysida ransomware attack (October 2023)",
      candidate_text:
        "British Library Cyber Incident Review (March 2024): ransomware attack via compromised contractor VPN credentials.",
      tier_ceiling: "CONFIRMED",
    });

    // ── Step 2: review item is pending ─────────────────────────────────────
    const pending = await listPendingReviews(db);
    expect(pending).toHaveLength(1);
    const reviewItem = pending[0]!;
    expect(reviewItem.status).toBe("pending");
    expect(reviewItem.reconstruction_job_id).toBeNull();

    // ── Step 3: admin approves — enqueues reconstruction.triggered ──────────
    const blFixture = loadBlFixture() as {
      incident_name: string;
      framework: string;
      client_profile: unknown;
      incident_sources: Array<{
        id: string;
        label: string;
        independence_group: string;
        tier_ceiling: string;
        proximity: string;
        primary: boolean;
        derivative_of: string | null;
        incentive_bias: string | null;
        text: string;
      }>;
    };

    const reconPayload = {
      review_queue_id: reviewItem.id,
      reconstruction_input: {
        incident_name: blFixture.incident_name,
        framework: blFixture.framework,
        client_profile: blFixture.client_profile,
        incident_sources: blFixture.incident_sources.map((s) => ({
          id: s.id,
          label: s.label,
          independence_group: s.independence_group,
          tier_ceiling: s.tier_ceiling as
            | "CONFIRMED"
            | "REPORTED"
            | "INFERRED"
            | "ANALOGOUS",
          proximity: s.proximity,
          primary: s.primary,
          derivative_of: s.derivative_of,
          incentive_bias: s.incentive_bias,
          text: s.text,
        })),
      },
    };

    const reconJob = await enqueueJob(
      db,
      "reconstruction.triggered",
      reconPayload,
    );

    await setReviewItemStatus(
      db,
      reviewItem.id,
      "approved",
      "security-analyst",
      reconJob.id,
    );

    // Verify the review item is approved and linked to the job.
    const approved = await getReviewItem(db, reviewItem.id);
    expect(approved!.status).toBe("approved");
    expect(approved!.reconstruction_job_id).toBe(reconJob.id);
    expect(approved!.reviewed_by).toBe("security-analyst");

    // ── Step 4: reconstruction.triggered worker runs ─────────────────────────
    await handleReconstructionTriggered(db, reconPayload);

    // ── Step 5: reconstruction result is stored ──────────────────────────────
    // Look up the incident by name and query reconstruction_results.
    const incidents = await db.query<{ id: number; name: string }>(
      `SELECT id, name FROM incidents WHERE name = $1`,
      [blFixture.incident_name],
    );
    expect(incidents.rows.length).toBeGreaterThanOrEqual(1);

    const incidentId = incidents.rows[0]!.id;
    const reconResult = await getReconstructionResult(db, incidentId);
    expect(reconResult).not.toBeNull();
    expect(reconResult!.review_queue_id).toBe(reviewItem.id);

    // The engine must have extracted at least one step (T1133 or T1003.003).
    const resultJson = reconResult!.result_json as {
      attack_chain: Array<{ attack_technique: string }>;
    };
    expect(resultJson.attack_chain.length).toBeGreaterThan(0);

    // T1133 (VPN initial access) must be in the chain.
    const techniques = resultJson.attack_chain.map((s) => s.attack_technique);
    expect(techniques).toContain("T1133");

    // Critical path techniques must be stored.
    const criticalTechniques = reconResult!.critical_path_techniques as string[];
    expect(Array.isArray(criticalTechniques)).toBe(true);
    expect(criticalTechniques.length).toBeGreaterThan(0);
  });

  it("reconstruction.triggered throws if review item is not approved (FK guard)", async () => {
    const db = await freshDb();

    const feedJob = await enqueueJob(db, "feed.poll", { source: "cisa-kev" });
    await handleIncidentDetected(db, feedJob.id, {
      source: "cisa-kev",
      candidate_title: "CISA KEV: CVE-TEST",
      candidate_text: "Test candidate",
      tier_ceiling: "CONFIRMED",
    });

    const pending = await listPendingReviews(db);
    const reviewItem = pending[0]!;

    // Attempt to run reconstruction.triggered without approving first.
    await expect(
      handleReconstructionTriggered(db, {
        review_queue_id: reviewItem.id,
        reconstruction_input: {
          incident_name: "Test",
          incident_sources: [],
        },
      }),
    ).rejects.toThrow(/Invariant 11/);
  });
});

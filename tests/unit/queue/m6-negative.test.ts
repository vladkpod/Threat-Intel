/**
 * M6 negative tests — hard failures that guard the four non-negotiable
 * pipeline invariants. Each test is named [M6.Nx] so CI can reference it.
 *
 * M6.N1: incident.detected worker never calls reconstruct() and never enqueues
 *        reconstruction.triggered.
 * M6.N2: A press-RSS source (tier_ceiling='REPORTED') can never produce a
 *        CONFIRMED claim version. Invariant 12 via ingest pipeline.
 * M6.N3: decay.scan flags stale REPORTED claims but does NOT mutate confidence.
 * M6.N4: Critical-path tier upgrade creates a verdict-change review item
 *        (pending, not approved) and does NOT call reconstruct().
 */
import { describe, it, expect } from "vitest";
import { createMigratedDb } from "@store";
import {
  enqueueJob,
  countPendingJobs,
  createIncident,
  upsertClaim,
  getClaimStaleness,
  storeReconstructionResult,
  createReviewItem,
  setReviewItemStatus,
  listPendingReviews,
} from "@store";
import type { Db } from "@store";
import { handleIncidentDetected } from "@queue";
import { handleDecayScan } from "@queue";
import { checkAndEnqueueIfCriticalPath } from "@queue";
import { ingestIncident } from "@ingest";

// ─── helpers ────────────────────────────────────────────────────────────────

async function freshDb(): Promise<Db> {
  return createMigratedDb();
}

// ─── M6.N1 ──────────────────────────────────────────────────────────────────

describe("[M6.N1] incident.detected handler", () => {
  it("creates a pending review_queue row and does NOT enqueue reconstruction.triggered", async () => {
    const db = await freshDb();

    // Create a job row to act as the feed_job_id.
    const job = await enqueueJob(db, "feed.poll", { source: "attack-stix" });

    await handleIncidentDetected(db, job.id, {
      source: "attack-stix",
      candidate_title: "ATT&CK Group: FIN7 (G0046)",
      candidate_text: "FIN7 is a financially motivated threat actor.",
      tier_ceiling: "CONFIRMED",
    });

    // No reconstruction.triggered job must exist.
    const triggeredCount = await countPendingJobs(db, "reconstruction.triggered");
    expect(triggeredCount).toBe(0);

    // A pending review_queue row must have been created.
    const pending = await listPendingReviews(db);
    expect(pending).toHaveLength(1);
    expect(pending[0]!.status).toBe("pending");
    expect(pending[0]!.type).toBe("new-incident");
    expect(pending[0]!.candidate_title).toBe("ATT&CK Group: FIN7 (G0046)");
  });

  it("leaves reconstruct() uncalled — no engine output anywhere in the DB", async () => {
    const db = await freshDb();
    const job = await enqueueJob(db, "feed.poll", { source: "cisa-kev" });

    await handleIncidentDetected(db, job.id, {
      source: "cisa-kev",
      candidate_title: "CISA KEV: CVE-2025-0001 — Example Vuln",
      candidate_text: "Vendor Product: critical RCE",
      tier_ceiling: "CONFIRMED",
    });

    // No reconstruction results should exist.
    const results = await db.query("SELECT count(*) AS c FROM reconstruction_results");
    expect(Number((results.rows[0] as { c: string }).c)).toBe(0);

    // The review item is pending — not approved, not linked to a reconstruction job.
    const pending = await listPendingReviews(db);
    expect(pending[0]!.reconstruction_job_id).toBeNull();
    expect(pending[0]!.reviewed_by).toBeNull();
  });
});

// ─── M6.N2 ──────────────────────────────────────────────────────────────────

describe("[M6.N2] press-RSS tier ceiling (Invariant 12)", () => {
  it("never produces a CONFIRMED claim version from a REPORTED-ceiling source", async () => {
    const db = await freshDb();

    await ingestIncident(db, {
      incident: { slug: "press-test", name: "Press Test Incident" },
      sources: [
        {
          external_id: "PRESS-001",
          label: "Daily Tech News — ransomware report",
          independence_group: "G1",
          tier_ceiling: "REPORTED",
          proximity: "journalist secondhand",
          is_primary: true,
          derivative_of: null,
          incentive_bias: null,
          source_class: "major-press",
          body: "A major retailer suffered a ransomware attack via phishing.",
        },
      ],
      claims: [
        {
          claim_key: "initial-access:phishing",
          subject: "victim_fact",
          statement: "Threat actor gained initial access via phishing email.",
          attack_tactic: "initial-access",
          attack_technique: "T1566",
          supported_by: ["PRESS-001"],
        },
      ],
    });

    // No claim_version may have evidence_tier = 'CONFIRMED'.
    const confirmed = await db.query(
      `SELECT count(*) AS c FROM claim_versions WHERE evidence_tier = 'CONFIRMED'`,
    );
    expect(Number((confirmed.rows[0] as { c: string }).c)).toBe(0);

    // No claim_version may have confidence = 'CONFIRMED'.
    const confidentRows = await db.query(
      `SELECT count(*) AS c FROM claim_versions WHERE confidence = 'CONFIRMED'`,
    );
    expect(Number((confidentRows.rows[0] as { c: string }).c)).toBe(0);
  });
});

// ─── M6.N3 ──────────────────────────────────────────────────────────────────

describe("[M6.N3] decay.scan caveat-only rule (M6 decay rule)", () => {
  it("flags stale REPORTED claims without mutating confidence", async () => {
    const db = await freshDb();

    const incident = await createIncident(db, "decay-test", "Decay Test");
    const claim = await upsertClaim(db, incident.id, {
      claim_key: "lateral:pass-hash",
      subject: "victim_fact",
      statement: "Attacker used pass-the-hash for lateral movement.",
      attack_tactic: "lateral-movement",
      attack_technique: "T1550.002",
    });

    // Insert a REPORTED-tier version with valid_from 31 days in the past.
    // recordClaimVersion() uses now() internally, so we INSERT directly.
    const versionRes = await db.query<{ id: number; confidence: string }>(
      `INSERT INTO claim_versions
         (claim_id, version_no, evidence_tier, corroboration_count,
          confidence, reason, valid_from)
       VALUES ($1, 1, 'REPORTED', 1, 'REPORTED', 'initial',
               now() - interval '31 days')
       RETURNING id, confidence`,
      [claim.id],
    );
    const versionId = versionRes.rows[0]!.id;
    const confidenceBefore = versionRes.rows[0]!.confidence;

    // Run decay scan with 30-day threshold.
    const { flagged } = await handleDecayScan(db, {}, 30);

    // A staleness row must have been created.
    expect(flagged).toBeGreaterThanOrEqual(1);
    const staleness = await getClaimStaleness(db, versionId);
    expect(staleness).not.toBeNull();
    expect(staleness!.caveat).toContain("REPORTED-tier claim");

    // The confidence column must be completely unchanged.
    const afterRes = await db.query<{ confidence: string }>(
      `SELECT confidence FROM claim_versions WHERE id = $1`,
      [versionId],
    );
    expect(afterRes.rows[0]!.confidence).toBe(confidenceBefore);
    expect(afterRes.rows[0]!.confidence).toBe("REPORTED");
  });

  it("is idempotent — running decay.scan twice does not create duplicate staleness rows", async () => {
    const db = await freshDb();

    const incident = await createIncident(db, "idem-test", "Idempotency Test");
    const claim = await upsertClaim(db, incident.id, {
      claim_key: "exec:cmd",
      subject: "victim_fact",
      statement: "Command executed via living-off-the-land binary.",
      attack_tactic: "execution",
      attack_technique: "T1059",
    });

    await db.query(
      `INSERT INTO claim_versions
         (claim_id, version_no, evidence_tier, corroboration_count,
          confidence, reason, valid_from)
       VALUES ($1, 1, 'REPORTED', 1, 'REPORTED', 'initial',
               now() - interval '31 days')`,
      [claim.id],
    );

    await handleDecayScan(db, {}, 30);
    await handleDecayScan(db, {}, 30);

    const count = await db.query<{ c: string }>(
      `SELECT count(*) AS c FROM claim_staleness WHERE claim_id = $1`,
      [claim.id],
    );
    expect(Number(count.rows[0]!.c)).toBe(1);
  });
});

// ─── M6.N4 ──────────────────────────────────────────────────────────────────

describe("[M6.N4] re-reconstruction trigger (critical-path tier upgrade)", () => {
  it("creates a verdict-change pending review item and does NOT enqueue reconstruction.triggered", async () => {
    const db = await freshDb();

    // Set up an incident with a claim on technique T1566.004.
    const incident = await createIncident(db, "ms-recon", "M&S 2025");
    const claim = await upsertClaim(db, incident.id, {
      claim_key: "initial-access:helpdesk",
      subject: "victim_fact",
      statement: "Attacker impersonated employee at help desk.",
      attack_tactic: "initial-access",
      attack_technique: "T1566.004",
    });

    // Store a reconstruction result with T1566.004 on the critical path.
    // We need an approved review_queue row as FK.
    const reviewItem = await createReviewItem(db, {
      feed_job_id: null,
      type: "new-incident",
      candidate_title: "M&S 2025",
      candidate_text: "M&S ransomware incident",
      tier_ceiling: "CONFIRMED",
    });
    await setReviewItemStatus(db, reviewItem.id, "approved", "analyst", null);

    await storeReconstructionResult(
      db,
      incident.id,
      reviewItem.id,
      ["T1566.004", "T1556.001"],
      { verdict: { earliest_breakable_step: 1 }, attack_chain: [] },
    );

    // Trigger with a tier upgrade from REPORTED → CONFIRMED on this claim.
    await checkAndEnqueueIfCriticalPath(
      db,
      claim.id,
      "REPORTED",
      "CONFIRMED",
      incident.id,
    );

    // A verdict-change review item with status='pending' must exist.
    const pending = await listPendingReviews(db);
    const verdictChange = pending.find((r) => r.type === "verdict-change");
    expect(verdictChange).toBeDefined();
    expect(verdictChange!.status).toBe("pending");
    expect(verdictChange!.candidate_title).toContain("T1566.004");

    // No reconstruction.triggered job must have been enqueued.
    const triggeredCount = await countPendingJobs(db, "reconstruction.triggered");
    expect(triggeredCount).toBe(0);
  });

  it("does NOT create a review item for a technique that is NOT on the critical path", async () => {
    const db = await freshDb();

    const incident = await createIncident(db, "ms-recon-2", "M&S 2025 v2");
    const claim = await upsertClaim(db, incident.id, {
      claim_key: "exfil:cloud",
      subject: "victim_fact",
      statement: "Data exfiltrated to cloud storage.",
      attack_tactic: "exfiltration",
      attack_technique: "T1537",
    });

    const reviewItem = await createReviewItem(db, {
      feed_job_id: null,
      type: "new-incident",
      candidate_title: "M&S 2025 v2",
      candidate_text: "M&S ransomware",
      tier_ceiling: "CONFIRMED",
    });
    await setReviewItemStatus(db, reviewItem.id, "approved", "analyst", null);

    // Critical path only contains T1566.004, not T1537.
    await storeReconstructionResult(db, incident.id, reviewItem.id, ["T1566.004"], {});

    await checkAndEnqueueIfCriticalPath(
      db,
      claim.id,
      "REPORTED",
      "CONFIRMED",
      incident.id,
    );

    const pending = await listPendingReviews(db);
    const verdictChange = pending.find((r) => r.type === "verdict-change");
    expect(verdictChange).toBeUndefined();
  });

  it("does NOT create a review item for a tier downgrade", async () => {
    const db = await freshDb();

    const incident = await createIncident(db, "ms-recon-3", "M&S 2025 v3");
    const claim = await upsertClaim(db, incident.id, {
      claim_key: "initial-access:helpdesk-v2",
      subject: "victim_fact",
      statement: "Help desk impersonation.",
      attack_tactic: "initial-access",
      attack_technique: "T1566.004",
    });

    const reviewItem = await createReviewItem(db, {
      feed_job_id: null,
      type: "new-incident",
      candidate_title: "M&S 2025 v3",
      candidate_text: "M&S",
      tier_ceiling: "CONFIRMED",
    });
    await setReviewItemStatus(db, reviewItem.id, "approved", "analyst", null);

    await storeReconstructionResult(
      db,
      incident.id,
      reviewItem.id,
      ["T1566.004"],
      {},
    );

    // CONFIRMED → REPORTED is a downgrade, not an upgrade.
    await checkAndEnqueueIfCriticalPath(
      db,
      claim.id,
      "CONFIRMED",
      "REPORTED",
      incident.id,
    );

    const pending = await listPendingReviews(db);
    expect(pending.filter((r) => r.type === "verdict-change")).toHaveLength(0);
  });
});

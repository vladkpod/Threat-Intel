/**
 * Versioned store — schema round-trip and supersession semantics (Invariant 8).
 * Runs the real Postgres DDL via pglite.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createMigratedDb,
  createIncident,
  addSource,
  getSources,
  upsertClaim,
  recordClaimVersion,
  getCurrentVersion,
  getVersionHistory,
  type Db,
} from "@store";

let db: Db;
beforeEach(async () => {
  db = await createMigratedDb();
});
afterEach(async () => {
  await db.close();
});

describe("store", () => {
  it("round-trips incidents and sources", async () => {
    const incident = await createIncident(db, "ms-2025", "M&S 2025");
    expect(incident.id).toBeGreaterThan(0);

    await addSource(db, incident.id, {
      external_id: "MS-001",
      label: "CMC",
      independence_group: "G1",
      tier_ceiling: "CONFIRMED",
      proximity: "official-statement",
      is_primary: true,
      derivative_of: null,
      incentive_bias: "regulator floor",
      source_class: "regulator",
      base_admissibility: "victim_fact",
      body: "…",
    });

    const sources = await getSources(db, incident.id);
    expect(sources).toHaveLength(1);
    expect(sources[0]!.external_id).toBe("MS-001");
    expect(sources[0]!.independence_group).toBe("G1");
  });

  it("versions a claim: supersession closes the old version and opens a new one", async () => {
    const incident = await createIncident(db, "ms-2025", "M&S 2025");
    const claim = await upsertClaim(db, incident.id, {
      claim_key: "initial-access:helpdesk-reset",
      subject: "victim_fact",
      statement: "Help-desk social-engineering reset",
      attack_tactic: "Initial Access (TA0001)",
      attack_technique: "T1566.004",
    });

    const v1 = await recordClaimVersion(db, claim.id, {
      evidence_tier: "REPORTED",
      corroboration_count: 1,
      confidence: "REPORTED",
      reason: "initial",
      note: "press only",
      sources: [],
    });
    expect(v1.version_no).toBe(1);
    expect((await getCurrentVersion(db, claim.id))!.evidence_tier).toBe("REPORTED");

    const v2 = await recordClaimVersion(db, claim.id, {
      evidence_tier: "CONFIRMED",
      corroboration_count: 2,
      confidence: "CONFIRMED",
      reason: "supersession",
      note: "parliamentary testimony added",
      sources: [],
    });

    const current = await getCurrentVersion(db, claim.id);
    expect(current!.version_no).toBe(2);
    expect(current!.evidence_tier).toBe("CONFIRMED");

    const history = await getVersionHistory(db, claim.id);
    expect(history).toHaveLength(2);
    const closed = history.find((h) => h.version_no === 1)!;
    expect(closed.valid_to).not.toBeNull();
    expect(closed.superseded_by).toBe(v2.id);
  });

  it("enforces a single current version per claim", async () => {
    const incident = await createIncident(db, "ms-2025", "M&S 2025");
    const claim = await upsertClaim(db, incident.id, {
      claim_key: "k",
      subject: "victim_fact",
      statement: "s",
      attack_tactic: null,
      attack_technique: null,
    });
    await recordClaimVersion(db, claim.id, {
      evidence_tier: "REPORTED",
      corroboration_count: 1,
      confidence: "REPORTED",
      reason: "initial",
      note: null,
      sources: [],
    });
    await recordClaimVersion(db, claim.id, {
      evidence_tier: "CONFIRMED",
      corroboration_count: 1,
      confidence: "CONFIRMED",
      reason: "recompute",
      note: null,
      sources: [],
    });
    const open = await db.query(
      `SELECT count(*)::int AS n FROM claim_versions WHERE claim_id = $1 AND valid_to IS NULL`,
      [claim.id],
    );
    expect((open.rows[0] as { n: number }).n).toBe(1);
  });
});

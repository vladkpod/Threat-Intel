/**
 * Ingestion layer — end-to-end through the real versioned schema (pglite).
 *
 * Covers the two behaviours M1 must guarantee:
 *   1. the corroboration counter does not increment within an independence group
 *   2. admissibility (§B8) rejects leak-site content as victim-fact
 * plus a provenance-faithful slice of the M&S incident.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createMigratedDb, type Db } from "@store";
import { ingestIncident, type IngestSource } from "@ingest";

let db: Db;
beforeEach(async () => {
  db = await createMigratedDb();
});
afterEach(async () => {
  await db.close();
});

function src(
  external_id: string,
  group: IngestSource["independence_group"],
  tier: IngestSource["tier_ceiling"],
  extra: Partial<IngestSource> = {},
): IngestSource {
  return {
    external_id,
    label: external_id,
    independence_group: group,
    tier_ceiling: tier,
    proximity: "test",
    is_primary: true,
    derivative_of: null,
    incentive_bias: null,
    source_class: null,
    ir_firm: null,
    body: "…",
    ...extra,
  };
}

describe("ingestIncident", () => {
  it("does not increment corroboration within one independence group", async () => {
    const res = await ingestIncident(db, {
      incident: { slug: "within-group", name: "within-group" },
      sources: [
        src("A", "G1", "CONFIRMED"),
        src("B", "G1", "CONFIRMED"),
        src("C", "G1", "CONFIRMED"),
      ],
      claims: [
        {
          claim_key: "c",
          subject: "victim_fact",
          statement: "three G1 sources",
          supported_by: ["A", "B", "C"],
        },
      ],
    });
    const claim = res.claims[0]!;
    expect(claim.corroboration_count).toBe(1);
    expect(claim.contributors).toHaveLength(1);
    expect(claim.evidence_tier).toBe("CONFIRMED");
  });

  it("rejects leak-site content as victim-fact but admits a co-supporting G2 source", async () => {
    const res = await ingestIncident(db, {
      incident: { slug: "leak", name: "leak" },
      sources: [
        src("RNS", "G2", "CONFIRMED", { source_class: "victim-disclosure" }),
        src("LEAK", "B6", "REPORTED", { source_class: "leak-site", is_primary: false }),
      ],
      claims: [
        {
          claim_key: "victim:data-impact",
          subject: "victim_fact",
          statement: "data impact",
          supported_by: ["RNS", "LEAK"],
        },
      ],
    });

    const claim = res.claims[0]!;
    // Tier comes from the G2 source; the leak-site cannot raise or supply it.
    expect(claim.evidence_tier).toBe("CONFIRMED");
    expect(claim.corroboration_count).toBe(1);
    expect(claim.contributors).toEqual(["RNS"]);

    // The leak-site link is persisted as excluded, non-contributing.
    const rows = await db.query<{ external_id: string; admitted_as: string; corroboration_contribution: boolean }>(
      `SELECT s.external_id, cvs.admitted_as, cvs.corroboration_contribution
       FROM claim_version_sources cvs JOIN sources s ON s.id = cvs.source_id
       WHERE s.external_id = 'LEAK'`,
    );
    expect(rows.rows[0]!.admitted_as).toBe("excluded");
    expect(rows.rows[0]!.corroboration_contribution).toBe(false);
  });

  it("admits the same leak-site content as INFERRED-about-actor for an actor-subject claim", async () => {
    const res = await ingestIncident(db, {
      incident: { slug: "leak-actor", name: "leak-actor" },
      sources: [src("LEAK", "B6", "REPORTED", { source_class: "leak-site", is_primary: false })],
      claims: [
        {
          claim_key: "actor:claimed-exfiltration",
          subject: "actor",
          statement: "actor claims exfiltration",
          supported_by: ["LEAK"],
        },
      ],
    });
    expect(res.claims[0]!.evidence_tier).toBe("INFERRED");
  });

  it("tiers the M&S help-desk and NTDS.dit claims faithfully", async () => {
    const res = await ingestIncident(db, {
      incident: { slug: "ms-2025", name: "M&S 2025" },
      sources: [
        src("MS-005", "G1", "CONFIRMED", { source_class: "government" }), // parliamentary
        src("MS-003", "G4", "REPORTED", { source_class: "specialist-press" }), // BleepingComputer
        src("MS-004", "B5", "INFERRED", { source_class: "actor-advisory" }), // CISA actor advisory
      ],
      claims: [
        {
          claim_key: "initial-access:helpdesk-reset",
          subject: "victim_fact",
          statement: "social-engineering help-desk reset",
          attack_technique: "T1566.004",
          supported_by: ["MS-005"],
        },
        {
          claim_key: "credential-access:ntds",
          subject: "victim_fact",
          statement: "NTDS.dit obtained",
          attack_technique: "T1003.003",
          supported_by: ["MS-003", "MS-004"],
        },
      ],
    });

    const byKey = new Map(res.claims.map((c) => [c.claim_key, c]));
    const helpdesk = byKey.get("initial-access:helpdesk-reset")!;
    const ntds = byKey.get("credential-access:ntds")!;

    expect(helpdesk.evidence_tier).toBe("CONFIRMED");
    expect(helpdesk.corroboration_count).toBe(1);

    // Actor advisory (B5) must NOT lift NTDS.dit above REPORTED, and must not corroborate.
    expect(ntds.evidence_tier).toBe("REPORTED");
    expect(ntds.corroboration_count).toBe(1);
    expect(ntds.groups).toEqual(["G4"]);
  });
});

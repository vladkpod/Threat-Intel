/**
 * Verify the M6 decay rule: staleness caveats surface via
 * getStalenessCaveatsForIncident (the on-read injection path).
 *
 * AC: synthetic staleness row produces caveat in verdict output (verified here
 * at the store layer; the router layer calls this function before returning).
 */
import { describe, it, expect } from "vitest";
import {
  createMigratedDb,
  createIncident,
  upsertClaim,
  recordClaimVersion,
  flagClaimStaleness,
  getStalenessCaveatsForIncident,
} from "@store";

describe("[M6.DECAY] decay → caveats path", () => {
  it("synthetic staleness row produces caveat via getStalenessCaveatsForIncident", async () => {
    const db = await createMigratedDb();

    const incident = await createIncident(db, "decay-test", "Decay Test Incident");

    const claim = await upsertClaim(db, incident.id, {
      claim_key: "initial-access:test",
      subject: "victim_fact",
      statement: "Test claim for decay",
      attack_tactic: "Initial Access (TA0001)",
      attack_technique: "T1566.004",
    });

    const version = await recordClaimVersion(db, claim.id, {
      evidence_tier: "REPORTED",
      corroboration_count: 1,
      confidence: "REPORTED",
      reason: "initial",
      note: null,
      sources: [],
    });

    // No staleness yet — should return empty.
    const empty = await getStalenessCaveatsForIncident(db, incident.id);
    expect(empty).toHaveLength(0);

    // Flag the claim as stale.
    const caveatText = "REPORTED claim is unconfirmed and older than the staleness threshold; treat with reduced confidence.";
    await flagClaimStaleness(db, claim.id, version.id, caveatText);

    // Now the caveat should surface.
    const caveats = await getStalenessCaveatsForIncident(db, incident.id);
    expect(caveats).toHaveLength(1);
    expect(caveats[0]).toBe(caveatText);
  });

  it("does not return caveats from a different incident", async () => {
    const db = await createMigratedDb();

    const incA = await createIncident(db, "incident-a", "Incident A");
    const incB = await createIncident(db, "incident-b", "Incident B");

    const claimA = await upsertClaim(db, incA.id, {
      claim_key: "step:a",
      subject: "victim_fact",
      statement: "Claim in A",
      attack_tactic: "Initial Access (TA0001)",
      attack_technique: "T1133",
    });
    const versionA = await recordClaimVersion(db, claimA.id, {
      evidence_tier: "REPORTED",
      corroboration_count: 1,
      confidence: "REPORTED",
      reason: "initial",
      note: null,
      sources: [],
    });
    await flagClaimStaleness(db, claimA.id, versionA.id, "Caveat for A only");

    // Incident B has no staleness rows.
    const caveatsB = await getStalenessCaveatsForIncident(db, incB.id);
    expect(caveatsB).toHaveLength(0);

    // Incident A returns its caveat.
    const caveatsA = await getStalenessCaveatsForIncident(db, incA.id);
    expect(caveatsA).toHaveLength(1);
  });
});

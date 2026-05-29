/**
 * TC-5 — ms_temporal_supersession
 * Fixtures: sources_temporal_v1.json then sources_temporal_v2.json
 *
 * Covers Invariant 8 — later higher-tier sources supersede earlier lower-tier
 * ones (logged, confidence recomputed); unconfirmed REPORTED claims are not
 * auto-promoted just because other claims were confirmed.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { type ReconstructionOutput } from "@engine/schema";
import { runFixture, findStep, HELPDESK_RE, NTDS_RE } from "../helpers.js";

describe("TC-5 ms_temporal_supersession", () => {
  let v1: ReconstructionOutput;
  let v2: ReconstructionOutput;
  beforeAll(() => {
    v1 = runFixture("sources_temporal_v1.json");
    v2 = runFixture("sources_temporal_v2.json");
  });

  it("[A5.1] help-desk vector is REPORTED in v1, CONFIRMED in v2, and the change is logged (Inv8)", () => {
    const v1Helpdesk = findStep(v1, HELPDESK_RE);
    expect(v1Helpdesk).toBeDefined();
    expect(v1Helpdesk!.evidence_tier).toBe("REPORTED");

    const v2Helpdesk = findStep(v2, HELPDESK_RE);
    expect(v2Helpdesk).toBeDefined();
    expect(v2Helpdesk!.evidence_tier).toBe("CONFIRMED");

    expect(
      v2.version_log.some(
        (e) =>
          HELPDESK_RE.test(e.claim) &&
          e.old_tier === "REPORTED" &&
          e.new_tier === "CONFIRMED" &&
          /MS-001|MS-002|CMC|RNS|Monitoring Centre/i.test(e.superseding_source),
      ),
    ).toBe(true);
  });

  it("[A5.2] an unconfirmed NTDS.dit claim is not auto-promoted to CONFIRMED in v2 (Inv8)", () => {
    // v2 adds G1+G2 sources that confirm the helpdesk vector only. If the engine
    // surfaces an NTDS.dit step at all, it must remain REPORTED (or lower) —
    // confirming one claim must not lift an unrelated, unconfirmed one.
    const v2Ntds = findStep(v2, NTDS_RE);
    if (v2Ntds) {
      expect(v2Ntds.evidence_tier).not.toBe("CONFIRMED");
    }
  });
});

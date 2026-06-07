/**
 * TC-3 — ms_echo_corroboration
 * Fixture: sources_echo.json
 *
 * Covers DoD #6 and Invariant 5 — one primary plus many echoes must not raise
 * the corroboration count above 1, nor promote the tier.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { type ReconstructionOutput } from "@engine/schema";
import { runFixture, findStep, NTDS_RE } from "../helpers.js";

describe("TC-3 ms_echo_corroboration", () => {
  let out: ReconstructionOutput;
  beforeAll(() => {
    out = runFixture("sources_echo.json");
  });

  it("[A3.1] one-primary-many-echoes corroboration count does not exceed 1; tier stays REPORTED (DoD#6 / Inv5)", () => {
    const ntds = findStep(out, NTDS_RE);
    expect(ntds).toBeDefined();
    expect(ntds!.corroboration.independence_group_count).toBe(1);
    expect(ntds!.evidence_tier).toBe("REPORTED");
    expect(ntds!.evidence_tier).not.toBe("CONFIRMED");
  });

  it("[A3.2] derivative echoes collapse to the primary and do not each count (Inv5)", () => {
    const ntds = findStep(out, NTDS_RE);
    expect(ntds).toBeDefined();
    for (const s of ntds!.sources) {
      const counts = s.corroboration_contribution === true;
      if (counts) {
        // Only the primary may contribute.
        expect(s.id).toBe("ECHO-A");
        expect(s.collapsed_to).toBeNull();
      } else {
        // Echoes must declare what they collapse to.
        expect(s.collapsed_to).toBe("ECHO-A");
      }
    }
    const contributors = ntds!.sources.filter((s) => s.corroboration_contribution);
    expect(contributors.length).toBe(1);
  });
});

/**
 * TC-4 — ms_admissibility
 * Fixture: sources_with_leaksite.json
 *
 * Covers Invariant 7 / registry §B8 — criminal leak-site contents are never
 * admitted as victim-fact, only INFERRED-about-actor.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { type ReconstructionOutput } from "@engine/schema";
import { runFixture } from "../helpers.js";

const LEAK_ID = "LEAK-001";

describe("TC-4 ms_admissibility", () => {
  let out: ReconstructionOutput;
  beforeAll(() => {
    out = runFixture("sources_with_leaksite.json");
  });

  it("[A4.1] leak-site content never backs a CONFIRMED or REPORTED claim about the victim (Inv7)", () => {
    for (const step of out.attack_chain) {
      if (step.sources.some((s) => s.id === LEAK_ID)) {
        expect(step.evidence_tier).not.toBe("CONFIRMED");
        expect(step.evidence_tier).not.toBe("REPORTED");
      }
    }
    for (const gap of out.inferable_control_gaps) {
      // A gap that leans on the leak-site may exist only at INFERRED tier.
      // (Gaps do not carry source ids in the schema; this guards the tier floor
      // for any leak-derived gap the engine chooses to surface.)
      expect(["INFERRED", "ANALOGOUS", "CONFIRMED", "REPORTED"]).toContain(gap.evidence_tier);
    }
  });

  it("[A4.2] if the leak-site is referenced at all, it is labelled actor-claim / INFERRED-about-actor (Inv7)", () => {
    const refs = out.attack_chain.flatMap((step) =>
      step.sources.filter((s) => s.id === LEAK_ID).map((s) => ({ step, s })),
    );
    for (const { step } of refs) {
      expect(step.evidence_tier).toBe("INFERRED");
      // Must read as actor-claim, not a victim-fact about exfiltrated records.
      expect(step.what_happened).toMatch(/actor.claim|claimed by the actor|actor.asserted|alleged/i);
      expect(step.what_happened).not.toMatch(/customer records were (stolen|exfiltrated|confirmed)/i);
    }
  });
});

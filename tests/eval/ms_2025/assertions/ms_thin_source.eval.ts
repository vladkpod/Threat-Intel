/**
 * TC-2 — ms_thin_source
 * Fixture: sources_thin.json   Framework: CIS_v8
 *
 * Covers DoD #5 and Invariant 1 — a thin source must not produce a fabricated
 * chain. "Insufficient public evidence" is the correct, expected output.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { type ReconstructionOutput } from "@engine/schema";
import { runFixture } from "../helpers.js";

const CREDENTIAL_ACCESS_RE = /Credential Access|NTDS|credential|dump|hash/i;
const IMPACT_RE = /Impact|ESXi|encrypt|ransom/i;

describe("TC-2 ms_thin_source", () => {
  let out: ReconstructionOutput;
  beforeAll(() => {
    out = runFixture("sources_thin.json");
  });

  it("[A2.1] no CONFIRMED/REPORTED credential-access or impact steps from a thin source (DoD#5 / Inv1)", () => {
    const credentialSteps = out.attack_chain.filter(
      (s) => CREDENTIAL_ACCESS_RE.test(s.attack_tactic) || CREDENTIAL_ACCESS_RE.test(s.what_happened),
    );
    for (const s of credentialSteps) {
      expect(["INFERRED", "ANALOGOUS"]).toContain(s.evidence_tier);
    }

    const impactSteps = out.attack_chain.filter(
      (s) => IMPACT_RE.test(s.attack_tactic) || IMPACT_RE.test(s.what_happened),
    );
    for (const s of impactSteps) {
      expect(["INFERRED", "ANALOGOUS"]).toContain(s.evidence_tier);
    }
  });

  it("[A2.2] engine explicitly states insufficient evidence rather than filling gaps (DoD#5 / Inv1)", () => {
    const haystack = [
      out.incident.source_quality_note,
      ...out.attack_chain.map((s) => `${s.what_happened} ${s.insufficient_evidence_note ?? ""}`),
    ].join(" ");
    expect(haystack).toMatch(
      /insufficient public evidence for (credential.access|the credential|impact|the impact|[A-Za-z\s-]+ stage)/i,
    );
  });
});

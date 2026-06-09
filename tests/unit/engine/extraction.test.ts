/**
 * Stage 1 extraction — Invariant 1 enforcement tests.
 *
 * These tests are the CI-level guard that the M2 instruction called for:
 * "a CI test that fails the build if any extraction path can emit a step
 * lacking tier+provenance."
 *
 * Every step in the extraction output MUST have:
 *   - evidence_tier: a non-null EvidenceTier value
 *   - sources: at least one SourceRef (non-empty array)
 *   - corroboration: a valid object (independence_group_count >= 0)
 *
 * A step that violates any of these invariants represents fabrication — the
 * engine has claimed something without a supplied source.
 */
import { describe, it, expect } from "vitest";
import { reconstruct } from "@engine";
import type { ReconstructionOutput } from "@engine/schema";

/** Builds a minimal valid ReconstructionInput with the given sources. */
function makeInput(sources: {
  id: string;
  label: string;
  independence_group: string;
  tier_ceiling: string;
  primary: boolean;
  derivative_of: string | null;
  text: string;
}[]) {
  return {
    incident_name: "test-incident",
    framework: "CIS_v8",
    client_profile: null,
    incident_sources: sources.map((s) => ({
      ...s,
      proximity: "test",
      incentive_bias: null,
    })),
  };
}

describe("Invariant 1 — every emitted step anchors to a source (CI guard)", () => {
  it("produces no steps for a source with no technical content", () => {
    const out: ReconstructionOutput = reconstruct(
      makeInput([
        {
          id: "EMPTY",
          label: "Empty source",
          independence_group: "G4",
          tier_ceiling: "REPORTED",
          primary: true,
          derivative_of: null,
          text: "A cyberattack occurred. No further details are available.",
        },
      ]),
    );
    expect(out.attack_chain).toHaveLength(0);
  });

  it("every emitted step has a non-null evidence_tier", () => {
    const out: ReconstructionOutput = reconstruct(
      makeInput([
        {
          id: "S1",
          label: "Press source mentioning NTDS.dit",
          independence_group: "G4",
          tier_ceiling: "REPORTED",
          primary: true,
          derivative_of: null,
          text: "Attackers obtained a copy of the NTDS.dit Active Directory database.",
        },
      ]),
    );
    for (const step of out.attack_chain) {
      expect(step.evidence_tier).not.toBeNull();
      expect(["CONFIRMED", "REPORTED", "INFERRED", "ANALOGOUS"]).toContain(
        step.evidence_tier,
      );
    }
  });

  it("every emitted step has at least one source in sources[]", () => {
    const out: ReconstructionOutput = reconstruct(
      makeInput([
        {
          id: "S1",
          label: "Source mentioning help-desk reset",
          independence_group: "G1",
          tier_ceiling: "CONFIRMED",
          primary: true,
          derivative_of: null,
          text: "The attackers socially engineered the IT help desk into resetting credentials.",
        },
      ]),
    );
    for (const step of out.attack_chain) {
      expect(step.sources.length).toBeGreaterThan(0);
    }
  });

  it("excluded sources do not appear in any step's sources[]", () => {
    // B6 source for a victim_fact-pattern technique → must be excluded
    // and must not appear in the sources[] of victim-fact steps.
    const out: ReconstructionOutput = reconstruct(
      makeInput([
        {
          id: "LEGIT",
          label: "G4 press source",
          independence_group: "G4",
          tier_ceiling: "REPORTED",
          primary: true,
          derivative_of: null,
          text: "Attackers obtained the NTDS.dit Active Directory database.",
        },
        {
          id: "LEAK",
          label: "B6 leak-site",
          independence_group: "B6",
          tier_ceiling: "INFERRED",
          primary: false,
          derivative_of: null,
          text: "Leak site claims NTDS.dit was stolen from the organisation.",
        },
      ]),
    );
    // The NTDS step should exist, backed by LEGIT only.
    const ntdsStep = out.attack_chain.find(
      (s) => /NTDS|credential/i.test(s.what_happened),
    );
    expect(ntdsStep).toBeDefined();
    // LEAK (B6) for a victim_fact claim is excluded → must not appear in sources[]
    expect(ntdsStep!.sources.some((s) => s.id === "LEAK")).toBe(false);
  });

  it("B5 actor-pattern sources cap the tier at INFERRED (never raise above INFERRED)", () => {
    const out: ReconstructionOutput = reconstruct(
      makeInput([
        {
          id: "B5SRC",
          label: "CISA actor advisory",
          independence_group: "B5",
          tier_ceiling: "INFERRED",
          primary: true,
          derivative_of: null,
          text: "The actor is documented to obtain the NTDS.dit Active Directory database.",
        },
      ]),
    );
    for (const step of out.attack_chain) {
      expect(["INFERRED", "ANALOGOUS"]).toContain(step.evidence_tier);
    }
  });

  it("corroboration count does not increment within one independence group", () => {
    const out: ReconstructionOutput = reconstruct(
      makeInput([
        {
          id: "G4A",
          label: "Press source A",
          independence_group: "G4",
          tier_ceiling: "REPORTED",
          primary: true,
          derivative_of: null,
          text: "Attackers obtained the NTDS.dit Active Directory database.",
        },
        {
          id: "G4B",
          label: "Press source B (same group)",
          independence_group: "G4",
          tier_ceiling: "REPORTED",
          primary: true,
          derivative_of: null,
          text: "Sources confirm attackers obtained the NTDS.dit credential database.",
        },
      ]),
    );
    const ntds = out.attack_chain.find(
      (s) => /NTDS|credential/i.test(s.what_happened),
    );
    expect(ntds).toBeDefined();
    expect(ntds!.corroboration.independence_group_count).toBe(1);
  });

  it("negation pre-filter: 'no evidence of T1003' does not produce a credential-access step", () => {
    const out: ReconstructionOutput = reconstruct(
      makeInput([
        {
          id: "NEG",
          label: "Source with explicit negation",
          independence_group: "G4",
          tier_ceiling: "REPORTED",
          primary: true,
          derivative_of: null,
          text: "Investigators found no evidence of NTDS.dit credential dumping. There is no indication that Active Directory databases were accessed.",
        },
      ]),
    );
    const credStep = out.attack_chain.find(
      (s) => s.attack_technique === "T1003.003",
    );
    expect(credStep).toBeUndefined();
  });

  it("negation pre-filter: affirmative sentence still matches when negation is in a different sentence", () => {
    const out: ReconstructionOutput = reconstruct(
      makeInput([
        {
          id: "MIX",
          label: "Source with negation in one sentence, positive in another",
          independence_group: "G4",
          tier_ceiling: "REPORTED",
          primary: true,
          derivative_of: null,
          text: "Attackers obtained a copy of the NTDS.dit Active Directory database. There is no evidence of lateral movement to other domains.",
        },
      ]),
    );
    // NTDS.dit step should still be produced — the positive sentence is separate
    const credStep = out.attack_chain.find(
      (s) => s.attack_technique === "T1003.003",
    );
    expect(credStep).toBeDefined();
  });

  it("derivative echoes collapse to primary and do not each count", () => {
    const out: ReconstructionOutput = reconstruct(
      makeInput([
        {
          id: "PRIMARY",
          label: "BleepingComputer (primary)",
          independence_group: "G4",
          tier_ceiling: "REPORTED",
          primary: true,
          derivative_of: null,
          text: "Attackers obtained the NTDS.dit Active Directory database.",
        },
        {
          id: "ECHO",
          label: "Reuters (echo, cites BleepingComputer)",
          independence_group: "G4",
          tier_ceiling: "REPORTED",
          primary: false,
          derivative_of: "PRIMARY",
          text: "According to BleepingComputer, attackers obtained the NTDS.dit database.",
        },
      ]),
    );
    const ntds = out.attack_chain.find(
      (s) => /NTDS|credential/i.test(s.what_happened),
    );
    expect(ntds).toBeDefined();
    expect(ntds!.corroboration.independence_group_count).toBe(1);
    const echo = ntds!.sources.find((s) => s.id === "ECHO");
    expect(echo).toBeDefined();
    expect(echo!.corroboration_contribution).toBe(false);
    expect(echo!.collapsed_to).toBe("PRIMARY");
  });
});

/**
 * Unit tests for computeVerdict() — packages/engine/src/verdict.ts.
 *
 * Tests the four critical behavioral contracts:
 * (a) No client controls → indeterminate, caveat surfaced
 * (b) Matching prevent-axis control → would_likely_fail
 * (c) Matching detect-axis control → indeterminate, break_axis = "detect"
 * (d) Empty attack chain → indeterminate, no earliest_breakable_step
 * (e) Confidence capped at weakest tier on critical path (Invariant 9)
 * (f) Self-reported control triggers caveat (Invariant 6)
 */
import { describe, it, expect } from "vitest";
import { computeVerdict } from "../../../packages/engine/src/verdict.js";
import type {
  AttackChainStep,
  ClientProfile,
  SelfAssessmentEntry,
} from "../../../packages/engine/src/schema.js";

function makeStep(
  step: number,
  breakingControls: AttackChainStep["breaking_controls"],
  tier: AttackChainStep["evidence_tier"] = "CONFIRMED",
): AttackChainStep {
  return {
    step,
    attack_tactic: "Initial Access",
    attack_technique: "T0001",
    what_happened: "Attacker gained access",
    evidence_tier: tier,
    sources: [],
    corroboration: { independence_group_count: 1, groups: ["G1"] },
    breaking_controls: breakingControls,
    insufficient_evidence_note: null,
  };
}

const PREVENT_CTRL: AttackChainStep["breaking_controls"][number] = {
  axis: "prevent",
  description: "enforce multi-factor authentication requirement policy",
  framework_ref: "CIS-16.3",
  mapping_basis: "analyst-asserted",
};

const DETECT_CTRL: AttackChainStep["breaking_controls"][number] = {
  axis: "detect",
  description: "monitor and alert on anomalous login detection activity",
  framework_ref: "CIS-6.2",
  mapping_basis: "analyst-asserted",
};

const UNMATCHED_CTRL: AttackChainStep["breaking_controls"][number] = {
  axis: "prevent",
  description: "network segmentation isolating critical endpoints",
  framework_ref: "CIS-12.1",
  mapping_basis: "CTID-mapped",
};

describe("[VERDICT] computeVerdict", () => {
  it("(a) no client controls → indeterminate, caveat about no profile", () => {
    const steps = [makeStep(1, [PREVENT_CTRL])];
    const verdict = computeVerdict(steps, null, []);
    expect(verdict.result).toBe("indeterminate");
    expect(verdict.earliest_breakable_step).toBeNull();
    expect(verdict.break_axis).toBeNull();
    expect(verdict.caveats.some((c) => /no client control/i.test(c))).toBe(true);
  });

  it("(a2) client present but no controls match any step → indeterminate", () => {
    const steps = [makeStep(1, [UNMATCHED_CTRL])];
    const profile: ClientProfile = {
      controls_present: ["detect anomalous login monitoring alert"],
    };
    const verdict = computeVerdict(steps, profile, []);
    // Client has detect controls, breaking ctrl is prevent — no axis match → no break found
    expect(verdict.result).toBe("indeterminate");
    expect(verdict.earliest_breakable_step).toBeNull();
  });

  it("(b) matching prevent-axis control → would_likely_fail", () => {
    const steps = [makeStep(1, [PREVENT_CTRL])];
    const profile: ClientProfile = {
      controls_present: ["enforce multi-factor authentication require verification policy"],
    };
    const verdict = computeVerdict(steps, profile, []);
    expect(verdict.result).toBe("would_likely_fail");
    expect(verdict.earliest_breakable_step).toBe(1);
    expect(verdict.break_axis).toBe("prevent");
  });

  it("(c) matching detect-axis control → indeterminate, break_axis=detect", () => {
    const steps = [makeStep(1, [DETECT_CTRL])];
    const profile: ClientProfile = {
      controls_present: ["monitor detection alert anomalous login siem soc"],
    };
    const verdict = computeVerdict(steps, profile, []);
    expect(verdict.result).toBe("indeterminate");
    expect(verdict.earliest_breakable_step).toBe(1);
    expect(verdict.break_axis).toBe("detect");
  });

  it("(d) empty attack chain → indeterminate, no earliest_breakable_step", () => {
    const verdict = computeVerdict([], { controls_present: ["multi-factor authentication"] }, []);
    expect(verdict.result).toBe("indeterminate");
    expect(verdict.earliest_breakable_step).toBeNull();
    expect(verdict.break_axis).toBeNull();
  });

  it("(e) confidence capped at weakest tier on critical path (Invariant 9)", () => {
    const steps = [
      makeStep(1, [PREVENT_CTRL], "CONFIRMED"),
      makeStep(2, [DETECT_CTRL], "REPORTED"),
      makeStep(3, [UNMATCHED_CTRL], "INFERRED"),
    ];
    const profile: ClientProfile = {
      controls_present: ["enforce multi-factor authentication require verification policy"],
    };
    // Break at step 1 (prevent) — critical path is just step 1 (CONFIRMED)
    const verdict = computeVerdict(steps, profile, []);
    expect(verdict.earliest_breakable_step).toBe(1);
    expect(verdict.confidence).toBe("CONFIRMED");
  });

  it("(e2) no break — confidence capped by weakest step across full chain", () => {
    const steps = [
      makeStep(1, [UNMATCHED_CTRL], "CONFIRMED"),
      makeStep(2, [UNMATCHED_CTRL], "INFERRED"),
    ];
    const profile: ClientProfile = {
      controls_present: ["detect anomalous login monitoring alert"],
    };
    const verdict = computeVerdict(steps, profile, []);
    expect(verdict.earliest_breakable_step).toBeNull();
    expect(verdict.confidence).toBe("INFERRED");
  });

  it("(f) self-reported-only control triggers caveat (Invariant 6)", () => {
    const steps = [makeStep(1, [PREVENT_CTRL])];
    const profile: ClientProfile = {
      controls_present: ["enforce multi-factor authentication require verification policy"],
    };
    const selfAssessment: SelfAssessmentEntry[] = [
      {
        question: "Is MFA enforced?",
        maps_to_step: 1,
        framework_ref: "CIS-16.3",
        mapping_basis: "analyst-asserted",
        testability: "self-reported-only",
        resilient_looks_like: "MFA on all accounts",
        vulnerable_looks_like: "MFA optional or absent",
        evidence_tier_of_underlying_step: "CONFIRMED",
      },
    ];
    const verdict = computeVerdict(steps, profile, selfAssessment);
    expect(verdict.caveats.some((c) => /self-reported/i.test(c))).toBe(true);
  });

  it("earliest break is found at the right step across multi-step chain", () => {
    const steps = [
      makeStep(1, [UNMATCHED_CTRL]),  // client can't break this (axis mismatch)
      makeStep(2, [PREVENT_CTRL]),    // client CAN break this with prevent control
      makeStep(3, [DETECT_CTRL]),     // would also match but step 2 found first
    ];
    const profile: ClientProfile = {
      controls_present: ["enforce multi-factor authentication require verification policy"],
    };
    const verdict = computeVerdict(steps, profile, []);
    expect(verdict.earliest_breakable_step).toBe(2);
    expect(verdict.break_axis).toBe("prevent");
    expect(verdict.result).toBe("would_likely_fail");
  });
});

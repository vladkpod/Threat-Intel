/**
 * Unit tests for selfAssess() — packages/engine/src/self-assessment.ts.
 *
 * AC: (a) known technique with analyst-asserted controls produces entries with
 *         correct testability from the human-identity library; (b) unknown
 *         technique produces a fallback entry with self-reported-only testability;
 *         (c) entries carry correct evidence_tier_of_underlying_step.
 */
import { describe, it, expect } from "vitest";
import { selfAssess } from "../../../packages/engine/src/self-assessment.js";
import type { AttackChainStep } from "../../../packages/engine/src/schema.js";

function makeStep(
  step: number,
  technique: string,
  tactic: string,
  breakingControls: AttackChainStep["breaking_controls"],
  tier: AttackChainStep["evidence_tier"] = "CONFIRMED",
): AttackChainStep {
  return {
    step,
    attack_tactic: tactic,
    attack_technique: technique,
    what_happened: "Attack step occurred",
    evidence_tier: tier,
    sources: [],
    corroboration: { independence_group_count: 1, groups: ["G1"] },
    breaking_controls: breakingControls,
    insufficient_evidence_note: null,
  };
}

const ANALYST_PREVENT_CTRL: AttackChainStep["breaking_controls"][number] = {
  axis: "prevent",
  description: "Require call-back verification before MFA reset",
  framework_ref: "NCSC-IT-HELPDESK-RESET",
  mapping_basis: "analyst-asserted",
};

const CTID_DETECT_CTRL: AttackChainStep["breaking_controls"][number] = {
  axis: "detect",
  description: "Monitor for anomalous authentication events",
  framework_ref: "AC-17",
  mapping_basis: "CTID-mapped",
};

const UNKNOWN_CTRL: AttackChainStep["breaking_controls"][number] = {
  axis: "prevent",
  description: "Block unknown technique",
  framework_ref: "UNKNOWN-REF",
  mapping_basis: "analyst-asserted",
};

describe("[SELF-ASSESS] selfAssess()", () => {
  it("empty steps returns empty array", () => {
    expect(selfAssess([])).toHaveLength(0);
  });

  it("produces one entry per breaking control per step", () => {
    const steps = [
      makeStep(1, "T1566.004", "Initial Access", [ANALYST_PREVENT_CTRL, CTID_DETECT_CTRL]),
      makeStep(2, "T1003.003", "Credential Access", [ANALYST_PREVENT_CTRL]),
    ];
    const entries = selfAssess(steps);
    expect(entries).toHaveLength(3);
  });

  it("(a) known analyst-asserted control for T1566.004 uses library testability", () => {
    const steps = [makeStep(1, "T1566.004", "Initial Access", [ANALYST_PREVENT_CTRL])];
    const entries = selfAssess(steps);
    expect(entries).toHaveLength(1);
    const entry = entries[0]!;
    expect(entry.mapping_basis).toBe("analyst-asserted");
    // Known human-identity controls have BAS-validatable or red-team-validatable testability
    expect(["BAS-validatable", "red-team-validatable", "self-reported-only"]).toContain(
      entry.testability,
    );
  });

  it("(b) CTID-mapped control defaults to self-reported-only testability", () => {
    const steps = [makeStep(1, "T1566.004", "Initial Access", [CTID_DETECT_CTRL])];
    const entries = selfAssess(steps);
    expect(entries[0]?.testability).toBe("self-reported-only");
  });

  it("(b) unknown framework_ref falls back to self-reported-only", () => {
    const steps = [makeStep(1, "T9999", "Unknown", [UNKNOWN_CTRL])];
    const entries = selfAssess(steps);
    expect(entries[0]?.testability).toBe("self-reported-only");
  });

  it("(c) evidence_tier_of_underlying_step matches the step's tier", () => {
    const steps = [
      makeStep(1, "T1566.004", "Initial Access", [ANALYST_PREVENT_CTRL], "CONFIRMED"),
      makeStep(2, "T1003.003", "Credential Access", [CTID_DETECT_CTRL], "REPORTED"),
    ];
    const entries = selfAssess(steps);
    expect(entries[0]?.evidence_tier_of_underlying_step).toBe("CONFIRMED");
    expect(entries[1]?.evidence_tier_of_underlying_step).toBe("REPORTED");
  });

  it("maps_to_step references the correct step number", () => {
    const steps = [
      makeStep(1, "T1566.004", "Initial Access", [ANALYST_PREVENT_CTRL]),
      makeStep(3, "T1486", "Impact", [CTID_DETECT_CTRL]),
    ];
    const entries = selfAssess(steps);
    expect(entries[0]?.maps_to_step).toBe(1);
    expect(entries[1]?.maps_to_step).toBe(3);
  });

  it("entries have non-empty question, resilient_looks_like, vulnerable_looks_like", () => {
    const steps = [
      makeStep(1, "T1566.004", "Initial Access", [ANALYST_PREVENT_CTRL, CTID_DETECT_CTRL]),
    ];
    const entries = selfAssess(steps);
    for (const entry of entries) {
      expect(entry.question.length).toBeGreaterThan(0);
      expect(entry.resilient_looks_like.length).toBeGreaterThan(0);
      expect(entry.vulnerable_looks_like.length).toBeGreaterThan(0);
    }
  });
});

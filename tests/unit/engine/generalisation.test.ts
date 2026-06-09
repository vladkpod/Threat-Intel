/**
 * Unit tests for generalise() — packages/engine/src/generalisation.ts.
 *
 * AC: (a) empty chain produces empty pattern; (b) all steps produce
 * title/chain_summary without T-codes; (c) control gaps are well-formed.
 */
import { describe, it, expect } from "vitest";
import { generalise } from "../../../packages/engine/src/generalisation.js";
import type { AttackChainStep } from "../../../packages/engine/src/schema.js";

const TCODE_RE = /T\d{4}/;

function makeStep(
  step: number,
  technique: string,
  tactic: string,
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
    breaking_controls: [],
    insufficient_evidence_note: null,
  };
}

describe("[GENERALISE] generalise()", () => {
  it("(a) empty steps produces empty-pattern sentinel and no gaps", () => {
    const { pattern, gaps } = generalise([]);
    expect(pattern.title).toBeTruthy();
    expect(pattern.preconditions).toHaveLength(0);
    expect(pattern.chain_summary).toBeTruthy();
    expect(gaps).toHaveLength(0);
  });

  it("(b) single step produces pattern with title and chain_summary", () => {
    const { pattern } = generalise([makeStep(1, "T1566.004", "Initial Access")]);
    expect(pattern.title).toBeTruthy();
    expect(pattern.chain_summary).toBeTruthy();
    expect(pattern.preconditions.length).toBeGreaterThan(0);
  });

  it("(b) title and chain_summary contain no T-codes", () => {
    const steps = [
      makeStep(1, "T1566.004", "Initial Access"),
      makeStep(2, "T1003.003", "Credential Access"),
      makeStep(3, "T1486", "Impact"),
    ];
    const { pattern } = generalise(steps);
    expect(pattern.title).not.toMatch(TCODE_RE);
    expect(pattern.chain_summary).not.toMatch(TCODE_RE);
  });

  it("(b) single-step chain_summary uses '(single-stage)' form", () => {
    const { pattern } = generalise([makeStep(1, "T1566.004", "Initial Access")]);
    expect(pattern.chain_summary).toContain("single-stage");
  });

  it("(b) multi-step chain_summary references step count", () => {
    const steps = [
      makeStep(1, "T1566.004", "Initial Access"),
      makeStep(2, "T1003.003", "Credential Access"),
    ];
    const { pattern } = generalise(steps);
    expect(pattern.chain_summary).toContain("2-stage");
  });

  it("(c) gaps has one entry per step", () => {
    const steps = [
      makeStep(1, "T1566.004", "Initial Access"),
      makeStep(2, "T1003.003", "Credential Access"),
    ];
    const { gaps } = generalise(steps);
    expect(gaps).toHaveLength(2);
  });

  it("(c) gap text contains no T-codes for known techniques", () => {
    const { gaps } = generalise([makeStep(1, "T1566.004", "Initial Access")]);
    for (const gap of gaps) {
      expect(gap.gap).not.toMatch(TCODE_RE);
    }
  });

  it("(c) gap text contains no T-codes for unknown techniques (fallback template)", () => {
    const { gaps } = generalise([makeStep(1, "T9999", "Unknown Tactic")]);
    for (const gap of gaps) {
      expect(gap.gap).not.toMatch(TCODE_RE);
    }
  });

  it("(c) gap evidence_tier matches the originating step's tier", () => {
    const steps = [
      makeStep(1, "T1566.004", "Initial Access", "CONFIRMED"),
      makeStep(2, "T1003.003", "Credential Access", "REPORTED"),
    ];
    const { gaps } = generalise(steps);
    expect(gaps[0]?.evidence_tier).toBe("CONFIRMED");
    expect(gaps[1]?.evidence_tier).toBe("REPORTED");
  });

  it("(c) gap.supports_step references the correct step number", () => {
    const steps = [
      makeStep(1, "T1566.004", "Initial Access"),
      makeStep(2, "T1003.003", "Credential Access"),
    ];
    const { gaps } = generalise(steps);
    expect(gaps[0]?.supports_step).toEqual([1]);
    expect(gaps[1]?.supports_step).toEqual([2]);
  });

  it("preconditions are deduplicated across repeated techniques", () => {
    const steps = [
      makeStep(1, "T1566.004", "Initial Access"),
      makeStep(2, "T1566.004", "Initial Access"),
    ];
    const { pattern } = generalise(steps);
    const preconditionCount = pattern.preconditions.filter(
      (p) => p === pattern.preconditions[0],
    ).length;
    expect(preconditionCount).toBe(1);
  });
});

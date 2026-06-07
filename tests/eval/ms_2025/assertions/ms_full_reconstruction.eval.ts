/**
 * TC-1 — ms_full_reconstruction
 * Fixture: sources_full.json   Framework: CIS_v8
 *
 * Covers DoD #1–#4 and Invariants 2, 3, 4, 6, 9, 10.
 * Assertion IDs match the signed-off eval spec.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { TIER_RANK, type ReconstructionOutput } from "@engine/schema";
import {
  runFixture,
  filterSteps,
  findStep,
  weakestTier,
  HELPDESK_RE,
  NTDS_RE,
  ESXI_RE,
  VISHING_IMPERSONATION_RE,
} from "../helpers.js";

describe("TC-1 ms_full_reconstruction", () => {
  let out: ReconstructionOutput;
  beforeAll(() => {
    out = runFixture("sources_full.json");
  });

  it("[A1.1] help-desk vector is CONFIRMED, backed by an independent G1 or G2 source (DoD#1 / Inv2)", () => {
    const steps = filterSteps(out, HELPDESK_RE);
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      expect(step.evidence_tier).toBe("CONFIRMED");
      expect(
        step.sources.some(
          (s) => s.independence_group === "G1" || s.independence_group === "G2",
        ),
      ).toBe(true);
    }
  });

  it("[A1.2] NTDS.dit and ESXi specifics are REPORTED, never CONFIRMED (DoD#2 / Inv2)", () => {
    const ntds = filterSteps(out, NTDS_RE);
    const esxi = filterSteps(out, ESXI_RE);
    expect(ntds.length + esxi.length).toBeGreaterThan(0);
    for (const step of [...ntds, ...esxi]) {
      expect(step.evidence_tier).toBe("REPORTED");
      expect(step.evidence_tier).not.toBe("CONFIRMED");
    }
  });

  it("[A1.3] T1566.004 / T1656 breaking controls are analyst-asserted, not CTID-mapped (DoD#3 / Inv4)", () => {
    const steps = filterSteps(out, VISHING_IMPERSONATION_RE);
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      expect(step.breaking_controls.length).toBeGreaterThan(0);
      for (const ctrl of step.breaking_controls) {
        expect(ctrl.mapping_basis).toBe("analyst-asserted");
        expect(ctrl.mapping_basis).not.toBe("CTID-mapped");
      }
    }
  });

  it("[A1.4] self-assessment for the human-identity steps draws from the A2 library, analyst-asserted (DoD#3 / Inv4)", () => {
    const idSteps = filterSteps(out, VISHING_IMPERSONATION_RE).map((s) => s.step);
    const entries = out.self_assessment.filter((e) =>
      idSteps.includes(e.maps_to_step),
    );
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(e.mapping_basis).toBe("analyst-asserted");
      expect(e.framework_ref).toMatch(
        /NIST.?800-63|800-63[ABC]|NCSC.*(help.?desk|MFA|reset)|CISA.*(MFA|help.?desk|reset)/i,
      );
    }
  });

  it("[A1.5] earliest break is computed across prevent/detect/respond, not prevention only (DoD#4 / Inv3)", () => {
    // Every step carries breaking controls, and the helpdesk step has both a
    // prevent and a detect option available.
    for (const step of out.attack_chain) {
      expect(step.breaking_controls.length).toBeGreaterThan(0);
    }
    const helpdesk = findStep(out, HELPDESK_RE);
    expect(helpdesk).toBeDefined();
    const axes = new Set(helpdesk!.breaking_controls.map((c) => c.axis));
    expect(axes.has("prevent")).toBe(true);
    expect(axes.has("detect")).toBe(true);

    // The verdict's method references all three axes, and the break can be
    // achieved on a detect/respond axis — not prevention exclusively.
    expect(out.verdict.method).toMatch(/prevent/i);
    expect(out.verdict.method).toMatch(/detect/i);
    expect(out.verdict.method).toMatch(/respond/i);
    if (out.verdict.earliest_breakable_step !== null) {
      expect(out.verdict.break_axis).not.toBeNull();
      expect(["prevent", "detect", "respond"]).toContain(out.verdict.break_axis);
    }

    // This client only has detect-axis controls (IdP anomaly / MFA-enrolment
    // alerting). The chain must still register a break via the detect axis.
    if (out.verdict.earliest_breakable_step !== null) {
      expect(out.verdict.break_axis).toBe("detect");
    }
  });

  it("[A1.6] every self-assessment entry carries a testability flag; self-report reliance is surfaced in the verdict (Inv6)", () => {
    expect(out.self_assessment.length).toBeGreaterThan(0);
    for (const e of out.self_assessment) {
      expect([
        "BAS-validatable",
        "red-team-validatable",
        "self-reported-only",
      ]).toContain(e.testability);
    }
    if (out.self_assessment.some((e) => e.testability === "self-reported-only")) {
      expect(out.verdict.caveats.some((c) => /self.report/i.test(c))).toBe(true);
    }
  });

  it("[A1.7] verdict confidence is capped at the weakest tier on the critical path (Inv9)", () => {
    const breakStep = out.verdict.earliest_breakable_step ?? out.attack_chain.length;
    const criticalPath = out.attack_chain.filter((s) => s.step <= breakStep);
    expect(criticalPath.length).toBeGreaterThan(0);
    const weakest = weakestTier(criticalPath.map((s) => s.evidence_tier));

    expect(TIER_RANK[out.verdict.confidence]).toBeLessThanOrEqual(TIER_RANK[weakest]);

    // Concretely: the NTDS.dit step (REPORTED) is on the path, so confidence
    // must not be stated as CONFIRMED.
    if (criticalPath.some((s) => s.evidence_tier === "REPORTED")) {
      expect(out.verdict.confidence).not.toBe("CONFIRMED");
    }
  });

  it("[A1.8] no numeric control-count coverage metric anywhere in the output (Inv3)", () => {
    const blob = JSON.stringify(out);
    expect(blob).not.toMatch(/"coverage_score"\s*:/);
    expect(blob).not.toMatch(/"control_count"\s*:/);
    expect(blob).not.toMatch(/"coverage_percentage"\s*:/);
    const proseFields = [
      out.incident.summary,
      out.incident.source_quality_note,
      ...out.inferable_control_gaps.map((g) => g.gap),
    ];
    for (const text of proseFields) {
      expect(text).not.toMatch(
        /\d+\s*(controls?|safeguards?|measures?)\s*(map|cover|address)/i,
      );
    }
  });

  it("[A1.9] no named-company failings asserted as fact; phrased as inference (Inv10)", () => {
    for (const g of out.inferable_control_gaps) {
      expect(g.gap).not.toMatch(/M&S\s+(failed|did not|didn'?t|lacked|neglected|ignored)/i);
      expect(g.gap).not.toMatch(/Marks\s*(&|and)\s*Spencer\s+(failed|did not|didn'?t|lacked|neglected|ignored)/i);
      expect(g.gap).toMatch(
        /(inferable from|inferred from|suggests|consistent with|implies|observable from|observed chain)/i,
      );
    }
    const proseFields = [
      out.incident.summary,
      out.incident.source_quality_note,
      ...out.self_assessment.map((e) => e.vulnerable_looks_like),
    ];
    for (const text of proseFields) {
      expect(text).not.toMatch(/M&S\s+(failed|neglected|ignored)/i);
    }
  });
});

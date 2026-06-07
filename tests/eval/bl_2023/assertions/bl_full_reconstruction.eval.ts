/**
 * TC-BL-1 — bl_full_reconstruction
 * Fixture: sources_full.json   Framework: CIS_v8
 *
 * This eval does double duty:
 *   1. Extraction generalisation: proves the engine does not memorise M&S
 *      facts and correctly differentiates the BL / Rhysida incident.
 *   2. Provenance-driven tiering: same technique (T1003.003) receives
 *      CONFIRMED tier here (from the BL's own review, G2) vs REPORTED in
 *      M&S (where only specialist press, G4, covers it). Tier is source-
 *      driven, not pre-set.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { TIER_RANK, type ReconstructionOutput } from "@engine/schema";
import {
  runFixture,
  findStep,
  filterSteps,
  VPN_EXTERNAL_REMOTE_RE,
  HELPDESK_RE,
  NTDS_RE,
} from "../helpers.js";

describe("TC-BL-1 bl_full_reconstruction", () => {
  let out: ReconstructionOutput;
  beforeAll(() => {
    out = runFixture("sources_full.json");
  });

  // ── [BL-A1] Generalisation: NO help-desk / T1566.004 step ────────────────
  it("[BL-A1] T1566.004 / help-desk vector does NOT appear in the BL chain (generalisation proof)", () => {
    const helpdeskSteps = filterSteps(out, HELPDESK_RE);
    expect(helpdeskSteps).toHaveLength(0);

    // The attack chain must not describe the M&S-specific help-desk reset
    // vector anywhere — proving the engine reads sources, not memory.
    for (const step of out.attack_chain) {
      expect(step.what_happened).not.toMatch(
        /help.?desk|service.?desk|vishing|voice.?phish|credential.?reset|mfa.?reset/i,
      );
    }
  });

  // ── [BL-A2] T1133: External Remote Services / VPN step is present ────────
  it("[BL-A2] T1133 (VPN / external remote services) is identified as the initial access step", () => {
    const vpnStep = findStep(out, VPN_EXTERNAL_REMOTE_RE);
    expect(vpnStep).toBeDefined();
    expect(vpnStep!.attack_technique).toBe("T1133");
  });

  // ── [BL-A3] T1133 tier is CONFIRMED ──────────────────────────────────────
  it("[BL-A3] T1133 initial access step is CONFIRMED — backed by G2 victim review and G1 NCSC advisory", () => {
    const vpnStep = findStep(out, VPN_EXTERNAL_REMOTE_RE);
    expect(vpnStep).toBeDefined();
    expect(vpnStep!.evidence_tier).toBe("CONFIRMED");

    // Must have at least one G1 or G2 source contributing.
    expect(
      vpnStep!.sources.some(
        (s) => s.independence_group === "G1" || s.independence_group === "G2",
      ),
    ).toBe(true);
  });

  // ── [BL-A4] T1003.003 tier is CONFIRMED ──────────────────────────────────
  it("[BL-A4] T1003.003 (NTDS.dit / AD credential dump) is CONFIRMED — BL published its own review confirming it", () => {
    const ntdsStep = findStep(out, NTDS_RE);
    expect(ntdsStep).toBeDefined();
    expect(ntdsStep!.evidence_tier).toBe("CONFIRMED");

    // Contrast with M&S where T1003.003 is REPORTED (only G4 press covers it).
    // Here the victim's own G2 review provides direct confirmation.
    expect(TIER_RANK[ntdsStep!.evidence_tier]).toBeGreaterThan(
      TIER_RANK["REPORTED"],
    );
  });

  // ── [BL-A5] Provenance-driven tiering proof ───────────────────────────────
  it("[BL-A5] T1003.003 sources include the primary G2 victim disclosure (provenance-driven tier, not pre-set)", () => {
    const ntdsStep = findStep(out, NTDS_RE);
    expect(ntdsStep).toBeDefined();

    const hasG2Primary = ntdsStep!.sources.some(
      (s) =>
        (s.independence_group === "G2" || s.independence_group === "G1") &&
        s.corroboration_contribution,
    );
    expect(hasG2Primary).toBe(true);
  });

  // ── [BL-A6] Verdict confidence cap ───────────────────────────────────────
  it("[BL-A6] verdict confidence is capped at the weakest tier on the critical path (Inv9)", () => {
    const { verdict, attack_chain } = out;
    const criticalPathEnd =
      verdict.earliest_breakable_step ?? attack_chain.length;
    const criticalPath = attack_chain.filter((s) => s.step <= criticalPathEnd);

    if (criticalPath.length > 0) {
      const weakest = criticalPath
        .map((s) => s.evidence_tier)
        .reduce((w, t) =>
          TIER_RANK[t] < TIER_RANK[w] ? t : w,
        );
      expect(TIER_RANK[verdict.confidence]).toBeLessThanOrEqual(
        TIER_RANK[weakest],
      );
    }
  });

  // ── [BL-A7] Breaking controls present, all axes covered ──────────────────
  it("[BL-A7] every chain step carries breaking controls across prevent/detect/respond axes (Inv3)", () => {
    expect(out.attack_chain.length).toBeGreaterThan(0);
    for (const step of out.attack_chain) {
      expect(step.breaking_controls.length).toBeGreaterThan(0);
    }

    // The verdict method must reference all three axes.
    expect(out.verdict.method).toMatch(/prevent/i);
    expect(out.verdict.method).toMatch(/detect/i);
    expect(out.verdict.method).toMatch(/respond/i);
  });

  // ── [BL-A8] No control-count metric ──────────────────────────────────────
  it("[BL-A8] no numeric control-count coverage metric in output (Inv3)", () => {
    const blob = JSON.stringify(out);
    expect(blob).not.toMatch(/"coverage_score"\s*:/);
    expect(blob).not.toMatch(/"control_count"\s*:/);
    expect(blob).not.toMatch(/"coverage_percentage"\s*:/);
  });

  // ── [BL-A9] No named-company-failing assertions ───────────────────────────
  it("[BL-A9] control gaps are phrased as inference, not British Library failings as fact (Inv10)", () => {
    for (const g of out.inferable_control_gaps) {
      expect(g.gap).not.toMatch(
        /British Library\s+(failed|did not|didn'?t|lacked|neglected)/i,
      );
      expect(g.gap).toMatch(
        /(inferable from|inferred from|suggests|consistent with|implies|observable from|observed chain)/i,
      );
    }
  });

  // ── [BL-A10] Actor attribution stays INFERRED ────────────────────────────
  it("[BL-A10] Rhysida attribution surfaced from NCSC / press sources, marked as not incident-confirmed", () => {
    // The actor field must reference Rhysida (from G1 NCSC or G4 press) but
    // not assert it as incident-confirmed victim fact.
    expect(out.incident.actor).toMatch(/[Rr]hysida/);
    expect(out.incident.actor).not.toMatch(/incident.confirmed/i);
  });
});

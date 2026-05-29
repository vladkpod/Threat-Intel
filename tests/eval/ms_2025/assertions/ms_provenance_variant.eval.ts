/**
 * TC-6 — ms_provenance_variant  (gating item 1)
 * Fixtures: provenance_variant_a.json + provenance_variant_b.json
 *
 * Anti-false-assurance probe. The same two claims (help-desk reset, NTDS.dit
 * theft) appear in both fixtures with SWAPPED provenance. A correct engine tiers
 * each claim from the provenance SUPPLIED in the request, so the tiers swap
 * between A and B. An engine that has merely memorised the M&S "answer"
 * (help-desk always CONFIRMED, NTDS always REPORTED) passes one variant and
 * fails the other — which is exactly the failure this pair exists to catch.
 *
 * Invariants exercised: 1 (no parametric facts — tier must track supplied
 * source, not training knowledge) and 2 (per-claim tiering).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { type ReconstructionOutput } from "@engine/schema";
import { runFixture, findStep, HELPDESK_RE, NTDS_RE } from "../helpers.js";

describe("TC-6 ms_provenance_variant", () => {
  let a: ReconstructionOutput;
  let b: ReconstructionOutput;
  beforeAll(() => {
    a = runFixture("provenance_variant_a.json");
    b = runFixture("provenance_variant_b.json");
  });

  it("[A6.1] variant A: help-desk (press-only) is REPORTED, NTDS.dit (authoritative) is CONFIRMED", () => {
    const hd = findStep(a, HELPDESK_RE);
    const ntds = findStep(a, NTDS_RE);
    expect(hd).toBeDefined();
    expect(ntds).toBeDefined();
    expect(hd!.evidence_tier).toBe("REPORTED");
    expect(ntds!.evidence_tier).toBe("CONFIRMED");
  });

  it("[A6.2] variant B: help-desk (authoritative) is CONFIRMED, NTDS.dit (press-only) is REPORTED", () => {
    const hd = findStep(b, HELPDESK_RE);
    const ntds = findStep(b, NTDS_RE);
    expect(hd).toBeDefined();
    expect(ntds).toBeDefined();
    expect(hd!.evidence_tier).toBe("CONFIRMED");
    expect(ntds!.evidence_tier).toBe("REPORTED");
  });

  it("[A6.3] the two claims' tiers are inverted between the variants (provenance, not the fact, drives the tier)", () => {
    const hdA = findStep(a, HELPDESK_RE)!.evidence_tier;
    const hdB = findStep(b, HELPDESK_RE)!.evidence_tier;
    const ntdsA = findStep(a, NTDS_RE)!.evidence_tier;
    const ntdsB = findStep(b, NTDS_RE)!.evidence_tier;
    expect(hdA).not.toBe(hdB);
    expect(ntdsA).not.toBe(ntdsB);
    // The help-desk claim in A shares its tier with the NTDS claim in B, and
    // vice-versa — the mark of provenance-driven (not fact-driven) tiering.
    expect(hdA).toBe(ntdsB);
    expect(ntdsA).toBe(hdB);
  });
});

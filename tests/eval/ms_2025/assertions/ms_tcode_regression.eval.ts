/**
 * TC-TCODE — T-code regression assertion.
 *
 * Verifies that no string matching /T\d{4}/ appears in UI-visible prose fields
 * of the M&S reconstruction output. If a T-code is reintroduced in engine prose,
 * this test fails before it reaches users.
 *
 * Fields checked: what_happened, generalised_pattern.title,
 * generalised_pattern.chain_summary, breaking_controls[].description,
 * self_assessment[*].question, verdict.method, gap messages.
 */
import { describe, it, expect, beforeAll } from "vitest";
import type { ReconstructionOutput } from "@engine/schema";
import { runFixture } from "../helpers.js";

const TCODE_RE = /T\d{4}/;

describe("TC-TCODE ms_tcode_regression", () => {
  let out: ReconstructionOutput;
  beforeAll(() => {
    out = runFixture("sources_full.json");
  });

  it("[TCODE.1] what_happened fields contain no T-codes", () => {
    for (const step of out.attack_chain) {
      expect(step.what_happened).not.toMatch(TCODE_RE);
    }
  });

  it("[TCODE.2] generalised_pattern.title contains no T-codes", () => {
    if (out.generalised_pattern?.title) {
      expect(out.generalised_pattern.title).not.toMatch(TCODE_RE);
    }
  });

  it("[TCODE.3] generalised_pattern.chain_summary contains no T-codes", () => {
    if (out.generalised_pattern?.chain_summary) {
      expect(out.generalised_pattern.chain_summary).not.toMatch(TCODE_RE);
    }
  });

  it("[TCODE.4] breaking_controls descriptions contain no T-codes", () => {
    for (const step of out.attack_chain) {
      for (const ctrl of step.breaking_controls) {
        expect(ctrl.description).not.toMatch(TCODE_RE);
      }
    }
  });

  it("[TCODE.5] self_assessment questions contain no T-codes", () => {
    for (const entry of out.self_assessment) {
      expect(entry.question).not.toMatch(TCODE_RE);
    }
  });

  it("[TCODE.6] verdict method contains no T-codes", () => {
    expect(out.verdict.method).not.toMatch(TCODE_RE);
  });

  it("[TCODE.7] verdict caveats contain no T-codes", () => {
    for (const caveat of out.verdict.caveats) {
      expect(caveat).not.toMatch(TCODE_RE);
    }
  });
});

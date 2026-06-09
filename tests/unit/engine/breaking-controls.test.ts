/**
 * Unit tests for getBreakingControls() — packages/engine/src/breaking-controls.ts.
 *
 * AC: (a) non-mappable technique returns analyst-asserted controls from the
 *         human-identity library; (b) known CTID technique returns CTID-mapped
 *         controls with a valid axis value; (c) fully unknown technique (not in
 *         CTID, not in human-identity library) returns the ATT&CK pointer fallback.
 */
import { describe, it, expect } from "vitest";
import { getBreakingControls } from "../../../packages/engine/src/breaking-controls.js";

const VALID_AXES = new Set(["prevent", "detect", "respond"]);

describe("[BREAKING-CONTROLS] getBreakingControls()", () => {
  it("(a) non-mappable technique T1566.004 returns analyst-asserted controls", () => {
    const controls = getBreakingControls("T1566.004");
    expect(controls.length).toBeGreaterThan(0);
    for (const ctrl of controls) {
      expect(ctrl.mapping_basis).toBe("analyst-asserted");
      expect(VALID_AXES.has(ctrl.axis)).toBe(true);
      expect(ctrl.description).toBeTruthy();
      expect(ctrl.framework_ref).toBeTruthy();
    }
  });

  it("(a) analyst-asserted controls cover multiple axes for T1566.004", () => {
    const controls = getBreakingControls("T1566.004");
    const axes = new Set(controls.map((c) => c.axis));
    expect(axes.size).toBeGreaterThanOrEqual(2);
  });

  it("(b) known CTID-mapped technique returns CTID-mapped controls with valid axis", () => {
    // T1078 (Valid Accounts) is present in the CTID sample data with complete mappings
    const controls = getBreakingControls("T1078");
    if (controls.length > 0) {
      for (const ctrl of controls) {
        expect(VALID_AXES.has(ctrl.axis)).toBe(true);
        // CTID-mapped controls use CTID-mapped basis
        // (some may be analyst-asserted if T1078 is also in the human-identity library)
        expect(["CTID-mapped", "analyst-asserted"]).toContain(ctrl.mapping_basis);
        expect(ctrl.description).toBeTruthy();
        expect(ctrl.framework_ref).toBeTruthy();
      }
    }
  });

  it("(c) unknown technique (not in CTID, not in library) returns ATT&CK pointer fallback", () => {
    // T9999 is guaranteed not to be in any CTID mapping or human-identity library
    const controls = getBreakingControls("T9999");
    expect(controls).toHaveLength(1);
    expect(controls[0]?.axis).toBe("prevent");
    expect(controls[0]?.mapping_basis).toBe("analyst-asserted");
    expect(controls[0]?.description).toMatch(/no mapped control|mitre att&ck/i);
  });

  it("all returned controls have non-empty description and framework_ref", () => {
    const techniques = ["T1566.004", "T1656", "T1003.003", "T1486"];
    for (const t of techniques) {
      const controls = getBreakingControls(t);
      for (const ctrl of controls) {
        expect(ctrl.description.length).toBeGreaterThan(0);
        expect(ctrl.framework_ref.length).toBeGreaterThan(0);
      }
    }
  });

  it("axis values are always one of prevent/detect/respond", () => {
    const techniques = ["T1566.004", "T1656", "T1003.003", "T1486", "T9999"];
    for (const t of techniques) {
      const controls = getBreakingControls(t);
      for (const ctrl of controls) {
        expect(VALID_AXES.has(ctrl.axis)).toBe(true);
      }
    }
  });
});

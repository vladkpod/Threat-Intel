/**
 * §B7 corroboration — Invariant 5.
 * The headline requirement: the corroboration counter does NOT increment within
 * one independence group.
 */
import { describe, it, expect } from "vitest";
import {
  computeCorroboration,
  type ClaimSourceInput,
} from "@registry";

function victimFact(
  external_id: string,
  group: ClaimSourceInput["independence_group"],
  extra: Partial<ClaimSourceInput> = {},
): ClaimSourceInput {
  return {
    external_id,
    independence_group: group,
    is_primary: true,
    derivative_of: null,
    admitted_as: "victim_fact",
    ir_firm: null,
    ...extra,
  };
}

describe("computeCorroboration (§B7)", () => {
  it("does NOT increment within a single independence group", () => {
    const r = computeCorroboration([
      victimFact("A", "G1"),
      victimFact("B", "G1"),
      victimFact("C", "G1"),
    ]);
    expect(r.count).toBe(1);
    expect(r.groups).toEqual(["G1"]);
    expect(r.perSource.filter((p) => p.corroboration_contribution)).toHaveLength(1);
  });

  it("increments across different groups G1–G4", () => {
    expect(computeCorroboration([victimFact("A", "G1"), victimFact("B", "G2")]).count).toBe(2);
    expect(
      computeCorroboration([
        victimFact("A", "G1"),
        victimFact("B", "G2"),
        victimFact("C", "G4"),
      ]).count,
    ).toBe(3);
  });

  it("collapses derivative echoes to their primary (one-primary-many-echoes => 1)", () => {
    const r = computeCorroboration([
      victimFact("PRIMARY", "G4"),
      victimFact("ECHO1", "G4", { is_primary: false, derivative_of: "PRIMARY" }),
      victimFact("ECHO2", "G4", { is_primary: false, derivative_of: "PRIMARY" }),
      victimFact("ECHO3", "G4", { is_primary: false, derivative_of: "PRIMARY" }),
    ]);
    expect(r.count).toBe(1);
    const echoes = r.perSource.filter((p) => p.external_id.startsWith("ECHO"));
    expect(echoes.every((e) => e.corroboration_contribution === false)).toBe(true);
    expect(echoes.every((e) => e.collapsed_to === "PRIMARY")).toBe(true);
  });

  it("counts ≥2 different IR firms within G3 as genuine corroboration", () => {
    const twoFirms = computeCorroboration([
      victimFact("M", "G3", { ir_firm: "Mandiant" }),
      victimFact("C", "G3", { ir_firm: "CrowdStrike" }),
    ]);
    expect(twoFirms.count).toBe(2);

    const sameFirmTwice = computeCorroboration([
      victimFact("M1", "G3", { ir_firm: "Mandiant" }),
      victimFact("M2", "G3", { ir_firm: "Mandiant" }),
    ]);
    expect(sameFirmTwice.count).toBe(1);
  });

  it("never corroborates from actor-pattern / leak sources or excluded sources", () => {
    const r = computeCorroboration([
      victimFact("PRESS", "G4"),
      { external_id: "ADV", independence_group: "B5", is_primary: true, derivative_of: null, admitted_as: "actor_inferred" },
      { external_id: "LEAK", independence_group: "B6", is_primary: false, derivative_of: null, admitted_as: "excluded" },
    ]);
    expect(r.count).toBe(1);
    expect(r.groups).toEqual(["G4"]);
  });
});

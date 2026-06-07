/**
 * Claim tiering — Invariants 1 & 2.
 * Actor-pattern / leak (actor_inferred) sources can never lift a victim-fact
 * claim above INFERRED; excluded sources contribute nothing.
 */
import { describe, it, expect } from "vitest";
import { computeTier } from "@registry";

describe("computeTier", () => {
  it("takes the strongest admissible tier", () => {
    expect(
      computeTier([
        { tier_ceiling: "REPORTED", admitted_as: "victim_fact" },
        { tier_ceiling: "CONFIRMED", admitted_as: "victim_fact" },
      ]).tier,
    ).toBe("CONFIRMED");
  });

  it("caps actor_inferred sources at INFERRED", () => {
    expect(
      computeTier([{ tier_ceiling: "CONFIRMED", admitted_as: "actor_inferred" }]).tier,
    ).toBe("INFERRED");
  });

  it("an actor advisory cannot raise a press-REPORTED claim to CONFIRMED", () => {
    expect(
      computeTier([
        { tier_ceiling: "REPORTED", admitted_as: "victim_fact" },
        { tier_ceiling: "CONFIRMED", admitted_as: "actor_inferred" },
      ]).tier,
    ).toBe("REPORTED");
  });

  it("ignores excluded sources and returns null when nothing admissible remains", () => {
    expect(
      computeTier([{ tier_ceiling: "CONFIRMED", admitted_as: "excluded" }]).tier,
    ).toBeNull();
  });
});

/**
 * §B8 admissibility — Invariant 7.
 * The headline requirement: leak-site content is rejected as victim-fact.
 */
import { describe, it, expect } from "vitest";
import { admitForClaim, baseAdmissibility } from "@registry";

describe("admitForClaim (§B8)", () => {
  it("rejects criminal leak-site content as victim-fact", () => {
    expect(admitForClaim("B6", "leak-site", "victim_fact")).toBe("excluded");
    expect(admitForClaim("B6", null, "victim_fact")).toBe("excluded");
  });

  it("permits leak-site content only as INFERRED-about-actor", () => {
    expect(admitForClaim("B6", "leak-site", "actor")).toBe("actor_inferred");
  });

  it("rejects raw stolen data as victim-fact regardless of group", () => {
    expect(admitForClaim("G4", "stolen-data", "victim_fact")).toBe("excluded");
  });

  it("admits actor-pattern advisories only as actor_inferred", () => {
    expect(admitForClaim("B5", "actor-advisory", "victim_fact")).toBe("actor_inferred");
    expect(admitForClaim("B5", "actor-advisory", "actor")).toBe("actor_inferred");
  });

  it("excludes SEO farms / social / rumour outright", () => {
    expect(admitForClaim("G4", "seo-farm", "victim_fact")).toBe("excluded");
    expect(admitForClaim("G4", "social", "victim_fact")).toBe("excluded");
    expect(admitForClaim("G4", "rumour", "victim_fact")).toBe("excluded");
  });

  it("admits G1–G4 official/press/IR sources as victim-fact", () => {
    expect(admitForClaim("G1", "government", "victim_fact")).toBe("victim_fact");
    expect(admitForClaim("G2", "victim-disclosure", "victim_fact")).toBe("victim_fact");
    expect(admitForClaim("G3", "ir-firm", "victim_fact")).toBe("victim_fact");
    expect(admitForClaim("G4", "specialist-press", "victim_fact")).toBe("victim_fact");
  });
});

describe("baseAdmissibility", () => {
  it("reflects the strongest role a source could play", () => {
    expect(baseAdmissibility("G1", "government")).toBe("victim_fact");
    expect(baseAdmissibility("B5", "actor-advisory")).toBe("actor_inferred");
    expect(baseAdmissibility("B6", "leak-site")).toBe("actor_inferred");
    expect(baseAdmissibility("G4", "seo-farm")).toBe("excluded");
  });
});

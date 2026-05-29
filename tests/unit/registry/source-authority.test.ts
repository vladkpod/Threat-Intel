/**
 * Source & Authority Registry (Part B) — independence-group and incentive-bias
 * tagging (§B1–B7).
 */
import { describe, it, expect } from "vitest";
import { classifySource, SOURCE_REGISTRY, DEFAULT_ENTRY } from "@registry";

describe("classifySource", () => {
  it("tags known sources with the correct independence group", () => {
    expect(classifySource(["bleepingcomputer.com"]).independence_group).toBe("G4");
    expect(classifySource(["ncsc.gov.uk"]).independence_group).toBe("G1");
    expect(classifySource(["cybermonitoringcentre.com"]).independence_group).toBe("G1");
    expect(classifySource(["sec.gov/edgar"]).independence_group).toBe("G2");
    expect(classifySource(["mandiant.com"]).independence_group).toBe("G3");
    expect(classifySource(["ransomware.live"]).independence_group).toBe("B6");
  });

  it("marks specialist press as primary and majors as derivative-leaning", () => {
    expect(classifySource(["bleepingcomputer.com"]).is_primary).toBe(true);
    expect(classifySource(["reuters.com"]).is_primary).toBe(false);
  });

  it("falls back to a conservative default for unknown sources", () => {
    const entry = classifySource(["some-random-blog.example"]);
    expect(entry).toBe(DEFAULT_ENTRY);
    expect(entry.is_primary).toBe(false);
    expect(entry.source_class).toBe("rumour");
  });

  it("every registry entry carries an incentive-bias tag", () => {
    for (const entry of SOURCE_REGISTRY) {
      expect(entry.incentive_bias.length).toBeGreaterThan(0);
    }
  });
});

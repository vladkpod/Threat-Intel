/**
 * Unit tests for schema input bounds — packages/engine/src/schema.ts.
 *
 * Verifies that oversized payloads are rejected by Zod before reaching
 * the engine. These tests act as a regression guard for the DoS mitigations
 * added in the input-length-validation task.
 */
import { describe, it, expect } from "vitest";
import { ReconstructionInput, SourceDocument } from "../../../packages/engine/src/schema.js";

const VALID_SOURCE = {
  id: "s1",
  label: "Test Source",
  independence_group: "G1" as const,
  tier_ceiling: "CONFIRMED" as const,
  proximity: "direct",
  primary: true,
  derivative_of: null,
  incentive_bias: null,
  text: "Normal source text",
};

const VALID_INPUT = {
  incident_name: "Test Incident",
  incident_sources: [VALID_SOURCE],
};

describe("[SCHEMA.BOUNDS] ReconstructionInput size limits", () => {
  it("rejects SourceDocument.text exceeding 100 KB", () => {
    const oversizedText = "x".repeat(100_001);
    expect(() =>
      SourceDocument.parse({ ...VALID_SOURCE, text: oversizedText }),
    ).toThrow();
  });

  it("accepts SourceDocument.text exactly at 100 KB", () => {
    const maxText = "x".repeat(100_000);
    expect(() =>
      SourceDocument.parse({ ...VALID_SOURCE, text: maxText }),
    ).not.toThrow();
  });

  it("rejects incident_sources array exceeding 100 items", () => {
    const sources = Array.from({ length: 101 }, (_, i) => ({
      ...VALID_SOURCE,
      id: `s${i}`,
    }));
    expect(() =>
      ReconstructionInput.parse({ ...VALID_INPUT, incident_sources: sources }),
    ).toThrow();
  });

  it("accepts incident_sources array of exactly 100 items", () => {
    const sources = Array.from({ length: 100 }, (_, i) => ({
      ...VALID_SOURCE,
      id: `s${i}`,
    }));
    expect(() =>
      ReconstructionInput.parse({ ...VALID_INPUT, incident_sources: sources }),
    ).not.toThrow();
  });

  it("rejects empty incident_sources array", () => {
    expect(() =>
      ReconstructionInput.parse({ ...VALID_INPUT, incident_sources: [] }),
    ).toThrow();
  });

  it("rejects incident_name exceeding 256 characters", () => {
    const longName = "x".repeat(257);
    expect(() =>
      ReconstructionInput.parse({ ...VALID_INPUT, incident_name: longName }),
    ).toThrow();
  });

  it("rejects empty incident_name", () => {
    expect(() =>
      ReconstructionInput.parse({ ...VALID_INPUT, incident_name: "" }),
    ).toThrow();
  });
});

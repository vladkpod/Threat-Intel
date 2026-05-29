/**
 * CTID ATT&CK↔800-53 loader, parsed against the REAL Mappings Explorer JSON
 * Unified Schema (sample trimmed from the pinned release). Verifies the
 * non_mappable detection that the human-identity fallback (Invariant 4) relies
 * on, and that the version is pinned.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { CtidMappings, CTID_PIN } from "@registry";

const SAMPLE = fileURLToPath(
  new URL(
    "../../../packages/registry/data/ctid/sample_nist_800_53-rev5_attack-16.1.json",
    import.meta.url,
  ),
);

function load(): CtidMappings {
  return CtidMappings.fromJson(readFileSync(SAMPLE, "utf8"));
}

describe("CtidMappings (Unified Schema)", () => {
  it("parses the real format and links technique -> control", () => {
    const m = load();
    const t1003 = m.completeControlsFor("T1003");
    expect(t1003.map((c) => c.control_id)).toContain("IA-5");
    expect(m.completeControlsFor("T1003.003").map((c) => c.control_id)).toContain("AC-2");
    expect(m.completeControlsFor("T1078").map((c) => c.control_id)).toContain("AC-2");
  });

  it("exposes the parsed metadata versions", () => {
    const m = load();
    expect(m.attackVersion).toBe("16.1");
    expect(m.frameworkRevision).toBe("rev5");
  });

  it("flags explicitly non_mappable techniques (T1566.004 help-desk vishing)", () => {
    expect(load().isNonMappable("T1566.004")).toBe(true);
  });

  it("treats techniques with no complete mapping as non_mappable (T1656 absent)", () => {
    expect(load().isNonMappable("T1656")).toBe(true);
  });

  it("does not flag well-mapped techniques as non_mappable", () => {
    expect(load().isNonMappable("T1003")).toBe(false);
  });

  it("rejects malformed documents", () => {
    expect(() => CtidMappings.fromDocument({ not: "valid" })).toThrow();
  });
});

/**
 * T1656 VERSION-BUMP TRIPWIRE (tracked item — M2).
 *
 * T1656 (Impersonation) currently has no complete CTID 800-53 mapping, so the
 * engine falls back to the analyst-asserted human-identity library (Invariant 4).
 * If a future CTID release adds a complete mapping for T1656, this test will
 * FAIL — which is intentional. When it fails, the human-identity fallback
 * assumption must be revisited: the analyst-asserted controls should be
 * cross-referenced against the new CTID mapping and the engine's technique
 * pattern for T1656 may need updating.
 */
describe("T1656 version-bump tripwire (Invariant 4)", () => {
  it("T1656 has no complete CTID mapping in the pinned dataset — MUST remain non_mappable until the dataset is updated", () => {
    const m = load();
    expect(m.isNonMappable("T1656")).toBe(true);
    // If this assertion ever fails, a new CTID release has added a complete
    // mapping for T1656. Before marking this test as expected-to-fail or
    // removing it, review whether the human-identity-library controls for T1656
    // overlap with or conflict with the new CTID entry.
    expect(m.completeControlsFor("T1656")).toHaveLength(0);
  });
});

describe("CTID_PIN", () => {
  it("pins a specific commit, ATT&CK version, and 800-53 revision", () => {
    expect(CTID_PIN.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(CTID_PIN.attack_version).toBe("16.1");
    expect(CTID_PIN.framework_revision).toBe("rev5");
    expect(CTID_PIN.license).toBe("Apache-2.0");
  });

  it("resolves a raw URL embedding the pinned coordinates", () => {
    const url = CTID_PIN.rawUrl();
    expect(url).toContain(CTID_PIN.commit);
    expect(url).toContain("attack-16.1");
    expect(url).toContain("nist_800_53-rev5");
  });
});

/**
 * Breaking-control lookup for Stage 1.
 *
 * Checks CTID first; if the technique is non_mappable (or absent) in CTID,
 * falls back to the analyst-asserted human-identity library (Invariant 4).
 * The mapping_basis field distinguishes the two sources.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CtidMappings, humanIdentityControlsFor } from "@registry";
import type { BreakingControl } from "./schema.js";

let _ctid: CtidMappings | null = null;

function ctid(): CtidMappings {
  if (!_ctid) {
    const samplePath = fileURLToPath(
      new URL(
        "../../registry/data/ctid/sample_nist_800_53-rev5_attack-16.1.json",
        import.meta.url,
      ),
    );
    _ctid = CtidMappings.fromJson(readFileSync(samplePath, "utf8"));
  }
  return _ctid;
}

/**
 * Return breaking controls for a technique.
 * Analyst-asserted controls (from human-identity library) take precedence when
 * CTID cannot cover the technique.
 */
export function getBreakingControls(techniqueId: string): BreakingControl[] {
  const c = ctid();

  if (c.isNonMappable(techniqueId)) {
    // CTID non_mappable or no complete mapping: use analyst-asserted library.
    const hiControls = humanIdentityControlsFor(techniqueId);
    if (hiControls.length > 0) {
      return hiControls.map((hc) => ({
        axis: hc.axis,
        description: hc.description,
        framework_ref: hc.framework_ref,
        mapping_basis: "analyst-asserted" as const,
      }));
    }
    // Fall through: no analyst-asserted controls defined either.
    // Return a pointer to ATT&CK mitigations for completeness.
    return [
      {
        axis: "prevent",
        description: `Consult ATT&CK Mitigations for ${techniqueId} — no CTID 800-53 mapping exists and no analyst-asserted control is defined.`,
        framework_ref: `ATT&CK ${techniqueId}`,
        mapping_basis: "analyst-asserted",
      },
    ];
  }

  // CTID has a complete mapping: return those controls as CTID-mapped.
  return c.completeControlsFor(techniqueId).map((link) => ({
    axis: (link.score_category ?? "prevent") as BreakingControl["axis"],
    description: link.control_description,
    framework_ref: link.control_id,
    mapping_basis: "CTID-mapped" as const,
  }));
}

import { TIER_RANK } from "@registry";
import type { EvidenceTier } from "@store";
import type { NcscClaim } from "./types.js";

export function filterNegatedClaims(claims: NcscClaim[]): NcscClaim[] {
  return claims.filter((c) => !c.negated);
}

export function applyTierCeiling(
  claims: NcscClaim[],
  ceiling: EvidenceTier,
): NcscClaim[] {
  return claims.map((c) => {
    if (TIER_RANK[c.tier] <= TIER_RANK[ceiling]) return c;
    // Claim tier exceeds ceiling — cap it downward. ANALOGOUS is not a valid
    // NcscClaim tier so we floor at INFERRED as a defensive fallback.
    const capped: NcscClaim["tier"] =
      ceiling === "CONFIRMED" || ceiling === "REPORTED" || ceiling === "INFERRED"
        ? ceiling
        : "INFERRED";
    return { ...c, tier: capped };
  });
}

export function extractCveIds(text: string): string[] {
  const matches = text.match(/CVE-\d{4}-\d{4,7}/gi) ?? [];
  return [...new Set(matches.map((m) => m.toUpperCase()))];
}

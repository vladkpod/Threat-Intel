import { TIER_RANK } from "@registry";
import type { EvidenceTier } from "@store";

// Invariant 12: auto-ingested claims cannot exceed their source-class tier ceiling.
// Takes the weaker (lower-ranked) of the two ceilings.
export function enforceSourceCeiling(
  sourceCeiling: EvidenceTier,
  reviewCeiling: EvidenceTier,
): EvidenceTier {
  return TIER_RANK[sourceCeiling] <= TIER_RANK[reviewCeiling]
    ? sourceCeiling
    : reviewCeiling;
}

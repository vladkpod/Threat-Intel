/**
 * Evidence-tier computation for a claim from its admitted sources (Invariant 2).
 *
 * The tier attaches to the claim, not the document, and is the strongest tier
 * among contributing sources — with the hard rule that `actor_inferred` sources
 * (B5 actor-pattern, leak-site about the actor) can never lift a victim-fact
 * claim above INFERRED (Invariant 1 / §B5 / §B8). Excluded sources contribute
 * nothing.
 */
import { TIER_RANK, type Admissibility, type EvidenceTier } from "./types.js";

export interface TierSourceInput {
  tier_ceiling: EvidenceTier;
  admitted_as: Admissibility;
}

export interface TierResult {
  /** Strongest supportable tier, or null if no admissible source remains. */
  tier: EvidenceTier | null;
}

function weaker(a: EvidenceTier, b: EvidenceTier): EvidenceTier {
  return TIER_RANK[a] <= TIER_RANK[b] ? a : b;
}

function stronger(a: EvidenceTier, b: EvidenceTier): EvidenceTier {
  return TIER_RANK[a] >= TIER_RANK[b] ? a : b;
}

export function computeTier(sources: TierSourceInput[]): TierResult {
  let best: EvidenceTier | null = null;

  for (const s of sources) {
    if (s.admitted_as === "excluded") continue;

    // Actor-pattern / leak-site about the actor caps at INFERRED for the victim.
    const effective: EvidenceTier =
      s.admitted_as === "actor_inferred"
        ? weaker(s.tier_ceiling, "INFERRED")
        : s.tier_ceiling;

    best = best === null ? effective : stronger(best, effective);
  }

  return { tier: best };
}

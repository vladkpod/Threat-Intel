/** Shared vocabulary for the registry. Mirrors the store's value unions so the
 *  ingest layer can pass values straight through. */

export type EvidenceTier = "CONFIRMED" | "REPORTED" | "INFERRED" | "ANALOGOUS";
export type IndependenceGroup = "G1" | "G2" | "G3" | "G4" | "B5" | "B6";
export type Admissibility = "victim_fact" | "actor_inferred" | "excluded";
export type ClaimSubject = "victim_fact" | "actor";

/** Strength ranking; higher = stronger evidence. */
export const TIER_RANK: Record<EvidenceTier, number> = {
  CONFIRMED: 3,
  REPORTED: 2,
  INFERRED: 1,
  ANALOGOUS: 0,
};

/** Classes a source can belong to (drives §B8 admissibility). */
export type SourceClass =
  | "government"
  | "regulator"
  | "victim-disclosure"
  | "ir-firm"
  | "specialist-press"
  | "major-press"
  | "actor-advisory"
  | "leak-site"
  | "stolen-data"
  | "feed"
  | "seo-farm"
  | "social"
  | "rumour";

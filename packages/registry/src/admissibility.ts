/**
 * Admissibility / exclusion policy — registry §B8 (Invariant 7).
 *
 * Raw stolen data and criminal leak-site contents are NEVER admitted as
 * victim-fact; they are permitted only as INFERRED material about the actor.
 * Actor-pattern advisories (B5) likewise may only populate inferred/analogous
 * tiers about the victim. SEO farms, single-source rumour and unattributed
 * social posts are excluded outright.
 */
import type { Admissibility, ClaimSubject, IndependenceGroup, SourceClass } from "./types.js";

const ALWAYS_EXCLUDED: ReadonlySet<SourceClass> = new Set<SourceClass>([
  "seo-farm",
  "social",
  "rumour",
]);

const LEAK_CLASSES: ReadonlySet<SourceClass> = new Set<SourceClass>([
  "leak-site",
  "stolen-data",
]);

/**
 * The strongest role a source could ever play, independent of any specific
 * claim. Persisted as sources.base_admissibility.
 */
export function baseAdmissibility(
  group: IndependenceGroup,
  sourceClass: SourceClass | null,
): Admissibility {
  if (sourceClass && ALWAYS_EXCLUDED.has(sourceClass)) return "excluded";
  if (group === "B6" || (sourceClass && LEAK_CLASSES.has(sourceClass))) {
    return "actor_inferred";
  }
  if (group === "B5") return "actor_inferred";
  return "victim_fact";
}

/**
 * How a source may be admitted for a claim with the given subject.
 *
 *  - victim-fact claim + leak-site/feed (B6) or stolen data  -> excluded
 *  - victim-fact claim + actor advisory (B5)                 -> actor_inferred (caps at INFERRED)
 *  - actor-subject claim + leak-site/B6/B5                   -> actor_inferred
 *  - SEO/social/rumour, any subject                          -> excluded
 *  - G1–G4, victim-fact claim                                -> victim_fact
 */
export function admitForClaim(
  group: IndependenceGroup,
  sourceClass: SourceClass | null,
  subject: ClaimSubject,
): Admissibility {
  if (sourceClass && ALWAYS_EXCLUDED.has(sourceClass)) return "excluded";

  const isLeak = group === "B6" || (sourceClass !== null && LEAK_CLASSES.has(sourceClass));
  if (isLeak) {
    // Criminal leak-site / stolen data: never victim-fact (§B8).
    return subject === "victim_fact" ? "excluded" : "actor_inferred";
  }

  if (group === "B5") {
    // Actor-pattern intel only ever populates inferred/analogous tiers.
    return "actor_inferred";
  }

  // G1–G4 official / press / IR sources.
  return subject === "victim_fact" ? "victim_fact" : "actor_inferred";
}

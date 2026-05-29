/**
 * Independence & corroboration counting — registry §B7 (Invariant 5).
 *
 * A claim is independently corroborated only across DIFFERENT independence
 * groups (G1–G4), or by ≥2 different IR firms within G3. The counter must not
 * increment within one independence group, and derivative echoes collapse to
 * their primary before counting. B5/B6 (actor-pattern, leak-site) never
 * corroborate a victim-fact claim.
 */
import type { Admissibility, IndependenceGroup } from "./types.js";

export interface ClaimSourceInput {
  external_id: string;
  independence_group: IndependenceGroup;
  is_primary: boolean;
  /** external_id of the source this one echoes, if any (§B4 / §B7). */
  derivative_of: string | null;
  /** How this source was admitted for the claim (from admitForClaim, §B8). */
  admitted_as: Admissibility;
  /** For G3 only: the IR firm's identity. ≥2 distinct firms = real corroboration. */
  ir_firm?: string | null;
}

export interface SourceContribution {
  external_id: string;
  /** Whether this source incremented the corroboration counter. */
  corroboration_contribution: boolean;
  /** external_id of the primary it collapsed to, if a derivative echo. */
  collapsed_to: string | null;
}

export interface CorroborationResult {
  /** Distinct-independence-group count (G3 counted per distinct IR firm). */
  count: number;
  /** Independence groups that contributed at least once. */
  groups: IndependenceGroup[];
  /** Per-source provenance flags for persistence. */
  perSource: SourceContribution[];
}

/** Groups whose unit of independence is the group itself. */
const GROUP_UNIT: ReadonlySet<IndependenceGroup> = new Set<IndependenceGroup>([
  "G1",
  "G2",
  "G4",
]);

/**
 * Compute corroboration for a claim from its supporting sources.
 *
 * Only sources admitted as `victim_fact` can corroborate an incident fact;
 * `actor_inferred` and `excluded` sources are linked for provenance but never
 * increment the counter.
 */
export function computeCorroboration(sources: ClaimSourceInput[]): CorroborationResult {
  const perSource: SourceContribution[] = [];
  const contributingGroups = new Set<IndependenceGroup>();
  // Track which group-units / IR-firms have already been counted so repeats
  // within the same group do not increment.
  const seenGroupUnit = new Set<IndependenceGroup>();
  const seenG3Firm = new Set<string>();
  let count = 0;

  // A derivative collapses to its primary if that primary is also present and
  // in the same independence group (press echoing press, leak echoing report).
  const present = new Map(sources.map((s) => [s.external_id, s]));

  for (const s of sources) {
    // Non-corroborating sources: still linked for provenance.
    if (s.admitted_as !== "victim_fact") {
      perSource.push({
        external_id: s.external_id,
        corroboration_contribution: false,
        collapsed_to: null,
      });
      continue;
    }

    // Derivative echo -> collapse to primary, no increment.
    if (s.derivative_of && present.has(s.derivative_of)) {
      perSource.push({
        external_id: s.external_id,
        corroboration_contribution: false,
        collapsed_to: s.derivative_of,
      });
      continue;
    }

    if (s.independence_group === "G3") {
      // ≥2 different IR firms within G3 = genuine corroboration.
      const firm = s.ir_firm ?? s.external_id;
      if (seenG3Firm.has(firm)) {
        perSource.push({
          external_id: s.external_id,
          corroboration_contribution: false,
          collapsed_to: null,
        });
        continue;
      }
      seenG3Firm.add(firm);
      contributingGroups.add("G3");
      count += 1;
      perSource.push({
        external_id: s.external_id,
        corroboration_contribution: true,
        collapsed_to: null,
      });
      continue;
    }

    if (GROUP_UNIT.has(s.independence_group)) {
      if (seenGroupUnit.has(s.independence_group)) {
        // Within-group repeat: does NOT increment (§B7).
        perSource.push({
          external_id: s.external_id,
          corroboration_contribution: false,
          collapsed_to: null,
        });
        continue;
      }
      seenGroupUnit.add(s.independence_group);
      contributingGroups.add(s.independence_group);
      count += 1;
      perSource.push({
        external_id: s.external_id,
        corroboration_contribution: true,
        collapsed_to: null,
      });
      continue;
    }

    // B5/B6 should not be admitted as victim_fact; guard defensively.
    perSource.push({
      external_id: s.external_id,
      corroboration_contribution: false,
      collapsed_to: null,
    });
  }

  return { count, groups: [...contributingGroups], perSource };
}

/**
 * Stage 1: Extraction — sources → ATT&CK-tagged attack chain with mandatory
 * per-claim tier + provenance (Invariant 1).
 *
 * Every emitted chain step must anchor to at least one admitted source at its
 * assigned tier. Steps with no admitted source are dropped and their absence is
 * explained in source_quality_note (Invariant 1). The tier is computed
 * deterministically from the ingestion-layer registry functions (§B7/§B8) — the
 * LLM is never the source of tier or corroboration facts.
 *
 * Version log (Invariant 8): sources are processed weakest-group-first. When a
 * stronger source raises the tier of an existing claim, a VersionLogEntry is
 * appended so the supersession is auditable.
 */
import {
  admitForClaim,
  computeCorroboration,
  computeTier,
  TIER_RANK,
  type ClaimSourceInput,
  type EvidenceTier,
} from "@registry";
import type {
  AttackChainStep,
  BreakingControl,
  SourceRef,
  VersionLogEntry,
} from "./schema.js";
import type { ReconstructionInput, SourceDocument } from "./schema.js";
import {
  TECHNIQUE_SIGNATURES,
  type TechniqueSignature,
} from "./technique-patterns.js";
import { getBreakingControls } from "./breaking-controls.js";

export interface ExtractionResult {
  steps: AttackChainStep[];
  version_log: VersionLogEntry[];
  /** Narrative on overall source coverage, including any insufficient-evidence notes. */
  source_quality_note: string;
  /** Actor attribution extracted from B5 sources (INFERRED only). */
  actor: string;
}

/** Source strength for version-log ordering: weakest group processed first. */
const GROUP_STRENGTH: Record<string, number> = {
  B5: 0,
  B6: 0,
  G4: 1,
  G3: 2,
  G2: 3,
  G1: 4,
};

function groupStrength(src: SourceDocument): number {
  return (GROUP_STRENGTH[src.independence_group] ?? 1) * 10 +
    TIER_RANK[src.tier_ceiling];
}

// Sentence boundary split — covers typical prose and newlines.
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Negation signals that invalidate a positive technique match within a sentence.
const NEGATION_RE =
  /\b(no evidence|no indication|no sign|not observed|not detected|did not|did n't|never|deny|denied|no reported|absence of|ruled out|without evidence|unconfirmed|could not confirm)\b/i;

/**
 * Returns true only if the sentence contains an affirmative pattern match.
 * Sentences that also contain a negation signal are skipped (M8 negation filter).
 */
function sentenceMatchesSig(sentence: string, sig: TechniqueSignature): boolean {
  if (!sig.patterns.some((p) => p.test(sentence))) return false;
  return !NEGATION_RE.test(sentence);
}

/**
 * Determine whether a source text contains evidence for a technique signature.
 * Returns true if any non-negated sentence matches and the source's admissibility
 * for the claim's subject is not "excluded".
 */
function sourceMatchesSig(
  src: SourceDocument,
  sig: TechniqueSignature,
): boolean {
  const claimSubject = sig.subject === "victim_fact" ? "victim_fact" : "actor";
  const admitted = admitForClaim(src.independence_group, null, claimSubject);
  if (admitted === "excluded") return false;
  const sentences = splitSentences(src.text);
  return sentences.some((s) => sentenceMatchesSig(s, sig));
}

/** Build the corroboration input for a set of sources supporting a claim. */
function buildCorrInput(
  matchedSources: SourceDocument[],
  sig: TechniqueSignature,
): ClaimSourceInput[] {
  return matchedSources.map((src) => ({
    external_id: src.id,
    independence_group: src.independence_group,
    is_primary: src.primary,
    derivative_of: src.derivative_of,
    admitted_as: admitForClaim(
      src.independence_group,
      null,
      sig.subject === "victim_fact" ? "victim_fact" : "actor",
    ),
    ir_firm: null,
  }));
}

/**
 * Compute version-log entries for one technique by replaying sources in
 * weakest-first order and recording tier promotions.
 */
function buildVersionLog(
  sig: TechniqueSignature,
  matchedSources: SourceDocument[],
): VersionLogEntry[] {
  const entries: VersionLogEntry[] = [];
  const sorted = [...matchedSources].sort(
    (a, b) => groupStrength(a) - groupStrength(b),
  );

  let currentTier: EvidenceTier | null = null;

  for (const src of sorted) {
    const tierResult = computeTier(
      buildCorrInput(
        sorted.slice(0, sorted.indexOf(src) + 1),
        sig,
      ).map((cs) => ({
        tier_ceiling: sorted.find((s) => s.id === cs.external_id)!.tier_ceiling,
        admitted_as: cs.admitted_as,
      })),
    );

    const newTier = tierResult.tier;
    if (newTier && currentTier && TIER_RANK[newTier] > TIER_RANK[currentTier]) {
      entries.push({
        claim: sig.technique_id,
        old_tier: currentTier,
        new_tier: newTier,
        superseding_source: `${src.id} — ${src.label}`,
        at: new Date().toISOString(),
      });
    }
    if (newTier) currentTier = newTier;
  }

  return entries;
}

// Known threat-actor name patterns. Extend as new incidents are added to the
// corpus — do not hard-code incident-specific names in extraction logic.
const ACTOR_PATTERN_B5 =
  /Scattered Spider|UNC3944|DragonForce|Rhysida|[A-Z][a-z]+\s(?:Spider|Bear|Panda|Kitten|Jackal)/;
const ACTOR_PATTERN_PRESS = /Scattered Spider|UNC3944|DragonForce|Rhysida/;

/** Extract actor name from B5 or press source text (INFERRED attribution only). */
function extractActor(sources: SourceDocument[]): string {
  const actorSources = sources.filter((s) => s.independence_group === "B5");
  for (const src of actorSources) {
    const m = src.text.match(ACTOR_PATTERN_B5);
    if (m) return `${m[0]} (INFERRED — actor-pattern intel only; not incident-confirmed)`;
  }
  const pressSources = sources.filter((s) => s.independence_group === "G4");
  for (const src of pressSources) {
    const m = src.text.match(ACTOR_PATTERN_PRESS);
    if (m)
      return `${m[0]} (INFERRED — specialist press reporting; not officially confirmed)`;
  }
  // G1 government advisories may name the actor with higher confidence.
  const govSources = sources.filter((s) => s.independence_group === "G1");
  for (const src of govSources) {
    const m = src.text.match(ACTOR_PATTERN_B5);
    if (m)
      return `${m[0]} (INFERRED — government advisory naming; not victim-confirmed for this incident)`;
  }
  return "Unknown (insufficient public attribution evidence)";
}

export function extract(input: ReconstructionInput): ExtractionResult {
  const sources = input.incident_sources;
  const steps: AttackChainStep[] = [];
  const version_log: VersionLogEntry[] = [];
  const insufficientNotes: string[] = [];

  const sortedSigs = [...TECHNIQUE_SIGNATURES].sort(
    (a, b) => a.step_order - b.step_order,
  );

  for (const sig of sortedSigs) {
    // Collect sources that match this technique signature.
    const matchedSources = sources.filter((src) => sourceMatchesSig(src, sig));

    if (matchedSources.length === 0) {
      insufficientNotes.push(sig.insufficientEvidenceNote);
      continue; // Invariant 1: no source → step dropped
    }

    const corrInput = buildCorrInput(matchedSources, sig);
    const tierResult = computeTier(
      corrInput.map((cs) => ({
        tier_ceiling: matchedSources.find((s) => s.id === cs.external_id)!
          .tier_ceiling,
        admitted_as: cs.admitted_as,
      })),
    );

    if (tierResult.tier === null) {
      insufficientNotes.push(sig.insufficientEvidenceNote);
      continue; // Invariant 1: all sources excluded → step dropped
    }

    // Version log for this technique.
    version_log.push(...buildVersionLog(sig, matchedSources));

    const corr = computeCorroboration(corrInput);

    // Build SourceRefs — only include non-excluded sources.
    const sourceRefs: SourceRef[] = matchedSources
      .filter((src) => {
        const cs = corrInput.find((c) => c.external_id === src.id);
        return cs && cs.admitted_as !== "excluded";
      })
      .map((src) => {
        const contrib = corr.perSource.find((p) => p.external_id === src.id);
        return {
          id: src.id,
          label: src.label,
          independence_group: src.independence_group,
          collapsed_to: contrib?.collapsed_to ?? null,
          corroboration_contribution: contrib?.corroboration_contribution ?? false,
        };
      });

    const breaking_controls: BreakingControl[] = getBreakingControls(
      sig.technique_id,
    );

    steps.push({
      step: steps.length + 1,
      attack_tactic: sig.tactic,
      attack_technique: sig.technique_id,
      what_happened: sig.describe(matchedSources.map((s) => s.label)),
      evidence_tier: tierResult.tier,
      sources: sourceRefs,
      corroboration: {
        independence_group_count: corr.count,
        groups: corr.groups,
      },
      breaking_controls,
      insufficient_evidence_note: null,
    });
  }

  const sourceQualityNote = buildSourceQualityNote(sources, insufficientNotes);
  const actor = extractActor(sources);

  return { steps, version_log, source_quality_note: sourceQualityNote, actor };
}

function buildSourceQualityNote(
  sources: SourceDocument[],
  insufficientNotes: string[],
): string {
  const groupCounts: Record<string, number> = {};
  for (const src of sources) {
    groupCounts[src.independence_group] =
      (groupCounts[src.independence_group] ?? 0) + 1;
  }

  const parts: string[] = [
    `Source set: ${sources.length} document(s) across independence groups ${Object.keys(groupCounts).sort().join(", ")}.`,
  ];

  if (insufficientNotes.length > 0) {
    parts.push(...insufficientNotes);
  }

  return parts.join(" ");
}

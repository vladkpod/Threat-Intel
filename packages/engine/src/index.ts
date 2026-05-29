/**
 * Product A — incident reconstruction engine.
 *
 * M2: Stage 1 (extraction) is implemented. Stage 2 (generalisation) and
 * Stage 3 (self-assessment) are stubs that return schema-valid empty values
 * and will be replaced in M3.
 *
 * The three stages are kept as separate functions so each can be independently
 * tested and cached. The engine is judged against the M&S golden eval
 * (tests/eval/ms_2025/) — not the other way round.
 */
import {
  ReconstructionInput,
  TIER_RANK,
  type EvidenceTier,
  type GeneralisedPattern,
  type InferableControlGap,
  type ReconstructionOutput,
  type SelfAssessmentEntry,
  type Verdict,
} from "./schema.js";
import { extract } from "./extraction.js";

export class NotImplementedError extends Error {
  constructor(stage: string) {
    super(`Engine stage not implemented yet: ${stage}`);
    this.name = "NotImplementedError";
  }
}

/** Weakest tier in a set (strongest to weakest: CONFIRMED > REPORTED > INFERRED > ANALOGOUS). */
function weakestTier(tiers: EvidenceTier[]): EvidenceTier {
  return tiers.reduce((w, t) => (TIER_RANK[t] < TIER_RANK[w] ? t : w));
}

// ── Stage 2 stub ──────────────────────────────────────────────────────────────

function generalise(): GeneralisedPattern {
  return {
    title: "Attack pattern pending Stage 2 implementation.",
    preconditions: [],
    chain_summary: "Generalisation not yet implemented (M2 stub).",
  };
}

// ── Stage 3 stub ──────────────────────────────────────────────────────────────

function selfAssess(): SelfAssessmentEntry[] {
  return [];
}

function buildVerdict(chainTiers: EvidenceTier[]): Verdict {
  const confidence: EvidenceTier =
    chainTiers.length > 0 ? weakestTier(chainTiers) : "INFERRED";

  return {
    method:
      "Verdict pending Stage 3 implementation. Breakability is assessed across prevent/detect/respond axes. (M2 stub)",
    result: "indeterminate",
    earliest_breakable_step: null,
    break_axis: null,
    confidence,
    caveats: ["Stage 3 self-assessment not yet implemented."],
  };
}

function buildControlGaps(): InferableControlGap[] {
  return [];
}

// ── Engine entry point ────────────────────────────────────────────────────────

export function reconstruct(input: unknown): ReconstructionOutput {
  const parsed = ReconstructionInput.parse(input);

  // Stage 1: extraction
  const extraction = extract(parsed);

  // Stage 2: generalisation (stub)
  const generalised_pattern = generalise();

  // Stage 3: self-assessment (stub)
  const self_assessment = selfAssess();
  const inferable_control_gaps = buildControlGaps();
  const verdict = buildVerdict(extraction.steps.map((s) => s.evidence_tier));

  return {
    incident: {
      name: parsed.incident_name,
      actor: extraction.actor,
      summary: extraction.steps.length > 0
        ? `${extraction.steps.length}-step attack chain reconstructed from supplied sources.`
        : "No attack steps could be reconstructed from the supplied sources.",
      source_quality_note: extraction.source_quality_note,
    },
    attack_chain: extraction.steps,
    generalised_pattern,
    inferable_control_gaps,
    self_assessment,
    verdict,
    version_log: extraction.version_log,
  };
}

export * from "./schema.js";

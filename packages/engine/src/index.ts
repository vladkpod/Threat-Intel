/**
 * Product A — incident reconstruction engine.
 *
 * Three independently-testable stages:
 *   Stage 1 (extraction.ts): sources → ATT&CK-tagged chain + tier + provenance
 *   Stage 2 (generalisation.ts): chain → reusable pattern + inferred gaps
 *   Stage 3 (self-assessment.ts + verdict.ts): pattern + client → questionnaire + verdict
 *
 * The engine is judged against the M&S golden eval (tests/eval/ms_2025/).
 */
import {
  ReconstructionInput,
  type ReconstructionOutput,
} from "./schema.js";
import { extract } from "./extraction.js";
import { generalise } from "./generalisation.js";
import { selfAssess } from "./self-assessment.js";
import { computeVerdict } from "./verdict.js";

export class NotImplementedError extends Error {
  constructor(stage: string) {
    super(`Engine stage not implemented yet: ${stage}`);
    this.name = "NotImplementedError";
  }
}

export function reconstruct(input: unknown): ReconstructionOutput {
  const parsed = ReconstructionInput.parse(input);

  // Stage 1: extraction
  const extraction = extract(parsed);

  // Stage 2: generalisation
  const { pattern: generalised_pattern, gaps: inferable_control_gaps } =
    generalise(extraction.steps);

  // Stage 3: self-assessment and verdict
  const self_assessment = selfAssess(extraction.steps);
  const verdict = computeVerdict(
    extraction.steps,
    parsed.client_profile,
    self_assessment,
  );

  return {
    incident: {
      name: parsed.incident_name,
      actor: extraction.actor,
      summary:
        extraction.steps.length > 0
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

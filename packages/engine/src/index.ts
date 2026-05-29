/**
 * Product A — incident reconstruction engine entry point.
 *
 * M0 status: STUB. The three stages (extraction / generalisation /
 * self-assessment) are built in M1-M3. Until then `reconstruct` throws, so the
 * M&S golden eval runs and fails — which is the intended M0 state. The eval is
 * the contract; the engine is judged against it.
 */
import {
  ReconstructionInput,
  type ReconstructionOutput,
} from "./schema.js";

export class NotImplementedError extends Error {
  constructor(stage: string) {
    super(`Engine stage not implemented yet: ${stage} (M0 stub).`);
    this.name = "NotImplementedError";
  }
}

/**
 * Reconstruct an incident and produce a control self-assessment.
 *
 * @throws NotImplementedError until the engine stages land (M1-M3).
 */
export function reconstruct(input: unknown): ReconstructionOutput {
  // Validate input shape now so M0 fixtures are exercised against the schema.
  ReconstructionInput.parse(input);
  throw new NotImplementedError("extraction -> generalisation -> self-assessment");
}

export * from "./schema.js";

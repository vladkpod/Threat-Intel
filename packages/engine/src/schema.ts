/**
 * Output schema for the Incident Reconstruction & Self-Assessment engine.
 *
 * This is the structural contract referenced by the M&S golden eval
 * (tests/eval/ms_2025/). The shape follows docs/incident_reconstruction_prompt.md,
 * extended with the fields the CLAUDE.md invariants require us to test:
 *   - per-claim corroboration counter (Invariant 5)
 *   - testability flag on self-assessment entries (Invariant 6)
 *   - mapping_basis on self-assessment entries (Invariant 4)
 *   - version_log for supersession (Invariant 8)
 *
 * Tier ordering (strongest -> weakest): CONFIRMED > REPORTED > INFERRED > ANALOGOUS.
 */
import { z } from "zod";

/** Evidence tiers — apply to every chain step and every claim. */
export const EvidenceTier = z.enum([
  "CONFIRMED",
  "REPORTED",
  "INFERRED",
  "ANALOGOUS",
]);
export type EvidenceTier = z.infer<typeof EvidenceTier>;

/** Strength ranking for tiers; higher number = stronger evidence. */
export const TIER_RANK: Record<EvidenceTier, number> = {
  CONFIRMED: 3,
  REPORTED: 2,
  INFERRED: 1,
  ANALOGOUS: 0,
};

/**
 * Independence groups from registry §B. Corroboration is counted only across
 * sources in *different* groups (G1-G4), or by >=2 different IR firms within G3.
 * B5 (actor-pattern) and B6 (feeds/leak-sites) are never incident-fact.
 */
export const IndependenceGroup = z.enum([
  "G1", // government / regulator
  "G2", // mandatory / official victim disclosure
  "G3", // first-hand IR / telemetry
  "G4", // specialist press primaries
  "B5", // actor-pattern intel — INFERRED only
  "B6", // structured feeds / leak-site trackers — actor-claim only
]);
export type IndependenceGroup = z.infer<typeof IndependenceGroup>;

/** How a breaking control was linked to a technique. */
export const MappingBasis = z.enum(["CTID-mapped", "analyst-asserted"]);
export type MappingBasis = z.infer<typeof MappingBasis>;

/** Whether a control can be validated or is only self-reported (Invariant 6). */
export const Testability = z.enum([
  "BAS-validatable",
  "red-team-validatable",
  "self-reported-only",
]);
export type Testability = z.infer<typeof Testability>;

/** The three defensive axes. Breakability is judged across all of them (Invariant 3). */
export const DefensiveAxis = z.enum(["prevent", "detect", "respond"]);
export type DefensiveAxis = z.infer<typeof DefensiveAxis>;

/** A single source reference attached to a claim, carrying provenance. */
export const SourceRef = z.object({
  id: z.string(),
  label: z.string(),
  independence_group: IndependenceGroup,
  /** If this source merely echoes another, the id it collapses to (Invariant 5). */
  collapsed_to: z.string().nullable().default(null),
  /** Whether this source counts toward the corroboration counter. */
  corroboration_contribution: z.boolean(),
});
export type SourceRef = z.infer<typeof SourceRef>;

/** Per-claim corroboration record (Invariant 5). */
export const Corroboration = z.object({
  /** Distinct independence groups supporting this claim. Echoes must not inflate it. */
  independence_group_count: z.number().int().nonnegative(),
  groups: z.array(IndependenceGroup),
});
export type Corroboration = z.infer<typeof Corroboration>;

/** One breaking control on a single defensive axis. */
export const BreakingControl = z.object({
  axis: DefensiveAxis,
  description: z.string(),
  framework_ref: z.string(),
  mapping_basis: MappingBasis,
});
export type BreakingControl = z.infer<typeof BreakingControl>;

/** A single step in the reconstructed attack chain. */
export const AttackChainStep = z.object({
  step: z.number().int().positive(),
  attack_tactic: z.string(),
  attack_technique: z.string(),
  what_happened: z.string(),
  evidence_tier: EvidenceTier,
  sources: z.array(SourceRef),
  corroboration: Corroboration,
  /**
   * Breaking controls across prevent/detect/respond. Coverage of a step =
   * does >=1 countermeasure break it on any axis (Invariant 3) — NOT a count.
   */
  breaking_controls: z.array(BreakingControl),
  /** Set when the sources are too thin to assert this stage (Invariant 1). */
  insufficient_evidence_note: z.string().nullable().default(null),
});
export type AttackChainStep = z.infer<typeof AttackChainStep>;

export const Incident = z.object({
  name: z.string(),
  actor: z.string(),
  summary: z.string(),
  source_quality_note: z.string(),
});
export type Incident = z.infer<typeof Incident>;

export const GeneralisedPattern = z.object({
  title: z.string(),
  preconditions: z.array(z.string()),
  chain_summary: z.string(),
});
export type GeneralisedPattern = z.infer<typeof GeneralisedPattern>;

export const InferableControlGap = z.object({
  /** Phrased as inference, never accusation (Invariant 10). */
  gap: z.string(),
  supports_step: z.array(z.number().int().positive()),
  evidence_tier: EvidenceTier,
});
export type InferableControlGap = z.infer<typeof InferableControlGap>;

export const SelfAssessmentEntry = z.object({
  question: z.string(),
  maps_to_step: z.number().int().positive(),
  framework_ref: z.string(),
  /** Provenance of the underlying control link (Invariant 4). */
  mapping_basis: MappingBasis,
  /** Validatable vs self-reported (Invariant 6). */
  testability: Testability,
  resilient_looks_like: z.string(),
  vulnerable_looks_like: z.string(),
  evidence_tier_of_underlying_step: EvidenceTier,
});
export type SelfAssessmentEntry = z.infer<typeof SelfAssessmentEntry>;

export const VerdictResult = z.enum([
  "would_likely_succeed",
  "would_likely_fail",
  "indeterminate",
  "indeterminate_pending_confirmation",
]);
export type VerdictResult = z.infer<typeof VerdictResult>;

export const Verdict = z.object({
  method: z.string(),
  result: VerdictResult,
  /** The earliest step where the client has an effective break (Invariant 3). */
  earliest_breakable_step: z.number().int().positive().nullable(),
  /** The axis that achieves the break — prevent, detect, OR respond. */
  break_axis: DefensiveAxis.nullable(),
  /** Capped at the weakest evidence tier on the critical path (Invariant 9). */
  confidence: EvidenceTier,
  caveats: z.array(z.string()),
});
export type Verdict = z.infer<typeof Verdict>;

/** One entry in the supersession / retiering audit trail (Invariant 8). */
export const VersionLogEntry = z.object({
  claim: z.string(),
  old_tier: EvidenceTier,
  new_tier: EvidenceTier,
  superseding_source: z.string(),
  at: z.string(),
});
export type VersionLogEntry = z.infer<typeof VersionLogEntry>;

/** The complete engine output. */
export const ReconstructionOutput = z.object({
  incident: Incident,
  attack_chain: z.array(AttackChainStep),
  generalised_pattern: GeneralisedPattern,
  inferable_control_gaps: z.array(InferableControlGap),
  self_assessment: z.array(SelfAssessmentEntry),
  verdict: Verdict,
  version_log: z.array(VersionLogEntry).default([]),
});
export type ReconstructionOutput = z.infer<typeof ReconstructionOutput>;

// ---------------------------------------------------------------------------
// Engine input shape
// ---------------------------------------------------------------------------

export const SourceDocument = z.object({
  id: z.string(),
  label: z.string(),
  independence_group: IndependenceGroup,
  tier_ceiling: EvidenceTier,
  proximity: z.string(),
  primary: z.boolean(),
  derivative_of: z.string().nullable().default(null),
  incentive_bias: z.string().nullable().default(null),
  text: z.string().max(100_000),
});
export type SourceDocument = z.infer<typeof SourceDocument>;

export const ClientProfile = z.object({
  sector: z.string().optional(),
  identity_model: z.string().optional(),
  outsourced_functions: z.array(z.string()).optional(),
  controls_present: z.array(z.string()).optional(),
});
export type ClientProfile = z.infer<typeof ClientProfile>;

export const Framework = z.enum(["CIS_v8", "NIST_CSF_2", "CAF"]);
export type Framework = z.infer<typeof Framework>;

export const ReconstructionInput = z.object({
  incident_name: z.string().min(1).max(256),
  framework: Framework.default("CIS_v8"),
  client_profile: ClientProfile.nullable().default(null),
  incident_sources: z.array(SourceDocument).min(1).max(100),
});
export type ReconstructionInput = z.infer<typeof ReconstructionInput>;

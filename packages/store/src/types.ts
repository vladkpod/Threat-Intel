/** Row/value types for the store. Kept self-contained to the persistence layer. */

export type EvidenceTier = "CONFIRMED" | "REPORTED" | "INFERRED" | "ANALOGOUS";
export type IndependenceGroup = "G1" | "G2" | "G3" | "G4" | "B5" | "B6";
export type Admissibility = "victim_fact" | "actor_inferred" | "excluded";
export type ClaimSubject = "victim_fact" | "actor";
export type VersionReason = "initial" | "supersession" | "decay" | "recompute";

export interface IncidentRow {
  id: number;
  slug: string;
  name: string;
}

export interface SourceInput {
  external_id: string;
  label: string;
  independence_group: IndependenceGroup;
  tier_ceiling: EvidenceTier;
  proximity: string;
  is_primary: boolean;
  derivative_of: string | null;
  incentive_bias: string | null;
  source_class: string | null;
  base_admissibility: Admissibility;
  body: string;
}

export interface SourceRow extends SourceInput {
  id: number;
  incident_id: number;
}

export interface ClaimInput {
  claim_key: string;
  subject: ClaimSubject;
  statement: string;
  attack_tactic: string | null;
  attack_technique: string | null;
}

export interface ClaimRow extends ClaimInput {
  id: number;
  incident_id: number;
}

export interface ClaimVersionSourceLink {
  source_id: number;
  corroboration_contribution: boolean;
  collapsed_to: string | null;
  admitted_as: Admissibility;
}

export interface ClaimVersionInput {
  evidence_tier: EvidenceTier;
  corroboration_count: number;
  confidence: EvidenceTier;
  reason: VersionReason;
  note: string | null;
  sources: ClaimVersionSourceLink[];
}

export interface ClaimVersionRow {
  id: number;
  claim_id: number;
  version_no: number;
  evidence_tier: EvidenceTier;
  corroboration_count: number;
  confidence: EvidenceTier;
  reason: VersionReason;
  note: string | null;
  valid_from: string;
  valid_to: string | null;
  superseded_by: number | null;
}

// M6 types

export type JobStatus = "pending" | "running" | "completed" | "failed";
export type ReviewStatus = "pending" | "approved" | "rejected" | "deferred";
export type ReviewType = "new-incident" | "verdict-change";

export interface JobRow {
  id: number;
  job_type: string;
  payload: unknown;
  status: JobStatus;
  run_after: string;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  error: string | null;
  created_at: string;
}

export interface ReviewQueueRow {
  id: number;
  feed_job_id: number | null;
  type: ReviewType;
  candidate_title: string;
  candidate_text: string;
  tier_ceiling: EvidenceTier;
  status: ReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reconstruction_job_id: number | null;
  created_at: string;
}

export interface ReconstructionResultRow {
  id: number;
  incident_id: number;
  review_queue_id: number;
  critical_path_techniques: unknown;
  result_json: unknown;
  created_at: string;
}

export interface ClaimStalenessRow {
  id: number;
  claim_id: number;
  claim_version_id: number;
  caveat: string;
  flagged_at: string;
}

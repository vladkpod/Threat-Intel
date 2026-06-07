import type { EvidenceTier } from "@store";

export type JobType =
  | "feed.poll"
  | "incident.detected"
  | "reconstruction.triggered"
  | "decay.scan";

export interface FeedPollPayload {
  source: "attack-stix" | "cisa-kev" | "ncsc-publications";
}

export interface IncidentDetectedPayload {
  source: "attack-stix" | "cisa-kev" | "press-rss" | "ncsc-publications";
  candidate_title: string;
  candidate_text: string;
  tier_ceiling: EvidenceTier;
}

export interface SourceRef {
  id: string;
  label: string;
  independence_group: string;
  tier_ceiling: EvidenceTier;
  proximity: string;
  primary: boolean;
  derivative_of: string | null;
  incentive_bias: string | null;
  text: string;
}

export interface ReconstructionTriggeredPayload {
  review_queue_id: number;
  reconstruction_input: {
    incident_name: string;
    framework?: string;
    client_profile?: unknown;
    incident_sources: SourceRef[];
  };
}

export interface DecayScanPayload {
  stale_after_days?: number;
}

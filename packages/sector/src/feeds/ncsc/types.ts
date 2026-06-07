import type { EvidenceTier } from "@store";

export interface NcscRssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
}

export interface TriageResult {
  advisory: boolean;
  confidence: number;
  reason: string;
}

export type NcscTriageStatus = "advisory" | "uncertain" | "non-advisory";

export interface NcscClaim {
  technique_id: string | null;
  claim_text: string;
  actors: string[];
  affected_products: string[];
  cve_ids: string[];
  tier: "CONFIRMED" | "REPORTED" | "INFERRED";
  negated: boolean;
}

// Known future refactor: when packages/engine introduces LLM synthesis calls,
// move this interface and concrete implementations to packages/llm-client so
// both consumers share a single abstraction without duplication.
export interface LlmClient {
  complete(systemPrompt: string, userPrompt: string): Promise<string>;
}

export interface NcscFeedConfig {
  triageLlm: LlmClient;
  extractionLlm: LlmClient;
  fetchFn?: typeof fetch;
  feedUrls?: readonly string[];
}

export interface NcscFeedItem {
  title: string;
  url: string;
  text: string;
  pub_date: string;
  tier_ceiling: EvidenceTier;
  independence_group: "G1" | "G4";
  claims: NcscClaim[];
  cve_ids: string[];
  triage: TriageResult;
  triage_status: NcscTriageStatus;
}

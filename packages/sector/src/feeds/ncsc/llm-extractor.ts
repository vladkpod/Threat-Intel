import type { LlmClient, NcscClaim } from "./types.js";

const EXTRACTION_SYSTEM =
  `You are a structured threat intelligence extractor. Given the text of an NCSC security ` +
  `advisory, extract security claims as a JSON array.\n\n` +
  `For each distinct claim output an object with:\n` +
  `- "technique_id": MITRE ATT&CK ID if referenced verbatim in the text (e.g. "T1078"), ` +
  `  otherwise null. Extract verbatim IDs directly; do not infer IDs from prose alone.\n` +
  `- "claim_text": the relevant passage (quote exactly where possible)\n` +
  `- "actors": array of threat actor names mentioned\n` +
  `- "affected_products": array of affected software or hardware products\n` +
  `- "cve_ids": array of CVE identifiers in format CVE-YYYY-NNNNN\n` +
  `- "tier": one of "CONFIRMED", "REPORTED", or "INFERRED"\n` +
  `  "CONFIRMED": text says observed / confirmed / in-the-wild / exploitation detected / has been exploited\n` +
  `  "REPORTED": text says we assess / reportedly / likely / believed / thought to be\n` +
  `  "INFERRED": text says consistent with / suggests / may / possible / could indicate\n` +
  `- "negated": true if the claim is explicitly negated or absent in the source text ` +
  `  — e.g. "no evidence of", "has not been observed", "there is no indication", "not confirmed". ` +
  `  Otherwise false.\n\n` +
  `IMPORTANT: Set negated: true for any negative assertion. Do not convert a denial into a positive claim.\n` +
  `Respond with a JSON array only — no markdown fences, no explanation. ` +
  `If there are no extractable claims, respond with [].`;

export async function extractClaims(
  advisoryText: string,
  llm: LlmClient,
): Promise<NcscClaim[]> {
  if (advisoryText.trim().length === 0) return [];

  const response = await llm.complete(EXTRACTION_SYSTEM, advisoryText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.trim());
  } catch {
    // Non-JSON from LLM — fail safe, never fabricate
    return [];
  }

  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isValidNcscClaim);
}

function isValidNcscClaim(obj: unknown): obj is NcscClaim {
  if (typeof obj !== "object" || obj === null) return false;
  const r = obj as Record<string, unknown>;
  return (
    (r["technique_id"] === null || typeof r["technique_id"] === "string") &&
    typeof r["claim_text"] === "string" &&
    Array.isArray(r["actors"]) &&
    Array.isArray(r["affected_products"]) &&
    Array.isArray(r["cve_ids"]) &&
    (r["tier"] === "CONFIRMED" ||
      r["tier"] === "REPORTED" ||
      r["tier"] === "INFERRED") &&
    typeof r["negated"] === "boolean"
  );
}

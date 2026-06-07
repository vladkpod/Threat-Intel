import type { LlmClient, NcscRssItem, TriageResult } from "./types.js";

const TRIAGE_SYSTEM =
  `You are a security advisory classifier. Given an NCSC (UK National Cyber Security Centre) ` +
  `publication title and summary, determine whether it describes a formal security advisory ` +
  `about a specific CVE, vulnerability, or threat actor campaign requiring organisational action.\n\n` +
  `Respond with JSON only — no markdown, no explanation:\n` +
  `{"advisory": true, "confidence": 0.9, "reason": "describes CVE-2025-1234 exploitation"}\n\n` +
  `Advisory indicators: specific CVE references, named vulnerability affecting products, ` +
  `exploitation in the wild, threat actor campaigns requiring action, urgent mitigations.\n` +
  `Non-advisory indicators: conference announcements, executive commentary, general cyber ` +
  `hygiene guidance, blog posts, opinion pieces, statistics reports.`;

export async function triageItem(
  item: NcscRssItem,
  llm: LlmClient,
): Promise<TriageResult> {
  const userPrompt = `Title: ${item.title}\nSummary: ${item.description}`;
  const response = await llm.complete(TRIAGE_SYSTEM, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.trim());
  } catch {
    throw new Error(`Triage LLM returned non-JSON: ${response.slice(0, 200)}`);
  }

  const r = parsed as Record<string, unknown>;
  if (
    typeof r["advisory"] !== "boolean" ||
    typeof r["confidence"] !== "number" ||
    typeof r["reason"] !== "string"
  ) {
    throw new Error(`Triage LLM returned unexpected shape: ${JSON.stringify(parsed)}`);
  }

  return { advisory: r["advisory"], confidence: r["confidence"], reason: r["reason"] };
}

import type { Db } from "@store";
import { createReviewItem, enqueueJob } from "@store";
import { fetchAttackStix } from "@sector/feeds/attack-stix.js";
import { fetchKev } from "@sector/feeds/cisa-kev.js";
import {
  createAnthropicClient,
  fetchNcscPublications,
} from "@sector/feeds/ncsc/index.js";
import type { NcscFeedItem } from "@sector/feeds/ncsc/index.js";
import type { AttackStixResult, KevFeedResult } from "@sector";
import type { FeedPollPayload, IncidentDetectedPayload } from "../types.js";
import { TRIAGE_MODEL, EXTRACTION_MODEL } from "@sector/feeds/ncsc/constants.js";

type FetchAttackStixFn = () => Promise<AttackStixResult>;
type FetchKevFn = () => Promise<KevFeedResult>;
type FetchNcscFn = () => Promise<NcscFeedItem[]>;

// Title-based dedup: prevents re-queueing the same feed entry across polls.
// Known limitation: this is a heuristic, not full echo-resolution.
//   - Miss case: two outlets describe the same incident with different headlines
//     (both enqueue; downstream review gate catches the duplicate at human review)
//   - False-positive case: genuinely distinct incidents that happen to share a
//     title prefix (rare for structured ATT&CK / KEV titles; acceptable at MVP)
// Full primary-source dedup (§B7) must be enforced at claim-level in the ingest
// pipeline, not here at the candidate-detection stage.
async function isDuplicateCandidate(db: Db, title: string): Promise<boolean> {
  const res = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM review_queue WHERE candidate_title = $1`,
    [title],
  );
  return parseInt(res.rows[0]!.count, 10) > 0;
}

// CVE dedup: if any CVE from this advisory already appears in the review queue
// (from a different source), note the collision for the human reviewer. The
// advisory is still ingested — it may provide G1 corroboration for an existing
// CISA KEV entry.
async function buildCveDedupNote(db: Db, cveIds: string[]): Promise<string | null> {
  if (cveIds.length === 0) return null;
  for (const cve of cveIds) {
    const res = await db.query<{ id: number; candidate_title: string }>(
      `SELECT id, candidate_title FROM review_queue WHERE candidate_text ILIKE $1 LIMIT 1`,
      [`%${cve}%`],
    );
    const row = res.rows[0] ?? null;
    if (row !== null) {
      return (
        `[CVE dedup: ${cve} is covered by existing review item #${row.id} ` +
        `("${row.candidate_title}"). This advisory provides additional G1 ` +
        `corroboration — reviewer may merge.]`
      );
    }
  }
  return null;
}

export async function handleFeedPoll(
  db: Db,
  payload: FeedPollPayload,
  fetchStixFn: FetchAttackStixFn = fetchAttackStix,
  fetchKevFn: FetchKevFn = fetchKev,
  // When undefined (production), creates Anthropic clients from env; inject a
  // mock in tests to avoid API key requirements.
  fetchNcscFn?: FetchNcscFn,
): Promise<{ enqueued: number }> {
  let enqueued = 0;

  if (payload.source === "attack-stix") {
    const stix = await fetchStixFn();
    for (const group of stix.groups) {
      const title = `ATT&CK Group: ${group.name} (${group.mitre_id})`;
      if (await isDuplicateCandidate(db, title)) continue;

      const detected: IncidentDetectedPayload = {
        source: "attack-stix",
        candidate_title: title,
        candidate_text:
          group.description ||
          `MITRE ATT&CK threat group ${group.name} (${group.mitre_id})`,
        tier_ceiling: "CONFIRMED",
      };
      await enqueueJob(db, "incident.detected", detected);
      enqueued++;
    }
  } else if (payload.source === "cisa-kev") {
    const kev = await fetchKevFn();
    for (const entry of kev.entries) {
      if (entry.knownRansomwareCampaignUse !== "Known") continue;

      const title = `CISA KEV: ${entry.cveID} — ${entry.vulnerabilityName}`;
      if (await isDuplicateCandidate(db, title)) continue;

      const detected: IncidentDetectedPayload = {
        source: "cisa-kev",
        candidate_title: title,
        candidate_text: `${entry.vendorProject} ${entry.product}: ${entry.shortDescription}`,
        tier_ceiling: "CONFIRMED",
      };
      await enqueueJob(db, "incident.detected", detected);
      enqueued++;
    }
  } else if (payload.source === "ncsc-publications") {
    // Build the NCSC fetcher. When a mock is injected (tests), use it directly.
    // In production, validate the API key eagerly so a missing key fails at
    // poll time rather than silently during claim extraction.
    let ncscFetcher = fetchNcscFn;
    if (!ncscFetcher) {
      const apiKey = process.env["ANTHROPIC_API_KEY"];
      if (!apiKey) {
        throw new Error(
          "ANTHROPIC_API_KEY environment variable is required for ncsc-publications feed polling",
        );
      }
      const triageLlm = createAnthropicClient(TRIAGE_MODEL, apiKey);
      const extractionLlm = createAnthropicClient(EXTRACTION_MODEL, apiKey);
      ncscFetcher = () => fetchNcscPublications({ triageLlm, extractionLlm });
    }

    const items = await ncscFetcher();

    for (const item of items) {
      if (item.triage_status === "non-advisory") continue;

      if (item.triage_status === "uncertain") {
        // Low classifier confidence: route directly to human review queue.
        // No incident.detected job — no reconstruction until a human validates
        // that this is a genuine advisory (Invariant 11).
        await createReviewItem(db, {
          feed_job_id: null,
          type: "new-incident",
          candidate_title: item.title,
          candidate_text:
            `${item.text.slice(0, 500)}\n\n` +
            `[TRIAGE UNCERTAIN — confidence: ${item.triage.confidence.toFixed(2)}. ` +
            `Reason: ${item.triage.reason}. Human review required before reconstruction.]`,
          tier_ceiling: item.tier_ceiling,
        });
        continue;
      }

      // Confirmed advisory — title dedup, then CVE collision note, then enqueue.
      if (await isDuplicateCandidate(db, item.title)) continue;

      const cveNote = await buildCveDedupNote(db, item.cve_ids);
      const candidateText = cveNote ? `${item.text}\n\n${cveNote}` : item.text;

      const detected: IncidentDetectedPayload = {
        source: "ncsc-publications",
        candidate_title: item.title,
        candidate_text: candidateText,
        tier_ceiling: item.tier_ceiling,
      };
      await enqueueJob(db, "incident.detected", detected);
      enqueued++;
    }
  }

  return { enqueued };
}

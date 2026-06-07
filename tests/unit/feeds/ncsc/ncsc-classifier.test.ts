/**
 * NCSC publications feed — acceptance criterion tests.
 *
 * Four criteria mapped directly from the plan sign-off:
 *   N1 — low-confidence triage → review queue only, not claim store
 *   N2 — negated claim is dropped by filterNegatedClaims
 *   N3 — "we assess" language → REPORTED tier; not promoted by NCSC G1 ceiling
 *   N4 — blog post / conference announcement → discarded entirely
 */
import { describe, it, expect } from "vitest";
import { createMigratedDb } from "@store";
import type { Db } from "@store";
import { handleFeedPoll } from "@queue";
import { filterNegatedClaims, applyTierCeiling } from "@sector/feeds/ncsc/claim-processor.js";
import type { NcscClaim, NcscFeedItem } from "@sector/feeds/ncsc/types.js";

async function freshDb(): Promise<Db> {
  return createMigratedDb();
}

const baseAdvisoryItem: NcscFeedItem = {
  title: "Vulnerability affecting F5 BIG-IP APM (CVE-2025-53521)",
  url: "https://www.ncsc.gov.uk/news/vulnerability-affecting-f5-big-ip-apm",
  text: "The NCSC is encouraging UK organisations to mitigate an unauthenticated remote code execution vulnerability affecting F5 BIG-IP APM. CVE-2025-53521 has been confirmed exploited in the wild.",
  pub_date: "Sat, 07 Jun 2026 12:00:00 +0000",
  tier_ceiling: "CONFIRMED",
  independence_group: "G1",
  claims: [],
  cve_ids: ["CVE-2025-53521"],
  triage: { advisory: true, confidence: 0.92, reason: "CVE reference and exploitation confirmed" },
  triage_status: "advisory",
};

describe("[NCSC-N] NCSC feed acceptance criteria", () => {
  // ── [NCSC-N1] Low-confidence triage → review queue, not claim store ───────
  it("[NCSC-N1] RSS item with low classifier confidence routes to review queue with no reconstruction job", async () => {
    const db: Db = await freshDb();

    const uncertainItem: NcscFeedItem = {
      ...baseAdvisoryItem,
      title: "NCSC publishes new guidance on secure software development",
      triage: {
        advisory: true,
        confidence: 0.4,
        reason: "discusses vulnerabilities generally but does not describe a specific incident",
      },
      triage_status: "uncertain",
    };

    const mockFetchNcsc = async (): Promise<NcscFeedItem[]> => [uncertainItem];

    await handleFeedPoll(
      db,
      { source: "ncsc-publications" },
      undefined,
      undefined,
      mockFetchNcsc,
    );

    // Review item must be present in the pending queue.
    const reviews = await db.query<{ id: number; status: string; candidate_title: string }>(
      `SELECT id, status, candidate_title FROM review_queue`,
    );
    expect(reviews.rows).toHaveLength(1);
    expect(reviews.rows[0]!.status).toBe("pending");
    expect(reviews.rows[0]!.candidate_title).toBe(uncertainItem.title);

    // No incident.detected job — reconstruction must not have been triggered.
    const jobs = await db.query<{ job_type: string }>(
      `SELECT job_type FROM jobs WHERE job_type = 'incident.detected'`,
    );
    expect(jobs.rows).toHaveLength(0);
  });

  // ── [NCSC-N2] Negated claim is not extracted ──────────────────────────────
  it("[NCSC-N2] filterNegatedClaims drops claims where negated: true; non-negated claims are kept", () => {
    const claims: NcscClaim[] = [
      {
        technique_id: "T1021",
        claim_text: "There is no evidence of lateral movement via T1021 in this incident.",
        actors: [],
        affected_products: [],
        cve_ids: [],
        tier: "CONFIRMED",
        negated: true,
      },
      {
        technique_id: "T1078",
        claim_text: "Attackers used valid accounts (T1078) to authenticate to the target.",
        actors: [],
        affected_products: [],
        cve_ids: [],
        tier: "CONFIRMED",
        negated: false,
      },
    ];

    const result = filterNegatedClaims(claims);

    expect(result).toHaveLength(1);
    expect(result[0]!.technique_id).toBe("T1078");
    // The negated lateral-movement claim must not appear.
    expect(result.find((c) => c.technique_id === "T1021")).toBeUndefined();
  });

  // ── [NCSC-N3] "we assess" language → REPORTED tier, not promoted to CONFIRMED
  it("[NCSC-N3] REPORTED-tier claim is not promoted to CONFIRMED by NCSC source-class ceiling", () => {
    const claims: NcscClaim[] = [
      {
        technique_id: null,
        // "we assess" → REPORTED per extraction tier derivation rules
        claim_text:
          "We assess that the threat actor is likely using valid domain credentials " +
          "obtained via phishing to maintain access.",
        actors: [],
        affected_products: [],
        cve_ids: [],
        tier: "REPORTED",
        negated: false,
      },
    ];

    // NCSC source-class ceiling is CONFIRMED — apply it as a cap.
    const result = applyTierCeiling(claims, "CONFIRMED");

    expect(result).toHaveLength(1);
    // Ceiling is a cap, not a floor. REPORTED must not be promoted to CONFIRMED.
    expect(result[0]!.tier).toBe("REPORTED");
    expect(result[0]!.tier).not.toBe("CONFIRMED");
  });

  // ── [NCSC-N4] Blog / conference announcement → discarded, not in claim store
  it("[NCSC-N4] blog post or conference announcement does not enter review queue or claim store regardless of CVE mentions", async () => {
    const db: Db = await freshDb();

    // Triage classified this as non-advisory despite CVE in the title text.
    const nonAdvisoryItem: NcscFeedItem = {
      ...baseAdvisoryItem,
      title: "CYBERUK 2026: register now — keynotes on CVE-2026-1234 and AI security",
      cve_ids: ["CVE-2026-1234"],
      triage: {
        advisory: false,
        confidence: 0.97,
        reason: "conference registration announcement, not a security advisory",
      },
      triage_status: "non-advisory",
    };

    const mockFetchNcsc = async (): Promise<NcscFeedItem[]> => [nonAdvisoryItem];

    await handleFeedPoll(
      db,
      { source: "ncsc-publications" },
      undefined,
      undefined,
      mockFetchNcsc,
    );

    // Item must have been discarded — nothing in review queue or jobs.
    const reviews = await db.query<{ id: number }>(
      `SELECT id FROM review_queue`,
    );
    expect(reviews.rows).toHaveLength(0);

    const jobs = await db.query<{ id: number }>(
      `SELECT id FROM jobs WHERE job_type = 'incident.detected'`,
    );
    expect(jobs.rows).toHaveLength(0);
  });
});

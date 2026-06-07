import type { Db } from "@store";
import { enqueueJob } from "@store";
import { fetchAttackStix } from "@sector/feeds/attack-stix.js";
import { fetchKev } from "@sector/feeds/cisa-kev.js";
import type {
  AttackStixResult,
  KevFeedResult,
} from "@sector";
import type { FeedPollPayload, IncidentDetectedPayload } from "../types.js";

type FetchAttackStixFn = () => Promise<AttackStixResult>;
type FetchKevFn = () => Promise<KevFeedResult>;

async function isDuplicateCandidate(
  db: Db,
  title: string,
): Promise<boolean> {
  const res = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM review_queue WHERE candidate_title = $1`,
    [title],
  );
  return parseInt(res.rows[0]!.count, 10) > 0;
}

export async function handleFeedPoll(
  db: Db,
  payload: FeedPollPayload,
  fetchStixFn: FetchAttackStixFn = fetchAttackStix,
  fetchKevFn: FetchKevFn = fetchKev,
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
  } else {
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
  }

  return { enqueued };
}

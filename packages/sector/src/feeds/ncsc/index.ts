import type { NcscFeedItem, NcscFeedConfig, NcscTriageStatus } from "./types.js";
import {
  NCSC_FEEDS,
  TRIAGE_CONFIDENCE_THRESHOLD,
  NCSC_SOURCE_CLASS_CEILING,
} from "./constants.js";
import { parseNcscFeed } from "./rss-parser.js";
import { triageItem } from "./triage.js";
import { fetchAdvisoryHtml } from "./html-fetcher.js";
import { extractClaims } from "./llm-extractor.js";
import { filterNegatedClaims, applyTierCeiling, extractCveIds } from "./claim-processor.js";

export { createAnthropicClient } from "./anthropic-client.js";
export type {
  NcscFeedItem,
  NcscFeedConfig,
  NcscClaim,
  LlmClient,
  NcscTriageStatus,
} from "./types.js";
export { filterNegatedClaims, applyTierCeiling, extractCveIds } from "./claim-processor.js";

export async function fetchNcscPublications(
  config: NcscFeedConfig,
): Promise<NcscFeedItem[]> {
  const {
    triageLlm,
    extractionLlm,
    fetchFn = fetch,
    feedUrls = NCSC_FEEDS,
  } = config;

  const allItems: NcscFeedItem[] = [];

  for (const feedUrl of feedUrls) {
    let xml: string;
    try {
      const resp = await fetchFn(feedUrl);
      if (!resp.ok) {
        console.warn(`[ncsc-feed] Feed fetch failed ${feedUrl}: ${resp.status}`);
        continue;
      }
      xml = await resp.text();
    } catch (err) {
      console.warn(`[ncsc-feed] Feed fetch error ${feedUrl}: ${String(err)}`);
      continue;
    }

    const rssItems = parseNcscFeed(xml);

    for (const rssItem of rssItems) {
      let triageResult;
      try {
        triageResult = await triageItem(rssItem, triageLlm);
      } catch (err) {
        console.warn(`[ncsc-feed] Triage failed for "${rssItem.title}": ${String(err)}`);
        continue;
      }

      const triageStatus: NcscTriageStatus = !triageResult.advisory
        ? "non-advisory"
        : triageResult.confidence < TRIAGE_CONFIDENCE_THRESHOLD
          ? "uncertain"
          : "advisory";

      if (triageStatus === "non-advisory") continue;

      if (triageStatus === "uncertain") {
        allItems.push({
          title: rssItem.title,
          url: rssItem.link,
          text: rssItem.description,
          pub_date: rssItem.pubDate,
          tier_ceiling: NCSC_SOURCE_CLASS_CEILING,
          independence_group: "G1",
          claims: [],
          cve_ids: extractCveIds(rssItem.description),
          triage: triageResult,
          triage_status: "uncertain",
        });
        continue;
      }

      // Confirmed advisory — fetch full HTML text and extract claims.
      let text: string;
      try {
        text = await fetchAdvisoryHtml(rssItem.link, fetchFn);
      } catch (err) {
        console.warn(`[ncsc-feed] HTML fetch failed for "${rssItem.title}": ${String(err)}`);
        text = rssItem.description;
      }

      let rawClaims: Awaited<ReturnType<typeof extractClaims>>;
      try {
        rawClaims = await extractClaims(text, extractionLlm);
      } catch (err) {
        console.warn(
          `[ncsc-feed] Claim extraction failed for "${rssItem.title}": ${String(err)}`,
        );
        rawClaims = [];
      }

      const claims = applyTierCeiling(
        filterNegatedClaims(rawClaims),
        NCSC_SOURCE_CLASS_CEILING,
      );

      allItems.push({
        title: rssItem.title,
        url: rssItem.link,
        text,
        pub_date: rssItem.pubDate,
        tier_ceiling: NCSC_SOURCE_CLASS_CEILING,
        independence_group: "G1",
        claims,
        cve_ids: extractCveIds(text),
        triage: triageResult,
        triage_status: "advisory",
      });
    }
  }

  return allItems;
}

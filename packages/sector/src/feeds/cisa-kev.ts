/**
 * CISA Known Exploited Vulnerabilities (KEV) feed fetcher.
 *
 * Source: https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json
 * Updated daily by CISA. Structured JSON — no HTML parsing needed.
 */
import type { KevEntry } from "../schema.js";

const KEV_URL =
  "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

interface KevFeedResponse {
  title: string;
  catalogVersion: string;
  dateReleased: string;
  count: number;
  vulnerabilities: Array<{
    cveID: string;
    vendorProject: string;
    product: string;
    vulnerabilityName: string;
    dateAdded: string;
    shortDescription: string;
    requiredAction: string;
    dueDate: string;
    knownRansomwareCampaignUse: string;
    notes: string;
  }>;
}

export interface KevFeedResult {
  version: string;
  released: string;
  entries: KevEntry[];
}

export async function fetchKev(
  url = KEV_URL,
): Promise<KevFeedResult> {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`CISA KEV fetch failed: ${resp.status} ${resp.statusText}`);
  }
  const data = (await resp.json()) as KevFeedResponse;
  return {
    version: data.catalogVersion,
    released: data.dateReleased,
    entries: data.vulnerabilities.map((v) => ({
      cveID: v.cveID,
      vendorProject: v.vendorProject,
      product: v.product,
      vulnerabilityName: v.vulnerabilityName,
      dateAdded: v.dateAdded,
      shortDescription: v.shortDescription,
      knownRansomwareCampaignUse: v.knownRansomwareCampaignUse,
    })),
  };
}

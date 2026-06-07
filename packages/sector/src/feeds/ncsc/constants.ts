import type { EvidenceTier } from "@store";

export const NCSC_FEEDS = [
  "https://www.ncsc.gov.uk/api/1/services/v1/news-rss-feed.xml",
  "https://www.ncsc.gov.uk/api/1/services/v1/report-rss-feed.xml",
] as const;

export const TRIAGE_CONFIDENCE_THRESHOLD = 0.7;
export const NCSC_SOURCE_CLASS_CEILING: EvidenceTier = "CONFIRMED";

// Update these constants to upgrade the models used for NCSC feed processing.
export const TRIAGE_MODEL = "claude-haiku-4-5-20251001";
export const EXTRACTION_MODEL = "claude-sonnet-4-6";

/**
 * Source & Authority Registry — Part B (incident-source registry).
 *
 * Encodes docs/source_authority_registry.md §B1–B6: for each known source, its
 * independence group (§B7), incentive-bias direction, source class, and whether
 * it is a primary or a derivative. This is the authority that tags an incoming
 * source so the independence (§B7) and admissibility (§B8) logic can run.
 *
 * It is a maintained artefact (registry is v1, re-validate quarterly), not an
 * exhaustive list — unknown sources fall through to a conservative default.
 */
import type { IndependenceGroup, SourceClass } from "./types.js";

export interface RegistryEntry {
  /** Stable key for the source family. */
  key: string;
  /** Domains / identifiers that match this source. */
  match: string[];
  independence_group: IndependenceGroup;
  source_class: SourceClass;
  /** Direction of incentive bias to surface alongside the source. */
  incentive_bias: string;
  /** Whether this source is typically an original/primary reporter. */
  is_primary: boolean;
  /** Vendor incentive flag (§A — vendor baselines/BAS are incentive-flagged). */
  vendor_flagged?: boolean;
}

export const SOURCE_REGISTRY: readonly RegistryEntry[] = [
  // §B1 — government / regulator (G1)
  {
    key: "ncsc",
    match: ["ncsc.gov.uk"],
    independence_group: "G1",
    source_class: "government",
    incentive_bias: "regulator: understates pending investigation; treat as floor not full picture",
    is_primary: true,
  },
  {
    key: "cisa",
    match: ["cisa.gov"],
    independence_group: "G1",
    source_class: "government",
    incentive_bias: "regulator: floor not full picture",
    is_primary: true,
  },
  {
    key: "fbi-ic3",
    match: ["fbi.gov", "ic3.gov"],
    independence_group: "G1",
    source_class: "government",
    incentive_bias: "law enforcement: conservative pending prosecution",
    is_primary: true,
  },
  {
    key: "ico",
    match: ["ico.org.uk"],
    independence_group: "G1",
    source_class: "regulator",
    incentive_bias: "regulator: lagging; often the only public UK detail",
    is_primary: true,
  },
  {
    key: "cmc",
    match: ["cybermonitoringcentre.com"],
    independence_group: "G1",
    source_class: "regulator",
    incentive_bias: "independent authority: conservative systemic categorisation; lags the event",
    is_primary: true,
  },
  {
    key: "parliament",
    match: ["parliament.uk", "committees.parliament.uk", "congress.gov", "hansard"],
    independence_group: "G1",
    source_class: "government",
    incentive_bias: "parliamentary/congressional record: authoritative as to testimony given",
    is_primary: true,
  },
  {
    key: "doj-nca",
    match: ["justice.gov", "nationalcrimeagency.gov.uk"],
    independence_group: "G1",
    source_class: "government",
    incentive_bias: "indictments/court filings: conservative; allegations until proven",
    is_primary: true,
  },
  {
    key: "enisa",
    match: ["enisa.europa.eu"],
    independence_group: "G1",
    source_class: "government",
    incentive_bias: "EU aggregate context; not incident-specific",
    is_primary: true,
  },

  // §B2 — mandatory / official victim disclosure (G2)
  {
    key: "sec-edgar",
    match: ["sec.gov", "edgar"],
    independence_group: "G2",
    source_class: "victim-disclosure",
    incentive_bias: "victim: frames for liability; trust the fact of disclosure over its characterisation",
    is_primary: true,
  },
  {
    key: "lse-rns",
    match: ["londonstockexchange.com", "investegate.co.uk", "rns"],
    independence_group: "G2",
    source_class: "victim-disclosure",
    incentive_bias: "victim: under-claims severity; trust the fact of disclosure",
    is_primary: true,
  },
  {
    key: "state-ag",
    match: ["oag.ca.gov", "maine.gov", "atg.wa.gov"],
    independence_group: "G2",
    source_class: "victim-disclosure",
    incentive_bias: "victim mandatory notice: structured, often earliest US confirmation",
    is_primary: true,
  },

  // §B3 — first-hand IR / telemetry (G3)
  {
    key: "mandiant-gtig",
    match: ["mandiant.com", "cloud.google.com", "gtig"],
    independence_group: "G3",
    source_class: "ir-firm",
    incentive_bias: "IR firm: over-claims own detection efficacy; trust raw observations, discount 'we would have caught this'",
    is_primary: true,
  },
  {
    key: "crowdstrike",
    match: ["crowdstrike.com"],
    independence_group: "G3",
    source_class: "ir-firm",
    incentive_bias: "IR firm: trust telemetry, discount product-efficacy claims",
    is_primary: true,
  },
  {
    key: "microsoft-mstic",
    match: ["microsoft.com", "mstic"],
    independence_group: "G3",
    source_class: "ir-firm",
    incentive_bias: "IR firm: trust telemetry, discount product-efficacy claims",
    is_primary: true,
  },
  {
    key: "unit42",
    match: ["unit42.paloaltonetworks.com", "paloaltonetworks.com"],
    independence_group: "G3",
    source_class: "ir-firm",
    incentive_bias: "IR firm: trust telemetry, discount product-efficacy claims",
    is_primary: true,
  },
  {
    key: "sophos-xops",
    match: ["sophos.com"],
    independence_group: "G3",
    source_class: "ir-firm",
    incentive_bias: "IR firm: trust telemetry, discount product-efficacy claims",
    is_primary: true,
  },
  {
    key: "secureworks",
    match: ["secureworks.com"],
    independence_group: "G3",
    source_class: "ir-firm",
    incentive_bias: "IR firm: trust telemetry, discount product-efficacy claims",
    is_primary: true,
  },
  {
    key: "ncc-group",
    match: ["nccgroup.com"],
    independence_group: "G3",
    source_class: "ir-firm",
    incentive_bias: "IR firm: trust telemetry, discount product-efficacy claims",
    is_primary: true,
  },
  {
    key: "darktrace",
    match: ["darktrace.com"],
    independence_group: "G3",
    source_class: "ir-firm",
    incentive_bias: "IR firm: trust telemetry, discount product-efficacy claims",
    is_primary: true,
  },

  // §B4 — specialist press primaries (G4)
  {
    key: "bleepingcomputer",
    match: ["bleepingcomputer.com"],
    independence_group: "G4",
    source_class: "specialist-press",
    incentive_bias: "specialist press primary: reliant on unnamed sources; collapse derivatives to this before counting",
    is_primary: true,
  },
  {
    key: "the-record",
    match: ["therecord.media", "recordedfuture"],
    independence_group: "G4",
    source_class: "specialist-press",
    incentive_bias: "specialist press primary",
    is_primary: true,
  },
  {
    key: "krebs",
    match: ["krebsonsecurity.com"],
    independence_group: "G4",
    source_class: "specialist-press",
    incentive_bias: "specialist press primary",
    is_primary: true,
  },
  {
    key: "databreaches",
    match: ["databreaches.net"],
    independence_group: "G4",
    source_class: "specialist-press",
    incentive_bias: "specialist press primary",
    is_primary: true,
  },
  {
    key: "risky-business",
    match: ["risky.biz"],
    independence_group: "G4",
    source_class: "specialist-press",
    incentive_bias: "specialist press primary",
    is_primary: true,
  },
  {
    key: "majors",
    match: ["reuters.com", "ft.com", "bloomberg.com", "bbc.co.uk", "theguardian.com"],
    independence_group: "G4",
    source_class: "major-press",
    incentive_bias: "major outlet: often derivative of specialist press; collapse to primary before counting",
    is_primary: false,
  },

  // §B5 — actor-pattern intel (INFERRED only)
  {
    key: "actor-advisory",
    match: ["attack.mitre.org/groups", "aa23-", "aa24-", "aa25-"],
    independence_group: "B5",
    source_class: "actor-advisory",
    incentive_bias: "actor-pattern intel: never incident-fact; populates inferred/analogous tiers only",
    is_primary: true,
  },

  // §B6 — structured feeds / leak-site trackers (actor-claim only)
  {
    key: "leak-site",
    match: ["ransomware.live", "ransomwatch", "ransomlook", "leak-site"],
    independence_group: "B6",
    source_class: "leak-site",
    incentive_bias: "criminal actor-claim: excluded as victim-fact (§B8); INFERRED-about-actor only",
    is_primary: false,
  },
  {
    key: "feeds",
    match: ["kev", "misp", "otx", "opencti"],
    independence_group: "B6",
    source_class: "feed",
    incentive_bias: "machine feed: discovery only, not victim-fact",
    is_primary: false,
  },
];

/** Conservative default for an unrecognised source. */
export const DEFAULT_ENTRY: RegistryEntry = {
  key: "unknown",
  match: [],
  independence_group: "G4",
  source_class: "rumour",
  incentive_bias: "unrecognised source: treat as single-source rumour pending classification (§B8)",
  is_primary: false,
};

/**
 * Classify a source by name/URL against the registry. Matching is
 * case-insensitive substring on the provided identifiers. Returns the default
 * entry (conservative) when nothing matches.
 */
export function classifySource(identifiers: string[]): RegistryEntry {
  const haystacks = identifiers.map((i) => i.toLowerCase());
  for (const entry of SOURCE_REGISTRY) {
    for (const token of entry.match) {
      const t = token.toLowerCase();
      if (haystacks.some((h) => h.includes(t))) return entry;
    }
  }
  return DEFAULT_ENTRY;
}

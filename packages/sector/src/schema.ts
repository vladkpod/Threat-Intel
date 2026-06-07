/**
 * Product B output types.
 *
 * SectorSummary is derived from ATT&CK Group/Campaign STIX objects (sector targeting)
 * plus CISA KEV (active exploitation evidence). It is NOT routed through the
 * single-incident reconstruct() engine.
 */

export interface KevEntry {
  cveID: string;
  vendorProject: string;
  product: string;
  vulnerabilityName: string;
  dateAdded: string;
  shortDescription: string;
  knownRansomwareCampaignUse: string;
}

export interface ThreatGroupEntry {
  id: string;
  name: string;
  aliases: string[];
  technique_ids: string[];
  sectors: string[];
  description: string;
}

export interface TechniqueFrequency {
  technique_id: string;
  name: string;
  count: number;
}

export interface SectorSummary {
  sector: string;
  threat_group_count: number;
  threat_groups: ThreatGroupEntry[];
  top_techniques: TechniqueFrequency[];
  kev_count: number;
  recent_kevs: KevEntry[];
}

export interface SectorView {
  generated_at: string;
  attack_version: string;
  kev_version: string;
  sectors: SectorSummary[];
}

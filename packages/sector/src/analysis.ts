/**
 * Sector clustering: maps ATT&CK Groups and CISA KEV to per-sector summaries.
 *
 * Pipeline (separate from the single-incident engine):
 *   ATT&CK STIX groups + KEV feed → sector summaries
 *
 * KEV linkage: CVEs tagged "Known Ransomware Campaign Use" are associated with
 * every sector to reflect undifferentiated ransomware exposure. Other KEVs are
 * associated with sectors whose threat groups are documented to use the products
 * listed in the KEV (heuristic: product name word-overlap with group descriptions).
 */
import type { AttackGroup, AttackStixResult } from "./feeds/attack-stix.js";
import type { KevFeedResult } from "./feeds/cisa-kev.js";
import type { SectorSummary, SectorView, TechniqueFrequency } from "./schema.js";

function normalise(sector: string): string {
  return sector.trim().toLowerCase().replace(/[\s/]+/g, "-");
}

function topN<T>(items: T[], key: (t: T) => number, n = 10): T[] {
  return [...items].sort((a, b) => key(b) - key(a)).slice(0, n);
}

export function buildSectorView(
  stix: AttackStixResult,
  kev: KevFeedResult,
): SectorView {
  // Collect all distinct sector labels.
  const allSectors = new Set<string>();
  for (const g of stix.groups) {
    for (const s of g.sectors) {
      allSectors.add(normalise(s));
    }
  }

  // Groups that declare no sector are skipped for the sector view;
  // they are still accessible via the raw group list if needed.

  const summaries: SectorSummary[] = [];

  for (const rawSector of allSectors) {
    const groups = stix.groups.filter((g) =>
      g.sectors.map(normalise).includes(rawSector),
    );

    // Technique frequency across all groups in this sector.
    const techCount = new Map<string, number>();
    for (const g of groups) {
      for (const t of g.technique_ids) {
        techCount.set(t, (techCount.get(t) ?? 0) + 1);
      }
    }
    const topTechniques: TechniqueFrequency[] = topN(
      Array.from(techCount.entries()).map(([technique_id, count]) => ({
        technique_id,
        name: technique_id,
        count,
      })),
      (t) => t.count,
      10,
    );

    // KEV exposure: ransomware-flagged CVEs apply to all sectors;
    // others are heuristically linked via product-name word overlap with group descriptions.
    const sectorGroupNames = new Set(
      groups.flatMap((g) => [
        g.name.toLowerCase(),
        ...g.aliases.map((a) => a.toLowerCase()),
        ...g.description.toLowerCase().split(/\s+/),
      ]),
    );

    const relevantKevs = kev.entries.filter((entry) => {
      if (entry.knownRansomwareCampaignUse === "Known") return true;
      const productWords = entry.product.toLowerCase().split(/\s+/);
      return productWords.some((w) => w.length > 3 && sectorGroupNames.has(w));
    });

    summaries.push({
      sector: rawSector,
      threat_group_count: groups.length,
      threat_groups: groups.map((g) => ({
        id: g.mitre_id,
        name: g.name,
        aliases: g.aliases,
        technique_ids: g.technique_ids,
        sectors: g.sectors,
        description: g.description,
      })),
      top_techniques: topTechniques,
      kev_count: relevantKevs.length,
      recent_kevs: relevantKevs
        .sort((a, b) => b.dateAdded.localeCompare(a.dateAdded))
        .slice(0, 5),
    });
  }

  // Sort sectors by threat group count descending.
  summaries.sort((a, b) => b.threat_group_count - a.threat_group_count);

  return {
    generated_at: new Date().toISOString(),
    attack_version: stix.version,
    kev_version: kev.version,
    sectors: summaries,
  };
}

/** Convenience: fetch both feeds and build the view in one call. */
export async function fetchSectorView(opts?: {
  attackUrl?: string;
  kevUrl?: string;
}): Promise<SectorView> {
  const [attackModule, kevModule] = await Promise.all([
    import("./feeds/attack-stix.js"),
    import("./feeds/cisa-kev.js"),
  ]);

  const [stix, kev] = await Promise.all([
    attackModule.fetchAttackStix(opts?.attackUrl),
    kevModule.fetchKev(opts?.kevUrl),
  ]);

  return buildSectorView(stix, kev);
}

export function groupsForSector(
  groups: AttackGroup[],
  sector: string,
): AttackGroup[] {
  const norm = normalise(sector);
  return groups.filter((g) => g.sectors.map(normalise).includes(norm));
}

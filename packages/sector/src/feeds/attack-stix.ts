/**
 * MITRE ATT&CK STIX bundle loader.
 *
 * Loads Group and Campaign objects from the enterprise ATT&CK STIX bundle.
 * Groups carry x-mitre-sectors (industries targeted) and link to Techniques
 * via uses-relationships. Campaigns link to Groups.
 *
 * Source: https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json
 *
 * Note: x_mitre_sectors is sparsely populated in the STIX bundle. When empty,
 * sectors are inferred from group description keywords (see inferSectors).
 */

const STIX_URL =
  "https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json";

/** ATT&CK 16.1 is the pinned version for this deployment. */
const PINNED_VERSION = "16.1";

const SECTOR_KEYWORD_MAP: Array<{ sector: string; keywords: RegExp }> = [
  { sector: "Financial Services", keywords: /\b(bank|financ|credit|swift|payment|cryptocurrency|currency|investment|insurance)\b/i },
  { sector: "Government", keywords: /\b(government|ministry|department|federal|nation.{0,4}state|public sector|parliament|diplomatic|embassy|politic)\b/i },
  { sector: "Defense", keywords: /\b(defense|defence|military|arm(y|ed forces)|nato|pentagon|airforce|navy|soldier|weapon)\b/i },
  { sector: "Energy", keywords: /\b(energy|oil|gas|nuclear|power grid|utility|electric|pipeline|petroleum|refin)\b/i },
  { sector: "Healthcare", keywords: /\b(health|hospital|medical|pharma|clinical|patient|biotech|life science)\b/i },
  { sector: "Telecommunications", keywords: /\b(telecom|telecommunication|mobile operator|isp|internet provider|carrier)\b/i },
  { sector: "Technology", keywords: /\b(tech(nology)?|software|hardware|it service|managed service|vendor|developer|data center)\b/i },
  { sector: "Aerospace", keywords: /\b(aerospace|aviation|airline|aircraft|satellite|space agency)\b/i },
  { sector: "Manufacturing", keywords: /\b(manufactur|industrial|factory|production|supply chain|automotive)\b/i },
  { sector: "Education", keywords: /\b(university|college|school|research institution|academic|education)\b/i },
  { sector: "Transportation", keywords: /\b(transport|logistics|shipping|maritime|rail|trucking|port)\b/i },
];

function inferSectors(description: string): string[] {
  const matched: string[] = [];
  for (const entry of SECTOR_KEYWORD_MAP) {
    if (entry.keywords.test(description)) {
      matched.push(entry.sector);
    }
  }
  return matched;
}

interface StixObject {
  id: string;
  type: string;
  name?: string;
  description?: string;
  aliases?: string[];
  external_references?: Array<{ source_name: string; external_id?: string }>;
  x_mitre_sectors?: string[];
  relationship_type?: string;
  source_ref?: string;
  target_ref?: string;
  spec_version?: string;
}

interface StixBundle {
  type: "bundle";
  id: string;
  spec_version: string;
  objects: StixObject[];
}

export interface AttackGroup {
  stix_id: string;
  mitre_id: string;
  name: string;
  aliases: string[];
  description: string;
  sectors: string[];
  technique_ids: string[];
}

export interface AttackStixResult {
  version: string;
  groups: AttackGroup[];
}

export async function fetchAttackStix(
  url = STIX_URL,
): Promise<AttackStixResult> {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`ATT&CK STIX fetch failed: ${resp.status} ${resp.statusText}`);
  }
  const bundle = (await resp.json()) as StixBundle;
  const objects = bundle.objects ?? [];

  // Index technique STIX IDs → external T-IDs.
  const techniqueExternalId = new Map<string, string>();
  for (const obj of objects) {
    if (obj.type === "attack-pattern") {
      const extRef = obj.external_references?.find(
        (r) => r.source_name === "mitre-attack",
      );
      if (extRef?.external_id) {
        techniqueExternalId.set(obj.id, extRef.external_id);
      }
    }
  }

  // Build group STIX ID → technique T-IDs via "uses" relationships.
  const groupTechniques = new Map<string, Set<string>>();
  for (const obj of objects) {
    if (
      obj.type === "relationship" &&
      obj.relationship_type === "uses" &&
      obj.source_ref?.startsWith("intrusion-set--") &&
      obj.target_ref?.startsWith("attack-pattern--")
    ) {
      const tId = techniqueExternalId.get(obj.target_ref);
      if (tId) {
        const set = groupTechniques.get(obj.source_ref) ?? new Set<string>();
        set.add(tId);
        groupTechniques.set(obj.source_ref, set);
      }
    }
  }

  // Collect groups with sector data.
  const groups: AttackGroup[] = [];
  for (const obj of objects) {
    if (obj.type !== "intrusion-set") continue;
    const extRef = obj.external_references?.find(
      (r) => r.source_name === "mitre-attack",
    );
    if (!extRef?.external_id) continue;

    const description = obj.description ?? "";
    const primarySectors = obj.x_mitre_sectors ?? [];
    const sectors = primarySectors.length > 0
      ? primarySectors
      : inferSectors(description);

    groups.push({
      stix_id: obj.id,
      mitre_id: extRef.external_id,
      name: obj.name ?? "Unknown",
      aliases: obj.aliases ?? [],
      description,
      sectors,
      technique_ids: Array.from(groupTechniques.get(obj.id) ?? []),
    });
  }

  // ATT&CK version from x-mitre-collection or matrix object.
  const versionObj = objects.find(
    (o) =>
      o.type === "x-mitre-collection" ||
      o.type === "x-mitre-matrix",
  );
  const versionAny = versionObj as unknown as Record<string, unknown> | undefined;
  const rawVersion = (versionAny?.["x_mitre_version"] as string | undefined);
  // Normalise version — MITRE sometimes publishes "16" without the minor version.
  const version = rawVersion
    ? (rawVersion.includes(".") ? rawVersion : `${rawVersion}.0`)
    : PINNED_VERSION;

  return { version, groups };
}

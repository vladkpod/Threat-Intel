/**
 * MITRE ATT&CK STIX bundle loader.
 *
 * Loads Group and Campaign objects from the enterprise ATT&CK STIX bundle.
 * Groups carry x-mitre-sectors (industries targeted) and link to Techniques
 * via uses-relationships. Campaigns link to Groups.
 *
 * Source: https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json
 */

const STIX_URL =
  "https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json";

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

    groups.push({
      stix_id: obj.id,
      mitre_id: extRef.external_id,
      name: obj.name ?? "Unknown",
      aliases: obj.aliases ?? [],
      description: obj.description ?? "",
      sectors: obj.x_mitre_sectors ?? [],
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
  const version = (versionAny?.["x_mitre_version"] as string | undefined) ?? "unknown";

  return { version, groups };
}

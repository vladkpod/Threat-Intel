/**
 * CTID ATT&CK↔NIST 800-53 mapping loader.
 *
 * Parses the Mappings Explorer "JSON Unified Schema" — a root object of
 * `{ metadata, mapping_objects[] }` where each record links an ATT&CK technique
 * (`attack_object_id`) to an 800-53 control (`capability_id`) with a
 * `mapping_type` and a `status` of complete | in_progress | non_mappable.
 *
 * Critically for Invariant 4 / the DoD: CTID flags some techniques
 * `non_mappable`, and many human-identity techniques (e.g. T1566.004 vishing,
 * T1656 impersonation) simply have no `complete` mapping. `isNonMappable`
 * treats both cases as "CTID cannot cover this", which is the trigger for the
 * engine to fall back to the analyst-asserted human-identity library rather than
 * inventing a CTID link.
 */
import { z } from "zod";

export const CtidMappingObject = z.object({
  attack_object_id: z.string(),
  attack_object_name: z.string().optional().default(""),
  capability_id: z.string().nullable().optional().default(null),
  capability_description: z.string().optional().default(""),
  capability_group: z.string().optional().default(""),
  mapping_type: z.string().optional().default(""),
  status: z.string().optional().default("complete"),
  // Reserved scoring fields; present in schema, typically null in published data.
  score_category: z.string().nullable().optional().default(null),
  score_value: z.string().nullable().optional().default(null),
  comments: z.string().nullable().optional().default(null),
});
export type CtidMappingObject = z.infer<typeof CtidMappingObject>;

export const CtidMetadata = z
  .object({
    attack_version: z.string().optional().default(""),
    mapping_framework: z.string().optional().default(""),
    mapping_framework_version: z.string().optional().default(""),
    capability_groups: z.record(z.string(), z.string()).optional().default({}),
  })
  .passthrough();

export const CtidDocument = z.object({
  metadata: CtidMetadata,
  mapping_objects: z.array(CtidMappingObject),
});
export type CtidDocument = z.infer<typeof CtidDocument>;

export interface ControlLink {
  control_id: string;
  control_family: string;
  control_description: string;
  mapping_type: string;
  status: string;
  /** prevent | detect | respond axis, when CTID provides it. */
  score_category: string | null;
}

export class CtidMappings {
  private readonly byTechnique: Map<string, ControlLink[]>;
  readonly attackVersion: string;
  readonly frameworkRevision: string;

  private constructor(doc: CtidDocument) {
    this.attackVersion = doc.metadata.attack_version;
    this.frameworkRevision = doc.metadata.mapping_framework_version;
    this.byTechnique = new Map();
    for (const m of doc.mapping_objects) {
      const list = this.byTechnique.get(m.attack_object_id) ?? [];
      list.push({
        control_id: m.capability_id ?? "",
        control_family: m.capability_group,
        control_description: m.capability_description,
        mapping_type: m.mapping_type,
        status: m.status,
        score_category: m.score_category,
      });
      this.byTechnique.set(m.attack_object_id, list);
    }
  }

  /** Parse and validate a raw CTID Unified Schema document. */
  static fromDocument(raw: unknown): CtidMappings {
    return new CtidMappings(CtidDocument.parse(raw));
  }

  /** Parse from a JSON string. */
  static fromJson(json: string): CtidMappings {
    return CtidMappings.fromDocument(JSON.parse(json));
  }

  /** All control links recorded for a technique (any status). */
  controlsFor(techniqueId: string): ControlLink[] {
    return this.byTechnique.get(techniqueId) ?? [];
  }

  /** Control links CTID considers complete (usable, CTID-mapped). */
  completeControlsFor(techniqueId: string): ControlLink[] {
    return this.controlsFor(techniqueId).filter(
      (c) => c.status === "complete" && c.control_id !== "",
    );
  }

  /**
   * True when CTID cannot cover this technique: either explicitly flagged
   * `non_mappable`, or it has no complete control mapping at all. Both mean the
   * engine must fall back to the analyst-asserted human-identity library
   * (Invariant 4) rather than fabricate a CTID link.
   */
  isNonMappable(techniqueId: string): boolean {
    const links = this.controlsFor(techniqueId);
    if (links.some((c) => c.status === "non_mappable")) return true;
    return this.completeControlsFor(techniqueId).length === 0;
  }
}

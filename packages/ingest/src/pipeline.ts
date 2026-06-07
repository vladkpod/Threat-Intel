/**
 * Ingestion layer.
 *
 * Takes an incident plus its sources and the claim→source links, then for each
 * claim: classifies admissibility (§B8), collapses derivative echoes and counts
 * corroboration across independence groups (§B7), computes the evidence tier
 * (capping actor-pattern/leak sources at INFERRED), and persists an initial
 * versioned claim with full provenance.
 *
 * NLP extraction of claims from source text is a later stage (M2). M1 owns the
 * relational, versioned provenance machinery: given which sources support which
 * claim, produce correct, auditable tiers and corroboration.
 */
import {
  admitForClaim,
  baseAdmissibility,
  computeCorroboration,
  computeTier,
  type Admissibility,
  type ClaimSourceInput,
  type ClaimSubject,
  type EvidenceTier,
  type IndependenceGroup,
  type SourceClass,
} from "@registry";
import {
  addSource,
  createIncident,
  recordClaimVersion,
  upsertClaim,
  type Db,
  type SourceRow,
} from "@store";

export interface IngestSource {
  external_id: string;
  label: string;
  independence_group: IndependenceGroup;
  tier_ceiling: EvidenceTier;
  proximity: string;
  is_primary: boolean;
  derivative_of: string | null;
  incentive_bias: string | null;
  source_class?: SourceClass | null;
  /** For G3 IR firms: the firm identity, so ≥2 firms corroborate (§B7). */
  ir_firm?: string | null;
  body: string;
}

export interface IngestClaim {
  claim_key: string;
  subject: ClaimSubject;
  statement: string;
  attack_tactic?: string | null;
  attack_technique?: string | null;
  /** external_ids of the sources that support this claim. */
  supported_by: string[];
}

export interface IngestRequest {
  incident: { slug: string; name: string };
  sources: IngestSource[];
  claims: IngestClaim[];
}

export interface IngestedClaim {
  claim_key: string;
  /** null when no admissible source remains (insufficient evidence). */
  evidence_tier: EvidenceTier | null;
  corroboration_count: number;
  groups: IndependenceGroup[];
  contributors: string[];
  persisted: boolean;
}

export interface IngestResult {
  incidentId: number;
  claims: IngestedClaim[];
}

export async function ingestIncident(
  db: Db,
  req: IngestRequest,
): Promise<IngestResult> {
  const incident = await createIncident(db, req.incident.slug, req.incident.name);

  const rowByExternalId = new Map<string, SourceRow>();
  const metaByExternalId = new Map<
    string,
    { source_class: SourceClass | null; ir_firm: string | null }
  >();

  for (const s of req.sources) {
    const sourceClass = s.source_class ?? null;
    const row = await addSource(db, incident.id, {
      external_id: s.external_id,
      label: s.label,
      independence_group: s.independence_group,
      tier_ceiling: s.tier_ceiling,
      proximity: s.proximity,
      is_primary: s.is_primary,
      derivative_of: s.derivative_of,
      incentive_bias: s.incentive_bias,
      source_class: sourceClass,
      base_admissibility: baseAdmissibility(s.independence_group, sourceClass),
      body: s.body,
    });
    rowByExternalId.set(s.external_id, row);
    metaByExternalId.set(s.external_id, {
      source_class: sourceClass,
      ir_firm: s.ir_firm ?? null,
    });
  }

  const claims: IngestedClaim[] = [];

  for (const c of req.claims) {
    const linked = c.supported_by
      .map((id) => rowByExternalId.get(id))
      .filter((r): r is SourceRow => r !== undefined);

    const admittedByExternalId = new Map<string, Admissibility>();
    const corrInput: ClaimSourceInput[] = linked.map((row) => {
      const admitted = admitForClaim(
        row.independence_group,
        row.source_class as SourceClass | null,
        c.subject,
      );
      admittedByExternalId.set(row.external_id, admitted);
      return {
        external_id: row.external_id,
        independence_group: row.independence_group,
        is_primary: row.is_primary,
        derivative_of: row.derivative_of,
        admitted_as: admitted,
        ir_firm: metaByExternalId.get(row.external_id)?.ir_firm ?? null,
      };
    });

    const corr = computeCorroboration(corrInput);
    const tierResult = computeTier(
      linked.map((row) => ({
        tier_ceiling: row.tier_ceiling,
        admitted_as: admittedByExternalId.get(row.external_id) ?? "excluded",
      })),
    );

    const contributionByExternalId = new Map(
      corr.perSource.map((p) => [p.external_id, p]),
    );

    const claimRow = await upsertClaim(db, incident.id, {
      claim_key: c.claim_key,
      subject: c.subject,
      statement: c.statement,
      attack_tactic: c.attack_tactic ?? null,
      attack_technique: c.attack_technique ?? null,
    });

    let persisted = false;
    if (tierResult.tier !== null) {
      await recordClaimVersion(db, claimRow.id, {
        evidence_tier: tierResult.tier,
        corroboration_count: corr.count,
        confidence: tierResult.tier,
        reason: "initial",
        note: null,
        sources: linked.map((row) => {
          const contrib = contributionByExternalId.get(row.external_id);
          return {
            source_id: row.id,
            corroboration_contribution: contrib?.corroboration_contribution ?? false,
            collapsed_to: contrib?.collapsed_to ?? null,
            admitted_as: admittedByExternalId.get(row.external_id) ?? "excluded",
          };
        }),
      });
      persisted = true;
    }

    claims.push({
      claim_key: c.claim_key,
      evidence_tier: tierResult.tier,
      corroboration_count: corr.count,
      groups: corr.groups,
      contributors: corr.perSource
        .filter((p) => p.corroboration_contribution)
        .map((p) => p.external_id),
      persisted,
    });
  }

  return { incidentId: incident.id, claims };
}

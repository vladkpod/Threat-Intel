/**
 * Typed data access for the versioned incident/source/claim store.
 *
 * Versioning contract (Invariant 8): claim state is never mutated in place.
 * `recordClaimVersion` closes the current version (sets valid_to + superseded_by)
 * and appends a new one with an incremented version_no and a stated reason, so
 * supersession and decay are fully auditable.
 */
import type { Db } from "./db.js";
import type {
  ClaimInput,
  ClaimRow,
  ClaimVersionInput,
  ClaimVersionRow,
  IncidentRow,
  SourceInput,
  SourceRow,
} from "./types.js";

export async function createIncident(
  db: Db,
  slug: string,
  name: string,
): Promise<IncidentRow> {
  const res = await db.query<IncidentRow>(
    `INSERT INTO incidents (slug, name) VALUES ($1, $2)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
     RETURNING id, slug, name`,
    [slug, name],
  );
  return res.rows[0]!;
}

export async function addSource(
  db: Db,
  incidentId: number,
  s: SourceInput,
): Promise<SourceRow> {
  const res = await db.query<SourceRow>(
    `INSERT INTO sources
       (incident_id, external_id, label, independence_group, tier_ceiling,
        proximity, is_primary, derivative_of, incentive_bias, source_class,
        base_admissibility, body)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (incident_id, external_id) DO UPDATE SET
       label = EXCLUDED.label,
       independence_group = EXCLUDED.independence_group,
       tier_ceiling = EXCLUDED.tier_ceiling,
       proximity = EXCLUDED.proximity,
       is_primary = EXCLUDED.is_primary,
       derivative_of = EXCLUDED.derivative_of,
       incentive_bias = EXCLUDED.incentive_bias,
       source_class = EXCLUDED.source_class,
       base_admissibility = EXCLUDED.base_admissibility,
       body = EXCLUDED.body
     RETURNING id, incident_id, external_id, label, independence_group,
       tier_ceiling, proximity, is_primary, derivative_of, incentive_bias,
       source_class, base_admissibility, body`,
    [
      incidentId,
      s.external_id,
      s.label,
      s.independence_group,
      s.tier_ceiling,
      s.proximity,
      s.is_primary,
      s.derivative_of,
      s.incentive_bias,
      s.source_class,
      s.base_admissibility,
      s.body,
    ],
  );
  return res.rows[0]!;
}

export async function getSources(
  db: Db,
  incidentId: number,
): Promise<SourceRow[]> {
  const res = await db.query<SourceRow>(
    `SELECT id, incident_id, external_id, label, independence_group, tier_ceiling,
            proximity, is_primary, derivative_of, incentive_bias, source_class,
            base_admissibility, body
     FROM sources WHERE incident_id = $1 ORDER BY id`,
    [incidentId],
  );
  return res.rows;
}

export async function upsertClaim(
  db: Db,
  incidentId: number,
  c: ClaimInput,
): Promise<ClaimRow> {
  const res = await db.query<ClaimRow>(
    `INSERT INTO claims
       (incident_id, claim_key, subject, statement, attack_tactic, attack_technique)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (incident_id, claim_key) DO UPDATE SET
       statement = EXCLUDED.statement,
       attack_tactic = EXCLUDED.attack_tactic,
       attack_technique = EXCLUDED.attack_technique
     RETURNING id, incident_id, claim_key, subject, statement, attack_tactic, attack_technique`,
    [
      incidentId,
      c.claim_key,
      c.subject,
      c.statement,
      c.attack_tactic,
      c.attack_technique,
    ],
  );
  return res.rows[0]!;
}

/**
 * Append a new version for a claim, closing any current one. Returns the new
 * version row. Use `reason: 'initial'` for the first version; 'supersession' /
 * 'decay' / 'recompute' thereafter.
 */
export async function recordClaimVersion(
  db: Db,
  claimId: number,
  input: ClaimVersionInput,
): Promise<ClaimVersionRow> {
  const current = await getCurrentVersion(db, claimId);
  const nextNo = current ? current.version_no + 1 : 1;

  // Close the current version BEFORE inserting the new one — the partial unique
  // index permits only one open (valid_to IS NULL) version per claim, so two
  // open rows cannot coexist even momentarily. superseded_by is backfilled once
  // the new version's id exists.
  if (current) {
    await db.query(`UPDATE claim_versions SET valid_to = now() WHERE id = $1`, [
      current.id,
    ]);
  }

  const inserted = await db.query<ClaimVersionRow>(
    `INSERT INTO claim_versions
       (claim_id, version_no, evidence_tier, corroboration_count, confidence, reason, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id, claim_id, version_no, evidence_tier, corroboration_count,
       confidence, reason, note, valid_from, valid_to, superseded_by`,
    [
      claimId,
      nextNo,
      input.evidence_tier,
      input.corroboration_count,
      input.confidence,
      input.reason,
      input.note,
    ],
  );
  const version = inserted.rows[0]!;

  if (current) {
    await db.query(`UPDATE claim_versions SET superseded_by = $2 WHERE id = $1`, [
      current.id,
      version.id,
    ]);
  }

  for (const link of input.sources) {
    await db.query(
      `INSERT INTO claim_version_sources
         (claim_version_id, source_id, corroboration_contribution, collapsed_to, admitted_as)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        version.id,
        link.source_id,
        link.corroboration_contribution,
        link.collapsed_to,
        link.admitted_as,
      ],
    );
  }

  return version;
}

export async function getCurrentVersion(
  db: Db,
  claimId: number,
): Promise<ClaimVersionRow | null> {
  const res = await db.query<ClaimVersionRow>(
    `SELECT id, claim_id, version_no, evidence_tier, corroboration_count,
            confidence, reason, note, valid_from, valid_to, superseded_by
     FROM claim_versions
     WHERE claim_id = $1 AND valid_to IS NULL`,
    [claimId],
  );
  return res.rows[0] ?? null;
}

export async function getVersionHistory(
  db: Db,
  claimId: number,
): Promise<ClaimVersionRow[]> {
  const res = await db.query<ClaimVersionRow>(
    `SELECT id, claim_id, version_no, evidence_tier, corroboration_count,
            confidence, reason, note, valid_from, valid_to, superseded_by
     FROM claim_versions WHERE claim_id = $1 ORDER BY version_no`,
    [claimId],
  );
  return res.rows;
}

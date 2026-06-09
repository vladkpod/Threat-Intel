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
  ClaimStalenessRow,
  ClaimVersionInput,
  ClaimVersionRow,
  EvidenceTier,
  IncidentRow,
  JobRow,
  ReconstructionResultRow,
  ReviewQueueRow,
  ReviewStatus,
  ReviewType,
  SourceInput,
  SourceRow,
} from "./types.js";

export async function createIncident(
  db: Db,
  slug: string,
  name: string,
  incidentDate?: string | null,
  sector?: string | null,
): Promise<IncidentRow> {
  const res = await db.query<IncidentRow>(
    `INSERT INTO incidents (slug, name, incident_date, sector) VALUES ($1, $2, $3, $4)
     ON CONFLICT (slug) DO UPDATE SET
       name = EXCLUDED.name,
       incident_date = COALESCE(EXCLUDED.incident_date, incidents.incident_date),
       sector = COALESCE(EXCLUDED.sector, incidents.sector)
     RETURNING id, slug, name, incident_date, sector`,
    [slug, name, incidentDate ?? null, sector ?? null],
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

// --- M6: Job queue ---

export async function enqueueJob(
  db: Db,
  jobType: string,
  payload: unknown,
  runAfter?: Date,
): Promise<JobRow> {
  const res = await db.query<JobRow>(
    `INSERT INTO jobs (job_type, payload, run_after)
     VALUES ($1, $2::jsonb, COALESCE($3::timestamptz, now()))
     RETURNING id, job_type, payload, status, run_after, started_at,
       completed_at, failed_at, error, created_at`,
    [jobType, JSON.stringify(payload), runAfter?.toISOString() ?? null],
  );
  return res.rows[0]!;
}

export async function dequeueJob(
  db: Db,
  jobType: string,
): Promise<JobRow | null> {
  const res = await db.query<JobRow>(
    `UPDATE jobs SET status = 'running', started_at = now()
     WHERE id = (
       SELECT id FROM jobs
       WHERE job_type = $1 AND status = 'pending' AND run_after <= now()
       ORDER BY run_after ASC
       LIMIT 1
     )
     RETURNING id, job_type, payload, status, run_after, started_at,
       completed_at, failed_at, error, created_at`,
    [jobType],
  );
  return res.rows[0] ?? null;
}

export async function completeJob(db: Db, jobId: number): Promise<void> {
  await db.query(
    `UPDATE jobs SET status = 'completed', completed_at = now() WHERE id = $1`,
    [jobId],
  );
}

export async function failJob(
  db: Db,
  jobId: number,
  error: string,
): Promise<void> {
  await db.query(
    `UPDATE jobs SET status = 'failed', failed_at = now(), error = $1 WHERE id = $2`,
    [error, jobId],
  );
}

export async function countPendingJobs(
  db: Db,
  jobType?: string,
): Promise<number> {
  const res = await db.query<{ count: string }>(
    jobType !== undefined
      ? `SELECT count(*)::text AS count FROM jobs WHERE job_type = $1 AND status = 'pending'`
      : `SELECT count(*)::text AS count FROM jobs WHERE status = 'pending'`,
    jobType !== undefined ? [jobType] : [],
  );
  return parseInt(res.rows[0]!.count, 10);
}

// --- M6: Review queue ---

export interface CreateReviewItemInput {
  feed_job_id: number | null;
  type: ReviewType;
  candidate_title: string;
  candidate_text: string;
  tier_ceiling: EvidenceTier;
}

export async function createReviewItem(
  db: Db,
  input: CreateReviewItemInput,
): Promise<ReviewQueueRow> {
  const res = await db.query<ReviewQueueRow>(
    `INSERT INTO review_queue (feed_job_id, type, candidate_title, candidate_text, tier_ceiling)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, feed_job_id, type, candidate_title, candidate_text, tier_ceiling,
       status, reviewed_by, reviewed_at, reconstruction_job_id, created_at`,
    [
      input.feed_job_id,
      input.type,
      input.candidate_title,
      input.candidate_text,
      input.tier_ceiling,
    ],
  );
  return res.rows[0]!;
}

export async function getReviewItem(
  db: Db,
  id: number,
): Promise<ReviewQueueRow | null> {
  const res = await db.query<ReviewQueueRow>(
    `SELECT id, feed_job_id, type, candidate_title, candidate_text, tier_ceiling,
            status, reviewed_by, reviewed_at, reconstruction_job_id, created_at
     FROM review_queue WHERE id = $1`,
    [id],
  );
  return res.rows[0] ?? null;
}

export async function setReviewItemStatus(
  db: Db,
  id: number,
  status: ReviewStatus,
  reviewedBy: string,
  reconstructionJobId: number | null,
): Promise<ReviewQueueRow> {
  const res = await db.query<ReviewQueueRow>(
    `UPDATE review_queue
     SET status = $2, reviewed_by = $3, reviewed_at = now(),
         reconstruction_job_id = COALESCE($4, reconstruction_job_id)
     WHERE id = $1 AND status = 'pending'
     RETURNING id, feed_job_id, type, candidate_title, candidate_text, tier_ceiling,
       status, reviewed_by, reviewed_at, reconstruction_job_id, created_at`,
    [id, status, reviewedBy, reconstructionJobId],
  );
  if (!res.rows[0]) {
    throw new Error(`Review item ${id} not found or not in pending state`);
  }
  return res.rows[0];
}

export async function listPendingReviews(db: Db): Promise<ReviewQueueRow[]> {
  const res = await db.query<ReviewQueueRow>(
    `SELECT id, feed_job_id, type, candidate_title, candidate_text, tier_ceiling,
            status, reviewed_by, reviewed_at, reconstruction_job_id, created_at
     FROM review_queue WHERE status = 'pending' ORDER BY created_at ASC`,
  );
  return res.rows;
}

// --- M6: Reconstruction results ---

export async function storeReconstructionResult(
  db: Db,
  incidentId: number,
  reviewQueueId: number,
  criticalPathTechniques: string[],
  resultJson: unknown,
): Promise<ReconstructionResultRow> {
  const res = await db.query<ReconstructionResultRow>(
    `INSERT INTO reconstruction_results
       (incident_id, review_queue_id, critical_path_techniques, result_json)
     VALUES ($1, $2, $3::jsonb, $4::jsonb)
     RETURNING id, incident_id, review_queue_id, critical_path_techniques,
       result_json, created_at`,
    [
      incidentId,
      reviewQueueId,
      JSON.stringify(criticalPathTechniques),
      JSON.stringify(resultJson),
    ],
  );
  return res.rows[0]!;
}

export async function getReconstructionResult(
  db: Db,
  incidentId: number,
): Promise<ReconstructionResultRow | null> {
  const res = await db.query<ReconstructionResultRow>(
    `SELECT id, incident_id, review_queue_id, critical_path_techniques,
            result_json, created_at
     FROM reconstruction_results WHERE incident_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [incidentId],
  );
  return res.rows[0] ?? null;
}

// --- M6: Claim staleness ---

export async function flagClaimStaleness(
  db: Db,
  claimId: number,
  claimVersionId: number,
  caveat: string,
): Promise<ClaimStalenessRow | null> {
  const res = await db.query<ClaimStalenessRow>(
    `INSERT INTO claim_staleness (claim_id, claim_version_id, caveat)
     VALUES ($1, $2, $3)
     ON CONFLICT (claim_version_id) DO NOTHING
     RETURNING id, claim_id, claim_version_id, caveat, flagged_at`,
    [claimId, claimVersionId, caveat],
  );
  return res.rows[0] ?? null;
}

export async function getClaimStaleness(
  db: Db,
  claimVersionId: number,
): Promise<ClaimStalenessRow | null> {
  const res = await db.query<ClaimStalenessRow>(
    `SELECT id, claim_id, claim_version_id, caveat, flagged_at
     FROM claim_staleness WHERE claim_version_id = $1`,
    [claimVersionId],
  );
  return res.rows[0] ?? null;
}

export async function getStalenessForClaim(
  db: Db,
  claimId: number,
): Promise<ClaimStalenessRow[]> {
  const res = await db.query<ClaimStalenessRow>(
    `SELECT id, claim_id, claim_version_id, caveat, flagged_at
     FROM claim_staleness WHERE claim_id = $1 ORDER BY flagged_at DESC`,
    [claimId],
  );
  return res.rows;
}

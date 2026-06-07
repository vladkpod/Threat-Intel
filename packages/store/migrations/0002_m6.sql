-- M6: Postgres-native job queue, human review gate, and claim staleness.
--
-- Invariant 11: auto-detected incidents stop at review_queue; no code path may
--   call reconstruct() without an approved review_queue row.
-- Invariant 12: tier_ceiling on review_queue enforces the source-class ceiling
--   for all reconstruction inputs derived from that candidate.
-- M6 decay rule: claim_staleness is a caveat flag only — confidence is never mutated.

CREATE TYPE job_status AS ENUM ('pending', 'running', 'completed', 'failed');
CREATE TYPE review_status AS ENUM ('pending', 'approved', 'rejected', 'deferred');
CREATE TYPE review_type AS ENUM ('new-incident', 'verdict-change');

-- Postgres-native job queue, pg-boss-inspired (CLAUDE.md M6: no Redis/BullMQ).
-- Dequeue uses UPDATE ... WHERE id = (SELECT ... LIMIT 1) for atomic claim.
CREATE TABLE jobs (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_type     text NOT NULL,
  payload      jsonb NOT NULL DEFAULT '{}',
  status       job_status NOT NULL DEFAULT 'pending',
  run_after    timestamptz NOT NULL DEFAULT now(),
  started_at   timestamptz,
  completed_at timestamptz,
  failed_at    timestamptz,
  error        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_jobs_dequeue ON jobs (job_type, run_after) WHERE status = 'pending';

-- Human review gate (Invariant 11).
-- Rows enter via the incident.detected worker.
-- The ONLY code path that leads to reconstruction is POST /admin/review/:id/approve,
-- which is the sole caller of enqueue('reconstruction.triggered').
CREATE TABLE review_queue (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  feed_job_id           bigint REFERENCES jobs (id),
  type                  review_type NOT NULL,
  candidate_title       text NOT NULL,
  candidate_text        text NOT NULL,
  tier_ceiling          evidence_tier NOT NULL,
  status                review_status NOT NULL DEFAULT 'pending',
  reviewed_by           text,
  reviewed_at           timestamptz,
  -- Populated on approval only; reconstruction.triggered cannot start without this FK.
  reconstruction_job_id bigint REFERENCES jobs (id),
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Reconstruction results — persisted after reconstruction.triggered completes.
-- The critical_path_techniques array lets the re-reconstruction trigger check
-- whether a later tier upgrade touches the critical path.
CREATE TABLE reconstruction_results (
  id                       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  incident_id              bigint NOT NULL REFERENCES incidents (id),
  review_queue_id          bigint NOT NULL REFERENCES review_queue (id),
  -- JSON array of technique IDs for steps 0..earliest_breakable_step.
  critical_path_techniques jsonb NOT NULL DEFAULT '[]',
  result_json              jsonb NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now()
);

-- Claim staleness (M6 decay rule).
-- REPORTED-tier open claims older than 30 days get a caveat row here.
-- The confidence column in claim_versions is NOT touched — ever.
CREATE TABLE claim_staleness (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  claim_id         bigint NOT NULL REFERENCES claims (id) ON DELETE CASCADE,
  claim_version_id bigint NOT NULL REFERENCES claim_versions (id) ON DELETE CASCADE,
  caveat           text NOT NULL,
  flagged_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (claim_version_id)
);

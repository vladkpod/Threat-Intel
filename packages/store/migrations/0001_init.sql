-- Versioned incident / source / claim store.
--
-- Design notes:
--  * Claims are relational and versioned (CLAUDE.md / Invariant 8). A claim has
--    many claim_versions; the current one has valid_to IS NULL. Supersession and
--    decay append a new version and close the old one, recording the reason —
--    nothing is mutated in place, so the history is auditable.
--  * Evidence tier attaches to the *claim version*, not the document
--    (Invariant 2). Provenance is the claim_version_sources join.
--  * Corroboration (Invariant 5) and admissibility (Invariant 7 / §B8) are
--    computed at ingest and persisted onto the version + its source links, so
--    they are inspectable rather than recomputed implicitly.

CREATE TYPE evidence_tier AS ENUM ('CONFIRMED', 'REPORTED', 'INFERRED', 'ANALOGOUS');
CREATE TYPE independence_group AS ENUM ('G1', 'G2', 'G3', 'G4', 'B5', 'B6');
CREATE TYPE admissibility AS ENUM ('victim_fact', 'actor_inferred', 'excluded');
CREATE TYPE claim_subject AS ENUM ('victim_fact', 'actor');
CREATE TYPE version_reason AS ENUM ('initial', 'supersession', 'decay', 'recompute');

CREATE TABLE incidents (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sources (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  incident_id          bigint NOT NULL REFERENCES incidents (id) ON DELETE CASCADE,
  external_id          text NOT NULL,                 -- e.g. 'MS-001'
  label                text NOT NULL,
  independence_group   independence_group NOT NULL,
  tier_ceiling         evidence_tier NOT NULL,
  proximity            text NOT NULL,
  is_primary           boolean NOT NULL,
  derivative_of        text,                          -- external_id of the source this echoes
  incentive_bias       text,
  source_class         text,
  -- Base admissibility for victim-fact use, decided at ingest (§B8). Per-claim
  -- admission is recorded on claim_version_sources.admitted_as.
  base_admissibility   admissibility NOT NULL,
  body                 text NOT NULL,
  ingested_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (incident_id, external_id)
);

CREATE TABLE claims (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  incident_id     bigint NOT NULL REFERENCES incidents (id) ON DELETE CASCADE,
  claim_key       text NOT NULL,                      -- stable key, e.g. 'initial-access:helpdesk-reset'
  subject         claim_subject NOT NULL,
  statement       text NOT NULL,
  attack_tactic   text,
  attack_technique text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (incident_id, claim_key)
);

CREATE TABLE claim_versions (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  claim_id            bigint NOT NULL REFERENCES claims (id) ON DELETE CASCADE,
  version_no          int NOT NULL,
  evidence_tier       evidence_tier NOT NULL,
  corroboration_count int NOT NULL CHECK (corroboration_count >= 0),
  confidence          evidence_tier NOT NULL,         -- capped at weakest tier on path (Invariant 9)
  reason              version_reason NOT NULL,
  note                text,
  valid_from          timestamptz NOT NULL DEFAULT now(),
  valid_to            timestamptz,                    -- NULL = current version
  superseded_by       bigint REFERENCES claim_versions (id),
  UNIQUE (claim_id, version_no)
);

-- One current version per claim.
CREATE UNIQUE INDEX idx_claim_versions_current
  ON claim_versions (claim_id)
  WHERE valid_to IS NULL;

CREATE TABLE claim_version_sources (
  claim_version_id           bigint NOT NULL REFERENCES claim_versions (id) ON DELETE CASCADE,
  source_id                  bigint NOT NULL REFERENCES sources (id) ON DELETE CASCADE,
  -- Whether this source counts toward the corroboration counter (Invariant 5).
  -- Derivatives and within-group repeats are linked for provenance but set false.
  corroboration_contribution boolean NOT NULL,
  collapsed_to               text,                    -- external_id of the primary it collapses to
  admitted_as                admissibility NOT NULL,  -- how it was admitted for THIS claim (§B8)
  PRIMARY KEY (claim_version_id, source_id)
);

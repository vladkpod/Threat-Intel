-- Adds client organisations and their per-incident assessment state.
-- clients: a named org a consultant is assessing against an attack chain.
-- client_assessments: the saved toggle answers for one client × one reconstruction.

CREATE TABLE IF NOT EXISTS clients (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  sector        TEXT,
  tech_stack_notes TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS clients_name_unique ON clients (lower(name));

CREATE TABLE IF NOT EXISTS client_assessments (
  id                  SERIAL PRIMARY KEY,
  client_id           INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  reconstruction_id   INTEGER NOT NULL REFERENCES reconstruction_results(id) ON DELETE CASCADE,
  answers             JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS client_assessments_unique
  ON client_assessments (client_id, reconstruction_id);

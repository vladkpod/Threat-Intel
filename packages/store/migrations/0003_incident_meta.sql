-- Adds incident_date and sector to the incidents table.
-- incident_date: the real-world date of the incident (not the DB insert time).
-- sector: the victim organisation's industry sector (inferred at seed/ingest time).
ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS incident_date DATE,
  ADD COLUMN IF NOT EXISTS sector TEXT;

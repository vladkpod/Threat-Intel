# Threat Intel

Threat-intelligence reconstruction & self-assessment platform. Two products on a shared dashboard:

- **Product A — incident engine**: reconstructs a named cyber incident into an evidence-tiered, MITRE ATT&CK-mapped attack chain, then generates a "would this have worked on us" control self-assessment for a different organisation.
- **Product B — sector view**: aggregates incidents and feeds into per-sector trend intelligence.

---

## What it does

1. **Incident Feed** — lists reconstructed cyber incidents (M&S 2025, British Library 2023 seeded by default). Each card shows sector, date, actor, and a HIGH/MEDIUM/LOW severity badge.
2. **Detail view** — shows the full attack chain with evidence tiers, breaking controls mapped to MITRE ATT&CK / CTID 800-53, a self-assessment questionnaire, and a verdict on whether the attack would succeed against the viewing organisation.
3. **Export Report** — generates a client-deliverable PDF with all five sections: incident overview, verdict, attack chain, breaking controls, and self-assessment questionnaire.
4. **Sector View** — aggregates ATT&CK Groups and CISA KEV across industry sectors.
5. **Human review gate** (Invariant 11) — auto-ingested incidents and verdict changes route to a human review queue before reconstruction runs. No auto-reconstruction without approval.

---

## Prerequisites

- **Node.js** ≥ 20
- **npm** ≥ 10 (workspaces support required)
- No external database required — the app uses [PGlite](https://github.com/electric-sql/pglite), a Postgres-compatible in-process database backed by a local file.

For LLM-backed features (NCSC feed worker):
- `ANTHROPIC_API_KEY` environment variable (see `.env.example`)

---

## Setup

```bash
# 1. Clone and install
git clone https://github.com/vladkpod/threat-intel
cd threat-intel
npm install

# 2. Copy environment template
cp .env.example .env
# Edit .env — at minimum set ADMIN_API_KEY
```

---

## Running locally

The API server and web dev server must run in separate terminals.

**Terminal 1 — seed the database (run once before starting the API):**

```bash
npx tsx scripts/seed-feed.ts
```

This wipes `.pglite/data` and inserts the M&S 2025 and British Library 2023 fixtures.

**Terminal 2 — start the API server:**

```bash
npm run dev:api
# Listening on http://localhost:3001
```

**Terminal 3 — start the web dev server:**

```bash
npm run dev:web
# Open http://localhost:5173
```

> The seed script and the API server cannot run simultaneously — PGlite is single-writer.
> Always run the seed script before starting the API, not while it is running.

---

## Commands

| Command | Purpose |
|---------|---------|
| `npm run build` | Compile the workspace |
| `npm test` | Unit + integration tests |
| `npm run eval` | M&S and BL golden eval suites |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run lint -- --fix` | ESLint with auto-fix |
| `npm run dev:api` | API server (port 3001, hot-reload via tsx) |
| `npm run dev:web` | Vite dev server (port 5173) |

---

## Running the tests

```bash
# Unit + integration tests
npm test

# Eval suite (M&S golden eval + BL full reconstruction)
npm run eval

# Everything at once
npm test && npm run eval && npm run typecheck && npm run lint
```

The **M&S golden eval** (`tests/eval/ms_2025/`) is the contract — passing it is the Definition of done for every change.

---

## Architecture overview

```
packages/
  engine/         Three-stage reconstruction engine (pure function, no DB)
    src/extraction.ts      Stage 1: source text → ATT&CK-tagged chain
    src/generalisation.ts  Stage 2: strip victim specifics → reusable pattern
    src/self-assessment.ts Stage 3: pattern → control questionnaire
    src/verdict.ts         Stage 3b: verdict + confidence computation
    src/breaking-controls.ts CTID 800-53 + analyst-asserted control lookup
  store/          Postgres/PGlite persistence (incidents, claims, versions)
    migrations/            Idempotent SQL migrations
    src/repositories.ts    Typed data access functions
  api/            Express + tRPC API server
    src/router.ts          tRPC procedures (reconstruction.*, sector.*)
    src/admin-router.ts    Admin REST endpoints (/admin/review/*)
  registry/       Source authority registry, CTID mappings, human-identity library
  sector/         Sector view pipeline (ATT&CK STIX + CISA KEV aggregation)
  queue/          Job queue handlers (pg-boss style, Postgres-native)
  ingest/         Claim ingestion + evidence tiering
  web/            React + Vite frontend (Tailwind + shadcn/ui)

docs/             Behaviour specs (source of truth for engine rules)
scripts/          Developer utilities (seed-feed.ts)
tests/
  eval/           Golden eval fixtures + assertions (M&S 2025, BL 2023)
  unit/           Unit + integration tests
```

### Key design decisions

- **Engine is a pure function** — `reconstruct(input)` takes JSON sources and returns structured output. No DB access inside the engine; the three stages are independently testable.
- **Evidence tiers are per-claim** — every step in the chain carries a tier (CONFIRMED / REPORTED / INFERRED / ANALOGOUS) with provenance. The verdict's confidence is capped at the weakest tier on the critical path.
- **Human review gate** — all auto-ingested events create a `review_queue` row in `pending` state. Only an admin approving via `POST /admin/review/:id/approve` triggers reconstruction.
- **Decay is caveat-on-read** — REPORTED claims older than the staleness threshold get a `caveats[]` entry injected when the result is read; the stored confidence is never mutated.
- **No Redis** — the job queue uses Postgres-native tables (pg-boss inspired). PGlite for local dev; swap the connection string for a real Postgres instance in production.

---

## Admin API

All admin endpoints require the `x-admin-api-key` header matching `ADMIN_API_KEY` in your `.env`.

```bash
# List pending review items
curl -H "x-admin-api-key: your-key" http://localhost:3001/admin/review

# Approve a review item (triggers reconstruction)
curl -X POST -H "x-admin-api-key: your-key" \
     -H "Content-Type: application/json" \
     -d '{"reviewer":"analyst@example.com","reconstruction_input":{...}}' \
     http://localhost:3001/admin/review/1/approve
```

---

## Behaviour specs

- [`docs/incident_reconstruction_prompt.md`](./docs/incident_reconstruction_prompt.md) — the engine's runtime system prompt and tiering rules
- [`docs/source_authority_registry.md`](./docs/source_authority_registry.md) — source classification, independence groups, admissibility rules
- [`CLAUDE.md`](./CLAUDE.md) — non-negotiable invariants, definition of done, stack decisions

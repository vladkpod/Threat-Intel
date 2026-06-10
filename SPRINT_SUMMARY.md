# Sprint Summary

## What was shipped

### P1 — Blocking (all complete)
- **Strip T-codes from display surfaces** — removed from describe(), TECHNIQUE_GAP_TEMPLATES, techniqueLabel(); display-layer stripTechniqueCodes() retained as safety net
- **Fix incident dates** — `incident_date` column in `incidents`, seed data with real dates (M&S: April 2025, BL: October 2023), shown on feed cards
- **Sector inference** — `sector` column in `incidents`, `x_mitre_sectors` primary with 11-sector keyword fallback from group descriptions
- **Admin router auth** — `ADMIN_API_KEY` env var, `x-admin-api-key` header, timing-safe comparison via `crypto.timingSafeEqual()`
- **Breaking controls gap message** — user-facing fallback replaces internal CTID error text

### P2 — Important (all complete)
- **PDF report export** — `@react-pdf/renderer` client-side, 5 sections (incident, chain, controls, self-assessment, caveats)
- **Persistent self-assessment** — localStorage keyed by `reconstruction_results.id`
- **Sector view fix** — keyword fallback inference; ATT&CK 16.1 version label
- **Decay → caveats path** — staleness rows injected on read via JOIN in `reconstruction.get`
- **README.md** — full setup/architecture/commands documentation
- **CI pipeline** — `.github/workflows/ci.yml` with typecheck, lint, test, eval
- **Health check endpoint** — `GET /health` with DB connectivity check
- **Rate limiting** — `express-rate-limit` on reconstruction (10/hr) and admin (20/hr)
- **Admin auth test** — 3 integration tests (401 missing key, 401 wrong key, 200 correct key)
- **`reconstruction.list` pagination** — cursor-based, page size 20, `nextCursor` in response
- **Startup secret validation** — server exits with code 1 if `ADMIN_API_KEY` unset
- **Input length validation** — `SourceDocument.text` max 100 KB; `incident_sources` max 100 items; `incident_name` min 1 / max 256
- **CORS origin env var** — `CORS_ORIGIN` env var with localhost fallback
- **Pagination cursor bounds** — `z.number().int().positive()` prevents zero/negative cursors
- **Verdict logic unit tests** — 8 tests covering all behavioral paths
- **Validate `result_json` on DB read** — `ReconstructionOutput.parse()` replaces unsafe double-cast
- **Admin-router body Zod validation** — approve/reject routes validated before use; invalid shape returns 400
- **Breaking-controls axis cast validation** — VALID_AXES set guard before casting CTID `score_category`

### P3 — Polish (all complete)
- **M8 negation-aware extraction** — sentence-level negation pre-filter (`NEGATION_RE`)
- **Responsive layout** — no horizontal scroll at 1280px/1440px
- **Focus states** — visible focus rings on all interactive elements
- **`npm audit`** — 0 high/critical vulnerabilities (vitest upgraded 3.x → 4.1.8)
- **Remove ReconstructPage.tsx dead code** — unused page deleted
- **Aria-hidden decorative icons** — ShieldAlert, Eye, Zap, ChevronDown in AttackChainView
- **STIX bundle caching** — 1-hour module-scope TTL on `fetchAttackStix()`
- **T-code regression test** — 7 eval assertions that no `/T\d{4}/` appears in UI-visible engine fields
- **Timing-safe API key comparison** — `crypto.timingSafeEqual()` in admin-router middleware
- **Graceful shutdown** — SIGTERM/SIGINT handlers close HTTP server + PGlite; 10s hard-exit fallback
- **Schema bounds unit test** — 7 tests verifying Zod rejects oversized payloads
- **Generalisation unit tests** — 10 tests covering empty chain, T-code cleanliness, gap well-formedness
- **`getBreakingControls()` unit tests** — 6 tests covering CTID fallback, analyst-asserted path, unknown fallback, valid axis guarantee
- **`selfAssess()` unit tests** — 8 tests covering testability assignment, evidence tier, maps_to_step
- **Migration idempotency** — `CREATE TYPE` wrapped in DO/EXCEPTION blocks; `CREATE TABLE/INDEX IF NOT EXISTS` in 0001 and 0002

## Final test counts (pre-final-sprint)
- **Unit tests**: 108 passing across 19 test files
- **Eval tests**: 37 passing across 8 assertion files

## Blocked
Nothing. All tasks completed.

---

## Final Product Sprint — Summary (2026-06-10)

### P1 — The client concept

**Client model** (`0004_clients.sql`)  
`clients` table (id, name, sector, tech_stack_notes, UNIQUE lower(name)) and `client_assessments` table (id, client_id FK, reconstruction_id FK, answers JSONB, timestamps). Full repository layer with upsert, get, create, update-answers, and list functions exported from `@store`.

**New Assessment flow** (DetailPage + tRPC `assessment.create`)  
"New Assessment" button on DetailPage opens a shadcn Dialog with client name, sector (select), tech stack notes (textarea, 500 char max). Upserts client by name (case-insensitive), creates assessment row, navigates to AssessmentPage. Existing assessments shown in a list with empty state.

**AssessmentPage** (`pages/AssessmentPage.tsx`)  
Yes/Partial/No toggle buttons per self-assessment question (`aria-pressed`). Answers debounced 500ms to `assessment.saveAnswers`. Live verdict panel: "stopped at Step X (PREVENT — control)" or "would likely succeed". Answers survive reload. Debounce timer cancelled on unmount. Export PDF button.

**Gap analysis panel** (AssessmentPage)  
One row per attack chain step with status icon (green/amber/red/grey), breaking control label, GAP badge for no/unanswered steps.

### P1 — Admin review UI

**Admin page** (`pages/AdminPage.tsx`)  
Third nav item visible only when `VITE_ADMIN_API_KEY` is set. Table of pending review_queue items. Approve parses `candidate_text` as `reconstruction_input` and sends to `/admin/review/:id/approve`. Sonner toasts for success/error.

**`review.list` tRPC procedure**  
Returns all `status=pending` review_queue rows. Empty array if none.

### P2 — Assessment PDF
Extended `IncidentReportPDF` with optional `clientAssessment` prop: personalised header, cover block (client, sector, tech stack, date, "Prepared by Waterstons"), Gap Analysis section, Priority Actions (top 3 unaddressed steps). Generic PDF unchanged.

### P2 — Sector brief PDF
`SectorBriefPDF.tsx` + "Export Brief" button per sector card. Three sections: threat summary, recent KEVs, priority controls. No T-codes.

### P2 — Visual attack chain
`AttackChainView` now renders a vertical flow with coloured connector lines (green=CONFIRMED, amber=REPORTED, grey=INFERRED) and arrowheads. Tactic phase pill on left.

### P2 — Feed filter bar
Sector (select), Severity (ALL/HIGH/MEDIUM/LOW), Actor (fuzzy text) filters. Client-side. Clear button.

### P3 — Polish
- **Incident timeline**: Version Log replaced with dot-on-line visual timeline, most-recent first
- **Toast notifications**: `sonner` globally — assessment saved, PDF exported, review submitted, admin actions
- **Empty states**: Feed (Newspaper icon), Client Assessments (Users icon), Admin (ClipboardList icon), Sector (retry button) 
- **Keyboard navigation**: All interactive elements are native `<button>` or radix primitives; Dialog focus-trapped; toggle buttons have `aria-pressed` and `role="group"`

### Issues found and fixed during review passes
1. **AdminPage approve body missing `reconstruction_input`** — fixed to parse `candidate_text` before sending
2. **AssessmentPage unmount leak** — added cleanup useEffect to cancel debounce timer

### Test counts (final)
- **Unit tests**: 122 passing across 21 test files (+8 new assessment/review.list tests)
- **Eval tests**: 37 passing
- **Two review passes run; second pass found zero new gaps. Loop terminates.**

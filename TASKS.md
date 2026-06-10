# TASKS.md — Autonomous Loop Task Queue

## Loop rules
- Work P1 first, then P2, then P3
- After each task: `npm test && npm run eval && npm run typecheck && npm run lint`
- All green + AC met → mark [x], commit "task: [name]", push, proceed immediately
- Tests fail → fix within same task, max 3 attempts
- Still failing after 3 → write to BLOCKERS.md, mark [-], move on
- Genuine product/design decision → write to DECISIONS.md, mark [?], move on
- After completing all current tasks → run a full REVIEW PASS (see below)
- Never stop and ask. Never wait for confirmation.

## Review pass (run after all tasks complete)
Read ROLES.md. For each role in order, audit the current codebase through that 
lens. For every gap found that is not already in this file: add a new task with 
priority tier and acceptance criteria. Then restart the loop from P1.
The loop only terminates when a review pass finds zero new gaps to add.

---

## P1 — Blocking

- [x] **Strip T-codes from all display surfaces** — step descriptions, generalised 
  pattern titles, breaking controls gap messages. AC: no string matching `/T\d{4}/` 
  visible in any non-technical UI surface.

- [x] **Fix incident dates** — add `incident_date` column to `incidents` table, 
  populate seed with real dates (M&S: 2025-04-22, BL: 2023-10-28), show on feed 
  card instead of `created_at`. AC: M&S card shows "April 2025", BL shows "October 2023".

- [x] **Sector inference** — add `sector` column to `incidents` table, infer from 
  incident name/chain keywords via static map. AC: both feed cards show a sector, 
  not "Sector unspecified".

- [x] **Admin router auth** — API key middleware on all `/admin` routes. Read 
  `ADMIN_API_KEY` from env, reject without `x-admin-api-key` header with 401. 
  Add to `.env.example`. AC: unauthenticated request returns 401.

- [x] **Breaking controls gap message** — replace internal technical message 
  ("Consult ATT&CK Mitigations for T1133 — no CTID 800-53 mapping exists...") 
  with user-facing text ("No mapped control available for this technique. 
  Review MITRE ATT&CK mitigations directly."). AC: no user-facing text contains 
  "no CTID 800-53 mapping exists".

## P2 — Important

- [x] **PDF report export** — "Export Report" button on DetailPage. Use 
  `@react-pdf/renderer`. Contains: incident title, date, actor, verdict, attack 
  chain in plain English, breaking controls, self-assessment questions with blank 
  answer boxes, caveats. No T-codes. AC: PDF downloads with all five sections.

- [x] **Persistent self-assessment** — persist toggle state to localStorage keyed 
  by `reconstruction_results.id`. Rehydrate on mount. AC: toggle a question, 
  reload, state preserved.

- [x] **Fix Sector View 0 sectors** — investigate `x-mitre-sectors` in STIX bundle.
  Add keyword-based fallback from group descriptions. Fix version label to show 
  "ATT&CK 16.1". AC: ≥3 sector cards visible, version label correct.

- [x] **Verify decay → caveats path** — confirm `claim_staleness` rows surface in 
  `verdict.caveats[]`. AC: synthetic staleness row produces caveat in verdict output.

- [x] **README.md** — root-level README with: what the product is, prerequisites, 
  setup steps, how to run tests, how to run the eval suite, architecture overview. 
  AC: a developer with no prior context can set up and run the product from the README alone.

- [x] **CI pipeline** — `.github/workflows/ci.yml` running `npm test`, `npm run eval`, 
  `npm run typecheck`, `npm run lint` on push and PR to main. AC: pipeline runs 
  and passes on current main.

- [x] **Health check endpoint** — `GET /health` returns `{ status: "ok", db: "ok" }` 
  with DB connectivity check. AC: endpoint returns 200 with db status.

- [x] **Rate limiting** — `express-rate-limit` on reconstruction endpoint (10/hour/IP) 
  and admin router (20/hour/IP). AC: 11th reconstruction request returns 429.

- [x] **Add Incident form fix** — route through review queue (Option A). Form calls `reconstruction.submit` which creates a `review_queue` row; shows "Submitted for review" confirmation; incident appears in feed only after admin approval. Invariant 11 satisfied.

- [x] **Admin auth test** — add integration test: unauthenticated request to any `/admin` route returns 401; request with correct `x-admin-api-key` returns 200. AC: two tests pass covering both cases.

- [x] **`reconstruction.list` pagination** — add `cursor`-based pagination to `reconstruction.list` (default page size 20). AC: query with no cursor returns first 20; `nextCursor` in response allows fetching the next page.

- [x] **Startup secret validation** — validate `ADMIN_API_KEY` at server start; if absent, log a clear error and exit with code 1. AC: starting the server without `ADMIN_API_KEY` set prints a descriptive error and exits.

- [x] **Input length validation** — `SourceDocument.text` and `incident_sources` array have no size bounds; large payloads can exhaust memory. AC: `z.string().max(100_000)` on `SourceDocument.text`; `z.array(...).max(100)` on `incident_sources`; oversized input returns 400, not 500.

- [x] **CORS origin env var** — CORS origin hardcoded to `http://localhost:5173` breaks production. AC: `CORS_ORIGIN` env var read at startup; falls back to localhost; `.env.example` updated.

- [x] **Pagination cursor bounds** — cursor accepts 0 or negative integers, querying all rows. AC: `z.number().int().positive()` on cursor; negative/zero cursor returns 400.

- [x] **Verdict logic unit tests** — `packages/engine/src/verdict.ts` has no isolated unit tests; verdict is critical to product. AC: tests cover (a) all controls blocked → would_likely_succeed; (b) prevent-axis break → would_likely_fail; (c) detect-axis break registered; (d) empty chain → indeterminate.

- [x] **Validate `result_json` on DB read** — `row.result_json as unknown as ReconstructionOutput` in `router.ts` bypasses Zod; schema-drifted rows silently produce wrong output. AC: `ReconstructionOutput.parse()` called on read; a row with missing required fields surfaces a 500, not corrupt data.

- [x] **Admin-router body Zod validation** — `req.body` cast without validation in approve/reject routes; malformed body causes type confusion. AC: Zod schema validates `reviewer` and `reconstruction_input` before use; invalid shape returns 400.

- [x] **Breaking-controls axis cast validation** — `link.score_category ?? "prevent"` cast as `DefensiveAxis` without checking valid values; CTID data with unexpected category silently produces wrong axis. AC: validate against `["prevent","detect","respond"]` and fall back to "prevent" with an explicit guard.

## P3 — Polish

- [x] **M8 negation-aware extraction** — sentence-level negation pre-filter before 
  pattern matching on press sources. AC: "no evidence of T1003" does not produce 
  T1003 chain step; eval suite green.

- [x] **Responsive layout** — verify layout at 1280px and 1440px breakpoints. 
  Fix any overflow or broken layouts. AC: no horizontal scroll at either width.

- [x] **Focus states** — all interactive elements have visible focus rings. 
  AC: keyboard tab through the full feed → detail → self-assessment journey 
  without losing focus visibility.

- [x] **`npm audit`** — run audit, fix any high/critical vulnerabilities. 
  AC: `npm audit` returns 0 high or critical vulnerabilities.

- [x] **Remove ReconstructPage.tsx dead code** — `packages/web/src/pages/ReconstructPage.tsx` is not imported or rendered anywhere. AC: file removed; `npm run build`, typecheck, lint all pass.

- [x] **Aria-hidden decorative icons** — icons in `AttackChainView` (ShieldAlert, Eye, Zap, ChevronDown) are decorative (text labels present). Add `aria-hidden={true}` to each. AC: icons have `aria-hidden="true"` in rendered HTML.

- [x] **STIX bundle caching** — `fetchSectorView()` fetches the ATT&CK STIX bundle on every call. Cache the parsed bundle in module scope with a 1-hour TTL. AC: two calls within 1 hour result in only one network request to the STIX URL.

- [x] **T-code regression test** — add an eval assertion that no string matching `/T\d{4}/` appears in `what_happened`, `generalised_pattern.title`, `generalised_pattern.chain_summary`, or any `gap` text in the M&S reconstruction output. AC: test passes; if a T-code is reintroduced in engine prose, the test fails.

- [x] **Timing-safe API key comparison** — `!==` comparison is vulnerable to timing attacks. AC: `crypto.timingSafeEqual()` used for API key comparison in admin-router middleware.

- [x] **Graceful shutdown** — PGlite holds file handles; no SIGTERM handler. AC: `SIGTERM` and `SIGINT` close the database before exiting; server drains inflight requests.

- [x] **Schema bounds unit test** — no test verifies that oversized `SourceDocument.text` or excess `incident_sources` items trigger a Zod validation error. AC: test asserts that `ReconstructionInput.parse()` throws when text exceeds 100 KB or sources exceed 100 items.

- [x] **Generalisation unit tests** — `generalise()` in `generalisation.ts` has no isolated unit tests. AC: tests cover (a) empty chain produces empty pattern; (b) all steps produce title/chain_summary without T-codes; (c) control gaps are well-formed.

- [x] **`getBreakingControls()` unit tests** — critical CTID → analyst-asserted fallback logic (Invariant 4) has no isolated tests. AC: tests cover (a) non-mappable technique returns analyst-asserted controls; (b) known CTID technique returns CTID-mapped controls with valid axis; (c) fully unknown technique returns ATT&CK pointer.

- [x] **`selfAssess()` unit tests** — self-assessment generation has no isolated tests; testability assignment and fallback paths uncovered. AC: tests cover (a) known technique produces analyst-asserted entries with correct testability; (b) unknown technique produces fallback entry; (c) entries carry correct `evidence_tier_of_underlying_step`.

- [x] **Migration idempotency** — `0001_init.sql` and `0002_m6.sql` use bare `CREATE TYPE`/`CREATE TABLE` without `IF NOT EXISTS`; re-running after a partial failure errors. AC: all DDL statements in both files use `IF NOT EXISTS`; `createMigratedDb()` succeeds when called twice against the same DB.

---

## Final Product Sprint

### P1 — The client concept (the missing core)

- [x] **Client model** — add a `clients` table (migration):
  `id`, `name`, `sector`, `tech_stack_notes` (text), `created_at`.
  Add a `client_assessments` table:
  `id`, `client_id` (FK), `reconstruction_id` (FK to reconstruction_results),
  `answers` (jsonb — map of step index → yes/partial/no),
  `created_at`, `updated_at`.
  AC: migration runs cleanly; tables exist with correct constraints.

- [x] **New Assessment flow** — add a "New Assessment" button to the
  reconstruction DetailPage (alongside "Export Report"). Clicking opens a
  modal (shadcn Dialog) with three fields: Client name (text input),
  Client sector (select, seeded from the same sector map used for inference),
  Technology stack notes (textarea, optional, 500 char max).
  On submit: creates a `clients` row (or reuses existing client by name),
  creates a `client_assessments` row linked to the current reconstruction,
  navigates to the new AssessmentPage. No page reload.
  AC: modal opens, form submits, assessment row created, navigates to assessment.

- [x] **AssessmentPage** — new page (`pages/AssessmentPage.tsx`), reached from
  the detail view. Renders: client name and sector as the headline;
  the incident name as subtitle; the self-assessment questionnaire with
  yes/partial/no toggle buttons (not dropdowns — three visible buttons per
  question, one active state); answers persisted to `client_assessments.answers`
  via a tRPC mutation on every toggle change (debounced 500ms, not on submit).
  Displays a live verdict panel that recomputes on every answer change:
  "Based on your answers, this attack would be stopped at Step X (PREVENT —
  [control name])" or "Based on your answers, this attack would likely succeed —
  no controls address the critical path." The verdict updates without a page
  reload. Back link returns to the reconstruction detail.
  AC: toggling an answer updates the verdict within 500ms; answers survive
  page reload (loaded from DB); verdict correctly identifies earliest answered
  step with a 'yes' PREVENT control as the break point.

- [x] **Gap analysis panel** — below the live verdict on AssessmentPage,
  render a gap analysis: one row per attack chain step, showing:
  step plain-English description, the breaking control for that step,
  and a status derived from the client's answer (green tick if yes,
  amber warning if partial, red cross if no, grey dash if unanswered).
  Steps where the answer is 'no' or unanswered are highlighted as gaps.
  AC: gap analysis renders all steps; status icons match toggle answers;
  unanswered steps show as gaps.

### P1 — Admin review UI (makes the queue flow usable)

- [x] **Admin page** — add a third nav item "Admin" visible only when
  `VITE_ADMIN_API_KEY` env var is set (dev/internal only — not shown to
  clients). The AdminPage (`pages/AdminPage.tsx`) shows a table of pending
  `review_queue` items: incident name (from `candidate_title`), submitted date,
  type (new-incident / verdict-change), tier ceiling, and Approve / Reject
  buttons. Approve calls `POST /admin/review/:id/approve` with the API key
  header. Reject calls `POST /admin/review/:id/reject`. After approve/reject
  the row is removed from the table and a success toast is shown.
  AC: pending items appear in the table; approve/reject call the correct
  endpoints with the API key header; row disappears after action.

- [x] **tRPC `review.list` procedure** — add `review.list` to the router,
  returning all `review_queue` rows with `status=pending`, joined to
  `incidents` for the name. Used by AdminPage.
  AC: procedure returns correct rows; empty array if no pending items.

### P2 — Client-personalised PDF report

- [x] **Assessment PDF** — extend the existing PDF export to accept an optional
  `clientAssessment` prop. When a client assessment is loaded (from AssessmentPage),
  the PDF becomes client-personalised: replace the generic header with
  "[Client Name] — Threat Assessment Report", add a cover section showing
  client name, sector, tech stack notes, assessment date, and the preparer
  ("Prepared by Waterstons"). Add a Gap Analysis section showing the step-by-step
  breakdown with client answers and gap status. Add a Priority Actions section
  listing the top 3 unaddressed steps by chain order.
  The generic (non-client) PDF remains unchanged for use from the detail page.
  AC: assessment PDF contains client name in header; gap analysis section
  present with correct step statuses; generic PDF unchanged.

### P2 — Sector brief export

- [x] **Sector brief PDF** — add an "Export Brief" button to SectorPage,
  visible per sector card. Generates a 1-2 page PDF titled
  "Threat Intelligence Brief — [Sector] — [date]". Content:
  paragraph 1 — sector threat summary (top actor, top technique, KEV count,
  plain English — generated deterministically from the sector card data,
  no LLM call); paragraph 2 — recent advisories (list of KEV entries with
  dates); paragraph 3 — recommended priority controls (the breaking controls
  for the top 2 techniques, from the static analyst-asserted library or CTID).
  AC: PDF downloads with three sections; no T-codes visible; sector name
  and date correct.

### P2 — Visual attack chain

- [x] **Visual chain flow** — replace the stacked step cards in the
  reconstruction detail with a visual vertical flow: each step is a node
  connected to the next by a solid vertical line with an arrow. Left side
  of each node shows the MITRE tactic phase label (plain English, e.g.
  "Initial Access") in a small muted pill. The node body is the existing
  step card content. The connector line is coloured by the evidence tier
  of the step it connects to (CONFIRMED = green, REPORTED = amber,
  INFERRED = grey). This makes the kill-chain narrative visual and
  immediately communicates where the evidence is strong vs inferred.
  AC: steps are visually connected; connector colour matches step tier;
  existing step content unchanged; all tests pass.

### P2 — Feed search and filter

- [x] **Feed filter bar** — add a filter bar below the "Incident Feed" header.
  Three filters: Sector (select, options derived from distinct sectors in the
  feed data), Severity (select: ALL / HIGH / MEDIUM / LOW), Actor (text input,
  fuzzy match on actor name). Filters apply client-side against the loaded
  feed data (no new API call needed at this scale). Clear filters button.
  AC: filtering by severity hides non-matching cards; filtering by actor
  shows only matching cards; clear resets to full feed.

### P3 — Polish and completeness

- [ ] **Incident timeline** — replace the Version Log table in the detail view
  with a visual timeline component. Each entry is a dot on a vertical line
  with the date on the left and the event description on the right
  (e.g. "T1133 upgraded REPORTED → CONFIRMED — British Library Cyber
  Incident Review"). Most recent at top. AC: timeline renders all version
  log entries; dates formatted consistently; visual dots visible.

- [ ] **Toast notifications** — add `sonner` (already in shadcn/ui ecosystem)
  for success/error toasts: assessment saved, PDF exported, incident submitted
  for review, admin approve/reject. AC: each action shows a toast that
  auto-dismisses after 3 seconds.

- [ ] **Empty states** — every page and section that can be empty has a
  meaningful empty state: no clients yet, no pending admin items, no
  assessments for this incident, no sector data for this sector.
  Empty states include an icon, a one-line explanation, and a primary action.
  AC: all four empty states render with icon + text + action button.

- [ ] **Keyboard navigation audit** — use keyboard only to complete the
  full journey: feed → detail → new assessment → answer questions → export PDF.
  Fix any step where focus is lost or a control is unreachable.
  AC: full journey completable by keyboard without mouse.

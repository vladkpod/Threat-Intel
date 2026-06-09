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

- [ ] **Fix incident dates** — add `incident_date` column to `incidents` table, 
  populate seed with real dates (M&S: 2025-04-22, BL: 2023-10-28), show on feed 
  card instead of `created_at`. AC: M&S card shows "April 2025", BL shows "October 2023".

- [ ] **Sector inference** — add `sector` column to `incidents` table, infer from 
  incident name/chain keywords via static map. AC: both feed cards show a sector, 
  not "Sector unspecified".

- [ ] **Admin router auth** — API key middleware on all `/admin` routes. Read 
  `ADMIN_API_KEY` from env, reject without `x-admin-api-key` header with 401. 
  Add to `.env.example`. AC: unauthenticated request returns 401.

- [x] **Breaking controls gap message** — replace internal technical message 
  ("Consult ATT&CK Mitigations for T1133 — no CTID 800-53 mapping exists...") 
  with user-facing text ("No mapped control available for this technique. 
  Review MITRE ATT&CK mitigations directly."). AC: no user-facing text contains 
  "no CTID 800-53 mapping exists".

## P2 — Important

- [ ] **PDF report export** — "Export Report" button on DetailPage. Use 
  `@react-pdf/renderer`. Contains: incident title, date, actor, verdict, attack 
  chain in plain English, breaking controls, self-assessment questions with blank 
  answer boxes, caveats. No T-codes. AC: PDF downloads with all five sections.

- [ ] **Persistent self-assessment** — persist toggle state to localStorage keyed 
  by `reconstruction_results.id`. Rehydrate on mount. AC: toggle a question, 
  reload, state preserved.

- [ ] **Fix Sector View 0 sectors** — investigate `x-mitre-sectors` in STIX bundle.
  Add keyword-based fallback from group descriptions. Fix version label to show 
  "ATT&CK 16.1". AC: ≥3 sector cards visible, version label correct.

- [ ] **Verify decay → caveats path** — confirm `claim_staleness` rows surface in 
  `verdict.caveats[]`. AC: synthetic staleness row produces caveat in verdict output.

- [ ] **README.md** — root-level README with: what the product is, prerequisites, 
  setup steps, how to run tests, how to run the eval suite, architecture overview. 
  AC: a developer with no prior context can set up and run the product from the README alone.

- [ ] **CI pipeline** — `.github/workflows/ci.yml` running `npm test`, `npm run eval`, 
  `npm run typecheck`, `npm run lint` on push and PR to main. AC: pipeline runs 
  and passes on current main.

- [ ] **Health check endpoint** — `GET /health` returns `{ status: "ok", db: "ok" }` 
  with DB connectivity check. AC: endpoint returns 200 with db status.

- [ ] **Rate limiting** — `express-rate-limit` on reconstruction endpoint (10/hour/IP) 
  and admin router (20/hour/IP). AC: 11th reconstruction request returns 429.

## P3 — Polish

- [ ] **M8 negation-aware extraction** — sentence-level negation pre-filter before 
  pattern matching on press sources. AC: "no evidence of T1003" does not produce 
  T1003 chain step; eval suite green.

- [ ] **Responsive layout** — verify layout at 1280px and 1440px breakpoints. 
  Fix any overflow or broken layouts. AC: no horizontal scroll at either width.

- [ ] **Focus states** — all interactive elements have visible focus rings. 
  AC: keyboard tab through the full feed → detail → self-assessment journey 
  without losing focus visibility.

- [ ] **`npm audit`** — run audit, fix any high/critical vulnerabilities. 
  AC: `npm audit` returns 0 high or critical vulnerabilities.

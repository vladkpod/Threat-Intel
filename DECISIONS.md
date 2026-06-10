# DECISIONS.md — Product & Design Decisions Pending Resolution

Items marked [?] in TASKS.md require an owner decision before implementation.

---

## [x] Add Incident form — route through review queue or remove?

**Date raised:** 2026-06-09

**Problem:** The "Add Incident" form in `FeedPage.tsx` calls `trpc.reconstruction.run` which
executes `reconstruct()` directly as a pure function. The returned result is never persisted to the
database. After "success", `query.refetch()` fires but the list is unchanged — no new incident
appears in the feed. The form is broken from a user perspective.

**CLAUDE.md constraint (Invariant 11):** Auto-detected incidents must route through the human
review queue. The "Add Incident" button, if fixed to persist results, would bypass this gate.

**Options:**

A. **Route through the queue** — "Add Incident" creates a `review_queue` row with status `pending`.
   The admin approves it via `/admin/review/:id/approve` with `reconstruction_input`. The incident
   then appears in the feed. This is the correct Invariant 11-compliant path but requires
   significant UI work (show pending state, poll for approval, etc.).

B. **Remove the form** — Delete the "Add Incident" button and form from `FeedPage.tsx`. Dev
   incidents are added via the seed script. This is the simplest fix and keeps the UI clean.

C. **Mark as admin-only dev feature** — Keep the form but make it clear it's a developer tool
   that bypasses review, add a prominent warning, and only show it when a flag is set.

**Recommendation:** Option B (remove) if the primary use case is client demos seeded with real
incidents; Option A if the product needs self-service incident submission from analysts.

**Decision (2026-06-10):** Option A — route through the review queue. The form now calls `reconstruction.submit` which creates a `review_queue` row (`type: "new-incident"`, `tier_ceiling: "REPORTED"`). On success the form shows "Submitted for review — approve via the admin flow to publish to feed." Admins approve via `POST /admin/review/:id/approve` with `reconstruction_input`. Invariant 11 satisfied; the incident appears in the feed only after human approval.

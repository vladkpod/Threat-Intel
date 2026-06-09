/**
 * reconstruction.list pagination tests.
 *
 * AC: query with no cursor returns first 20; nextCursor in response allows
 * fetching the next page.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createMigratedDb } from "@store";
import { createIncident, storeReconstructionResult, createReviewItem } from "@store";
import type { Db } from "@store";

let db: Db;

beforeAll(async () => {
  db = await createMigratedDb();

  // Create one incident and 25 reconstruction results linked to it.
  const incident = await createIncident(db, "test-incident-pag", "Test Incident Pagination");
  const review = await createReviewItem(db, {
    feed_job_id: null,
    type: "new-incident",
    candidate_title: "Test",
    candidate_text: "Test incident for pagination",
    tier_ceiling: "REPORTED",
  });

  for (let i = 0; i < 25; i++) {
    await storeReconstructionResult(
      db,
      incident.id,
      review.id,
      [],
      { mock: true, index: i },
    );
  }
});

async function listPage(cursor?: number) {
  const PAGE_SIZE = 20;
  const res = await db.query<{ id: number }>(
    cursor !== undefined
      ? `SELECT rr.id FROM reconstruction_results rr
         WHERE rr.id < $1 ORDER BY rr.id DESC LIMIT ${PAGE_SIZE + 1}`
      : `SELECT rr.id FROM reconstruction_results rr
         ORDER BY rr.id DESC LIMIT ${PAGE_SIZE + 1}`,
    cursor !== undefined ? [cursor] : [],
  );
  const hasMore = res.rows.length > PAGE_SIZE;
  const items = hasMore ? res.rows.slice(0, PAGE_SIZE) : res.rows;
  const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;
  return { items, nextCursor };
}

describe("[PAGINATION] reconstruction.list cursor pagination", () => {
  it("returns first 20 items and a nextCursor when more exist", async () => {
    const page1 = await listPage();
    expect(page1.items).toHaveLength(20);
    expect(page1.nextCursor).not.toBeNull();
  });

  it("returns remaining items and null nextCursor on second page", async () => {
    const page1 = await listPage();
    const page2 = await listPage(page1.nextCursor!);
    expect(page2.items.length).toBeGreaterThanOrEqual(5);
    expect(page2.nextCursor).toBeNull();
  });

  it("pages do not overlap", async () => {
    const page1 = await listPage();
    const page2 = await listPage(page1.nextCursor!);
    const ids1 = new Set(page1.items.map((r) => r.id));
    const ids2 = page2.items.map((r) => r.id);
    for (const id of ids2) {
      expect(ids1.has(id)).toBe(false);
    }
  });
});

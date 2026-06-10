/**
 * Unit tests for reconstruction.submit tRPC procedure.
 *
 * Verifies that submitting an incident creates a pending review_queue row
 * (Invariant 11) and never calls reconstruct().
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createMigratedDb, listPendingReviews } from "@store";
import type { Db } from "@store";
import { appRouter } from "../../../packages/api/src/router.js";

let db: Db;
let caller: ReturnType<typeof appRouter.createCaller>;

const VALID_INPUT = {
  incident_name: "Test Submit Incident",
  incident_sources: [
    {
      id: "src-1",
      label: "Test Source",
      independence_group: "G1" as const,
      tier_ceiling: "REPORTED" as const,
      proximity: "direct",
      primary: true,
      derivative_of: null,
      incentive_bias: null,
      text: "Test source text for submission flow.",
    },
  ],
};

beforeAll(async () => {
  db = await createMigratedDb();
  caller = appRouter.createCaller({ db });
});

describe("[SUBMIT] reconstruction.submit", () => {
  it("returns a review_id (number) on valid input", async () => {
    const result = await caller.reconstruction.submit(VALID_INPUT);
    expect(typeof result.review_id).toBe("number");
    expect(result.review_id).toBeGreaterThan(0);
  });

  it("creates a pending review_queue row with type new-incident (Invariant 11)", async () => {
    const before = (await listPendingReviews(db)).length;
    await caller.reconstruction.submit({ ...VALID_INPUT, incident_name: "Submit Test 2" });
    const after = await listPendingReviews(db);
    expect(after.length).toBe(before + 1);
    const newest = after[after.length - 1]!;
    expect(newest.type).toBe("new-incident");
    expect(newest.status).toBe("pending");
  });

  it("sets candidate_title to incident_name", async () => {
    const result = await caller.reconstruction.submit({
      ...VALID_INPUT,
      incident_name: "My Titled Incident",
    });
    const reviews = await listPendingReviews(db);
    const row = reviews.find((r) => r.id === result.review_id);
    expect(row?.candidate_title).toBe("My Titled Incident");
  });

  it("sets tier_ceiling to REPORTED", async () => {
    const result = await caller.reconstruction.submit(VALID_INPUT);
    const reviews = await listPendingReviews(db);
    const row = reviews.find((r) => r.id === result.review_id);
    expect(row?.tier_ceiling).toBe("REPORTED");
  });

  it("rejects input with no sources (schema guard)", async () => {
    await expect(
      caller.reconstruction.submit({ ...VALID_INPUT, incident_sources: [] }),
    ).rejects.toThrow();
  });

  it("rejects input with empty incident_name (schema guard)", async () => {
    await expect(
      caller.reconstruction.submit({ ...VALID_INPUT, incident_name: "" }),
    ).rejects.toThrow();
  });
});

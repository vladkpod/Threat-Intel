/**
 * Unit tests for assessment tRPC procedures and review.list.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createMigratedDb } from "@store";
import type { Db } from "@store";
import { appRouter } from "../../../packages/api/src/router.js";

let db: Db;
let caller: ReturnType<typeof appRouter.createCaller>;

// Seed a reconstruction result so FK from client_assessments works.
async function seedReconstructionResult(db: Db): Promise<number> {
  const incident = await db.query<{ id: number }>(
    `INSERT INTO incidents (slug, name) VALUES ('test-incident', 'Test Incident')
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
  );
  const incidentId = incident.rows[0]!.id;

  // Need a review_queue row for the FK on reconstruction_results
  const rq = await db.query<{ id: number }>(
    `INSERT INTO review_queue (type, candidate_title, candidate_text, tier_ceiling, status)
     VALUES ('new-incident', 'Test', '{}', 'REPORTED', 'approved')
     RETURNING id`,
  );
  const rqId = rq.rows[0]!.id;

  const rr = await db.query<{ id: number }>(
    `INSERT INTO reconstruction_results (incident_id, review_queue_id, critical_path_techniques, result_json)
     VALUES ($1, $2, '[]'::jsonb, '{
       "incident": {"name":"Test","actor":"TestActor","summary":"s","source_quality_note":null},
       "attack_chain": [],
       "generalised_pattern": {"title":"t","preconditions":[],"chain_summary":"c","control_gaps":[]},
       "inferable_control_gaps": [],
       "self_assessment": [],
       "verdict": {"method":"m","result":"indeterminate","earliest_breakable_step":null,"break_axis":null,"confidence":"REPORTED","caveats":[]},
       "version_log": []
     }'::jsonb)
     RETURNING id`,
    [incidentId, rqId],
  );
  return rr.rows[0]!.id;
}

beforeAll(async () => {
  db = await createMigratedDb();
  caller = appRouter.createCaller({ db });
});

describe("[ASSESSMENT] assessment.create", () => {
  it("creates a client and assessment row", async () => {
    const reconId = await seedReconstructionResult(db);
    const result = await caller.assessment.create({
      client_name: "Acme Corp",
      client_sector: "Retail",
      reconstruction_id: reconId,
    });
    expect(typeof result.assessment_id).toBe("number");
    expect(result.assessment_id).toBeGreaterThan(0);
    expect(typeof result.client_id).toBe("number");
  });

  it("reuses existing client by name (case-insensitive)", async () => {
    const reconId = await seedReconstructionResult(db);
    const first = await caller.assessment.create({
      client_name: "Reuse Client",
      reconstruction_id: reconId,
    });
    // Create a different reconstruction to avoid UNIQUE constraint on (client_id, reconstruction_id)
    const reconId2 = await seedReconstructionResult(db);
    const second = await caller.assessment.create({
      client_name: "reuse client",
      reconstruction_id: reconId2,
    });
    expect(first.client_id).toBe(second.client_id);
  });

  it("rejects empty client_name", async () => {
    const reconId = await seedReconstructionResult(db);
    await expect(
      caller.assessment.create({ client_name: "", reconstruction_id: reconId }),
    ).rejects.toThrow();
  });

  it("rejects tech_stack_notes over 500 chars", async () => {
    const reconId = await seedReconstructionResult(db);
    await expect(
      caller.assessment.create({
        client_name: "Long Notes Client",
        reconstruction_id: reconId,
        tech_stack_notes: "x".repeat(501),
      }),
    ).rejects.toThrow();
  });
});

describe("[ASSESSMENT] assessment.saveAnswers", () => {
  it("persists answers and returns updated row", async () => {
    const reconId = await seedReconstructionResult(db);
    const created = await caller.assessment.create({
      client_name: "Save Test Client",
      reconstruction_id: reconId,
    });
    const saved = await caller.assessment.saveAnswers({
      id: created.assessment_id,
      answers: { "1": "yes", "2": "no", "3": "partial" },
    });
    expect(saved.answers).toMatchObject({ "1": "yes", "2": "no", "3": "partial" });
  });

  it("rejects invalid answer values", async () => {
    const reconId = await seedReconstructionResult(db);
    const created = await caller.assessment.create({
      client_name: "Invalid Answer Client",
      reconstruction_id: reconId,
    });
    await expect(
      caller.assessment.saveAnswers({
        id: created.assessment_id,
        answers: { "1": "maybe" as "yes" },
      }),
    ).rejects.toThrow();
  });
});

describe("[REVIEW] review.list", () => {
  it("returns pending items only", async () => {
    const before = await caller.review.list();
    // Add a pending item
    await db.query(
      `INSERT INTO review_queue (type, candidate_title, candidate_text, tier_ceiling, status)
       VALUES ('new-incident', 'Review List Test', '{}', 'REPORTED', 'pending')`,
    );
    const after = await caller.review.list();
    expect(after.length).toBe(before.length + 1);
    for (const item of after) {
      expect(item.status).toBe("pending");
    }
  });

  it("returns empty array when no pending items", async () => {
    // Use fresh DB just for this test
    const freshDb = await createMigratedDb();
    const freshCaller = appRouter.createCaller({ db: freshDb });
    const items = await freshCaller.review.list();
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBe(0);
  });
});

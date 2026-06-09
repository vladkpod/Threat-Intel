/**
 * Dev seed — bypasses the queue intentionally.
 *
 * Loads the M&S and British Library sources_full fixtures, calls reconstruct()
 * on each, and writes the results directly into the file-based PGlite database
 * at .pglite/data so they appear in the Incident Feed without any queue flow.
 *
 * Usage:  npx tsx scripts/seed-feed.ts
 *
 * Run this BEFORE starting the API server (both processes cannot hold the same
 * PGlite file open simultaneously). The API server reads from the same path
 * when started via `npm run dev:api`.
 */

import { rmSync, mkdirSync } from "node:fs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createMigratedDb, createIncident, storeReconstructionResult } from "@store";
import { reconstruct } from "@engine";

// Anchored to repo root via import.meta.url so the path is correct regardless
// of which directory the script is invoked from.
const DATA_DIR = fileURLToPath(new URL("../.pglite/data", import.meta.url));

const FIXTURES = [
  fileURLToPath(
    new URL("../tests/eval/ms_2025/fixtures/sources_full.json", import.meta.url),
  ),
  fileURLToPath(
    new URL("../tests/eval/bl_2023/fixtures/sources_full.json", import.meta.url),
  ),
];

console.log(`Clearing ${DATA_DIR}…`);
rmSync(DATA_DIR, { recursive: true, force: true });
mkdirSync(DATA_DIR, { recursive: true });

const db = await createMigratedDb(DATA_DIR);

for (const fixturePath of FIXTURES) {
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
    incident_name: string;
  };

  console.log(`Reconstructing: ${fixture.incident_name}`);
  const result = reconstruct(fixture);

  // Seed bypass of Invariant 11: insert a pre-approved review_queue row so the
  // reconstruction_results FK is satisfied. This code path is intentionally
  // dev-only — the queue gate must not be bypassed in production.
  const rq = await db.query<{ id: number }>(
    `INSERT INTO review_queue
       (feed_job_id, type, candidate_title, candidate_text, tier_ceiling,
        status, reviewed_by, reviewed_at)
     VALUES (NULL, 'new-incident', $1, $2, 'CONFIRMED', 'approved', 'seed-script', now())
     RETURNING id`,
    [fixture.incident_name, `Dev seed: ${fixture.incident_name}`],
  );
  const reviewId = rq.rows[0]!.id;

  const slug = fixture.incident_name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  const incident = await createIncident(db, slug, fixture.incident_name);

  const eb = result.verdict.earliest_breakable_step;
  const criticalPathEnd = eb ?? result.attack_chain.length;
  const criticalPathTechniques = result.attack_chain
    .filter((step) => step.step <= criticalPathEnd)
    .map((step) => step.attack_technique)
    .filter((t): t is string => t !== null && t !== undefined);

  await storeReconstructionResult(
    db,
    incident.id,
    reviewId,
    criticalPathTechniques,
    result,
  );

  console.log(`  ✓ ${fixture.incident_name}`);
}

console.log("\nSeed complete. Start the API with:  npm run dev:api");
process.exit(0);

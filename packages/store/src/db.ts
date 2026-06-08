/**
 * Embedded Postgres (pglite) client + migration runner.
 *
 * We use pglite so the real Postgres DDL in migrations/ runs in-process — tests
 * exercise the actual schema, and production points the same SQL at a managed
 * Postgres. Migrations are plain .sql files applied in filename order.
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

export type Db = PGlite;

const MIGRATIONS_DIR = fileURLToPath(new URL("../migrations/", import.meta.url));

/** Apply every migration in filename order. Idempotent — tracks applied files. */
export async function migrate(db: Db): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const done = await db.query<{ filename: string }>(
      `SELECT filename FROM _migrations WHERE filename = $1`,
      [file],
    );
    if (done.rows.length > 0) continue;

    const sql = readFileSync(`${MIGRATIONS_DIR}${file}`, "utf8");
    await db.exec(sql);
    await db.query(`INSERT INTO _migrations (filename) VALUES ($1)`, [file]);
  }
}

/**
 * Create (or open) a database with all migrations applied.
 * Pass a directory path for file-based persistence; omit for in-memory.
 */
export async function createMigratedDb(dataDir?: string): Promise<Db> {
  const db = await PGlite.create(dataDir);
  await migrate(db);
  return db;
}

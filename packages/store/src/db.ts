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

/** Apply every migration in filename order. Idempotent per fresh database. */
export async function migrate(db: Db): Promise<void> {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = readFileSync(`${MIGRATIONS_DIR}${file}`, "utf8");
    await db.exec(sql);
  }
}

/** Create a fresh in-memory database with all migrations applied. */
export async function createMigratedDb(): Promise<Db> {
  const db = await PGlite.create();
  await migrate(db);
  return db;
}

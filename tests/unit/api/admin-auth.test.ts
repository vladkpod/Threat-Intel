/**
 * Admin router authentication tests.
 *
 * AC: unauthenticated request returns 401; request with correct key returns 200.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import { createAdminRouter } from "../../../packages/api/src/admin-router.js";
import { createMigratedDb } from "@store";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

let server: Server;
let baseUrl: string;
const TEST_API_KEY = "test-secret-key-12345";

beforeAll(async () => {
  process.env["ADMIN_API_KEY"] = TEST_API_KEY;
  const db = await createMigratedDb();
  const app = express();
  app.use(express.json());
  app.use("/admin", createAdminRouter(db));
  server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  baseUrl = `http://localhost:${port}`;
});

afterAll(() => {
  server.close();
  delete process.env["ADMIN_API_KEY"];
});

describe("[ADMIN.AUTH] admin router authentication", () => {
  it("returns 401 when x-admin-api-key header is missing", async () => {
    const res = await fetch(`${baseUrl}/admin/review`);
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/unauthorized/i);
  });

  it("returns 401 when x-admin-api-key header is wrong", async () => {
    const res = await fetch(`${baseUrl}/admin/review`, {
      headers: { "x-admin-api-key": "wrong-key" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 200 when x-admin-api-key header is correct", async () => {
    const res = await fetch(`${baseUrl}/admin/review`, {
      headers: { "x-admin-api-key": TEST_API_KEY },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { items: unknown[] };
    expect(Array.isArray(body.items)).toBe(true);
  });
});

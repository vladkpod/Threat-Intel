import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { appRouter } from "./router.js";
import { createAdminRouter } from "./admin-router.js";
import { createMigratedDb } from "@store";

const app = express();
const corsOrigin = process.env["CORS_ORIGIN"] ?? "http://localhost:5173";
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

const reconstructionRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many reconstruction requests. Limit: 10 per hour." },
});

const adminRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many admin requests. Limit: 20 per hour." },
});

// Validate required secrets at startup — fail fast with a clear message.
if (!process.env["ADMIN_API_KEY"]) {
  console.error(
    "FATAL: ADMIN_API_KEY environment variable is not set.\n" +
    "Copy .env.example to .env and set a value before starting the server.",
  );
  process.exit(1);
}

const port = Number(process.env["PORT"] ?? 3001);

// Anchor the data dir to the repo root (three levels up from packages/api/src/).
// Using import.meta.url avoids cwd ambiguity when npm runs from the workspace dir.
const REPO_ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..");
const dataDir = process.env["PGLITE_DATA_DIR"] ?? resolve(REPO_ROOT, ".pglite/data");
void createMigratedDb(dataDir).then((db) => {
  app.get("/health", (_req, res) => {
    void db.query("SELECT 1")
      .then(() => res.json({ status: "ok", db: "ok" }))
      .catch(() => res.status(503).json({ status: "error", db: "unavailable" }));
  });

  app.use(
    "/api/trpc/reconstruction.run",
    reconstructionRateLimit,
  );

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext: () => ({ db }),
    }),
  );

  app.use("/admin", adminRateLimit, createAdminRouter(db));

  const httpServer = app.listen(port, () => {
    console.log(`API server listening on http://localhost:${port}`);
  });

  function shutdown(signal: string) {
    console.log(`${signal} received, shutting down gracefully…`);
    httpServer.close(() => {
      void (db as unknown as { close?: () => Promise<void> }).close?.().finally(
        () => process.exit(0),
      );
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
});

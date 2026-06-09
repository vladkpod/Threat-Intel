import express from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./router.js";
import { createAdminRouter } from "./admin-router.js";
import { createMigratedDb } from "@store";

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

const port = Number(process.env["PORT"] ?? 3001);

// Use file-based PGlite in dev; fall back to in-memory when explicitly set to
// empty or when PGLITE_DATA_DIR overrides (e.g. in CI or custom deployments).
const dataDir = process.env["PGLITE_DATA_DIR"] ?? ".pglite/data";
void createMigratedDb(dataDir).then((db) => {
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext: () => ({ db }),
    }),
  );

  app.use("/admin", createAdminRouter(db));

  app.listen(port, () => {
    console.log(`API server listening on http://localhost:${port}`);
  });
});

import express from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { appRouter } from "./router.js";
import { createAdminRouter } from "./admin-router.js";
import { createMigratedDb } from "@store";

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

const port = Number(process.env["PORT"] ?? 3001);

// Anchor the data dir to the repo root (three levels up from packages/api/src/).
// Using import.meta.url avoids cwd ambiguity when npm runs from the workspace dir.
const REPO_ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..");
const dataDir = process.env["PGLITE_DATA_DIR"] ?? resolve(REPO_ROOT, ".pglite/data");
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

import express from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./router.js";
import { createAdminRouter } from "./admin-router.js";
import { createMigratedDb } from "@store";

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
  }),
);

const port = Number(process.env["PORT"] ?? 3001);

void createMigratedDb().then((db) => {
  app.use("/admin", createAdminRouter(db));

  app.listen(port, () => {
    console.log(`API server listening on http://localhost:${port}`);
  });
});

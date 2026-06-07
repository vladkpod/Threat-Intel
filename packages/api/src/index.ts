import express from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./router.js";

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
  }),
);

const port = Number(process.env["PORT"] ?? 3001);
app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});

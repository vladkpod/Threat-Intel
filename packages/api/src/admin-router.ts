/**
 * Admin router — operational infrastructure for the human review gate.
 *
 * Deliberately separate from the tRPC surface (CLAUDE.md M6, Option A):
 * different auth middleware, internal-network-only in production, not
 * coupled to the client-facing product API.
 *
 * Invariant 11: POST /admin/review/:id/approve is the ONLY code path that
 * enqueues 'reconstruction.triggered'. All other paths are read-only or
 * administrative (reject/defer). No other route calls reconstruct() or
 * enqueues that job type.
 */
import { Router } from "express";
import type { Request, Response } from "express";
import {
  enqueueJob,
  listPendingReviews,
  getReviewItem,
  setReviewItemStatus,
} from "@store";
import type { Db } from "@store";
import type { ReconstructionTriggeredPayload } from "@queue";

export function createAdminRouter(db: Db): Router {
  const router = Router();
  router.use((req: Request, _res: Response, next: () => void) => {
    // Placeholder for auth middleware — insert token/IP check here before prod.
    void req;
    next();
  });

  router.get("/review", (_req: Request, res: Response) => {
    void listPendingReviews(db)
      .then((items) => res.json({ items }))
      .catch((err: unknown) =>
        res
          .status(500)
          .json({ error: err instanceof Error ? err.message : String(err) }),
      );
  });

  router.get("/review/:id", (req: Request, res: Response) => {
    const id = parseInt(req.params["id"] ?? "", 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    void getReviewItem(db, id)
      .then((item) =>
        item ? res.json(item) : res.status(404).json({ error: "Not found" }),
      )
      .catch((err: unknown) =>
        res
          .status(500)
          .json({ error: err instanceof Error ? err.message : String(err) }),
      );
  });

  // Invariant 11: the sole code path that enqueues reconstruction.triggered.
  router.post("/review/:id/approve", (req: Request, res: Response) => {
    const id = parseInt(req.params["id"] ?? "", 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const body = req.body as {
      reviewer?: string;
      reconstruction_input?: unknown;
    };
    const reviewer = body.reviewer ?? "admin";
    const reconstructionInput = body.reconstruction_input;

    if (!reconstructionInput) {
      res.status(400).json({ error: "reconstruction_input is required" });
      return;
    }

    void (async () => {
      const review = await getReviewItem(db, id);
      if (!review) {
        res.status(404).json({ error: "Review item not found" });
        return;
      }
      if (review.status !== "pending") {
        res
          .status(409)
          .json({ error: `Review item is already ${review.status}` });
        return;
      }

      const jobPayload: ReconstructionTriggeredPayload = {
        review_queue_id: id,
        reconstruction_input:
          reconstructionInput as ReconstructionTriggeredPayload["reconstruction_input"],
      };

      const job = await enqueueJob(db, "reconstruction.triggered", jobPayload);
      const updated = await setReviewItemStatus(
        db,
        id,
        "approved",
        reviewer,
        job.id,
      );
      res.json({ review: updated, job_id: job.id });
    })().catch((err: unknown) =>
      res
        .status(500)
        .json({ error: err instanceof Error ? err.message : String(err) }),
    );
  });

  router.post("/review/:id/reject", (req: Request, res: Response) => {
    const id = parseInt(req.params["id"] ?? "", 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const body = req.body as { reviewer?: string };
    const reviewer = body.reviewer ?? "admin";

    void setReviewItemStatus(db, id, "rejected", reviewer, null)
      .then((item) => res.json(item))
      .catch((err: unknown) =>
        res
          .status(500)
          .json({ error: err instanceof Error ? err.message : String(err) }),
      );
  });

  return router;
}

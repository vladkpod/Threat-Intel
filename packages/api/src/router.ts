import { z } from "zod";
import { reconstruct, ReconstructionInput, ReconstructionOutput } from "@engine";
import { fetchSectorView } from "@sector";
import {
  createReviewItem,
  getStalenessCaveatsForIncident,
  upsertClient,
  createClientAssessment,
  getClientAssessment,
  updateClientAssessmentAnswers,
  listClientAssessmentsForReconstruction,
  listPendingReviews,
} from "@store";
import { router, publicProcedure } from "./trpc.js";

const AnswerValue = z.enum(["yes", "partial", "no"]);

export const appRouter = router({
  reconstruction: router({
    run: publicProcedure
      .input(ReconstructionInput)
      .mutation(({ input }) => reconstruct(input)),
    submit: publicProcedure
      .input(ReconstructionInput)
      .mutation(async ({ ctx, input }) => {
        const item = await createReviewItem(ctx.db, {
          feed_job_id: null,
          type: "new-incident",
          candidate_title: input.incident_name,
          candidate_text: JSON.stringify(input),
          tier_ceiling: "REPORTED",
        });
        return { review_id: item.id };
      }),
    list: publicProcedure
      .input(z.object({ cursor: z.number().int().positive().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const PAGE_SIZE = 20;
        const cursor = input?.cursor;
        const res = await ctx.db.query<{
          id: number;
          created_at: string;
          result_json: ReconstructionOutput;
          incident_name: string;
          incident_date: string | null;
          sector: string | null;
        }>(
          cursor !== undefined
            ? `SELECT rr.id, rr.created_at, rr.result_json, i.name AS incident_name,
                      i.incident_date, i.sector
               FROM reconstruction_results rr
               JOIN incidents i ON i.id = rr.incident_id
               WHERE rr.id < $1
               ORDER BY rr.id DESC
               LIMIT ${PAGE_SIZE + 1}`
            : `SELECT rr.id, rr.created_at, rr.result_json, i.name AS incident_name,
                      i.incident_date, i.sector
               FROM reconstruction_results rr
               JOIN incidents i ON i.id = rr.incident_id
               ORDER BY rr.id DESC
               LIMIT ${PAGE_SIZE + 1}`,
          cursor !== undefined ? [cursor] : [],
        );
        const hasMore = res.rows.length > PAGE_SIZE;
        const rawItems = hasMore ? res.rows.slice(0, PAGE_SIZE) : res.rows;
        const items = rawItems.map((row) => ({
          ...row,
          result_json: ReconstructionOutput.parse(row.result_json),
        }));
        const nextCursor = hasMore ? rawItems[rawItems.length - 1]?.id ?? null : null;
        return { items, nextCursor };
      }),
    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const res = await ctx.db.query<{
          result_json: ReconstructionOutput;
          incident_date: string | null;
          sector: string | null;
          incident_name: string;
          incident_id: number;
        }>(
          `SELECT rr.result_json, i.incident_date, i.sector, i.name AS incident_name,
                  rr.incident_id
           FROM reconstruction_results rr
           JOIN incidents i ON i.id = rr.incident_id
           WHERE rr.id = $1`,
          [input.id],
        );
        if (!res.rows[0]) return null;
        const row = res.rows[0];

        // M6 decay rule: inject staleness caveats on read (not stored in result_json).
        const staleCaveats = await getStalenessCaveatsForIncident(ctx.db, row.incident_id);

        const result = ReconstructionOutput.parse(row.result_json);
        const mergedResult: ReconstructionOutput = staleCaveats.length > 0
          ? {
              ...result,
              verdict: {
                ...result.verdict,
                caveats: [...result.verdict.caveats, ...staleCaveats],
              },
            }
          : result;

        return {
          result: mergedResult,
          incident_date: row.incident_date,
          sector: row.sector,
          incident_name: row.incident_name,
        };
      }),
  }),
  sector: router({
    view: publicProcedure.query(() => fetchSectorView()),
    forSector: publicProcedure
      .input(z.object({ sector: z.string() }))
      .query(({ input }) =>
        fetchSectorView().then((v) =>
          v.sectors.find((s) => s.sector === input.sector) ?? null,
        ),
      ),
  }),
  assessment: router({
    create: publicProcedure
      .input(z.object({
        client_name: z.string().min(1).max(256),
        client_sector: z.string().optional(),
        tech_stack_notes: z.string().max(500).optional(),
        reconstruction_id: z.number().int().positive(),
      }))
      .mutation(async ({ ctx, input }) => {
        const client = await upsertClient(ctx.db, {
          name: input.client_name,
          sector: input.client_sector ?? null,
          tech_stack_notes: input.tech_stack_notes ?? null,
        });
        const assessment = await createClientAssessment(
          ctx.db,
          client.id,
          input.reconstruction_id,
        );
        return { assessment_id: assessment.id, client_id: client.id };
      }),
    get: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const assessment = await getClientAssessment(ctx.db, input.id);
        if (!assessment) return null;
        const clientRes = await ctx.db.query<{
          id: number;
          name: string;
          sector: string | null;
          tech_stack_notes: string | null;
        }>(
          `SELECT id, name, sector, tech_stack_notes FROM clients WHERE id = $1`,
          [assessment.client_id],
        );
        const client = clientRes.rows[0] ?? null;
        const reconRes = await ctx.db.query<{
          id: number;
          result_json: unknown;
          incident_name: string;
        }>(
          `SELECT rr.id, rr.result_json, i.name AS incident_name
           FROM reconstruction_results rr
           JOIN incidents i ON i.id = rr.incident_id
           WHERE rr.id = $1`,
          [assessment.reconstruction_id],
        );
        const recon = reconRes.rows[0] ?? null;
        if (!recon) return null;
        return {
          assessment,
          client,
          result: ReconstructionOutput.parse(recon.result_json),
          incident_name: recon.incident_name,
        };
      }),
    saveAnswers: publicProcedure
      .input(z.object({
        id: z.number().int().positive(),
        answers: z.record(z.string(), AnswerValue),
      }))
      .mutation(async ({ ctx, input }) => {
        const updated = await updateClientAssessmentAnswers(
          ctx.db,
          input.id,
          input.answers as Record<string, "yes" | "partial" | "no">,
        );
        return updated;
      }),
    listForReconstruction: publicProcedure
      .input(z.object({ reconstruction_id: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        return listClientAssessmentsForReconstruction(ctx.db, input.reconstruction_id);
      }),
  }),
  review: router({
    list: publicProcedure.query(async ({ ctx }) => {
      return listPendingReviews(ctx.db);
    }),
  }),
});

export type AppRouter = typeof appRouter;

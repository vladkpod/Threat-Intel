import { z } from "zod";
import { reconstruct, ReconstructionInput } from "@engine";
import type { ReconstructionOutput } from "@engine";
import { fetchSectorView } from "@sector";
import { router, publicProcedure } from "./trpc.js";

export const appRouter = router({
  reconstruction: router({
    run: publicProcedure
      .input(ReconstructionInput)
      .mutation(({ input }) => reconstruct(input)),
    list: publicProcedure.query(async ({ ctx }) => {
      const res = await ctx.db.query<{
        id: number;
        created_at: string;
        result_json: ReconstructionOutput;
        incident_name: string;
        incident_date: string | null;
        sector: string | null;
      }>(
        `SELECT rr.id, rr.created_at, rr.result_json, i.name AS incident_name,
                i.incident_date, i.sector
         FROM reconstruction_results rr
         JOIN incidents i ON i.id = rr.incident_id
         ORDER BY rr.created_at DESC`,
      );
      return res.rows;
    }),
    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const res = await ctx.db.query<{
          result_json: ReconstructionOutput;
          incident_date: string | null;
          sector: string | null;
          incident_name: string;
        }>(
          `SELECT rr.result_json, i.incident_date, i.sector, i.name AS incident_name
           FROM reconstruction_results rr
           JOIN incidents i ON i.id = rr.incident_id
           WHERE rr.id = $1`,
          [input.id],
        );
        if (!res.rows[0]) return null;
        const row = res.rows[0];
        return {
          result: row.result_json,
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
});

export type AppRouter = typeof appRouter;

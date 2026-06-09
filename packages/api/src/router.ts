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
        const res = await ctx.db.query<{ result_json: ReconstructionOutput }>(
          `SELECT result_json FROM reconstruction_results WHERE id = $1`,
          [input.id],
        );
        return res.rows[0]?.result_json ?? null;
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

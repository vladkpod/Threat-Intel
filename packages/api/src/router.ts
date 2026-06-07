import { z } from "zod";
import { reconstruct, ReconstructionInput } from "@engine";
import { fetchSectorView } from "@sector";
import { router, publicProcedure } from "./trpc.js";

export const appRouter = router({
  reconstruction: router({
    run: publicProcedure
      .input(ReconstructionInput)
      .mutation(({ input }) => reconstruct(input)),
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

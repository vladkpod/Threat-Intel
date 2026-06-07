import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@engine": fileURLToPath(new URL("./packages/engine/src", import.meta.url)),
      "@store": fileURLToPath(new URL("./packages/store/src", import.meta.url)),
      "@registry": fileURLToPath(new URL("./packages/registry/src", import.meta.url)),
      "@ingest": fileURLToPath(new URL("./packages/ingest/src", import.meta.url)),
      "@sector": fileURLToPath(new URL("./packages/sector/src", import.meta.url)),
      "@queue": fileURLToPath(new URL("./packages/queue/src", import.meta.url)),
    },
  },
  test: {
    globals: false,
    include: ["tests/**/*.{test,eval}.ts"],
  },
});

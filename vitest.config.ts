import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@engine": fileURLToPath(new URL("./packages/engine/src", import.meta.url)),
    },
  },
  test: {
    globals: false,
    include: ["tests/**/*.{test,eval}.ts"],
  },
});

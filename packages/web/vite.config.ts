import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@engine": path.resolve(__dirname, "../../packages/engine/src"),
      "@registry": path.resolve(__dirname, "../../packages/registry/src"),
      "@sector": path.resolve(__dirname, "../../packages/sector/src"),
      "@/components": path.resolve(__dirname, "src/components"),
      "@/lib": path.resolve(__dirname, "src/lib"),
      "@/pages": path.resolve(__dirname, "src/pages"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api/trpc": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});

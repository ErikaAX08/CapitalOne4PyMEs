import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
const src = (path: string) =>
  fileURLToPath(new URL(`./src/${path}`, import.meta.url));
// The JSON contracts live outside this app: they are shared with the Go domain
// and the Python engine, and `contracts/` is the single source of truth. The
// form is generated from the same file the backend validates against, and it is
// bundled rather than fetched so the interface still renders with the network
// down (PRD 5.5).
const contracts = fileURLToPath(new URL("../../contracts", import.meta.url));
const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
// Where `pnpm dev` proxies /v1 to: services/domain running locally.
const api = process.env.VITE_API_ORIGIN ?? "http://localhost:8080";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@app": src("app"),
      "@features": src("features"),
      "@entities": src("entities"),
      "@shared": src("shared"),
      "@contracts": contracts,
    },
  },
  server: {
    fs: { allow: [repositoryRoot] },
    proxy: {
      "/v1": { target: api, changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/@dimforge/")) return "physics";
          if (id.includes("/three/")) return "three";
        },
      },
    },
  },
});

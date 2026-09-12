import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
const src = (path: string) =>
  fileURLToPath(new URL(`./src/${path}`, import.meta.url));
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@app": src("app"),
      "@features": src("features"),
      "@entities": src("entities"),
      "@shared": src("shared"),
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

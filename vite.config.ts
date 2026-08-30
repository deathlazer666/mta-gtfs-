import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Freebuff requires HMR to remain disabled.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // maplibre-gl v6 resolves its worker via import.meta.url; the dep optimizer
  // cannot emit that worker into .vite/deps, which blanks the basemap in dev.
  optimizeDeps: {
    exclude: ["maplibre-gl", "@maplibre/maplibre-gl-leaflet"],
  },
  server: {
    host: "0.0.0.0",
    port: Number(process.env.PORT) || 5173,
    hmr: false,
  },
  preview: {
    host: "0.0.0.0",
    port: Number(process.env.PORT) || 4173,
  },
});
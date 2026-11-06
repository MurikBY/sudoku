import { existsSync } from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

import { buildIdPlugin } from "./vite.buildIdPlugin";
import { initialThemePlugin } from "./vite.initialThemePlugin";

const devPort = Number(process.env.FRONTEND_DEV_PORT ?? 5174);
const backendPort = Number(process.env.BACKEND_DEV_PORT ?? 8002);
const inDocker = existsSync("/.dockerenv");
const apiProxyTarget =
  process.env.API_PROXY_TARGET ??
  (inDocker ? "http://backend:8000" : `http://localhost:${backendPort}`);

export default defineConfig({
  plugins: [react(), tailwindcss(), buildIdPlugin(), initialThemePlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: devPort,
    host: true,
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  test: {
    setupFiles: ["./src/test/setup.ts"],
  },
});

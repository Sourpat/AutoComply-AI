import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "lucide-react": path.resolve(__dirname, "./src/lib/lucide-react.tsx"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // Backend API routes only - do NOT proxy SPA routes like /csf, /console, /analytics
      "/health": { target: "http://127.0.0.1:8001", changeOrigin: true },
      "/workflow": { target: "http://127.0.0.1:8001", changeOrigin: true },
      "/rag": { target: "http://127.0.0.1:8001", changeOrigin: true },
      "/api/analytics": { target: "http://127.0.0.1:8001", changeOrigin: true },
      "/admin": { target: "http://127.0.0.1:8001", changeOrigin: true },
      "/submissions": { target: "http://127.0.0.1:8001", changeOrigin: true },
      "/api": { target: "http://127.0.0.1:8001", changeOrigin: true },
      "/csf/practitioner": { target: "http://127.0.0.1:8001", changeOrigin: true },
      "/csf/hospital": { target: "http://127.0.0.1:8001", changeOrigin: true },
      "/csf/researcher": { target: "http://127.0.0.1:8001", changeOrigin: true },
      "/csf/facility": { target: "http://127.0.0.1:8001", changeOrigin: true },
      "/csf/ems": { target: "http://127.0.0.1:8001", changeOrigin: true },
      "/csf/explain": { target: "http://127.0.0.1:8001", changeOrigin: true },
      "/ohio-tddd": { target: "http://127.0.0.1:8001", changeOrigin: true },
      "/controlled-substances": { target: "http://127.0.0.1:8001", changeOrigin: true },
      "/pdma-sample": { target: "http://127.0.0.1:8001", changeOrigin: true },
      "/decisions": { target: "http://127.0.0.1:8001", changeOrigin: true },
      "/verifications": { target: "http://127.0.0.1:8001", changeOrigin: true },
      "/tenants": { target: "http://127.0.0.1:8001", changeOrigin: true },
      "/console/stats": { target: "http://127.0.0.1:8001", changeOrigin: true },
      "/ai/decisions": { target: "http://127.0.0.1:8001", changeOrigin: true },
      "/cases": { target: "http://127.0.0.1:8001", changeOrigin: true },
      "/chat": { target: "http://127.0.0.1:8001", changeOrigin: true },
      "/admin-review": { target: "http://127.0.0.1:8001", changeOrigin: true },
      "/metrics": { target: "http://127.0.0.1:8001", changeOrigin: true },
      "/kb-admin": { target: "http://127.0.0.1:8001", changeOrigin: true },
      "/demo": { target: "http://127.0.0.1:8001", changeOrigin: true },
      "/ops": { target: "http://127.0.0.1:8001", changeOrigin: true },
    },
  },
});

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
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Phase 7.32: Bundle splitting for performance
          
          // Vendor: Core React libraries
          if (id.includes('node_modules/react') || 
              id.includes('node_modules/react-dom') || 
              id.includes('node_modules/react-router')) {
            return 'vendor-react';
          }
          
          // State management
          if (id.includes('node_modules/zustand')) {
            return 'vendor-state';
          }
          
          // Intelligence features (AI/ML panels, recompute, exports)
          if (id.includes('src/features/intelligence/') ||
              id.includes('src/api/intelligenceApi')) {
            return 'intelligence';
          }
          
          // Console dashboard and case management
          if (id.includes('src/pages/ConsoleDashboard') ||
              id.includes('src/features/cases/CaseDetailsPanel') ||
              id.includes('src/components/CaseDetailsDrawer')) {
            return 'console';
          }
          
          // API layer
          if (id.includes('src/api/workflowApi') ||
              id.includes('src/api/submissionsApi') ||
              id.includes('src/api/evidenceApi') ||
              id.includes('src/api/attachmentsApi')) {
            return 'api';
          }
        },
      },
    },
    chunkSizeWarningLimit: 750, // Warn if any chunk exceeds 750KB
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
      // "/admin" is a SPA route. Keep it on the frontend.
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
      // NOTE: Do not proxy SPA routes like /chat or /admin/*; Vite should serve index.html.
      "/metrics": { target: "http://127.0.0.1:8001", changeOrigin: true },
      "/kb-admin": { target: "http://127.0.0.1:8001", changeOrigin: true },
      "/demo": { target: "http://127.0.0.1:8001", changeOrigin: true },
      "/ops": { target: "http://127.0.0.1:8001", changeOrigin: true },
    },
  },
});

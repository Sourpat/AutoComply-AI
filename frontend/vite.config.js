import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiBase = (env.VITE_API_BASE_URL || "http://127.0.0.1:8001").trim();

  return {
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
        // Backend API routes only - do NOT proxy SPA routes.
        "/api": { target: apiBase, changeOrigin: true, secure: false },
        "/health": { target: apiBase, changeOrigin: true, secure: false },
        "/workflow": { target: apiBase, changeOrigin: true, secure: false },
      },
    },
  };
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Centralized API Base URL Configuration
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Single source of truth for backend API location. All API clients should
 * import API_BASE from src/lib/api.ts (which re-exports this module).
 * 
 * USAGE PATTERNS:
 * ---------------
 * 
 * DEVELOPMENT (Local):
 *   • Leave VITE_API_BASE_URL empty in .env → Uses Vite proxy
 *   • Auto-detects localhost and uses http://127.0.0.1:8001
 *   • Vite dev server proxies API routes to backend (no CORS issues)
 *   • Example .env:
 *       VITE_API_BASE_URL=
 *       VITE_APP_ENV=dev
 * 
 * PRODUCTION (Render/Vercel/Netlify/etc.):
 *   • MUST set VITE_API_BASE_URL to backend URL at BUILD TIME
 *   • Set via platform environment variables dashboard
 *   • Example for Render:
 *       VITE_API_BASE_URL=https://autocomply-backend-xxxxx.onrender.com
 *       VITE_APP_ENV=prod
 *   • Example for custom domain:
 *       VITE_API_BASE_URL=https://api.autocomply.example.com
 *       VITE_APP_ENV=prod
 * 
 * IMPORTANT:
 *   ⚠️  Vite environment variables are embedded at BUILD TIME
 *   ⚠️  Changing VITE_API_BASE_URL requires rebuilding the frontend
 *   ⚠️  Empty strings ("") are treated as undefined (uses fallback)
 * 
 * CRITICAL BUG FIX:
 *   Empty string env vars (VITE_API_BASE_URL="") were overriding the
 *   localhost fallback, causing "Request timeout" errors in local dev.
 *   Now we properly treat empty strings as undefined.
 */

const getApiBase = (): string => {
  const metaEnv = (import.meta as any)?.env ?? {};
  
  // Production: Use VITE_API_BASE_URL from environment (required for hosted deployments)
  // Platforms: Render, Vercel, Netlify, Railway, Heroku, etc.
  const envBase = metaEnv.VITE_API_BASE_URL || metaEnv.VITE_API_BASE;
  if (envBase && envBase.trim()) {
    return envBase.trim();
  }

  // Development: Auto-detect localhost and use backend on port 8001
  // Frontend runs on 5173 (Vite), backend on 8001 (uvicorn)
  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1")
  ) {
    return "http://127.0.0.1:8001";
  }

  // Fallback: Same-origin (not recommended for production)
  // Always set VITE_API_BASE_URL explicitly in production builds
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.host}`;
  }

  // SSR fallback
  return "http://localhost:8001";
};

export const API_BASE = getApiBase();

// Developer visibility: log the resolved API base on page load
if (typeof window !== "undefined") {
  console.info("[AutoComply API] Backend URL:", API_BASE);
}

/**
 * Helper to safely parse error responses from FastAPI
 * Handles both JSON validation errors and plain text errors
 */
export async function parseApiError(resp: Response): Promise<string> {
  let errorMessage = `API Error ${resp.status}`;
  
  try {
    const errorData = await resp.json();
    if (errorData.detail) {
      // FastAPI validation errors are in detail array or string
      if (Array.isArray(errorData.detail)) {
        const validationErrors = errorData.detail
          .map((err: any) => `${err.loc?.join('.') || 'field'}: ${err.msg}`)
          .join('; ');
        errorMessage = `Validation error: ${validationErrors}`;
      } else if (typeof errorData.detail === 'string') {
        errorMessage = errorData.detail;
      } else {
        errorMessage = JSON.stringify(errorData.detail);
      }
    } else {
      errorMessage = JSON.stringify(errorData);
    }
  } catch {
    // If JSON parsing fails, try text
    try {
      const errorText = await resp.text();
      if (errorText) {
        errorMessage = `${errorMessage}: ${errorText}`;
      }
    } catch {
      // Ignore if text parsing also fails
    }
  }
  
  return errorMessage;
}

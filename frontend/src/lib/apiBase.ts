/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Centralized API Base URL Configuration
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Single source of truth for backend API location. All API clients should
 * import API_BASE from src/lib/apiBase.ts.
 * 
 * USAGE PATTERNS:
 * ---------------
 * 
 * DEVELOPMENT (Local):
 *   • Set VITE_API_BASE_URL explicitly to your backend URL
 *   • Or leave empty to use same-origin (Vite proxy recommended)
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
 * NOTE:
 *   Empty string env vars (VITE_API_BASE_URL="") will fall back to same-origin.
 */

const metaEnv = (import.meta as any)?.env ?? {};

export function getApiBase(): string {
  const raw = (metaEnv.VITE_API_BASE_URL ?? "").trim();
  if (!raw) return "";
  return raw.replace(/\/+$/, "");
}

export const API_BASE = getApiBase();

if (metaEnv.PROD && !API_BASE && typeof window !== "undefined") {
  console.warn("[AutoComply API] VITE_API_BASE_URL is missing in production build.");
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

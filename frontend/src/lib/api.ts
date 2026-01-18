// frontend/src/lib/api.ts
// Centralized API base URL and fetch wrapper with timeout + error handling

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * API Base URL Configuration
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Single source of truth for backend API location. All API clients import
 * API_BASE from this module to ensure consistent configuration.
 * 
 * USAGE:
 * ------
 * Development (with Vite proxy):
 *   - Leave VITE_API_BASE_URL empty in .env
 *   - Vite dev server proxies API requests to http://127.0.0.1:8001
 *   - This file auto-detects localhost and uses http://127.0.0.1:8001
 * 
 * Development (without proxy):
 *   - Set VITE_API_BASE_URL=http://127.0.0.1:8001 in .env
 *   - Direct API calls to backend (no proxy)
 * 
 * Production (hosted deployment):
 *   - Set VITE_API_BASE_URL=https://your-backend-url.onrender.com in .env.production
 *   - Or set via platform environment variables (Render, Vercel, Netlify, etc.)
 *   - REQUIRED: Must be set at build time for production deployments
 * 
 * CRITICAL: Empty string env vars (VITE_API_BASE_URL="") should NOT override
 * the localhost fallback. This was causing "Request timeout" errors in local dev.
 * 
 * Resolution order:
 * 1. Non-empty VITE_API_BASE_URL or VITE_API_BASE env var (production)
 * 2. http://127.0.0.1:8001 for localhost/127.0.0.1 hostnames (development)
 * 3. Same-origin (window.location) for deployed environments without env var
 */
function getApiBase(): string {
  const metaEnv = (import.meta as any)?.env ?? {};
  
  // Production: Use VITE_API_BASE_URL from environment (set at build time)
  // Example: VITE_API_BASE_URL=https://autocomply-ai.onrender.com
  const envBase = metaEnv.VITE_API_BASE_URL || metaEnv.VITE_API_BASE;
  if (envBase && envBase.trim()) {
    return envBase.trim();
  }
  
  // Development: Auto-detect localhost and use backend on port 8001
  // Works with or without Vite proxy configuration
  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1")
  ) {
    return "http://127.0.0.1:8001";
  }
  
  // Production fallback: Use Render backend if no env var set
  // TODO: Replace with actual Render backend URL once deployed
  if (typeof window !== "undefined") {
    return "https://autocomply-ai.onrender.com";
  }
  
  // SSR fallback
  return "https://autocomply-ai.onrender.com";
}

export const API_BASE = getApiBase();
const metaEnv = (import.meta as any).env || {};
const isDev = metaEnv.DEV;

// Log resolved API_BASE for debugging (dev only)
if (isDev && typeof window !== "undefined") {
  console.info("[AutoComply API] Backend URL:", API_BASE);
}

export interface ApiFetchOptions extends RequestInit {
  timeout?: number;
}

/**
 * Centralized fetch wrapper with:
 * - Automatic API_BASE prefixing
 * - 15s timeout by default (configurable)
 * - Proper error handling with status + body
 * - Dev logging for debugging
 * - JSON parsing
 */
export async function apiFetch<T = any>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const {
    timeout = 15000,
    headers = {},
    ...restOptions
  } = options;

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // Build full URL
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  // Merge headers
  const finalHeaders = {
    "Content-Type": "application/json",
    ...headers,
  };

  try {
    if (isDev) {
      console.log(`[API Request] ${options.method || "GET"} ${url}`);
      if (options.body) {
        console.log(`[API Payload]`, JSON.parse(options.body as string));
      }
    }

    const response = await fetch(url, {
      ...restOptions,
      headers: finalHeaders,
      signal: controller.signal,
    });

    // Always clear timeout after fetch completes
    clearTimeout(timeoutId);

    if (isDev) {
      console.log(`[API Response] ${options.method || "GET"} ${url} → ${response.status}`);
    }

    // Handle non-2xx responses
    if (!response.ok) {
      let errorDetail = "";
      let errorData: any = null;
      
      try {
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          errorData = await response.json();
          
          // Handle FastAPI validation errors (detail array)
          if (Array.isArray(errorData.detail)) {
            const validationErrors = errorData.detail
              .map((err: any) => {
                const field = err.loc?.slice(1).join('.') || 'field';
                return `${field}: ${err.msg}`;
              })
              .join('; ');
            errorDetail = `Validation error - ${validationErrors}`;
          } else if (errorData.detail) {
            errorDetail = errorData.detail;
          } else if (errorData.message) {
            errorDetail = errorData.message;
          } else {
            errorDetail = JSON.stringify(errorData);
          }
        } else {
          errorDetail = await response.text();
        }
      } catch (parseErr) {
        errorDetail = response.statusText;
      }

      const errorMessage = `${response.status} ${response.statusText}${errorDetail ? `: ${errorDetail}` : ''}`;
      
      if (isDev) {
        console.error(`[API Error] ${options.method || "GET"} ${url}`, {
          status: response.status,
          statusText: response.statusText,
          detail: errorDetail,
          data: errorData,
        });
      }
      
      throw new Error(errorMessage);
    }

    // Parse successful response
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const data = await response.json();
      if (isDev) {
        console.log(`[API Data]`, data);
      }
      return data;
    } else {
      return (await response.text()) as T;
    }
  } catch (error: any) {
    // Always clear timeout in catch block
    clearTimeout(timeoutId);

    // Handle AbortController timeout
    if (error.name === "AbortError") {
      const timeoutError = new Error(
        `Request timed out after ${timeout}ms. Backend may not be running at ${API_BASE}. Check: 1) Backend is running, 2) No CORS issues, 3) Network connectivity.`
      );
      console.error(`[API Timeout] ${options.method || "GET"} ${url}`, {
        timeout,
        apiBase: API_BASE,
        path,
      });
      throw timeoutError;
    }

    // Handle network/fetch errors
    if (error instanceof TypeError && error.message.includes("fetch")) {
      const networkError = new Error(
        `Network error: Cannot connect to backend at ${API_BASE}. Verify backend is running and accessible.`
      );
      console.error(`[API Network Error]`, {
        url,
        apiBase: API_BASE,
        originalError: error.message,
      });
      throw networkError;
    }

    // Re-throw formatted errors from non-2xx responses
    throw error;
  }
}

/**
 * Centralized API base URL configuration for all AutoComply API clients.
 * Single source of truth for backend location.
 * 
 * CRITICAL BUG FIX: Empty string env vars (VITE_API_BASE="") were overriding
 * the localhost fallback, causing "Request timeout" errors in local dev.
 * Now we properly treat empty strings as undefined.
 */

const getApiBase = (): string => {
  const metaEnv = (import.meta as any)?.env ?? {};
  
  // Check for explicit env vars (but ignore empty strings!)
  const envBase = metaEnv.VITE_API_BASE_URL || metaEnv.VITE_API_BASE;
  if (envBase && envBase.trim()) {
    return envBase.trim();
  }

  // Local dev: frontend on 5173, backend on 8001 (Windows workaround)
  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1")
  ) {
    return "http://127.0.0.1:8001";
  }

  // Fallback: same origin (for deployed envs where API is served by UI host)
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

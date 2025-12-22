// frontend/src/lib/api.ts
// Centralized API base URL and fetch wrapper with timeout + error handling

/**
 * Resolves the API base URL for backend communication.
 * 
 * CRITICAL: Empty string env vars (VITE_API_BASE="") should NOT override
 * the localhost fallback. This was causing "Request timeout" errors in local dev
 * because requests went to "" instead of "http://127.0.0.1:8000".
 * 
 * Resolution order:
 * 1. Non-empty VITE_API_BASE_URL or VITE_API_BASE env var
 * 2. http://127.0.0.1:8000 for localhost/127.0.0.1 hostnames
 * 3. Same-origin (window.location) for deployed environments
 */
function getApiBase(): string {
  const metaEnv = (import.meta as any)?.env ?? {};
  
  // Check for explicit env vars (but ignore empty strings)
  const envBase = metaEnv.VITE_API_BASE_URL || metaEnv.VITE_API_BASE;
  if (envBase && envBase.trim()) {
    return envBase.trim();
  }
  
  // Local development: frontend on 5173, backend on 8001 (Windows workaround for port 8000 permission)
  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1")
  ) {
    return "http://127.0.0.1:8001";
  }
  
  // Deployed environment: same origin
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.host}`;
  }
  
  // SSR fallback
  return "http://localhost:8001";
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

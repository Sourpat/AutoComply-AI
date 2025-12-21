// frontend/src/lib/api.ts
// Centralized API base URL and fetch wrapper with timeout + error handling

// Support both VITE_API_BASE_URL and VITE_API_BASE for flexibility
// Use type assertion to access Vite env variables
const metaEnv = (import.meta as any).env || {};
export const API_BASE = 
  metaEnv.VITE_API_BASE_URL ?? 
  metaEnv.VITE_API_BASE ?? 
  "http://localhost:8000";

const isDev = metaEnv.DEV;

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
      console.log(`[API] ${options.method || "GET"} ${url}`);
    }

    const response = await fetch(url, {
      ...restOptions,
      headers: finalHeaders,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (isDev) {
      console.log(`[API] ${options.method || "GET"} ${url} → ${response.status}`);
    }

    // Handle non-2xx responses
    if (!response.ok) {
      let errorBody = "";
      try {
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          const errorData = await response.json();
          errorBody = errorData.detail || errorData.message || JSON.stringify(errorData);
        } else {
          errorBody = await response.text();
        }
      } catch {
        errorBody = response.statusText;
      }

      const error = new Error(
        `API Error ${response.status}: ${errorBody || response.statusText}`
      );
      console.error(`[API Error] ${options.method || "GET"} ${url}`, {
        status: response.status,
        body: errorBody,
      });
      throw error;
    }

    // Parse response
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return await response.json();
    } else {
      return (await response.text()) as T;
    }
  } catch (error: any) {
    clearTimeout(timeoutId);

    // Handle AbortController timeout
    if (error.name === "AbortError") {
      const timeoutError = new Error(
        `Request timeout after ${timeout}ms: ${options.method || "GET"} ${path}`
      );
      console.error(`[API Timeout] ${options.method || "GET"} ${url}`);
      throw timeoutError;
    }

    // Handle network errors
    if (error instanceof TypeError && error.message.includes("fetch")) {
      const networkError = new Error(
        `Network error: Cannot reach backend at ${API_BASE}. Is the backend running?`
      );
      console.error(`[API Network Error] ${url}`, error);
      throw networkError;
    }

    // Re-throw other errors
    throw error;
  }
}

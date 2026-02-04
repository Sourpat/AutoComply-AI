// frontend/src/lib/api.ts
// Centralized API base URL and fetch wrapper with timeout + diagnostics

import { API_BASE } from "./apiBase";

export { API_BASE };

const metaEnv = (import.meta as any)?.env ?? {};
const isDev = metaEnv.DEV;

// Log resolved API_BASE for debugging (dev only)
if (isDev && typeof window !== "undefined") {
  console.info("[AutoComply API] Backend URL:", API_BASE || "(same-origin)");
}

export type ApiErrorDetails = {
  message: string;
  url: string;
  status?: number;
  statusText?: string;
  bodySnippet?: string;
  requestId?: string | null;
  correlationId?: string | null;
  traceId?: string | null;
};

export class ApiRequestError extends Error {
  details: ApiErrorDetails;

  constructor(details: ApiErrorDetails) {
    super(details.message);
    this.name = "ApiRequestError";
    this.details = details;
  }
}

export function toApiErrorDetails(
  error: unknown,
  fallback?: Partial<ApiErrorDetails>
): ApiErrorDetails {
  if (error instanceof ApiRequestError) {
    return error.details;
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      url: fallback?.url || "",
      status: fallback?.status,
      statusText: fallback?.statusText,
      bodySnippet: fallback?.bodySnippet,
      requestId: fallback?.requestId,
      correlationId: fallback?.correlationId,
      traceId: fallback?.traceId,
    };
  }

  return {
    message: "Unknown API error",
    url: fallback?.url || "",
    status: fallback?.status,
    statusText: fallback?.statusText,
    bodySnippet: fallback?.bodySnippet,
    requestId: fallback?.requestId,
    correlationId: fallback?.correlationId,
    traceId: fallback?.traceId,
  };
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

    // Phase 7.33: Capture X-Request-Id from response for tracing
    const requestId = response.headers.get("X-Request-Id");
    const correlationId = response.headers.get("X-Correlation-Id");
    const traceId = response.headers.get("X-Trace-Id");
    if (requestId && isDev) {
      console.log(`[API Request-Id] ${requestId}`);
    }

    if (isDev) {
      console.log(`[API Response] ${options.method || "GET"} ${url} → ${response.status}`);
    }

    // Handle non-2xx responses
    if (!response.ok) {
      let errorDetail = "";
      let errorData: any = null;
      let rawBody = "";

      try {
        rawBody = await response.text();
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json") && rawBody) {
          try {
            errorData = JSON.parse(rawBody);
          } catch {
            errorData = null;
          }

          if (errorData && Array.isArray(errorData.detail)) {
            const validationErrors = errorData.detail
              .map((err: any) => {
                const field = err.loc?.slice(1).join(".") || "field";
                return `${field}: ${err.msg}`;
              })
              .join("; ");
            errorDetail = `Validation error - ${validationErrors}`;
          } else if (errorData?.detail) {
            errorDetail = errorData.detail;
          } else if (errorData?.message) {
            errorDetail = errorData.message;
          } else if (errorData) {
            errorDetail = JSON.stringify(errorData);
          }
        } else if (rawBody) {
          errorDetail = rawBody;
        }
      } catch {
        errorDetail = response.statusText;
      }

      const bodySnippet = rawBody ? rawBody.slice(0, 500) : undefined;
      const errorMessage = `${response.status} ${response.statusText}${errorDetail ? `: ${errorDetail}` : ""}`;

      console.error(`[API Failure] ${options.method || "GET"} ${url}`, {
        status: response.status,
        statusText: response.statusText,
        bodySnippet,
        requestId,
        correlationId,
        traceId,
      });

      throw new ApiRequestError({
        message: errorMessage,
        url,
        status: response.status,
        statusText: response.statusText,
        bodySnippet,
        requestId,
        correlationId,
        traceId,
      });
    }

    // Parse successful response
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const data = await response.json();
      
      // Phase 7.33: Attach request_id to response data for tracing (if available)
      if (requestId && typeof data === "object" && data !== null) {
        (data as any)._requestId = requestId;
      }
      
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
      console.error(`[API Timeout] ${options.method || "GET"} ${url}`, {
        timeout,
        apiBase: API_BASE,
        path,
      });
      throw new ApiRequestError({
        message: `Request timed out after ${timeout}ms.`,
        url,
      });
    }

    // Handle network/fetch errors
    if (error instanceof TypeError && error.message.includes("fetch")) {
      console.error(`[API Network Error]`, {
        url,
        apiBase: API_BASE,
        originalError: error.message,
      });
      throw new ApiRequestError({
        message: `Network error: Cannot connect to backend at ${API_BASE || "(same-origin)"}.`,
        url,
      });
    }

    // Re-throw formatted errors from non-2xx responses
    throw error;
  }
}

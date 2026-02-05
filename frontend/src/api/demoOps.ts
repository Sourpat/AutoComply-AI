import { API_BASE, ApiRequestError, apiFetch } from "../lib/api";
import { getAuthHeaders, getAdminJsonHeaders } from "../lib/authHeaders";

async function fetchOptional<T>(path: string, headers: Record<string, string>): Promise<T | null> {
  try {
    return await apiFetch<T>(path, { headers });
  } catch (err) {
    if (err instanceof ApiRequestError && err.details?.status === 404) {
      return null;
    }
    throw err;
  }
}

export async function getHealthz(): Promise<any> {
  return apiFetch("/healthz", { headers: getAuthHeaders() });
}

export async function getHealthFull(): Promise<any> {
  return apiFetch("/health/full", { headers: getAuthHeaders() });
}

export async function getSigningStatus(): Promise<any> {
  return apiFetch("/api/audit/signing/status", { headers: getAuthHeaders() });
}

export async function getSmoke(): Promise<any> {
  const headers = getAuthHeaders();
  const primary = await fetchOptional("/api/ops/smoke", headers);
  if (primary) {
    return primary;
  }
  const fallback = await fetchOptional("/ops/smoke", headers);
  return fallback ?? { ok: false, error: "not_found" };
}

export async function getKbStats(): Promise<any> {
  const headers = getAuthHeaders();
  const primary = await fetchOptional("/api/ops/kb-stats", headers);
  if (primary) {
    return primary;
  }
  const fallback = await fetchOptional("/ops/kb-stats", headers);
  return fallback ?? { ok: false, error: "not_found" };
}

export async function postDemoReset(): Promise<any> {
  return apiFetch("/api/demo/reset", {
    method: "POST",
    headers: getAdminJsonHeaders(),
    body: JSON.stringify({}),
  });
}

export function getApiBase(): string {
  return API_BASE;
}

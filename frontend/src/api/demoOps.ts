import { API_BASE, apiFetch } from "../lib/api";
import { getAuthHeaders, getJsonHeaders } from "../lib/authHeaders";

const metaEnv = (import.meta as any)?.env ?? {};
const devSeedToken = typeof metaEnv.VITE_DEV_SEED_TOKEN === "string" ? metaEnv.VITE_DEV_SEED_TOKEN : "";

function withDevSeedToken(headers: Record<string, string>) {
  if (devSeedToken && devSeedToken.trim()) {
    return { ...headers, "X-Dev-Seed-Token": devSeedToken.trim() };
  }
  return headers;
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
  return apiFetch("/api/ops/smoke", { headers: getAuthHeaders() });
}

export async function postDemoReset(): Promise<any> {
  return apiFetch("/api/demo/reset", {
    method: "POST",
    headers: withDevSeedToken(getJsonHeaders()),
    body: JSON.stringify({}),
  });
}

export function getApiBase(): string {
  return API_BASE;
}

import { API_BASE, apiFetch } from "../lib/api";
import { getAuthHeaders, getAdminJsonHeaders } from "../lib/authHeaders";

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
    headers: getAdminJsonHeaders(),
    body: JSON.stringify({}),
  });
}

export function getApiBase(): string {
  return API_BASE;
}

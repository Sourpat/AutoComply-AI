import { API_BASE } from "./api";

const DEFAULT_TIMEOUT = 8000;

async function fetchWithTimeout(input: RequestInfo, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    return response;
  } finally {
    window.clearTimeout(timer);
  }
}

async function readErrorMessage(response: Response) {
  try {
    const data = await response.json();
    if (typeof data?.detail === "string") return data.detail;
    if (typeof data?.message === "string") return data.message;
  } catch {
    // ignore
  }
  return `Request failed (${response.status})`;
}

export type AuditEventPayload = {
  caseId: string;
  packetHash?: string;
  actor?: string;
  eventType: string;
  payload: Record<string, unknown>;
  clientEventId?: string;
};

export async function postAuditEvent(payload: AuditEventPayload) {
  try {
    const response = await fetchWithTimeout(`${API_BASE}/api/audit/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      return { ok: false, message: await readErrorMessage(response) };
    }
    return { ok: true, data: await response.json() };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Network error" };
  }
}

export async function getAuditEvents(params: { caseId?: string; packetHash?: string }) {
  const search = new URLSearchParams();
  if (params.caseId) search.set("caseId", params.caseId);
  if (params.packetHash) search.set("packetHash", params.packetHash);

  try {
    const response = await fetchWithTimeout(`${API_BASE}/api/audit/events?${search.toString()}`);
    if (!response.ok) {
      return { ok: false, message: await readErrorMessage(response) };
    }
    return { ok: true, data: await response.json() };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Network error" };
  }
}

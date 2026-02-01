import type { AuditPacket } from "./agenticAudit";
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

export async function saveAuditPacketToServer(packet: AuditPacket) {
  try {
    const response = await fetchWithTimeout(`${API_BASE}/api/audit/packets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(packet),
    });

    if (!response.ok) {
      return { ok: false, message: await readErrorMessage(response) };
    }

    return { ok: true, data: await response.json() };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Network error" };
  }
}

export async function fetchAuditPacketFromServer(packetHash: string) {
  try {
    const response = await fetchWithTimeout(`${API_BASE}/api/audit/packets/${packetHash}`);
    if (!response.ok) {
      return { ok: false, message: await readErrorMessage(response), status: response.status };
    }
    return { ok: true, data: (await response.json()) as AuditPacket };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Network error" };
  }
}

export async function fetchAuditPacketMeta(packetHash: string) {
  try {
    const response = await fetchWithTimeout(`${API_BASE}/api/audit/packets/${packetHash}/meta`);
    if (!response.ok) {
      return { ok: false, message: await readErrorMessage(response), status: response.status };
    }
    return { ok: true, data: await response.json() };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Network error" };
  }
}

export async function fetchAuditPacketIndex(limit = 50) {
  try {
    const response = await fetchWithTimeout(`${API_BASE}/api/audit/packets?limit=${limit}`);
    if (!response.ok) {
      return { ok: false, message: await readErrorMessage(response), status: response.status };
    }
    return { ok: true, data: await response.json() };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Network error" };
  }
}

export async function seedAuditDemoPackets(payload: { caseId?: string; count?: number }) {
  try {
    const response = await fetchWithTimeout(`${API_BASE}/api/audit/demo/seed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      return { ok: false, message: await readErrorMessage(response), status: response.status };
    }
    return { ok: true, data: await response.json() };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Network error" };
  }
}

export async function verifyAuditPacketOnServer(packet: AuditPacket) {
  try {
    const response = await fetchWithTimeout(`${API_BASE}/api/audit/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(packet),
    });
    if (!response.ok) {
      return { ok: false, message: await readErrorMessage(response) };
    }
    return { ok: true, data: await response.json() };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Network error" };
  }
}

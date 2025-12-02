import { API_BASE } from "./csfHospitalClient";

export interface HealthStatus {
  status: string; // "ok" | "degraded" | "down"
  service: string;
  version: string;
  checks: Record<string, string>;
}

export async function fetchHealthStatus(): Promise<HealthStatus> {
  const resp = await fetch(`${API_BASE}/health`, {
    method: "GET",
  });

  if (!resp.ok) {
    const message = await resp.text();
    throw new Error(
      `Health check failed with status ${resp.status}: ${message}`
    );
  }

  return (await resp.json()) as HealthStatus;
}

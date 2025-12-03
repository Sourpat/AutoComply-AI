import { API_BASE } from "./csfHospitalClient";

export type HealthComponentStatus = {
  status: string;
  details?: string;
  error?: string;
};

export type FullHealthResponse = {
  status: string;
  components: Record<string, HealthComponentStatus>;
};

export async function fetchFullHealth(): Promise<FullHealthResponse> {
  const resp = await fetch(`${API_BASE}/health/full`);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(
      `Full health check failed with status ${resp.status}: ${text || "no body"}`
    );
  }
  return (await resp.json()) as FullHealthResponse;
}

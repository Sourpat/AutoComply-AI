import { API_BASE } from "./csfHospitalClient";

// Detailed full health view used by SystemHealthCard
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
      `Full health check failed with status ${resp.status}: ${
        text || "no body"
      }`
    );
  }
  return (await resp.json()) as FullHealthResponse;
}

// ---------------------------------------------------------------------------
// Backwards-compatible simple health API used by SystemStatusCard
// ---------------------------------------------------------------------------
export type HealthStatus = {
  status: string;
};

export async function fetchHealthStatus(): Promise<HealthStatus> {
  // Prefer the richer /health/full endpoint and collapse to a simple status
  try {
    const full = await fetchFullHealth();
    return { status: full.status };
  } catch {
    // Fallback to the basic /health endpoint if /health/full is unavailable
    const resp = await fetch(`${API_BASE}/health`);
    if (!resp.ok) {
      throw new Error(`Health check failed with status ${resp.status}`);
    }
    return (await resp.json()) as HealthStatus;
  }
}

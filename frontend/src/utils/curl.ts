import { API_BASE } from "../api/csfHospitalClient";

type HttpMethod = "GET" | "POST";

export function buildCurlCommand(
  endpoint: string,
  payload?: unknown,
  method: HttpMethod = "POST"
): string {
  const parts = ["curl", `-X ${method}`, `"${API_BASE}${endpoint}"`];

  if (method === "POST") {
    parts.push('-H "Content-Type: application/json"');
    if (payload !== undefined) {
      const json = JSON.stringify(payload);
      parts.push(`-d '${json}'`);
    }
  }

  return parts.join(" ");
}

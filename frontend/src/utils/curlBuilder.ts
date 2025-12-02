import { API_BASE } from "../api/csfHospitalClient";

/**
 * Build a simple cURL command for a JSON POST request.
 * We keep escaping simple on purpose – good enough for dev usage.
 */
export function buildCurlCommand(
  path: string,
  method: string,
  body: unknown
): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE}${normalizedPath}`;
  const jsonBody = JSON.stringify(body, null, 2);

  return [
    `curl -X ${method.toUpperCase()} "${url}"`,
    `  -H "Content-Type: application/json"`,
    `  -d '${jsonBody}'`,
  ].join(" \\\n");
}

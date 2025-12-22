import { API_BASE } from "../lib/api";

type HttpMethod = "GET" | "POST";

type CurlConfig = {
  method?: HttpMethod | string;
  url?: string;
  endpoint?: string;
  body?: unknown;
};

export function buildCurlCommand(
  endpointOrConfig: string | CurlConfig,
  payload?: unknown,
  method: HttpMethod = "POST"
): string {
  const config: CurlConfig =
    typeof endpointOrConfig === "string"
      ? { endpoint: endpointOrConfig, body: payload, method }
      : endpointOrConfig;

  const resolvedMethod = (config.method ?? method ?? "POST") as HttpMethod;
  const target =
    config.url ?? (config.endpoint ? `${API_BASE}${config.endpoint}` : "");

  if (!target) return "";

  const parts = ["curl", `-X ${resolvedMethod}`, `"${target}"`];

  if (resolvedMethod === "POST") {
    parts.push('-H "Content-Type: application/json"');
    const body = config.body ?? payload;
    if (body !== undefined) {
      const json = JSON.stringify(body);
      parts.push(`-d '${json}'`);
    }
  }

  return parts.join(" ");
}

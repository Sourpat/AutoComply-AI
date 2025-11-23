const API_BASE =
  (import.meta as any).env?.VITE_API_BASE ||
  "";

export type ApiHealthStatus = "online" | "offline" | "unknown";

export async function checkApiHealth(): Promise<ApiHealthStatus> {
  // If API base isn’t configured, treat as offline
  if (!API_BASE) {
    return "offline";
  }

  try {
    const resp = await fetch(`${API_BASE}/health`, {
      method: "GET",
    });

    if (!resp.ok) {
      return "offline";
    }

    const data = await resp.json();

    if (data && data.status === "ok") {
      return "online";
    }

    return "offline";
  } catch {
    return "offline";
  }
}

import { emitCodexCommand } from "../utils/codexLogger";
import { useEffect, useState } from "react";

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE || "";

type Status = "idle" | "checking" | "online" | "offline";

export function ApiStatusChip() {
  const [status, setStatus] = useState<Status>("idle");
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkHealth = async () => {
    setStatus("checking");
    try {
      const resp = await fetch(`${API_BASE}/health`, {
        method: "GET",
      });

      if (resp.ok) {
        setStatus("online");
      } else {
        setStatus("offline");
      }
    } catch (err) {
      console.error("Health check failed", err);
      setStatus("offline");
    } finally {
      setLastChecked(new Date());

      // Optional Codex log so DevSupport can see when UI checked health
      emitCodexCommand("check_api_health", {
        api_base: API_BASE,
        status_after_check: status,
        last_checked_at: new Date().toISOString(),
      });
    }
  };

  useEffect(() => {
    // Run once on mount
    void checkHealth();
  }, []);

  const label =
    status === "online"
      ? "API online"
      : status === "offline"
      ? "API offline"
      : status === "checking"
      ? "Checking API…"
      : "API status";

  const colorClasses =
    status === "online"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : status === "offline"
      ? "bg-red-50 text-red-700 ring-red-200"
      : "bg-gray-50 text-gray-600 ring-gray-200";

  return (
    <button
      type="button"
      onClick={checkHealth}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium shadow-sm ring-1 ${colorClasses}`}
      title={
        lastChecked
          ? `Last checked at ${lastChecked.toLocaleTimeString()} (click to refresh)`
          : "Click to check API health"
      }
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === "online"
            ? "bg-emerald-500"
            : status === "offline"
            ? "bg-red-500"
            : "bg-gray-400"
        }`}
      />
      <span>{label}</span>
    </button>
  );
}

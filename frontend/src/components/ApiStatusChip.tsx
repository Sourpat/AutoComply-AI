import { useEffect, useState } from "react";
import { emitCodexCommand } from "../utils/codexLogger";

const API_BASE = (import.meta as any).env?.VITE_API_BASE || "";

type ApiStatus = "unknown" | "online" | "offline";

export function ApiStatusChip() {
  const [status, setStatus] = useState<ApiStatus>("unknown");
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkHealth = async () => {
    if (!API_BASE) {
      // No API base configured – treat as unknown but don't spam logs.
      setStatus("unknown");
      return;
    }

    setIsChecking(true);
    try {
      const resp = await fetch(`${API_BASE}/health`);
      const ok = resp.ok;
      setStatus(ok ? "online" : "offline");
      setLastChecked(new Date().toLocaleTimeString());

      emitCodexCommand("api_health_checked", {
        ok,
        status: ok ? "online" : "offline",
      });
    } catch (err) {
      console.error("API health check failed", err);
      setStatus("offline");
      setLastChecked(new Date().toLocaleTimeString());
      emitCodexCommand("api_health_checked", {
        ok: false,
        status: "offline",
      });
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    // initial check on mount
    checkHealth();

    // optional: re-check every 60s
    const id = window.setInterval(checkHealth, 60_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  let label = "API status: unknown";
  let classes =
    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]";

  if (status === "online") {
    label = "API online";
    classes += " border-emerald-300 bg-emerald-50 text-emerald-800";
  } else if (status === "offline") {
    label = "API offline";
    classes += " border-rose-300 bg-rose-50 text-rose-800";
  } else {
    classes += " border-slate-300 bg-slate-50 text-slate-600";
  }

  return (
    <button
      type="button"
      onClick={checkHealth}
      className={`${classes} hover:brightness-105 disabled:opacity-60`}
      disabled={isChecking || !API_BASE}
      title={
        lastChecked
          ? `Last checked at ${lastChecked}`
          : "Click to check API health"
      }
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === "online"
            ? "bg-emerald-500"
            : status === "offline"
            ? "bg-rose-500"
            : "bg-slate-400"
        }`}
      />
      <span>{isChecking ? "Checking…" : label}</span>
    </button>
  );
}

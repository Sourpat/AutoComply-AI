import { useEffect, useState } from "react";
import { checkApiHealth, type ApiHealthStatus } from "../api/healthClient";

export function ApiStatusChip() {
  const [status, setStatus] = useState<ApiHealthStatus>("unknown");
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const refresh = async () => {
    setIsChecking(true);
    try {
      const newStatus = await checkApiHealth();
      setStatus(newStatus);
      setLastChecked(new Date());
    } finally {
      setIsChecking(false);
    }
  };

  // Ping /health on initial mount
  useEffect(() => {
    void refresh();
  }, []);

  const labelMap: Record<ApiHealthStatus, string> = {
    online: "API online",
    offline: "API offline",
    unknown: "API status unknown",
  };

  const dotColorMap: Record<ApiHealthStatus, string> = {
    online: "bg-green-500",
    offline: "bg-red-500",
    unknown: "bg-gray-400",
  };

  return (
    <button
      type="button"
      onClick={refresh}
      className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-medium text-gray-700 shadow-sm ring-1 ring-gray-100 hover:bg-gray-50 disabled:cursor-not-allowed"
      title="Click to re-check API health (/health)"
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${dotColorMap[status]}`}
        aria-hidden="true"
      />
      <span>{isChecking ? "Checking…" : labelMap[status]}</span>
      {lastChecked && (
        <span className="text-[9px] text-gray-400">
          · checked {lastChecked.toLocaleTimeString()}
        </span>
      )}
    </button>
  );
}

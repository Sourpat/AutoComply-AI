import { useEffect, useState } from "react";

const API_BASE = import.meta?.env?.VITE_API_BASE || "";

export function ApiStatusChip() {
  const [status, setStatus] = useState("checking");
  const [lastChecked, setLastChecked] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function checkHealth() {
      try {
        setStatus("checking");

        const res = await fetch(`${API_BASE}/health`);

        if (!isMounted) return;

        if (res.ok) {
          setStatus("online");
        } else {
          setStatus("offline");
        }

        setLastChecked(new Date());
      } catch {
        if (!isMounted) return;
        setStatus("offline");
        setLastChecked(new Date());
      }
    }

    checkHealth();

    const intervalId = setInterval(checkHealth, 30000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  const label =
    status === "online"
      ? "API online"
      : status === "checking"
      ? "Checking…"
      : "API offline";

  const dotClass =
    status === "online"
      ? "bg-green-500"
      : status === "checking"
      ? "bg-yellow-500"
      : "bg-red-500";

  const tooltip =
    lastChecked != null
      ? `Last checked: ${lastChecked.toLocaleTimeString()}`
      : "Checking API health…";

  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      title={tooltip}
      className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-700 shadow-sm"
    >
      <span className={`h-2 w-2 rounded-full ${dotClass}`} />
      <span>{label}</span>
    </button>
  );
}

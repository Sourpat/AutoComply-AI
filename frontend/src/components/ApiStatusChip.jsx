import { useApiHealth } from "../hooks/useApiHealth";

const API_BASE = import.meta?.env?.VITE_API_BASE || ""; // if empty, hook will no-op

export function ApiStatusChip() {
  const { status, lastChecked, check } = useApiHealth(API_BASE);

  const label =
    status === "online"
      ? "API online"
      : status === "checking"
      ? "Checking…"
      : status === "offline"
      ? "API offline"
      : "API status";

  const dotClass =
    status === "online"
      ? "bg-green-500"
      : status === "checking"
      ? "bg-yellow-500"
      : status === "offline"
      ? "bg-red-500"
      : "bg-gray-300";

  const tooltip =
    lastChecked != null
      ? `Last checked: ${lastChecked.toLocaleTimeString()}`
      : "API health status";

  return (
    <button
      type="button"
      title={tooltip}
      onClick={check} // manual re-check, no full page reload
      className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-700 shadow-sm"
    >
      <span className={`h-2 w-2 rounded-full ${dotClass}`} />
      <span>{label}</span>
    </button>
  );
}

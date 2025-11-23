import { emitCodexCommand } from "../utils/codexLogger";
import { useApiHealth } from "../hooks/useApiHealth";

const API_BASE = import.meta?.env?.VITE_API_BASE || "";

export function ApiDiagnosticsPanel() {
  const { status, lastChecked, check } = useApiHealth(API_BASE);

  const statusText =
    status === "online"
      ? "API is responding correctly to /health."
      : status === "checking"
      ? "Checking API health…"
      : status === "offline"
      ? "API appears offline or unhealthy."
      : "API health has not been checked yet.";

  const lastCheckedText =
    lastChecked != null ? lastChecked.toLocaleString() : "Not checked yet";

  const runCodexDiagnostics = () => {
    emitCodexCommand("diagnose_api_health", null);
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-sm">
      <header className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
          API Diagnostics
        </h2>
      </header>

      <dl className="space-y-1 text-xs text-gray-700">
        <div className="flex justify-between">
          <dt className="font-medium">Status</dt>
          <dd>{statusText}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-medium">Last checked</dt>
          <dd>{lastCheckedText}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-medium">Endpoint</dt>
          <dd className="font-mono text-[11px]">{API_BASE || "(relative)"}/health</dd>
        </div>
      </dl>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={check}
          className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Re-check API
        </button>
        <button
          type="button"
          onClick={runCodexDiagnostics}
          className="rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white hover:bg-black"
        >
          Run Codex API diagnostics
        </button>
      </div>
    </section>
  );
}

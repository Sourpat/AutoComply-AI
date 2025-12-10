import React from "react";
import { useTraceSelection } from "../../state/traceSelectionContext";

interface DecisionTraceSummary {
  trace_id: string;
  last_updated: string;
  last_status: string;
  engine_families: string[];
}

export const RecentDecisionsPanel: React.FC = () => {
  const { selectedTraceId, setSelectedTraceId } = useTraceSelection();

  const [items, setItems] = React.useState<DecisionTraceSummary[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadRecent = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/decisions/recent?limit=10");
      if (!resp.ok) {
        setError(`Failed to load recent decisions (${resp.status}).`);
        return;
      }
      const json = (await resp.json()) as DecisionTraceSummary[];
      setItems(json);
    } catch {
      setError("Network error while loading recent decisions.");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    void loadRecent();
  }, []);

  const statusChipClass: Record<string, string> = {
    ok_to_ship: "bg-emerald-900/40 text-emerald-200 border-emerald-700/70",
    needs_review: "bg-amber-900/40 text-amber-200 border-amber-700/70",
    blocked: "bg-red-900/40 text-red-200 border-red-700/70",
  };

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-50">Recent Decisions</h2>
          <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-zinc-700/70 bg-zinc-900/70 px-2 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
            <span className="text-[10px] font-medium text-zinc-200">Recent traces & observability</span>
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            Last few decision traces across CSF, licenses, and orders. Click a row to pivot the console to that trace.
          </p>
        </div>
        <button
          type="button"
          onClick={loadRecent}
          className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:bg-zinc-700"
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-[11px] text-red-200">
          {error}
        </div>
      )}

      {items.length === 0 && !error && !loading && (
        <p className="text-[11px] text-zinc-500">
          No recent decisions yet. Run a CSF or license flow to populate this
          list.
        </p>
      )}

      {items.length > 0 && (
        <ul className="divide-y divide-zinc-800">
          {items.map((item) => {
            const statusKey = item.last_status.toLowerCase();
            const chipClass =
              statusChipClass[statusKey] ||
              "bg-zinc-900/60 text-zinc-200 border-zinc-700/70";

            const isSelected = selectedTraceId === item.trace_id;

            return (
              <li
                key={item.trace_id}
                className={`flex cursor-pointer items-center justify-between gap-2 py-2 ${
                  isSelected ? "bg-zinc-900/60" : "hover:bg-zinc-900/40"
                }`}
                onClick={() => setSelectedTraceId(item.trace_id)}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-mono text-zinc-200">
                    {item.trace_id}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    {formatTimestamp(item.last_updated)}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    Engines: {item.engine_families.join(", ") || "unknown"}
                  </span>
                </div>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${chipClass}`}
                >
                  {item.last_status}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {selectedTraceId && (
        <p className="pt-1 text-[10px] text-zinc-500">
          Selected trace: <span className="font-mono text-zinc-100">{selectedTraceId}</span>. Other panels (insights, summary,
          ops) are scoped to this.
        </p>
      )}
    </div>
  );
};

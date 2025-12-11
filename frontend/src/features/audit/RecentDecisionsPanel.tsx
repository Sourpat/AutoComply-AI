import React, { useMemo } from "react";
import { DecisionStatusBadge } from "../../components/DecisionStatusBadge";
import { useTraceSelection } from "../../state/traceSelectionContext";

interface DecisionTraceSummary {
  trace_id: string;
  last_updated: string;
  last_status: string;
  engine_families: string[];
  risk_level?: string;
  risk_score?: number;
}

const deriveRiskLevel = (item: Partial<DecisionTraceSummary>): "low" | "medium" | "high" => {
  const explicitRisk = (item.risk_level || "").toString().toLowerCase();
  if (explicitRisk === "low" || explicitRisk === "medium" || explicitRisk === "high") {
    return explicitRisk;
  }

  const status = (item.last_status || (item as any).status || "").toString().toLowerCase();
  if (status === "blocked") return "high";
  if (status === "needs_review") return "medium";
  return "low";
};

const RiskBadge: React.FC<{ level: "low" | "medium" | "high" }> = ({ level }) => {
  const label = level === "high" ? "High risk" : level === "medium" ? "Medium risk" : "Low risk";

  const bgClass =
    level === "high"
      ? "bg-red-900/60 text-red-300 border-red-700/70"
      : level === "medium"
      ? "bg-amber-900/50 text-amber-200 border-amber-700/70"
      : "bg-emerald-900/40 text-emerald-200 border-emerald-700/60";

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
        bgClass,
      ].join(" ")}
    >
      {label}
    </span>
  );
};

const formatUpdatedAgo = (iso: string | undefined): string | null => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin === 1) return "1 minute ago";
  if (diffMin < 60) return `${diffMin} minutes ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours === 1) return "1 hour ago";
  if (diffHours < 24) return `${diffHours} hours ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
};

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

  const decisions = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        derivedRisk: deriveRiskLevel(item),
        updatedAgo: formatUpdatedAgo(item.last_updated),
      })),
    [items]
  );

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
          {decisions.map((item) => {
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
                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-zinc-500">
                    <span className="rounded bg-zinc-900 px-1.5 py-0.5">
                      engine: {item.engine_families.join(", ") || "unknown"}
                    </span>
                    {item.updatedAgo && (
                      <span className="rounded bg-zinc-900 px-1.5 py-0.5">
                        updated {item.updatedAgo}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <DecisionStatusBadge status={item.last_status} />
                    <RiskBadge level={item.derivedRisk} />
                  </div>
                  <span className="text-[10px] text-zinc-500">trace: {item.trace_id}</span>
                </div>
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

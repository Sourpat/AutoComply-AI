import React, { useState } from "react";
import type { DecisionAuditEntry } from "../../types/audit";
import type { DecisionOutcome } from "../../types/decision";
import { DecisionStatusBadge } from "../../components/DecisionStatusBadge";
import { RiskPill } from "../../components/RiskPill";
import { useRagDebug } from "../../devsupport/RagDebugContext";
import { useTraceSelection } from "../../state/traceSelectionContext";

type TimelineEntry = DecisionAuditEntry;

const FAMILY_LABEL: Record<string, string> = {
  csf: "CSF engine",
  license: "License engine",
  order: "Order decision",
};

const FAMILY_BADGE_CLASS: Record<string, string> = {
  csf: "bg-purple-900/40 text-purple-200 border-purple-700/70",
  license: "bg-emerald-900/40 text-emerald-200 border-emerald-700/70",
  order: "bg-amber-900/40 text-amber-200 border-amber-700/70",
};

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const DecisionAuditTimelinePanel: React.FC = () => {
  const { enabled: aiDebugEnabled } = useRagDebug();
  const { selectedTraceId } = useTraceSelection();
  const [traceIdInput, setTraceIdInput] = useState("");
  const [entries, setEntries] = useState<TimelineEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  React.useEffect(() => {
    if (selectedTraceId) {
      setTraceIdInput(selectedTraceId);
    }
  }, [selectedTraceId]);

  const handleLoad = async () => {
    if (!traceIdInput.trim()) return;
    const traceId = traceIdInput.trim();

    setLoading(true);
    setError(null);
    setEntries(null);
    setShowRaw(false);

    try {
      const resp = await fetch(`/decisions/trace/${encodeURIComponent(traceId)}`, {
        method: "GET",
      });

      if (!resp.ok) {
        setError(`Request failed (${resp.status})`);
        return;
      }

      const json = (await resp.json()) as TimelineEntry[];

      const sorted = [...json].sort((a, b) => a.created_at.localeCompare(b.created_at));
      setEntries(sorted);
    } catch (_e) {
      setError("Network error while loading audit timeline.");
    } finally {
      setLoading(false);
    }
  };

  const renderEntry = (entry: TimelineEntry, index: number, total: number) => {
    const family = entry.engine_family;
    const familyLabel = FAMILY_LABEL[family] ?? family;
    const familyClass =
      FAMILY_BADGE_CLASS[family] ?? "bg-zinc-900/60 text-zinc-200 border-zinc-700/70";

    const decision: DecisionOutcome = entry.decision;

    return (
      <div key={`${entry.engine_family}-${entry.decision_type}-${index}`} className="flex gap-3">
        <div className="flex flex-col items-center pt-1">
          <div className="flex h-6 w-6 items-center justify-center rounded-full border border-zinc-600 bg-zinc-900 text-[11px] text-zinc-200">
            {index + 1}
          </div>
          {index < total - 1 && <div className="mt-1 h-full w-px bg-zinc-700/60" />}
        </div>
        <div className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${familyClass}`}
              >
                {familyLabel}
              </span>
              <span className="text-[11px] text-zinc-400">{entry.decision_type}</span>
            </div>
            <div className="flex items-center gap-2">
              <DecisionStatusBadge status={decision.status} />
              <RiskPill riskLevel={decision.risk_level ?? undefined} />
            </div>
          </div>

          <p className="mt-1 text-[11px] text-zinc-300">{entry.reason}</p>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-zinc-500">
            <span>{formatTimestamp(entry.created_at)}</span>
            {decision.trace_id && <span className="font-mono break-all">trace_id: {decision.trace_id}</span>}
          </div>

          {aiDebugEnabled && (
            <details className="mt-1">
              <summary className="cursor-pointer text-[11px] text-zinc-400 hover:text-zinc-200">
                Raw decision JSON
              </summary>
              <pre className="mt-1 max-h-40 overflow-auto rounded-md bg-black/70 p-2 text-[10px] text-zinc-300">
                {JSON.stringify(decision, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-50">Decision Audit Timeline</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Inspect all CSF, license, and order decisions for a given trace ID, in chronological order.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={traceIdInput}
              onChange={(e) => setTraceIdInput(e.target.value)}
              placeholder="Paste a trace_id (or use a journey)"
              className="bg-zinc-900 border border-zinc-700 text-xs rounded-md px-2 py-1 text-zinc-200 w-64"
            />
            <button
              type="button"
              onClick={handleLoad}
              disabled={loading || !traceIdInput.trim()}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 hover:bg-blue-500"
            >
              {loading ? "Loading…" : "Load"}
            </button>
          </div>

          {selectedTraceId && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500">
                Latest journey trace:&nbsp;
                <span className="font-mono text-zinc-300">
                  {selectedTraceId}
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setTraceIdInput(selectedTraceId);
                  handleLoad();
                }}
                disabled={loading}
                className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-200 hover:border-blue-500 hover:text-blue-200"
              >
                Load journey decisions
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-[11px] text-red-200">
          {error}
        </div>
      )}

      {!error && entries && entries.length === 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-[11px] text-zinc-400">
          No decisions recorded for this trace ID.
        </div>
      )}

      {!error && entries && entries.length > 0 && (
        <div className="space-y-3">
          {entries.map((entry, idx) => renderEntry(entry, idx, entries.length))}
        </div>
      )}

      {aiDebugEnabled && entries && (
        <div className="border-t border-zinc-800 pt-2">
          <button
            type="button"
            onClick={() => setShowRaw((v) => !v)}
            className="text-[11px] text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline"
          >
            {showRaw ? "Hide audit array JSON" : "Show audit array JSON"}
          </button>
          {showRaw && (
            <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-black/70 p-2 text-[10px] text-zinc-300">
              {JSON.stringify(entries, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

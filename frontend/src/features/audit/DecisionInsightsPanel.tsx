import React from "react";

import { useRagDebug } from "../../devsupport/RagDebugContext";
import { useTraceSelection } from "../../state/traceSelectionContext";

interface DecisionInsight {
  trace_id: string;
  overall_status: string;
  overall_risk: "low" | "medium" | "high" | "mixed";
  summary: string;
  recommendations: string[];
}

export const DecisionInsightsPanel: React.FC = () => {
  const { selectedTraceId } = useTraceSelection();
  const { enabled: aiDebugEnabled } = useRagDebug();

  const [insight, setInsight] = React.useState<DecisionInsight | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleGenerate = async () => {
    if (!selectedTraceId) {
      setError("Select or run a journey to generate insights.");
      return;
    }
    setLoading(true);
    setError(null);
    setInsight(null);

    try {
      const resp = await fetch(
        `/ai/decisions/insights/${encodeURIComponent(selectedTraceId)}`,
      );
      if (resp.status === 404) {
        setError("No decisions found for this trace yet.");
        return;
      }
      if (!resp.ok) {
        setError(`Request failed (${resp.status}).`);
        return;
      }
      const json = (await resp.json()) as DecisionInsight;
      setInsight(json);
    } catch {
      setError("Network error while generating insights.");
    } finally {
      setLoading(false);
    }
  };

  const riskChipClass: Record<string, string> = {
    low: "bg-emerald-900/40 text-emerald-200 border-emerald-700/70",
    medium: "bg-amber-900/40 text-amber-200 border-amber-700/70",
    high: "bg-red-900/40 text-red-200 border-red-700/70",
    mixed: "bg-purple-900/40 text-purple-200 border-purple-700/70",
  };

  const riskClass =
    (insight && riskChipClass[insight.overall_risk]) ||
    "bg-zinc-900/60 text-zinc-200 border-zinc-700/70";

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-50">
            Decision Insights (AI)
          </h2>
          <p className="mt-1 text-xs text-zinc-400">
            Summarize CSF, license, and order decisions for the current trace and
            suggest next actions.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || !selectedTraceId}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? "Analyzing…" : "Generate insights"}
          </button>
          <span className="text-[10px] text-zinc-500">
            Trace: {selectedTraceId || "none selected"}
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-[11px] text-red-200">
          {error}
        </div>
      )}

      {insight && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Overall status:</span>
            <span className="text-xs font-semibold text-zinc-100">
              {insight.overall_status}
            </span>
            <span
              className={`ml-2 rounded-full border px-2 py-0.5 text-[10px] font-medium ${riskClass}`}
            >
              Risk: {insight.overall_risk}
            </span>
          </div>

          <p className="text-[11px] text-zinc-300">{insight.summary}</p>

          {insight.recommendations.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-zinc-200">
                Recommended next steps
              </p>
              <ul className="mt-1 space-y-1 text-[11px] text-zinc-300">
                {insight.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex gap-1">
                    <span className="mt-[3px] h-[3px] w-[3px] rounded-full bg-zinc-500" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {aiDebugEnabled && (
            <div className="border-t border-zinc-800 pt-2">
              <p className="text-[10px] text-zinc-500">
                This insight is currently generated using deterministic rules over
                decision history. In production, this can be backed by a real
                LLM/RAG pipeline.
              </p>
            </div>
          )}
        </div>
      )}

      {!error && !insight && (
        <p className="text-[11px] text-zinc-500">
          Run a journey first, then click "Generate insights" to see an AI-style
          summary.
        </p>
      )}
    </div>
  );
};

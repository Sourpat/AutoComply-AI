import React, { useMemo, useState } from "react";

import { CopyCurlButton } from "../../components/CopyCurlButton";
import { useTraceSelection } from "../../state/traceSelectionContext";
import { API_BASE } from "../../api/csfHospitalClient";
import { buildCurlCommand } from "../../utils/curl";
import { RagSourceCard } from "../../components/RagSourceCard";
import type { RagSource } from "../../types/rag";

interface CaseDecision {
  decision_type: string;
  status: string;
  reason?: string;
  engine_family?: string;
  risk_level?: string | null;
}

interface CaseInsight {
  summary?: string;
  recommendations?: string[];
}

interface CaseSummaryResponse {
  trace_id: string;
  overall_status: string;
  overall_risk?: string | null;
  decisions: CaseDecision[];
  regulatory_references?: string[];
  insight?: CaseInsight;
  rag_sources?: RagSource[];
}

export const ComplianceCaseSummaryPanel: React.FC = () => {
  const { selectedTraceId } = useTraceSelection();

  const [summary, setSummary] = useState<CaseSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isJsonOpen, setIsJsonOpen] = useState(false);

  const handleLoad = async () => {
    if (!selectedTraceId) {
      setError("Run a journey first to generate a trace.");
      return;
    }

    setLoading(true);
    setError(null);
    setSummary(null);

    try {
      const resp = await fetch(`/cases/summary/${encodeURIComponent(selectedTraceId)}`);

      if (resp.status === 404) {
        setError("No case summary found for this trace yet.");
        return;
      }

      if (!resp.ok) {
        setError(`Request failed (${resp.status}).`);
        return;
      }

      const json = (await resp.json()) as CaseSummaryResponse;
      setSummary(json);
    } catch {
      setError("Network error while loading case summary.");
    } finally {
      setLoading(false);
    }
  };

  const summaryJson = useMemo(() => {
    if (!summary) return "";
    try {
      return JSON.stringify(summary, null, 2);
    } catch {
      return "";
    }
  }, [summary]);

  const overallBadgeClass: Record<string, string> = {
    ok_to_ship: "bg-emerald-900/40 text-emerald-200 border-emerald-700/70",
    needs_review: "bg-amber-900/40 text-amber-200 border-amber-700/70",
    blocked: "bg-red-900/40 text-red-200 border-red-700/70",
  };

  const overallClass =
    (summary && overallBadgeClass[summary.overall_status]) ||
    "bg-zinc-900/60 text-zinc-200 border-zinc-700/70";

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-50">Compliance Case Summary</h2>
          <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-zinc-700/70 bg-zinc-900/70 px-2 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10px] font-medium text-zinc-200">Per-trace case summary</span>
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            Roll-up of CSF, license, and order decisions for the selected trace, plus
            a canonical JSON contract that downstream systems can consume.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLoad}
              disabled={loading || !selectedTraceId}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 hover:bg-indigo-500"
            >
              {loading ? "Loading…" : "Load summary"}
            </button>

            <button
              type="button"
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-100 hover:bg-zinc-800"
              onClick={() => setIsJsonOpen((open) => !open)}
            >
              {isJsonOpen ? "Hide JSON contract" : "View JSON contract"}
            </button>

            {summary?.trace_id && (
              <CopyCurlButton
                label="Copy cURL"
                size="sm"
                curl={buildCurlCommand({
                  method: "GET",
                  url: `${API_BASE}/cases/summary/${summary.trace_id}`,
                })}
              />
            )}
          </div>
          <span className="text-[10px] text-zinc-500">Trace: {selectedTraceId || "none"}</span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-[11px] text-red-200">{error}</div>
      )}

      {summary && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-100 ${overallClass}`}
            >
              {summary.overall_status}
            </span>
            {summary.overall_risk && (
              <span className="text-[10px] text-zinc-400">Risk: {summary.overall_risk}</span>
            )}
          </div>

          {summary.insight?.summary && (
            <p className="text-[11px] text-zinc-300">{summary.insight.summary}</p>
          )}

          {summary.decisions.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-zinc-200">Decisions</p>
              <ul className="space-y-1">
                {summary.decisions.map((d, idx) => (
                  <li
                    key={`${d.decision_type}-${idx}`}
                    className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-zinc-100">{d.decision_type}</span>
                      <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] font-medium uppercase text-zinc-200">
                        {d.status}
                      </span>
                    </div>
                    {d.reason && <p className="mt-1 text-[11px] text-zinc-300">{d.reason}</p>}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-zinc-500">
                      {d.engine_family && <span>Family: {d.engine_family}</span>}
                      {d.risk_level && <span>Risk: {d.risk_level}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.rag_sources && summary.rag_sources.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-zinc-200">
                  RAG sources used in this decision
                </p>
                <span className="text-[10px] text-zinc-500">
                  Top {summary.rag_sources.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {summary.rag_sources.map((src, idx) => (
                  <RagSourceCard key={src.id ?? idx} source={src} index={idx} />
                ))}
              </div>
            </div>
          )}

          {summary.regulatory_references && summary.regulatory_references.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-zinc-200">Regulatory references</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {summary.regulatory_references.map((ref) => (
                  <span
                    key={ref}
                    className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-200"
                  >
                    {ref}
                  </span>
                ))}
              </div>
            </div>
          )}

          {isJsonOpen && summaryJson && (
            <div className="mt-3 rounded-md border border-zinc-800 bg-black/60">
              <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
                <span className="text-[11px] font-medium text-zinc-300">
                  Case summary JSON contract
                </span>
                {summary?.trace_id && (
                  <span className="text-[10px] text-zinc-500">trace_id: {summary.trace_id}</span>
                )}
              </div>
              <pre className="max-h-64 overflow-auto px-3 py-2 text-[11px] leading-snug text-zinc-200">
                {summaryJson}
              </pre>
            </div>
          )}
        </div>
      )}

      {!error && !summary && (
        <p className="text-[11px] text-zinc-500">
          Run a journey first, then click "Load summary" to generate a case-level overview.
        </p>
      )}
    </div>
  );
};

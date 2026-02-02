import React, { useState } from "react";
import type { DecisionOutcome, RegulatoryReference } from "../types/decision";
import { DecisionStatusBadge } from "./DecisionStatusBadge";
import { RiskPill } from "./RiskPill";

interface RegulatoryInsightsPanelProps {
  title?: string;
  decision?: DecisionOutcome | null;
  missingFields?: string[] | null;
  compact?: boolean;
  aiDebugEnabled?: boolean;
}

export const RegulatoryInsightsPanel: React.FC<RegulatoryInsightsPanelProps> = ({
  title = "Regulatory insights",
  decision,
  missingFields,
  compact = false,
  aiDebugEnabled = false,
}) => {
  const [showDebug, setShowDebug] = useState(false);

  if (!decision) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 text-xs text-zinc-400">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-zinc-200">{title}</span>
        </div>
        <p className="mt-1">
          Run an evaluation to see decision details and regulatory evidence.
        </p>
      </div>
    );
  }

  const { status, reason, risk_level, regulatory_references, debug_info } = decision;

  const refs: RegulatoryReference[] = regulatory_references ?? [];

  return (
    <div
      className={
        "rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 " +
        (compact ? "text-xs" : "text-sm")
      }
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-zinc-100">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <DecisionStatusBadge
            status={status}
            policyTrace={decision.policy_trace}
            safeFailure={decision.safe_failure}
          />
          <RiskPill riskLevel={risk_level ?? undefined} />
        </div>
      </div>

      <div className="mt-2">
        <p className="text-xs text-zinc-300 leading-snug">{reason}</p>
      </div>

      {missingFields && missingFields.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] font-semibold text-zinc-400">Missing fields</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {missingFields.map((field) => (
              <span
                key={field}
                className="rounded-full bg-amber-500/10 border border-amber-500/40 px-2 py-0.5 text-[10px] text-amber-200"
              >
                {field}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3">
        <div className="text-[11px] font-semibold text-zinc-400">Regulatory evidence</div>
        {refs.length === 0 ? (
          <p className="mt-1 text-[11px] text-zinc-500">
            No regulatory references were attached to this decision.
          </p>
        ) : (
          <ul className="mt-1 space-y-1.5">
            {refs.map((ref) => (
              <li
                key={ref.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-2 py-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] text-zinc-100 font-medium">
                    {ref.label || ref.id}
                  </div>
                  <div className="flex items-center gap-1">
                    {ref.jurisdiction && (
                      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300">
                        {ref.jurisdiction}
                      </span>
                    )}
                    {ref.citation && (
                      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300">
                        {ref.citation}
                      </span>
                    )}
                  </div>
                </div>
                {(ref.source || ref.citation) && (
                  <div className="mt-0.5 text-[10px] text-zinc-400">
                    {ref.source}
                    {ref.source && ref.citation ? " · " : ""}
                    {ref.citation}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {aiDebugEnabled && debug_info && (
        <div className="mt-3 border-t border-zinc-800 pt-2">
          <button
            type="button"
            onClick={() => setShowDebug((v) => !v)}
            className="text-[11px] text-zinc-400 hover:text-zinc-200 underline-offset-2 hover:underline"
          >
            {showDebug ? "Hide AI / RAG debug" : "Show AI / RAG debug"}
          </button>
          {showDebug && (
            <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-black/60 p-2 text-[10px] text-zinc-300">
              {JSON.stringify(debug_info, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

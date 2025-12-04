import React from "react";
import { BookOpen, AlertTriangle, Sparkles } from "lucide-react";

import type { RegulatoryReference } from "../types/decision";

export type RegulatoryInsightsPanelProps = {
  title?: string;
  statusLabel?: string;
  reason?: string | null;
  missingFields?: string[] | null | undefined;
  regulatoryReferences?: RegulatoryReference[] | null | undefined;
  ragExplanation?: string | null | undefined;
  ragSources?: any[] | null | undefined;
};

export function RegulatoryInsightsPanel({
  title = "Regulatory insights",
  statusLabel,
  reason,
  missingFields,
  regulatoryReferences,
  ragExplanation,
  ragSources,
}: RegulatoryInsightsPanelProps) {
  const hasMissing =
    Array.isArray(missingFields) && missingFields.length > 0;
  const normalizedReferences = (regulatoryReferences ?? []).filter(Boolean);
  const hasReferences = normalizedReferences.length > 0;
  const hasRagExplanation =
    typeof ragExplanation === "string" && ragExplanation.trim().length > 0;
  const hasSources = Array.isArray(ragSources) && ragSources.length > 0;

  if (!hasMissing && !hasReferences && !hasRagExplanation && !hasSources) {
    // Nothing to show – keep the UI quiet
    return null;
  }

  return (
    <div className="mt-3 rounded-2xl border border-indigo-500/40 bg-slate-950/90 px-3 py-3 text-[11px] text-slate-100 shadow-inner shadow-indigo-900/40">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3 w-3 text-indigo-300" />
          <div>
            <p className="text-xs font-semibold text-slate-50">{title}</p>
            {statusLabel && (
              <p className="text-[10px] text-slate-400">{statusLabel}</p>
            )}
          </div>
        </div>
      </div>

      {reason && (
        <p className="mt-2 text-[11px] leading-relaxed text-slate-200">
          {reason}
        </p>
      )}

      {hasMissing && (
        <div className="mt-2 rounded-xl bg-amber-950/40 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 text-amber-300" />
            <p className="text-[10px] font-semibold text-amber-100">
              Missing or unclear fields
            </p>
          </div>
          <ul className="mt-1 list-disc pl-5 text-[10px] text-amber-100/90">
            {missingFields!.map((field, idx) => (
              <li key={idx}>{field}</li>
            ))}
          </ul>
        </div>
      )}

      {hasReferences && (
        <div className="mt-2 rounded-xl bg-slate-900 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <BookOpen className="h-3 w-3 text-cyan-300" />
            <p className="text-[10px] font-semibold text-cyan-100">
              Regulatory references
            </p>
          </div>
          <ul className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
            {normalizedReferences.map((ref, idx) => {
              const label =
                ref.label || ref.citation || ref.source || ref.id || `ref-${idx}`;

              return (
                <li
                  key={ref.id ?? idx}
                  className="rounded-full bg-slate-950/80 px-2 py-0.5 text-[10px] text-cyan-100 ring-1 ring-cyan-500/30"
                >
                  <span className="font-semibold">{label}</span>
                  {ref.citation && ref.citation !== label && (
                    <span className="ml-1 font-mono text-[9px] text-cyan-200/80">
                      ({ref.citation})
                    </span>
                  )}
                  {ref.jurisdiction && (
                    <span className="ml-1 text-[9px] text-cyan-200/80">
                      [{ref.jurisdiction}]
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {hasRagExplanation && (
        <div className="mt-2 rounded-xl bg-slate-900/70 px-3 py-2">
          <p className="text-[10px] font-semibold text-slate-100">
            How the RAG layer interpreted this form
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-200">
            {ragExplanation}
          </p>
        </div>
      )}

      {hasSources && (
        <div className="mt-2 rounded-xl bg-slate-900/70 px-3 py-2">
          <p className="text-[10px] font-semibold text-slate-100">
            Sources consulted
          </p>
          <ul className="mt-1 list-disc pl-5 text-[10px] text-slate-300">
            {ragSources!.map((src, idx) => (
              <li key={idx}>
                {typeof src === "string"
                  ? src
                  : JSON.stringify(src)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

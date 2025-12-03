import React, { useState } from "react";
import { Info, CheckCircle2, AlertTriangle, Ban, BookOpen } from "lucide-react";

export type FormCopilotDetailsProps = {
  title?: string;
  status: string;
  reason?: string | null;
  missingFields?: string[];
  regulatoryReferences?: string[];
  ragExplanation?: string | null;
  artifactsUsed?: string[];
  ragSources?: string[];
};

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  if (normalized === "ok_to_ship") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-200">
        <CheckCircle2 className="h-3 w-3" />
        ok_to_ship
      </span>
    );
  }
  if (normalized === "needs_review") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-200">
        <AlertTriangle className="h-3 w-3" />
        needs_review
      </span>
    );
  }
  if (normalized === "blocked") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-200">
        <Ban className="h-3 w-3" />
        blocked
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-900/80 px-2 py-0.5 text-[11px] font-medium text-slate-200">
      {status}
    </span>
  );
}

export function FormCopilotDetailsCard({
  title = "Form Copilot explanation",
  status,
  reason,
  missingFields = [],
  regulatoryReferences = [],
  ragExplanation,
  artifactsUsed = [],
  ragSources = [],
}: FormCopilotDetailsProps) {
  const [showHint, setShowHint] = useState(false);

  const hasRagDetails =
    (ragExplanation && ragExplanation.trim().length > 0) ||
    (regulatoryReferences && regulatoryReferences.length > 0) ||
    (ragSources && ragSources.length > 0);

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-100 shadow-md shadow-black/30 backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-50">{title}</h3>
          <p className="mt-1 text-[11px] text-slate-400">
            How the Copilot is reading this form and why it picked this decision.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={status} />
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-medium text-slate-200 hover:border-slate-500"
            onClick={() => setShowHint((prev) => !prev)}
          >
            <Info className="h-3 w-3 text-cyan-300" />
            <span>What this panel is</span>
          </button>
          {showHint && (
            <div className="mt-1 w-60 rounded-xl border border-slate-700/70 bg-slate-900/95 p-2 text-[11px] text-slate-200 shadow-lg shadow-black/40">
              <p>
                In a full build, this is where RAG-powered explanations would live:
                which rules fired, what documents were consulted, and which fields
                drove the decision.
              </p>
            </div>
          )}
        </div>
      </div>

      {reason && (
        <p className="mt-3 text-xs text-slate-200">
          <span className="font-semibold text-slate-100">Summary: </span>
          {reason}
        </p>
      )}

      {missingFields.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-medium text-slate-300">
            Fields the Copilot thinks are missing or incomplete
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {missingFields.map((field) => (
              <span
                key={field}
                className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-100 border border-amber-500/30"
              >
                {field}
              </span>
            ))}
          </div>
        </div>
      )}

      {regulatoryReferences.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-medium text-slate-300 flex items-center gap-1">
            <BookOpen className="h-3 w-3 text-indigo-200" />
            Regulatory references
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {regulatoryReferences.map((ref) => (
              <span
                key={ref}
                className="inline-flex items-center rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] text-indigo-100 border border-indigo-500/30"
              >
                {ref}
              </span>
            ))}
          </div>
        </div>
      )}

      {hasRagDetails && (
        <div className="mt-3">
          {ragExplanation && (
            <p className="text-[11px] text-slate-300 leading-relaxed">
              {ragExplanation}
            </p>
          )}

          {ragSources.length > 0 && (
            <div className="mt-2">
              <p className="text-[11px] font-medium text-slate-300">
                Sources consulted
              </p>
              <ul className="mt-1 space-y-1 text-[11px] text-slate-400">
                {ragSources.map((src) => (
                  <li key={src} className="flex gap-1">
                    <span className="mt-[2px] text-slate-600">•</span>
                    <span>{src}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {artifactsUsed.length > 0 && (
            <div className="mt-2">
              <p className="text-[11px] font-medium text-slate-300">
                Internal artifacts
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {artifactsUsed.map((a) => (
                  <span
                    key={a}
                    className="inline-flex items-center rounded-full bg-slate-900 px-2 py-0.5 text-[11px] text-slate-200 border border-slate-600"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!hasRagDetails && (
        <p className="mt-3 text-[11px] text-slate-500">
          RAG-based explanations are stubbed in this demo. The UI is wired so
          you can plug in document-backed reasoning without changing the
          frontend again.
        </p>
      )}
    </div>
  );
}

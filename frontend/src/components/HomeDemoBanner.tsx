import React from "react";
import { Sparkles } from "lucide-react";

export function HomeDemoBanner() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/10 via-indigo-500/10 to-emerald-500/10 p-[1px] shadow-md shadow-black/30">
      <div className="relative flex flex-col gap-3 rounded-2xl bg-slate-950/90 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-xl bg-cyan-500/20">
            <Sparkles className="h-4 w-4 text-cyan-200" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200">
              AutoComply AI
            </p>
            <p className="text-sm font-medium text-slate-50">
              Built to demo CSF, licenses, and mock orders in one place.
            </p>
            <p className="mt-1 text-[11px] text-slate-300">
              Spin up realistic compliance flows without touching production
              systems, and walk people through the decisions with traces and
              explainable AI.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          <span className="inline-flex items-center rounded-full bg-slate-900/80 px-2.5 py-1 text-[11px] font-medium text-cyan-100 border border-cyan-500/30">
            CSF Suite
          </span>
          <span className="inline-flex items-center rounded-full bg-slate-900/80 px-2.5 py-1 text-[11px] font-medium text-indigo-100 border border-indigo-500/30">
            License Suite
          </span>
          <span className="inline-flex items-center rounded-full bg-slate-900/80 px-2.5 py-1 text-[11px] font-medium text-emerald-100 border border-emerald-500/30">
            Order journeys
          </span>
        </div>
      </div>
    </div>
  );
}

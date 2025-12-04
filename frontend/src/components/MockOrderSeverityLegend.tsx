import React from "react";
import { CheckCircle2, AlertTriangle, Activity } from "lucide-react";

export function MockOrderSeverityLegend() {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-300">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        Scenario legend
      </span>
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-2 py-1 ring-1 ring-emerald-500/40">
        <CheckCircle2 className="h-3 w-3 text-emerald-300" />
        <span>Happy path</span>
      </span>
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-2 py-1 ring-1 ring-amber-400/60">
        <AlertTriangle className="h-3 w-3 text-amber-300" />
        <span>Edge case</span>
      </span>
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-2 py-1 ring-1 ring-cyan-400/60">
        <Activity className="h-3 w-3 text-cyan-300" />
        <span>Investigate</span>
      </span>
    </div>
  );
}

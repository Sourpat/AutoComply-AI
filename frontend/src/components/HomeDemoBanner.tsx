import React from "react";
import { Sparkles } from "lucide-react";

export function HomeDemoBanner() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-cyan-500/25 bg-slate-950/90 p-[1px] shadow-md shadow-black/30">
      <div className="relative flex flex-col gap-4 rounded-2xl bg-slate-950/90 px-5 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/80 via-indigo-500/70 to-emerald-500/70 text-lg font-semibold text-white shadow-lg shadow-cyan-500/30">
            A
          </div>
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-cyan-100">
              <Sparkles className="h-4 w-4 text-cyan-200" />
              AutoComply AI
            </p>
            <p className="text-xs text-slate-300">Compliance Console</p>
          </div>
        </div>

        <div className="space-y-2 text-sm text-slate-200">
          <p className="text-base font-medium text-white">Guided compliance experiences for demos and interviews.</p>
          <p>Walk through CSF, license, and mock order flows with clear decisions and explainable traces.</p>
        </div>
      </div>
    </section>
  );
}

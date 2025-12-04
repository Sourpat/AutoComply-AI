import React from "react";
import { Flag, Lightbulb, Layers } from "lucide-react";

export function FutureWorkCard() {
  return (
    <section className="console-section console-section-future-work">
      <div className="rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 shadow-md shadow-black/30">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-400/60">
              <Flag className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-50">
                Future work &amp; roadmap
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                The current console is a focused compliance lab. Here are
                some next steps that would take AutoComply AI closer to a
                production-ready compliance platform.
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-1 rounded-full bg-slate-900/90 px-2 py-1 text-[10px] text-slate-300 md:inline-flex">
            <Lightbulb className="h-3 w-3 text-amber-300" />
            <span>Product thinking</span>
          </div>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <div className="rounded-xl bg-slate-900/80 px-3 py-2 ring-1 ring-white/5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              1. More engines &amp; states
            </p>
            <p className="mt-1 text-[11px] text-slate-100">
              Expand beyond the current CSF + license set into more states
              and license types (e.g., additional TDDD classes, more pharmacy
              boards, practitioner license variants).
            </p>
            <p className="mt-1 text-[10px] text-slate-400">
              Each new engine would get its own sandbox, presets, and pytest
              coverage, just like the existing ones.
            </p>
          </div>

          <div className="rounded-xl bg-slate-900/80 px-3 py-2 ring-1 ring-white/5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              2. Deeper AI / RAG layer
            </p>
            <p className="mt-1 text-[11px] text-slate-100">
              Replace stubbed regulatory labels with a real RAG pipeline over
              curated DEA, state board, and internal policy documents.
            </p>
            <p className="mt-1 text-[10px] text-slate-400">
              RegulatoryInsightsPanel and AI / RAG debug mode are already in
              place to surface this explainability end-to-end.
            </p>
          </div>

          <div className="rounded-xl bg-slate-900/80 px-3 py-2 ring-1 ring-white/5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              3. Production hardening
            </p>
            <p className="mt-1 text-[11px] text-slate-100">
              Add auth, tenancy, observability, and SLAs around the decision
              APIs so they can back real e-commerce flows and workflows.
            </p>
            <p className="mt-1 text-[10px] text-slate-400">
              Includes rate limiting, audit logs for decisions, and richer
              integration stories (n8n, event buses, core ordering systems).
            </p>
          </div>
        </div>

        <p className="mt-3 text-[10px] text-slate-500">
          A longer-form outline lives in{" "}
          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-indigo-300">
            docs/roadmap_autocomply_ai.md <Layers className="h-3 w-3" />
          </span>
          , which you can reference in portfolio reviews and interviews.
        </p>
      </div>
    </section>
  );
}

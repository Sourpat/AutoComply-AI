import React from "react";
import { GitBranch, Sparkles, ArrowUpRight } from "lucide-react";

export function IntegrationsCard() {
  return (
    <section className="console-section console-section-integrations">
      <div className="rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 shadow-md shadow-black/30">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400/60">
              <GitBranch className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-50">
                Integrations &amp; automation
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                AutoComply AI is meant to be called from other tools: n8n
                workflows, internal services, Postman collections, or AI
                agents that orchestrate CSF, license, and order decisions.
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-1 rounded-full bg-slate-900/90 px-2 py-1 text-[10px] text-slate-300 md:inline-flex">
            <Sparkles className="h-3 w-3 text-cyan-300" />
            <span>API-first</span>
          </div>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <div className="rounded-xl bg-slate-900/80 px-3 py-2 ring-1 ring-white/5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Example flow
            </p>
            <p className="mt-1 text-[11px] text-slate-100">
              A typical automation calls the engines in sequence:
            </p>
            <ul className="mt-1 list-disc pl-4 text-[10px] text-slate-300">
              <li>/csf/hospital/evaluate for CSF status</li>
              <li>/license/ohio-tddd/evaluate for license status</li>
              <li>
                /orders/mock/ohio-hospital-approval to combine decisions into a
                single order outcome
              </li>
            </ul>
            <p className="mt-1 text-[10px] text-slate-400">
              Perfect for n8n, Zapier-like tools, or custom backends that
              need a clear go/no-go decision for controlled orders.
            </p>
          </div>

          <div className="rounded-xl bg-slate-900/80 px-3 py-2 ring-1 ring-white/5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              How to use this in practice
            </p>
            <ul className="mt-1 list-disc pl-4 text-[10px] text-slate-300">
              <li>
                Import the endpoints into Postman or an HTTP node in{" "}
                <span className="font-mono text-slate-100">n8n</span>.
              </li>
              <li>
                Pass the same payloads you see in the console forms (CSF +
                license data).
              </li>
              <li>
                Use the final mock order decision to trigger approvals,
                manual reviews, or notifications.
              </li>
            </ul>
            <p className="mt-1 text-[10px] text-slate-400">
              For a concrete n8n-style walkthrough, see{" "}
              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-cyan-300">
                docs/integrations_n8n_example.md{" "}
                <ArrowUpRight className="h-3 w-3" />
              </span>
              .
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

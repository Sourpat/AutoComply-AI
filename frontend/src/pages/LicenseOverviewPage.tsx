import React, { useEffect } from "react";

import { OhioTdddSandbox } from "../components/OhioTdddSandbox";
import { trackSandboxEvent } from "../devsupport/telemetry";

type LicenseSandboxMeta = {
  id: string;
  title: string;
  description: string;
  evaluateEndpoint: string;
  copilotEndpoint: string;
  ragDocId: string;
};

const LICENSE_SANDBOXES: LicenseSandboxMeta[] = [
  {
    id: "ohio_tddd",
    title: "Ohio TDDD License Sandbox",
    description:
      "Evaluate and explain Ohio TDDD (Terminal Distributor of Dangerous Drugs) license information.",
    evaluateEndpoint: "/license/ohio-tddd/evaluate",
    copilotEndpoint: "/license/ohio-tddd/form-copilot",
    ragDocId: "ohio_tddd_rules",
  },
  // Future: add more license engines here (e.g., other states, DEA, etc.)
];

export function LicenseOverviewPage() {
  useEffect(() => {
    trackSandboxEvent("license_overview_page_view", {
      engine_family: "license",
      sandbox: "overview",
    });
  }, []);

  return (
    <div className="license-overview-page space-y-6 py-6">
      <header className="license-overview-header space-y-3 rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          License Compliance – AutoComply AI Playground
        </h1>
        <p className="text-[11px] leading-relaxed text-slate-600">
          Explore how AutoComply AI evaluates and explains license requirements, starting with Ohio
          TDDD (Terminal Distributor of Dangerous Drugs). Each sandbox shares a common License
          Copilot RAG engine, grounded in state-specific regulatory documents.
        </p>
      </header>

      <div className="license-overview-grid space-y-6">
        {LICENSE_SANDBOXES.map((meta) => (
          <section
            key={meta.id}
            id={`license-${meta.id}`}
            className="license-section space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm"
          >
            <div className="license-section-header space-y-2">
              <h2 className="text-sm font-semibold text-slate-900">{meta.title}</h2>
              <p className="text-[11px] text-slate-600">{meta.description}</p>

              <dl className="license-metadata grid gap-3 rounded-xl bg-slate-50 p-3 text-[11px] text-slate-700 md:grid-cols-3">
                <div className="space-y-0.5">
                  <dt className="font-semibold text-slate-900">Evaluate endpoint</dt>
                  <dd>
                    <code className="rounded bg-white px-2 py-1 text-[10px] ring-1 ring-slate-200">
                      {meta.evaluateEndpoint}
                    </code>
                  </dd>
                </div>
                <div className="space-y-0.5">
                  <dt className="font-semibold text-slate-900">Form Copilot endpoint</dt>
                  <dd>
                    <code className="rounded bg-white px-2 py-1 text-[10px] ring-1 ring-slate-200">
                      {meta.copilotEndpoint}
                    </code>
                  </dd>
                </div>
                <div className="space-y-0.5">
                  <dt className="font-semibold text-slate-900">RAG doc id</dt>
                  <dd>
                    <code className="rounded bg-white px-2 py-1 text-[10px] ring-1 ring-slate-200">
                      {meta.ragDocId}
                    </code>
                  </dd>
                </div>
              </dl>
            </div>

            <div
              id={`license-${meta.id}-sandbox`}
              className="license-section-sandbox-wrapper overflow-hidden rounded-xl border border-slate-200 bg-white"
            >
              {meta.id === "ohio_tddd" && <OhioTdddSandbox />}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

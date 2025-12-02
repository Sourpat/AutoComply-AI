import React from "react";
import { Link } from "react-router-dom";

import { OhioHospitalOrderJourneyCard } from "../components/OhioHospitalOrderJourneyCard";
import { DecisionStatusLegend } from "../components/DecisionStatusLegend";
import { SystemStatusCard } from "../components/SystemStatusCard";
import { DocsLinksCard } from "../components/DocsLinksCard";

export function ComplianceConsolePage() {
  return (
    <div className="compliance-console-page space-y-8 py-6">
      <header className="space-y-3 rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          AutoComply AI – Compliance Console
        </h1>
        <p className="text-[11px] leading-relaxed text-slate-600">
          A single view of how AutoComply AI evaluates controlled substance forms, state licenses,
          and end-to-end order approvals.
        </p>
      </header>

      <section className="console-section console-section-status rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
        <SystemStatusCard />
      </section>

      <section className="console-grid grid gap-4 md:grid-cols-2">
        <div className="console-card space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-slate-900">Controlled Substance Forms (CSF Suite)</h2>
            <p className="text-[11px] leading-relaxed text-slate-600">
              Explore sandbox flows for different customer types like hospitals, facilities, practitioners, EMS, and
              researchers. Each sandbox calls a CSF decision engine and a CSF Form Copilot backed by RAG.
            </p>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-[11px] text-slate-700">
            <li>Evaluate CSF requests (`/csf/{type}/evaluate`).</li>
            <li>See explainable decisions via CSF Copilot.</li>
            <li>Use example payloads to simulate real orders.</li>
          </ul>
          <p>
            <Link to="/csf" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
              Open CSF Suite →
            </Link>
          </p>
        </div>

        <div className="console-card space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-slate-900">License Compliance (License Suite)</h2>
            <p className="text-[11px] leading-relaxed text-slate-600">
              Test license decision flows starting with Ohio TDDD (Terminal Distributor of Dangerous Drugs). Evaluate
              requests and run the License Copilot for explainable outcomes.
            </p>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-[11px] text-slate-700">
            <li>Evaluate Ohio TDDD licenses.</li>
            <li>Use RAG explanations grounded in ohio_tddd_rules.</li>
            <li>Extendable to new license types (e.g., NY Pharmacy, DEA).</li>
          </ul>
          <p>
            <Link to="/license" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
              Open License Suite →
            </Link>
          </p>
        </div>
      </section>

      <section className="console-section console-section-order space-y-3 rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-slate-900">End-to-End Order Journey – Ohio Hospital</h2>
          <p className="text-[11px] leading-relaxed text-slate-600">
            This journey combines Hospital CSF decisions and Ohio TDDD license decisions into a single mock order
            approval. Use the buttons to run:
          </p>
        </div>
        <ul className="list-disc space-y-1 pl-5 text-[11px] text-slate-700">
          <li>Happy path – CSF OK, TDDD OK → final decision ok_to_ship.</li>
          <li>Negative path – CSF OK, TDDD missing → final decision not ok_to_ship.</li>
          <li>Non-Ohio hospital – CSF only, no TDDD → final decision ok_to_ship.</li>
        </ul>
        <p className="text-[11px] leading-relaxed text-slate-600">
          Enable the developer trace to see the exact JSON request and response used for each run.
        </p>

        <OhioHospitalOrderJourneyCard />
      </section>

      <section className="console-section console-section-legend rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
        <DecisionStatusLegend />
      </section>

      <section className="console-section console-section-docs space-y-2 rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
        <h2 className="text-sm font-semibold text-slate-900">Docs, repo, and how to run this</h2>
        <p className="mt-1 text-sm text-slate-600">
          Use these links when you want to dive deeper into the architecture, show the code, or run the demo locally.
        </p>
        <div className="mt-3">
          <DocsLinksCard />
        </div>
      </section>
    </div>
  );
}

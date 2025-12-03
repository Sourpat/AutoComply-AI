import React from "react";
import { Link } from "react-router-dom";

import { OhioHospitalOrderJourneyCard } from "../components/OhioHospitalOrderJourneyCard";
import { DecisionStatusLegend } from "../components/DecisionStatusLegend";
import { SystemStatusCard } from "../components/SystemStatusCard";
import { DocsLinksCard } from "../components/DocsLinksCard";

const CSF_CONSOLE_CARDS = [
  {
    id: "hospital",
    title: "Hospital CSF",
    subtitle: "Primary CSF engine for inpatient pharmacies and IDNs.",
    bullets: [
      (
        <>
          • Sandbox: <code>/csf/hospital/evaluate</code> and <code>/csf/hospital/form-copilot</code>.
        </>
      ),
      "• Shows ok_to_ship, needs_review, or blocked with explainability.",
      "• Uses hospital-specific payloads and RAG doc.",
    ],
    link: "/csf/hospital",
  },
  {
    id: "facility",
    title: "Facility CSF",
    subtitle:
      "Mirrors the Hospital CSF engine but with a facility-specific form payload and UI sandbox.",
    bullets: [
      (
        <>
          • Sandbox: <code>/csf/facility/evaluate</code> and <code>/csf/facility/form-copilot</code>.
        </>
      ),
      "• Uses the same underlying regulatory document as Hospital CSF (for now), but all user-facing text refers to “Facility CSF”.",
      "• Helps show how the pattern scales to new facility types without rewriting the core engine.",
    ],
    link: "/csf/facility",
  },
  {
    id: "practitioner",
    title: "Practitioner CSF",
    subtitle: "Outpatient and prescriber-focused CSF sandbox with addendums.",
    bullets: [
      (
        <>
          • Sandbox: <code>/csf/practitioner/evaluate</code> and <code>/csf/practitioner/form-copilot</code>.
        </>
      ),
      "• Mirrors hospital decision outputs for practitioner workflows.",
      "• Useful for clinics and office-based prescribers.",
    ],
    link: "/csf/practitioner",
  },
  {
    id: "ems",
    title: "EMS CSF",
    subtitle: "EMS-specific payloads and traceability for transport teams.",
    bullets: [
      (
        <>
          • Sandbox: <code>/csf/ems/evaluate</code> and <code>/csf/ems/form-copilot</code>.
        </>
      ),
      "• RAG explanations tuned for emergency services documentation.",
      "• Demonstrates CSF portability to EMS journeys.",
    ],
    link: "/csf/ems",
  },
  {
    id: "researcher",
    title: "Researcher CSF",
    subtitle: "Lab and R&D-oriented CSF sandbox for controlled substances.",
    bullets: [
      (
        <>
          • Sandbox: <code>/csf/researcher/evaluate</code> and <code>/csf/researcher/form-copilot</code>.
        </>
      ),
      "• Shares CSF decisioning contract with research-specific payloads.",
      "• Useful for demoing CSF across regulated research settings.",
    ],
    link: "/csf/researcher",
  },
];

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
          <div className="console-csf-grid grid gap-3 md:grid-cols-2">
            {CSF_CONSOLE_CARDS.map((card) => (
              <div
                key={card.id}
                className="console-csf-card space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
              >
                <h3 className="text-[13px] font-semibold text-slate-900">{card.title}</h3>
                <p className="console-csf-card-subtitle text-[11px] leading-relaxed text-slate-600">
                  {card.subtitle}
                </p>
                <ul className="console-csf-card-bullets space-y-1 text-[11px] leading-relaxed text-slate-700">
                  {card.bullets.map((bullet, idx) => (
                    <li key={idx}>{bullet}</li>
                  ))}
                </ul>
                <Link to={card.link} className="console-link text-[11px] font-semibold text-sky-600 hover:text-sky-700">
                  Open {card.title} →
                </Link>
              </div>
            ))}
          </div>
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

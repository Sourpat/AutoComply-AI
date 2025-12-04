import React from "react";
import { Link } from "react-router-dom";

import { OhioHospitalOrderJourneyCard } from "../components/OhioHospitalOrderJourneyCard";
import { MockOrderSeverityLegend } from "../components/MockOrderSeverityLegend";
import { DecisionStatusLegend } from "../components/DecisionStatusLegend";
import { SystemStatusCard } from "../components/SystemStatusCard";
import { DocsLinksCard } from "../components/DocsLinksCard";
import { ApiReferenceCard } from "../components/ApiReferenceCard";
import { RagOverviewCard } from "../components/RagOverviewCard";
import { TestingReliabilityCard } from "../components/TestingReliabilityCard";
import { SystemHealthCard } from "../components/SystemHealthCard";
import { RunLocallyCard } from "../components/RunLocallyCard";
import { LicenseEnginesSandbox } from "../components/LicenseEnginesSandbox";
import { ConsoleTourCard } from "../components/ConsoleTourCard";
import { IntegrationsCard } from "../components/IntegrationsCard";
import { FutureWorkCard } from "../components/FutureWorkCard";
import { RagDebugProvider, useRagDebug } from "../devsupport/RagDebugContext";
import { MockOrderCards } from "../components/MockOrderCards";
import { RegulatoryPreviewPanel } from "../features/rag/RegulatoryPreviewPanel";

type ApiReferenceCardConfig = React.ComponentProps<typeof ApiReferenceCard> & {
  id: string;
};

const API_REFERENCE_CARDS: ApiReferenceCardConfig[] = [
  {
    id: "csf-hospital-eval",
    groupLabel: "CSF engine",
    title: "Hospital CSF evaluation",
    summary:
      "Evaluates a hospital controlled substance form and normalizes the result to ok_to_ship, needs_review, or blocked.",
    method: "POST",
    path: "/csf/hospital/evaluate",
    curlSnippet: `curl -X POST http://localhost:8000/csf/hospital/evaluate \\\n  -H "Content-Type: application/json" \\\n  -d '{
  "hospital_name": "Riverside General Hospital",
  "account_number": "ACCT-123456",
  "ship_to_state": "OH",
  "attestation_accepted": true
}'`,
    requestJson: {
      hospital_name: "Riverside General Hospital",
      account_number: "ACCT-123456",
      ship_to_state: "OH",
      attestation_accepted: true,
    },
    responseJson: {
      status: "ok_to_ship",
      reason: "Hospital CSF is valid for Ohio; all required fields were provided.",
      regulatory_references: ["csf_hospital_form"],
    },
  },
  {
    id: "csf-facility-eval",
    groupLabel: "CSF engine",
    title: "Facility CSF evaluation",
    summary:
      "Evaluates facility-level controlled substance forms and outputs ok_to_ship, needs_review, or blocked decisions.",
    method: "POST",
    path: "/csf/facility/evaluate",
    curlSnippet: `curl -X POST http://localhost:8000/csf/facility/evaluate \\\n  -H "Content-Type: application/json" \\\n  -d '{
  "facility_name": "SummitCare Clinics – East Region",
  "account_number": "FAC-445210",
  "ship_to_state": "OH",
  "attestation_accepted": true
}'`,
    requestJson: {
      facility_name: "SummitCare Clinics – East Region",
      account_number: "FAC-445210",
      ship_to_state: "OH",
      attestation_accepted: true,
    },
    responseJson: {
      status: "ok_to_ship",
      reason: "Facility CSF is valid for Ohio; all required fields were provided.",
      regulatory_references: ["csf_facility_form"],
    },
  },
  {
    id: "csf-facility-copilot",
    groupLabel: "CSF engine",
    title: "Facility CSF – form copilot",
    summary:
      "Returns a human-friendly explanation of the Facility CSF decision, plus any missing or corrective fields.",
    method: "POST",
    path: "/csf/facility/form-copilot",
    curlSnippet: `curl -X POST http://localhost:8000/csf/facility/form-copilot \\\n  -H "Content-Type: application/json" \\\n  -d '{
  "facility_name": "SummitCare Clinics – East Region",
  "account_number": "FAC-445210",
  "ship_to_state": "OH",
  "attestation_accepted": false
}'`,
    requestJson: {
      facility_name: "SummitCare Clinics – East Region",
      account_number: "FAC-445210",
      ship_to_state: "OH",
      attestation_accepted: false,
    },
    responseJson: {
      explanation:
        "Facility CSF needs attestation before approval. Provide the missing attestation and resubmit for ok_to_ship.",
      missing_fields: ["attestation_accepted"],
      regulatory_references: ["csf_facility_form"],
    },
  },
  {
    id: "csf-practitioner-eval",
    groupLabel: "CSF engine",
    title: "Practitioner CSF evaluation",
    summary:
      "Evaluates a prescriber’s controlled substance form in the practitioner sandbox with the same normalized decision set.",
    method: "POST",
    path: "/csf/practitioner/evaluate",
    curlSnippet: `curl -X POST http://localhost:8000/csf/practitioner/evaluate \\\n  -H "Content-Type: application/json" \\\n  -d '{
  "practitioner_name": "Dr. Jamie Patel",
  "npi": "1987654321",
  "ship_to_state": "OH",
  "attestation_accepted": true
}'`,
    requestJson: {
      practitioner_name: "Dr. Jamie Patel",
      npi: "1987654321",
      ship_to_state: "OH",
      attestation_accepted: true,
    },
    responseJson: {
      status: "ok_to_ship",
      reason: "Practitioner CSF is valid for Ohio; no missing fields detected.",
      regulatory_references: ["csf_practitioner_form"],
    },
  },
  {
    id: "csf-practitioner-copilot",
    groupLabel: "CSF engine",
    title: "Practitioner CSF – form copilot",
    summary:
      "Explains practitioner CSF decisions with missing fields and regulatory references for prescriber-focused workflows.",
    method: "POST",
    path: "/csf/practitioner/form-copilot",
    curlSnippet: `curl -X POST http://localhost:8000/csf/practitioner/form-copilot \\\n  -H "Content-Type: application/json" \\\n  -d '{
  "practitioner_name": "Dr. Jamie Patel",
  "npi": "1987654321",
  "ship_to_state": "OH",
  "attestation_accepted": false
}'`,
    requestJson: {
      practitioner_name: "Dr. Jamie Patel",
      npi: "1987654321",
      ship_to_state: "OH",
      attestation_accepted: false,
    },
    responseJson: {
      explanation:
        "Practitioner CSF requires attestation acceptance. Add attestation_accepted: true to complete the submission.",
      missing_fields: ["attestation_accepted"],
      regulatory_references: ["csf_practitioner_form"],
    },
  },
  {
    id: "license-ohio-tddd",
    groupLabel: "License engine",
    title: "Ohio TDDD license evaluation",
    summary:
      "Checks an Ohio TDDD license and decides whether this account is allowed to receive controlled substances in Ohio.",
    method: "POST",
    path: "/license/ohio-tddd/evaluate",
    curlSnippet: `curl -X POST http://localhost:8000/license/ohio-tddd/evaluate \\\n  -H "Content-Type: application/json" \\\n  -d '{
  "account_number": "ACCT-445210",
  "tddd_number": "TDDD-1234567",
  "ship_to_state": "OH"
}'`,
    requestJson: {
      account_number: "ACCT-445210",
      tddd_number: "TDDD-1234567",
      ship_to_state: "OH",
    },
    responseJson: {
      status: "ok_to_ship",
      reason: "Ohio TDDD license is active and valid for this ship-to location.",
    },
  },
  {
    id: "license-ny-pharmacy",
    groupLabel: "License engine",
    title: "NY pharmacy license evaluation",
    summary:
      "Evaluates pharmacy licensing for New York scenarios in the NY sandbox, including DEA and state license checks.",
    method: "POST",
    path: "/license/ny-pharmacy/evaluate",
    curlSnippet: `curl -X POST http://localhost:8000/license/ny-pharmacy/evaluate \\\n  -H "Content-Type: application/json" \\\n  -d '{
  "pharmacy_name": "Hudson Pharmacy",
  "account_number": "ACCT-889910",
  "ship_to_state": "NY",
  "dea_number": "FD1234567",
  "ny_state_license_number": "NY-7654321",
  "attestation_accepted": true,
  "internal_notes": "Demo request"
}'`,
    requestJson: {
      pharmacy_name: "Hudson Pharmacy",
      account_number: "ACCT-889910",
      ship_to_state: "NY",
      dea_number: "FD1234567",
      ny_state_license_number: "NY-7654321",
      attestation_accepted: true,
      internal_notes: "Demo request",
    },
    responseJson: {
      status: "license_active",
      reason: "NY pharmacy license and DEA number are valid for this order.",
    },
  },
  {
    id: "mock-ohio-hospital",
    groupLabel: "Mock order",
    title: "Ohio hospital mock order decision",
    summary:
      "Combines Hospital CSF + Ohio TDDD outputs into one mock order decision for demo purposes.",
    method: "POST",
    path: "/orders/mock/ohio-hospital-approval",
    curlSnippet: `curl -X POST http://localhost:8000/orders/mock/ohio-hospital-approval \\\n  -H "Content-Type: application/json" \\\n  -d '{
  "csf_decision": "ok_to_ship",
  "license_decision": "ok_to_ship"
}'`,
    requestJson: {
      csf_decision: "ok_to_ship",
      license_decision: "ok_to_ship",
    },
    responseJson: {
      final_decision: "ok_to_ship",
      explanation: "Both CSF and Ohio TDDD license are satisfied, so the mock order is approved.",
    },
  },
  {
    id: "mock-ohio-facility",
    groupLabel: "Mock order",
    title: "Ohio facility mock order decision",
    summary:
      "Combines Facility CSF + Ohio TDDD license into a mock order decision for facilities.",
    method: "POST",
    path: "/orders/mock/ohio-facility-approval",
    curlSnippet: `curl -X POST http://localhost:8000/orders/mock/ohio-facility-approval \\\n  -H "Content-Type: application/json" \\\n  -d '{
  "csf_decision": "ok_to_ship",
  "license_decision": "ok_to_ship"
}'`,
    requestJson: {
      csf_decision: "ok_to_ship",
      license_decision: "ok_to_ship",
    },
    responseJson: {
      final_decision: "ok_to_ship",
      explanation: "Facility CSF and Ohio TDDD license are satisfied, so the mock order is approved.",
    },
  },
  {
    id: "mock-ny-pharmacy",
    groupLabel: "Mock order",
    title: "NY pharmacy mock order decision",
    summary:
      "Combines NY license engine outputs into a single mock order decision.",
    method: "POST",
    path: "/orders/mock/ny-pharmacy-approval",
    curlSnippet: `curl -X POST http://localhost:8000/orders/mock/ny-pharmacy-approval \\\n  -H "Content-Type: application/json" \\\n  -d '{
  "license_decision": "license_active"
}'`,
    requestJson: {
      license_decision: "license_active",
    },
    responseJson: {
      final_decision: "ok_to_ship",
      explanation: "NY pharmacy license is active for this order, so the mock order is approved.",
    },
  },
];

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

function ComplianceConsolePageInner() {
  const { enabled, setEnabled } = useRagDebug();

  return (
    <div className="compliance-console-page space-y-8 py-6">
      <header className="space-y-3 rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              AutoComply AI – Compliance Console
            </h1>
            <p className="text-[11px] leading-relaxed text-slate-600">
              A single view of how AutoComply AI evaluates controlled substance forms, state licenses,
              and end-to-end order approvals.
            </p>
          </div>
          <div className="mt-2 flex items-center gap-2 md:mt-0">
            <span className="text-[11px] text-slate-400">AI / RAG debug</span>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full border text-[10px] ${
                enabled
                  ? "border-emerald-400 bg-emerald-500/30"
                  : "border-slate-600 bg-slate-900"
              }`}
              aria-pressed={enabled}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  enabled ? "translate-x-4" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </header>

      <ConsoleTourCard />

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

      <LicenseEnginesSandbox />

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

        <MockOrderSeverityLegend />

        <OhioHospitalOrderJourneyCard />
      </section>

      <section className="console-section console-section-order space-y-3 rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-slate-900">Mock order scenarios</h2>
          <p className="text-[11px] leading-relaxed text-slate-600">
            Click into pre-baked mock order decisions, including the new Ohio hospital Schedule II scenarios for valid and expired TDDD licenses.
          </p>
        </div>

        <MockOrderSeverityLegend />

        <MockOrderCards />
      </section>

      <section className="console-section console-section-api">
        <h2 className="text-lg font-semibold text-white md:text-xl">API reference (quick view)</h2>
        <p className="mt-1 text-sm text-slate-300">
          These are the main endpoints behind the CSF, license, and order journeys. Use them when you want to talk about the system
          as an API, not just a UI.
        </p>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {API_REFERENCE_CARDS.map((card) => (
            <ApiReferenceCard key={card.id} {...card} />
          ))}
        </div>
      </section>

      <section className="console-section console-section-rag">
        <div className="grid gap-3 lg:grid-cols-2">
          <RagOverviewCard />
          <RegulatoryPreviewPanel />
        </div>
      </section>

      <section className="console-section console-section-health">
        <SystemHealthCard />
      </section>

      <section className="console-section console-section-testing">
        <TestingReliabilityCard />
      </section>

      <IntegrationsCard />
      <FutureWorkCard />

      <section className="console-section console-section-run-locally">
        <RunLocallyCard />
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

export function ComplianceConsolePage() {
  return (
    <RagDebugProvider>
      <ComplianceConsolePageInner />
    </RagDebugProvider>
  );
}

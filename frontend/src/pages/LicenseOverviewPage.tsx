import React, { useEffect } from "react";

import { CsfSuiteCard } from "../components/CsfSuiteCard";
import { OhioHospitalOrderJourneyCard } from "../components/OhioHospitalOrderJourneyCard";
import { trackSandboxEvent } from "../devsupport/telemetry";

export function LicenseOverviewPage() {
  useEffect(() => {
    trackSandboxEvent("license_overview_page_view", {
      engine_family: "license",
      sandbox: "overview",
    });
  }, []);

  return (
    <div className="license-overview-page space-y-6 py-6">
      {/* Page Header */}
      <header className="license-overview-header space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          License Compliance – AutoComply AI Playground
        </h1>
        
        {/* Intro Narrative - Two Column Layout */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Modular Compliance Engines</h2>
            <p className="text-sm leading-relaxed text-slate-700">
              AutoComply AI uses independent compliance engines that can run individually or be composed 
              into complex workflows. Each engine validates specific requirements (CSF forms, state licenses, 
              controlled substance rules) and returns structured decisions with regulatory evidence.
            </p>
            <p className="text-sm leading-relaxed text-slate-700">
              This modular approach lets you test each engine separately to understand its logic, then see 
              how multiple engines combine to produce a final order decision.
            </p>
          </div>
          
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
            <h3 className="text-xs font-semibold text-blue-900 uppercase tracking-wide mb-3">
              How it works
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white text-xs font-bold flex-shrink-0">
                  1
                </div>
                <div>
                  <p className="text-xs font-medium text-blue-900">Test individual engines</p>
                  <p className="text-[11px] text-blue-700">Validate licenses, CSF forms, or controlled substances independently</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white text-xs font-bold flex-shrink-0">
                  2
                </div>
                <div>
                  <p className="text-xs font-medium text-blue-900">Compose into workflows</p>
                  <p className="text-[11px] text-blue-700">Combine engines for end-to-end order approval</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white text-xs font-bold flex-shrink-0">
                  3
                </div>
                <div>
                  <p className="text-xs font-medium text-blue-900">Review decisions</p>
                  <p className="text-[11px] text-blue-700">See structured outcomes with regulatory citations</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Individual Compliance Engines Section */}
      <section className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">Individual Compliance Engines</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Each engine focuses on a specific compliance domain. Use these sandboxes to understand 
            how individual rules are evaluated before they're combined in order workflows.
          </p>
        </div>

        <div className="license-overview-grid grid gap-4 md:grid-cols-2">
          <CsfSuiteCard
            title="Ohio TDDD License Sandbox"
            subtitle="State-specific license validation for Ohio Terminal Distributor of Dangerous Drugs"
            bullets={[
              "What it validates: TDDD license number, status (active/expired), and ship-to state restrictions",
              "Decision outcomes: ok_to_ship (valid license), needs_review (expiring soon), blocked (invalid/expired)",
              "Where it's reused: Ohio Hospital Order Journey, Hospital CSF workflows requiring Ohio compliance",
            ]}
            to="/license/ohio-tddd"
          />

          <CsfSuiteCard
            title="NY Pharmacy License Sandbox"
            subtitle="New York pharmacy license verification and status classification"
            bullets={[
              "What it validates: NY pharmacy license number, registration status, and eligibility to receive controlled substances",
              "Decision outcomes: ok_to_ship (compliant), needs_review (pending renewal), blocked (suspended/revoked)",
              "Where it's reused: NY Pharmacy Order Journey, multi-state license aggregation workflows",
            ]}
            to="/license/ny-pharmacy"
          />
        </div>
      </section>

      {/* Conceptual Bridge - Orchestration Section */}
      <section className="rounded-lg border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-white p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-white flex-shrink-0">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">Putting it all together</h2>
            <p className="text-sm text-slate-700 leading-relaxed">
              Individual engines are powerful, but the real value comes from orchestration. The Order Journey 
              below combines <span className="font-semibold text-blue-900">Hospital CSF validation</span> with{" "}
              <span className="font-semibold text-blue-900">Ohio TDDD license checks</span> to produce a 
              single, actionable decision: Can this order ship, does it need review, or is it blocked?
            </p>
            <p className="text-sm text-slate-700 leading-relaxed">
              This demonstrates how AutoComply AI handles complex, multi-engine compliance scenarios that 
              mirror real-world pharmaceutical workflows.
            </p>
          </div>
        </div>
      </section>

      {/* End-to-End Order Journey */}
      <section className="license-section license-section--order-journey space-y-3 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm">
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-slate-900">
            End-to-End Order Journey: Ohio Hospital Schedule II
          </h2>
          <p className="text-sm leading-relaxed text-slate-600">
            Simulates a complete order approval workflow for an Ohio hospital ordering Schedule II controlled 
            substances. This combines Hospital CSF compliance with Ohio TDDD license validation to demonstrate 
            how multiple engines produce a unified decision with full regulatory traceability.
          </p>
        </div>

        <OhioHospitalOrderJourneyCard />
      </section>

      {/* What This Demonstrates Section */}
      <section className="rounded-lg border border-slate-300 bg-slate-50 p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">What this demonstrates</h2>
        <ul className="space-y-3">
          <li className="flex items-start gap-3">
            <span className="text-emerald-600 text-lg flex-shrink-0">✓</span>
            <div>
              <p className="text-sm font-medium text-slate-900">Modular, reusable compliance engines</p>
              <p className="text-xs text-slate-600 leading-relaxed">
                Each engine (CSF, TDDD, NY Pharmacy) can run independently or be composed into complex 
                workflows, making it easy to add new regulations without rebuilding existing logic.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-emerald-600 text-lg flex-shrink-0">✓</span>
            <div>
              <p className="text-sm font-medium text-slate-900">Structured decision outcomes with regulatory evidence</p>
              <p className="text-xs text-slate-600 leading-relaxed">
                Every decision includes a status (ok_to_ship, needs_review, blocked), rationale, and 
                citations to specific regulations, enabling audit trails and compliance documentation.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-emerald-600 text-lg flex-shrink-0">✓</span>
            <div>
              <p className="text-sm font-medium text-slate-900">Real-world orchestration patterns</p>
              <p className="text-xs text-slate-600 leading-relaxed">
                The Ohio Hospital Order Journey shows how CSF form validation and state license checks 
                combine to produce a final order decision, mirroring actual pharmaceutical distribution workflows.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-emerald-600 text-lg flex-shrink-0">✓</span>
            <div>
              <p className="text-sm font-medium text-slate-900">Explainable AI with RAG-powered compliance reasoning</p>
              <p className="text-xs text-slate-600 leading-relaxed">
                License engines use RAG (Retrieval-Augmented Generation) to ground decisions in actual 
                state regulations, providing transparency and reducing manual compliance review time.
              </p>
            </div>
          </li>
        </ul>
      </section>
    </div>
  );
}

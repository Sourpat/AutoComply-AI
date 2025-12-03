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

      <div className="license-overview-grid grid gap-4 md:grid-cols-2">
        <CsfSuiteCard
          title="Ohio TDDD License Sandbox"
          subtitle="Evaluate Ohio Terminal Distributor of Dangerous Drugs licenses and see exactly when an account is ok_to_ship, needs_review, or blocked."
          bullets={[
            "Calls /license/ohio-tddd/evaluate to validate TDDD number, status, and ship-to state.",
            "Plugs into the Ohio Hospital mock order approval journey for end-to-end demos.",
            "Shows how state-specific license rules can live in their own engine but share the same decision model.",
          ]}
          to="/license/ohio-tddd"
        />

        <CsfSuiteCard
          title="NY Pharmacy License Sandbox"
          subtitle="Run New York pharmacy license checks and understand how license status drives downstream order decisions."
          bullets={[
            "Uses /license/ny-pharmacy/evaluate to classify license status for NY pharmacies.",
            "Feeds the NY license-only mock order endpoint at /orders/mock/ny-pharmacy-approval.",
            "Perfect for explaining how adding a new license engine follows the same pattern as Ohio TDDD.",
          ]}
          to="/license/ny-pharmacy"
        />
      </div>

      <section className="license-section license-section--order-journey space-y-3 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm">
        <h2 className="text-sm font-semibold text-slate-900">
          End-to-End Order Journey (Ohio Hospital)
        </h2>
        <p className="text-[11px] leading-relaxed text-slate-600">
          This card runs a full mock approval using the Hospital CSF engine and the Ohio TDDD
          license engine together. Use it to quickly see how AutoComply AI would treat a real Ohio
          hospital Schedule II order.
        </p>

        <OhioHospitalOrderJourneyCard />
      </section>
    </div>
  );
}

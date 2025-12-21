import React, { useState } from "react";
import {
  OrderScenarioKind,
  runOhioHospitalOrderScenario,
  OhioHospitalOrderScenarioRun,
} from "../api/orderMockApprovalClient";
import { OhioHospitalOrderApprovalResult } from "../domain/orderMockApproval";
import { trackSandboxEvent } from "../devsupport/telemetry";
import { copyToClipboard } from "../utils/clipboard";
import { buildCurlCommand } from "../utils/curl";
import type { DecisionOutcome, DecisionStatus } from "../types/decision";
import { VerticalBadge } from "./VerticalBadge";

type OhioJourneyScenarioId = OrderScenarioKind;

const OHIO_HOSPITAL_VERTICAL_LABEL = "Ohio Hospital vertical";

const OHIO_JOURNEY_SCENARIOS: {
  id: OhioJourneyScenarioId;
  label: string;
  shortLabel: string;
  expectedOutcome: string;
  description: string;
}[] = [
  {
    id: "happy_path",
    label: "Compliant CSF + Valid TDDD",
    shortLabel: "Happy Path",
    expectedOutcome: "OK to ship",
    description:
      "Ohio hospital with valid CSF and valid Ohio TDDD license. Expected final decision: OK to ship.",
  },
  {
    id: "missing_tddd",
    label: "Valid CSF + Missing TDDD",
    shortLabel: "Missing License",
    expectedOutcome: "Needs review or blocked",
    description:
      "Ohio hospital with valid CSF but missing/invalid TDDD number. Expected final decision: Needs review or blocked.",
  },
  {
    id: "non_ohio_no_tddd",
    label: "Non-Ohio Hospital (CSF Only)",
    shortLabel: "Out of State",
    expectedOutcome: "OK to ship",
    description:
      "Non-Ohio hospital with valid CSF. No TDDD required for out-of-state shipments. Expected final decision: OK to ship.",
  },
];

// Helper functions
const getStatusColor = (status: string | undefined) => {
  if (status === "ok_to_ship") return "bg-emerald-100 text-emerald-900 border border-emerald-300";
  if (status === "blocked") return "bg-red-100 text-red-900 border border-red-300";
  return "bg-amber-100 text-amber-900 border border-amber-300";
};

const getStatusLabel = (status: string | undefined) => {
  if (status === "ok_to_ship") return "OK to Ship";
  if (status === "blocked") return "Blocked";
  if (status === "needs_review") return "Needs Review";
  return status || "Unknown";
};

const getStatusMeaning = (status: string | undefined) => {
  if (status === "ok_to_ship") return "Order can proceed without manual review.";
  if (status === "blocked") return "Order cannot proceed until issues are fixed.";
  if (status === "needs_review") return "Order requires compliance review before shipment.";
  return "Status unknown.";
};

const getNextAction = (status: string | undefined) => {
  if (status === "ok_to_ship") return "Proceed to fulfillment";
  if (status === "blocked") return "Fix missing/invalid information then re-run";
  if (status === "needs_review") return "Submit to verification team";
  return "Review decision details";
};

export function OhioHospitalOrderJourneyCard() {
  const [result, setResult] = useState<OhioHospitalOrderApprovalResult | null>(null);
  const [loading, setLoading] = useState<null | OrderScenarioKind>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDevTrace, setShowDevTrace] = useState(false);
  const [lastRun, setLastRun] = useState<OhioHospitalOrderScenarioRun | null>(null);
  const [traceCopyMessage, setTraceCopyMessage] = useState<string | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState<OhioJourneyScenarioId>("happy_path");
  const [showUnderHood, setShowUnderHood] = useState(false);

  const activeScenario = OHIO_JOURNEY_SCENARIOS.find((s) => s.id === selectedScenarioId) ?? null;

  async function runScenario(kind: OrderScenarioKind) {
    setLoading(kind);
    setError(null);
    setResult(null);

    trackSandboxEvent("order_mock_ohio_hospital_run", {
      scenario: kind,
      engine_family: "order",
      journey: "ohio_hospital_schedule_ii",
    });

    try {
      const run = await runOhioHospitalOrderScenario(kind);
      setLastRun(run);
      setResult(run.response);

      trackSandboxEvent("order_mock_ohio_hospital_success", {
        scenario: kind,
        engine_family: "order",
        journey: "ohio_hospital_schedule_ii",
        final_decision: run.response.decision?.status,
        csf_status: run.response.csf_decision?.status,
        tddd_status: run.response.license_decision?.status,
      });
    } catch (err: any) {
      const message = err?.message ?? "Mock order journey failed. Please check the backend and try again.";
      setError(message);

      trackSandboxEvent("order_mock_ohio_hospital_error", {
        scenario: kind,
        engine_family: "order",
        journey: "ohio_hospital_schedule_ii",
        error: String(err),
      });
    } finally {
      setLoading(null);
    }
  }

  function runScenarioFromChip(id: OhioJourneyScenarioId) {
    setSelectedScenarioId(id);
    runScenario(id);
  }

  async function handleCopyJson(data: any, label: string) {
    const json = JSON.stringify(data, null, 2);
    const ok = await copyToClipboard(json);
    setTraceCopyMessage(ok ? `${label} copied to clipboard.` : `Unable to copy ${label}.`);
    setTimeout(() => setTraceCopyMessage(null), 2000);
  }

  const finalDecision = result?.decision;
  const csfDecision = result?.csf_decision;
  const licenseDecision = result?.license_decision;

  const missingFields = (decision?: DecisionOutcome) => 
    (decision as any)?.missing_fields ?? (decision as any)?.missingFields ?? [];

  return (
    <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      {/* Page Header */}
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900">
              End-to-End Order Journey
            </h2>
            <VerticalBadge label={OHIO_HOSPITAL_VERTICAL_LABEL} />
          </div>
          <button
            type="button"
            onClick={() => setShowUnderHood(!showUnderHood)}
            className="text-xs text-slate-500 hover:text-slate-700 underline"
          >
            {showUnderHood ? "Hide" : "Show"} technical details
          </button>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          Simulates an Ohio hospital controlled substance order that combines Hospital CSF compliance 
          and Ohio TDDD license validation into a single approval decision.
        </p>
      </header>

      {/* How This Page Works */}
      <section className="rounded-lg border border-blue-100 bg-blue-50 p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-3">How this page works</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white font-bold text-sm flex-shrink-0">
              1
            </div>
            <div>
              <p className="text-sm font-medium text-blue-900">Pick a scenario</p>
              <p className="text-xs text-blue-700">Select from predefined test cases below</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white font-bold text-sm flex-shrink-0">
              2
            </div>
            <div>
              <p className="text-sm font-medium text-blue-900">Run engines</p>
              <p className="text-xs text-blue-700">Hospital CSF + Ohio TDDD evaluate automatically</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white font-bold text-sm flex-shrink-0">
              3
            </div>
            <div>
              <p className="text-sm font-medium text-blue-900">Review decision</p>
              <p className="text-xs text-blue-700">See final result and recommended action</p>
            </div>
          </div>
        </div>
      </section>

      {/* Scenario Selection */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Select scenario</h3>
        <div className="grid gap-3 md:grid-cols-3">
          {OHIO_JOURNEY_SCENARIOS.map((scenario) => {
            const isActive = scenario.id === selectedScenarioId;
            return (
              <button
                key={scenario.id}
                type="button"
                onClick={() => runScenarioFromChip(scenario.id)}
                disabled={loading !== null}
                aria-pressed={isActive}
                className={[
                  "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50",
                  isActive
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                    : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50",
                ].join(" ")}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={[
                    "text-xs font-semibold",
                    isActive ? "text-blue-900" : "text-slate-900"
                  ].join(" ")}>
                    {scenario.shortLabel}
                  </span>
                  {scenario.badge && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-700">
                      {scenario.badge}
                    </span>
                  )}
                </div>
                <p className={[
                  "text-xs",
                  isActive ? "text-blue-700" : "text-slate-600"
                ].join(" ")}>
                  {scenario.label}
                </p>
                <p className={[
                  "text-[10px] leading-relaxed",
                  isActive ? "text-blue-600" : "text-slate-500"
                ].join(" ")}>
                  Expected: {scenario.expectedOutcome}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {error && (
        <section className="rounded-lg bg-red-50 border border-red-200 p-4">
          <div className="flex items-start gap-3">
            <span className="text-red-700 text-lg">⚠</span>
            <div className="flex-1 space-y-2">
              <p className="text-sm font-semibold text-red-900">Error running order journey</p>
              <p className="text-sm text-red-700">{error}</p>
              {error.includes('Validation failed') && (
                <details className="mt-2">
                  <summary className="text-xs text-red-600 cursor-pointer hover:text-red-800 underline">
                    Show validation details
                  </summary>
                  <pre className="mt-2 text-[10px] text-red-800 bg-red-100 p-2 rounded overflow-x-auto max-h-48">
                    {error}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </section>
      )}

      {result && finalDecision && (
        <>
          {/* Final Decision Panel - Most Important */}
          <section className="rounded-lg border-2 border-slate-300 bg-white p-5 shadow-md">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">Final Decision</h3>
                <div className={[
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold",
                  getStatusColor(finalDecision.status)
                ].join(" ")}>
                  <span className="text-lg">●</span>
                  <span>{getStatusLabel(finalDecision.status)}</span>
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
                    What this means
                  </p>
                  <p className="text-sm text-slate-900 leading-relaxed">
                    {getStatusMeaning(finalDecision.status)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
                    Next action
                  </p>
                  <p className="text-sm text-slate-900 leading-relaxed font-medium">
                    {getNextAction(finalDecision.status)}
                  </p>
                </div>

                {finalDecision.rationale && (
                  <div>
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
                      Reason
                    </p>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {finalDecision.rationale}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Decision Rollup Strip */}
          <section className="rounded-lg border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-4">
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
              How the decision was made
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              {csfDecision && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600">Hospital CSF:</span>
                    <span className={[
                      "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold",
                      getStatusColor(csfDecision.status)
                    ].join(" ")}>
                      <span className="text-sm">●</span>
                      {getStatusLabel(csfDecision.status)}
                    </span>
                  </div>
                  <span className="text-slate-400">+</span>
                </>
              )}
              
              {licenseDecision && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600">Ohio TDDD:</span>
                    <span className={[
                      "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold",
                      getStatusColor(licenseDecision.status)
                    ].join(" ")}>
                      <span className="text-sm">●</span>
                      {getStatusLabel(licenseDecision.status)}
                    </span>
                  </div>
                  <span className="text-slate-400">→</span>
                </>
              )}
              
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600 font-bold">Final:</span>
                <span className={[
                  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold",
                  getStatusColor(finalDecision.status)
                ].join(" ")}>
                  <span className="text-sm">●</span>
                  {getStatusLabel(finalDecision.status)}
                </span>
              </div>
            </div>
          </section>

          {/* Engine Decision Cards */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Hospital CSF Card */}
            <section className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900">Hospital CSF Engine</h4>
                {csfDecision && (
                  <span className={[
                    "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold",
                    getStatusColor(csfDecision.status)
                  ].join(" ")}>
                    <span className="text-sm">●</span>
                    {getStatusLabel(csfDecision.status)}
                  </span>
                )}
              </div>

              {csfDecision ? (
                <div className="space-y-3">
                  {csfDecision.rationale && (
                    <div>
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
                        Rationale
                      </p>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {csfDecision.rationale}
                      </p>
                    </div>
                  )}

                  {csfDecision.regulatory_references && csfDecision.regulatory_references.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                        Regulatory Evidence
                      </p>
                      <ul className="space-y-2">
                        {csfDecision.regulatory_references.map((ref: any, idx: number) => (
                          <li key={idx} className="text-xs text-slate-700 pl-3 border-l-2 border-blue-200">
                            {ref.label || ref.citation || ref.id || String(ref)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {missingFields(csfDecision).length > 0 && (
                    <div className="rounded-md bg-amber-50 border border-amber-200 p-2">
                      <p className="text-xs font-semibold text-amber-900 mb-1">
                        Missing fields
                      </p>
                      <p className="text-xs text-amber-700">
                        {missingFields(csfDecision).join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-600 italic">
                  No Hospital CSF evaluation was returned for this scenario.
                </p>
              )}
            </section>

            {/* Ohio TDDD License Card */}
            <section className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900">Ohio TDDD License</h4>
                {licenseDecision && (
                  <span className={[
                    "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold",
                    getStatusColor(licenseDecision.status)
                  ].join(" ")}>
                    <span className="text-sm">●</span>
                    {getStatusLabel(licenseDecision.status)}
                  </span>
                )}
              </div>

              {licenseDecision ? (
                <div className="space-y-3">
                  {licenseDecision.rationale && (
                    <div>
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
                        Rationale
                      </p>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {licenseDecision.rationale}
                      </p>
                    </div>
                  )}

                  {licenseDecision.regulatory_references && licenseDecision.regulatory_references.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                        Regulatory Evidence
                      </p>
                      <ul className="space-y-2">
                        {licenseDecision.regulatory_references.map((ref: any, idx: number) => (
                          <li key={idx} className="text-xs text-slate-700 pl-3 border-l-2 border-blue-200">
                            {ref.label || ref.citation || ref.id || String(ref)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {missingFields(licenseDecision).length > 0 && (
                    <div className="rounded-md bg-amber-50 border border-amber-200 p-2">
                      <p className="text-xs font-semibold text-amber-900 mb-1">
                        Missing fields
                      </p>
                      <p className="text-xs text-amber-700">
                        {missingFields(licenseDecision).join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-600 italic">
                  No Ohio TDDD evaluation was run for this scenario.
                </p>
              )}
            </section>
          </div>

          {/* Notes Section */}
          {result.notes && result.notes.length > 0 && (
            <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
              <h4 className="text-sm font-bold text-slate-900">Additional Notes</h4>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                {result.notes.map((note, idx) => (
                  <li key={idx} className="leading-relaxed">{note}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* Under the Hood - Developer Trace */}
      {showUnderHood && lastRun && (
        <section className="rounded-lg border border-slate-300 bg-slate-50 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Under the Hood</h3>
            <button
              type="button"
              onClick={() => setShowUnderHood(false)}
              className="text-xs text-slate-500 hover:text-slate-700 underline"
            >
              Hide
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleCopyJson(lastRun.request, 'Request JSON')}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              Copy request JSON
            </button>
            <button
              type="button"
              onClick={() => handleCopyJson(lastRun.response, 'Response JSON')}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              Copy response JSON
            </button>
            <button
              type="button"
              onClick={async () => {
                const curl = buildCurlCommand("/orders/mock/ohio-hospital-approval", "POST", lastRun.request);
                const ok = await copyToClipboard(curl);
                setTraceCopyMessage(ok ? "cURL copied to clipboard." : "Unable to copy cURL.");
                setTimeout(() => setTraceCopyMessage(null), 2000);
              }}
              className="inline-flex items-center gap-1 rounded-md bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
            >
              Copy as cURL
            </button>
          </div>

          {traceCopyMessage && (
            <p className="text-xs text-emerald-700 font-medium">{traceCopyMessage}</p>
          )}

          <details className="space-y-2">
            <summary className="cursor-pointer text-xs font-semibold text-slate-700 hover:text-slate-900">
              Request payload
            </summary>
            <pre className="mt-2 overflow-x-auto rounded-md bg-slate-800 p-3 text-[10px] text-slate-100">
              {JSON.stringify(lastRun.request, null, 2)}
            </pre>
          </details>

          <details className="space-y-2">
            <summary className="cursor-pointer text-xs font-semibold text-slate-700 hover:text-slate-900">
              Response payload
            </summary>
            <pre className="mt-2 overflow-x-auto rounded-md bg-slate-800 p-3 text-[10px] text-slate-100">
              {JSON.stringify(lastRun.response, null, 2)}
            </pre>
          </details>
        </section>
      )}
    </div>
  );
}

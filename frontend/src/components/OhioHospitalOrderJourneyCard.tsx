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
import { UnderTheHoodInfo } from "../components/UnderTheHoodInfo";
import { DecisionStatusLegend } from "./DecisionStatusLegend";
import { MockOrderScenarioBadge } from "./MockOrderScenarioBadge";
import { RegulatoryInsightsPanel } from "./RegulatoryInsightsPanel";
import type { DecisionOutcome, RegulatoryReference } from "../types/decision";
import { VerticalBadge } from "./VerticalBadge";

type OhioJourneyScenarioId = OrderScenarioKind;

const OHIO_HOSPITAL_VERTICAL_LABEL = "Ohio Hospital vertical";

const OHIO_JOURNEY_SCENARIOS: {
  id: OhioJourneyScenarioId;
  label: string;
  verticalLabel?: string;
  badge?: string;
  description: string;
}[] = [
  {
    id: "happy_path",
    label: "Ohio Hospital – TDDD vertical demo",
    verticalLabel: OHIO_HOSPITAL_VERTICAL_LABEL,
    badge: "Recommended",
    description:
      "Ohio hospital order using Hospital CSF and Ohio TDDD license to showcase the Ohio Hospital vertical end-to-end.",
  },
  {
    id: "missing_tddd",
    label: "Ohio Hospital – missing TDDD",
    verticalLabel: OHIO_HOSPITAL_VERTICAL_LABEL,
    description:
      "Ohio hospital with valid CSF but no valid TDDD → final decision is not ok_to_ship for the vertical demo.",
  },
  {
    id: "non_ohio_no_tddd",
    label: "Ohio Hospital – non-Ohio (CSF only)",
    verticalLabel: OHIO_HOSPITAL_VERTICAL_LABEL,
    description:
      "Non-Ohio hospital with valid CSF only → final decision ok_to_ship without TDDD for out-of-state vertical validation.",
  },
];

export function OhioHospitalOrderJourneyCard() {
  const [result, setResult] = useState<OhioHospitalOrderApprovalResult | null>(
    null
  );
  const [loading, setLoading] = useState<null | OrderScenarioKind>(null);
  const [error, setError] = useState<string | null>(null);
  const [traceEnabled, setTraceEnabled] = useState(false);
  const [lastRun, setLastRun] = useState<OhioHospitalOrderScenarioRun | null>(
    null
  );
  const [traceCopyMessage, setTraceCopyMessage] = useState<string | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] =
    React.useState<OhioJourneyScenarioId>("happy_path");

  const activeScenario =
    OHIO_JOURNEY_SCENARIOS.find((s) => s.id === selectedScenarioId) ?? null;

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
      const message =
        err?.message ??
        "Mock order journey failed. Please check the backend and try again.";
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

  async function handleCopyRequestCurl() {
    if (!lastRun) return;
    const curl = buildCurlCommand(
      "/orders/mock/ohio-hospital-approval",
      "POST",
      lastRun.request
    );
    const ok = await copyToClipboard(curl);
    setTraceCopyMessage(
      ok ? "Request cURL copied to clipboard." : "Unable to copy cURL."
    );
    setTimeout(() => setTraceCopyMessage(null), 2000);
  }

  async function handleCopyRequestJson() {
    if (!lastRun) return;
    const json = JSON.stringify(lastRun.request, null, 2);
    const ok = await copyToClipboard(json);
    setTraceCopyMessage(
      ok ? "Request JSON copied to clipboard." : "Unable to copy JSON."
    );
    setTimeout(() => setTraceCopyMessage(null), 2000);
  }

  async function handleCopyResponseJson() {
    if (!lastRun) return;
    const json = JSON.stringify(lastRun.response, null, 2);
    const ok = await copyToClipboard(json);
    setTraceCopyMessage(
      ok ? "Response JSON copied to clipboard." : "Unable to copy JSON."
    );
    setTimeout(() => setTraceCopyMessage(null), 2000);
  }

  const missingFromDecision = (
    decision?: Partial<DecisionOutcome> & {
      missing_fields?: string[];
      missingFields?: string[];
    }
  ) => decision?.missing_fields ?? decision?.missingFields ?? [];

  const referencesFromDecision = (
    decision?: Partial<DecisionOutcome>
  ): RegulatoryReference[] => decision?.regulatory_references ?? [];

  const finalDecision = result?.decision;
  const csfDecision = result?.csf_decision;
  const licenseDecision = result?.license_decision;

  return (
    <div className="sandbox-card order-journey-card space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">
              Ohio Hospital Order Journey
            </h3>
            <VerticalBadge label={OHIO_HOSPITAL_VERTICAL_LABEL} />
          </div>
          <UnderTheHoodInfo
            lines={[
              "Calls /csf/hospital/evaluate to decide if the Hospital CSF is ok_to_ship, needs_review, or blocked.",
              "Calls /license/ohio-tddd/evaluate to validate the Ohio TDDD license when the ship-to state is OH.",
              "Combines both decisions via /orders/mock/ohio-hospital-approval to produce the final order decision.",
            ]}
          />
        </div>
        <p className="text-sm text-slate-600">
          Simulates an Ohio hospital order that combines the Hospital CSF
          engine and the Ohio TDDD license engine into a single approval
          decision.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <MockOrderScenarioBadge
            label="Scenario: compliant CSF + valid Ohio TDDD license"
            severity="happy_path"
          />
          <p className="text-[10px] text-slate-500">
            Upstream: Hospital CSF sandbox + Ohio TDDD license engine.
          </p>
        </div>
        <ul className="list-disc space-y-1 pl-5 text-xs text-slate-700">
          <li>Hospital CSF decision</li>
          <li>Ohio TDDD license decision (when applicable)</li>
          <li>Final order-level decision</li>
        </ul>
        <div className="mt-3">
          <p className="text-xs font-medium text-slate-300">Quick scenarios</p>
          <p className="text-[11px] text-slate-400">
            Pick a preset to simulate an Ohio hospital order with different CSF
            and TDDD combinations.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {OHIO_JOURNEY_SCENARIOS.map((scenario) => {
              const isActive = scenario.id === selectedScenarioId;
              return (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => runScenarioFromChip(scenario.id)}
                  disabled={loading !== null}
                  className={[
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
                    isActive
                      ? "border-cyan-400 bg-cyan-500/15 text-cyan-100"
                      : "border-slate-700 bg-slate-900/80 text-slate-200 hover:border-slate-500 hover:bg-slate-800",
                  ].join(" ")}
                >
                  <span>{scenario.label}</span>
                  {scenario.badge && (
                    <span className="rounded-full bg-cyan-500/20 px-2 py-[1px] text-[9px] font-semibold uppercase tracking-wide text-cyan-200">
                      {scenario.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {activeScenario?.verticalLabel && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
              <VerticalBadge label={activeScenario.verticalLabel} />
              <span>Ohio Hospital preset (CSF + Ohio TDDD)</span>
            </div>
          )}
          <div className="mt-1 text-[11px] text-slate-400">
            {activeScenario?.description ?? ""}
          </div>
        </div>
      </header>

      <section className="sandbox-trace-toggle">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={traceEnabled}
            onChange={(e) => setTraceEnabled(e.target.checked)}
          />
          <span>Show developer trace (request + response JSON)</span>
        </label>
      </section>

      {error && (
        <section className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </section>
      )}

      {result && finalDecision && (
        <section className="space-y-3 rounded-lg border border-slate-100 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-900">Order Decision</h4>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-xs uppercase tracking-wide text-slate-500">
              Final decision
            </span>
          </div>
        </div>

        <RegulatoryInsightsPanel
          title="Order decision"
          decision={finalDecision}
          missingFields={missingFromDecision(finalDecision)}
        />

          <div className="grid gap-3 md:grid-cols-2">
            <div className="order-journey-panel rounded-md border border-slate-200 bg-white p-3 shadow-sm">
              <h5 className="text-sm font-semibold text-slate-900">
                Hospital CSF Decision
              </h5>
              {csfDecision ? (
                <RegulatoryInsightsPanel
                  title="CSF regulatory insights"
                  decision={csfDecision}
                  missingFields={missingFromDecision(csfDecision)}
                />
              ) : (
                <p className="text-sm text-slate-700">
                  No Hospital CSF evaluation was returned for this scenario.
                </p>
              )}
            </div>

            <div className="order-journey-panel rounded-md border border-slate-200 bg-white p-3 shadow-sm">
              <h5 className="text-sm font-semibold text-slate-900">
                Ohio TDDD License Decision
              </h5>
              {licenseDecision ? (
                <RegulatoryInsightsPanel
                  title="License regulatory insights"
                  decision={licenseDecision}
                  missingFields={missingFromDecision(licenseDecision)}
                />
              ) : (
                <p className="text-sm text-slate-700">
                  No Ohio TDDD evaluation was run for this scenario.
                </p>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-600">
            This endpoint is listed in the API reference as{" "}
            <span className="font-mono text-slate-800">
              Mock orders → Ohio hospital mock order
            </span>
            .
          </p>

          {result.notes && result.notes.length > 0 && (
            <div className="order-journey-notes space-y-2">
              <h5 className="text-sm font-semibold text-slate-900">Notes</h5>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                {result.notes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {traceEnabled && lastRun && (
        <section className="order-journey-trace">
          <h3 className="text-base font-semibold text-slate-900">
            Developer Trace
          </h3>

          <div className="trace-actions">
            <button type="button" onClick={handleCopyRequestCurl}>
              Copy request as cURL
            </button>
            <button type="button" onClick={handleCopyRequestJson}>
              Copy request JSON
            </button>
            <button type="button" onClick={handleCopyResponseJson}>
              Copy response JSON
            </button>
          </div>
          {traceCopyMessage && (
            <p className="trace-copy-message">{traceCopyMessage}</p>
          )}

          <details open>
            <summary>Request payload</summary>
            <pre className="code-block">
              {JSON.stringify(lastRun.request, null, 2)}
            </pre>
          </details>

          <details open>
            <summary>Raw response</summary>
            <pre className="code-block">
              {JSON.stringify(lastRun.response, null, 2)}
            </pre>
          </details>
        </section>
      )}

      <div className="mt-4">
        <DecisionStatusLegend />
      </div>
    </div>
  );
}

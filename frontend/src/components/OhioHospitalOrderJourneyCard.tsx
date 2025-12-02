import React, { useState } from "react";
import {
  OrderScenarioKind,
  runOhioHospitalOrderScenario,
} from "../api/orderMockApprovalClient";
import { OhioHospitalOrderApprovalResult } from "../domain/orderMockApproval";
import { trackSandboxEvent } from "../devsupport/telemetry";

function decisionBadgeClass(decision: string) {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold";

  switch (decision) {
    case "ok_to_ship":
      return `${base} bg-green-100 text-green-800`;
    case "needs_review":
      return `${base} bg-amber-100 text-amber-800`;
    case "blocked":
      return `${base} bg-red-100 text-red-800`;
    default:
      return `${base} bg-slate-100 text-slate-800`;
  }
}

export function OhioHospitalOrderJourneyCard() {
  const [result, setResult] = useState<OhioHospitalOrderApprovalResult | null>(
    null
  );
  const [loading, setLoading] = useState<null | OrderScenarioKind>(null);
  const [error, setError] = useState<string | null>(null);

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
      const data = await runOhioHospitalOrderScenario(kind);
      setResult(data);

      trackSandboxEvent("order_mock_ohio_hospital_success", {
        scenario: kind,
        engine_family: "order",
        journey: "ohio_hospital_schedule_ii",
        final_decision: data.final_decision,
        csf_status: data.csf_status,
        tddd_status: data.tddd_status,
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

  return (
    <div className="sandbox-card order-journey-card space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <header className="space-y-2">
        <h3 className="text-base font-semibold text-slate-900">
          Ohio Hospital Order Journey
        </h3>
        <p className="text-sm text-slate-600">
          Run a mock Schedule II order for an Ohio hospital and see how the
          Hospital CSF and Ohio TDDD license engines combine into a final order
          decision.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-xs text-slate-700">
          <li>Hospital CSF decision</li>
          <li>Ohio TDDD license decision</li>
          <li>Final order-level decision</li>
        </ul>
      </header>

      <section className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => runScenario("happy_path")}
          disabled={loading !== null}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading === "happy_path"
            ? "Running happy path..."
            : "Run happy path (everything valid)"}
        </button>

        <button
          type="button"
          onClick={() => runScenario("missing_tddd")}
          disabled={loading !== null}
          className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading === "missing_tddd"
            ? "Running negative path..."
            : "Run negative path (missing TDDD)"}
        </button>
      </section>

      {error && (
        <section className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </section>
      )}

      {result && (
        <section className="space-y-3 rounded-lg border border-slate-100 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-900">Order Decision</h4>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-500">
                Final decision
              </span>
              <span className={decisionBadgeClass(result.final_decision)}>
                {result.final_decision}
              </span>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="order-journey-panel rounded-md border border-slate-200 bg-white p-3 shadow-sm">
              <h5 className="text-sm font-semibold text-slate-900">
                Hospital CSF Decision
              </h5>
              <p className="text-sm text-slate-700">
                <strong>Status:</strong> {result.csf_status}
              </p>
              <p className="text-sm text-slate-700">
                <strong>Reason:</strong> {result.csf_reason}
              </p>
              {result.csf_missing_fields?.length > 0 && (
                <p className="text-sm text-slate-700">
                  <strong>Missing fields:</strong> {result.csf_missing_fields.join(", ")}
                </p>
              )}
            </div>

            <div className="order-journey-panel rounded-md border border-slate-200 bg-white p-3 shadow-sm">
              <h5 className="text-sm font-semibold text-slate-900">
                Ohio TDDD License Decision
              </h5>
              {result.tddd_status ? (
                <div className="space-y-1 text-sm text-slate-700">
                  <p>
                    <strong>Status:</strong> {result.tddd_status}
                  </p>
                  <p>
                    <strong>Reason:</strong> {result.tddd_reason}
                  </p>
                  {result.tddd_missing_fields &&
                    result.tddd_missing_fields.length > 0 && (
                      <p>
                        <strong>Missing fields:</strong> {result.tddd_missing_fields.join(", ")}
                      </p>
                    )}
                </div>
              ) : (
                <p className="text-sm text-slate-700">
                  No Ohio TDDD evaluation was run for this scenario.
                </p>
              )}
            </div>
          </div>

          <div className="order-journey-notes space-y-2">
            <h5 className="text-sm font-semibold text-slate-900">Notes</h5>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              {result.notes.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}

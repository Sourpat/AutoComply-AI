import React, { useState } from "react";

import {
  NyPharmacyDecision,
  NyPharmacyFormData,
} from "../domain/licenseNyPharmacy";
import {
  callNyPharmacyFormCopilot,
  evaluateNyPharmacyLicense,
} from "../api/licenseNyPharmacyClient";
import { NyPharmacyOrderApprovalResult } from "../domain/orderMockApproval";
import { runNyPharmacyOrderMock } from "../api/orderNyPharmacyMockClient";
import { OhioTdddFormCopilotResponse as LicenseCopilotResponse } from "../domain/licenseOhioTddd";
import { trackSandboxEvent } from "../devsupport/telemetry";
import { API_BASE } from "../api/csfHospitalClient";
import { copyToClipboard } from "../utils/clipboard";
import { buildCurlCommand } from "../utils/curl";
import { CopyCurlButton } from "./CopyCurlButton";
import { DecisionStatusBadge } from "./DecisionStatusBadge";
import { UnderTheHoodInfo } from "../components/UnderTheHoodInfo";

type NyLicenseScenarioId =
  | "valid_ny_active"
  | "expired_or_suspended"
  | "non_ny_ship_to";

const NY_LICENSE_SCENARIOS: {
  id: NyLicenseScenarioId;
  label: string;
  badge?: string;
  description: string;
}[] = [
  {
    id: "valid_ny_active",
    label: "Valid NY license (active)",
    badge: "Happy path",
    description:
      "NY pharmacy with an active license shipping to NY. Both the license engine and mock order should come back ok_to_ship.",
  },
  {
    id: "expired_or_suspended",
    label: "Expired / suspended",
    description:
      "NY pharmacy with a license that is expired or flagged. Good for a needs_review or blocked outcome in the mock order.",
  },
  {
    id: "non_ny_ship_to",
    label: "Non-NY ship-to",
    description:
      "Account with a NY-style profile trying to ship to a non-NY state. Useful to show how the mock order treats license-not-required scenarios.",
  },
];

const NY_PHARMACY_ENGINE_FAMILY = "license";
const NY_PHARMACY_DECISION_TYPE = "license_ny_pharmacy";
const NY_PHARMACY_SANDBOX_ID = "ny_pharmacy";

const NY_PHARMACY_EXAMPLES: NyPharmacyFormData[] = [
  {
    pharmacyName: "Manhattan Pharmacy",
    accountNumber: "900123456",
    shipToState: "NY",
    deaNumber: "FG1234567",
    nyStateLicenseNumber: "NYPHARM-001234",
    attestationAccepted: true,
    internalNotes: "Happy path NY Pharmacy license example.",
  },
];

const NY_LICENSE_SCENARIO_FORMS: Record<NyLicenseScenarioId, NyPharmacyFormData> = {
  valid_ny_active: {
    pharmacyName: "Manhattan Pharmacy",
    accountNumber: "900123456",
    shipToState: "NY",
    deaNumber: "FG1234567",
    nyStateLicenseNumber: "NYPHARM-001234",
    attestationAccepted: true,
    internalNotes: "Active NY license shipping to NY.",
  },
  expired_or_suspended: {
    pharmacyName: "Hudson Apothecary",
    accountNumber: "900987654",
    shipToState: "NY",
    deaNumber: "FG7654321",
    nyStateLicenseNumber: "NYPHARM-009999",
    attestationAccepted: true,
    internalNotes: "License flagged as expired/suspended.",
  },
  non_ny_ship_to: {
    pharmacyName: "Brooklyn Care Pharmacy",
    accountNumber: "901111111",
    shipToState: "NJ",
    deaNumber: "FG2222222",
    nyStateLicenseNumber: "NYPHARM-007777",
    attestationAccepted: true,
    internalNotes: "Shipping outside NY where license is not required.",
  },
};

export function NyPharmacyLicenseSandbox() {
  const [form, setForm] = useState<NyPharmacyFormData>(NY_PHARMACY_EXAMPLES[0]);
  const [decision, setDecision] = useState<NyPharmacyDecision | null>(null);
  const [copilot, setCopilot] = useState<LicenseCopilotResponse | null>(null);
  const [loadingEval, setLoadingEval] = useState(false);
  const [loadingCopilot, setLoadingCopilot] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderResult, setOrderResult] =
    useState<NyPharmacyOrderApprovalResult | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderTrace, setOrderTrace] = useState<{
    request: any;
    response: any;
  } | null>(null);
  const [orderTraceEnabled, setOrderTraceEnabled] = useState(false);
  const [orderTraceCopyMessage, setOrderTraceCopyMessage] = useState<
    string | null
  >(null);
  const [selectedScenarioId, setSelectedScenarioId] =
    React.useState<NyLicenseScenarioId>("valid_ny_active");

  function handleChange(
    field: keyof NyPharmacyFormData,
    value: string | boolean
  ) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function applyExample(example: NyPharmacyFormData) {
    setForm(example);
    setDecision(null);
    setCopilot(null);
    setError(null);
    setOrderResult(null);
    setOrderError(null);
    setOrderTrace(null);

    trackSandboxEvent("license_ny_pharmacy_example_selected", {
      engine_family: NY_PHARMACY_ENGINE_FAMILY,
      decision_type: NY_PHARMACY_DECISION_TYPE,
      sandbox: NY_PHARMACY_SANDBOX_ID,
      ship_to_state: example.shipToState,
    });
  }

  async function handleEvaluate() {
    setLoadingEval(true);
    setError(null);
    setDecision(null);

    trackSandboxEvent("license_ny_pharmacy_evaluate_attempt", {
      engine_family: NY_PHARMACY_ENGINE_FAMILY,
      decision_type: NY_PHARMACY_DECISION_TYPE,
      sandbox: NY_PHARMACY_SANDBOX_ID,
      ship_to_state: form.shipToState,
    });

    try {
      const result = await evaluateNyPharmacyLicense(form);
      setDecision(result);

      trackSandboxEvent("license_ny_pharmacy_evaluate_success", {
        engine_family: NY_PHARMACY_ENGINE_FAMILY,
        decision_type: NY_PHARMACY_DECISION_TYPE,
        sandbox: NY_PHARMACY_SANDBOX_ID,
        status: result.status,
      });
    } catch (err: any) {
      const message =
        err?.message ??
        "NY Pharmacy license evaluation could not run. Please try again.";
      setError(message);

      trackSandboxEvent("license_ny_pharmacy_evaluate_error", {
        engine_family: NY_PHARMACY_ENGINE_FAMILY,
        decision_type: NY_PHARMACY_DECISION_TYPE,
        sandbox: NY_PHARMACY_SANDBOX_ID,
        error: String(err),
      });
    } finally {
      setLoadingEval(false);
    }
  }

  async function handleCopilot() {
    setLoadingCopilot(true);
    setError(null);
    setCopilot(null);

    trackSandboxEvent("license_ny_pharmacy_copilot_attempt", {
      engine_family: NY_PHARMACY_ENGINE_FAMILY,
      decision_type: NY_PHARMACY_DECISION_TYPE,
      sandbox: NY_PHARMACY_SANDBOX_ID,
      ship_to_state: form.shipToState,
    });

    try {
      const result = await callNyPharmacyFormCopilot(form);
      setCopilot(result);

      trackSandboxEvent("license_ny_pharmacy_copilot_success", {
        engine_family: NY_PHARMACY_ENGINE_FAMILY,
        decision_type: NY_PHARMACY_DECISION_TYPE,
        sandbox: NY_PHARMACY_SANDBOX_ID,
        status: result.status,
      });
    } catch (err: any) {
      const message =
        err?.message ??
        "NY Pharmacy License Copilot could not run. Please try again.";
      setError(message);

      trackSandboxEvent("license_ny_pharmacy_copilot_error", {
        engine_family: NY_PHARMACY_ENGINE_FAMILY,
        decision_type: NY_PHARMACY_DECISION_TYPE,
        sandbox: NY_PHARMACY_SANDBOX_ID,
        error: String(err),
      });
    } finally {
      setLoadingCopilot(false);
    }
  }

  function runNyLicenseScenario(id: NyLicenseScenarioId) {
    setSelectedScenarioId(id);

    const scenarioForm = NY_LICENSE_SCENARIO_FORMS[id];
    if (scenarioForm) {
      setForm(scenarioForm);
      setDecision(null);
      setCopilot(null);
    }

    handleOrderMock(scenarioForm);
  }

  async function handleOrderMock(formOverride?: NyPharmacyFormData) {
    setOrderLoading(true);
    setOrderError(null);
    setOrderResult(null);

    const payload = formOverride ?? form;

    trackSandboxEvent("ny_pharmacy_order_mock_run", {
      engine_family: "order",
      license_type: "ny_pharmacy",
      ship_to_state: payload.shipToState,
    });

    try {
      const run = await runNyPharmacyOrderMock(payload);
      setOrderTrace(run);
      setOrderResult(run.response);

      trackSandboxEvent("ny_pharmacy_order_mock_success", {
        engine_family: "order",
        license_type: "ny_pharmacy",
        final_decision: run.response.final_decision,
        license_status: run.response.license_status,
      });
    } catch (err: any) {
      const message =
        err?.message ??
        "NY Pharmacy license-only mock order could not run. Please try again.";
      setOrderError(message);

      trackSandboxEvent("ny_pharmacy_order_mock_error", {
        engine_family: "order",
        license_type: "ny_pharmacy",
        error: String(err),
      });
    } finally {
      setOrderLoading(false);
    }
  }

  async function handleCopyNyOrderRequestCurl() {
    if (!orderTrace) return;
    const curl = buildCurlCommand(
      "/orders/mock/ny-pharmacy-approval",
      "POST",
      orderTrace.request
    );
    const ok = await copyToClipboard(curl);
    setOrderTraceCopyMessage(
      ok ? "Request cURL copied to clipboard." : "Unable to copy cURL."
    );
    setTimeout(() => setOrderTraceCopyMessage(null), 2000);
  }

  async function handleCopyNyOrderRequestJson() {
    if (!orderTrace) return;
    const json = JSON.stringify(orderTrace.request, null, 2);
    const ok = await copyToClipboard(json);
    setOrderTraceCopyMessage(
      ok ? "Request JSON copied to clipboard." : "Unable to copy JSON."
    );
    setTimeout(() => setOrderTraceCopyMessage(null), 2000);
  }

  async function handleCopyNyOrderResponseJson() {
    if (!orderTrace) return;
    const json = JSON.stringify(orderTrace.response, null, 2);
    const ok = await copyToClipboard(json);
    setOrderTraceCopyMessage(
      ok ? "Response JSON copied to clipboard." : "Unable to copy JSON."
    );
    setTimeout(() => setOrderTraceCopyMessage(null), 2000);
  }

  return (
    <div className="sandbox-card space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold">NY Pharmacy License Sandbox</h2>
        <p className="text-sm text-slate-600">
          Test New York Pharmacy license decisions and explanations. This
          sandbox calls:
        </p>
        <ul className="text-sm text-slate-700">
          <li>
            <code>POST /license/ny-pharmacy/evaluate</code>
          </li>
          <li>
            <code>POST /license/ny-pharmacy/form-copilot</code>
          </li>
          <li>
            <code>POST /orders/mock/ny-pharmacy-approval</code>
          </li>
        </ul>
      </header>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Examples</h3>
        <div className="flex flex-wrap gap-2">
          {NY_PHARMACY_EXAMPLES.map((example, index) => (
            <button
              key={index}
              type="button"
              onClick={() => applyExample(example)}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              {example.pharmacyName} – {example.shipToState}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Form</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
            Pharmacy name
            <input
              value={form.pharmacyName}
              onChange={(e) => handleChange("pharmacyName", e.target.value)}
              className="rounded-md border border-slate-200 px-2 py-1 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
            Account number
            <input
              value={form.accountNumber}
              onChange={(e) => handleChange("accountNumber", e.target.value)}
              className="rounded-md border border-slate-200 px-2 py-1 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
            Ship-to state
            <input
              value={form.shipToState}
              onChange={(e) => handleChange("shipToState", e.target.value)}
              className="rounded-md border border-slate-200 px-2 py-1 text-sm"
            />
            <span className="text-[11px] text-slate-500">
              For this engine, this should normally be "NY".
            </span>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
            DEA number (optional)
            <input
              value={form.deaNumber ?? ""}
              onChange={(e) => handleChange("deaNumber", e.target.value)}
              className="rounded-md border border-slate-200 px-2 py-1 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
            NY State license number
            <input
              value={form.nyStateLicenseNumber}
              onChange={(e) =>
                handleChange("nyStateLicenseNumber", e.target.value)
              }
              className="rounded-md border border-slate-200 px-2 py-1 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.attestationAccepted}
              onChange={(e) => handleChange("attestationAccepted", e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Attestation accepted
          </label>
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
          Internal notes (optional)
          <textarea
            value={form.internalNotes ?? ""}
            onChange={(e) => handleChange("internalNotes", e.target.value)}
            className="min-h-[80px] rounded-md border border-slate-200 px-2 py-1 text-sm"
          />
        </label>
      </section>

      <section className="sandbox-actions flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleEvaluate}
          disabled={loadingEval}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow disabled:opacity-60"
        >
          {loadingEval ? "Evaluating..." : "Evaluate NY Pharmacy license"}
        </button>

        <button
          type="button"
          onClick={handleCopilot}
          disabled={loadingCopilot}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm disabled:opacity-60"
        >
          {loadingCopilot
            ? "Running License Copilot..."
            : "Check & Explain (NY Pharmacy Copilot)"}
        </button>

        <button
          type="button"
          onClick={handleOrderMock}
          disabled={orderLoading}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm disabled:opacity-60"
        >
          {orderLoading
            ? "Running license-only order decision..."
            : "Run license-only order decision"}
        </button>
      </section>

      <section className="sandbox-trace-toggle text-xs text-slate-700">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={orderTraceEnabled}
            onChange={(e) => setOrderTraceEnabled(e.target.checked)}
          />
          <span>Show NY license-only order trace (request + response)</span>
        </label>
      </section>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Decision</h3>
        {decision && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
            <p>
              <strong>Status:</strong> {" "}
              <DecisionStatusBadge status={decision.status} />
            </p>
            <p>
              <strong>Reason:</strong> {decision.reason}
            </p>
            {decision.missingFields?.length > 0 && (
              <p>
                <strong>Missing fields:</strong> {decision.missingFields.join(", ")}
              </p>
            )}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">NY Pharmacy License Copilot</h3>
        {copilot && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
            <p>
              <strong>Status:</strong> {" "}
              <DecisionStatusBadge status={copilot.status} />
            </p>
            <p>
              <strong>Reason:</strong> {copilot.reason}
            </p>
            {copilot.missing_fields?.length > 0 && (
              <p>
                <strong>Missing fields:</strong> {copilot.missing_fields.join(", ")}
              </p>
            )}
            {copilot.regulatory_references?.length > 0 && (
              <div className="space-y-1">
                <strong>Regulatory references:</strong>
                <ul className="list-disc pl-5">
                  {copilot.regulatory_references.map((ref) => (
                    <li key={ref}>{ref}</li>
                  ))}
                </ul>
              </div>
            )}
            {copilot.rag_explanation && (
              <p>
                <strong>Explanation:</strong> {copilot.rag_explanation}
              </p>
            )}
            {copilot.rag_sources?.length > 0 && (
              <div className="space-y-1">
                <strong>Sources consulted:</strong>
                <ul className="list-disc pl-5">
                  {copilot.rag_sources.map((src) => (
                    <li key={src.id}>
                      {src.title} {src.url && <span>({src.url})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {orderError && <p className="text-xs text-red-600">{orderError}</p>}

      {orderResult && (
        <section className="order-journey-result space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
          <h2 className="text-base font-semibold">
            NY Pharmacy License-Only Order Decision
          </h2>
          <p>
            <strong>Final decision:</strong>{" "}
            <DecisionStatusBadge status={orderResult.final_decision} />
          </p>
          <p>
            <strong>License status:</strong>{" "}
            <DecisionStatusBadge status={orderResult.license_status} />
          </p>
          <p>
            <strong>License reason:</strong> {orderResult.license_reason}
          </p>
          {orderResult.license_missing_fields?.length > 0 && (
            <p>
              <strong>Missing fields:</strong>{" "}
              {orderResult.license_missing_fields.join(", ")}
            </p>
          )}
          <div>
            <strong>Notes:</strong>
            <ul className="list-disc pl-5">
              {orderResult.notes.map((n, idx) => (
                <li key={idx}>{n}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {orderTraceEnabled && orderTrace && (
        <section className="order-journey-trace space-y-3 rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-800 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">NY License-Only Order Trace</h3>
            <UnderTheHoodInfo
              lines={[
                "Calls /license/ny-pharmacy/evaluate to determine the NY pharmacy license status.",
                "Uses /orders/mock/ny-pharmacy-approval to run a license-only order decision based on that status.",
                "Normalizes outputs to ok_to_ship, needs_review, or blocked for consistency with other engines.",
              ]}
            />
          </div>

          <div className="mt-3">
            <p className="text-xs font-medium text-slate-300">Quick scenarios</p>
            <p className="mt-1 text-[11px] text-slate-400">
              Pick a preset to simulate how the NY license engine and mock order
              behave in a few realistic cases.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {NY_LICENSE_SCENARIOS.map((scenario) => {
                const isActive = scenario.id === selectedScenarioId;
                return (
                  <button
                    key={scenario.id}
                    type="button"
                    onClick={() => runNyLicenseScenario(scenario.id)}
                    className={[
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium transition",
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
            <div className="mt-1 text-[11px] text-slate-400">
              {
                NY_LICENSE_SCENARIOS.find((s) => s.id === selectedScenarioId)
                  ?.description
              }
            </div>
          </div>

          <div className="trace-actions">
            <button type="button" onClick={handleCopyNyOrderRequestCurl}>
              Copy request as cURL
            </button>
            <button type="button" onClick={handleCopyNyOrderRequestJson}>
              Copy request JSON
            </button>
            <button type="button" onClick={handleCopyNyOrderResponseJson}>
              Copy response JSON
            </button>
          </div>
          {orderTraceCopyMessage && (
            <p className="trace-copy-message">{orderTraceCopyMessage}</p>
          )}

          <details open>
            <summary className="cursor-pointer font-medium">Request payload</summary>
            <pre className="code-block overflow-auto rounded-md bg-slate-900 p-3 text-[11px] text-slate-100">
              {JSON.stringify(orderTrace.request, null, 2)}
            </pre>
          </details>

          <details open>
            <summary className="cursor-pointer font-medium">Response JSON</summary>
            <pre className="code-block overflow-auto rounded-md bg-slate-900 p-3 text-[11px] text-slate-100">
              {JSON.stringify(orderTrace.response, null, 2)}
            </pre>
          </details>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">cURL example</h3>
        <div className="rounded-md border border-slate-200 bg-slate-900 p-3 text-xs text-slate-50">
          <pre className="overflow-auto text-[11px] leading-relaxed">{`curl -X POST "${API_BASE}/license/ny-pharmacy/evaluate" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(
    {
      pharmacy_name: form.pharmacyName,
      account_number: form.accountNumber,
      ship_to_state: form.shipToState,
      dea_number: form.deaNumber ?? null,
      ny_state_license_number: form.nyStateLicenseNumber,
      attestation_accepted: form.attestationAccepted,
      internal_notes: form.internalNotes ?? "",
    },
    null,
    2
  )}'`}</pre>
        <div className="mt-2">
          <CopyCurlButton
            getCommand={() =>
              buildCurlCommand("/license/ny-pharmacy/evaluate", {
                pharmacy_name: form.pharmacyName,
                account_number: form.accountNumber,
                ship_to_state: form.shipToState,
                dea_number: form.deaNumber ?? null,
                ny_state_license_number: form.nyStateLicenseNumber,
                attestation_accepted: form.attestationAccepted,
                internal_notes: form.internalNotes ?? "",
              })
            }
          />
        </div>
        </div>
      </section>
    </div>
  );
}

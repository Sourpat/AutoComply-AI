import React, { useState } from "react";

import {
  OhioTdddDecision,
  OhioTdddFormCopilotResponse,
  OhioTdddFormData,
} from "../domain/licenseOhioTddd";
import { evaluateOhioTdddLicense } from "../api/licenseOhioTdddClient";
import { callOhioTdddFormCopilot } from "../api/licenseOhioTdddCopilotClient";
import { trackSandboxEvent } from "../devsupport/telemetry";
import { CopyCurlButton } from "./CopyCurlButton";
import { API_BASE } from "../api/csfHospitalClient";
import { buildCurlCommand } from "../utils/curl";

const OHIO_TDDD_ENGINE_FAMILY = "license";
const OHIO_TDDD_DECISION_TYPE = "license_ohio_tddd";
const OHIO_TDDD_SANDBOX_ID = "ohio_tddd";

const OHIO_TDDD_EXAMPLES: OhioTdddFormData[] = [
  {
    tdddNumber: "01234567",
    facilityName: "Example Ohio Pharmacy",
    accountNumber: "800123456",
    shipToState: "OH",
    licenseType: "ohio_tddd",
    attestationAccepted: true,
    internalNotes: "Happy path Ohio TDDD example.",
  },
  {
    tdddNumber: "",
    facilityName: "Out-of-state Facility",
    accountNumber: "800987654",
    shipToState: "PA",
    licenseType: "ohio_tddd",
    attestationAccepted: true,
    internalNotes:
      "Missing TDDD number and ship-to not OH – expected needs_review/blocked.",
  },
  {
    tdddNumber: "00000000",
    facilityName: "Ohio Facility – No Attestation",
    accountNumber: "800555777",
    shipToState: "OH",
    licenseType: "ohio_tddd",
    attestationAccepted: false,
    internalNotes: "Attestation not accepted – expected blocked.",
  },
];

export function OhioTdddSandbox() {
  const [form, setForm] = useState<OhioTdddFormData>(OHIO_TDDD_EXAMPLES[0]);
  const [decision, setDecision] = useState<OhioTdddDecision | null>(null);
  const [copilotResponse, setCopilotResponse] =
    useState<OhioTdddFormCopilotResponse | null>(null);
  const [evaluateLoading, setEvaluateLoading] = useState(false);
  const [evaluateError, setEvaluateError] = useState<string | null>(null);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotError, setCopilotError] = useState<string | null>(null);

  function applyExample(example: OhioTdddFormData) {
    setForm(example);
    setDecision(null);
    setCopilotResponse(null);
    setEvaluateError(null);
    setCopilotError(null);

    trackSandboxEvent("license_ohio_tddd_example_selected", {
      engine_family: OHIO_TDDD_ENGINE_FAMILY,
      decision_type: OHIO_TDDD_DECISION_TYPE,
      sandbox: OHIO_TDDD_SANDBOX_ID,
      ship_to_state: example.shipToState,
      license_type: example.licenseType,
    });
  }

  async function handleEvaluate() {
    setEvaluateLoading(true);
    setEvaluateError(null);
    setDecision(null);

    trackSandboxEvent("license_ohio_tddd_evaluate_attempt", {
      engine_family: OHIO_TDDD_ENGINE_FAMILY,
      decision_type: OHIO_TDDD_DECISION_TYPE,
      sandbox: OHIO_TDDD_SANDBOX_ID,
    });

    try {
      const result = await evaluateOhioTdddLicense(form);
      setDecision(result);

      trackSandboxEvent("license_ohio_tddd_evaluate_success", {
        engine_family: OHIO_TDDD_ENGINE_FAMILY,
        decision_type: OHIO_TDDD_DECISION_TYPE,
        sandbox: OHIO_TDDD_SANDBOX_ID,
        status: result.status,
      });
    } catch (err: any) {
      setEvaluateError(err?.message ?? "Unknown error");

      trackSandboxEvent("license_ohio_tddd_evaluate_error", {
        engine_family: OHIO_TDDD_ENGINE_FAMILY,
        decision_type: OHIO_TDDD_DECISION_TYPE,
        sandbox: OHIO_TDDD_SANDBOX_ID,
        error: String(err),
      });
    } finally {
      setEvaluateLoading(false);
    }
  }

  async function handleCopilot() {
    setCopilotLoading(true);
    setCopilotError(null);
    setCopilotResponse(null);

    trackSandboxEvent("license_ohio_tddd_form_copilot_run", {
      engine_family: OHIO_TDDD_ENGINE_FAMILY,
      decision_type: OHIO_TDDD_DECISION_TYPE,
      sandbox: OHIO_TDDD_SANDBOX_ID,
    });

    try {
      const result = await callOhioTdddFormCopilot(form);
      setCopilotResponse(result);

      trackSandboxEvent("license_ohio_tddd_form_copilot_success", {
        engine_family: OHIO_TDDD_ENGINE_FAMILY,
        decision_type: OHIO_TDDD_DECISION_TYPE,
        sandbox: OHIO_TDDD_SANDBOX_ID,
        status: result.status,
      });
    } catch (err: any) {
      setCopilotError(
        "Ohio TDDD License Copilot could not run. Please check the form and try again."
      );

      trackSandboxEvent("license_ohio_tddd_form_copilot_error", {
        engine_family: OHIO_TDDD_ENGINE_FAMILY,
        decision_type: OHIO_TDDD_DECISION_TYPE,
        sandbox: OHIO_TDDD_SANDBOX_ID,
        error: String(err),
      });
    } finally {
      setCopilotLoading(false);
    }
  }

  return (
    <div className="sandbox-card space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold">Ohio TDDD License Sandbox</h2>
        <p className="text-sm text-slate-600">
          Test Ohio TDDD (Terminal Distributor of Dangerous Drugs) license
          evaluation and explanation. This uses the shared License Copilot RAG
          engine grounded on the <code>ohio_tddd_rules</code> document.
        </p>
      </header>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Examples</h3>
        <div className="flex flex-wrap gap-2">
          {OHIO_TDDD_EXAMPLES.map((example, index) => (
            <button
              key={index}
              type="button"
              onClick={() => applyExample(example)}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              {example.facilityName} – {example.shipToState}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Form</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
            TDDD Number
            <input
              type="text"
              value={form.tdddNumber}
              onChange={(e) => setForm({ ...form, tdddNumber: e.target.value })}
              className="rounded-md border border-slate-200 px-2 py-1 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
            Facility Name
            <input
              type="text"
              value={form.facilityName}
              onChange={(e) => setForm({ ...form, facilityName: e.target.value })}
              className="rounded-md border border-slate-200 px-2 py-1 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
            Account Number (optional)
            <input
              type="text"
              value={form.accountNumber ?? ""}
              onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
              className="rounded-md border border-slate-200 px-2 py-1 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
            Ship To State
            <input
              type="text"
              value={form.shipToState}
              onChange={(e) => setForm({ ...form, shipToState: e.target.value })}
              className="rounded-md border border-slate-200 px-2 py-1 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
            License Type
            <input
              type="text"
              value={form.licenseType}
              readOnly
              className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-sm"
            />
          </label>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.attestationAccepted}
              onChange={(e) =>
                setForm({ ...form, attestationAccepted: e.target.checked })
              }
              className="h-4 w-4 rounded border-slate-300"
            />
            Attestation Accepted
          </label>
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
          Internal Notes (optional)
          <textarea
            value={form.internalNotes ?? ""}
            onChange={(e) => setForm({ ...form, internalNotes: e.target.value })}
            className="min-h-[80px] rounded-md border border-slate-200 px-2 py-1 text-sm"
          />
        </label>
      </section>

      <section className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleEvaluate}
          disabled={evaluateLoading}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow disabled:opacity-60"
        >
          {evaluateLoading ? "Evaluating..." : "Evaluate Ohio TDDD License"}
        </button>
        <button
          type="button"
          onClick={handleCopilot}
          disabled={copilotLoading}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm disabled:opacity-60"
        >
          {copilotLoading ? "Running Copilot..." : "Check & Explain"}
        </button>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Decision</h3>
        {evaluateError && <p className="text-xs text-red-600">{evaluateError}</p>}
        {decision && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
            <p>
              <strong>Status:</strong> {decision.status}
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
        <h3 className="text-sm font-semibold">License Copilot Explanation</h3>
        {copilotError && <p className="text-xs text-red-600">{copilotError}</p>}
        {copilotResponse && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
            <p>
              <strong>Status:</strong> {copilotResponse.status}
            </p>
            <p>
              <strong>Reason:</strong> {copilotResponse.reason}
            </p>
            {copilotResponse.missing_fields?.length > 0 && (
              <p>
                <strong>Missing fields:</strong> {copilotResponse.missing_fields.join(", ")}
              </p>
            )}
            {copilotResponse.regulatory_references?.length > 0 && (
              <div className="space-y-1">
                <strong>Regulatory references:</strong>
                <ul className="list-disc pl-5">
                  {copilotResponse.regulatory_references.map((ref) => (
                    <li key={ref}>{ref}</li>
                  ))}
                </ul>
              </div>
            )}
            {copilotResponse.rag_explanation && (
              <p>
                <strong>Explanation:</strong> {copilotResponse.rag_explanation}
              </p>
            )}
            {copilotResponse.rag_sources?.length > 0 && (
              <div className="space-y-1">
                <strong>Sources consulted:</strong>
                <ul className="list-disc pl-5">
                  {copilotResponse.rag_sources.map((src) => (
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

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">cURL example</h3>
        <div className="rounded-md border border-slate-200 bg-slate-900 p-3 text-xs text-slate-50">
          <pre className="overflow-auto text-[11px] leading-relaxed">
{`curl -X POST "${API_BASE}/license/ohio-tddd/evaluate" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(form, null, 2)}'`}
          </pre>
          <div className="mt-2">
            <CopyCurlButton
              getCommand={() =>
                buildCurlCommand("/license/ohio-tddd/evaluate", form)
              }
            />
          </div>
        </div>
      </section>
    </div>
  );
}

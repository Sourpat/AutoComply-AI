// src/components/EmsCsfSandbox.tsx
import React, { FormEvent, useEffect, useState } from "react";
import {
  EmsCsfDecision,
  EmsCsfFormData,
  EmsFacilityType,
  type EmsFormCopilotResponse,
} from "../domain/csfEms";
import { evaluateEmsCsf } from "../api/csfEmsClient";
import { explainCsfDecision } from "../api/csfExplainClient";
import type { CsfDecisionSummary } from "../api/csfExplainClient";
import {
  fetchComplianceArtifacts,
  type ComplianceArtifact,
} from "../api/complianceArtifactsClient";
import { callRegulatoryRag } from "../api/ragRegulatoryClient";
import { ControlledSubstancesPanel } from "./ControlledSubstancesPanel";
import type { ControlledSubstance } from "../api/controlledSubstancesClient";
import { SourceDocumentChip } from "./SourceDocumentChip";
import { CopyCurlButton } from "./CopyCurlButton";
import { callEmsFormCopilot } from "../api/csfEmsCopilotClient";
import { API_BASE } from "../api/csfHospitalClient";
import { trackSandboxEvent } from "../devsupport/telemetry";
import { buildCurlCommand } from "../utils/curl";
import { EMS_CSF_PRESETS, type EmsCsfPresetId } from "../domain/csfEmsPresets";
import { VerticalBadge } from "./VerticalBadge";

const EMS_ENGINE_FAMILY = "csf";
const EMS_DECISION_TYPE = "csf_ems";
const EMS_SANDBOX_ID = "ems";


type EmsExample = {
  id: string;
  label: string;
  overrides: Partial<EmsCsfFormData>;
};

const EMS_EXAMPLES: EmsExample[] = EMS_CSF_PRESETS.map((preset) => ({
  id: preset.id,
  label: preset.label,
  overrides: preset.form,
}));

const initialForm: EmsCsfFormData = {
  facilityName: "",
  facilityType: "facility",
  accountNumber: "",
  pharmacyLicenseNumber: "",
  deaNumber: "",
  pharmacistInChargeName: "",
  pharmacistContactPhone: "",
  shipToState: "OH",
  attestationAccepted: false,
  internalNotes: "",
};

export function EmsCsfSandbox() {
  const [form, setForm] = useState<EmsCsfFormData>(initialForm);
  const [decision, setDecision] = useState<EmsCsfDecision | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [controlledSubstances, setControlledSubstances] = useState<
    ControlledSubstance[]
  >([]);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [regulatoryArtifacts, setRegulatoryArtifacts] = useState<
    ComplianceArtifact[]
  >([]);
  const [isLoadingRegulatory, setIsLoadingRegulatory] = useState(false);
  const [regulatoryError, setRegulatoryError] = useState<string | null>(null);
  const [ragAnswer, setRagAnswer] = useState<string | null>(null);
  const [isRagLoading, setIsRagLoading] = useState(false);
  const [ragError, setRagError] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] =
    useState<EmsCsfPresetId | null>(null);
  const activePreset = selectedPresetId
    ? EMS_CSF_PRESETS.find((preset) => preset.id === selectedPresetId) ?? null
    : null;

  // ---- EMS CSF Form Copilot state ----
  const [copilotResponse, setCopilotResponse] =
    useState<EmsFormCopilotResponse | null>(null);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotError, setCopilotError] = useState<string | null>(null);

  const applyEmsPreset = (presetId: EmsCsfPresetId | null) => {
    if (!presetId) {
      setSelectedPresetId(null);
      return;
    }

    const preset = EMS_CSF_PRESETS.find((candidate) => candidate.id === presetId);
    if (!preset) return;

    setSelectedPresetId(preset.id);
    setForm(preset.form);
    setControlledSubstances(preset.form.controlledSubstances ?? []);
    setDecision(null);
    setExplanation(null);
    setCopilotResponse(null);
    setExplainError(null);
    setCopilotError(null);

    trackSandboxEvent("ems_csf_preset_applied", {
      engine_family: EMS_ENGINE_FAMILY,
      decision_type: EMS_DECISION_TYPE,
      sandbox: EMS_SANDBOX_ID,
      preset_id: preset.id,
      vertical_label: preset.verticalLabel,
    });
  };

  function applyEmsExample(example: EmsExample) {
    applyEmsPreset(example.id as EmsCsfPresetId);
    const nextForm = {
      ...initialForm,
      ...form,
      ...example.overrides,
    };

    setForm(nextForm);
    if (example.overrides.controlledSubstances) {
      setControlledSubstances(example.overrides.controlledSubstances);
    }

    trackSandboxEvent("csf_ems_example_selected", {
      engine_family: EMS_ENGINE_FAMILY,
      decision_type: EMS_DECISION_TYPE,
      sandbox: EMS_SANDBOX_ID,
      example_id: example.id,
      example_label: example.label,
      facility_type: nextForm.facilityType,
      ship_to_state: nextForm.shipToState,
    });
  }

  const handlePresetChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const value = (event.target.value as EmsCsfPresetId) || null;
    applyEmsPreset(value);
  };

  const onChange = (field: keyof EmsCsfFormData, value: any) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setDecision(null);
    setExplanation(null);
    setExplainError(null);
    setRagAnswer(null);
    setRagError(null);

    trackSandboxEvent("csf_ems_evaluate_attempt", {
      engine_family: EMS_ENGINE_FAMILY,
      decision_type: EMS_DECISION_TYPE,
      sandbox: EMS_SANDBOX_ID,
      facility_type: form.facilityType,
      ship_to_state: form.shipToState,
    });

    try {
      const result = await evaluateEmsCsf({
        ...form,
        controlledSubstances,
      });
      setDecision(result);

      trackSandboxEvent("csf_ems_evaluate_success", {
        engine_family: EMS_ENGINE_FAMILY,
        decision_type: EMS_DECISION_TYPE,
        sandbox: EMS_SANDBOX_ID,
        facility_type: form.facilityType,
        ship_to_state: form.shipToState,
        decision_status: result.status,
      });
    } catch (err: any) {
      setError(err?.message ?? "Failed to evaluate EMS CSF");

      trackSandboxEvent("csf_ems_evaluate_error", {
        engine_family: EMS_ENGINE_FAMILY,
        decision_type: EMS_DECISION_TYPE,
        sandbox: EMS_SANDBOX_ID,
        facility_type: form.facilityType,
        ship_to_state: form.shipToState,
        error_message: err?.message ?? "unknown_error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setForm(initialForm);
    setDecision(null);
    setError(null);
    setControlledSubstances([]);
    setExplanation(null);
    setExplainError(null);
    setIsExplaining(false);

    setRagAnswer(null);
    setRagError(null);
    setIsRagLoading(false);

    setRegulatoryArtifacts([]);
    setRegulatoryError(null);
    setIsLoadingRegulatory(false);
  };

  const handleExplain = async () => {
    if (!decision) return;

    setIsExplaining(true);
    setExplainError(null);

    const summary: CsfDecisionSummary = {
      status: decision.status,
      reason: decision.reason,
      missing_fields: decision.missing_fields ?? [],
      regulatory_references: decision.regulatory_references ?? [],
    };

    try {
      const res = await explainCsfDecision("ems", summary);
      setExplanation(res.explanation);
    } catch (err: any) {
      setExplainError(
        err?.message ?? "Failed to generate CSF decision explanation"
      );
    } finally {
      setIsExplaining(false);
    }
  };

  const runEmsCsfCopilot = async () => {
    setCopilotLoading(true);
    setCopilotError(null);
    setCopilotResponse(null);

    trackSandboxEvent("csf_ems_form_copilot_run", {
      engine_family: EMS_ENGINE_FAMILY,
      decision_type: EMS_DECISION_TYPE,
      sandbox: EMS_SANDBOX_ID,
      facility_type: form.facilityType,
      ship_to_state: form.shipToState,
    });

    try {
      if (!API_BASE) {
        throw new Error(
          "Sandbox misconfigured: missing API base URL. Please set VITE_API_BASE in your environment before using EMS CSF tools."
        );
      }

      const copilotResponse = await callEmsFormCopilot({
        ...form,
        controlledSubstances,
      });

      setCopilotResponse(copilotResponse);

      trackSandboxEvent("csf_ems_form_copilot_success", {
        engine_family: EMS_ENGINE_FAMILY,
        decision_type: EMS_DECISION_TYPE,
        sandbox: EMS_SANDBOX_ID,
        decision_outcome: copilotResponse.status ?? "unknown",
        reason: copilotResponse.reason,
        missing_fields: copilotResponse.missing_fields ?? [],
        regulatory_references: copilotResponse.regulatory_references ?? [],
      });
    } catch (err: any) {
      console.error(err);
      setCopilotError(
        err?.message ||
          "EMS CSF Copilot could not run. Please check the form and try again."
      );

      trackSandboxEvent("csf_ems_form_copilot_error", {
        engine_family: EMS_ENGINE_FAMILY,
        decision_type: EMS_DECISION_TYPE,
        sandbox: EMS_SANDBOX_ID,
        facility_type: form.facilityType,
        ship_to_state: form.shipToState,
        error_message: err?.message ?? "unknown_error",
      });
    } finally {
      setCopilotLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    if (!decision || !decision.regulatory_references?.length) {
      setRegulatoryArtifacts([]);
      setRegulatoryError(null);
      setIsLoadingRegulatory(false);
      return;
    }

    const refs = decision.regulatory_references;

    setIsLoadingRegulatory(true);
    setRegulatoryError(null);

    (async () => {
      try {
        const all = await fetchComplianceArtifacts();
        if (cancelled) return;

        const byId = new Map(all.map((a) => [a.id, a]));
        const relevant: ComplianceArtifact[] = [];

        for (const id of refs) {
          const art = byId.get(id);
          if (art) {
            relevant.push(art);
          }
        }

        setRegulatoryArtifacts(relevant);
      } catch (err: any) {
        if (cancelled) return;
        setRegulatoryError(
          err?.message ?? "Failed to load regulatory artifacts for this decision."
        );
      } finally {
        if (cancelled) return;
        setIsLoadingRegulatory(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [decision]);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-3 text-[11px] shadow-sm">
      <header className="mb-2 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-gray-700">
            EMS CSF Sandbox
          </h2>
          <p className="text-[10px] text-gray-500">
            Test EMS controlled substance forms with live decisioning and RAG
            explain.
          </p>

          <div className="mt-1 flex flex-wrap gap-1">
            {EMS_EXAMPLES.map((ex) => (
              <button
                key={ex.id}
                type="button"
                onClick={() => applyEmsExample(ex)}
                className="rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100"
              >
                {ex.label}
              </button>
            ))}
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span className="text-[9px] uppercase tracking-wide text-gray-500">
              Scenario presets
            </span>
            <select
              className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] text-gray-700"
              value={selectedPresetId ?? ""}
              onChange={handlePresetChange}
            >
              <option value="">Manual inputs</option>
              {EMS_CSF_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>

          {activePreset?.verticalLabel && (
            <div className="mt-1 flex items-center gap-2">
              <VerticalBadge label={activePreset.verticalLabel} />
              {activePreset.group && (
                <span className="text-[10px] text-gray-500">{activePreset.group}</span>
              )}
            </div>
          )}

          {activePreset && (
            <p className="text-[10px] text-gray-600">
              Preset: {activePreset.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <SourceDocumentChip
            label="EMS CSF PDF"
            url="/mnt/data/Online Controlled Substance Form - EMS form.pdf"
          />
          <button
            type="button"
            onClick={reset}
            className="text-[10px] text-gray-500 hover:underline"
          >
            Reset
          </button>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        {/* Left: form + evaluate + decision */}
        <div className="space-y-3">
          <form onSubmit={onSubmit} className="space-y-3">
            {/* EMS info */}
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  EMS agency name
                </label>
                <input
                  type="text"
                  value={form.facilityName}
                  onChange={(e) => onChange("facilityName", e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  EMS type
                </label>
                <select
                  value={form.facilityType}
                  onChange={(e) =>
                    onChange("facilityType", e.target.value as EmsFacilityType)
                  }
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                >
                  <option value="facility">Facility</option>
                  <option value="hospital">Hospital</option>
                  <option value="long_term_care">Long-term care</option>
                  <option value="surgical_center">Surgical center</option>
                  <option value="clinic">Clinic</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {/* Licensing & jurisdiction */}
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Account #
                </label>
                <input
                  type="text"
                  value={form.accountNumber ?? ""}
                  onChange={(e) => onChange("accountNumber", e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Ship-to state
                </label>
                <input
                  type="text"
                  value={form.shipToState}
                  onChange={(e) => onChange("shipToState", e.target.value.toUpperCase())}
                  maxLength={2}
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs uppercase"
                />
              </div>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.attestationAccepted}
                    onChange={(e) =>
                      onChange("attestationAccepted", e.target.checked)
                    }
                  />
                  <span>I accept the CSF attestation clause</span>
                </label>
              </div>
            </div>

            {/* Pharmacy license / DEA / pharmacist */}
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Pharmacy license #
                </label>
                <input
                  type="text"
                  value={form.pharmacyLicenseNumber}
                  onChange={(e) =>
                    onChange("pharmacyLicenseNumber", e.target.value)
                  }
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  DEA #
                </label>
                <input
                  type="text"
                  value={form.deaNumber}
                  onChange={(e) => onChange("deaNumber", e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Pharmacist-in-charge name
                </label>
                <input
                  type="text"
                  value={form.pharmacistInChargeName}
                  onChange={(e) =>
                    onChange("pharmacistInChargeName", e.target.value)
                  }
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                />
              </div>
            </div>

            {/* Contact & notes */}
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Pharmacist contact phone (optional)
                </label>
                <input
                  type="text"
                  value={form.pharmacistContactPhone ?? ""}
                  onChange={(e) =>
                    onChange("pharmacistContactPhone", e.target.value)
                  }
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Internal notes (optional)
                </label>
                <textarea
                  value={form.internalNotes ?? ""}
                  onChange={(e) => onChange("internalNotes", e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                  rows={2}
                />
              </div>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <button
                type="submit"
                disabled={isLoading}
                className="rounded-md bg-blue-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? "Evaluating…" : "Evaluate EMS CSF"}
              </button>

              <CopyCurlButton
                label="Copy cURL (evaluate)"
                getCommand={() => buildCurlCommand("/csf/ems/evaluate", form)}
              />
            </div>
          </form>

          {/* Result & error */}
          <div className="space-y-2 text-xs">
            {error && (
              <div className="rounded-md bg-red-50 px-2 py-1 text-red-700">
                {error}
              </div>
            )}

            {decision && (
              <div className="rounded-md bg-gray-50 px-3 py-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                    Decision
                  </span>
                  <span className="rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-medium text-white">
                    {decision.status}
                  </span>
                </div>
                <p className="text-[11px] text-gray-800">{decision.reason}</p>

                {decision.missing_fields.length > 0 && (
                  <div className="mt-2">
                    <div className="text-[11px] font-medium text-gray-700">
                      Missing fields
                    </div>
                    <ul className="list-inside list-disc text-[11px] text-gray-700">
                      {decision.missing_fields.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isExplaining}
                      className="rounded-md bg-slate-700 px-3 py-1 text-[11px] font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                      onClick={handleExplain}
                    >
                      {isExplaining ? "Explaining…" : "Explain decision"}
                    </button>

                    <CopyCurlButton
                      label="Copy cURL (explain)"
                      getCommand={() =>
                        buildCurlCommand("/csf/explain", { decision })
                      }
                    />
                  </div>

                  {explainError && (
                    <div className="rounded-md bg-red-50 px-2 py-1 text-[11px] text-red-700">
                      {explainError}
                    </div>
                  )}

                  {explanation && (
                    <pre className="whitespace-pre-wrap rounded-md bg-white px-2 py-2 text-[11px] text-gray-800 ring-1 ring-gray-200">
                      {explanation}
                    </pre>
                  )}
                </div>

                {/* RAG explain */}
                <div className="mt-3 space-y-1 border-t border-gray-200 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-gray-700">
                      Deep RAG explain (experimental)
                    </span>
                    {isRagLoading && (
                      <span className="text-[10px] text-gray-400">Running RAG…</span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={isRagLoading || !decision}
                    className="rounded-md bg-white px-2 py-1 text-[11px] font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={async () => {
                      if (!decision) return;

                      setIsRagLoading(true);
                      setRagError(null);
                      setRagAnswer(null);

                      const question =
                        "Explain this EMS controlled substance form decision using the referenced regulatory artifacts. " +
                        "Focus on why the status is '" +
                        decision.status +
                        "' and how the EMS CSF form and any state addendums apply.";

                      try {
                        const res = await callRegulatoryRag({
                          question,
                          regulatory_references: decision.regulatory_references ?? [],
                          decision,
                        });

                        setRagAnswer(res.answer);

                        // Optional: log a Codex command for DevSupport
                        trackSandboxEvent(
                          "rag_regulatory_explain_ems",
                          {
                            question,
                            regulatory_references:
                              decision.regulatory_references ?? [],
                            decision,
                            controlled_substances: controlledSubstances,
                            source_document:
                              "/mnt/data/Online Controlled Substance Form - EMS form.pdf",
                          }
                        );
                      } catch (err: any) {
                        setRagError(
                          err?.message ??
                            "Failed to call RAG explain for this decision."
                        );
                      } finally {
                        setIsRagLoading(false);
                      }
                    }}
                  >
                    {isRagLoading ? "Running RAG…" : "Deep RAG explain"}
                  </button>

                  {ragError && (
                    <div className="rounded-md bg-red-50 px-2 py-1 text-[11px] text-red-700">
                      {ragError}
                    </div>
                  )}

                  {ragAnswer && (
                    <pre className="whitespace-pre-wrap rounded-md bg-white px-2 py-2 text-[11px] text-gray-800 ring-1 ring-gray-200">
                      {ragAnswer}
                    </pre>
                  )}
                </div>

                {/* Regulatory basis pills */}
                {decision.regulatory_references?.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-gray-700">
                        Regulatory basis
                      </span>
                      {isLoadingRegulatory && (
                        <span className="text-[10px] text-gray-400">Loading…</span>
                      )}
                    </div>

                    {regulatoryError && (
                      <div className="rounded-md bg-red-50 px-2 py-1 text-[11px] text-red-700">
                        {regulatoryError}
                      </div>
                    )}

                    {!regulatoryError &&
                      regulatoryArtifacts.length === 0 &&
                      !isLoadingRegulatory && (
                        <div className="text-[11px] text-gray-400">
                          No matching artifacts found for: {decision.regulatory_references.join(", ")}.
                        </div>
                      )}

                    {regulatoryArtifacts.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {regulatoryArtifacts.map((art) => (
                          <span
                            key={art.id}
                            className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-800 ring-1 ring-indigo-100"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                            <span>{art.name}</span>
                            <span className="text-[9px] text-indigo-500">
                              [{art.jurisdiction}]
                            </span>
                            {art.source_document && (
                              <span className="text-[9px] text-indigo-400">({art.id})</span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Codex hook for explanations (future) */}
                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    className="rounded-md bg-white px-2 py-1 text-[11px] font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
                    onClick={() => {
                      trackSandboxEvent(
                        "explain_csf_ems_decision",
                        {
                          form,
                          decision,
                          controlled_substances: controlledSubstances,
                          source_document:
                            "/mnt/data/Online Controlled Substance Form - EMS form.pdf",
                        }
                      );
                    }}
                  >
                    Ask Codex to explain decision
                  </button>
                  <span className="text-[10px] text-gray-400">
                    Future: narrative explanation for EMS CSF decisions.
                  </span>
                </div>

              </div>
            )}
          </div>
        </div>

        {/* ---- EMS CSF Form Copilot (beta) ---- */}
        <section className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
          <header className="mb-2 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-[11px] font-semibold text-slate-800">
                Form Copilot (beta)
              </h3>
              <p className="text-[10px] text-slate-500">
                Runs the EMS CSF engine on the current form and asks the
                regulatory RAG service to explain what&apos;s allowed or blocked,
                plus what licenses or EMS-specific classifications are missing.
              </p>
            </div>
            <button
              type="button"
              onClick={runEmsCsfCopilot}
              disabled={copilotLoading || !API_BASE}
              className="h-7 rounded-md bg-slate-900 px-3 text-[11px] font-medium text-slate-50 hover:bg-slate-800 disabled:opacity-50"
            >
              {copilotLoading ? "Checking…" : "Check & Explain"}
            </button>
          </header>

          {copilotLoading && (
            <div className="mb-2 text-[10px] text-slate-600">
              Running EMS CSF Copilot…
            </div>
          )}

          {copilotError && (
            <div className="mb-2 rounded-md bg-rose-50 px-2 py-1 text-[10px] text-rose-700">
              {copilotError}
            </div>
          )}

          {copilotResponse && !copilotLoading && (
            <section className="rounded-md bg-slate-50 p-2 text-[10px] text-slate-800">
              <h3 className="mb-1 text-[10px] font-semibold text-slate-700">
                EMS CSF Copilot Explanation
              </h3>

              <div className="mb-2 space-y-0.5">
                <p>
                  <strong>Status:</strong> {copilotResponse.status}
                </p>
                <p>
                  <strong>Reason:</strong> {copilotResponse.reason}
                </p>
              </div>

              {copilotResponse.missing_fields?.length > 0 && (
                <div className="mb-2">
                  <h4 className="text-[10px] font-semibold text-slate-700">
                    Missing or inconsistent fields
                  </h4>
                  <ul className="list-inside list-disc text-[10px] text-slate-700">
                    {copilotResponse.missing_fields.map((field) => (
                      <li key={field}>{field}</li>
                    ))}
                  </ul>
                </div>
              )}

              {copilotResponse.regulatory_references?.length > 0 && (
                <div className="mb-2">
                  <h4 className="text-[10px] font-semibold text-slate-700">
                    Regulatory references
                  </h4>
                  <ul className="list-inside list-disc text-[10px] text-slate-700">
                    {copilotResponse.regulatory_references.map((ref) => (
                      <li key={ref}>{ref}</li>
                    ))}
                  </ul>
                </div>
              )}

              {copilotResponse.rag_explanation && (
                <div className="mb-2">
                  <h4 className="text-[10px] font-semibold text-slate-700">
                    Explanation
                  </h4>
                  <p className="whitespace-pre-wrap text-[10px] leading-snug text-slate-800">
                    {copilotResponse.rag_explanation}
                  </p>
                </div>
              )}

              {copilotResponse.rag_sources?.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-semibold text-slate-700">
                    Sources consulted
                  </h4>
                  <ul className="list-inside list-disc text-[10px] text-slate-700">
                    {copilotResponse.rag_sources.map((source, idx) => (
                      <li key={source.id ?? idx} className="mb-1">
                        <div>
                          <strong>{source.title}</strong>
                          {source.url && (
                            <>
                              {" "}–{" "}
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-700 underline"
                              >
                                open
                              </a>
                            </>
                          )}
                        </div>
                        {source.snippet && (
                          <div className="text-[10px] text-slate-600">
                            {source.snippet}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {!copilotResponse && !copilotLoading && !copilotError && (
            <p className="text-[10px] text-slate-400">
              Click <span className="font-semibold">“Check &amp; Explain”</span>{" "}
              to have AutoComply run the EMS CSF engine on this form and summarize
              what it thinks, including required EMS licenses and missing information.
            </p>
          )}
        </section>

        {/* Right: Controlled Substances panel */}
        <ControlledSubstancesPanel
          accountNumber={form.accountNumber ?? ""}
          value={controlledSubstances}
          onChange={setControlledSubstances}
        />
      </div>
    </section>
  );
}

// src/components/ResearcherCsfSandbox.tsx
import React, { FormEvent, useEffect, useState } from "react";
import {
  ResearcherCsfDecision,
  ResearcherCsfFormData,
  ResearcherFacilityType,
  type ResearcherFormCopilotResponse,
} from "../domain/csfResearcher";
import { evaluateResearcherCsf } from "../api/csfResearcherClient";
import { callResearcherFormCopilot } from "../api/csfResearcherCopilotClient";
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
import { trackSandboxEvent } from "../devsupport/telemetry";
import { buildCurlCommand } from "../utils/curl";
import {
  RESEARCHER_CSF_PRESETS,
  type ResearcherCsfPresetId,
} from "../domain/csfResearcherPresets";
import { VerticalBadge } from "./VerticalBadge";

const RESEARCHER_ENGINE_FAMILY = "csf";
const RESEARCHER_DECISION_TYPE = "csf_researcher";
const RESEARCHER_SANDBOX_ID = "researcher";


type ResearcherExample = {
  id: string;
  label: string;
  overrides: Partial<ResearcherCsfFormData>;
};

const RESEARCHER_EXAMPLES: ResearcherExample[] = RESEARCHER_CSF_PRESETS.map(
  (preset) => ({
    id: preset.id,
    label: preset.label,
    overrides: preset.form,
  })
);

const initialForm: ResearcherCsfFormData = {
  facilityName: "",
  facilityType: "researcher",
  accountNumber: "",
  pharmacyLicenseNumber: "",
  deaNumber: "",
  pharmacistInChargeName: "",
  pharmacistContactPhone: "",
  shipToState: "MA",
  attestationAccepted: false,
  internalNotes: "",
};

export function ResearcherCsfSandbox() {
  const [form, setForm] = useState<ResearcherCsfFormData>(initialForm);
  const [decision, setDecision] = useState<ResearcherCsfDecision | null>(null);
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
    useState<ResearcherCsfPresetId | null>(null);
  const activePreset = selectedPresetId
    ?
      RESEARCHER_CSF_PRESETS.find(
        (preset) => preset.id === selectedPresetId
      ) ?? null
    : null;

  // ---- Researcher CSF Form Copilot state ----
  const [copilotResponse, setCopilotResponse] =
    useState<ResearcherFormCopilotResponse | null>(null);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotError, setCopilotError] = useState<string | null>(null);

  const applyResearcherPreset = (presetId: ResearcherCsfPresetId | null) => {
    if (!presetId) {
      setSelectedPresetId(null);
      return;
    }

    const preset = RESEARCHER_CSF_PRESETS.find(
      (candidate) => candidate.id === presetId
    );
    if (!preset) return;

    setSelectedPresetId(preset.id);
    setForm(preset.form);
    setControlledSubstances(preset.form.controlledSubstances ?? []);
    setDecision(null);
    setExplanation(null);
    setCopilotResponse(null);
    setExplainError(null);
    setCopilotError(null);

    trackSandboxEvent("researcher_csf_preset_applied", {
      engine_family: RESEARCHER_ENGINE_FAMILY,
      decision_type: RESEARCHER_DECISION_TYPE,
      sandbox: RESEARCHER_SANDBOX_ID,
      preset_id: preset.id,
      vertical_label: preset.verticalLabel,
    });
  };

  function applyResearcherExample(example: ResearcherExample) {
    applyResearcherPreset(example.id as ResearcherCsfPresetId);
    const nextForm = {
      ...initialForm,
      ...form,
      ...example.overrides,
    };

    setForm(nextForm);
    if (example.overrides.controlledSubstances) {
      setControlledSubstances(example.overrides.controlledSubstances);
    }

    trackSandboxEvent("csf_researcher_example_selected", {
      engine_family: RESEARCHER_ENGINE_FAMILY,
      decision_type: RESEARCHER_DECISION_TYPE,
      sandbox: RESEARCHER_SANDBOX_ID,
      example_label: example.label ?? example.overrides.facilityName,
      ship_to_state: (example.overrides.shipToState || nextForm.shipToState) ?? "",
    });
  }

  const handlePresetChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const value = (event.target.value as ResearcherCsfPresetId) || null;
    applyResearcherPreset(value);
  };

  const onChange = (field: keyof ResearcherCsfFormData, value: any) => {
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

    trackSandboxEvent("csf_researcher_evaluate_attempt", {
      engine_family: RESEARCHER_ENGINE_FAMILY,
      decision_type: RESEARCHER_DECISION_TYPE,
      sandbox: RESEARCHER_SANDBOX_ID,
      facility_type: form.facilityType,
      ship_to_state: form.shipToState,
    });

    try {
      const result = await evaluateResearcherCsf({
        ...form,
        controlledSubstances,
      });
      setDecision(result);

      trackSandboxEvent("csf_researcher_evaluate_success", {
        engine_family: RESEARCHER_ENGINE_FAMILY,
        decision_type: RESEARCHER_DECISION_TYPE,
        sandbox: RESEARCHER_SANDBOX_ID,
        facility_type: form.facilityType,
        ship_to_state: form.shipToState,
        decision_status: result.status,
      });
    } catch (err: any) {
      setError(err?.message ?? "Failed to evaluate Researcher CSF");
      trackSandboxEvent("csf_researcher_evaluate_error", {
        engine_family: RESEARCHER_ENGINE_FAMILY,
        decision_type: RESEARCHER_DECISION_TYPE,
        sandbox: RESEARCHER_SANDBOX_ID,
        facility_type: form.facilityType,
        ship_to_state: form.shipToState,
        message: String(err?.message || err),
      });
    } finally {
      setIsLoading(false);
    }
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
      const res = await explainCsfDecision("researcher", summary);
      setExplanation(res.explanation);
    } catch (err: any) {
      setExplainError(
        err?.message ?? "Failed to generate CSF decision explanation"
      );
    } finally {
      setIsExplaining(false);
    }
  };

  const runResearcherCsfCopilot = async () => {
    setCopilotLoading(true);
    setCopilotError(null);
    setCopilotResponse(null);

    trackSandboxEvent("csf_researcher_form_copilot_run", {
      engine_family: RESEARCHER_ENGINE_FAMILY,
      decision_type: RESEARCHER_DECISION_TYPE,
      sandbox: RESEARCHER_SANDBOX_ID,
      facility_type: form.facilityType,
      ship_to_state: form.shipToState,
    });

    const defaultCopilotErrorMessage =
      "Researcher CSF Copilot could not run. Please check the form and try again.";

    try {
      const response = await callResearcherFormCopilot({
        ...form,
        controlledSubstances,
      });
      setCopilotResponse(response);

      trackSandboxEvent("csf_researcher_form_copilot_success", {
        engine_family: RESEARCHER_ENGINE_FAMILY,
        decision_type: RESEARCHER_DECISION_TYPE,
        sandbox: RESEARCHER_SANDBOX_ID,
        facility_type: form.facilityType,
        ship_to_state: form.shipToState,
        decision_status: response.status,
      });
    } catch (err: any) {
      const errorMessage = err?.message?.trim()
        ? err.message
        : defaultCopilotErrorMessage;
      setCopilotError(errorMessage);
      trackSandboxEvent("csf_researcher_form_copilot_error", {
        engine_family: RESEARCHER_ENGINE_FAMILY,
        decision_type: RESEARCHER_DECISION_TYPE,
        sandbox: RESEARCHER_SANDBOX_ID,
        facility_type: form.facilityType,
        ship_to_state: form.shipToState,
        message: String(err?.message || err),
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

    const fetchArtifacts = async () => {
      setIsLoadingRegulatory(true);
      setRegulatoryError(null);

      try {
        const response = await fetchComplianceArtifacts(refs);
        if (!cancelled) {
          setRegulatoryArtifacts(response.items);
        }
      } catch (err: any) {
        if (!cancelled) {
          setRegulatoryError(err?.message ?? "Failed to load regulatory artifacts");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingRegulatory(false);
        }
      }
    };

    fetchArtifacts();

    return () => {
      cancelled = true;
    };
  }, [decision]);

  const runRegulatoryRag = async () => {
    if (!decision) return;

    setIsRagLoading(true);
    setRagError(null);
    setRagAnswer(null);

    try {
      const ragResponse = await callRegulatoryRag(
        decision.regulatory_references || [],
        "Explain why the Researcher CSF decision was made and summarize the key compliance rules."
      );

      setRagAnswer(ragResponse.answer || ragResponse.text);
    } catch (err: any) {
      setRagError(err?.message || "Failed to run regulatory RAG");
    } finally {
      setIsRagLoading(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-semibold">Researcher CSF Sandbox</h2>
          <p className="text-gray-600">
            Test Researcher controlled substance forms end-to-end (decision +
            Copilot).
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-900">
          Use this sandbox to simulate Researcher CSF submissions. Fill in the
          form, run the engine, and optionally generate a RAG-backed explanation
          for the decision.
        </p>
      </div>

      {/* Example selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Quick examples
        </label>
        <div className="flex flex-wrap gap-2">
          {RESEARCHER_EXAMPLES.map((example) => (
            <button
              key={example.id}
              onClick={() => applyResearcherExample(example)}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm"
            >
              {example.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs">
          <span className="text-[10px] uppercase tracking-wide text-gray-500">
            Scenario presets
          </span>
          <select
            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] text-gray-700"
            value={selectedPresetId ?? ""}
            onChange={handlePresetChange}
          >
            <option value="">Manual inputs</option>
            {RESEARCHER_CSF_PRESETS.map((preset) => (
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

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Facility / Lab name
            </label>
            <input
              type="text"
              value={form.facilityName}
              onChange={(e) => onChange("facilityName", e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Research institution name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Facility type
            </label>
            <select
              value={form.facilityType}
              onChange={(e) =>
                onChange("facilityType", e.target.value as ResearcherFacilityType)
              }
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="researcher">Researcher</option>
              <option value="facility">Facility</option>
              <option value="hospital">Hospital</option>
              <option value="long_term_care">Long-term care</option>
              <option value="surgical_center">Surgical center</option>
              <option value="clinic">Clinic</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Account number
            </label>
            <input
              type="text"
              value={form.accountNumber || ""}
              onChange={(e) => onChange("accountNumber", e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Optional customer account"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Pharmacy license number
            </label>
            <input
              type="text"
              value={form.pharmacyLicenseNumber}
              onChange={(e) =>
                onChange("pharmacyLicenseNumber", e.target.value)
              }
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="License or authorization"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              DEA number
            </label>
            <input
              type="text"
              value={form.deaNumber}
              onChange={(e) => onChange("deaNumber", e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="DEA number"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Pharmacist in charge
            </label>
            <input
              type="text"
              value={form.pharmacistInChargeName}
              onChange={(e) =>
                onChange("pharmacistInChargeName", e.target.value)
              }
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Responsible pharmacist or contact"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Pharmacist contact phone
            </label>
            <input
              type="text"
              value={form.pharmacistContactPhone || ""}
              onChange={(e) =>
                onChange("pharmacistContactPhone", e.target.value)
              }
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Optional contact phone"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Ship-to state
            </label>
            <input
              type="text"
              value={form.shipToState}
              onChange={(e) => onChange("shipToState", e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="State abbreviation"
              maxLength={2}
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Internal notes
            </label>
            <textarea
              value={form.internalNotes || ""}
              onChange={(e) => onChange("internalNotes", e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              rows={2}
              placeholder="Optional notes for support or compliance"
            />
          </div>

          <div className="md:col-span-2">
            <div className="flex items-center space-x-2 mt-2">
              <input
                id="attestation"
                type="checkbox"
                checked={form.attestationAccepted}
                onChange={(e) => onChange("attestationAccepted", e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="attestation" className="text-sm text-gray-700">
                I confirm the Researcher CSF attestation is accepted
              </label>
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          <ControlledSubstancesPanel
            accountNumber={form.accountNumber ?? ""}
            value={controlledSubstances}
            onChange={setControlledSubstances}
          />
        </div>

        {error && <div className="text-red-600 text-sm">{error}</div>}

        <div className="flex items-center space-x-3">
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            disabled={isLoading}
          >
            {isLoading ? "Evaluating…" : "Evaluate Researcher CSF"}
          </button>

        <CopyCurlButton
          getCommand={() => buildCurlCommand("/csf/researcher/evaluate", form)}
        />
      </div>
      </form>

      {/* Decision results */}
      {decision && (
        <div className="mt-6 p-4 border rounded-lg bg-gray-50">
          <h3 className="font-semibold">Decision</h3>
          <p className="text-sm text-gray-800">Status: {decision.status}</p>
          <p className="text-sm text-gray-800">Reason: {decision.reason}</p>

          {decision.missing_fields?.length ? (
            <p className="text-sm text-gray-800">
              Missing fields: {decision.missing_fields.join(", ")}
            </p>
          ) : null}

          {decision.regulatory_references?.length ? (
            <div className="mt-2">
              <h4 className="text-sm font-medium">Regulatory references</h4>
              <div className="flex flex-wrap gap-2 mt-1">
                {decision.regulatory_references.map((ref) => (
                  <SourceDocumentChip key={ref} id={ref} />
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={handleExplain}
              className="px-3 py-2 bg-gray-800 text-white rounded hover:bg-gray-900 text-sm"
              disabled={isExplaining}
            >
              {isExplaining ? "Explaining…" : "Explain decision"}
            </button>
            <button
              type="button"
              onClick={runRegulatoryRag}
              className="px-3 py-2 bg-blue-100 text-blue-800 rounded hover:bg-blue-200 text-sm"
              disabled={isRagLoading}
            >
              {isRagLoading ? "Running RAG…" : "Explain with RAG"}
            </button>
          </div>

          {explainError && (
            <div className="text-sm text-red-600 mt-2">{explainError}</div>
          )}
          {explanation && (
            <div className="mt-3 p-3 bg-white border rounded">
              <h4 className="text-sm font-medium">Engine explanation</h4>
              <p className="text-sm text-gray-800 whitespace-pre-line">
                {explanation}
              </p>
            </div>
          )}

          {ragError && (
            <div className="text-sm text-red-600 mt-2">{ragError}</div>
          )}
          {ragAnswer && (
            <div className="mt-3 p-3 bg-white border rounded">
              <h4 className="text-sm font-medium">Regulatory RAG</h4>
              <p className="text-sm text-gray-800 whitespace-pre-line">
                {ragAnswer}
              </p>
            </div>
          )}

          {isLoadingRegulatory && (
            <p className="text-sm text-gray-600 mt-2">Loading artifacts…</p>
          )}
          {regulatoryError && (
            <p className="text-sm text-red-600 mt-2">{regulatoryError}</p>
          )}
          {regulatoryArtifacts.length > 0 && (
            <div className="mt-3">
              <h4 className="text-sm font-medium">Referenced artifacts</h4>
              <ul className="list-disc ml-5 text-sm text-gray-800">
                {regulatoryArtifacts.map((artifact) => (
                  <li key={artifact.id}>
                    <span className="font-medium">{artifact.name}</span> —
                    {" "}
                    {artifact.notes || artifact.jurisdiction}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Researcher Copilot */}
      <section className="mt-6 p-4 border rounded-lg bg-white">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">
              Researcher CSF Copilot (beta)
            </h3>
            <p className="text-sm text-gray-600">
              Runs the Researcher CSF engine on the current form and asks the
              regulatory RAG service to explain what&apos;s allowed or blocked.
            </p>
          </div>
          <button
            type="button"
            onClick={runResearcherCsfCopilot}
            disabled={copilotLoading}
            className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm disabled:opacity-60"
          >
            {copilotLoading ? "Running Copilot…" : "Check & Explain"}
          </button>
        </div>

        {copilotLoading && (
          <p className="mt-2 text-sm text-gray-700">
            Running Researcher CSF Copilot…
          </p>
        )}

        {copilotError && (
          <div className="mt-2 rounded-md bg-rose-50 px-2 py-1 text-sm text-rose-700">
            {copilotError}
          </div>
        )}

        {copilotResponse && (
          <div className="mt-3 p-3 bg-gray-50 border rounded space-y-2">
            <h4 className="text-sm font-medium">Researcher CSF Copilot</h4>
            <p className="text-sm text-gray-800">Status: {copilotResponse.status}</p>
            <p className="text-sm text-gray-800">Reason: {copilotResponse.reason}</p>
            {copilotResponse.missing_fields?.length ? (
              <p className="text-sm text-gray-800">
                Missing fields: {copilotResponse.missing_fields.join(", ")}
              </p>
            ) : null}
            {copilotResponse.regulatory_references?.length ? (
              <div>
                <h5 className="text-sm font-medium">Regulatory references</h5>
                <div className="flex flex-wrap gap-2 mt-1">
                  {copilotResponse.regulatory_references.map((ref) => (
                    <SourceDocumentChip key={ref} id={ref} />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-2">
              <h5 className="text-sm font-medium">RAG explanation</h5>
              <p className="text-sm text-gray-800 whitespace-pre-line">
                {copilotResponse.rag_explanation}
              </p>
            </div>

            {copilotResponse.rag_sources?.length ? (
              <div>
                <h5 className="text-sm font-medium">RAG sources</h5>
                <ul className="list-disc ml-5 text-sm text-gray-800">
                  {copilotResponse.rag_sources.map((source, idx) => (
                    <li key={idx}>
                      <span className="font-medium">{source.title}</span>
                      {source.snippet ? ` — ${source.snippet}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

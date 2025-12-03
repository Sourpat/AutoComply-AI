// src/components/FacilityCsfSandbox.tsx
import React, { FormEvent, useEffect, useState } from "react";
import {
  FacilityCsfDecision,
  FacilityCsfFormData,
  FacilityFacilityType,
} from "../domain/csfFacility";
import { evaluateFacilityCsf } from "../api/csfFacilityClient";
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
import { emitCodexCommand } from "../utils/codexLogger";
import { callFacilityFormCopilot } from "../api/csfFacilityCopilotClient";
import type { FacilityFormCopilotResponse } from "../domain/csfFacility";
import { API_BASE } from "../api/csfHospitalClient";
import {
  OhioTdddDecision,
  OhioTdddFormData,
} from "../domain/licenseOhioTddd";
import { evaluateOhioTdddLicense } from "../api/licenseOhioTdddClient";
import { mapFacilityFormToOhioTddd } from "../domain/licenseMapping";
import { trackSandboxEvent } from "../devsupport/telemetry";

const FACILITY_ENGINE_FAMILY = "csf";
const FACILITY_DECISION_TYPE = "csf_facility";
const FACILITY_SANDBOX_ID = "facility";

type FacilityCsfExampleId =
  | "clinic_chain"
  | "long_term_care"
  | "ambulatory_surgery";

type FacilityCsfExample = {
  id: FacilityCsfExampleId;
  label: string;
  description: string;
  formData: FacilityCsfFormData;
};

const FACILITY_EXAMPLES: FacilityCsfExample[] = [
  {
    id: "clinic_chain",
    label: "Multi-site clinic chain (happy path)",
    description:
      "Multi-location outpatient clinic in Ohio with a clean CSF and an active TDDD license. Should come back ok_to_ship.",
    formData: {
      facilityName: "SummitCare Clinics – East Region",
      facilityType: "facility",
      accountNumber: "ACCT-445210",
      pharmacyLicenseNumber: "PHOH-76321",
      deaNumber: "BS1234567",
      pharmacistInChargeName: "Dr. Alexis Monroe",
      pharmacistContactPhone: "614-555-0198",
      shipToState: "OH",
      attestationAccepted: true,
      internalNotes:
        "Multi-site clinic chain using central inventory with strict CS controls.",
      controlledSubstances: [
        {
          id: "oxycodone_5mg",
          name: "Oxycodone 5mg",
          ndc: "00406-0512-01",
          dea_schedule: "II",
        },
        {
          id: "morphine_10mg_ml",
          name: "Morphine 10mg/mL",
          ndc: "00517-5510-25",
          dea_schedule: "II",
        },
      ],
    },
  },
  {
    id: "long_term_care",
    label: "Long-term care facility (needs review)",
    description:
      "Long-term care facility in Ohio with a valid CSF but TDDD license expiring soon. Good for a needs_review outcome.",
    formData: {
      facilityName: "Maple Grove Long-Term Care",
      facilityType: "facility",
      accountNumber: "ACCT-882901",
      pharmacyLicenseNumber: "PHOH-99872",
      deaNumber: "BM2345678",
      pharmacistInChargeName: "Dr. Priya Narayan",
      pharmacistContactPhone: "330-555-0144",
      shipToState: "OH",
      attestationAccepted: true,
      internalNotes:
        "TDDD license flagged as expiring within 30 days. Staff requested review before large CS shipment.",
      controlledSubstances: [
        {
          id: "hydromorphone_2mg",
          name: "Hydromorphone 2mg",
          ndc: "0409-2041-01",
          dea_schedule: "II",
        },
      ],
    },
  },
  {
    id: "ambulatory_surgery",
    label: "Ambulatory surgery center (blocked)",
    description:
      "Out-of-state surgery center trying to ship into Ohio without any TDDD on file. Good for a blocked outcome.",
    formData: {
      facilityName: "HarborView Ambulatory Surgery Center",
      facilityType: "facility",
      accountNumber: "ACCT-331507",
      pharmacyLicenseNumber: "",
      deaNumber: "BN3456789",
      pharmacistInChargeName: "Dr. Michael Chen",
      pharmacistContactPhone: "412-555-0113",
      shipToState: "OH",
      attestationAccepted: false,
      internalNotes:
        "New account requesting CS shipment into Ohio. No TDDD or state-level registration on file.",
      controlledSubstances: [
        {
          id: "fentanyl_100mcg",
          name: "Fentanyl 100 mcg",
          ndc: "0548-0009-00",
          dea_schedule: "II",
        },
      ],
    },
  },
];

const initialForm: FacilityCsfFormData = {
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

export function FacilityCsfSandbox() {
  const [form, setForm] = useState<FacilityCsfFormData>(initialForm);
  const [decision, setDecision] = useState<FacilityCsfDecision | null>(null);
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
  const [ohioTdddDecision, setOhioTdddDecision] =
    useState<OhioTdddDecision | null>(null);
  const [ohioTdddLoading, setOhioTdddLoading] = useState(false);
  const [ohioTdddError, setOhioTdddError] = useState<string | null>(null);
  const [selectedExampleId, setSelectedExampleId] =
    useState<FacilityCsfExampleId>("clinic_chain");

  // ---- Facility CSF Form Copilot state ----
  const [copilotResponse, setCopilotResponse] =
    useState<FacilityFormCopilotResponse | null>(null);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotError, setCopilotError] = useState<string | null>(null);

  function applyFacilityExample(example: FacilityCsfExample) {
    setSelectedExampleId(example.id);
    setForm(example.formData);
    setControlledSubstances(example.formData.controlledSubstances ?? []);

    emitCodexCommand("csf_facility_example_selected", {
      engine_family: FACILITY_ENGINE_FAMILY,
      decision_type: FACILITY_DECISION_TYPE,
      sandbox: FACILITY_SANDBOX_ID,
      example_id: example.id,
      example_label: example.label,
      facility_type: example.formData.facilityType,
      ship_to_state: example.formData.shipToState,
    });
  }

  const onChange = (field: keyof FacilityCsfFormData, value: any) => {
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

    emitCodexCommand("csf_facility_evaluate_attempt", {
      engine_family: FACILITY_ENGINE_FAMILY,
      decision_type: FACILITY_DECISION_TYPE,
      sandbox: FACILITY_SANDBOX_ID,
      facility_type: form.facilityType,
      ship_to_state: form.shipToState,
    });

    try {
      const result = await evaluateFacilityCsf({
        ...form,
        controlledSubstances,
      });
      setDecision(result);

      emitCodexCommand("csf_facility_evaluate_success", {
        engine_family: FACILITY_ENGINE_FAMILY,
        decision_type: FACILITY_DECISION_TYPE,
        sandbox: FACILITY_SANDBOX_ID,
        facility_type: form.facilityType,
        ship_to_state: form.shipToState,
        decision_status: result.status,
      });
    } catch (err: any) {
      setError(err?.message ?? "Failed to evaluate Facility CSF");

      emitCodexCommand("csf_facility_evaluate_error", {
        engine_family: FACILITY_ENGINE_FAMILY,
        decision_type: FACILITY_DECISION_TYPE,
        sandbox: FACILITY_SANDBOX_ID,
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

    setOhioTdddDecision(null);
    setOhioTdddError(null);
    setOhioTdddLoading(false);

    setRegulatoryArtifacts([]);
    setRegulatoryError(null);
    setIsLoadingRegulatory(false);
  };

  async function handleOhioTdddCheck() {
    if ((form as any).shipToState && (form as any).shipToState !== "OH") {
      setOhioTdddError(
        "Ohio TDDD license check is primarily relevant when ship-to state is OH."
      );
      setOhioTdddDecision(null);
      return;
    }

    setOhioTdddLoading(true);
    setOhioTdddError(null);
    setOhioTdddDecision(null);

    const payload: OhioTdddFormData = mapFacilityFormToOhioTddd(form);

    trackSandboxEvent("license_ohio_tddd_from_facility_csf_attempt", {
      engine_family: "license",
      decision_type: "license_ohio_tddd",
      sandbox: "facility_csf",
      ship_to_state: payload.shipToState,
    });

    try {
      const result = await evaluateOhioTdddLicense(payload);
      setOhioTdddDecision(result);

      trackSandboxEvent("license_ohio_tddd_from_facility_csf_success", {
        engine_family: "license",
        decision_type: "license_ohio_tddd",
        sandbox: "facility_csf",
        status: result.status,
      });
    } catch (err: any) {
      const message =
        err?.message ??
        "Ohio TDDD license evaluation could not run. Please try again.";
      setOhioTdddError(message);

      trackSandboxEvent("license_ohio_tddd_from_facility_csf_error", {
        engine_family: "license",
        decision_type: "license_ohio_tddd",
        sandbox: "facility_csf",
        error: String(err),
      });
    } finally {
      setOhioTdddLoading(false);
    }
  }

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
      const res = await explainCsfDecision("facility", summary);
      setExplanation(res.explanation);
    } catch (err: any) {
      setExplainError(
        err?.message ?? "Failed to generate CSF decision explanation"
      );
    } finally {
      setIsExplaining(false);
    }
  };

  const runFacilityCsfCopilot = async () => {
    setCopilotLoading(true);
    setCopilotError(null);
    setCopilotResponse(null);

    emitCodexCommand("csf_facility_form_copilot_run", {
      engine_family: FACILITY_ENGINE_FAMILY,
      decision_type: FACILITY_DECISION_TYPE,
      sandbox: FACILITY_SANDBOX_ID,
      facility_type: form.facilityType,
      ship_to_state: form.shipToState,
    });

    try {
      if (!API_BASE) {
        throw new Error(
          "Sandbox misconfigured: missing API base URL. Please set VITE_API_BASE in your environment before using Facility CSF tools."
        );
      }

      const copilotResponse = await callFacilityFormCopilot({
        ...form,
        controlledSubstances,
      });

      setCopilotResponse(copilotResponse);

      emitCodexCommand("csf_facility_form_copilot_success", {
        engine_family: FACILITY_ENGINE_FAMILY,
        decision_type: FACILITY_DECISION_TYPE,
        sandbox: FACILITY_SANDBOX_ID,
        decision_outcome: copilotResponse.status ?? "unknown",
        reason: copilotResponse.reason,
        missing_fields: copilotResponse.missing_fields ?? [],
        regulatory_references: copilotResponse.regulatory_references ?? [],
      });
    } catch (err: any) {
      console.error(err);
      setCopilotError(
        err?.message ||
          "Facility CSF Copilot could not run. Please check the form and try again."
      );

      emitCodexCommand("csf_facility_form_copilot_error", {
        engine_family: FACILITY_ENGINE_FAMILY,
        decision_type: FACILITY_DECISION_TYPE,
        sandbox: FACILITY_SANDBOX_ID,
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
            Facility CSF Sandbox
          </h2>
          <p className="text-[10px] text-gray-500">
            Test facility controlled substance forms with live decisioning and
            RAG explain.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SourceDocumentChip
            label="Facility CSF PDF"
            url="/mnt/data/Online Controlled Substance Form - Facility.pdf"
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

      <section className="mt-3">
        <p className="text-xs font-medium text-slate-300">
          Realistic facility examples
        </p>
        <p className="mt-1 text-[11px] text-slate-400">
          Use these presets when you&apos;re demoing the Facility CSF engine:
          clinic chain, long-term care, and an out-of-state surgery center.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {FACILITY_EXAMPLES.map((example) => {
            const isActive = example.id === selectedExampleId;
            return (
              <button
                key={example.id}
                type="button"
                onClick={() => applyFacilityExample(example)}
                className={[
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium transition",
                  isActive
                    ? "border-cyan-400 bg-cyan-500/15 text-cyan-100"
                    : "border-slate-700 bg-slate-900/80 text-slate-200 hover:border-slate-500 hover:bg-slate-800",
                ].join(" ")}
              >
                <span>{example.label}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-1 text-[11px] text-slate-400">
          {FACILITY_EXAMPLES.find((ex) => ex.id === selectedExampleId)?.description}
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        {/* Left: form + evaluate + decision */}
        <div className="space-y-3">
          <form onSubmit={onSubmit} className="space-y-3">
            {/* Facility info */}
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Facility name
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
                  Facility type
                </label>
                <select
                  value={form.facilityType}
                  onChange={(e) =>
                    onChange("facilityType", e.target.value as FacilityFacilityType)
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
                {isLoading ? "Evaluating…" : "Evaluate Facility CSF"}
              </button>

              <CopyCurlButton
                label="Copy cURL (evaluate)"
                endpoint="/csf/facility/evaluate"
                body={form}
                disabled={isLoading}
                sandboxId={FACILITY_SANDBOX_ID}
                decisionType={FACILITY_DECISION_TYPE}
                engineFamily={FACILITY_ENGINE_FAMILY}
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
                      endpoint="/csf/explain"
                      body={{ decision }}
                      disabled={isExplaining}
                      sandboxId={FACILITY_SANDBOX_ID}
                      decisionType={FACILITY_DECISION_TYPE}
                      engineFamily={FACILITY_ENGINE_FAMILY}
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
                        "Explain this facility controlled substance form decision using the referenced regulatory artifacts. " +
                        "Focus on why the status is '" +
                        decision.status +
                        "' and how the facility CSF form and any state addendums apply.";

                      try {
                        const res = await callRegulatoryRag({
                          question,
                          regulatory_references: decision.regulatory_references ?? [],
                          decision,
                        });

                        setRagAnswer(res.answer);

                        // Optional: log a Codex command for DevSupport
                        emitCodexCommand(
                          "rag_regulatory_explain_facility",
                          {
                            question,
                            regulatory_references:
                              decision.regulatory_references ?? [],
                            decision,
                            controlled_substances: controlledSubstances,
                            source_document:
                              "/mnt/data/Online Controlled Substance Form - Facility.pdf",
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
                      emitCodexCommand(
                        "explain_csf_facility_decision",
                        {
                          form,
                          decision,
                          controlled_substances: controlledSubstances,
                          source_document:
                            "/mnt/data/Online Controlled Substance Form - Facility.pdf",
                        }
                      );
                    }}
                  >
                    Ask Codex to explain decision
                  </button>
                  <span className="text-[10px] text-gray-400">
                    Future: narrative explanation for facility CSF decisions.
                  </span>
                </div>

              </div>
            )}
          </div>
        </div>

        <section className="sandbox-section sandbox-section--ohio-tddd">
          <h3>Ohio TDDD License Check (Optional)</h3>
          <p className="sandbox-helper">
            Use this to validate Ohio TDDD license information for this Facility
            CSF. This is most relevant when <code>ship-to state = OH</code>.
          </p>

          <div className="sandbox-actions">
            <button
              type="button"
              onClick={handleOhioTdddCheck}
              disabled={ohioTdddLoading}
            >
              {ohioTdddLoading
                ? "Checking Ohio TDDD..."
                : "Run Ohio TDDD license check"}
            </button>
            <a href="/license/ohio-tddd" target="_blank" rel="noreferrer">
              Open full Ohio TDDD License Sandbox
            </a>
          </div>

          {ohioTdddError && <p className="error">{ohioTdddError}</p>}

          {ohioTdddDecision && (
            <div className="decision-panel decision-panel--ohio-tddd">
              <p>
                <strong>Ohio TDDD status:</strong> {ohioTdddDecision.status}
              </p>
              <p>
                <strong>Reason:</strong> {ohioTdddDecision.reason}
              </p>
              {ohioTdddDecision.missingFields?.length > 0 && (
                <p>
                  <strong>Missing fields:</strong>{" "}
                  {ohioTdddDecision.missingFields.join(", ")}
                </p>
              )}
            </div>
          )}
        </section>

        {/* ---- Facility CSF Form Copilot (beta) ---- */}
        <section className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
          <header className="mb-2 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-[11px] font-semibold text-slate-800">
                Form Copilot (beta)
              </h3>
              <p className="text-[10px] text-slate-500">
                Runs the Facility CSF engine on the current form and asks the
                regulatory RAG service to explain what&apos;s allowed or blocked,
                plus what licenses or facility classifications are missing.
              </p>
            </div>
            <button
              type="button"
              onClick={runFacilityCsfCopilot}
              disabled={copilotLoading || !API_BASE}
              className="h-7 rounded-md bg-slate-900 px-3 text-[11px] font-medium text-slate-50 hover:bg-slate-800 disabled:opacity-50"
            >
              {copilotLoading ? "Checking…" : "Check & Explain"}
            </button>
          </header>

          {copilotLoading && (
            <div className="mb-2 text-[10px] text-slate-600">
              Running Facility CSF Copilot…
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
                Facility CSF Copilot Explanation
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
              to have AutoComply run the Facility CSF engine on this form and summarize
              what it thinks, including required facility licenses and missing information.
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

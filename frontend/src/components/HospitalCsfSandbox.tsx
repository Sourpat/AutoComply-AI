// src/components/HospitalCsfSandbox.tsx
import { FormEvent, useEffect, useState } from "react";
import {
  HospitalCsfDecision,
  HospitalCsfFormData,
  HospitalFacilityType,
} from "../domain/csfHospital";
import { evaluateHospitalCsf } from "../api/csfHospitalClient";
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

const API_BASE = (import.meta as any).env?.VITE_API_BASE || "";

type HospitalExample = {
  id: string;
  label: string;
  overrides: Partial<HospitalCsfFormData>;
};

const HOSPITAL_EXAMPLES: HospitalExample[] = [
  {
    id: "fl_level1_trauma_schedule_ii",
    label: "FL – Level 1 trauma, Schedule II",
    overrides: {
      facilityName: "Sunrise Regional Medical Center",
      facilityType: "hospital",
      accountNumber: "ACC-HOSP-001",
      shipToState: "FL",
      attestationAccepted: true,
    },
  },
];

const initialForm: HospitalCsfFormData = {
  facilityName: "",
  facilityType: "hospital",
  accountNumber: "",
  pharmacyLicenseNumber: "",
  deaNumber: "",
  pharmacistInChargeName: "",
  pharmacistContactPhone: "",
  shipToState: "OH",
  attestationAccepted: false,
  internalNotes: "",
};

export function HospitalCsfSandbox() {
  const [form, setForm] = useState<HospitalCsfFormData>(initialForm);
  const [decision, setDecision] = useState<HospitalCsfDecision | null>(null);
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

  // ---- Hospital CSF Form Copilot state ----
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotDecision, setCopilotDecision] = useState<any | null>(null);
  const [copilotExplanation, setCopilotExplanation] =
    useState<string | null>(null);
  const [copilotError, setCopilotError] = useState<string | null>(null);

  function applyHospitalExample(example: HospitalExample) {
    const nextForm = {
      ...initialForm,
      ...form,
      ...example.overrides,
    };

    setForm(nextForm);

    emitCodexCommand("csf_hospital_example_selected", {
      example_id: example.id,
      label: example.label,
      form: nextForm,
      source_document:
        "/mnt/data/Online Controlled Substance Form - Hospital Pharmacy.pdf",
    });
  }

  const onChange = (field: keyof HospitalCsfFormData, value: any) => {
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

    try {
      const result = await evaluateHospitalCsf({
        ...form,
      });
      setDecision(result);
    } catch (err: any) {
      setError(err?.message ?? "Failed to evaluate Hospital CSF");
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
      const res = await explainCsfDecision("hospital", summary);
      setExplanation(res.explanation);
    } catch (err: any) {
      setExplainError(
        err?.message ?? "Failed to generate CSF decision explanation"
      );
    } finally {
      setIsExplaining(false);
    }
  };

  const runHospitalCsfCopilot = async () => {
    if (!API_BASE) return;

    setCopilotLoading(true);
    setCopilotError(null);
    setCopilotExplanation(null);
    setCopilotDecision(null);

    try {
      // 1) Run the Hospital CSF decision engine
      const evalResp = await fetch(`${API_BASE}/csf/hospital/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // If your state is named differently, replace `form` accordingly.
        body: JSON.stringify(form),
      });

      if (!evalResp.ok) {
        throw new Error(`Hospital CSF evaluate failed: ${evalResp.status}`);
      }

      const evalJson = await evalResp.json();
      const decision =
        (evalJson.decision as any) ??
        (evalJson.verdict as any) ??
        evalJson;

      setCopilotDecision(decision);

      emitCodexCommand("csf_hospital_form_copilot_run", {
        engine_family: "csf",
        decision_type: "csf_hospital",
        outcome: decision.outcome ?? decision.status ?? "unknown",
      });

      // 2) Ask RAG to explain what this means / what’s missing
      const ragResp = await fetch(`${API_BASE}/rag/regulatory-explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question:
            "Explain for a verification specialist what this Hospital Pharmacy CSF decision means, including what controlled-substance licenses or hospital classifications are required for this location to receive controlled drugs. Be concise and actionable.",
          decision,
          regulatory_references: [],
        }),
      });

      if (!ragResp.ok) {
        throw new Error(`RAG explain failed: ${ragResp.status}`);
      }

      const ragJson = await ragResp.json();
      const answer =
        (ragJson.answer as string) ??
        (ragJson.text as string) ??
        JSON.stringify(ragJson, null, 2);

      setCopilotExplanation(answer);

      emitCodexCommand("csf_hospital_form_copilot_complete", {
        engine_family: "csf",
        decision_type: "csf_hospital",
        outcome: decision.outcome ?? decision.status ?? "unknown",
      });
    } catch (err: any) {
      console.error(err);
      setCopilotError(
        "Hospital CSF Copilot could not run. Check the console or try again."
      );
      emitCodexCommand("csf_hospital_form_copilot_error", {
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
            Hospital CSF Sandbox
          </h2>
          <p className="text-[10px] text-gray-500">
            Test hospital controlled substance forms with live decision and RAG
            explain.
          </p>

          <div className="mt-1 flex flex-wrap gap-1">
            {HOSPITAL_EXAMPLES.map((ex) => (
              <button
                key={ex.id}
                type="button"
                onClick={() => applyHospitalExample(ex)}
                className="rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100"
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SourceDocumentChip
            label="Hospital CSF PDF"
            url="/mnt/data/Online Controlled Substance Form - Hospital Pharmacy.pdf"
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
                    onChange("facilityType", e.target.value as HospitalFacilityType)
                  }
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                >
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
                {isLoading ? "Evaluating…" : "Evaluate Hospital CSF"}
              </button>

              <CopyCurlButton
                label="Copy cURL (evaluate)"
                endpoint="/csf/hospital/evaluate"
                body={form}
                disabled={isLoading}
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
                        "Explain this hospital controlled substance form decision using the referenced regulatory artifacts. " +
                        "Focus on why the status is '" +
                        decision.status +
                        "' and how the hospital CSF form and any state addendums apply.";

                      try {
                        const res = await callRegulatoryRag({
                          question,
                          regulatory_references: decision.regulatory_references ?? [],
                          decision,
                        });

                        setRagAnswer(res.answer);

                        // Optional: log a Codex command for DevSupport
                        emitCodexCommand(
                          "rag_regulatory_explain_hospital",
                          {
                            question,
                            regulatory_references:
                              decision.regulatory_references ?? [],
                            decision,
                            controlled_substances: controlledSubstances,
                            source_document:
                              "/mnt/data/Online Controlled Substance Form - Hospital Pharmacy.pdf",
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
                        "explain_csf_hospital_decision",
                        {
                          form,
                          decision,
                          controlled_substances: controlledSubstances,
                          source_document:
                            "/mnt/data/Online Controlled Substance Form - Hospital Pharmacy.pdf",
                        }
                      );
                    }}
                  >
                    Ask Codex to explain decision
                  </button>
                  <span className="text-[10px] text-gray-400">
                    Future: narrative explanation for hospital CSF decisions.
                  </span>
                </div>

                {/* ---- Hospital CSF Form Copilot (beta) ---- */}
                <section className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                  <header className="mb-2 flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-[11px] font-semibold text-slate-800">
                        Hospital CSF Copilot (beta)
                      </h3>
                      <p className="text-[10px] text-slate-500">
                        Runs the Hospital CSF engine on the current form and asks the
                        regulatory RAG service to explain what&apos;s allowed or blocked,
                        plus what licenses or hospital classifications are missing.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={runHospitalCsfCopilot}
                      disabled={copilotLoading || !API_BASE}
                      className="h-7 rounded-md bg-slate-900 px-3 text-[11px] font-medium text-slate-50 hover:bg-slate-800 disabled:opacity-50"
                    >
                      {copilotLoading ? "Checking…" : "Check & Explain"}
                    </button>
                  </header>

                  {copilotError && (
                    <p className="mb-1 text-[10px] text-rose-600">{copilotError}</p>
                  )}

                  {copilotDecision && (
                    <div className="mb-1 rounded-md bg-slate-50 p-2 text-[10px] text-slate-800">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-700">
                          Decision outcome:
                        </span>
                        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[9px] font-medium text-slate-50">
                          {copilotDecision.outcome ??
                            copilotDecision.status ??
                            "See details below"}
                        </span>
                      </div>
                      {copilotDecision.reason && (
                        <p className="text-[10px] text-slate-600">
                          Reason: {String(copilotDecision.reason)}
                        </p>
                      )}
                    </div>
                  )}

                  {copilotExplanation && (
                    <div className="mt-1 rounded-md bg-slate-50 p-2 text-[10px] leading-snug text-slate-800">
                      <div className="mb-1 text-[10px] font-semibold text-slate-700">
                        Copilot explanation
                      </div>
                      <p className="whitespace-pre-wrap">{copilotExplanation}</p>
                    </div>
                  )}

                  {!copilotDecision &&
                    !copilotExplanation &&
                    !copilotLoading &&
                    !copilotError && (
                      <p className="text-[10px] text-slate-400">
                        Click <span className="font-semibold">“Check &amp; Explain”</span>{" "}
                        to have AutoComply run the Hospital CSF engine on this form and
                        summarize what it thinks, including required hospital licenses and
                        missing information.
                      </p>
                    )}
                </section>
              </div>
            )}
          </div>
        </div>

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

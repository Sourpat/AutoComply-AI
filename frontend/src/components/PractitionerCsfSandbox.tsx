// src/components/PractitionerCsfSandbox.tsx
import { useEffect, useState } from "react";
import {
  PractitionerCsfDecision,
  PractitionerCsfFormData,
  PractitionerFacilityType,
} from "../domain/csfPractitioner";
import { evaluatePractitionerCsf } from "../api/csfPractitionerClient";
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

type PractitionerExample = {
  id: string;
  label: string;
  description?: string;
  overrides: Partial<PractitionerCsfFormData>;
  controlledSubstances?: ControlledSubstance[];
};

const PRACTITIONER_EXAMPLES: PractitionerExample[] = [
  {
    id: "fl_schedule_ii_new_practice",
    label: "FL – New practice, Schedule II",
    description:
      "Florida dental practice requesting Oxycodone Schedule II with incomplete license history.",
    overrides: {
      facilityName: "Sunrise Dental Practice",
      facilityType: "dental_practice",
      accountNumber: "ACC-123",
      practitionerName: "Dr. Jane Example",
      stateLicenseNumber: "FL-DENT-12345",
      deaNumber: "DEA1234567",
      shipToState: "FL",
      attestationAccepted: true,
    },
    controlledSubstances: [
      {
        id: "cs_oxycodone_5mg_tab",
        name: "Oxycodone 5 mg tablet",
        strength: "5",
        unit: "mg",
        schedule: "II",
        dea_code: "9143",
      },
    ],
  },
  {
    id: "oh_schedule_ii_clean_history",
    label: "OH – Clean history, Schedule II",
    description:
      "Ohio practice with prior Schedule II history and fully populated licenses.",
    overrides: {
      facilityName: "Buckeye Dental Clinic",
      facilityType: "dental_practice",
      accountNumber: "ACC-123",
      practitionerName: "Dr. John Example",
      stateLicenseNumber: "OH-DENT-67890",
      deaNumber: "DEA7654321",
      shipToState: "OH",
      attestationAccepted: true,
    },
    controlledSubstances: [
      {
        id: "cs_hydrocodone_10_325_tab",
        name: "Hydrocodone/Acetaminophen 10mg/325mg tablet",
        strength: "10/325",
        unit: "mg",
        schedule: "II",
        dea_code: "9193",
      },
    ],
  },
];

const initialForm: PractitionerCsfFormData = {
  facilityName: "",
  facilityType: "dental_practice",
  accountNumber: "",
  practitionerName: "",
  stateLicenseNumber: "",
  deaNumber: "",
  shipToState: "OH",
  attestationAccepted: false,
  internalNotes: "",
};

export function PractitionerCsfSandbox() {
  const [form, setForm] = useState<PractitionerCsfFormData>(initialForm);
  const [decision, setDecision] = useState<PractitionerCsfDecision | null>(null);
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

  function applyPractitionerExample(example: PractitionerExample) {
    const nextForm = {
      ...initialForm,
      ...form,
      ...example.overrides,
    };

    setForm(nextForm);

    if (example.controlledSubstances) {
      setControlledSubstances(example.controlledSubstances);
    }

    emitCodexCommand("csf_practitioner_example_selected", {
      example_id: example.id,
      label: example.label,
      description: example.description,
      form: nextForm,
      controlled_substances: example.controlledSubstances ?? [],
      source_document:
        "/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf",
    });
  }

  const onChange = (field: keyof PractitionerCsfFormData, value: any) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setDecision(null);
    setExplanation(null);
    setExplainError(null);
    setRagAnswer(null);
    setRagError(null);

    try {
      const result = await evaluatePractitionerCsf({
        ...form,
      });
      setDecision(result);
    } catch (err: any) {
      setError(err?.message ?? "Failed to evaluate Practitioner CSF");
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
      const res = await explainCsfDecision("practitioner", summary);
      setExplanation(res.explanation);
    } catch (err: any) {
      setExplainError(
        err?.message ?? "Failed to generate CSF decision explanation"
      );
    } finally {
      setIsExplaining(false);
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
            Practitioner CSF Sandbox
          </h2>
          <p className="text-[10px] text-gray-500">
            Test practitioner controlled substance forms end-to-end.
          </p>

          <div className="mt-1 flex flex-wrap gap-1">
            {PRACTITIONER_EXAMPLES.map((ex) => (
              <button
                key={ex.id}
                type="button"
                onClick={() => applyPractitionerExample(ex)}
                className="rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100"
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SourceDocumentChip
            label="Practitioner CSF PDF"
            url="/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf"
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
        {/* Left: form + results */}
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
                    onChange("facilityType", e.target.value as PractitionerFacilityType)
                  }
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                >
                  <option value="dental_practice">Dental practice</option>
                  <option value="individual_practitioner">Individual practitioner</option>
                  <option value="group_practice">Group practice</option>
                  <option value="clinic">Clinic</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

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

            {/* Practitioner & licensing */}
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Practitioner name
                </label>
                <input
                  type="text"
                  value={form.practitionerName}
                  onChange={(e) => onChange("practitionerName", e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  State license #
                </label>
                <input
                  type="text"
                  value={form.stateLicenseNumber}
                  onChange={(e) => onChange("stateLicenseNumber", e.target.value)}
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
            </div>

            {/* Internal notes */}
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

            <div className="mt-2 flex items-center gap-2">
              <button
                type="submit"
                disabled={isLoading}
                className="rounded-md bg-blue-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? "Evaluating…" : "Evaluate Practitioner CSF"}
              </button>

              <CopyCurlButton
                label="Copy cURL (evaluate)"
                endpoint="/csf/practitioner/evaluate"
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

                {/* Explain decision via /csf/explain */}
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

                {/* NEW: Deep RAG explain via /rag/regulatory-explain */}
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
                        "Explain this practitioner controlled substance form decision using the referenced regulatory artifacts. " +
                        "Focus on why the status is '" +
                        decision.status +
                        "' and how the Florida addendum or base form apply, if relevant.";

                      try {
                        const res = await callRegulatoryRag({
                          question,
                          regulatory_references: decision.regulatory_references ?? [],
                          decision,
                        });

                        setRagAnswer(res.answer);

                        // Optional: log a Codex command for DevSupport
                        emitCodexCommand(
                          "rag_regulatory_explain_practitioner",
                          {
                            question,
                            regulatory_references: decision.regulatory_references ?? [],
                            decision,
                            controlled_substances: controlledSubstances,
                          }
                        );
                      } catch (err: any) {
                        setRagError(
                          err?.message ?? "Failed to call RAG explain for this decision."
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
                          No matching artifacts found for:{" "}
                          {decision.regulatory_references.join(", ")}.
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

                {/* Hook for Codex in a later step */}
                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    className="rounded-md bg-white px-2 py-1 text-[11px] font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
                    onClick={() => {
                      emitCodexCommand(
                        "explain_csf_practitioner_decision",
                        {
                          form,
                          decision,
                          controlled_substances: controlledSubstances,
                          source_document:
                            "/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf",
                        }
                      );
                    }}
                  >
                    Ask Codex to explain decision
                  </button>
                  <span className="text-[10px] text-gray-400">
                    Future: narrative explanation for support/compliance.
                  </span>
                </div>
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

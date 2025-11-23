// src/components/ResearcherCsfSandbox.tsx
import { FormEvent, useEffect, useState } from "react";
import {
  ResearchFacilityType,
  ResearcherCsfDecision,
  ResearcherCsfFormData,
} from "../domain/csfResearcher";
import { ControlledSubstanceItem } from "../domain/controlledSubstances";
import { ControlledSubstancesSearchSection } from "./ControlledSubstancesSearchSection";
import { evaluateResearcherCsf } from "../api/csfResearcherClient";
import { explainCsfDecision } from "../api/csfExplainClient";
import type { CsfDecisionSummary } from "../api/csfExplainClient";
import {
  fetchComplianceArtifacts,
  type ComplianceArtifact,
} from "../api/complianceArtifactsClient";

const initialForm: ResearcherCsfFormData = {
  institutionName: "",
  facilityType: "university",
  accountNumber: "",
  principalInvestigatorName: "",
  researcherTitle: "",
  stateLicenseNumber: "",
  deaNumber: "",
  protocolOrStudyId: "",
  shipToState: "OH",
  attestationAccepted: false,
  internalNotes: "",
};

export function ResearcherCsfSandbox() {
  const [form, setForm] = useState<ResearcherCsfFormData>(initialForm);
  const [decision, setDecision] = useState<ResearcherCsfDecision | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [controlledSubstances, setControlledSubstances] = useState<
    ControlledSubstanceItem[]
  >([]);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [regulatoryArtifacts, setRegulatoryArtifacts] = useState<
    ComplianceArtifact[]
  >([]);
  const [isLoadingRegulatory, setIsLoadingRegulatory] = useState(false);
  const [regulatoryError, setRegulatoryError] = useState<string | null>(null);

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

    try {
      const result = await evaluateResearcherCsf({
        ...form,
        controlledSubstances,
      });
      setDecision(result);
    } catch (err: any) {
      setError(err?.message ?? "Failed to evaluate Researcher CSF");
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

    setRegulatoryArtifacts([]);
    setRegulatoryError(null);
    setIsLoadingRegulatory(false);
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
    <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-sm">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            Researcher CSF Sandbox
          </h2>
          <p className="text-[11px] text-gray-500">
            Evaluate Researcher Controlled Substance Forms using engine rules.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="text-[11px] text-gray-500 hover:underline"
        >
          Reset
        </button>
      </header>

      <form onSubmit={onSubmit} className="space-y-3">
        {/* Institution & facility */}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Institution name
            </label>
            <input
              type="text"
              value={form.institutionName}
              onChange={(e) => onChange("institutionName", e.target.value)}
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
                onChange("facilityType", e.target.value as ResearchFacilityType)
              }
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
            >
              <option value="university">University</option>
              <option value="hospital_research">Hospital research</option>
              <option value="private_lab">Private lab</option>
              <option value="pharma_rnd">Pharma R&amp;D</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {/* Protocol & jurisdiction */}
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
              Protocol / Study ID
            </label>
            <input
              type="text"
              value={form.protocolOrStudyId}
              onChange={(e) => onChange("protocolOrStudyId", e.target.value)}
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
              onChange={(e) =>
                onChange("shipToState", e.target.value.toUpperCase())
              }
              maxLength={2}
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs uppercase"
            />
          </div>
        </div>

        {/* PI & licensing */}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Principal investigator name
            </label>
            <input
              type="text"
              value={form.principalInvestigatorName}
              onChange={(e) =>
                onChange("principalInvestigatorName", e.target.value)
              }
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              PI title (optional)
            </label>
            <input
              type="text"
              value={form.researcherTitle ?? ""}
              onChange={(e) => onChange("researcherTitle", e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
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

        {/* Optional license/DEA & notes */}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              State license # (optional)
            </label>
            <input
              type="text"
              value={form.stateLicenseNumber ?? ""}
              onChange={(e) =>
                onChange("stateLicenseNumber", e.target.value)
              }
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              DEA # (optional)
            </label>
            <input
              type="text"
              value={form.deaNumber ?? ""}
              onChange={(e) => onChange("deaNumber", e.target.value)}
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
            className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Evaluating…" : "Evaluate Researcher CSF"}
          </button>
        </div>
      </form>

      {/* Result & error */}
      <div className="mt-4 space-y-2 text-xs">
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
              <button
                type="button"
                disabled={isExplaining}
                className="rounded-md bg-white px-2 py-1 text-[11px] font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={async () => {
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
                }}
              >
                {isExplaining ? "Explaining…" : "Explain decision"}
              </button>

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

            {/* Codex hook */}
            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                className="rounded-md bg-white px-2 py-1 text-[11px] font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
                onClick={() => {
                  console.log(
                    "CODEX_COMMAND: explain_csf_researcher_decision",
                    {
                      form,
                      decision,
                      controlled_substances: controlledSubstances,
                      source_document:
                        "/mnt/data/Online Controlled Substance Form - Researcher form.pdf",
                    }
                  );
                }}
              >
                Ask Codex to explain decision
              </button>
              <span className="text-[10px] text-gray-400">
                Future: narrative explanation for researcher CSF decisions.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* NEW: Controlled Substances search & selection */}
      <ControlledSubstancesSearchSection
        selectedItems={controlledSubstances}
        onSelectedItemsChange={setControlledSubstances}
        title="Controlled Substances for this Researcher CSF"
        compact
        accountNumber={form.accountNumber ?? undefined}
      />
    </section>
  );
}

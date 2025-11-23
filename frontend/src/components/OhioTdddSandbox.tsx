import {
  type FormEvent,
  useEffect,
  useState,
} from "react";
import {
  OhioTdddFormData,
  OhioTdddDecision,
  OhioTdddLicenseType,
} from "../domain/ohioTddd";
import { evaluateOhioTddd } from "../api/ohioTdddClient";
import {
  explainOhioTdddDecision,
  type OhioTdddDecisionSummary,
} from "../api/ohioTdddExplainClient";
import {
  fetchComplianceArtifacts,
  type ComplianceArtifact,
} from "../api/complianceArtifactsClient";
import { callRegulatoryRag } from "../api/ragRegulatoryClient";
import { SourceDocumentChip } from "./SourceDocumentChip";

const initialForm: OhioTdddFormData = {
  businessName: "Example Dental Clinic",
  licenseType: "clinic",
  licenseNumber: "TDDD-123456",
  shipToState: "OH",
};

const LICENSE_TYPE_OPTIONS: { value: OhioTdddLicenseType; label: string }[] = [
  { value: "clinic", label: "Clinic" },
  { value: "hospital", label: "Hospital" },
  { value: "practitioner", label: "Practitioner" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "other", label: "Other" },
];

export function OhioTdddSandbox() {
  const [form, setForm] = useState<OhioTdddFormData>(initialForm);
  const [decision, setDecision] = useState<OhioTdddDecision | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Explain decision
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [ragAnswer, setRagAnswer] = useState<string | null>(null);
  const [isRagLoading, setIsRagLoading] = useState(false);
  const [ragError, setRagError] = useState<string | null>(null);

  // Regulatory basis chips
  const [regulatoryArtifacts, setRegulatoryArtifacts] = useState<
    ComplianceArtifact[]
  >([]);
  const [isLoadingRegulatory, setIsLoadingRegulatory] = useState(false);
  const [regulatoryError, setRegulatoryError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setDecision(null);
    setExplanation(null);
    setExplainError(null);
    setRagAnswer(null);
    setRagError(null);
    setRegulatoryArtifacts([]);
    setRegulatoryError(null);

    try {
      const result = await evaluateOhioTddd(form);
      setDecision(result);
    } catch (err: any) {
      setError(
        err?.message ?? "Failed to evaluate Ohio TDDD application"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setForm(initialForm);
    setDecision(null);
    setError(null);
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

  // Load regulatory artifacts when decision has references
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
          if (art) relevant.push(art);
        }

        setRegulatoryArtifacts(relevant);
      } catch (err: any) {
        if (cancelled) return;
        setRegulatoryError(
          err?.message ??
            "Failed to load regulatory artifacts for this decision."
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
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-700">
            Ohio TDDD Sandbox
          </h2>
          <p className="text-[11px] text-gray-500">
            Explore how the Ohio TDDD engine evaluates applications and ties
            them to regulatory guidance. Try changing the ship-to state to a
            non-OH value (e.g., PA) to see a manual review scenario.
          </p>
        </div>
        <SourceDocumentChip label="Ohio TDDD HTML" url="/mnt/data/Ohio TDDD.html" />
      </header>

      <form onSubmit={onSubmit} className="space-y-3">
        {/* Business name */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-700">
            Business / Facility Name
          </label>
          <input
            type="text"
            value={form.businessName}
            onChange={(e) =>
              setForm((f) => ({ ...f, businessName: e.target.value }))
            }
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-[11px] text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* License type & number */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-700">
              License Type
            </label>
            <select
              value={form.licenseType}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  licenseType: e.target.value as OhioTdddLicenseType,
                }))
              }
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-[11px] text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {LICENSE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-700">
              Ohio TDDD License #
            </label>
            <input
              type="text"
              value={form.licenseNumber}
              onChange={(e) =>
                setForm((f) => ({ ...f, licenseNumber: e.target.value }))
              }
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-[11px] text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Ship-to state */}
        <div className="grid grid-cols-[1fr,auto] items-end gap-2">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-700">
              Ship-to State
            </label>
            <input
              type="text"
              value={form.shipToState}
              onChange={(e) =>
                setForm((f) => ({ ...f, shipToState: e.target.value }))
              }
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-[11px] text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Evaluating…" : "Evaluate"}
          </button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="mt-3 rounded-md bg-red-50 px-2 py-1 text-[11px] text-red-700">
          {error}
        </div>
      )}

      {/* Decision */}
      {decision && (
        <div className="mt-3 rounded-md bg-gray-50 px-3 py-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">
              Decision
            </span>
            <span className="rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-medium uppercase text-white">
              {decision.status}
            </span>
          </div>

          <p className="text-[11px] text-gray-800">{decision.reason}</p>

          {decision.missing_fields?.length > 0 && (
            <p className="mt-1 text-[11px] text-gray-700">
              Missing fields: {" "}
              <span className="font-mono">
                {decision.missing_fields.join(", ")}
              </span>
            </p>
          )}

          {/* Explain via /ohio-tddd/explain */}
          <div className="mt-3 space-y-1">
            <button
              type="button"
              disabled={isExplaining}
              className="rounded-md bg-white px-2 py-1 text-[11px] font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={async () => {
                setIsExplaining(true);
                setExplainError(null);
                setExplanation(null);

                const summary: OhioTdddDecisionSummary = {
                  status: decision.status,
                  reason: decision.reason,
                  missing_fields: decision.missing_fields ?? [],
                  regulatory_references:
                    decision.regulatory_references ?? [],
                };

                try {
                  const res = await explainOhioTdddDecision(summary);
                  setExplanation(res.explanation);

                  // Optional: emit Codex command log
                  console.log(
                    "CODEX_COMMAND: explain_ohio_tddd_decision",
                    {
                      decision: summary,
                      source_document: "/mnt/data/Ohio TDDD.html",
                    }
                  );
                } catch (err: any) {
                  setExplainError(
                    err?.message ??
                      "Failed to generate Ohio TDDD decision explanation"
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
                  "Explain this Ohio TDDD decision using the referenced regulatory artifacts. " +
                  "Focus on why the status is '" +
                  decision.status +
                  "' given the ship_to_state, license type, and Ohio TDDD guidance.";

                try {
                  const res = await callRegulatoryRag({
                    question,
                    regulatory_references: decision.regulatory_references ?? [],
                    decision,
                  });

                  setRagAnswer(res.answer);

                  // Optional: log a Codex command for DevSupport
                  console.log("CODEX_COMMAND: rag_regulatory_explain_ohio_tddd", {
                    question,
                    regulatory_references: decision.regulatory_references ?? [],
                    decision,
                  });
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
                  <span className="text-[10px] text-gray-400">
                    Loading…
                  </span>
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
                    No matching artifacts found for: {" "}
                    {decision.regulatory_references.join(", ")}
                    .
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
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Reset */}
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={reset}
          className="text-[10px] font-medium text-gray-500 hover:text-gray-700"
        >
          Reset
        </button>
      </div>
    </section>
  );
}

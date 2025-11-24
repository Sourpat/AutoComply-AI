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
import { CopyCurlButton } from "./CopyCurlButton";
import { emitCodexCommand } from "../utils/codexLogger";

const API_BASE = (import.meta as any).env?.VITE_API_BASE || "";
const OHIO_TDDD_SOURCE_DOCUMENT = "/mnt/data/Ohio TDDD.html";

type OhioExample = {
  id: string;
  label: string;
  overrides: Partial<OhioTdddFormData>;
};

const OHIO_EXAMPLES: OhioExample[] = [
  {
    id: "oh_in_state_pharmacy",
    label: "OH – In-state pharmacy",
    overrides: {
      businessName: "Buckeye Pharmacy",
      licenseType: "pharmacy",
      licenseNumber: "TDDD-987654",
      shipToState: "OH",
    },
  },
  {
    id: "oh_out_of_state_shipping",
    label: "OH – Out-of-state shipping",
    overrides: {
      businessName: "Out-of-State Pharmacy",
      licenseType: "pharmacy",
      licenseNumber: "TDDD-654321",
      shipToState: "OH",
    },
  },
];

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

  // ---- Ohio TDDD Form Copilot state (new) ----
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotDecision, setCopilotDecision] = useState<any | null>(null);
  const [copilotExplanation, setCopilotExplanation] = useState<string | null>(
    null
  );
  const [copilotError, setCopilotError] = useState<string | null>(null);

  // Regulatory basis chips
  const [regulatoryArtifacts, setRegulatoryArtifacts] = useState<
    ComplianceArtifact[]
  >([]);
  const [isLoadingRegulatory, setIsLoadingRegulatory] = useState(false);
  const [regulatoryError, setRegulatoryError] = useState<string | null>(null);

  function applyOhioExample(example: OhioExample) {
    const nextForm = {
      ...initialForm,
      ...form,
      ...example.overrides,
    } as OhioTdddFormData;

    setForm(nextForm);

    emitCodexCommand("ohio_tddd_example_selected", {
      example_id: example.id,
      label: example.label,
      form: nextForm,
      source_document: "/mnt/data/Ohio TDDD.html",
    });
  }

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

      emitCodexCommand("evaluate_ohio_tddd", {
        form,
        decision: result,
        source_document: OHIO_TDDD_SOURCE_DOCUMENT,
      });

      // --- NEW: snapshot into decision history ---
      let snapshotId: string | undefined;

      try {
        const snapResp = await fetch(`${API_BASE}/decisions/history`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            engine_family: "ohio_tddd",
            decision_type: "ohio_tddd",
            status: result.status,
            jurisdiction: form.shipToState,
            regulatory_reference_ids:
              result.regulatory_references?.map((r: any) => r.id) ?? [],
            source_documents:
              result.regulatory_references?.map((r: any) => r.source_document) ??
              [OHIO_TDDD_SOURCE_DOCUMENT],
            payload: {
              form,
              decision: result,
            },
          }),
        });

        if (snapResp.ok) {
          const snapBody = await snapResp.json();
          snapshotId = (snapBody as any).id;
        }
      } catch (err) {
        console.error("Failed to snapshot Ohio TDDD decision", err);
      }

      // --- NEW: create verification request when not allowed ---
      if (result.status !== "allowed") {
        try {
          await fetch(`${API_BASE}/verifications/submit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              engine_family: "ohio_tddd",
              decision_type: "ohio_tddd",
              jurisdiction: form.shipToState,
              reason_for_review:
                result.status === "manual_review"
                  ? "manual_review"
                  : "ohio_tddd_blocked",
              decision_snapshot_id: snapshotId,
              regulatory_reference_ids:
                result.regulatory_references?.map((r: any) => r.id) ?? [],
              source_documents:
                result.regulatory_references?.map((r: any) => r.source_document) ??
                [OHIO_TDDD_SOURCE_DOCUMENT],
              user_question: null,
              channel: "web_sandbox",
              payload: {
                form,
                decision: result,
              },
            }),
          });

          emitCodexCommand("verification_request_created", {
            engine_family: "ohio_tddd",
            decision_type: "ohio_tddd",
            status: result.status,
            decision_snapshot_id: snapshotId,
            source_document: OHIO_TDDD_SOURCE_DOCUMENT,
          });
        } catch (err) {
          console.error("Failed to submit Ohio TDDD verification request", err);
        }
      }
      // --- END NEW ---
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

  const runOhioTdddCopilot = async () => {
    if (!API_BASE) return;

    setCopilotLoading(true);
    setCopilotError(null);
    setCopilotExplanation(null);
    setCopilotDecision(null);

    try {
      // 1) Run the real Ohio TDDD decision engine
      const evalResp = await fetch(`${API_BASE}/ohio-tddd/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!evalResp.ok) {
        throw new Error(`Ohio TDDD evaluate failed: ${evalResp.status}`);
      }

      const evalJson = await evalResp.json();
      const decision =
        (evalJson.decision as any) ?? (evalJson.verdict as any) ?? evalJson;

      setCopilotDecision(decision);

      emitCodexCommand("ohio_tddd_form_copilot_run", {
        engine_family: "ohio_tddd",
        decision_type: "ohio_tddd",
        outcome: decision.outcome ?? decision.status ?? "unknown",
      });

      // 2) Ask RAG to explain what this means / what’s missing
      const ragResp = await fetch(`${API_BASE}/rag/regulatory-explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question:
            "Explain for a verification specialist what this Ohio TDDD decision means, including what licenses or TDDD classifications are required for this account/location to receive controlled substances in Ohio. Be concise and actionable.",
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

      emitCodexCommand("ohio_tddd_form_copilot_complete", {
        engine_family: "ohio_tddd",
        decision_type: "ohio_tddd",
        outcome: decision.outcome ?? decision.status ?? "unknown",
      });
    } catch (err: any) {
      console.error(err);
      setCopilotError(
        "Ohio TDDD Copilot could not run. Check the console or try again."
      );
      emitCodexCommand("ohio_tddd_form_copilot_error", {
        message: String(err?.message || err),
      });
    } finally {
      setCopilotLoading(false);
    }
  };

  const handleExplain = async () => {
    if (!decision) return;

    setIsExplaining(true);
    setExplainError(null);
    setExplanation(null);

    const summary: OhioTdddDecisionSummary = {
      status: decision.status,
      reason: decision.reason,
      missing_fields: decision.missing_fields ?? [],
      regulatory_references: decision.regulatory_references ?? [],
    };

    try {
      const res = await explainOhioTdddDecision(summary);
      setExplanation(res.explanation);

      emitCodexCommand("explain_ohio_tddd_decision", {
        decision: summary,
        source_document: "/mnt/data/Ohio TDDD.html",
      });
    } catch (err: any) {
      setExplainError(
        err?.message ?? "Failed to generate Ohio TDDD decision explanation"
      );
    } finally {
      setIsExplaining(false);
    }
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
      <header className="mb-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-700">
            Ohio TDDD Sandbox
          </h2>
          <p className="text-[11px] text-gray-500">
            Explore how the Ohio TDDD engine evaluates applications and ties
            them to regulatory guidance. Try changing the ship-to state to a
            non-OH value (e.g., PA) to see a manual review scenario.
          </p>

          <div className="mt-1 flex flex-wrap gap-1">
            {OHIO_EXAMPLES.map((ex) => (
              <button
                key={ex.id}
                type="button"
                onClick={() => applyOhioExample(ex)}
                className="rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100"
              >
                {ex.label}
              </button>
            ))}
          </div>
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

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-md bg-blue-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? "Evaluating…" : "Evaluate Ohio TDDD"}
            </button>

            <CopyCurlButton
              label="Copy cURL (evaluate)"
              endpoint="/ohio-tddd/evaluate"
              body={form}
              disabled={isLoading}
            />
          </div>
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
                endpoint="/ohio-tddd/explain"
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
                  emitCodexCommand("rag_regulatory_explain_ohio_tddd", {
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

      {/* ---- Ohio TDDD Form Copilot (beta) ---- */}
      <section className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
        <header className="mb-2 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-[11px] font-semibold text-slate-800">
              Ohio TDDD Copilot (beta)
            </h3>
            <p className="text-[10px] text-slate-500">
              Runs the Ohio TDDD engine on the current form and asks the
              regulatory RAG service to explain what&apos;s allowed or blocked,
              plus what licenses/classifications are missing.
            </p>
          </div>
          <button
            type="button"
            onClick={runOhioTdddCopilot}
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
              to have AutoComply run the Ohio TDDD engine on this form and
              summarize what it thinks, including required TDDD license details
              or missing information.
            </p>
          )}
      </section>

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

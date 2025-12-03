import { type ChangeEvent, type ReactNode, useState } from "react";
import { CopyCurlButton } from "./CopyCurlButton";
import { SourceDocumentChip } from "./SourceDocumentChip";
import { emitCodexCommand } from "../utils/codexLogger";
import { buildCurlCommand } from "../utils/curl";

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE || "";

// --- Types mirroring backend PdmaSampleRequest / Verdict ---

type PdmaProductCategory = "rx_brand" | "rx_generic" | "otc" | "device";
type PdmaChannel = "office" | "clinic" | "hospital" | "pharmacy" | "warehouse";
type PdmaPatientType = "adult" | "pediatric";
type PdmaVerdictStatus = "eligible" | "ineligible" | "manual_review";

interface PdmaRegulatoryReference {
  id: string;
  label: string;
  source_document: string; // /mnt/data/... path, treated as URL
}

interface PdmaSampleRequestForm {
  account_number: string;
  prescriber_npi: string;
  prescriber_name: string;
  prescriber_specialty: string;
  prescriber_state: string;
  patient_type: PdmaPatientType;
  product_name: string;
  product_ndc: string;
  product_category: PdmaProductCategory;
  quantity_requested: number;
  distribution_channel: PdmaChannel;
  is_government_account: boolean;
  is_federal_staff: boolean;
}

interface PdmaSampleVerdict {
  status: PdmaVerdictStatus;
  reasons: string[];
  regulatory_references: PdmaRegulatoryReference[];
}

interface PdmaExplainResponse {
  decision: PdmaSampleVerdict;
  short_explanation: string;
  regulatory_references: PdmaRegulatoryReference[];
}

const PDMA_SOURCE_DOCUMENT = "/mnt/data/FLORIDA TEST.pdf";

// --- Initial form state ---

const initialForm: PdmaSampleRequestForm = {
  account_number: "ACC-PDMA-001",
  prescriber_npi: "1234567890",
  prescriber_name: "Dr. Sample Prescriber",
  prescriber_specialty: "Internal Medicine",
  prescriber_state: "FL",
  patient_type: "adult",
  product_name: "SampleBrand 10mg tablet",
  product_ndc: "00000-0000-00",
  product_category: "rx_brand",
  quantity_requested: 10,
  distribution_channel: "office",
  is_government_account: false,
  is_federal_staff: false,
};

// --- Quick example scenarios ---

type PdmaExample = {
  id: string;
  label: string;
  description?: string;
  overrides: Partial<PdmaSampleRequestForm>;
};

const PDMA_EXAMPLES: PdmaExample[] = [
  {
    id: "eligible_office_brand_rx",
    label: "Eligible – Office, Brand Rx",
    description:
      "Private office, brand Rx, adult patient, moderate quantity.",
    overrides: {
      account_number: "ACC-PDMA-ELIGIBLE",
      prescriber_npi: "1111111111",
      prescriber_name: "Dr. Eligible Example",
      prescriber_specialty: "Internal Medicine",
      prescriber_state: "FL",
      patient_type: "adult",
      product_name: "ExampleBrand 20mg capsule",
      product_ndc: "11111-1111-11",
      product_category: "rx_brand",
      quantity_requested: 20,
      distribution_channel: "office",
      is_government_account: false,
      is_federal_staff: false,
    },
  },
  {
    id: "ineligible_gov_otc_pharmacy",
    label: "Ineligible – Gov, OTC, Pharmacy",
    description:
      "Government account, OTC product, pharmacy channel. Shows hard ineligibility.",
    overrides: {
      account_number: "ACC-PDMA-GOV",
      prescriber_npi: "2222222222",
      prescriber_name: "Dr. Gov Example",
      prescriber_specialty: "Family Medicine",
      prescriber_state: "FL",
      patient_type: "adult",
      product_name: "OTC Pain Relief 200mg",
      product_ndc: "22222-2222-22",
      product_category: "otc",
      quantity_requested: 5,
      distribution_channel: "pharmacy",
      is_government_account: true,
      is_federal_staff: true,
    },
  },
  {
    id: "manual_review_high_qty_pediatric",
    label: "Manual Review – High qty pediatric",
    description:
      "High quantity for pediatric patient with non-peds specialty and clinic channel.",
    overrides: {
      account_number: "ACC-PDMA-PEDS",
      prescriber_npi: "3333333333",
      prescriber_name: "Dr. NonPeds Example",
      prescriber_specialty: "Internal Medicine",
      prescriber_state: "FL",
      patient_type: "pediatric",
      product_name: "PediaBrand 5mg syrup",
      product_ndc: "33333-3333-33",
      product_category: "rx_brand",
      quantity_requested: 60,
      distribution_channel: "clinic",
      is_government_account: false,
      is_federal_staff: false,
    },
  },
];

export function PdmaSampleSandbox() {
  const [form, setForm] = useState<PdmaSampleRequestForm>(initialForm);
  const [verdict, setVerdict] = useState<PdmaSampleVerdict | null>(null);
  const [explain, setExplain] = useState<PdmaExplainResponse | null>(null);
  const [ragQuestion, setRagQuestion] = useState(
    "Explain why this PDMA sample request is eligible or not, and highlight any PDMA policy considerations."
  );
  const [ragAnswer, setRagAnswer] = useState<string | null>(null);

  // ---- PDMA Form Copilot state (new) ----
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotDecision, setCopilotDecision] = useState<any | null>(null);
  const [copilotExplanation, setCopilotExplanation] = useState<string | null>(
    null
  );
  const [copilotError, setCopilotError] = useState<string | null>(null);

  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);
  const [isRagLoading, setIsRagLoading] = useState(false);

  const handleChange =
    (field: keyof PdmaSampleRequestForm) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value =
        e.target.type === "checkbox"
          ? (e.target as HTMLInputElement).checked
          : e.target.type === "number"
          ? Number(e.target.value)
          : e.target.value;

      setForm((prev) => ({
        ...prev,
        [field]: value,
      }));
    };

  const applyExample = (example: PdmaExample) => {
    const nextForm: PdmaSampleRequestForm = {
      ...initialForm,
      ...form,
      ...example.overrides,
    };
    setForm(nextForm);
    setVerdict(null);
    setExplain(null);
    setRagAnswer(null);

    emitCodexCommand("pdma_sample_example_selected", {
      example_id: example.id,
      label: example.label,
      description: example.description,
      form: nextForm,
      source_document: PDMA_SOURCE_DOCUMENT,
    });
  };

  const handleEvaluate = async () => {
    setIsEvaluating(true);
    setExplain(null);
    setRagAnswer(null);
    try {
      const resp = await fetch(`${API_BASE}/pdma-sample/evaluate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      if (!resp.ok) {
        throw new Error(`PDMA evaluate failed: ${resp.status}`);
      }

      const data = (await resp.json()) as PdmaSampleVerdict;
      setVerdict(data);

      emitCodexCommand("evaluate_pdma_sample", {
        form,
        verdict: data,
        source_document: PDMA_SOURCE_DOCUMENT,
      });

      // --- NEW: snapshot decision into history and create verification if needed ---
      let snapshotId: string | undefined;

      try {
        const snapResp = await fetch(`${API_BASE}/decisions/history`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            engine_family: "pdma",
            decision_type: "pdma_sample",
            status: data.status,
            jurisdiction: form.prescriber_state,
            regulatory_reference_ids:
              data.regulatory_references?.map((r) => r.id) ?? [],
            source_documents:
              data.regulatory_references?.map((r) => r.source_document) ??
              [PDMA_SOURCE_DOCUMENT],
            payload: {
              form,
              verdict: data,
            },
          }),
        });

        if (snapResp.ok) {
          const snapBody = await snapResp.json();
          snapshotId = (snapBody as any).id;
        }
      } catch (err) {
        console.error("Failed to snapshot PDMA decision history", err);
      }

      // Create verification request when decision is NOT eligible
      if (data.status !== "eligible") {
        try {
          await fetch(`${API_BASE}/verifications/submit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              engine_family: "pdma",
              decision_type: "pdma_sample",
              jurisdiction: form.prescriber_state,
              reason_for_review:
                data.status === "manual_review"
                  ? "manual_review"
                  : "ineligible_pdma_sample",
              decision_snapshot_id: snapshotId,
              regulatory_reference_ids:
                data.regulatory_references?.map((r) => r.id) ?? [],
              source_documents:
                data.regulatory_references?.map((r) => r.source_document) ??
                [PDMA_SOURCE_DOCUMENT],
              user_question: null,
              channel: "web_sandbox",
              payload: {
                form,
                verdict: data,
              },
            }),
          });

          emitCodexCommand("verification_request_created", {
            engine_family: "pdma",
            decision_type: "pdma_sample",
            status: data.status,
            decision_snapshot_id: snapshotId,
            source_document: PDMA_SOURCE_DOCUMENT,
          });
        } catch (err) {
          console.error("Failed to submit PDMA verification request", err);
        }
      }
      // --- END NEW ---
    } catch (err) {
      console.error(err);
      // you can add a simple error toast/inline message if desired
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleExplain = async () => {
    if (!verdict) return;
    setIsExplaining(true);
    setRagAnswer(null);

    try {
      const resp = await fetch(`${API_BASE}/pdma-sample/explain`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ decision: verdict }),
      });

      if (!resp.ok) {
        throw new Error(`PDMA explain failed: ${resp.status}`);
      }

      const data = (await resp.json()) as PdmaExplainResponse;
      setExplain(data);

      emitCodexCommand("explain_pdma_sample_decision", {
        decision: verdict,
        explanation: data.short_explanation,
        regulatory_references: data.regulatory_references,
        source_document: PDMA_SOURCE_DOCUMENT,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsExplaining(false);
    }
  };

  const handleRagExplain = async () => {
    if (!verdict) return;
    setIsRagLoading(true);
    setRagAnswer(null);

    try {
      const resp = await fetch(`${API_BASE}/rag/regulatory-explain`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: ragQuestion,
          decision: verdict,
          regulatory_references:
            verdict.regulatory_references?.map((ref) => ref.id) ?? [],
        }),
      });

      if (!resp.ok) {
        throw new Error(`RAG PDMA explain failed: ${resp.status}`);
      }

      const data = await resp.json();
      setRagAnswer(data.answer ?? JSON.stringify(data, null, 2));

      emitCodexCommand("rag_regulatory_explain_pdma", {
        question: ragQuestion,
        decision: verdict,
        regulatory_references: verdict.regulatory_references,
        source_document: PDMA_SOURCE_DOCUMENT,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsRagLoading(false);
    }
  };

  const runPdmaCopilot = async () => {
    if (!API_BASE) return;

    setCopilotLoading(true);
    setCopilotError(null);
    setCopilotExplanation(null);
    setCopilotDecision(null);

    try {
      // 1) Run PDMA decision engine
      const evalResp = await fetch(`${API_BASE}/pdma-sample/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!evalResp.ok) {
        throw new Error(`PDMA evaluate failed: ${evalResp.status}`);
      }

      const evalJson = await evalResp.json();
      const decision =
        (evalJson.decision as any) ?? (evalJson.verdict as any) ?? evalJson;

      setCopilotDecision(decision);

      emitCodexCommand("pdma_form_copilot_run", {
        engine_family: "pdma",
        decision_type: "pdma",
        outcome: decision.outcome ?? decision.status ?? "unknown",
      });

      // 2) Ask RAG to explain the PDMA decision / missing requirements
      const ragResp = await fetch(`${API_BASE}/rag/regulatory-explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question:
            "Explain for a verification specialist what this PDMA decision means, including whether the account is PDMA-eligible and what documentation or license steps are required for drug sample shipments. Be concise and actionable.",
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

      emitCodexCommand("pdma_form_copilot_complete", {
        engine_family: "pdma",
        decision_type: "pdma",
        outcome: decision.outcome ?? decision.status ?? "unknown",
      });
    } catch (err: any) {
      console.error(err);
      setCopilotError("PDMA Copilot could not run. Check the console or try again.");
      emitCodexCommand("pdma_form_copilot_error", {
        message: String(err?.message || err),
      });
    } finally {
      setCopilotLoading(false);
    }
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      <header className="mb-2 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-[11px] font-semibold text-slate-800">
            PDMA Sample Eligibility Sandbox
          </h2>
          <p className="text-[10px] text-slate-500">
            Evaluate and explain PDMA-style sample requests, with RAG over PDMA policy.
          </p>

          <div className="mt-1 flex flex-wrap gap-1">
            {PDMA_EXAMPLES.map((ex) => (
              <button
                key={ex.id}
                type="button"
                onClick={() => applyExample(ex)}
                className="rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100"
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>

        <SourceDocumentChip
          label="PDMA Policy PDF"
          url={PDMA_SOURCE_DOCUMENT}
        />
      </header>

      {/* Form + actions */}
      <div className="grid gap-3 md:grid-cols-2">
        {/* Left: form */}
        <div className="space-y-2">
          <FieldGroup label="Account & Prescriber">
            <TextField
              label="Account Number"
              value={form.account_number}
              onChange={handleChange("account_number")}
            />
            <TextField
              label="Prescriber NPI"
              value={form.prescriber_npi}
              onChange={handleChange("prescriber_npi")}
            />
            <TextField
              label="Prescriber Name"
              value={form.prescriber_name}
              onChange={handleChange("prescriber_name")}
            />
            <TextField
              label="Specialty"
              value={form.prescriber_specialty}
              onChange={handleChange("prescriber_specialty")}
            />
            <TextField
              label="State (2-letter)"
              value={form.prescriber_state}
              maxLength={2}
              onChange={handleChange("prescriber_state")}
            />
          </FieldGroup>

          <FieldGroup label="Patient & Product">
            <SelectField
              label="Patient Type"
              value={form.patient_type}
              onChange={handleChange("patient_type")}
              options={[
                { value: "adult", label: "Adult" },
                { value: "pediatric", label: "Pediatric" },
              ]}
            />
            <TextField
              label="Product Name"
              value={form.product_name}
              onChange={handleChange("product_name")}
            />
            <TextField
              label="Product NDC"
              value={form.product_ndc}
              onChange={handleChange("product_ndc")}
            />
            <SelectField
              label="Product Category"
              value={form.product_category}
              onChange={handleChange("product_category")}
              options={[
                { value: "rx_brand", label: "Rx – Brand" },
                { value: "rx_generic", label: "Rx – Generic" },
                { value: "otc", label: "OTC" },
                { value: "device", label: "Device" },
              ]}
            />
            <NumberField
              label="Quantity Requested"
              value={form.quantity_requested}
              onChange={handleChange("quantity_requested")}
              min={1}
              max={100}
            />
            <SelectField
              label="Distribution Channel"
              value={form.distribution_channel}
              onChange={handleChange("distribution_channel")}
              options={[
                { value: "office", label: "Office" },
                { value: "clinic", label: "Clinic" },
                { value: "hospital", label: "Hospital" },
                { value: "pharmacy", label: "Pharmacy" },
                { value: "warehouse", label: "Warehouse" },
              ]}
            />
            <CheckboxField
              label="Government account?"
              checked={form.is_government_account}
              onChange={handleChange("is_government_account")}
            />
            <CheckboxField
              label="Federal staff?"
              checked={form.is_federal_staff}
              onChange={handleChange("is_federal_staff")}
            />
          </FieldGroup>

          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={handleEvaluate}
              disabled={isEvaluating}
              className="rounded-md bg-blue-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isEvaluating ? "Evaluating…" : "Evaluate PDMA Sample"}
            </button>

            <CopyCurlButton
              label="Copy cURL (evaluate)"
              getCommand={() => buildCurlCommand("/pdma-sample/evaluate", form)}
            />
          </div>
        </div>

        {/* Right: results + explain + RAG */}
        <div className="space-y-2">
          <FieldGroup label="Verdict">
            {verdict ? (
              <>
                <div className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-800">
                  Status: {verdict.status}
                </div>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[10px] text-slate-700">
                  {verdict.reasons.map((r, idx) => (
                    <li key={idx}>{r}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-[10px] text-slate-400">
                Run an evaluation to see PDMA verdict and reasons.
              </p>
            )}
          </FieldGroup>

          <FieldGroup label="Explain decision (deterministic)">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExplain}
                disabled={!verdict || isExplaining}
                className="rounded-md bg-slate-700 px-3 py-1 text-[11px] font-medium text-white hover:bg-slate-800 disabled:opacity-40"
              >
                {isExplaining ? "Explaining…" : "Explain PDMA decision"}
              </button>

              <CopyCurlButton
                label="Copy cURL (explain)"
                getCommand={() =>
                  buildCurlCommand("/pdma-sample/explain", {
                    decision: verdict,
                  })
                }
              />
            </div>

            {explain ? (
              <p className="mt-1 text-[10px] text-slate-700">
                {explain.short_explanation}
              </p>
            ) : (
              <p className="mt-1 text-[10px] text-slate-400">
                Deterministic explanation from the PDMA engine. You can also
                run a RAG explanation below.
              </p>
            )}
          </FieldGroup>

          <FieldGroup label="Deep RAG explain (PDMA policy)">
            <textarea
              className="w-full rounded border border-slate-200 bg-white p-1 text-[10px]"
              rows={3}
              value={ragQuestion}
              onChange={(e) => setRagQuestion(e.target.value)}
            />
            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={handleRagExplain}
                disabled={!verdict || isRagLoading}
                className="rounded-md bg-emerald-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                {isRagLoading ? "Running RAG…" : "Explain with RAG"}
              </button>

              <CopyCurlButton
                label="Copy cURL (RAG explain)"
                getCommand={() =>
                  buildCurlCommand("/rag/regulatory-explain", {
                    question: ragQuestion,
                    decision: verdict,
                    regulatory_references:
                      verdict?.regulatory_references?.map((ref) => ref.id) ?? [],
                  })
                }
              />
            </div>

            {ragAnswer ? (
              <pre className="mt-1 max-h-40 overflow-auto rounded border border-slate-200 bg-slate-50 p-1 text-[10px] text-slate-800">
                {ragAnswer}
              </pre>
            ) : (
              <p className="mt-1 text-[10px] text-slate-400">
                RAG will ground the explanation in PDMA policy, using{" "}
                <code className="font-mono text-[9px]">
                  {PDMA_SOURCE_DOCUMENT}
                </code>{" "}
                and other artifacts as needed.
              </p>
            )}
          </FieldGroup>

          {/* ---- PDMA Form Copilot (beta) ---- */}
          <section className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
            <header className="mb-2 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-[11px] font-semibold text-slate-800">
                  PDMA Copilot (beta)
                </h3>
                <p className="text-[10px] text-slate-500">
                  Runs the PDMA sample eligibility engine on the current form and
                  asks the regulatory RAG service to explain eligibility and
                  required documentation.
                </p>
              </div>
              <button
                type="button"
                onClick={runPdmaCopilot}
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
                  to have AutoComply run the PDMA engine on this form and summarize
                  eligibility and required PDMA documentation for the verification
                  team.
                </p>
              )}
          </section>
        </div>
      </div>
    </section>
  );
}

// --- Tiny form field helpers to keep JSX tidy ---

function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-2">
      <div className="mb-1 text-[10px] font-semibold text-slate-700">
        {label}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  maxLength?: number;
}) {
  return (
    <label className="flex flex-col gap-0.5 text-[10px] text-slate-700">
      <span>{label}</span>
      <input
        type="text"
        value={value}
        maxLength={maxLength}
        onChange={onChange}
        className="rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px]"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="flex flex-col gap-0.5 text-[10px] text-slate-700">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={onChange}
        className="rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px]"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-0.5 text-[10px] text-slate-700">
      <span>{label}</span>
      <select
        value={value}
        onChange={onChange}
        className="rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px]"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="flex items-center gap-1 text-[10px] text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-3 w-3 rounded border-slate-300"
      />
      <span>{label}</span>
    </label>
  );
}

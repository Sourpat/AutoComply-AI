import { FormEvent, useState } from "react";
import {
  OhioTdddCustomerResponse,
  OhioTdddDecision,
  OhioTdddFormData,
} from "../domain/ohioTddd";
import { evaluateOhioTddd } from "../api/ohioTdddClient";

const initialForm: OhioTdddFormData = {
  customerResponse: null,
  practitionerName: "",
  stateBoardLicenseNumber: "",
  tdddLicenseNumber: "",
  deaNumber: "",
  tdddLicenseCategory: "",
};

export function OhioTdddSandbox() {
  const [form, setForm] = useState<OhioTdddFormData>(initialForm);
  const [decision, setDecision] = useState<OhioTdddDecision | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChange = (field: keyof OhioTdddFormData, value: any) => {
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
      const result = await evaluateOhioTddd(form);
      setDecision(result);
    } catch (err: any) {
      setError(err?.message ?? "Failed to evaluate Ohio TDDD attestation");
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setForm(initialForm);
    setDecision(null);
    setError(null);
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-sm">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
          Ohio TDDD Sandbox
        </h2>
        <button
          type="button"
          onClick={reset}
          className="text-xs text-gray-500 hover:underline"
        >
          Reset
        </button>
      </header>

      <form onSubmit={onSubmit} className="space-y-3">
        {/* Customer Response */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Customer response
          </label>
          <div className="flex flex-col gap-1 text-xs">
            <label className="inline-flex items-center gap-1">
              <input
                type="radio"
                name="customerResponse"
                value="EXEMPT"
                checked={form.customerResponse === "EXEMPT"}
                onChange={() =>
                  onChange("customerResponse", "EXEMPT" as OhioTdddCustomerResponse)
                }
              />
              <span>Exempt from Ohio TDDD licensing</span>
            </label>
            <label className="inline-flex items-center gap-1">
              <input
                type="radio"
                name="customerResponse"
                value="LICENSED_OR_APPLYING"
                checked={form.customerResponse === "LICENSED_OR_APPLYING"}
                onChange={() =>
                  onChange(
                    "customerResponse",
                    "LICENSED_OR_APPLYING" as OhioTdddCustomerResponse
                  )
                }
              />
              <span>Subject to Ohio TDDD licensing (licensed or applying)</span>
            </label>
          </div>
        </div>

        {/* Practitioner & license identity */}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
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
              State board license #
            </label>
            <input
              type="text"
              value={form.stateBoardLicenseNumber}
              onChange={(e) =>
                onChange("stateBoardLicenseNumber", e.target.value)
              }
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
            />
          </div>
        </div>

        {/* Ohio TDDD-specific fields */}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              TDDD license #
            </label>
            <input
              type="text"
              value={form.tdddLicenseNumber ?? ""}
              onChange={(e) => onChange("tdddLicenseNumber", e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              DEA #
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
              TDDD license category
            </label>
            <input
              type="text"
              value={form.tdddLicenseCategory ?? ""}
              onChange={(e) =>
                onChange("tdddLicenseCategory", e.target.value)
              }
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
            />
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <button
            type="submit"
            disabled={isLoading || !form.customerResponse}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Evaluating…" : "Evaluate Ohio TDDD"}
          </button>
          {!form.customerResponse && (
            <span className="text-[11px] text-gray-500">
              Select a customer response to enable evaluation.
            </span>
          )}
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

            {/* NEW: Ask Codex to explain */}
            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                className="rounded-md bg-white px-2 py-1 text-[11px] font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
                onClick={() => {
                  // This is the hook Codex listens to.
                  // Your extension / devtools can watch for this pattern.
                  console.log("CODEX_COMMAND: explain_ohio_tddd_decision", {
                    form,
                    decision,
                    source_document: "/mnt/data/Ohio TDDD.html",
                  });
                }}
              >
                Ask Codex to explain decision
              </button>
              <span className="text-[10px] text-gray-400">
                Uses Ohio TDDD rules to generate a narrative explanation.
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

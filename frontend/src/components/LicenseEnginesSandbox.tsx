import React from "react";
import { Globe, ShieldCheck } from "lucide-react";

import { API_BASE } from "../api/csfHospitalClient";
import { CopyCurlButton } from "./CopyCurlButton";
import { DecisionStatusBadge } from "./DecisionStatusBadge";
import { RegulatoryInsightsPanel } from "./RegulatoryInsightsPanel";
import { TestCoverageNote } from "./TestCoverageNote";

type LicenseDecisionStatus = "ok_to_ship" | "needs_review" | "blocked";

type LicenseDecisionResponse = {
  status: LicenseDecisionStatus;
  reason: string;
  // Optional, populated when the license engine returns richer regulatory data
  missing_fields?: string[];
  regulatory_references?: string[];
  rag_explanation?: string;
  rag_sources?: any[];
};

interface TraceShape {
  endpoint: string;
  payload: any;
  response: any;
  error: string | null;
  at: string;
}

function OhioTdddSandbox() {
  const [form, setForm] = React.useState({
    tddd_number: "",
    facility_name: "",
    account_number: "",
    ship_to_state: "OH",
    license_type: "ohio_tddd",
    attestation_accepted: true,
    internal_notes: "",
  });
  const [decision, setDecision] = React.useState<LicenseDecisionResponse | null>(
    null
  );
  const [error, setError] = React.useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = React.useState(false);
  const [trace, setTrace] = React.useState<TraceShape | null>(null);
  const [showTrace, setShowTrace] = React.useState(false);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value, type, checked } = e.target;
    const nextValue = type === "checkbox" ? checked : value;
    setForm((prev) => ({ ...prev, [name]: nextValue }));
  }

  async function runEvaluate() {
    setIsEvaluating(true);
    setError(null);
    const payload = form ?? {};

    setTrace({
      endpoint: "/license/ohio-tddd/evaluate",
      payload,
      response: null,
      error: null,
      at: new Date().toISOString(),
    });

    try {
      const resp = await fetch(`${API_BASE}/license/ohio-tddd/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(
          `Ohio TDDD evaluate failed with status ${resp.status}: ${text || "no body"}`
        );
      }

      const data = (await resp.json()) as LicenseDecisionResponse;
      setDecision(data);
      setTrace((prev) =>
        prev
          ? { ...prev, response: data, error: null }
          : {
              endpoint: "/license/ohio-tddd/evaluate",
              payload,
              response: data,
              error: null,
              at: new Date().toISOString(),
            }
      );
    } catch (err: any) {
      const message = err?.message ?? "Unknown error";
      setError(message);
      setDecision(null);
      setTrace((prev) =>
        prev
          ? { ...prev, error: message }
          : {
              endpoint: "/license/ohio-tddd/evaluate",
              payload,
              response: null,
              error: message,
              at: new Date().toISOString(),
            }
      );
    } finally {
      setIsEvaluating(false);
    }
  }

  function buildCurlFromTrace(traceValue: TraceShape | null): string {
    const endpoint = traceValue?.endpoint || "/license/ohio-tddd/evaluate";
    const payload = traceValue?.payload || form || {};
    const json = JSON.stringify(payload);

    return [
      "curl",
      "-X POST",
      `\"${API_BASE}${endpoint}\"`,
      '-H "Content-Type: application/json"',
      `-d '${json}'`,
    ].join(" ");
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/85 p-4 text-[11px] text-slate-100 shadow-md shadow-black/30">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold text-slate-50">
            Ohio TDDD license sandbox
          </h3>
          <p className="mt-1 text-[11px] text-slate-400">
            Try different Ohio TDDD license scenarios and see how they impact downstream Ohio journeys. This sandbox does not handle license renewal — it assumes the license was already issued/updated by the Ohio board, and focuses on how that license affects ordering.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-950 px-2.5 py-1 text-[10px] font-medium text-slate-200">
          <Globe className="h-3 w-3" />
          <span>OH license engine</span>
        </span>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <div className="space-y-1.5">
          <label className="block text-[10px] text-slate-300">
            TDDD number
            <input
              name="tddd_number"
              value={form.tddd_number}
              onChange={handleChange}
              className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-100"
              placeholder="01234567"
            />
          </label>
          <label className="block text-[10px] text-slate-300">
            Facility name
            <input
              name="facility_name"
              value={form.facility_name}
              onChange={handleChange}
              className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
              placeholder="Example Ohio Pharmacy"
            />
          </label>
          <label className="block text-[10px] text-slate-300">
            Account number
            <input
              name="account_number"
              value={form.account_number}
              onChange={handleChange}
              className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
              placeholder="800123456"
            />
          </label>
          <label className="block text-[10px] text-slate-300">
            Ship-to state
            <input
              name="ship_to_state"
              value={form.ship_to_state}
              onChange={handleChange}
              className="mt-0.5 w-24 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
              placeholder="OH"
            />
          </label>
          <label className="flex items-center gap-2 text-[10px] text-slate-300">
            <input
              type="checkbox"
              name="attestation_accepted"
              checked={form.attestation_accepted}
              onChange={handleChange}
              className="h-3 w-3 rounded border-slate-700 bg-slate-950 text-emerald-500"
            />
            Attestation accepted
          </label>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[10px] text-slate-300">
            Internal notes (not sent to customers)
            <textarea
              name="internal_notes"
              value={form.internal_notes}
              onChange={handleChange}
              rows={4}
              className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
              placeholder="e.g. License expiring in 90 days..."
            />
          </label>
          <label className="block text-[10px] text-slate-300">
            License type
            <input
              name="license_type"
              value={form.license_type}
              onChange={handleChange}
              className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
              placeholder="ohio_tddd"
            />
          </label>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={runEvaluate}
          disabled={isEvaluating}
          className="inline-flex items-center gap-2 rounded-full border border-emerald-500/60 bg-emerald-500/15 px-3 py-1.5 text-[11px] font-medium text-emerald-50 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-900 disabled:text-slate-400"
        >
          {isEvaluating ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border border-emerald-300 border-t-transparent" />
              <span>Evaluating license…</span>
            </>
          ) : (
            <>
              <ShieldCheck className="h-3 w-3" />
              <span>Evaluate license</span>
            </>
          )}
        </button>
        <CopyCurlButton
          getCommand={() => buildCurlFromTrace(trace)}
          label="Copy OH TDDD cURL"
        />
        <p className="text-[10px] text-slate-500">
          Uses the current form as the request body.
        </p>
      </div>

      {error && <p className="mt-2 text-[11px] text-rose-300">{error}</p>}

      {decision && (
        <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/90 px-3 py-3">
          <p className="text-xs font-semibold text-slate-100">License decision</p>
          <div className="mt-1 flex items-center gap-2">
            <DecisionStatusBadge status={decision.status} />
            <span className="text-[11px] text-slate-400">
              Result from <span className="font-mono text-slate-200">/license/ohio-tddd/evaluate</span>.
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-200">{decision.reason}</p>
        </div>
      )}

      {decision && (
        <RegulatoryInsightsPanel
          title="Ohio TDDD – Regulatory insights"
          statusLabel={`Decision: ${decision.status}`}
          reason={null}
          missingFields={decision.missing_fields}
          regulatoryReferences={decision.regulatory_references}
          ragExplanation={decision.rag_explanation}
          ragSources={decision.rag_sources}
        />
      )}

      {trace && (
        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/90 px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-100">Developer trace</p>
            <button
              type="button"
              onClick={() => setShowTrace((prev) => !prev)}
              className="text-[10px] font-medium text-slate-300 underline underline-offset-2 hover:text-slate-100"
            >
              {showTrace ? "Hide JSON" : "Show JSON"}
            </button>
          </div>
          {showTrace && (
            <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-black/80 px-2 py-2 text-[10px] leading-relaxed text-slate-100">
              {JSON.stringify(trace, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function NyPharmacySandbox() {
  const [form, setForm] = React.useState({
    pharmacy_name: "",
    account_number: "",
    ship_to_state: "NY",
    dea_number: "",
    ny_state_license_number: "",
    attestation_accepted: true,
    internal_notes: "",
    license_type: "ny_pharmacy",
  });
  const [decision, setDecision] = React.useState<LicenseDecisionResponse | null>(
    null
  );
  const [error, setError] = React.useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = React.useState(false);
  const [trace, setTrace] = React.useState<TraceShape | null>(null);
  const [showTrace, setShowTrace] = React.useState(false);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value, type, checked } = e.target;
    const nextValue = type === "checkbox" ? checked : value;
    setForm((prev) => ({ ...prev, [name]: nextValue }));
  }

  async function runEvaluate() {
    setIsEvaluating(true);
    setError(null);
    const payload = form ?? {};

    setTrace({
      endpoint: "/license/ny-pharmacy/evaluate",
      payload,
      response: null,
      error: null,
      at: new Date().toISOString(),
    });

    try {
      const resp = await fetch(`${API_BASE}/license/ny-pharmacy/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(
          `NY pharmacy evaluate failed with status ${resp.status}: ${text || "no body"}`
        );
      }

      const data = (await resp.json()) as LicenseDecisionResponse;
      setDecision(data);
      setTrace((prev) =>
        prev
          ? { ...prev, response: data, error: null }
          : {
              endpoint: "/license/ny-pharmacy/evaluate",
              payload,
              response: data,
              error: null,
              at: new Date().toISOString(),
            }
      );
    } catch (err: any) {
      const message = err?.message ?? "Unknown error";
      setError(message);
      setDecision(null);
      setTrace((prev) =>
        prev
          ? { ...prev, error: message }
          : {
              endpoint: "/license/ny-pharmacy/evaluate",
              payload,
              response: null,
              error: message,
              at: new Date().toISOString(),
            }
      );
    } finally {
      setIsEvaluating(false);
    }
  }

  function buildCurlFromTrace(traceValue: TraceShape | null): string {
    const endpoint = traceValue?.endpoint || "/license/ny-pharmacy/evaluate";
    const payload = traceValue?.payload || form || {};
    const json = JSON.stringify(payload);

    return [
      "curl",
      "-X POST",
      `\"${API_BASE}${endpoint}\"`,
      '-H "Content-Type: application/json"',
      `-d '${json}'`,
    ].join(" ");
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/85 p-4 text-[11px] text-slate-100 shadow-md shadow-black/30">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold text-slate-50">
            NY pharmacy license sandbox
          </h3>
          <p className="mt-1 text-[11px] text-slate-400">
            Explore New York pharmacy license decisions that feed NY order journeys. This sandbox assumes the NY board has already issued or renewed the pharmacy license — it focuses on how that license is evaluated for controlled substance ordering.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-950 px-2.5 py-1 text-[10px] font-medium text-slate-200">
          <Globe className="h-3 w-3" />
          <span>NY license engine</span>
        </span>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <div className="space-y-1.5">
          <label className="block text-[10px] text-slate-300">
            Pharmacy name
            <input
              name="pharmacy_name"
              value={form.pharmacy_name}
              onChange={handleChange}
              className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-100"
              placeholder="Hudson River Pharmacy"
            />
          </label>
          <label className="block text-[10px] text-slate-300">
            Account number
            <input
              name="account_number"
              value={form.account_number}
              onChange={handleChange}
              className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
              placeholder="900123456"
            />
          </label>
          <label className="block text-[10px] text-slate-300">
            Ship-to state
            <input
              name="ship_to_state"
              value={form.ship_to_state}
              onChange={handleChange}
              className="mt-0.5 w-24 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
              placeholder="NY"
            />
          </label>
          <label className="block text-[10px] text-slate-300">
            DEA number
            <input
              name="dea_number"
              value={form.dea_number}
              onChange={handleChange}
              className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
              placeholder="FG1234567"
            />
          </label>
          <label className="block text-[10px] text-slate-300">
            NY state license number
            <input
              name="ny_state_license_number"
              value={form.ny_state_license_number}
              onChange={handleChange}
              className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
              placeholder="NYPHARM-001234"
            />
          </label>
          <label className="flex items-center gap-2 text-[10px] text-slate-300">
            <input
              type="checkbox"
              name="attestation_accepted"
              checked={form.attestation_accepted}
              onChange={handleChange}
              className="h-3 w-3 rounded border-slate-700 bg-slate-950 text-emerald-500"
            />
            Attestation accepted
          </label>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[10px] text-slate-300">
            Internal notes (not sent to customers)
            <textarea
              name="internal_notes"
              value={form.internal_notes}
              onChange={handleChange}
              rows={4}
              className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
              placeholder="e.g. Renewal pending board review..."
            />
          </label>
          <label className="block text-[10px] text-slate-300">
            License type
            <input
              name="license_type"
              value={form.license_type}
              onChange={handleChange}
              className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
              placeholder="ny_pharmacy"
            />
          </label>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={runEvaluate}
          disabled={isEvaluating}
          className="inline-flex items-center gap-2 rounded-full border border-emerald-500/60 bg-emerald-500/15 px-3 py-1.5 text-[11px] font-medium text-emerald-50 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-900 disabled:text-slate-400"
        >
          {isEvaluating ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border border-emerald-300 border-t-transparent" />
              <span>Evaluating license…</span>
            </>
          ) : (
            <>
              <ShieldCheck className="h-3 w-3" />
              <span>Evaluate license</span>
            </>
          )}
        </button>
        <CopyCurlButton
          getCommand={() => buildCurlFromTrace(trace)}
          label="Copy NY license cURL"
        />
        <p className="text-[10px] text-slate-500">
          Copies the current form as a POST body.
        </p>
      </div>

      {error && <p className="mt-2 text-[11px] text-rose-300">{error}</p>}

      {decision && (
        <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/90 px-3 py-3">
          <p className="text-xs font-semibold text-slate-100">License decision</p>
          <div className="mt-1 flex items-center gap-2">
            <DecisionStatusBadge status={decision.status} />
            <span className="text-[11px] text-slate-400">
              Result from <span className="font-mono text-slate-200">/license/ny-pharmacy/evaluate</span>.
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-200">{decision.reason}</p>
        </div>
      )}

      {decision && (
        <RegulatoryInsightsPanel
          title="NY pharmacy – Regulatory insights"
          statusLabel={`Decision: ${decision.status}`}
          reason={null}
          missingFields={decision.missing_fields}
          regulatoryReferences={decision.regulatory_references}
          ragExplanation={decision.rag_explanation}
          ragSources={decision.rag_sources}
        />
      )}

      {trace && (
        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/90 px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-100">Developer trace</p>
            <button
              type="button"
              onClick={() => setShowTrace((prev) => !prev)}
              className="text-[10px] font-medium text-slate-300 underline underline-offset-2 hover:text-slate-100"
            >
              {showTrace ? "Hide JSON" : "Show JSON"}
            </button>
          </div>
          {showTrace && (
            <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-black/80 px-2 py-2 text-[10px] leading-relaxed text-slate-100">
              {JSON.stringify(trace, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export function LicenseEnginesSandbox() {
  return (
    <section className="console-section console-section-license-engines space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-slate-900">License engines</h2>
          <p className="text-[11px] text-slate-600">
            Dedicated sandboxes for Ohio TDDD and NY pharmacy license engines that power order journeys. These engines assume the state board or DEA has already issued/renewed the license on their own portal — here we only consume core license details to decide if a controlled order can proceed.
          </p>
          <TestCoverageNote
            size="sm"
            files={[
              "backend/tests/test_license_ohio_tddd_api.py",
              "backend/tests/test_license_ny_pharmacy_api.py",
            ]}
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <OhioTdddSandbox />
        <NyPharmacySandbox />
      </div>
    </section>
  );
}

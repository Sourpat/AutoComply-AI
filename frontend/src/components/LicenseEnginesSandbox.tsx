import React from "react";
import { Globe, ShieldCheck } from "lucide-react";

import { API_BASE } from "../api/csfHospitalClient";
import { CopyCurlButton } from "./CopyCurlButton";
import { RegulatoryInsightsPanel } from "./RegulatoryInsightsPanel";
import { TestCoverageNote } from "./TestCoverageNote";
import { useRagDebug } from "../devsupport/RagDebugContext";
import type {
  DecisionOutcome,
  RegulatoryReference,
} from "../types/decision";
import type { NyPharmacyFormValues } from "../types/forms";

type LicenseDecisionResponse = DecisionOutcome & {
  // Optional, populated when the license engine returns richer regulatory data
  missing_fields?: string[];
  missingFields?: string[];
  regulatory_references?: RegulatoryReference[];
  rag_explanation?: string;
  rag_sources?: any[];
};

type LicenseScenarioId = "custom" | "ohio_happy" | "ohio_expired" | "ohio_wrong_state";

type OhioScenarioPreset = {
  id: LicenseScenarioId;
  label: string;
  description: string;
  form: {
    license_number: string;
    dea_number: string;
    facility_name: string;
    ship_to_state: string;
    internal_notes: string;
  };
};

const OHIO_SCENARIO_PRESETS: OhioScenarioPreset[] = [
  {
    id: "ohio_happy",
    label: "Happy path",
    description: "Valid Ohio TDDD license, correct DEA, matching ship-to state.",
    form: {
      license_number: "02-345678",
      dea_number: "BS1234567",
      facility_name: "SummitCare Clinics – Columbus",
      ship_to_state: "OH",
      internal_notes: "Clean Ohio TDDD license, no flags on file.",
    },
  },
  {
    id: "ohio_expired",
    label: "Expired license",
    description: "Known Ohio TDDD license with an internal note suggesting expiry.",
    form: {
      license_number: "02-987654",
      dea_number: "BS7654321",
      facility_name: "Riverbend Medical Center",
      ship_to_state: "OH",
      internal_notes:
        "Board shows license expired last month. Customer claims renewal submitted.",
    },
  },
  {
    id: "ohio_wrong_state",
    label: "Wrong ship-to state",
    description: "Valid-looking Ohio license but ship-to state is not OH.",
    form: {
      license_number: "02-112233",
      dea_number: "BT1112223",
      facility_name: "Midwest Health Group",
      ship_to_state: "MI",
      internal_notes:
        "Customer is shipping to a Michigan location using an Ohio license.",
    },
  },
];

const NY_PHARMACY_PRESETS = {
  happy: {
    label: "NY pharmacy – active license (happy path)",
    payload: {
      license_number: "NY-PHARM-12345",
      license_type: "pharmacy",
      ship_to_state: "NY",
      expiration_date: "2030-01-01", // future date
    } satisfies NyPharmacyFormValues,
  },
  expired: {
    label: "NY pharmacy – expired license",
    payload: {
      license_number: "NY-PHARM-EXPIRED",
      license_type: "pharmacy",
      ship_to_state: "NY",
      expiration_date: "2020-01-01", // past date
    } satisfies NyPharmacyFormValues,
  },
  wrongState: {
    label: "NY pharmacy – wrong ship-to state",
    payload: {
      license_number: "NY-PHARM-OUT-OF-STATE",
      license_type: "pharmacy",
      ship_to_state: "NJ", // non-NY
      expiration_date: "2030-01-01", // still active; only state is wrong
    } satisfies NyPharmacyFormValues,
  },
} as const;

interface TraceShape {
  endpoint: string;
  payload: any;
  response: any;
  error: string | null;
  at: string;
}

function OhioTdddSandbox() {
  const { enabled: ragDebugEnabled } = useRagDebug();
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
  const [selectedScenarioId, setSelectedScenarioId] =
    React.useState<LicenseScenarioId>("custom");
  const ohioDecisionWithDebug = decision
    ? {
        ...decision,
        debug_info:
          decision.debug_info ??
          (decision.rag_sources ? { rag_sources: decision.rag_sources } : null),
      }
    : null;

  function applyOhioScenario(presetId: LicenseScenarioId) {
    if (presetId === "custom") {
      setSelectedScenarioId("custom");
      return;
    }
    const preset = OHIO_SCENARIO_PRESETS.find((p) => p.id === presetId);
    if (!preset) {
      return;
    }
    setSelectedScenarioId(presetId);
    setForm((prev) => ({
      ...prev,
      tddd_number: preset.form.license_number,
      account_number: preset.form.dea_number,
      facility_name: preset.form.facility_name,
      ship_to_state: preset.form.ship_to_state,
      internal_notes: preset.form.internal_notes,
    }));
  }

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
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-[10px] font-medium text-slate-200">
          <Globe className="h-3 w-3" />
          <span>OH license engine</span>
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <span className="font-medium text-slate-300">Scenario:</span>
          <select
            value={selectedScenarioId}
            onChange={(e) =>
              applyOhioScenario(e.target.value as LicenseScenarioId)
            }
            className="rounded-full border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-slate-100"
          >
            <option value="custom">Custom (free-form)</option>
            {OHIO_SCENARIO_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
        {selectedScenarioId !== "custom" && (
          <p className="text-[10px] text-slate-500">
            {
              OHIO_SCENARIO_PRESETS.find(
                (p) => p.id === selectedScenarioId
              )?.description
            }
          </p>
        )}
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

      {ohioDecisionWithDebug && (
        <RegulatoryInsightsPanel
          title="Ohio TDDD license decision"
          decision={ohioDecisionWithDebug}
          missingFields={decision?.missing_fields ?? decision?.missingFields ?? []}
          aiDebugEnabled={ragDebugEnabled}
        />
      )}

      {trace && ragDebugEnabled && (
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
  const { enabled: ragDebugEnabled } = useRagDebug();
  const [form, setForm] = React.useState<NyPharmacyFormValues>(
    NY_PHARMACY_PRESETS.happy.payload
  );
  const [decision, setDecision] = React.useState<LicenseDecisionResponse | null>(
    null
  );
  const [error, setError] = React.useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = React.useState(false);
  const [trace, setTrace] = React.useState<TraceShape | null>(null);
  const [showTrace, setShowTrace] = React.useState(false);
  const nyDecisionWithDebug = decision
    ? {
        ...decision,
        debug_info:
          decision.debug_info ??
          (decision.rag_sources ? { rag_sources: decision.rag_sources } : null),
      }
    : null;

  const applyNyPreset = (key: keyof typeof NY_PHARMACY_PRESETS) => {
    const preset = NY_PHARMACY_PRESETS[key];
    setForm(preset.payload);
    setDecision(null);
    setError(null);
    setTrace(null);
  };

  function handleChange(field: keyof NyPharmacyFormValues, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
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
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-[10px] font-medium text-slate-200">
          <Globe className="h-3 w-3" />
          <span>NY license engine</span>
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <span className="font-medium text-slate-300">Scenario:</span>
          <select
            className="rounded-full border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-slate-100"
            onChange={(e) => {
              const value = e.target.value as keyof typeof NY_PHARMACY_PRESETS;
              if (value) applyNyPreset(value);
            }}
            defaultValue=""
          >
            <option value="" disabled>
              Load preset…
            </option>
            <option value="happy">{NY_PHARMACY_PRESETS.happy.label}</option>
            <option value="expired">{NY_PHARMACY_PRESETS.expired.label}</option>
            <option value="wrongState">{NY_PHARMACY_PRESETS.wrongState.label}</option>
          </select>
        </label>
        <p className="text-[10px] text-slate-500">
          Swap between happy path, expired license, and wrong ship-to scenarios.
        </p>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <div className="space-y-1.5">
          <label className="block text-[10px] text-slate-300">
            License number
            <input
              name="license_number"
              value={form.license_number}
              onChange={(e) => handleChange("license_number", e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-100"
              placeholder="NY-PHARM-12345"
            />
          </label>
          <label className="block text-[10px] text-slate-300">
            License type
            <input
              name="license_type"
              value={form.license_type}
              onChange={(e) => handleChange("license_type", e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
              placeholder="pharmacy"
            />
          </label>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[10px] text-slate-300">
            Ship-to state
            <input
              name="ship_to_state"
              value={form.ship_to_state}
              onChange={(e) => handleChange("ship_to_state", e.target.value)}
              className="mt-0.5 w-24 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
              placeholder="NY"
            />
          </label>
          <label className="block text-[10px] text-slate-300">
            Expiration date
            <input
              type="date"
              name="expiration_date"
              value={form.expiration_date}
              onChange={(e) => handleChange("expiration_date", e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
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

      {nyDecisionWithDebug && (
        <RegulatoryInsightsPanel
          title="NY pharmacy license decision"
          decision={nyDecisionWithDebug}
          missingFields={decision?.missing_fields ?? decision?.missingFields ?? []}
          aiDebugEnabled={ragDebugEnabled}
        />
      )}

      {trace && ragDebugEnabled && (
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

import React, { useState } from "react";

import { DecisionStatusBadge } from "../../components/DecisionStatusBadge";
import { RiskPill } from "../../components/RiskPill";
import { useRagDebug } from "../../devsupport/RagDebugContext";
import { useTraceSelection } from "../../state/traceSelectionContext";
import type { DecisionOutcome } from "../../types/decision";
import { VerticalBadge } from "../../components/VerticalBadge";

type JourneyScenarioKey = "happy" | "expiredLicense" | "wrongState";

interface HospitalCsfPayload {
  facility_name: string;
  facility_type: string;
  account_number: string;
  pharmacy_license_number: string;
  dea_number: string;
  pharmacist_in_charge_name: string;
  pharmacist_contact_phone: string;
  ship_to_state: string;
  attestation_accepted: boolean;
  controlled_substances: unknown[];
}

interface OhioTdddPayload {
  license_number: string;
  license_type: string;
  ship_to_state: string;
  expiration_date: string;
}

interface JourneyScenarioConfig {
  label: string;
  description: string;
  csfPayload: HospitalCsfPayload;
  ohioTdddPayload: OhioTdddPayload;
  mockOrderEndpoint: string;
}

const OHIO_HOSPITAL_SCENARIOS: Record<JourneyScenarioKey, JourneyScenarioConfig> = {
  happy: {
    label: "Ohio hospital – Schedule II (happy path)",
    description:
      "Hospital CSF and Ohio TDDD license are both valid. Order should be approved.",
    csfPayload: {
      facility_name: "Demo Hospital – Happy Path",
      facility_type: "hospital",
      account_number: "ACC-OH-HAPPY",
      pharmacy_license_number: "LIC-OH-HAPPY",
      dea_number: "DEA-OH-HAPPY",
      pharmacist_in_charge_name: "Dr. Happy",
      pharmacist_contact_phone: "555-1000",
      ship_to_state: "OH",
      attestation_accepted: true,
      controlled_substances: [],
    },
    ohioTdddPayload: {
      license_number: "TDDD-OH-HAPPY",
      license_type: "TDDD",
      ship_to_state: "OH",
      expiration_date: "2030-01-01",
    },
    mockOrderEndpoint: "/orders/mock/ohio-hospital-approval",
  },
  expiredLicense: {
    label: "Ohio hospital – expired TDDD license",
    description:
      "Hospital CSF looks fine, but the Ohio TDDD license is expired. Order should be blocked.",
    csfPayload: {
      facility_name: "Demo Hospital – Expired",
      facility_type: "hospital",
      account_number: "ACC-OH-EXP",
      pharmacy_license_number: "LIC-OH-EXP",
      dea_number: "DEA-OH-EXP",
      pharmacist_in_charge_name: "Dr. Expired",
      pharmacist_contact_phone: "555-2000",
      ship_to_state: "OH",
      attestation_accepted: true,
      controlled_substances: [],
    },
    ohioTdddPayload: {
      license_number: "TDDD-OH-EXPIRED",
      license_type: "TDDD",
      ship_to_state: "OH",
      expiration_date: "2020-01-01", // clearly expired
    },
    mockOrderEndpoint: "/orders/mock/ohio-hospital-expired-license",
  },
  wrongState: {
    label: "Ohio hospital – wrong ship-to state",
    description:
      "Hospital CSF is fine, but ship-to is outside Ohio, so license and order should require review.",
    csfPayload: {
      facility_name: "Demo Hospital – Wrong State",
      facility_type: "hospital",
      account_number: "ACC-OH-STATE",
      pharmacy_license_number: "LIC-OH-STATE",
      dea_number: "DEA-OH-STATE",
      pharmacist_in_charge_name: "Dr. State",
      pharmacist_contact_phone: "555-3000",
      ship_to_state: "PA", // not OH
      attestation_accepted: true,
      controlled_substances: [],
    },
    ohioTdddPayload: {
      license_number: "TDDD-OH-STATE",
      license_type: "TDDD",
      ship_to_state: "PA",
      expiration_date: "2030-01-01",
    },
    mockOrderEndpoint: "/orders/mock/ohio-hospital-wrong-state",
  },
};

interface JourneyStepResult {
  decision?: DecisionOutcome | null;
  raw?: unknown;
  error?: string | null;
}

export const OhioHospitalJourneyPanel: React.FC = () => {
  const { enabled: aiDebugEnabled } = useRagDebug();
  const { setSelectedTraceId } = useTraceSelection();
  const [scenario, setScenario] = useState<JourneyScenarioKey>("happy");
  const [traceId, setTraceId] = useState<string | null>(null);

  const [csfResult, setCsfResult] = useState<JourneyStepResult | null>(null);
  const [licenseResult, setLicenseResult] = useState<JourneyStepResult | null>(null);
  const [orderResult, setOrderResult] = useState<JourneyStepResult | null>(null);

  const [running, setRunning] = useState(false);

  const runJourney = async () => {
    const config = OHIO_HOSPITAL_SCENARIOS[scenario];
    setRunning(true);
    setCsfResult(null);
    setLicenseResult(null);
    setOrderResult(null);

    const id = (crypto as any).randomUUID
      ? (crypto as any).randomUUID()
      : `ui-trace-${Date.now()}`;
    setTraceId(id);
    setSelectedTraceId(id);

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      "x-autocomply-trace-id": id,
    };

    try {
      const csfResp = await fetch("/csf/hospital/evaluate", {
        method: "POST",
        headers,
        body: JSON.stringify(config.csfPayload),
      });
      if (!csfResp.ok) {
        setCsfResult({ error: `HTTP ${csfResp.status}` });
        throw new Error("CSF evaluate failed");
      }
      const csfJson = await csfResp.json();
      setCsfResult({
        decision: csfJson as DecisionOutcome,
        raw: csfJson,
      });

      const licenseResp = await fetch("/license/ohio-tddd/evaluate", {
        method: "POST",
        headers,
        body: JSON.stringify(config.ohioTdddPayload),
      });
      if (!licenseResp.ok) {
        setLicenseResult({ error: `HTTP ${licenseResp.status}` });
        throw new Error("Ohio TDDD evaluate failed");
      }
      const licenseJson = await licenseResp.json();
      const licenseDecision = (licenseJson as any).decision ?? licenseJson;
      setLicenseResult({
        decision: licenseDecision as DecisionOutcome,
        raw: licenseJson,
      });

      const orderResp = await fetch(config.mockOrderEndpoint, {
        method: "GET",
        headers: {
          "x-autocomply-trace-id": id,
        },
      });
      if (!orderResp.ok) {
        setOrderResult({ error: `HTTP ${orderResp.status}` });
        return;
      }
      const orderJson = await orderResp.json();
      const orderDecision = (orderJson as any).decision ?? orderJson;
      setOrderResult({
        decision: orderDecision as DecisionOutcome,
        raw: orderJson,
      });
    } catch (e) {
    } finally {
      setRunning(false);
    }
  };

  const renderStep = (
    title: string,
    result: JourneyStepResult | null,
    index: number
  ) => {
    const decision = result?.decision;
    const error = result?.error;

    return (
      <div className="flex gap-3">
        <div className="flex flex-col items-center pt-1">
          <div className="flex h-6 w-6 items-center justify-center rounded-full border border-zinc-600 bg-zinc-900 text-[11px] text-zinc-200">
            {index}
          </div>
          {index < 3 && <div className="mt-1 h-full w-px flex-1 bg-zinc-700/60" />}
        </div>
        <div className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold text-zinc-50">{title}</div>
            {decision && (
              <div className="flex items-center gap-2">
                <DecisionStatusBadge status={decision.status} policyTrace={decision.policy_trace} />
                <RiskPill riskLevel={decision.risk_level ?? undefined} />
              </div>
            )}
          </div>
          {error && <p className="mt-1 text-[11px] text-red-300">Error: {error}</p>}
          {!error && decision && (
            <>
              <p className="mt-1 text-[11px] text-zinc-300">{decision.reason}</p>
              {decision.trace_id && (
                <p className="mt-1 text-[10px] text-zinc-500">
                  Trace ID:&nbsp;
                  <span className="break-all font-mono">{decision.trace_id}</span>
                </p>
              )}
            </>
          )}
          {!error && !decision && (
            <p className="mt-1 text-[11px] text-zinc-500">Awaiting result…</p>
          )}
          {aiDebugEnabled && result?.raw && (
            <details className="mt-1">
              <summary className="cursor-pointer text-[11px] text-zinc-400 hover:text-zinc-200">
                Raw JSON
              </summary>
              <pre className="mt-1 max-h-40 overflow-auto rounded-md bg-black/70 p-2 text-[10px] text-zinc-300">
                {JSON.stringify(result.raw, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/75 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-50">Ohio Hospital – Journey Explorer</h2>
            <VerticalBadge label="Ohio Hospital vertical" />
          </div>
          <p className="text-xs text-zinc-400">
            Run a full CSF → license → order journey with a single trace ID and see how each engine contributes to the
            final decision.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
            value={scenario}
            onChange={(e) => setScenario(e.target.value as JourneyScenarioKey)}
          >
            <option value="happy">{OHIO_HOSPITAL_SCENARIOS.happy.label}</option>
            <option value="expiredLicense">{OHIO_HOSPITAL_SCENARIOS.expiredLicense.label}</option>
            <option value="wrongState">{OHIO_HOSPITAL_SCENARIOS.wrongState.label}</option>
          </select>
          <button
            type="button"
            onClick={runJourney}
            disabled={running}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {running ? "Running…" : "Run journey"}
          </button>
        </div>
      </div>

      <p className="text-[11px] text-zinc-400">{OHIO_HOSPITAL_SCENARIOS[scenario].description}</p>

      {traceId && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-[11px] text-zinc-300">
          Journey trace ID:&nbsp;
          <span className="break-all font-mono">{traceId}</span>
          <span className="ml-1 text-zinc-500">
            (sent to all three endpoints via <code>x-autocomply-trace-id</code>)
          </span>
        </div>
      )}

      <div className="space-y-3">
        {renderStep("1. Hospital CSF evaluate", csfResult, 1)}
        {renderStep("2. Ohio TDDD license evaluate", licenseResult, 2)}
        {renderStep("3. Mock order decision", orderResult, 3)}
      </div>
    </div>
  );
};

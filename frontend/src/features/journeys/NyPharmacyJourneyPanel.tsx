import React, { useState } from "react";

import { DecisionStatusBadge } from "../../components/DecisionStatusBadge";
import { RiskPill } from "../../components/RiskPill";
import { useRagDebug } from "../../devsupport/RagDebugContext";
import { useTraceSelection } from "../../state/traceSelectionContext";
import type { DecisionOutcome } from "../../types/decision";
import { VerticalBadge } from "../../components/VerticalBadge";

type NyScenarioKey = "happy" | "expiredLicense" | "wrongState";

interface NyPharmacyPayload {
  license_number: string;
  license_type: string;
  ship_to_state: string;
  expiration_date: string;
}

interface NyScenarioConfig {
  label: string;
  description: string;
  licensePayload: NyPharmacyPayload;
  mockOrderEndpoint: string;
}

const NY_PHARMACY_SCENARIOS: Record<NyScenarioKey, NyScenarioConfig> = {
  happy: {
    label: "NY pharmacy – active license (happy path)",
    description:
      "NY pharmacy license is active and matches a New York ship-to location. Order should be ok_to_ship.",
    licensePayload: {
      license_number: "NY-PHARM-HAPPY",
      license_type: "pharmacy",
      ship_to_state: "NY",
      expiration_date: "2030-01-01",
    },
    mockOrderEndpoint: "/orders/mock/ny-pharmacy-approval",
  },
  expiredLicense: {
    label: "NY pharmacy – expired license",
    description:
      "License is expired while ship_to_state is NY. License and order should be blocked.",
    licensePayload: {
      license_number: "NY-PHARM-EXPIRED",
      license_type: "pharmacy",
      ship_to_state: "NY",
      expiration_date: "2020-01-01",
    },
    mockOrderEndpoint: "/orders/mock/ny-pharmacy-expired-license",
  },
  wrongState: {
    label: "NY pharmacy – wrong ship-to state",
    description:
      "License is structurally valid but ship_to_state is outside NY. Decision should need review.",
    licensePayload: {
      license_number: "NY-PHARM-OUT-OF-STATE",
      license_type: "pharmacy",
      ship_to_state: "NJ", // non-NY
      expiration_date: "2030-01-01",
    },
    mockOrderEndpoint: "/orders/mock/ny-pharmacy-wrong-state",
  },
};

interface JourneyStepResult {
  decision?: DecisionOutcome | null;
  raw?: unknown;
  error?: string | null;
}

export const NyPharmacyJourneyPanel: React.FC = () => {
  const { enabled: aiDebugEnabled } = useRagDebug();
  const { setSelectedTraceId } = useTraceSelection();
  const [scenario, setScenario] = useState<NyScenarioKey>("happy");
  const [traceId, setTraceId] = useState<string | null>(null);

  const [licenseResult, setLicenseResult] = useState<JourneyStepResult | null>(null);
  const [orderResult, setOrderResult] = useState<JourneyStepResult | null>(null);

  const [running, setRunning] = useState(false);

  const runJourney = async () => {
    const config = NY_PHARMACY_SCENARIOS[scenario];
    setRunning(true);
    setLicenseResult(null);
    setOrderResult(null);

    const id = (crypto as any).randomUUID
      ? (crypto as any).randomUUID()
      : `ui-trace-ny-${Date.now()}`;
    setTraceId(id);
    setSelectedTraceId(id);

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      "x-autocomply-trace-id": id,
    };

    try {
      const licenseResp = await fetch("/license/ny-pharmacy/evaluate", {
        method: "POST",
        headers,
        body: JSON.stringify(config.licensePayload),
      });

      if (!licenseResp.ok) {
        setLicenseResult({ error: `HTTP ${licenseResp.status}` });
        throw new Error("NY Pharmacy evaluate failed");
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
          {index < 2 && <div className="mt-1 h-full w-px flex-1 bg-zinc-700/60" />}
        </div>
        <div className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold text-zinc-50">{title}</div>
            {decision && (
              <div className="flex items-center gap-2">
                <DecisionStatusBadge status={decision.status} />
                <RiskPill riskLevel={decision.risk_level ?? undefined} />
              </div>
            )}
          </div>

          {error && (
            <p className="mt-1 text-[11px] text-red-300">Error: {error}</p>
          )}

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
            <h2 className="text-sm font-semibold text-zinc-50">NY Pharmacy – Journey Explorer</h2>
            <VerticalBadge label="NY Pharmacy vertical" />
          </div>
          <p className="text-xs text-zinc-400">
            Run a license → order journey for New York pharmacy scenarios with a shared trace ID.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
            value={scenario}
            onChange={(e) => setScenario(e.target.value as NyScenarioKey)}
          >
            <option value="happy">{NY_PHARMACY_SCENARIOS.happy.label}</option>
            <option value="expiredLicense">{NY_PHARMACY_SCENARIOS.expiredLicense.label}</option>
            <option value="wrongState">{NY_PHARMACY_SCENARIOS.wrongState.label}</option>
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

      <p className="text-[11px] text-zinc-400">{NY_PHARMACY_SCENARIOS[scenario].description}</p>

      {traceId && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-[11px] text-zinc-300">
          Journey trace ID:&nbsp;
          <span className="break-all font-mono">{traceId}</span>
          <span className="ml-1 text-zinc-500">
            (sent to both endpoints via <code>x-autocomply-trace-id</code>)
          </span>
        </div>
      )}

      <div className="space-y-3">
        {renderStep("1. NY Pharmacy license evaluate", licenseResult, 1)}
        {renderStep("2. Mock order decision", orderResult, 2)}
      </div>
    </div>
  );
};

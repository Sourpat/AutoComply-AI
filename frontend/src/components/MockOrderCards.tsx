import React from "react";

import { DecisionStatusBadge } from "./DecisionStatusBadge";
import {
  MockOrderScenarioBadge,
  type MockOrderScenarioSeverity,
} from "./MockOrderScenarioBadge";
import { API_BASE } from "../api/csfHospitalClient";
import type { MockOrderDecisionResponse } from "../types/api";

interface MockOrderCardConfig {
  id: string;
  title: string;
  description: string;
  endpoint: string;
  severity: MockOrderScenarioSeverity;
}

const MOCK_ORDER_CARDS: MockOrderCardConfig[] = [
  {
    id: "ohio-hospital-happy",
    title: "Ohio hospital – Schedule II (happy path)",
    description:
      "Hospital CSF and Ohio TDDD license are both valid. Schedule II order is approved.",
    endpoint: "/orders/mock/ohio-hospital-approval",
    severity: "happy_path",
  },
  {
    id: "ohio-hospital-expired",
    title: "Ohio hospital – Schedule II (expired license)",
    description:
      "Hospital CSF looks fine, but the Ohio TDDD license is expired. Order is blocked.",
    endpoint: "/orders/mock/ohio-hospital-expired-license",
    severity: "investigate",
  },
  {
    id: "ohio-facility-happy",
    title: "Ohio facility – Schedule II (happy path)",
    description: "Facility CSF and Ohio TDDD license are both valid for this order.",
    endpoint: "/orders/mock/ohio-facility-approval",
    severity: "happy_path",
  },
  {
    id: "ny-pharmacy-happy",
    title: "NY pharmacy – controlled substances (happy path)",
    description:
      "NY pharmacy license is active and matches the ship-to location.",
    endpoint: "/orders/mock/ny-pharmacy-approval",
    severity: "happy_path",
  },
];

export function MockOrderCards() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {MOCK_ORDER_CARDS.map((card) => (
        <MockOrderCard key={card.id} config={card} />
      ))}
    </div>
  );
}

function MockOrderCard({ config }: { config: MockOrderCardConfig }) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<MockOrderDecisionResponse | null>(
    null
  );

  async function runScenario() {
    setLoading(true);
    setError(null);

    try {
      const resp = await fetch(`${API_BASE}${config.endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!resp.ok) {
        const message = await resp.text();
        throw new Error(message || "Mock order request failed.");
      }

      const json = (await resp.json()) as MockOrderDecisionResponse;
      setData(json);
    } catch (err: any) {
      setError(err?.message ?? "Unable to load mock order decision.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void runScenario();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.endpoint]);

  const decision = data?.decision;

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{config.title}</h3>
          <p className="text-[11px] leading-relaxed text-slate-600">
            {config.description}
          </p>
        </div>
        <MockOrderScenarioBadge
          label={
            config.severity === "happy_path"
              ? "Happy path"
              : config.severity === "edge_case"
              ? "Edge case"
              : "Investigate"
          }
          severity={config.severity}
        />
      </div>

      {decision ? (
        <div className="space-y-1 rounded-lg bg-slate-50 p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <DecisionStatusBadge
              status={decision.status}
              riskLevel={decision.risk_level ?? undefined}
              labelPrefix="Status"
            />
            {data?.scenario_id && (
              <span className="rounded-full bg-slate-900/5 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                {data.scenario_id}
              </span>
            )}
          </div>
          {decision.reason && (
            <p className="text-[11px] text-slate-700">{decision.reason}</p>
          )}
        </div>
      ) : (
        <div className="rounded-lg bg-slate-50 p-3 text-[11px] text-slate-500">
          Trigger this scenario to see status, risk, and reason.
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={runScenario}
          disabled={loading}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Running…" : "Run scenario"}
        </button>
        <span className="text-[10px] text-slate-500">Endpoint: {config.endpoint}</span>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-[11px] text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}

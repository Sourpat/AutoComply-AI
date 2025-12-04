import React from "react";

import {
  MockOrderScenarioBadge,
  type MockOrderScenarioSeverity,
} from "./MockOrderScenarioBadge";
import { API_BASE } from "../api/csfHospitalClient";
import type { MockOrderDecisionResponse } from "../types/api";
import { RegulatoryInsightsPanel } from "./RegulatoryInsightsPanel";
import { useRagDebug } from "../devsupport/RagDebugContext";

interface MockOrderCardConfig {
  id: string;
  title: string;
  description: string;
  endpoint: string;
  severity: MockOrderScenarioSeverity;
}

const MOCK_ORDER_CARDS: MockOrderCardConfig[] = [
  // --- Ohio hospital cards (already added in earlier steps) ---
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
    id: "ohio-hospital-wrong-state",
    title: "Ohio hospital – Schedule II (wrong ship-to state)",
    description:
      "Hospital CSF data is fine, but ship-to is outside Ohio. Order requires review.",
    endpoint: "/orders/mock/ohio-hospital-wrong-state",
    severity: "edge_case",
  },

  // --- Ohio facility card (existing) ---
  {
    id: "ohio-facility-happy",
    title: "Ohio facility – Schedule II (happy path)",
    description: "Facility CSF and Ohio TDDD license are both valid for this order.",
    endpoint: "/orders/mock/ohio-facility-approval",
    severity: "happy_path",
  },

  // --- NY Pharmacy cards (NEW) ---
  {
    id: "ny-pharmacy-happy",
    title: "NY pharmacy – controlled substances (happy path)",
    description:
      "NY pharmacy license is active and matches the New York ship-to location.",
    endpoint: "/orders/mock/ny-pharmacy-approval",
    severity: "happy_path",
  },
  {
    id: "ny-pharmacy-expired",
    title: "NY pharmacy – expired license",
    description:
      "NY pharmacy license is expired. Order is blocked until the license is renewed.",
    endpoint: "/orders/mock/ny-pharmacy-expired-license",
    severity: "investigate",
  },
  {
    id: "ny-pharmacy-wrong-state",
    title: "NY pharmacy – wrong ship-to state",
    description:
      "NY pharmacy license looks valid, but ship-to is outside New York. Order requires review.",
    endpoint: "/orders/mock/ny-pharmacy-wrong-state",
    severity: "edge_case",
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
  const { enabled: ragDebugEnabled } = useRagDebug();

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

  const decision = data?.decision ?? null;
  const decisionDebugInfo =
    decision?.debug_info ??
    (data?.developer_trace ? { developer_trace: data.developer_trace } : null);
  const decisionWithDebug = decision
    ? { ...decision, debug_info: decisionDebugInfo }
    : null;

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

      {decisionWithDebug ? (
        <RegulatoryInsightsPanel
          title="Mock order decision"
          decision={decisionWithDebug}
          missingFields={null}
          compact
          aiDebugEnabled={ragDebugEnabled}
        />
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

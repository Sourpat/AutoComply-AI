import React from "react";
import { CopyCurlButton } from "../../components/CopyCurlButton";
import { buildCurlCommand } from "../../utils/curl";
import { useTraceSelection } from "../../state/traceSelectionContext";

interface TenantWhoAmIResponse {
  tenant_id: string;
  note: string;
}

interface HealthResponse {
  status: string;
  details?: Record<string, unknown>;
}

interface CaseDecisionSummary {
  engine_family: string;
  decision_type: string;
  status: string;
  reason: string;
  risk_level?: string | null;
}

interface ComplianceCaseSummary {
  trace_id: string;
  overall_status: string;
  overall_risk: string;
  decisions: CaseDecisionSummary[];
}

export const OperationalOverviewPanel: React.FC = () => {
  const { selectedTraceId } = useTraceSelection();

  const [tenant, setTenant] = React.useState<TenantWhoAmIResponse | null>(null);
  const [health, setHealth] = React.useState<HealthResponse | null>(null);
  const [caseSummary, setCaseSummary] =
    React.useState<ComplianceCaseSummary | null>(null);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [tenantCurl, setTenantCurl] = React.useState<string | null>(null);

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    setCaseSummary(null);

    try {
      // 1) Tenant
      const whoResp = await fetch("/tenants/whoami");
      if (!whoResp.ok) {
        throw new Error(`whoami failed: ${whoResp.status}`);
      }
      const whoJson = (await whoResp.json()) as TenantWhoAmIResponse;
      setTenant(whoJson);

      const whoCurl = buildCurlCommand({
        method: "GET",
        url: "/tenants/whoami",
      });
      setTenantCurl(whoCurl);

      // 2) Health
      const healthResp = await fetch("/health");
      if (!healthResp.ok) {
        throw new Error(`health failed: ${healthResp.status}`);
      }
      const healthJson = (await healthResp.json()) as HealthResponse;
      setHealth(healthJson);

      // 3) Optional: case summary for selected trace
      if (selectedTraceId) {
        const csResp = await fetch(
          `/cases/summary/${encodeURIComponent(selectedTraceId)}`
        );
        if (csResp.ok) {
          const csJson = (await csResp.json()) as ComplianceCaseSummary;
          setCaseSummary(csJson);
        }
      }
    } catch (err) {
      setError("Failed to load operational overview. Check backend logs.");
    } finally {
      setLoading(false);
    }
  };

  const healthChipClass =
    health?.status === "ok"
      ? "bg-emerald-900/40 text-emerald-200 border-emerald-700/70"
      : "bg-red-900/40 text-red-200 border-red-700/70";

  const caseStatusChipClass: Record<string, string> = {
    ok_to_ship:
      "bg-emerald-900/40 text-emerald-200 border-emerald-700/70",
    needs_review:
      "bg-amber-900/40 text-amber-200 border-amber-700/70",
    blocked: "bg-red-900/40 text-red-200 border-red-700/70",
  };

  const caseStatusClass =
    (caseSummary && caseStatusChipClass[caseSummary.overall_status]) ||
    "bg-zinc-900/60 text-zinc-200 border-zinc-700/70";

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-50">
            Operational Overview
          </h2>
          <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-zinc-700/70 bg-zinc-900/70 px-2 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            <span className="text-[10px] font-medium text-zinc-200">Tenant-aware ops</span>
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            Snapshot of tenant context, backend health, and last case status.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 hover:bg-indigo-500"
              disabled={loading}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            {tenantCurl && (
              <CopyCurlButton
                command={tenantCurl}
                label="whoami cURL"
              />
            )}
          </div>
          <span className="text-[10px] text-zinc-500">
            Trace: {selectedTraceId || "none"}
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-[11px] text-red-200">
          {error}
        </div>
      )}

      {/* Tenant */}
      <div className="space-y-1">
        <p className="text-[11px] font-semibold text-zinc-200">
          Tenant
        </p>
        <p className="text-[11px] text-zinc-300">
          {tenant ? (
            <>
              <span className="font-mono text-zinc-100">
                {tenant.tenant_id}
              </span>
              {tenant.note && (
                <span className="ml-1 text-zinc-500">· {tenant.note}</span>
              )}
            </>
          ) : (
            <span className="text-zinc-500">
              Click <span className="font-semibold">Refresh</span> to load
              tenant context.
            </span>
          )}
        </p>
      </div>

      {/* Health */}
      <div className="space-y-1">
        <p className="text-[11px] font-semibold text-zinc-200">
          Health
        </p>
        {health ? (
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${healthChipClass}`}
            >
              {health.status || "unknown"}
            </span>
          </div>
        ) : (
          <p className="text-[11px] text-zinc-500">
            Backend health not loaded yet.
          </p>
        )}
      </div>

      {/* Case summary snippet */}
      <div className="space-y-1">
        <p className="text-[11px] font-semibold text-zinc-200">
          Last case (selected trace)
        </p>
        {selectedTraceId && caseSummary ? (
          <div className="space-y-1 text-[11px] text-zinc-300">
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${caseStatusClass}`}
              >
                {caseSummary.overall_status} • risk {caseSummary.overall_risk}
              </span>
            </div>
            <ul className="mt-1 space-y-1">
              {caseSummary.decisions.slice(0, 3).map((d, idx) => (
                <li key={idx}>
                  <span className="font-mono text-zinc-400">
                    {d.engine_family}:{d.decision_type}
                  </span>
                  {" — "}
                  <span className="font-semibold">{d.status}</span>
                  {d.risk_level && (
                    <span className="text-zinc-400">
                      {" "}
                      (risk {d.risk_level})
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {caseSummary.decisions.length > 3 && (
              <p className="text-[10px] text-zinc-500">
                + {caseSummary.decisions.length - 3} more decisions
              </p>
            )}
          </div>
        ) : selectedTraceId ? (
          <p className="text-[11px] text-zinc-500">
            No case summary loaded for this trace yet. Click
            <span className="font-semibold"> Refresh</span>.
          </p>
        ) : (
          <p className="text-[11px] text-zinc-500">
            Select or run a journey to associate a trace with this view.
          </p>
        )}
      </div>
    </div>
  );
};

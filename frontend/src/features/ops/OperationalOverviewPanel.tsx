import React, { useEffect, useMemo, useState } from "react";
import { CopyCurlButton } from "../../components/CopyCurlButton";
import { buildCurlCommand } from "../../utils/curl";
import { useTraceSelection } from "../../state/traceSelectionContext";
import { apiFetch, toApiErrorDetails, type ApiErrorDetails } from "../../lib/api";
import { ApiErrorPanel } from "../../components/ApiErrorPanel";

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

interface RecentDecisionItem {
  trace_id?: string;
  status?: string;
  decision_type?: string;
  engine_family?: string;
  last_updated?: string;
  risk_level?: string;
  risk_score?: number;
}

const deriveRiskLevel = (item: RecentDecisionItem): "low" | "medium" | "high" => {
  const explicitRisk = (item.risk_level || "").toString().toLowerCase();
  if (explicitRisk === "low" || explicitRisk === "medium" || explicitRisk === "high") {
    return explicitRisk;
  }

  const status = (item.status || "").toString().toLowerCase();
  if (status === "blocked") return "high";
  if (status === "needs_review") return "medium";
  return "low";
};

export const OperationalOverviewPanel: React.FC = () => {
  const { selectedTraceId } = useTraceSelection();

  const [tenant, setTenant] = useState<TenantWhoAmIResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [caseSummary, setCaseSummary] =
    useState<ComplianceCaseSummary | null>(null);
  const [recentDecisions, setRecentDecisions] = useState<RecentDecisionItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [tenantError, setTenantError] = useState<ApiErrorDetails | null>(null);
  const [healthError, setHealthError] = useState<ApiErrorDetails | null>(null);
  const [caseError, setCaseError] = useState<ApiErrorDetails | null>(null);
  const [recentError, setRecentError] = useState<ApiErrorDetails | null>(null);

  const [tenantCurl, setTenantCurl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchRecentDecisions = async () => {
      try {
        const data = await apiFetch<RecentDecisionItem[]>(
          "/decisions/recent?limit=50"
        );
        if (!cancelled) {
          setRecentDecisions(Array.isArray(data) ? data : []);
          setRecentError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setRecentError(toApiErrorDetails(err, { url: "/decisions/recent?limit=50" }));
        }
      }
    };

    void fetchRecentDecisions();

    return () => {
      cancelled = true;
    };
  }, []);

  const { lowRiskCount, mediumRiskCount, highRiskCount } = useMemo(() => {
    if (!recentDecisions || recentDecisions.length === 0) {
      return { lowRiskCount: 0, mediumRiskCount: 0, highRiskCount: 0 };
    }

    let low = 0;
    let med = 0;
    let high = 0;

    for (const item of recentDecisions) {
      const level = deriveRiskLevel(item);
      if (level === "high") high += 1;
      else if (level === "medium") med += 1;
      else low += 1;
    }

    return { lowRiskCount: low, mediumRiskCount: med, highRiskCount: high };
  }, [recentDecisions]);

  const handleRefresh = async () => {
    setLoading(true);
    setCaseSummary(null);
    setTenantError(null);
    setHealthError(null);
    setCaseError(null);

    // 1) Tenant
    try {
      const whoJson = await apiFetch<TenantWhoAmIResponse>("/tenants/whoami");
      setTenant(whoJson);
      const whoCurl = buildCurlCommand({
        method: "GET",
        endpoint: "/tenants/whoami",
      });
      setTenantCurl(whoCurl);
    } catch (err) {
      setTenantError(toApiErrorDetails(err, { url: "/tenants/whoami" }));
    }

    // 2) Health
    try {
      const healthJson = await apiFetch<HealthResponse>("/health");
      setHealth(healthJson);
    } catch (err) {
      setHealthError(toApiErrorDetails(err, { url: "/health" }));
    }

    // 3) Optional: case summary for selected trace
    if (selectedTraceId) {
      try {
        const csJson = await apiFetch<ComplianceCaseSummary>(
          `/cases/summary/${encodeURIComponent(selectedTraceId)}`
        );
        setCaseSummary(csJson);
      } catch (err) {
        setCaseError(
          toApiErrorDetails(err, {
            url: `/cases/summary/${encodeURIComponent(selectedTraceId)}`,
          })
        );
      }
    }

    setLoading(false);
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

      {tenantError && (
        <ApiErrorPanel
          error={tenantError}
          title="Tenant lookup failed"
          onRetry={handleRefresh}
          compact
        />
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
          <p className="text-[11px] font-medium text-zinc-300">Low risk (recent)</p>
          <p className="mt-1 text-xl font-semibold text-emerald-300">
            {lowRiskCount}
          </p>
          <p className="mt-1 text-[10px] text-zinc-500">
            Derived from recent decisions where status is <code>ok_to_ship</code>
            {" "}
            or risk is explicitly low.
          </p>
          {recentError && (
            <div className="mt-2">
              <ApiErrorPanel error={recentError} title="Recent decisions" compact />
            </div>
          )}
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
          <p className="text-[11px] font-medium text-zinc-300">Medium risk (recent)</p>
          <p className="mt-1 text-xl font-semibold text-amber-200">
            {mediumRiskCount}
          </p>
          <p className="mt-1 text-[10px] text-zinc-500">
            Includes decisions marked <code>needs_review</code> or explicitly medium risk.
          </p>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
          <p className="text-[11px] font-medium text-zinc-300">High risk (recent)</p>
          <p className="mt-1 text-xl font-semibold text-red-300">{highRiskCount}</p>
          <p className="mt-1 text-[10px] text-zinc-500">
            Includes decisions that are <code>blocked</code> or explicitly high risk.
          </p>
        </div>
      </div>

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
      {healthError && (
        <ApiErrorPanel
          error={healthError}
          title="Health check failed"
          onRetry={handleRefresh}
          compact
        />
      )}

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
      {caseError && (
        <ApiErrorPanel
          error={caseError}
          title="Case summary failed"
          onRetry={handleRefresh}
          compact
        />
      )}
    </div>
  );
};

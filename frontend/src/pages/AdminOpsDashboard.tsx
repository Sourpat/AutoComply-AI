// frontend/src/pages/AdminOpsDashboard.tsx
/**
 * Verification Ops Dashboard
 * 
 * CHANGES:
 * - Removed: Chat HITL Trends section (charts for open_created and published per day)
 * - Added: Ops Insights & Actions section with high-signal metrics and quick actions
 * - Insights computed from: reason_code, risk_level, jurisdiction, status, created_at
 * 
 * MANUAL TEST CHECKLIST:
 * 1. Access /admin/ops without admin unlock -> redirects to /admin/login
 * 2. Access /admin/ops with admin unlock -> shows dashboard
 * 3. KPI cards display correct metrics
 * 4. Ops Insights shows: Top Escalation Driver, Highest Risk Driver, Top Jurisdiction, Backlog Aging
 * 5. Quick Actions buttons navigate to Chat Review Queue and Compliance Console
 * 6. Filters work: status, jurisdiction, reason code, risk level, source
 * 7. Active filter chips appear with reset button
 * 8. Workload cards show Chat HITL counts (CSF/License not yet wired)
 * 9. All fetch errors show clean fallback UI (no 500s exposed)
 */

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, toApiErrorDetails, type ApiErrorDetails } from "../lib/api";
import { getAuthHeaders } from "../lib/authHeaders";
import { ApiErrorPanel } from "../components/ApiErrorPanel";
import {
  VerificationWorkEvent,
  VerificationSource,
  VerificationWorkStatus,
  RiskLevel,
  normalizeReasonCode,
  inferRiskLevel,
  mapStatus,
  calculateAgeMetrics,
  aggregateBySource,
} from "../contracts/verificationWorkEvent";

// ============================================================================
// Types
// ============================================================================

interface OpsKPI {
  open_reviews: number;
  high_risk_open_reviews: number;
  avg_time_to_first_response_hours: number | null;
  auto_answered_rate: number | null;
}

interface OpsReviewItem {
  id: number;
  created_at: string;
  jurisdiction: string | null;
  reason_code: string | null;
  risk_level: string;
  status: string;
  question_excerpt: string;
  top_match_score: number | null;
  source?: string; // Computed on frontend
}

interface Filters {
  status: string;
  jurisdiction: string;
  reason_code: string;
  risk_level: string;
  source: string;
}

// ============================================================================
// Component
// ============================================================================

// ============================================================================
// Verification Work Event Mapper
// ============================================================================

/**
 * Converts OpsReviewItem (from /api/v1/admin/ops/reviews) to VerificationWorkEvent
 * This allows us to use the unified contract for workload aggregation
 */
function toVerificationWorkEvent(item: OpsReviewItem): VerificationWorkEvent {
  const source = inferSource(item);
  const normalizedReasonCode = normalizeReasonCode(item.reason_code);
  
  let verificationSource: VerificationSource;
  switch (source) {
    case "CSF":
      verificationSource = VerificationSource.CSF;
      break;
    case "License":
      verificationSource = VerificationSource.LICENSE;
      break;
    case "System":
      verificationSource = VerificationSource.SYSTEM;
      break;
    default:
      verificationSource = VerificationSource.CHAT;
  }
  
  const risk = inferRiskLevel({
    source: verificationSource,
    reason_code: normalizedReasonCode,
  });
  
  const status = mapStatus(item.status);
  const metrics = calculateAgeMetrics(item.created_at);
  
  const title = item.question_excerpt?.length > 60
    ? item.question_excerpt.substring(0, 57) + "..."
    : item.question_excerpt || "Untitled";
  
  return {
    id: `${source.toLowerCase()}:${item.id}`,
    source: verificationSource,
    status,
    risk,
    created_at: item.created_at,
    jurisdiction: item.jurisdiction || undefined,
    reason_code: normalizedReasonCode,
    title,
    summary: item.question_excerpt,
    link: {
      label: source === "Chat" ? "Open in Chat Review Queue" : "Open in Compliance Console",
      href: source === "Chat" ? `/admin/review/${item.id}` : `/console`,
    },
    artifact: {
      type: source === "Chat" ? "CHAT_QUESTION" : source === "CSF" ? "CSF_SUBMISSION" : "LICENSE_CHECK",
      artifact_id: item.id.toString(),
    },
    metrics: {
      age_hours: metrics.age_hours,
      sla_bucket: metrics.sla_bucket,
    },
  };
}

// Helper function to infer source from review item
function inferSource(item: OpsReviewItem): string {
  // Check if backend provides source field
  if ((item as any).source) return (item as any).source;
  if ((item as any).origin) return (item as any).origin;
  if ((item as any).module) return (item as any).module;
  
  // Infer from reason_code and other fields
  const reasonLower = item.reason_code?.toLowerCase() || "";
  const questionLower = item.question_excerpt?.toLowerCase() || "";
  
  // CSF indicators
  if (reasonLower.includes("csf") || (item as any).form_type || (item as any).form_id) {
    return "CSF";
  }
  
  // License indicators
  if (reasonLower.includes("license") || (item as any).license_id) {
    return "License";
  }
  
  // Chat indicators (most common)
  if (
    reasonLower.includes("low_similarity") ||
    reasonLower.includes("jurisdiction") ||
    reasonLower.includes("unsafe") ||
    reasonLower.includes("no_kb") ||
    item.question_excerpt
  ) {
    return "Chat";
  }
  
  // Default
  return "System";
}

export function AdminOpsDashboard() {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<OpsKPI | null>(null);
  const [reviews, setReviews] = useState<OpsReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorDetails, setErrorDetails] = useState<ApiErrorDetails | null>(null);
  const [healthSummary, setHealthSummary] = useState<any | null>(null);
  const [opsSmoke, setOpsSmoke] = useState<any | null>(null);
  const [signingStatus, setSigningStatus] = useState<any | null>(null);
  const [healthError, setHealthError] = useState<ApiErrorDetails | null>(null);
  const [opsError, setOpsError] = useState<ApiErrorDetails | null>(null);
  const [signingError, setSigningError] = useState<ApiErrorDetails | null>(null);
  
  const [filters, setFilters] = useState<Filters>({
    status: "",
    jurisdiction: "",
    reason_code: "",
    risk_level: "",
    source: "",
  });

  // Fetch data on mount
  useEffect(() => {
    loadDashboardData();
    loadHealthBlocks();
  }, []);

  const loadHealthBlocks = async () => {
    setHealthError(null);
    setOpsError(null);
    setSigningError(null);

    try {
      const data = await apiFetch("/health/full", { headers: getAuthHeaders() });
      setHealthSummary(data);
    } catch (err) {
      setHealthError(toApiErrorDetails(err, { url: "/health/full" }));
    }

    try {
      const data = await apiFetch("/api/ops/smoke", { headers: getAuthHeaders() });
      setOpsSmoke(data);
    } catch (err) {
      setOpsError(toApiErrorDetails(err, { url: "/api/ops/smoke" }));
    }

    try {
      const data = await apiFetch("/api/audit/signing/status", { headers: getAuthHeaders() });
      setSigningStatus(data);
    } catch (err) {
      setSigningError(toApiErrorDetails(err, { url: "/api/audit/signing/status" }));
    }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    setErrorDetails(null);
    
    try {
      const [kpiData, reviewsData] = await Promise.all([
        apiFetch<OpsKPI>("/api/v1/admin/ops/summary", { headers: getAuthHeaders() }),
        apiFetch<OpsReviewItem[]>("/api/v1/admin/ops/reviews?days=14&limit=100", { headers: getAuthHeaders() }),
      ]);

      // Enrich reviews with source
      const enrichedReviews = reviewsData.map((item: OpsReviewItem) => ({
        ...item,
        source: inferSource(item),
      }));

      setKpis(kpiData);
      setReviews(enrichedReviews);
    } catch (err) {
      console.error("Dashboard load error:", err);
      setErrorDetails(toApiErrorDetails(err, { url: "/api/v1/admin/ops/summary" }));
    } finally {
      setLoading(false);
    }
  };

  const refreshAll = () => {
    loadDashboardData();
    loadHealthBlocks();
  };

  // Filter reviews client-side
  const filteredReviews = reviews.filter((review) => {
    if (filters.status && review.status !== filters.status) return false;
    if (filters.jurisdiction && review.jurisdiction !== filters.jurisdiction) return false;
    if (filters.reason_code && review.reason_code !== filters.reason_code) return false;
    if (filters.risk_level && review.risk_level !== filters.risk_level) return false;
    if (filters.source && review.source !== filters.source) return false;
    return true;
  });

  // Get unique filter options
  const uniqueStatuses = [...new Set(reviews.map((r) => r.status))].filter(Boolean);
  const uniqueJurisdictions = [...new Set(reviews.map((r) => r.jurisdiction))].filter((j): j is string => j !== null);
  const uniqueReasonCodes = [...new Set(reviews.map((r) => r.reason_code))].filter((r): r is string => r !== null);
  const uniqueRiskLevels = [...new Set(reviews.map((r) => r.risk_level))].filter(Boolean);
  const uniqueSources = [...new Set(reviews.map((r) => r.source))].filter(Boolean);

  // Convert to Verification Work Events and aggregate by source
  const verificationEvents = useMemo(
    () => reviews.map(toVerificationWorkEvent),
    [reviews]
  );
  
  const aggregatedWorkload = useMemo(
    () => aggregateBySource(verificationEvents),
    [verificationEvents]
  );
  
  // Map contract aggregates to UI-friendly format
  const workloadBySource = {
    Chat: {
      open: aggregatedWorkload[VerificationSource.CHAT].open,
      highRisk: aggregatedWorkload[VerificationSource.CHAT].high_risk,
    },
    CSF: {
      open: aggregatedWorkload[VerificationSource.CSF].open,
      highRisk: aggregatedWorkload[VerificationSource.CSF].high_risk,
    },
    License: {
      open: aggregatedWorkload[VerificationSource.LICENSE].open,
      highRisk: aggregatedWorkload[VerificationSource.LICENSE].high_risk,
    },
    System: {
      open: aggregatedWorkload[VerificationSource.SYSTEM].open,
      highRisk: aggregatedWorkload[VerificationSource.SYSTEM].high_risk,
    },
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  const resetFilters = () => {
    setFilters({
      status: "",
      jurisdiction: "",
      reason_code: "",
      risk_level: "",
      source: "",
    });
  };

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const getRiskBadgeClass = (risk: string) => {
    switch (risk.toUpperCase()) {
      case "HIGH":
        return "bg-red-900 text-red-200 border-red-700";
      case "MEDIUM":
        return "bg-yellow-900 text-yellow-200 border-yellow-700";
      case "LOW":
        return "bg-green-900 text-green-200 border-green-700";
      default:
        return "bg-gray-700 text-gray-300 border-gray-600";
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "open":
        return "bg-yellow-900 text-yellow-200 border-yellow-700";
      case "in_review":
        return "bg-blue-900 text-blue-200 border-blue-700";
      case "published":
        return "bg-green-900 text-green-200 border-green-700";
      default:
        return "bg-gray-700 text-gray-300 border-gray-600";
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (loading) {
    return (
      <div className="bg-gray-900 text-gray-100 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading Ops Dashboard...</p>
        </div>
      </div>
    );
  }

  if (errorDetails) {
    return (
      <div className="bg-gray-900 text-gray-100 min-h-screen p-6">
        <div className="max-w-7xl mx-auto">
          <ApiErrorPanel
            error={errorDetails}
            title="Error loading dashboard"
            onRetry={refreshAll}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 text-gray-100 min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Verification Ops Dashboard</h1>
            <p className="text-gray-400">
              Operational view of verification workload, risk, sources, and throughput
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate("/admin/review")}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Go to Review Queue →
            </button>
            <button
              onClick={() => navigate("/console")}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg font-medium transition-colors"
            >
              Compliance Console
            </button>
          </div>
        </div>

        {/* System Health */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold">System Health</h2>
            <button
              onClick={refreshAll}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-md text-sm font-medium"
            >
              Refresh
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-800 border border-slate-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm mb-1">Health / Build</div>
              <div className="text-lg font-semibold text-emerald-300">
                {healthSummary?.status ?? "unknown"}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                build_sha: {healthSummary?.build_sha ?? "unknown"}
              </div>
            </div>
            <div className="bg-gray-800 border border-slate-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm mb-1">Ops Smoke</div>
              <div className="text-xs text-gray-300 mt-1">
                db_ok: {String(opsSmoke?.db_ok ?? "?")}
              </div>
              <div className="text-xs text-gray-300">
                schema_ok: {String(opsSmoke?.schema_ok ?? "?")}
              </div>
              <div className="text-xs text-gray-300">
                routes_ok: {String(opsSmoke?.routes_ok ?? "?")}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                env: {opsSmoke?.env ?? "unknown"}
              </div>
            </div>
            <div className="bg-gray-800 border border-slate-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm mb-1">Signing</div>
              <div className="text-xs text-gray-300 mt-1">
                enabled: {String(signingStatus?.enabled ?? "?")}
              </div>
              <div className="text-xs text-gray-300">
                key_fingerprint: {signingStatus?.key_fingerprint ?? "n/a"}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                env: {signingStatus?.environment ?? "unknown"}
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            {healthError && (
              <ApiErrorPanel error={healthError} title="Health check" onRetry={loadHealthBlocks} compact />
            )}
            {opsError && (
              <ApiErrorPanel error={opsError} title="Ops smoke" onRetry={loadHealthBlocks} compact />
            )}
            {signingError && (
              <ApiErrorPanel error={signingError} title="Signing status" onRetry={loadHealthBlocks} compact />
            )}
          </div>
        </div>

        {/* KPI Cards */}
        {kpis && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-800 border border-yellow-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm mb-1">Open Reviews</div>
              <div className="text-3xl font-bold text-yellow-400">{kpis.open_reviews}</div>
            </div>
            <div className="bg-gray-800 border border-red-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm mb-1">High Risk Open</div>
              <div className="text-3xl font-bold text-red-400">{kpis.high_risk_open_reviews}</div>
            </div>
            <div className="bg-gray-800 border border-blue-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm mb-1">Avg Time to Response</div>
              <div className="text-3xl font-bold text-blue-400">
                {kpis.avg_time_to_first_response_hours !== null
                  ? `${kpis.avg_time_to_first_response_hours.toFixed(1)}h`
                  : "N/A"}
              </div>
              <div className="text-xs text-gray-500 mt-1">Last 7 days</div>
            </div>
            <div className="bg-gray-800 border border-green-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm mb-1">Auto-Answered Rate</div>
              <div className="text-3xl font-bold text-green-400">
                {kpis.auto_answered_rate !== null
                  ? `${(kpis.auto_answered_rate * 100).toFixed(1)}%`
                  : "N/A"}
              </div>
              <div className="text-xs text-gray-500 mt-1">Last 7 days</div>
            </div>
          </div>
        )}

        {/* Workload by Source */}
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-3">Workload by Source</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-800 border border-purple-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm mb-1">💬 Chat</div>
              <div className="flex items-baseline gap-3">
                <div className="text-2xl font-bold text-purple-400">{workloadBySource.Chat.open}</div>
                <div className="text-sm text-gray-500">open</div>
              </div>
              <div className="text-xs text-red-400 mt-1">{workloadBySource.Chat.highRisk} high-risk</div>
            </div>
            <div className="bg-gray-800 border border-cyan-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm mb-1">📋 CSF</div>
              <div className="flex items-baseline gap-3">
                <div className="text-2xl font-bold text-cyan-400">{workloadBySource.CSF.open}</div>
                <div className="text-sm text-gray-500">open</div>
              </div>
              <div className="text-xs text-red-400 mt-1">{workloadBySource.CSF.highRisk} high-risk</div>
            </div>
            <div className="bg-gray-800 border border-amber-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm mb-1">🪪 License</div>
              <div className="flex items-baseline gap-3">
                <div className="text-2xl font-bold text-amber-400">{workloadBySource.License.open}</div>
                <div className="text-sm text-gray-500">open</div>
              </div>
              <div className="text-xs text-red-400 mt-1">{workloadBySource.License.highRisk} high-risk</div>
            </div>
            <div className="bg-gray-800 border border-gray-600 rounded-lg p-4">
              <div className="text-gray-400 text-sm mb-1">⚙️ System</div>
              <div className="flex items-baseline gap-3">
                <div className="text-2xl font-bold text-gray-400">{workloadBySource.System.open}</div>
                <div className="text-sm text-gray-500">open</div>
              </div>
              <div className="text-xs text-red-400 mt-1">{workloadBySource.System.highRisk} high-risk</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-lg">Filters</h3>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                Reset All
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100"
              >
                <option value="">All</option>
                {uniqueStatuses.map((s) => (
                  <option key={s} value={s}>{s.replace("_", " ").toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Source</label>
              <select
                value={filters.source}
                onChange={(e) => setFilters({ ...filters, source: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100"
              >
                <option value="">All</option>
                {uniqueSources.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Jurisdiction</label>
              <select
                value={filters.jurisdiction}
                onChange={(e) => setFilters({ ...filters, jurisdiction: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100"
              >
                <option value="">All</option>
                {uniqueJurisdictions.map((j) => (
                  <option key={j} value={j}>{j}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Reason Code</label>
              <select
                value={filters.reason_code}
                onChange={(e) => setFilters({ ...filters, reason_code: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100"
              >
                <option value="">All</option>
                {uniqueReasonCodes.map((r) => (
                  <option key={r} value={r}>{r.replace("_", " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Risk Level</label>
              <select
                value={filters.risk_level}
                onChange={(e) => setFilters({ ...filters, risk_level: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100"
              >
                <option value="">All</option>
                {uniqueRiskLevels.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Active Filter Chips */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 mt-3">
              {filters.status && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-900/30 border border-blue-700 rounded text-xs text-blue-300">
                  Status: {filters.status}
                  <button onClick={() => setFilters({ ...filters, status: "" })} className="hover:text-blue-100">×</button>
                </span>
              )}
              {filters.source && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-900/30 border border-blue-700 rounded text-xs text-blue-300">
                  Source: {filters.source}
                  <button onClick={() => setFilters({ ...filters, source: "" })} className="hover:text-blue-100">×</button>
                </span>
              )}
              {filters.jurisdiction && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-900/30 border border-blue-700 rounded text-xs text-blue-300">
                  Jurisdiction: {filters.jurisdiction}
                  <button onClick={() => setFilters({ ...filters, jurisdiction: "" })} className="hover:text-blue-100">×</button>
                </span>
              )}
              {filters.reason_code && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-900/30 border border-blue-700 rounded text-xs text-blue-300">
                  Reason: {filters.reason_code.replace("_", " ")}
                  <button onClick={() => setFilters({ ...filters, reason_code: "" })} className="hover:text-blue-100">×</button>
                </span>
              )}
              {filters.risk_level && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-900/30 border border-blue-700 rounded text-xs text-blue-300">
                  Risk: {filters.risk_level}
                  <button onClick={() => setFilters({ ...filters, risk_level: "" })} className="hover:text-blue-100">×</button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Ops Insights & Actions */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-lg mb-4">Ops Insights & Actions</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left: Ops Insights (2 columns on desktop) */}
            <div className="lg:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Top Escalation Driver */}
                {(() => {
                  const reasonCounts: Record<string, number> = {};
                  reviews.forEach(item => {
                    if (item.reason_code) {
                      reasonCounts[item.reason_code] = (reasonCounts[item.reason_code] || 0) + 1;
                    }
                  });
                  const topReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0];
                  
                  return (
                    <div className="bg-gray-900 border border-orange-800 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">Top Escalation Driver</div>
                      <div className="text-lg font-bold text-orange-400">
                        {topReason ? topReason[0].replace('_', ' ') : 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {topReason ? `${topReason[1]} items` : 'No data'}
                      </div>
                    </div>
                  );
                })()}

                {/* Highest Risk Driver */}
                {(() => {
                  const highRiskReasons: Record<string, number> = {};
                  reviews.filter(item => item.risk_level === 'HIGH').forEach(item => {
                    if (item.reason_code) {
                      highRiskReasons[item.reason_code] = (highRiskReasons[item.reason_code] || 0) + 1;
                    }
                  });
                  const topHighRisk = Object.entries(highRiskReasons).sort((a, b) => b[1] - a[1])[0];
                  
                  return (
                    <div className="bg-gray-900 border border-red-800 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">Highest Risk Driver</div>
                      <div className="text-lg font-bold text-red-400">
                        {topHighRisk ? topHighRisk[0].replace('_', ' ') : 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {topHighRisk ? `${topHighRisk[1]} high-risk items` : 'No high-risk items'}
                      </div>
                    </div>
                  );
                })()}

                {/* Top Jurisdiction */}
                {(() => {
                  const jurisdictionCounts: Record<string, number> = {};
                  reviews.forEach(item => {
                    if (item.jurisdiction && item.jurisdiction !== '—') {
                      jurisdictionCounts[item.jurisdiction] = (jurisdictionCounts[item.jurisdiction] || 0) + 1;
                    }
                  });
                  const topJurisdiction = Object.entries(jurisdictionCounts).sort((a, b) => b[1] - a[1])[0];
                  
                  return (
                    <div className="bg-gray-900 border border-blue-800 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">Top Jurisdiction</div>
                      <div className="text-lg font-bold text-blue-400">
                        {topJurisdiction ? topJurisdiction[0] : 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {topJurisdiction ? `${topJurisdiction[1]} items` : 'No jurisdiction data'}
                      </div>
                    </div>
                  );
                })()}

                {/* Backlog Aging */}
                {(() => {
                  const openItems = reviews.filter(item => item.status === 'open');
                  let oldestHours: number | null = null;
                  let countOver24h = 0;
                  const now = new Date().getTime();
                  
                  openItems.forEach(item => {
                    try {
                      const createdTime = new Date(item.created_at).getTime();
                      const ageHours = (now - createdTime) / (1000 * 60 * 60);
                      if (oldestHours === null || ageHours > oldestHours) {
                        oldestHours = ageHours;
                      }
                      if (ageHours > 24) {
                        countOver24h++;
                      }
                    } catch {
                      // Skip items with invalid timestamps
                    }
                  });
                  
                  return (
                    <div className="bg-gray-900 border border-yellow-800 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">Backlog Aging</div>
                      <div className="text-lg font-bold text-yellow-400">
                        {oldestHours !== null ? `${Math.round(oldestHours)}h` : 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {oldestHours !== null ? `${countOver24h} items >24h old` : 'No open items'}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Right: Quick Actions */}
            <div className="lg:col-span-1">
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 h-full flex flex-col justify-center space-y-3">
                <h4 className="text-sm font-semibold text-gray-300 mb-2">Quick Actions</h4>
                <button
                  onClick={() => navigate('/admin/review')}
                  className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm"
                >
                  Go to Chat Review Queue →
                </button>
                <button
                  onClick={() => navigate('/console')}
                  className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg font-medium transition-colors text-sm"
                >
                  Go to Compliance Console
                </button>
                <a
                  href="/admin/review"
                  className="text-center text-xs text-blue-400 hover:text-blue-300 pt-2"
                >
                  Open Review Queue
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Workload Overview (by source) */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="mb-4">
            <h3 className="font-semibold text-lg">Workload Overview (by source)</h3>
            <p className="text-xs text-gray-500 mt-1">
              High-level summary of verification workload across all sources
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Chat HITL */}
            <div className="bg-gray-900 border border-purple-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-purple-300">💬 Chat HITL</h4>
                <button
                  onClick={() => navigate("/admin/review")}
                  className="text-xs text-purple-400 hover:text-purple-300"
                >
                  View →
                </button>
              </div>
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <div className="text-2xl font-bold text-purple-400">{workloadBySource.Chat.open}</div>
                  <div className="text-sm text-gray-500">open</div>
                </div>
                <div className="text-xs text-red-400">{workloadBySource.Chat.highRisk} high-risk</div>
                <div className="text-xs text-gray-500 mt-2">Q&A review queue</div>
              </div>
            </div>

            {/* CSF Verification */}
            <div className="bg-gray-900 border border-gray-600 rounded-lg p-4 opacity-60">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-400">📋 CSF Verification</h4>
                <button
                  onClick={() => navigate("/console")}
                  className="text-xs text-gray-500 hover:text-gray-400"
                >
                  View →
                </button>
              </div>
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <div className="text-2xl font-bold text-gray-500">0</div>
                  <div className="text-sm text-gray-600">open</div>
                </div>
                <div className="text-xs text-gray-600">0 high-risk</div>
                <div className="text-xs text-gray-600 mt-2 italic">Not yet wired</div>
              </div>
            </div>

            {/* License Verification */}
            <div className="bg-gray-900 border border-gray-600 rounded-lg p-4 opacity-60">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-400">🪪 License Verification</h4>
                <button
                  onClick={() => navigate("/console")}
                  className="text-xs text-gray-500 hover:text-gray-400"
                >
                  View →
                </button>
              </div>
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <div className="text-2xl font-bold text-gray-500">0</div>
                  <div className="text-sm text-gray-600">open</div>
                </div>
                <div className="text-xs text-gray-600">0 high-risk</div>
                <div className="text-xs text-gray-600 mt-2 italic">Not yet wired</div>
              </div>
            </div>

            {/* System Exceptions */}
            <div className="bg-gray-900 border border-gray-600 rounded-lg p-4 opacity-60">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-400">⚙️ System Exceptions</h4>
                <div className="text-xs text-gray-600">—</div>
              </div>
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <div className="text-2xl font-bold text-gray-500">0</div>
                  <div className="text-sm text-gray-600">open</div>
                </div>
                <div className="text-xs text-gray-600">0 high-risk</div>
                <div className="text-xs text-gray-600 mt-2 italic">Not yet wired</div>
              </div>
            </div>
          </div>

          {/* Helper Note */}
          <div className="mt-4 bg-blue-900/20 border border-blue-800 rounded-lg p-3">
            <p className="text-xs text-blue-300">
              💡 <strong>Note:</strong> Chat workload uses the unified Verification Work Event contract. 
              CSF and License sources are contract-ready, pending backend wiring.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

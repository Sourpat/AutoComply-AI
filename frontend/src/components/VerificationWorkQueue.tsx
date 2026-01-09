// frontend/src/components/VerificationWorkQueue.tsx
import React, { useEffect, useState, useMemo } from "react";
import {
  VerificationWorkEvent,
  VerificationSource,
  VerificationWorkStatus,
  RiskLevel,
  fromChatReviewItem,
  fromCSFArtifact,
} from "../contracts/verificationWorkEvent";
import { getReviewQueueItems, type ReviewQueueItem } from "../api/reviewQueueClient";
import { getWorkQueue, type WorkQueueSubmission } from "../api/consoleClient";
import { Link } from "react-router-dom";

interface VerificationWorkQueueProps {
  className?: string;
}

export function VerificationWorkQueue({ className }: VerificationWorkQueueProps) {
  const [events, setEvents] = useState<VerificationWorkEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem('admin_unlocked') === 'true');

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [jurisdictionFilter, setJurisdictionFilter] = useState<string>("all");
  const [reasonCodeFilter, setReasonCodeFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");

  // Fetch data from all sources
  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch CHAT review items
      const chatResp = await getReviewQueueItems(undefined, 100);
      const chatEvents = chatResp.items.map(fromChatReviewItem);

      // Fetch CSF submissions from unified work queue
      const workQueueResp = await getWorkQueue(undefined, undefined, 100);
      const csfEvents = workQueueResp.items.map((sub: WorkQueueSubmission) =>
        fromCSFArtifact({
          id: sub.submission_id,
          form_type: sub.csf_type,
          status: sub.decision_status || sub.status,
          created_at: sub.created_at,
          reason_code: null,
          jurisdiction: null,
          scenario: sub.title,
          tenant: sub.tenant,
          trace_id: sub.trace_id,
          summary: sub.subtitle,
        })
      );

      // Combine and sort by created_at descending
      const allEvents = [...chatEvents, ...csfEvents].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setEvents(allEvents);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load verification queue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Sync admin state from localStorage
  useEffect(() => {
    const checkAdmin = () => {
      setIsAdmin(localStorage.getItem('admin_unlocked') === 'true');
    };
    
    window.addEventListener('storage', checkAdmin);
    const interval = setInterval(checkAdmin, 1000);
    
    return () => {
      window.removeEventListener('storage', checkAdmin);
      clearInterval(interval);
    };
  }, []);

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (statusFilter !== "all" && event.status !== statusFilter) return false;
      if (sourceFilter !== "all" && event.source !== sourceFilter) return false;
      if (jurisdictionFilter !== "all" && event.jurisdiction !== jurisdictionFilter)
        return false;
      if (reasonCodeFilter !== "all" && event.reason_code !== reasonCodeFilter)
        return false;
      if (riskFilter !== "all" && event.risk !== riskFilter) return false;
      return true;
    });
  }, [events, statusFilter, sourceFilter, jurisdictionFilter, reasonCodeFilter, riskFilter]);

  // Compute counts
  const counts = useMemo(() => {
    const total = filteredEvents.length;
    const needsReview = filteredEvents.filter(
      (e) => e.status === VerificationWorkStatus.OPEN || e.status === VerificationWorkStatus.IN_REVIEW
    ).length;
    const published = filteredEvents.filter(
      (e) => e.status === VerificationWorkStatus.PUBLISHED || e.status === VerificationWorkStatus.RESOLVED
    ).length;
    const blocked = filteredEvents.filter(
      (e) => e.status === VerificationWorkStatus.BLOCKED
    ).length;

    return { total, needsReview, published, blocked };
  }, [filteredEvents]);

  // Extract unique values for filters
  const uniqueSources = useMemo(
    () => Array.from(new Set(events.map((e) => e.source))),
    [events]
  );
  const uniqueJurisdictions = useMemo(
    () => Array.from(new Set(events.map((e) => e.jurisdiction).filter(Boolean))),
    [events]
  );
  const uniqueReasonCodes = useMemo(
    () => Array.from(new Set(events.map((e) => e.reason_code).filter(Boolean))),
    [events]
  );

  // Format age
  function formatAge(created_at: string): string {
    const hours = (Date.now() - new Date(created_at).getTime()) / (1000 * 60 * 60);
    if (hours < 1) return `${Math.floor(hours * 60)}m`;
    if (hours < 24) return `${Math.floor(hours)}h`;
    return `${Math.floor(hours / 24)}d`;
  }

  // Risk badge color
  function getRiskColor(risk: RiskLevel): string {
    switch (risk) {
      case RiskLevel.HIGH:
        return "bg-red-100 text-red-800 border-red-200";
      case RiskLevel.MEDIUM:
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case RiskLevel.LOW:
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  }

  // Status badge color
  function getStatusColor(status: VerificationWorkStatus): string {
    switch (status) {
      case VerificationWorkStatus.OPEN:
        return "bg-blue-100 text-blue-800 border-blue-200";
      case VerificationWorkStatus.IN_REVIEW:
        return "bg-purple-100 text-purple-800 border-purple-200";
      case VerificationWorkStatus.RESOLVED:
      case VerificationWorkStatus.PUBLISHED:
        return "bg-green-100 text-green-800 border-green-200";
      case VerificationWorkStatus.BLOCKED:
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  }

  if (loading) {
    return (
      <div className={className}>
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-slate-600">Loading verification queue...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-4">
        {/* Header with counts */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Verification Work Queue
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Unified queue across CHAT, CSF, and LICENSE verification
            </p>
          </div>
          {isAdmin && (
            <Link
              to="/console/review-queue"
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Open Review Queue
            </Link>
          )}
        </div>

        {/* Counters */}
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-2xl font-bold text-slate-900">{counts.total}</div>
            <div className="text-xs text-slate-600">Total</div>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <div className="text-2xl font-bold text-blue-900">{counts.needsReview}</div>
            <div className="text-xs text-blue-700">Needs Review</div>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <div className="text-2xl font-bold text-green-900">{counts.published}</div>
            <div className="text-xs text-green-700">Published</div>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <div className="text-2xl font-bold text-red-900">{counts.blocked}</div>
            <div className="text-xs text-red-700">Blocked</div>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-5 gap-2">
          <select
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            {Object.values(VerificationWorkStatus).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
          >
            <option value="all">All Sources</option>
            {uniqueSources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs"
            value={jurisdictionFilter}
            onChange={(e) => setJurisdictionFilter(e.target.value)}
          >
            <option value="all">All Jurisdictions</option>
            {uniqueJurisdictions.map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>

          <select
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs"
            value={reasonCodeFilter}
            onChange={(e) => setReasonCodeFilter(e.target.value)}
          >
            <option value="all">All Reason Codes</option>
            {uniqueReasonCodes.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <select
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs"
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
          >
            <option value="all">All Risk Levels</option>
            {Object.values(RiskLevel).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">
                  Source
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">
                  Status
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">
                  Title
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">
                  Jurisdiction
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">
                  Risk
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">
                  Reason
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">
                  Age
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-center text-sm text-slate-500">
                    No items match the current filters
                  </td>
                </tr>
              ) : (
                filteredEvents.map((event) => (
                  <tr key={event.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-xs">
                      <span className="inline-flex items-center rounded-full border px-2 py-0.5 font-medium bg-slate-100 text-slate-800 border-slate-200">
                        {event.source}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 font-medium ${getStatusColor(
                          event.status
                        )}`}
                      >
                        {event.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-900">
                      <div className="max-w-xs truncate" title={event.summary || event.title}>
                        {event.title}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {event.jurisdiction || "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 font-medium ${getRiskColor(
                          event.risk
                        )}`}
                      >
                        {event.risk}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      <div className="max-w-xs truncate">
                        {event.reason_code || "—"}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {formatAge(event.created_at)}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {event.link && (
                        <a
                          href={event.link.href}
                          className="font-semibold text-blue-600 hover:text-blue-700"
                        >
                          Open →
                        </a>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-slate-500">
          Showing {filteredEvents.length} of {events.length} items
        </div>
      </div>
    </div>
  );
}

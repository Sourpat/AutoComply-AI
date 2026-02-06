/**
 * CaseWorkspace - Enterprise case review workspace
 * 
 * 2-column layout:
 * - Left (30-35%): WorkQueueListPanel
 * - Right (65-70%): CaseDetailsPanel
 * 
 * Step 2.4: Case Details Workspace
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { API_BASE } from "../lib/api";
import { PageHeader } from "../components/common/PageHeader";
import { ErrorState } from "../components/common/ErrorState";
import { Button } from "../components/ui/button";
import {
  fetchVerifierCaseDetail,
  fetchVerifierCases,
  seedVerifierCases,
  type VerifierCase,
  type VerifierCaseDetail,
} from "../api/verifierCasesClient";
import { safeFormatDate, safeFormatRelative } from "../utils/dateUtils";

export const CaseWorkspace: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCaseId = searchParams.get("caseId");
  const isDev = (import.meta as any)?.env?.DEV ?? false;

  const [cases, setCases] = useState<VerifierCase[]>([]);
  const [count, setCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [jurisdictionFilter, setJurisdictionFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<VerifierCaseDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);

  const casesCountRef = useRef(0);

  const handleSelectCase = useCallback(
    (caseId: string) => {
      const params = new URLSearchParams(searchParams);
      params.set("caseId", caseId);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const loadCases = useCallback(
    async (options?: { reset?: boolean }) => {
      const reset = options?.reset ?? false;
      const nextOffset = reset ? 0 : casesCountRef.current;
      setIsLoading(true);
      setError(null);
      setSeedError(null);
      try {
        const response = await fetchVerifierCases({
          limit: 25,
          offset: nextOffset,
          status: statusFilter === "all" ? undefined : statusFilter,
          jurisdiction: jurisdictionFilter === "all" ? undefined : jurisdictionFilter,
        });

        setCount(response.count);
        if (reset) {
          setCases(response.items);
        } else {
          setCases((prev) => [...prev, ...response.items]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load cases");
      } finally {
        setIsLoading(false);
      }
    },
    [statusFilter, jurisdictionFilter]
  );

  const loadCaseDetail = useCallback(async (caseId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const payload = await fetchVerifierCaseDetail(caseId);
      setDetail(payload);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Failed to load case detail");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleSeed = useCallback(async () => {
    setIsSeeding(true);
    setSeedError(null);
    try {
      await seedVerifierCases();
      await loadCases({ reset: true });
    } catch (err) {
      setSeedError(err instanceof Error ? err.message : "Failed to seed demo cases");
    } finally {
      setIsSeeding(false);
    }
  }, [loadCases]);

  useEffect(() => {
    casesCountRef.current = cases.length;
  }, [cases.length]);

  useEffect(() => {
    loadCases({ reset: true });
  }, [loadCases, statusFilter, jurisdictionFilter]);

  useEffect(() => {
    if (!selectedCaseId && cases.length > 0) {
      handleSelectCase(cases[0].case_id);
    }
  }, [cases, selectedCaseId, handleSelectCase]);

  useEffect(() => {
    if (!selectedCaseId) {
      setDetail(null);
      return;
    }
    loadCaseDetail(selectedCaseId);
  }, [selectedCaseId, loadCaseDetail]);

  const statusOptions = useMemo(() => {
    const values = new Set(["pending_review", "approved", "rejected"]);
    cases.forEach((item) => item.status && values.add(item.status));
    return Array.from(values);
  }, [cases]);

  const jurisdictionOptions = useMemo(() => {
    const values = new Set(["OH", "NY", "CA", "TX"]);
    cases.forEach((item) => item.jurisdiction && values.add(item.jurisdiction));
    return Array.from(values);
  }, [cases]);

  const hasMore = cases.length < count;
  const isEmpty = !isLoading && cases.length === 0;

  return (
    <div className="flex h-full flex-col gap-4">
      {error && (
        <ErrorState
          title="Failed to load verifier cases"
          description={`Cannot reach ${API_BASE || "backend"}. ${error}`}
          onRetry={() => loadCases({ reset: true })}
        />
      )}

      <PageHeader
        title="Verifier Console"
        subtitle="Review verifier cases from the Phase 4 store"
        actions={
          <Button variant="secondary" onClick={() => loadCases({ reset: true })} disabled={isLoading}>
            {isLoading ? "Refreshing..." : "Refresh"}
          </Button>
        }
      />

      <div className="flex-1 flex overflow-hidden rounded-xl border border-border/70 bg-background">
        <div className="w-[40%] bg-card border-r border-border/70 flex flex-col">
          <div className="border-b border-border/70 p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <label className="flex flex-col text-xs text-slate-600">
                Status
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                  }}
                  className="mt-1 px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="all">All</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col text-xs text-slate-600">
                Jurisdiction
                <select
                  value={jurisdictionFilter}
                  onChange={(e) => {
                    setJurisdictionFilter(e.target.value);
                  }}
                  className="mt-1 px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="all">All</option>
                  {jurisdictionOptions.map((jurisdiction) => (
                    <option key={jurisdiction} value={jurisdiction}>
                      {jurisdiction}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="text-xs text-slate-500">
              Showing {cases.length} of {count} cases
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading && cases.length === 0 && (
              <div className="p-6 text-sm text-slate-500">Loading cases…</div>
            )}

            {isEmpty && (
              <div className="p-6 space-y-3 text-center text-slate-500">
                <p className="text-sm">No cases found.</p>
                {isDev && (
                  <Button variant="outline" onClick={handleSeed} disabled={isSeeding}>
                    {isSeeding ? "Seeding…" : "Seed demo cases"}
                  </Button>
                )}
                {seedError && <p className="text-xs text-red-600">{seedError}</p>}
              </div>
            )}

            {!isEmpty && (
              <div className="divide-y divide-slate-200">
                {cases.map((item) => (
                  <button
                    key={item.case_id}
                    onClick={() => handleSelectCase(item.case_id)}
                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${
                      selectedCaseId === item.case_id ? "bg-slate-100" : "bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-800">{item.case_id}</div>
                      <span className="text-[11px] uppercase tracking-wide text-slate-500">
                        {item.status}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {item.jurisdiction || "—"} · {safeFormatRelative(item.created_at)}
                    </div>
                    <div className="mt-1 text-xs text-slate-600 line-clamp-2">
                      {item.summary || "No summary"}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {hasMore && (
              <div className="p-4 border-t border-slate-200">
                <button
                  onClick={() => loadCases({ reset: false })}
                  disabled={isLoading}
                  className="w-full px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {isLoading ? "Loading…" : `Load more (${count - cases.length} remaining)`}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {!selectedCaseId && (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-500">Select a case to view details</p>
            </div>
          )}

          {selectedCaseId && (
            <div className="h-full overflow-y-auto p-6 space-y-6">
              {detailLoading && <p className="text-sm text-slate-500">Loading case details…</p>}
              {detailError && (
                <ErrorState
                  title="Case detail error"
                  description={detailError}
                  onRetry={() => loadCaseDetail(selectedCaseId)}
                />
              )}

              {!detailLoading && !detailError && detail && (
                <>
                  <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-slate-800">{detail.case.case_id}</h2>
                      <span className="text-xs uppercase tracking-wide text-slate-500">
                        {detail.case.status}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600">{detail.case.summary}</div>
                    <div className="grid grid-cols-2 gap-4 text-xs text-slate-500">
                      <div>
                        <div className="font-semibold text-slate-600">Jurisdiction</div>
                        <div>{detail.case.jurisdiction || "—"}</div>
                      </div>
                      <div>
                        <div className="font-semibold text-slate-600">Submission</div>
                        <div>{detail.case.submission_id}</div>
                      </div>
                      <div>
                        <div className="font-semibold text-slate-600">Created</div>
                        <div>{safeFormatDate(detail.case.created_at)}</div>
                      </div>
                      <div>
                        <div className="font-semibold text-slate-600">Updated</div>
                        <div>{safeFormatDate(detail.case.updated_at)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-700">Recent events</h3>
                      <span className="text-xs text-slate-500">{detail.events.length} events</span>
                    </div>
                    {detail.events.length === 0 ? (
                      <p className="mt-3 text-xs text-slate-500">No events recorded.</p>
                    ) : (
                      <ul className="mt-3 space-y-2">
                        {detail.events.map((event) => (
                          <li key={event.id} className="rounded border border-slate-100 bg-slate-50 p-2">
                            <div className="flex items-center justify-between text-xs text-slate-600">
                              <span className="font-semibold text-slate-700">{event.event_type}</span>
                              <span>{safeFormatRelative(event.created_at)}</span>
                            </div>
                            <div className="mt-1 text-[11px] text-slate-500 break-all">
                              {event.payload_json}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CaseWorkspace;

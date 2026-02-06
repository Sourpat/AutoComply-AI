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
  bulkVerifierCaseAction,
  bulkVerifierCaseAssign,
  fetchVerifierCaseEvents,
  fetchVerifierCaseDetail,
  fetchVerifierCases,
  postVerifierCaseAction,
  postVerifierCaseNote,
  setVerifierCaseAssignment,
  seedVerifierCases,
  type VerifierCase,
  type VerifierCaseDetail,
  type VerifierCaseEvent,
  type VerifierNote,
} from "../api/verifierCasesClient";
import { safeFormatDate, safeFormatRelative } from "../utils/dateUtils";

export const CaseWorkspace: React.FC = () => {
  const CURRENT_USER = "verifier-1";
  const FILTER_STORAGE_KEY = "verifierQueueFilters";
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCaseId = searchParams.get("caseId");
  const isDev = (import.meta as any)?.env?.DEV ?? false;

  const [cases, setCases] = useState<VerifierCase[]>([]);
  const [count, setCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [jurisdictionFilter, setJurisdictionFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [myQueueOnly, setMyQueueOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<VerifierCaseDetail | null>(null);
  const [events, setEvents] = useState<VerifierCaseEvent[]>([]);
  const [notes, setNotes] = useState<VerifierNote[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [noteSaving, setNoteSaving] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [assignmentBusy, setAssignmentBusy] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [filtersReady, setFiltersReady] = useState(false);

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
          assignee: myQueueOnly ? "me" : undefined,
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
    [statusFilter, jurisdictionFilter, myQueueOnly]
  );

  const loadCaseDetail = useCallback(async (caseId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const payload = await fetchVerifierCaseDetail(caseId);
      setDetail(payload);
      setEvents(payload.events ?? []);
      setNotes(payload.notes ?? []);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Failed to load case detail");
      setDetail(null);
      setEvents([]);
      setNotes([]);
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
    const stored = localStorage.getItem(FILTER_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.status) setStatusFilter(parsed.status);
        if (parsed.jurisdiction) setJurisdictionFilter(parsed.jurisdiction);
        if (typeof parsed.myQueueOnly === "boolean") setMyQueueOnly(parsed.myQueueOnly);
        if (typeof parsed.searchQuery === "string") setSearchQuery(parsed.searchQuery);
      } catch {
        // ignore
      }
    }
    setFiltersReady(true);
  }, []);

  useEffect(() => {
    if (!filtersReady) return;
    loadCases({ reset: true });
  }, [loadCases, statusFilter, jurisdictionFilter, myQueueOnly, filtersReady]);

  useEffect(() => {
    if (!filtersReady) return;
    localStorage.setItem(
      FILTER_STORAGE_KEY,
      JSON.stringify({
        status: statusFilter,
        jurisdiction: jurisdictionFilter,
        myQueueOnly,
        searchQuery,
      })
    );
  }, [statusFilter, jurisdictionFilter, myQueueOnly, searchQuery, filtersReady]);

  useEffect(() => {
    if (!selectedCaseId && cases.length > 0) {
      handleSelectCase(cases[0].case_id);
    }
  }, [cases, selectedCaseId, handleSelectCase]);

  useEffect(() => {
    if (!selectedCaseId) {
      setDetail(null);
      setEvents([]);
      setNotes([]);
      return;
    }
    loadCaseDetail(selectedCaseId);
  }, [selectedCaseId, loadCaseDetail]);

  const handleAction = useCallback(
    async (action: "approve" | "reject" | "needs_review") => {
      if (!selectedCaseId) return;
      setActionInProgress(action);
      setActionError(null);
      try {
        const response = await postVerifierCaseAction(selectedCaseId, {
          action,
          actor: CURRENT_USER,
        });
        setDetail((prev) => (prev ? { ...prev, case: response.case } : prev));
        setEvents((prev) => [response.event, ...prev]);
        setCases((prev) =>
          prev.map((item) => (item.case_id === response.case.case_id ? response.case : item))
        );
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Failed to update status");
      } finally {
        setActionInProgress(null);
      }
    },
    [selectedCaseId]
  );

  const handleAddNote = useCallback(async () => {
    if (!selectedCaseId) return;
    if (!noteText.trim()) {
      setNoteError("Note cannot be empty");
      return;
    }
    setNoteSaving(true);
    setNoteError(null);
    try {
      const response = await postVerifierCaseNote(selectedCaseId, {
        note: noteText.trim(),
        actor: CURRENT_USER,
      });
      setNotes((prev) => [response.note, ...prev]);
      setEvents((prev) => [response.event, ...prev]);
      setNoteText("");
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : "Failed to add note");
    } finally {
      setNoteSaving(false);
    }
  }, [noteText, selectedCaseId]);

  const filteredCases = useMemo(() => {
    if (!searchQuery.trim()) {
      return cases;
    }
    const tokens = searchQuery.toLowerCase().split(/\s+/);
    return cases.filter((item) => {
      const searchable = [
        item.case_id,
        item.summary,
        item.status,
        item.jurisdiction,
        item.assignee,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return tokens.every((token) => searchable.includes(token));
    });
  }, [cases, searchQuery]);

  const toggleSelectCase = useCallback((caseId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(caseId)) {
        next.delete(caseId);
      } else {
        next.add(caseId);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (filteredCases.length === 0) return;
    setSelectedIds((prev) => {
      if (prev.size === filteredCases.length) {
        return new Set();
      }
      return new Set(filteredCases.map((item) => item.case_id));
    });
  }, [filteredCases]);

  const handleBulkAction = useCallback(
    async (action: "approve" | "reject" | "needs_review") => {
      if (selectedIds.size === 0) return;
      setBulkBusy(true);
      setBulkError(null);
      try {
        await bulkVerifierCaseAction({
          case_ids: Array.from(selectedIds),
          action,
          actor: CURRENT_USER,
        });
        await loadCases({ reset: true });
        if (selectedCaseId) {
          await loadCaseDetail(selectedCaseId);
        }
        setSelectedIds(new Set());
      } catch (err) {
        setBulkError(err instanceof Error ? err.message : "Bulk action failed");
      } finally {
        setBulkBusy(false);
      }
    },
    [selectedIds, loadCases, selectedCaseId, loadCaseDetail]
  );

  const handleBulkAssign = useCallback(
    async (assignee: string | null) => {
      if (selectedIds.size === 0) return;
      setBulkBusy(true);
      setBulkError(null);
      try {
        await bulkVerifierCaseAssign({
          case_ids: Array.from(selectedIds),
          assignee,
          actor: CURRENT_USER,
        });
        await loadCases({ reset: true });
        if (selectedCaseId) {
          await loadCaseDetail(selectedCaseId);
        }
        setSelectedIds(new Set());
      } catch (err) {
        setBulkError(err instanceof Error ? err.message : "Bulk assignment failed");
      } finally {
        setBulkBusy(false);
      }
    },
    [selectedIds, loadCases, selectedCaseId, loadCaseDetail]
  );

  const handleAssign = useCallback(
    async (assignee: string | null) => {
      if (!selectedCaseId) return;
      setAssignmentBusy(true);
      setActionError(null);
      try {
        const updated = await setVerifierCaseAssignment(selectedCaseId, {
          assignee,
          actor: CURRENT_USER,
        });
        setDetail((prev) => (prev ? { ...prev, case: updated } : prev));
        setCases((prev) => prev.map((item) => (item.case_id === updated.case_id ? updated : item)));
        const latestEvents = await fetchVerifierCaseEvents(selectedCaseId);
        setEvents(latestEvents);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Assignment failed");
      } finally {
        setAssignmentBusy(false);
      }
    },
    [selectedCaseId]
  );

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


  useEffect(() => {
    if (selectedIds.size === 0) return;
    const visible = new Set(filteredCases.map((item) => item.case_id));
    setSelectedIds((prev) => new Set([...prev].filter((id) => visible.has(id))));
  }, [filteredCases, selectedIds.size]);


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
            <div className="space-y-2">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search cases"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={myQueueOnly}
                  onChange={(e) => setMyQueueOnly(e.target.checked)}
                />
                My Queue ({CURRENT_USER})
              </label>
            </div>
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
              Showing {filteredCases.length} of {count} cases
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
                {selectedIds.size > 0 && (
                  <div className="p-3 flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 text-xs">
                    <span className="font-semibold text-slate-700">{selectedIds.size} selected</span>
                    <button
                      onClick={() => handleBulkAction("approve")}
                      disabled={bulkBusy}
                      className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleBulkAction("reject")}
                      disabled={bulkBusy}
                      className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-rose-700"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleBulkAction("needs_review")}
                      disabled={bulkBusy}
                      className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700"
                    >
                      Needs review
                    </button>
                    <button
                      onClick={() => handleBulkAssign(CURRENT_USER)}
                      disabled={bulkBusy}
                      className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-700"
                    >
                      Assign to me
                    </button>
                    <button
                      onClick={() => handleBulkAssign(null)}
                      disabled={bulkBusy}
                      className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-700"
                    >
                      Unassign
                    </button>
                    {bulkError && <span className="text-red-600">{bulkError}</span>}
                  </div>
                )}
                <div className="flex items-center gap-2 px-4 py-2 text-xs text-slate-500">
                  <input
                    type="checkbox"
                    checked={selectedIds.size > 0 && selectedIds.size === filteredCases.length}
                    onChange={toggleSelectAll}
                  />
                  Select all
                </div>
                {filteredCases.map((item) => (
                  <div
                    key={item.case_id}
                    className={`flex gap-3 px-4 py-3 hover:bg-slate-50 transition-colors ${
                      selectedCaseId === item.case_id ? "bg-slate-100" : "bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.case_id)}
                      onChange={() => toggleSelectCase(item.case_id)}
                      onClick={(event) => event.stopPropagation()}
                      className="mt-1"
                    />
                    <button
                      onClick={() => handleSelectCase(item.case_id)}
                      className="flex-1 text-left"
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
                      <div className="mt-1 text-xs text-slate-500">
                        Assignee: {item.assignee || "Unassigned"}
                      </div>
                      <div className="mt-1 text-xs text-slate-600 line-clamp-2">
                        {item.summary || "No summary"}
                      </div>
                    </button>
                  </div>
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
                        <div className="font-semibold text-slate-600">Assignee</div>
                        <div>{detail.case.assignee || "Unassigned"}</div>
                      </div>
                      <div>
                        <div className="font-semibold text-slate-600">Assigned</div>
                        <div>{detail.case.assigned_at ? safeFormatDate(detail.case.assigned_at) : "—"}</div>
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

                  <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-700">Actions</h3>
                      {actionError && <span className="text-xs text-red-600">{actionError}</span>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleAction("approve")}
                        disabled={actionInProgress !== null}
                        className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        {actionInProgress === "approve" ? "Approving…" : "Approve"}
                      </button>
                      <button
                        onClick={() => handleAction("reject")}
                        disabled={actionInProgress !== null}
                        className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                      >
                        {actionInProgress === "reject" ? "Rejecting…" : "Reject"}
                      </button>
                      <button
                        onClick={() => handleAction("needs_review")}
                        disabled={actionInProgress !== null}
                        className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                      >
                        {actionInProgress === "needs_review" ? "Updating…" : "Needs review"}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleAssign(CURRENT_USER)}
                        disabled={assignmentBusy}
                        className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {assignmentBusy ? "Assigning…" : "Assign to me"}
                      </button>
                      <button
                        onClick={() => handleAssign(null)}
                        disabled={assignmentBusy}
                        className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {assignmentBusy ? "Updating…" : "Unassign"}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-700">Notes</h3>
                      {noteError && <span className="text-xs text-red-600">{noteError}</span>}
                    </div>
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      rows={3}
                      className="w-full rounded-md border border-slate-200 p-2 text-sm"
                      placeholder="Add a note for this case…"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={handleAddNote}
                        disabled={noteSaving}
                        className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        {noteSaving ? "Saving…" : "Add note"}
                      </button>
                    </div>
                    {notes.length === 0 ? (
                      <p className="text-xs text-slate-500">No notes yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {notes.map((note) => (
                          <div key={note.id} className="rounded border border-slate-100 bg-slate-50 p-2 text-xs">
                            <div className="flex items-center justify-between text-slate-500">
                              <span>{note.actor || "verifier"}</span>
                              <span>{safeFormatRelative(note.created_at)}</span>
                            </div>
                            <p className="mt-1 text-slate-700 whitespace-pre-wrap">{note.note}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-700">Recent events</h3>
                      <span className="text-xs text-slate-500">{events.length} events</span>
                    </div>
                    {events.length === 0 ? (
                      <p className="mt-3 text-xs text-slate-500">No events recorded.</p>
                    ) : (
                      <ul className="mt-3 space-y-2">
                        {events.map((event) => (
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

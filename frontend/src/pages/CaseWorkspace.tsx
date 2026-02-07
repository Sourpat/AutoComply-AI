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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  bulkVerifierCaseAction,
  bulkVerifierCaseAssign,
  decideVerifierCase,
  downloadVerifierAttachment,
  downloadAuditZip,
  downloadDecisionPacketPdf,
  fetchVerifierCaseEvents,
  fetchVerifierCaseAttachments,
  fetchVerifierCaseSubmission,
  fetchVerifierCaseDetail,
  fetchVerifierCases,
  getDecisionPacket,
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
  const DECISION_ACTOR_DEFAULT = "verifier-demo";
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
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [assignmentBusy, setAssignmentBusy] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decisionType, setDecisionType] = useState<"approve" | "reject" | "request_info">(
    "approve"
  );
  const [decisionReason, setDecisionReason] = useState("");
  const [decisionActor, setDecisionActor] = useState(DECISION_ACTOR_DEFAULT);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [filtersReady, setFiltersReady] = useState(false);
  const [packetTab, setPacketTab] = useState<"overview" | "evidence">("overview");
  const [packetLoading, setPacketLoading] = useState(false);
  const [packetError, setPacketError] = useState<string | null>(null);
  const [packetCache, setPacketCache] = useState<Record<string, any>>({});
  const [packetToast, setPacketToast] = useState<string | null>(null);
  const [submissionData, setSubmissionData] = useState<any | null>(null);
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submissionAttachments, setSubmissionAttachments] = useState<any[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentsError, setAttachmentsError] = useState<string | null>(null);

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
      setSubmissionData(null);
      return;
    }
    loadCaseDetail(selectedCaseId);
  }, [selectedCaseId, loadCaseDetail]);

  useEffect(() => {
    if (!detail?.case?.submission_id) {
      setSubmissionData(null);
      setSubmissionAttachments([]);
      return;
    }
    setSubmissionLoading(true);
    setSubmissionError(null);
    fetchVerifierCaseSubmission(detail.case.case_id)
      .then((data) => setSubmissionData(data))
      .catch((err) => {
        setSubmissionError(err instanceof Error ? err.message : "Failed to load submission");
        setSubmissionData(null);
      })
      .finally(() => setSubmissionLoading(false));
  }, [detail?.case?.submission_id, detail?.case?.case_id]);

  useEffect(() => {
    if (!detail?.case?.submission_id) {
      setSubmissionAttachments([]);
      return;
    }
    setAttachmentsLoading(true);
    setAttachmentsError(null);
    fetchVerifierCaseAttachments(detail.case.case_id)
      .then((items) => setSubmissionAttachments(items))
      .catch((err) => {
        setAttachmentsError(err instanceof Error ? err.message : "Failed to load attachments");
        setSubmissionAttachments([]);
      })
      .finally(() => setAttachmentsLoading(false));
  }, [detail?.case?.submission_id, detail?.case?.case_id]);


  const handleAddNote = useCallback(async () => {
    if (!selectedCaseId) return;
    if (detail?.case?.locked) {
      setNoteError("Case is locked");
      return;
    }
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
  }, [noteText, selectedCaseId, detail?.case?.locked]);

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
      const selectable = filteredCases.filter((item) => !item.locked);
      if (prev.size === selectable.length) {
        return new Set();
      }
      return new Set(selectable.map((item) => item.case_id));
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
      setAssignmentError(null);
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
        setAssignmentError(err instanceof Error ? err.message : "Assignment failed");
      } finally {
        setAssignmentBusy(false);
      }
    },
    [selectedCaseId]
  );

  const openDecisionModal = useCallback(() => {
    setDecisionType("approve");
    setDecisionReason("");
    setDecisionActor(DECISION_ACTOR_DEFAULT);
    setDecisionError(null);
    setDecisionOpen(true);
  }, [DECISION_ACTOR_DEFAULT]);

  const handleFinalizeDecision = useCallback(async () => {
    if (!selectedCaseId) return;
    const trimmedReason = decisionReason.trim();
    if (decisionType !== "approve" && !trimmedReason) {
      setDecisionError("Reason is required for reject/request info.");
      return;
    }
    setDecisionBusy(true);
    setDecisionError(null);
    try {
      await decideVerifierCase(
        selectedCaseId,
        {
          type: decisionType,
          reason: trimmedReason || undefined,
          actor: decisionActor.trim() || undefined,
        },
        true
      );
      setDecisionOpen(false);
      setDecisionReason("");
      setDecisionActor(DECISION_ACTOR_DEFAULT);
      setDecisionType("approve");
      setPacketCache((prev) => {
        const next = { ...prev };
        delete next[`${selectedCaseId}:1`];
        delete next[`${selectedCaseId}:0`];
        return next;
      });
      await loadCaseDetail(selectedCaseId);
      await loadCases({ reset: true });
      await loadDecisionPacket(selectedCaseId, true);
    } catch (err) {
      setDecisionError(err instanceof Error ? err.message : "Decision failed");
    } finally {
      setDecisionBusy(false);
    }
  }, [
    selectedCaseId,
    decisionReason,
    decisionType,
    decisionActor,
    DECISION_ACTOR_DEFAULT,
    loadCaseDetail,
    loadCases,
    loadDecisionPacket,
  ]);

  const loadDecisionPacket = useCallback(
    async (caseId: string, includeExplain: boolean = true) => {
      const cacheKey = `${caseId}:${includeExplain ? "1" : "0"}`;
      if (packetCache[cacheKey]) {
        return packetCache[cacheKey];
      }
      setPacketLoading(true);
      setPacketError(null);
      try {
        const packet = await getDecisionPacket(caseId, includeExplain);
        setPacketCache((prev) => ({ ...prev, [cacheKey]: packet }));
        return packet;
      } catch (err) {
        setPacketError(err instanceof Error ? err.message : "Failed to load packet");
        return null;
      } finally {
        setPacketLoading(false);
      }
    },
    [packetCache]
  );

  const handleExportPacket = useCallback(async () => {
    if (!selectedCaseId) return;
    const packet = await loadDecisionPacket(selectedCaseId, true);
    if (!packet) return;
    const blob = new Blob([JSON.stringify(packet, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `decision-packet-${selectedCaseId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setPacketToast(`Decision packet JSON downloaded for ${selectedCaseId}`);
  }, [selectedCaseId, loadDecisionPacket]);

  const handleExportPdf = useCallback(async () => {
    if (!selectedCaseId) return;
    try {
      const blob = await downloadDecisionPacketPdf(selectedCaseId, true);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `decision-packet-${selectedCaseId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setPacketToast(`Decision packet PDF downloaded for ${selectedCaseId}`);
    } catch (err) {
      setPacketError(err instanceof Error ? err.message : "Failed to download PDF");
    }
  }, [selectedCaseId]);

  const handleDownloadAttachment = useCallback(async (attachment: any) => {
    try {
      const blob = await downloadVerifierAttachment(attachment.attachment_id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.filename || "attachment";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setAttachmentsError(err instanceof Error ? err.message : "Failed to download attachment");
    }
  }, []);

  const handleDownloadAuditZip = useCallback(async () => {
    if (!selectedCaseId) return;
    try {
      const blob = await downloadAuditZip(selectedCaseId, true);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `audit-packet-${selectedCaseId}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setPacketToast(
        `Audit ZIP (${isLocked ? "Final" : "Draft"}) downloaded for ${selectedCaseId}`
      );
    } catch (err) {
      setPacketError(err instanceof Error ? err.message : "Failed to download audit zip");
    }
  }, [selectedCaseId, isLocked]);

  useEffect(() => {
    if (!packetToast) return;
    const timeoutId = window.setTimeout(() => setPacketToast(null), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [packetToast]);

  useEffect(() => {
    if (!selectedCaseId) return;
    loadDecisionPacket(selectedCaseId, true);
  }, [selectedCaseId, loadDecisionPacket]);

  const statusOptions = useMemo(() => {
    const values = new Set(["open", "in_review", "needs_info", "approved", "rejected"]);
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
  const selectableCount = filteredCases.filter((item) => !item.locked).length;


  useEffect(() => {
    if (selectedIds.size === 0) return;
    const visible = new Map(filteredCases.map((item) => [item.case_id, item]));
    setSelectedIds(
      (prev) =>
        new Set(
          [...prev].filter((id) => {
            const item = visible.get(id);
            return item && !item.locked;
          })
        )
    );
  }, [filteredCases, selectedIds.size]);

  const packetKey = selectedCaseId ? `${selectedCaseId}:1` : null;
  const decisionPacket = packetKey ? packetCache[packetKey] : null;
  const citations = decisionPacket?.explain?.citations || [];
  const isLocked = detail?.case?.locked ?? false;
  const isNeedsInfo = detail?.case?.status === "needs_info";


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
                    checked={selectedIds.size > 0 && selectedIds.size === selectableCount}
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
                      disabled={item.locked}
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
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] uppercase tracking-wide text-slate-500">
                            {item.status}
                          </span>
                          {item.locked && (
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-700">
                              Locked
                            </span>
                          )}
                        </div>
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
                      <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wide text-slate-500">
                          {detail.case.status}
                        </span>
                        {detail.case.locked && (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-700">
                            Locked
                          </span>
                        )}
                      </div>
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

                  {isNeedsInfo && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                      Awaiting submitter updates.
                    </div>
                  )}

                  <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-700">Decision</h3>
                      {decisionError && <span className="text-xs text-red-600">{decisionError}</span>}
                    </div>
                    {detail.case.decision ? (
                      <div className="rounded-md border border-slate-100 bg-slate-50 p-2 text-xs text-slate-600">
                        <div className="font-semibold text-slate-700">
                          {detail.case.decision.type}
                        </div>
                        {detail.case.decision.reason && (
                          <div className="mt-1">Reason: {detail.case.decision.reason}</div>
                        )}
                        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                          <span>{detail.case.decision.actor || "verifier"}</span>
                          <span>
                            {detail.case.decision.timestamp
                              ? safeFormatRelative(detail.case.decision.timestamp)
                              : ""}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">No final decision yet.</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={openDecisionModal}
                        disabled={isLocked}
                        className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {isLocked ? "Case locked" : "Finalize decision"}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleAssign(CURRENT_USER)}
                        disabled={assignmentBusy || isLocked}
                        className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {assignmentBusy ? "Assigning…" : "Assign to me"}
                      </button>
                      <button
                        onClick={() => handleAssign(null)}
                        disabled={assignmentBusy || isLocked}
                        className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {assignmentBusy ? "Updating…" : "Unassign"}
                      </button>
                      {assignmentError && <span className="text-xs text-red-600">{assignmentError}</span>}
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
                      disabled={isLocked}
                      className="w-full rounded-md border border-slate-200 p-2 text-sm disabled:bg-slate-50"
                      placeholder="Add a note for this case…"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={handleAddNote}
                        disabled={noteSaving || isLocked}
                        className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        {noteSaving ? "Saving…" : "Add note"}
                      </button>
                    </div>
                    {isLocked && (
                      <p className="text-xs text-slate-500">Case locked. Notes are disabled.</p>
                    )}
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

                  <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-700">Submission</h3>
                      {detail.case.submission_id && (
                        <span className="text-xs text-slate-500">{detail.case.submission_id}</span>
                      )}
                    </div>
                    {!detail.case.submission_id && (
                      <p className="text-xs text-slate-500">No submission linked.</p>
                    )}
                    {detail.case.submission_id && submissionLoading && (
                      <p className="text-xs text-slate-500">Loading submission…</p>
                    )}
                    {detail.case.submission_id && submissionError && (
                      <p className="text-xs text-red-600">{submissionError}</p>
                    )}
                    {detail.case.submission_id && submissionData && !submissionLoading && (
                      <div className="space-y-2 text-xs text-slate-600">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="font-semibold text-slate-700">Subject</div>
                            <div>{submissionData.title || submissionData.payload?.subject || "—"}</div>
                          </div>
                          <div>
                            <div className="font-semibold text-slate-700">Submitter</div>
                            <div>{submissionData.payload?.submitter_name || "—"}</div>
                          </div>
                          <div>
                            <div className="font-semibold text-slate-700">Doc type</div>
                            <div>{submissionData.payload?.doc_type || submissionData.csf_type || "—"}</div>
                          </div>
                          <div>
                            <div className="font-semibold text-slate-700">Jurisdiction</div>
                            <div>{submissionData.payload?.jurisdiction || submissionData.tenant || "—"}</div>
                          </div>
                          <div>
                            <div className="font-semibold text-slate-700">Created</div>
                            <div>{safeFormatDate(submissionData.created_at)}</div>
                          </div>
                        </div>
                        <div>
                          <div className="font-semibold text-slate-700">Notes</div>
                          <div className="whitespace-pre-wrap">
                            {submissionData.payload?.notes || submissionData.summary || "—"}
                          </div>
                        </div>
                        <div>
                          <div className="font-semibold text-slate-700">Attachments</div>
                          {attachmentsLoading && (
                            <p className="text-slate-500">Loading attachments…</p>
                          )}
                          {attachmentsError && (
                            <p className="text-red-600">{attachmentsError}</p>
                          )}
                          {!attachmentsLoading && !attachmentsError && submissionAttachments.length === 0 && (
                            <p className="text-slate-500">No attachments.</p>
                          )}
                          {!attachmentsLoading && submissionAttachments.length > 0 && (
                            <ul className="mt-1 space-y-1">
                              {submissionAttachments.map((item: any) => (
                                <li key={item.attachment_id} className="rounded border border-slate-100 bg-slate-50 p-2">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="font-semibold text-slate-700">{item.filename || "Attachment"}</div>
                                      <div className="text-[11px] text-slate-500">
                                        {item.content_type || "unknown"}
                                        {item.byte_size ? ` • ${item.byte_size} bytes` : ""}
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => handleDownloadAttachment(item)}
                                      className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                      Download
                                    </button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-700">Decision Packet</h3>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleExportPacket}
                          className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Export JSON
                        </button>
                        <button
                          onClick={handleExportPdf}
                          className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Export PDF
                        </button>
                        <button
                          onClick={handleDownloadAuditZip}
                          className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Audit ZIP ({isLocked ? "Final" : "Draft"})
                        </button>
                        <button
                          onClick={() => loadDecisionPacket(detail.case.case_id, true)}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500"
                        >
                          Refresh
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setPacketTab("overview")}
                        className={`rounded-md px-3 py-1 text-xs font-semibold ${
                          packetTab === "overview"
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        Overview
                      </button>
                      <button
                        onClick={() => setPacketTab("evidence")}
                        className={`rounded-md px-3 py-1 text-xs font-semibold ${
                          packetTab === "evidence"
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        Evidence
                      </button>
                    </div>

                    {packetLoading && <p className="text-xs text-slate-500">Loading packet…</p>}
                    {packetError && <p className="text-xs text-red-600">{packetError}</p>}
                    {packetToast && <p className="text-xs text-emerald-600">{packetToast}</p>}

                    {!packetLoading && !packetError && decisionPacket && packetTab === "overview" && (
                      <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                        <div>
                          <div className="font-semibold text-slate-700">Status</div>
                          <div>{decisionPacket.case?.status}</div>
                        </div>
                        <div>
                          <div className="font-semibold text-slate-700">Assignee</div>
                          <div>{decisionPacket.case?.assignee || "Unassigned"}</div>
                        </div>
                        <div>
                          <div className="font-semibold text-slate-700">Priority</div>
                          <div>{decisionPacket.case?.priority}</div>
                        </div>
                        <div>
                          <div className="font-semibold text-slate-700">Generated</div>
                          <div>{safeFormatDate(decisionPacket.verifier?.generated_at)}</div>
                        </div>
                        <div>
                          <div className="font-semibold text-slate-700">Actions</div>
                          <div>{decisionPacket.actions?.length ?? 0}</div>
                        </div>
                      </div>
                    )}

                    {!packetLoading && !packetError && decisionPacket && packetTab === "evidence" && (
                      <div className="space-y-2 text-xs">
                        {citations.length === 0 ? (
                          <p className="text-slate-500">No citations available.</p>
                        ) : (
                          citations.map((citation: any, index: number) => (
                            <div key={`${citation.doc_id}-${citation.chunk_id}-${index}`} className="rounded border border-slate-100 bg-slate-50 p-2">
                              <div className="font-semibold text-slate-700">
                                {citation.source_title || citation.doc_id || "Citation"}
                              </div>
                              {citation.jurisdiction && (
                                <div className="text-[11px] text-slate-500">{citation.jurisdiction}</div>
                              )}
                              <div className="mt-1 text-slate-600 whitespace-pre-wrap">
                                {citation.snippet || "No snippet available."}
                              </div>
                            </div>
                          ))
                        )}
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

                  <Dialog open={decisionOpen} onOpenChange={setDecisionOpen}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Finalize decision</DialogTitle>
                        <DialogDescription>
                          Choose the final decision for this case. Approve or Reject will lock the case.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3 text-sm">
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-semibold text-slate-600">Decision type</span>
                          <select
                            value={decisionType}
                            onChange={(event) =>
                              setDecisionType(event.target.value as "approve" | "reject" | "request_info")
                            }
                            className="rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                          >
                            <option value="approve">Approve</option>
                            <option value="reject">Reject</option>
                            <option value="request_info">Request info</option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-semibold text-slate-600">Reason</span>
                          <textarea
                            value={decisionReason}
                            onChange={(event) => setDecisionReason(event.target.value)}
                            rows={3}
                            className="rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                            placeholder="Reason for decision (required for reject/request info)"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-semibold text-slate-600">Actor</span>
                          <input
                            value={decisionActor}
                            onChange={(event) => setDecisionActor(event.target.value)}
                            className="rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                            placeholder="verifier-demo"
                          />
                        </label>
                        {decisionError && <p className="text-xs text-red-600">{decisionError}</p>}
                      </div>
                      <DialogFooter>
                        <Button
                          variant="secondary"
                          onClick={() => setDecisionOpen(false)}
                          disabled={decisionBusy}
                        >
                          Cancel
                        </Button>
                        <Button onClick={handleFinalizeDecision} disabled={decisionBusy}>
                          {decisionBusy ? "Finalizing…" : "Finalize"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
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

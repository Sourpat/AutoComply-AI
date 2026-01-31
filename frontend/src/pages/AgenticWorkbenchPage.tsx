import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { getWorkQueue, type WorkQueueSubmission } from "../api/consoleClient";
import { DecisionTraceDrawer } from "../components/audit/DecisionTraceDrawer";
import { AgentActionPanel } from "../components/agentic/AgentActionPanel";
import { AgentEventTimeline } from "../components/agentic/AgentEventTimeline";
import { EmptyState } from "../components/common/EmptyState";
import { ErrorState } from "../components/common/ErrorState";
import { PageHeader } from "../components/common/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import type { CaseEvent } from "../contracts/agentic";
import { useAgentPlan } from "../hooks/useAgentPlan";
import { API_BASE } from "../lib/api";
import {
  appendHumanEvent,
  buildAuditFileName,
  buildAuditPacket,
  buildAuditPdf,
  computePacketHash,
  getHumanEvents,
  saveAuditPacket,
  type EvidenceItem,
  type EvidenceState,
  type HumanActionEvent,
  toDecisionId,
} from "../lib/agenticAudit";
import { formatTimestamp } from "../lib/formatters";
import { cn } from "../lib/utils";

const statusFilterOptions = [
  { value: "all", label: "All" },
  { value: "needs_review", label: "Needs Review" },
  { value: "needs_input", label: "Needs Input" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const riskOptions = [
  { value: "all", label: "All risk" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const sortOptions = [
  { value: "newest", label: "Newest" },
  { value: "highest_risk", label: "Highest risk" },
  { value: "recent_activity", label: "Recent activity" },
];

const statusTone: Record<string, "secondary" | "warning" | "success" | "destructive" | "info"> = {
  submitted: "warning",
  in_review: "info",
  needs_input: "warning",
  approved: "success",
  rejected: "destructive",
};

const riskTone: Record<string, "secondary" | "warning" | "destructive"> = {
  low: "secondary",
  medium: "warning",
  high: "destructive",
  critical: "destructive",
};

const workbenchTabs = [
  { value: "overview", label: "Overview" },
  { value: "actions", label: "Agent Actions" },
  { value: "timeline", label: "Timeline" },
  { value: "evidence", label: "Evidence" },
];

function formatAgeLabel(createdAt: string) {
  const created = new Date(createdAt);
  const diffMs = Date.now() - created.getTime();
  const diffHours = Math.max(diffMs / 36e5, 0);
  if (diffHours < 1) return "<1h";
  if (diffHours < 24) return `${Math.round(diffHours)}h`;
  return `${Math.round(diffHours / 24)}d`;
}

function normalizeRisk(risk?: string | null, priority?: string) {
  if (risk) return risk.toLowerCase();
  if (!priority) return "medium";
  if (priority.toLowerCase().includes("high")) return "high";
  if (priority.toLowerCase().includes("low")) return "low";
  return "medium";
}

function buildEvidenceFromEvents(events: CaseEvent[]): EvidenceItem[] {
  return events.map((event) => {
    if (event.type === "user_input") {
      return {
        id: event.id,
        type: "user_attestation",
        source: "User input",
        timestamp: event.timestamp,
        details: event.payload,
      };
    }

    if (event.type === "action") {
      const actionId = String(event.payload?.actionId ?? "");
      return {
        id: event.id,
        type: "external_check",
        source: actionId || "Agent action",
        timestamp: event.timestamp,
        details: event.payload,
      };
    }

    return {
      id: event.id,
      type: "agent_step",
      source: event.type.replace(/_/g, " "),
      timestamp: event.timestamp,
      details: event.payload,
    };
  });
}

function buildEvidenceFromSubmission(submission: WorkQueueSubmission | null): EvidenceItem[] {
  if (!submission?.payload) return [];
  const items: EvidenceItem[] = [];
  const payload = submission.payload as Record<string, unknown>;

  const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
  attachments.forEach((attachment, index) => {
    items.push({
      id: `${submission.submission_id}-attachment-${index}`,
      type: "doc",
      source: "Attachment",
      timestamp: submission.updated_at,
      details: (attachment as Record<string, unknown>) ?? {},
    });
  });

  const citations = Array.isArray(payload.citations) ? payload.citations : [];
  citations.forEach((citation, index) => {
    items.push({
      id: `${submission.submission_id}-citation-${index}`,
      type: "field",
      source: "Knowledge citation",
      timestamp: submission.updated_at,
      details: (citation as Record<string, unknown>) ?? {},
    });
  });

  return items;
}

export function AgenticWorkbenchPage() {
  const [cases, setCases] = useState<WorkQueueSubmission[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [casesError, setCasesError] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [formFilter, setFormFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [activeTab, setActiveTab] = useState("overview");
  const [events, setEvents] = useState<CaseEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [evidenceState, setEvidenceState] = useState<EvidenceState>({});
  const [auditNotes, setAuditNotes] = useState("");
  const [auditOpen, setAuditOpen] = useState(false);
  const [traceOpen, setTraceOpen] = useState(false);
  const [humanEvents, setHumanEvents] = useState<HumanActionEvent[]>([]);
  const [packetHash, setPacketHash] = useState<string | null>(null);
  const [visibleEvidenceCount, setVisibleEvidenceCount] = useState(50);
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>({});

  const caseId = selectedCaseId ?? "";
  const { plan, loading: planLoading, error: planError, refresh } = useAgentPlan(caseId);

  const selectedCase = useMemo(
    () => cases.find((item) => item.submission_id === selectedCaseId) ?? null,
    [cases, selectedCaseId]
  );

  const loadCases = useCallback(async () => {
    setLoadingCases(true);
    setCasesError(null);
    try {
      const response = await getWorkQueue(undefined, undefined, 200);
      setCases(response.items ?? []);
      if (!selectedCaseId && response.items.length > 0) {
        setSelectedCaseId(response.items[0].submission_id);
      }
    } catch (err) {
      setCasesError(err instanceof Error ? err.message : "Failed to load cases");
    } finally {
      setLoadingCases(false);
    }
  }, [selectedCaseId]);

  const loadEvents = useCallback(async () => {
    if (!caseId) return;
    setEventsLoading(true);
    setEventsError(null);
    try {
      const response = await fetch(`${API_BASE}/api/agentic/cases/${caseId}/events`);
      if (!response.ok) {
        throw new Error(`Failed to load events (${response.status})`);
      }
      const data = (await response.json()) as CaseEvent[];
      setEvents(data);
    } catch (err) {
      setEventsError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setEventsLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  useEffect(() => {
    if (caseId) {
      loadEvents();
    }
  }, [caseId, loadEvents]);

  useEffect(() => {
    if (plan?.trace?.timestamp) {
      loadEvents();
    }
  }, [plan?.trace?.timestamp, loadEvents]);

  useEffect(() => {
    if (!caseId) return;
    const raw = localStorage.getItem(`agentic:evidence:${caseId}`);
    const notes = localStorage.getItem(`agentic:audit-notes:${caseId}`) ?? "";
    setAuditNotes(notes);
    const humanResult = getHumanEvents(caseId);
    setHumanEvents(humanResult.events);
    if (humanResult.error) {
      toast.error(`Human actions unavailable: ${humanResult.error}`);
    }

    if (!raw) {
      setEvidenceState({});
      return;
    }
    try {
      setEvidenceState(JSON.parse(raw) as EvidenceState);
    } catch {
      setEvidenceState({});
    }
  }, [caseId]);

  useEffect(() => {
    setVisibleEvidenceCount(50);
    setExpandedEvidence({});
  }, [caseId]);

  const persistEvidenceState = (next: EvidenceState) => {
    setEvidenceState(next);
    if (caseId) {
      localStorage.setItem(`agentic:evidence:${caseId}`, JSON.stringify(next));
    }
  };

  const updateEvidenceNote = (evidenceId: string, note: string) => {
    const next = {
      ...evidenceState,
      [evidenceId]: {
        ...evidenceState[evidenceId],
        note,
      },
    };
    persistEvidenceState(next);
  };

  const commitEvidenceNote = (evidenceId: string, note: string) => {
    if (!caseId || !note.trim()) return;
    const result = appendHumanEvent(caseId, {
      caseId,
      type: "NOTE_ADDED",
      actor: "verifier",
      payload: { evidenceId, note },
    });
    if (result.event) {
      setHumanEvents((prev) => [...prev, result.event]);
    }
    if (result.error) {
      toast.error(`Unable to log note: ${result.error}`);
    }
  };

  const toggleEvidenceReviewed = (evidenceId: string) => {
    const next = {
      ...evidenceState,
      [evidenceId]: {
        ...evidenceState[evidenceId],
        reviewed: !evidenceState[evidenceId]?.reviewed,
      },
    };
    persistEvidenceState(next);
    if (caseId) {
      const result = appendHumanEvent(caseId, {
        caseId,
        type: "EVIDENCE_REVIEWED",
        actor: "verifier",
        payload: { evidenceId, reviewed: next[evidenceId]?.reviewed },
      });
      if (result.event) {
        setHumanEvents((prev) => [...prev, result.event]);
      }
      if (result.error) {
        toast.error(`Unable to log review: ${result.error}`);
      }
    }
  };

  const evidenceItems = useMemo(() => {
    const eventEvidence = buildEvidenceFromEvents(events);
    const submissionEvidence = buildEvidenceFromSubmission(selectedCase);
    return [...eventEvidence, ...submissionEvidence];
  }, [events, selectedCase]);

  const visibleEvidenceItems = useMemo(() => {
    if (evidenceItems.length > 200) {
      return evidenceItems.slice(0, visibleEvidenceCount);
    }
    return evidenceItems;
  }, [evidenceItems, visibleEvidenceCount]);

  const filteredCases = useMemo(() => {
    let filtered = [...cases];
    if (statusFilter !== "all") {
      filtered = filtered.filter((item) => {
        if (statusFilter === "needs_review") {
          return ["submitted", "in_review"].includes(item.status);
        }
        if (statusFilter === "needs_input") {
          return item.decision_status === "needs_input" || item.status === "needs_input";
        }
        if (statusFilter === "approved") return item.status === "approved";
        if (statusFilter === "rejected") return item.status === "rejected";
        return true;
      });
    }

    if (riskFilter !== "all") {
      filtered = filtered.filter((item) => normalizeRisk(item.risk_level, item.priority) === riskFilter);
    }

    if (formFilter !== "all") {
      filtered = filtered.filter((item) => item.csf_type === formFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((item) =>
        [
          item.submission_id,
          item.tenant,
          item.title,
          item.subtitle,
          item.csf_type,
          (() => {
            try {
              return JSON.stringify(item.payload ?? {});
            } catch {
              return "";
            }
          })(),
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query))
      );
    }

    if (sortBy === "newest") {
      filtered.sort((a, b) => b.created_at.localeCompare(a.created_at));
    } else if (sortBy === "recent_activity") {
      filtered.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    } else if (sortBy === "highest_risk") {
      const riskRank: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
      filtered.sort(
        (a, b) =>
          (riskRank[normalizeRisk(b.risk_level, b.priority)] ?? 0) -
          (riskRank[normalizeRisk(a.risk_level, a.priority)] ?? 0)
      );
    }

    return filtered;
  }, [cases, formFilter, riskFilter, searchQuery, sortBy, statusFilter]);

  const formTypes = useMemo(() => {
    const types = Array.from(new Set(cases.map((item) => item.csf_type).filter(Boolean)));
    return types.length ? types : ["csf", "license", "other"];
  }, [cases]);

  const decisionId = selectedCase ? toDecisionId(selectedCase.submission_id, selectedCase.updated_at) : "";

  const packetBase = useMemo(() => {
    if (!selectedCase) return null;
    return buildAuditPacket({
      caseItem: selectedCase,
      plan,
      events,
      evidenceItems,
      evidenceState,
      auditNotes,
      humanEvents,
      packetHash: undefined,
    });
  }, [auditNotes, evidenceItems, evidenceState, events, humanEvents, plan, selectedCase]);

  useEffect(() => {
    let active = true;
    if (!packetBase) {
      setPacketHash(null);
      return () => {
        active = false;
      };
    }
    computePacketHash(packetBase)
      .then((hash) => {
        if (active) setPacketHash(hash);
      })
      .catch(() => {
        if (active) setPacketHash(null);
      });
    return () => {
      active = false;
    };
  }, [packetBase]);

  const handleExportJson = async () => {
    if (!selectedCase || !packetBase) return;
    const hash = packetHash ?? (await computePacketHash(packetBase));
    const packet = { ...packetBase, packetHash: hash };
    const saveResult = saveAuditPacket(packet, hash);
    if (!saveResult.ok && saveResult.error) {
      toast.error(`Local storage error: ${saveResult.error}`);
    }
    const blob = new Blob([JSON.stringify(packet, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = buildAuditFileName(selectedCase.submission_id);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    if (caseId) {
      const result = appendHumanEvent(caseId, {
        caseId,
        type: "EXPORT_JSON",
        actor: "verifier",
        payload: { fileName: buildAuditFileName(selectedCase.submission_id) },
      });
      if (result.event) {
        setHumanEvents((prev) => [...prev, result.event]);
      }
      if (result.error) {
        toast.error(`Unable to log export: ${result.error}`);
      }
    }
    toast.success("Audit packet exported");
  };

  const handleExportPdf = async () => {
    if (!selectedCase || !packetBase) return;
    const hash = packetHash ?? (await computePacketHash(packetBase));
    const packet = { ...packetBase, packetHash: hash };
    const saveResult = saveAuditPacket(packet, hash);
    if (!saveResult.ok && saveResult.error) {
      toast.error(`Local storage error: ${saveResult.error}`);
    }
    const pdfBytes = await buildAuditPdf(packet, hash);
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = buildAuditFileName(selectedCase.submission_id).replace(".json", ".pdf");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    if (caseId) {
      const result = appendHumanEvent(caseId, {
        caseId,
        type: "EXPORT_PDF",
        actor: "verifier",
        payload: { fileName: buildAuditFileName(selectedCase.submission_id).replace(".json", ".pdf") },
      });
      if (result.event) {
        setHumanEvents((prev) => [...prev, result.event]);
      }
      if (result.error) {
        toast.error(`Unable to log export: ${result.error}`);
      }
    }
    toast.success("Audit packet PDF exported");
  };

  const handleCopyShareLink = async () => {
    if (!selectedCase || !packetBase) return;
    const hash = packetHash ?? (await computePacketHash(packetBase));
    const packet = { ...packetBase, packetHash: hash };
    const saveResult = saveAuditPacket(packet, hash);
    if (!saveResult.ok && saveResult.error) {
      toast.error(`Local storage error: ${saveResult.error}`);
      return;
    }
    const url = new URL(window.location.origin);
    url.pathname = "/audit/view";
    url.searchParams.set("hash", hash);
    url.searchParams.set("caseId", selectedCase.submission_id);
    url.searchParams.set("decisionId", decisionId);
    try {
      await navigator.clipboard.writeText(url.toString());
      toast.success("Share link copied");
    } catch {
      toast.error("Unable to copy share link");
    }
  };

  const saveAuditNotes = () => {
    if (!caseId) return;
    localStorage.setItem(`agentic:audit-notes:${caseId}`, auditNotes);
    if (auditNotes.trim()) {
      const result = appendHumanEvent(caseId, {
        caseId,
        type: "NOTE_ADDED",
        actor: "verifier",
        payload: { note: auditNotes },
      });
      if (result.event) {
        setHumanEvents((prev) => [...prev, result.event]);
      }
      if (result.error) {
        toast.error(`Unable to log note: ${result.error}`);
      }
    }
    toast.success("Audit notes saved");
  };

  const copyId = async (value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Unable to copy");
    }
  };

  const evidenceReviewedCount = useMemo(() => {
    return evidenceItems.filter((item) => evidenceState[item.id]?.reviewed).length;
  }, [evidenceItems, evidenceState]);

  const evidenceReviewedPct = evidenceItems.length
    ? Math.round((evidenceReviewedCount / evidenceItems.length) * 100)
    : 0;

  const completenessTone = useMemo(() => {
    if (plan?.status === "needs_input") return "warning";
    if (evidenceItems.length > 0 && evidenceReviewedPct < 80) return "warning";
    return "success";
  }, [evidenceItems.length, evidenceReviewedPct, plan?.status]);

  const completenessLabel = useMemo(() => {
    if (plan?.status === "needs_input") return "Needs input";
    if (evidenceItems.length > 0 && evidenceReviewedPct < 80) return "Evidence incomplete";
    return "Complete";
  }, [evidenceItems.length, evidenceReviewedPct, plan?.status]);

  const renderAuditPanel = () => (
    <Card className="h-full">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">Audit Packet</h3>
            <p className="text-xs text-muted-foreground">Verifier-grade traceability bundle.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/audit/verify">Verify packet</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportJson} disabled={!selectedCase}>
              Export JSON
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={!selectedCase}>
              Export PDF
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Decision ID</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyId(decisionId)}
              aria-label="Copy decision ID"
            >
              Copy
            </Button>
          </div>
          <p className="mt-1 text-foreground break-all">{decisionId || "--"}</p>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-muted-foreground">Case ID</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyId(caseId)}
              aria-label="Copy case ID"
            >
              Copy
            </Button>
          </div>
          <p className="mt-1 text-foreground break-all">{caseId || "--"}</p>
        </div>

        <div className="rounded-lg border border-border/70 bg-background p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Packet Hash (SHA-256)</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyId(packetHash ?? "")}
              aria-label="Copy packet hash"
              disabled={!packetHash}
            >
              Copy
            </Button>
          </div>
          <p className="mt-1 break-all text-foreground">{packetHash ?? "--"}</p>
        </div>

        <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Share packet</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyShareLink}
              aria-label="Copy share link"
              disabled={!selectedCase}
            >
              Copy link
            </Button>
          </div>
          <p className="mt-1 text-muted-foreground">
            Share links are stored locally on this device.
          </p>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Decision summary</h4>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusTone[selectedCase?.status ?? "submitted"] ?? "secondary"}>
              {selectedCase?.status ?? "unknown"}
            </Badge>
            <Badge variant={riskTone[normalizeRisk(selectedCase?.risk_level)] ?? "secondary"}>
              Risk {normalizeRisk(selectedCase?.risk_level)}
            </Badge>
            <Badge variant="secondary">
              Confidence {plan ? `${Math.round(plan.confidence * 100)}%` : "--"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Updated {selectedCase ? formatTimestamp(selectedCase.updated_at) : "--"}
          </p>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Audit analytics</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-md border border-border/70 bg-background p-2">
              <p className="text-[11px] text-muted-foreground">Evidence reviewed</p>
              <p className="text-sm font-semibold text-foreground">
                {evidenceReviewedPct}% ({evidenceReviewedCount}/{evidenceItems.length})
              </p>
            </div>
            <div className="rounded-md border border-border/70 bg-background p-2">
              <p className="text-[11px] text-muted-foreground">Timeline events</p>
              <p className="text-sm font-semibold text-foreground">{events.length}</p>
            </div>
            <div className="rounded-md border border-border/70 bg-background p-2">
              <p className="text-[11px] text-muted-foreground">Human actions</p>
              <p className="text-sm font-semibold text-foreground">{humanEvents.length}</p>
            </div>
            <div className="rounded-md border border-border/70 bg-background p-2">
              <p className="text-[11px] text-muted-foreground">Completeness</p>
              <Badge variant={completenessTone}>{completenessLabel}</Badge>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Decision trace</h4>
          {events.length === 0 && (
            <p className="text-xs text-muted-foreground">No decision steps recorded yet.</p>
          )}
          {events.length > 0 && (
            <div className="space-y-3">
              <ul className="space-y-2 text-xs">
                {events.slice(0, 3).map((event) => (
                  <li key={event.id} className="rounded-md border border-border/60 bg-background p-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{event.type.replace(/_/g, " ")}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatTimestamp(event.timestamp)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground break-words">
                      {JSON.stringify(event.payload).slice(0, 120)}
                    </p>
                  </li>
                ))}
              </ul>
              <Button variant="outline" size="sm" onClick={() => setTraceOpen(true)}>
                View full trace
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidence index</h4>
          {evidenceItems.length === 0 ? (
            <p className="text-xs text-muted-foreground">No evidence captured yet.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {evidenceItems.map((item) => (
                <li key={item.id} className="rounded-md border border-border/60 bg-background p-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{item.type.replace(/_/g, " ")}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveTab("evidence")}
                      aria-label="Open evidence tab"
                    >
                      View
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{item.source}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Human actions</h4>
          <textarea
            value={auditNotes}
            onChange={(event) => setAuditNotes(event.target.value)}
            onBlur={saveAuditNotes}
            placeholder="Add verifier notes or override rationale"
            className="min-h-[96px] w-full rounded-md border border-border/70 bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
          />
          <Button variant="outline" size="sm" onClick={saveAuditNotes}>
            Save notes
          </Button>
          <div className="space-y-2 text-xs">
            {humanEvents.length === 0 ? (
              <p className="text-muted-foreground">No human actions logged.</p>
            ) : (
              <ul className="space-y-2">
                {humanEvents.map((event) => (
                  <li key={event.id} className="rounded-md border border-border/60 bg-background p-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{event.type.replace(/_/g, " ")}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyId(event.id)}
                        aria-label="Copy human action ID"
                      >
                        Copy ID
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{formatTimestamp(event.timestamp)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agentic Workbench"
        subtitle="Verifier-grade workstation for agentic decisions, evidence, and audit packets."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={loadCases} disabled={loadingCases}>
              Refresh cases
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAuditOpen(true)}
              className="lg:hidden"
            >
              Open audit packet
            </Button>
          </div>
        }
      />

      <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Audit Packet</DialogTitle>
          </DialogHeader>
          {renderAuditPanel()}
        </DialogContent>
      </Dialog>

      <DecisionTraceDrawer open={traceOpen} onOpenChange={setTraceOpen} events={events} />

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)_360px]">
        <Card className="h-full">
          <CardContent className="space-y-4 p-4">
            <div className="space-y-2">
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search case id, org, state..."
                aria-label="Search cases"
              />
              <div className="grid gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger aria-label="Filter by status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusFilterOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={riskFilter} onValueChange={setRiskFilter}>
                  <SelectTrigger aria-label="Filter by risk">
                    <SelectValue placeholder="Risk" />
                  </SelectTrigger>
                  <SelectContent>
                    {riskOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={formFilter} onValueChange={setFormFilter}>
                  <SelectTrigger aria-label="Filter by form type">
                    <SelectValue placeholder="Form type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All forms</SelectItem>
                    {formTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger aria-label="Sort cases">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loadingCases && (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            )}

            {casesError && (
              <ErrorState title="Unable to load cases" description={casesError} onRetry={loadCases} />
            )}

            {!loadingCases && !casesError && filteredCases.length === 0 && (
              <EmptyState
                title="No cases found"
                description="Try adjusting search or filters to find matching submissions."
              />
            )}

            {!loadingCases && !casesError && filteredCases.length > 0 && (
              <div className="space-y-2">
                {filteredCases.map((item) => {
                  const risk = normalizeRisk(item.risk_level, item.priority);
                  return (
                    <button
                      key={item.submission_id}
                      type="button"
                      onClick={() => setSelectedCaseId(item.submission_id)}
                      className={cn(
                        "w-full rounded-lg border border-border/70 p-3 text-left transition hover:border-primary/60",
                        selectedCaseId === item.submission_id
                          ? "bg-primary/10"
                          : "bg-background"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.tenant}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">{formatAgeLabel(item.created_at)}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant={statusTone[item.status] ?? "secondary"}>{item.status}</Badge>
                        <Badge variant={riskTone[risk] ?? "secondary"}>Risk {risk}</Badge>
                        <Badge variant="secondary">{item.csf_type}</Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Updated {formatTimestamp(item.updated_at)}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardContent className="space-y-4 p-5">
            {!selectedCase && !loadingCases && (
              <EmptyState
                title="Select a case"
                description="Choose a case from the left panel to begin the agentic review."
              />
            )}

            {selectedCase && (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="flex flex-wrap gap-2">
                  {workbenchTabs.map((tab) => (
                    <TabsTrigger key={tab.value} value={tab.value}>
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <Card>
                      <CardContent className="space-y-2 p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Current decision</p>
                        <Badge variant={statusTone[selectedCase.status] ?? "secondary"}>
                          {selectedCase.status}
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          Confidence {plan ? `${Math.round(plan.confidence * 100)}%` : "--"}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="space-y-2 p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Why summary</p>
                        <p className="text-sm text-foreground">
                          {plan?.summary ?? "Explainability details will appear after plan refresh."}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="space-y-2 p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Needs input</p>
                        {plan?.status === "needs_input" ? (
                          <>
                            <p className="text-sm text-foreground">Action required before evaluation.</p>
                            <Button size="sm" onClick={() => setActiveTab("actions")}>
                              Resolve input
                            </Button>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">No outstanding requests.</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                  {planError && <ErrorState title="Plan error" description={planError} onRetry={refresh} />}
                </TabsContent>

                <TabsContent value="actions" className="space-y-4">
                  <AgentActionPanel caseId={caseId} />
                </TabsContent>

                <TabsContent value="timeline" className="space-y-4">
                  {eventsError && (
                    <ErrorState title="Timeline error" description={eventsError} onRetry={loadEvents} />
                  )}
                  {eventsLoading && <Skeleton className="h-40 w-full" />}
                  <AgentEventTimeline
                    caseId={caseId}
                    extraEvents={humanEvents.map((event) => ({
                      id: event.id,
                      caseId: event.caseId,
                      timestamp: event.timestamp,
                      type: "action",
                      payload: {
                        actor: event.actor,
                        type: event.type,
                        ...event.payload,
                      },
                    }))}
                  />
                </TabsContent>

                <TabsContent value="evidence" className="space-y-4">
                  {eventsLoading && <Skeleton className="h-32 w-full" />}
                  {!eventsLoading && evidenceItems.length === 0 && (
                    <EmptyState
                      title="No evidence captured"
                      description="Evidence will appear here once agent actions and inputs are recorded."
                    />
                  )}
                  {!eventsLoading && evidenceItems.length > 0 && (
                    <div className="space-y-3">
                      {visibleEvidenceItems.map((item) => {
                        const state = evidenceState[item.id];
                        const isExpanded = expandedEvidence[item.id];
                        return (
                          <Card key={item.id}>
                            <CardContent className="space-y-3 p-4">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="text-sm font-semibold text-foreground">
                                    {item.type.replace(/_/g, " ")}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{item.source}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant={state?.reviewed ? "success" : "secondary"}>
                                    {state?.reviewed ? "Reviewed" : "Unreviewed"}
                                  </Badge>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => toggleEvidenceReviewed(item.id)}
                                  >
                                    {state?.reviewed ? "Mark unreviewed" : "Mark reviewed"}
                                  </Button>
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {formatTimestamp(item.timestamp)}
                              </p>
                              <div className="rounded-md border border-border/70 bg-muted/20 p-3">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-medium text-foreground">Evidence details</p>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      setExpandedEvidence((prev) => ({
                                        ...prev,
                                        [item.id]: !prev[item.id],
                                      }))
                                    }
                                  >
                                    {isExpanded ? "Hide" : "Show"}
                                  </Button>
                                </div>
                                {isExpanded ? (
                                  <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                                    {JSON.stringify(item.details, null, 2)}
                                  </pre>
                                ) : (
                                  <p className="mt-2 text-xs text-muted-foreground">
                                    {typeof item.details === "string" ? item.details.slice(0, 120) : "Expand to view details"}
                                  </p>
                                )}
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  Add note
                                </label>
                                <textarea
                                  value={state?.note ?? ""}
                                  onChange={(event) => updateEvidenceNote(item.id, event.target.value)}
                                  onBlur={(event) => commitEvidenceNote(item.id, event.target.value)}
                                  placeholder="Add verifier note"
                                  className="min-h-[72px] w-full rounded-md border border-border/70 bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                                />
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                      {evidenceItems.length > 200 && visibleEvidenceItems.length < evidenceItems.length && (
                        <div className="flex justify-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setVisibleEvidenceCount((prev) => prev + 50)}
                          >
                            Load more evidence
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}

            {planLoading && selectedCase && (
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-20 w-full" />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="hidden h-full lg:block">{renderAuditPanel()}</div>
      </div>
    </div>
  );
}

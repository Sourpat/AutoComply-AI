/**
 * Case Details Drawer - Shows case header, submission snapshot, and timeline.
 * Step 2.0: Workflow Status Transitions + Audit Log Timeline
 */

import { useState, useEffect, useCallback } from "react";
import type { AuditEvent, AuditAction } from "../types/audit";
import {
  fetchVerifierCaseDetail,
  fetchVerifierCaseEvents,
  fetchVerifierCaseSubmission,
  fetchVerifierCaseAttachments,
  downloadVerifierAttachment,
  type VerifierCase,
  type VerifierCaseEvent,
} from "../api/verifierCasesClient";
import { Timeline } from "./Timeline";
import { getStatusLabel, getStatusColor, type WorkflowStatus } from "../workflow/statusTransitions";
import { ragDetailsUrl } from "../lib/ragLink";
import { formatAgeShort, getAgeMs } from "../workflow/sla";

interface CaseDetailsDrawerProps {
  caseId: string | null;
  refreshToken?: number;
  onClose: () => void;
}

type DrawerCase = {
  id: string;
  title: string;
  subtitle?: string | null;
  status: WorkflowStatus;
  priority: "High" | "Medium" | "Low";
  priorityColor: string;
  age: string;
  submissionId?: string | null;
  traceId?: string | null;
};

function normalizeStatus(status?: string | null): WorkflowStatus {
  switch (status) {
    case "approved":
      return "approved";
    case "rejected":
    case "blocked":
      return "blocked";
    case "needs_info":
    case "request_info":
      return "request_info";
    case "in_review":
    case "needs_review":
      return "needs_review";
    case "new":
    case "submitted":
      return "submitted";
    default:
      return "needs_review";
  }
}

function buildDrawerCase(caseRow: VerifierCase): DrawerCase {
  const createdAt = caseRow.created_at || new Date().toISOString();
  const title = caseRow.submission_summary?.submitter_name || caseRow.summary || `Case ${caseRow.case_id}`;
  return {
    id: caseRow.case_id,
    title,
    subtitle: caseRow.summary || null,
    status: normalizeStatus(caseRow.status),
    priority: "Medium",
    priorityColor: "text-slate-600",
    age: formatAgeShort(getAgeMs(createdAt)),
    submissionId: caseRow.submission_id,
    traceId: caseRow.submission_id,
  };
}

function parsePayload(payload?: string | null): Record<string, any> | null {
  if (!payload) return null;
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

function mapEventAction(eventType: string, payload: Record<string, any> | null): AuditAction {
  if (eventType === "assigned") return "ASSIGNED";
  if (eventType === "unassigned") return "UNASSIGNED";
  if (eventType === "note") return "NOTE_ADDED";
  if (eventType === "decision") {
    const decisionType = payload?.decision?.type || payload?.decision?.status || payload?.decision_type;
    if (decisionType === "approve" || payload?.status === "approved") return "APPROVED";
    if (decisionType === "reject" || payload?.status === "rejected") return "BLOCKED";
    if (decisionType === "request_info" || payload?.status === "needs_info") return "REQUEST_INFO";
  }
  if (eventType === "action") {
    const action = payload?.action || payload?.status;
    if (action === "approve" || action === "approved") return "APPROVED";
    if (action === "reject" || action === "rejected") return "BLOCKED";
    if (action === "needs_review" || action === "in_review") return "NEEDS_REVIEW";
  }
  return "NEEDS_REVIEW";
}

function mapVerifierEvent(event: VerifierCaseEvent, submissionId?: string | null): AuditEvent {
  const payload = parsePayload(event.payload_json);
  const action = mapEventAction(event.event_type, payload);
  const actorName = payload?.actor || payload?.decision?.actor || "Verifier";
  const message = payload?.reason || payload?.note || payload?.message || null;
  return {
    id: event.id,
    caseId: event.case_id,
    submissionId: submissionId || undefined,
    actorRole: "verifier",
    actorName,
    action,
    message: message || undefined,
    createdAt: event.created_at,
  };
}

export function CaseDetailsDrawer({ caseId, refreshToken, onClose }: CaseDetailsDrawerProps) {
  const [caseItem, setCaseItem] = useState<DrawerCase | null>(null);
  const [submission, setSubmission] = useState<any | null>(null);
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentsError, setAttachmentsError] = useState<string | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);

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

  useEffect(() => {
    if (!caseId) return;
    let isActive = true;

    setSubmission(null);
    setSubmissionError(null);
    setSubmissionLoading(false);
    setAttachments([]);
    setAttachmentsError(null);
    setAttachmentsLoading(false);

    const loadDetail = async () => {
      try {
        const detail = await fetchVerifierCaseDetail(caseId);
        if (!isActive) return;
        const nextCase = buildDrawerCase(detail.case);
        setCaseItem(nextCase);

        const events = await fetchVerifierCaseEvents(caseId);
        if (!isActive) return;
        setAuditEvents((events || []).map((evt) => mapVerifierEvent(evt, detail.case.submission_id)));

        if (!detail.case.submission_id) {
          setSubmission(null);
          setSubmissionError(null);
          setSubmissionLoading(false);
          setAttachments([]);
          setAttachmentsError(null);
          setAttachmentsLoading(false);
          return;
        }

        setSubmissionLoading(true);
        setSubmissionError(null);
        try {
          const submissionDetail = await fetchVerifierCaseSubmission(caseId);
          if (!isActive) return;
          setSubmission(submissionDetail || null);
        } catch (err) {
          console.warn("[CaseDetailsDrawer] Failed to load submission:", err);
          if (isActive) {
            setSubmissionError(err instanceof Error ? err.message : "Failed to load submission");
            setSubmission(null);
          }
        } finally {
          if (isActive) setSubmissionLoading(false);
        }

        setAttachmentsLoading(true);
        setAttachmentsError(null);
        try {
          const items = await fetchVerifierCaseAttachments(caseId);
          if (!isActive) return;
          setAttachments(items || []);
        } catch (err) {
          console.warn("[CaseDetailsDrawer] Failed to load attachments:", err);
          if (isActive) {
            setAttachmentsError(err instanceof Error ? err.message : "Failed to load attachments");
            setAttachments([]);
          }
        } finally {
          if (isActive) setAttachmentsLoading(false);
        }
      } catch (err) {
        console.warn("[CaseDetailsDrawer] Failed to load case detail:", err);
        if (isActive) {
          setCaseItem(null);
          setAuditEvents([]);
          setSubmission(null);
          setSubmissionError(err instanceof Error ? err.message : "Failed to load submission");
          setSubmissionLoading(false);
          setAttachments([]);
          setAttachmentsError(err instanceof Error ? err.message : "Failed to load attachments");
          setAttachmentsLoading(false);
        }
      }
    };

    loadDetail();

    return () => {
      isActive = false;
    };
  }, [caseId, refreshToken]);

  if (!caseId) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl z-50 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                {caseItem?.title || "Case Details"}
              </h2>
              {caseItem?.subtitle && (
                <p className="text-sm text-slate-600">{caseItem.subtitle}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
              title="Close"
            >
              ×
            </button>
          </div>

          {/* Status Badge */}
          {caseItem && (
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(
                  caseItem.status
                )}`}
              >
                {getStatusLabel(caseItem.status)}
              </span>
              <span className="text-xs text-slate-500">
                Priority: <span className={caseItem.priorityColor}>{caseItem.priority}</span>
              </span>
              <span className="text-xs text-slate-500">
                {caseItem.age}
              </span>
            </div>
          )}

          {/* Submission Snapshot */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900">Submission Details</h3>
              {caseItem?.submissionId && (
                <span className="text-xs text-slate-500">{caseItem.submissionId}</span>
              )}
            </div>
            {!caseItem?.submissionId && (
              <p className="text-xs text-slate-500">No submission linked.</p>
            )}
            {caseItem?.submissionId && submissionLoading && (
              <p className="text-xs text-slate-500">Loading submission…</p>
            )}
            {caseItem?.submissionId && submissionError && (
              <p className="text-xs text-red-600">{submissionError}</p>
            )}
            {caseItem?.submissionId && submission && !submissionLoading && (
              <div className="space-y-2 text-sm">
                {(submission.payload as any)?.practitionerName && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Practitioner:</span>
                    <span className="text-slate-900 font-medium">
                      {(submission.payload as any).practitionerName}
                    </span>
                  </div>
                )}
                {(submission.payload as any)?.facilityName && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Facility:</span>
                    <span className="text-slate-900 font-medium">
                      {(submission.payload as any).facilityName}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-600">Type:</span>
                  <span className="text-slate-900 font-medium">
                    {submission.csf_type === "csf_practitioner"
                      ? "Practitioner CSF"
                      : submission.csf_type === "csf_facility"
                      ? "Hospital CSF"
                      : submission.csf_type || "Submission"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Submitted:</span>
                  <span className="text-slate-900">
                    {new Date(submission.created_at || submission.submittedAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {(submission.payload as any)?.npi && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">NPI:</span>
                    <span className="text-slate-900 font-mono">{(submission.payload as any).npi}</span>
                  </div>
                )}
                {(submission.payload as any)?.dea && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">DEA:</span>
                    <span className="text-slate-900 font-mono">{(submission.payload as any).dea}</span>
                  </div>
                )}
                <div>
                  <div className="font-semibold text-slate-700">Attachments</div>
                  {attachmentsLoading && (
                    <p className="text-xs text-slate-500">Loading attachments…</p>
                  )}
                  {attachmentsError && (
                    <p className="text-xs text-red-600">{attachmentsError}</p>
                  )}
                  {!attachmentsLoading && !attachmentsError && attachments.length === 0 && (
                    <p className="text-xs text-slate-500">No attachments.</p>
                  )}
                  {!attachmentsLoading && attachments.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {attachments.map((item: any) => (
                        <li key={item.attachment_id} className="rounded border border-slate-100 bg-white p-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-semibold text-slate-700">
                                {item.filename || "Attachment"}
                              </div>
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

          {/* Timeline */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Case Timeline
            </h3>
            {auditEvents.length > 0 ? (
              <Timeline events={auditEvents} />
            ) : (
              <div className="text-sm text-slate-500 italic py-4">
                No timeline events available
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <a
              href={
                caseItem?.submissionId
                  ? ragDetailsUrl(caseItem.submissionId, { autoload: true })
                  : `/console/rag?mode=connected&traceId=${caseItem?.traceId}`
              }
              className="flex-1 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 text-center"
            >
              Open in RAG Explorer
            </a>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

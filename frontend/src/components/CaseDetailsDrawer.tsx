/**
 * Case Details Drawer - Shows case header, submission snapshot, and timeline.
 * Step 2.0: Workflow Status Transitions + Audit Log Timeline
 */

import { useState, useEffect } from "react";
import type { WorkQueueItem, Submission } from "../types/workQueue";
import type { AuditEvent } from "../types/audit";
import { demoStore } from "../lib/demoStore";
import { Timeline } from "./Timeline";
import { getStatusLabel, getStatusColor } from "../workflow/statusTransitions";
import { ragDetailsUrl } from "../lib/ragLink";

interface CaseDetailsDrawerProps {
  caseId: string | null;
  onClose: () => void;
}

export function CaseDetailsDrawer({ caseId, onClose }: CaseDetailsDrawerProps) {
  const [caseItem, setCaseItem] = useState<WorkQueueItem | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);

  useEffect(() => {
    if (!caseId) return;

    // Load case data
    const workQueue = demoStore.getWorkQueue();
    const item = workQueue.find((i) => i.id === caseId);
    setCaseItem(item || null);

    // Load submission
    if (item?.submissionId) {
      const sub = demoStore.getSubmission(item.submissionId);
      setSubmission(sub);
    }

    // Load audit events
    const events = demoStore.getAuditEvents(caseId);
    setAuditEvents(events);
  }, [caseId]);

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
          {submission && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">
                Submission Details
              </h3>
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
                    {submission.kind === "csf_practitioner" ? "Practitioner CSF" : submission.kind === "csf_facility" ? "Hospital CSF" : submission.kind}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Submitted:</span>
                  <span className="text-slate-900">
                    {new Date(submission.submittedAt).toLocaleString("en-US", {
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
              </div>
            </div>
          )}

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

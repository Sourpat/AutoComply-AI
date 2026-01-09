/**
 * CaseDetailsPanel - Right pane showing case details with tabs
 * 
 * Tabs: Summary, Submission, Playbook, Explainability, Timeline, Notes, Attachments
 * Step 2.4: Case Details Workspace
 * Step 2.6: Reviewer Playbooks
 * Step 2.8: Submission Tab Integration
 * 
 * ============================================================================
 * MANUAL VERIFICATION CHECKLIST:
 * ============================================================================
 * [ ] Open any case with submissionId in Console
 * [ ] Verify "Submission" tab is visible in navigation
 * [ ] Click Submission tab - displays submitted form data
 * [ ] Verify basic info: ID, timestamp, decision type, submitter
 * [ ] Verify form data table shows all key/value pairs
 * [ ] Verify evaluator output section (if available)
 * [ ] Verify raw payload JSON is collapsible
 * [ ] Test Evidence tab - shows attached evidence
 * [ ] Test Playbook tab - loads CSF Practitioner playbook
 * [ ] Test Explainability tab - connects to RAG with case context
 * ============================================================================
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { demoStore } from "../../lib/demoStore";
import { notesStore, type CaseNote } from "../../lib/notesStore";
import { attachmentsStore, type CaseAttachment } from "../../lib/attachmentsStore";
import type { WorkQueueItem as DemoWorkQueueItem } from "../../types/workQueue";
import { Timeline } from "../../components/Timeline";
import { canTransition, getAllowedTransitions, type WorkflowStatus } from "../../workflow/statusTransitions";
import { buildDecisionPacket } from "../../utils/buildDecisionPacket";
import { downloadJson } from "../../utils/exportPacket";
import { DEMO_VERIFIERS, getCurrentDemoUser } from "../../demo/users";
import { formatAgeShort, formatDue, getSlaStatusColor, isOverdue, getAgeMs } from "../../workflow/sla";
import { useRole } from "../../context/RoleContext";
import { PlaybookPanel } from "./PlaybookPanel";
import { getSubmission } from "../../submissions/submissionStore";
import type { SubmissionRecord } from "../../submissions/submissionTypes";
import { isAdmin as checkIsAdmin, getAuthHeaders } from "../../lib/authHeaders";
import { workflowHealth, getCaseAdherence, listAudit, type CaseAdherence, type AuditEvent as ApiAuditEvent, type PaginatedAuditEventsResponse } from "../../api/workflowApi";
import type { AuditEvent } from "../../types/audit";
import { 
  listScheduledExports, 
  createScheduledExport, 
  patchScheduledExport, 
  deleteScheduledExport, 
  runNow,
  type ScheduledExport 
} from "../../api/scheduledExportsApi";
import { API_BASE } from "../../lib/api";

// Helper to convert API audit events to local format
function mapApiAuditEvent(apiEvent: ApiAuditEvent): AuditEvent {
  return {
    id: apiEvent.id,
    caseId: apiEvent.caseId,
    actorName: apiEvent.actor,
    actorRole: apiEvent.source as any,
    action: apiEvent.eventType as any,
    message: apiEvent.message,
    createdAt: apiEvent.createdAt,
    meta: apiEvent.meta,
  };
}

type TabType = "summary" | "submission" | "playbook" | "workbench" | "explainability" | "timeline" | "notes" | "attachments";

interface CaseDetailsPanelProps {
  caseId: string;
  onCaseUpdate?: () => void;
}

export const CaseDetailsPanel: React.FC<CaseDetailsPanelProps> = ({ caseId, onCaseUpdate }) => {
  const navigate = useNavigate();
  const { role } = useRole();
  const [activeTab, setActiveTab] = useState<TabType>("summary");
  const [caseItem, setCaseItem] = useState<DemoWorkQueueItem | null>(null);
  const [submissionRecord, setSubmissionRecord] = useState<SubmissionRecord | null>(null);
  const [notes, setNotes] = useState<CaseNote[]>([]);
  const [attachments, setAttachments] = useState<CaseAttachment[]>([]);
  const [newNoteBody, setNewNoteBody] = useState("");
  const [newAttachmentName, setNewAttachmentName] = useState("");
  const [requestInfoMessage, setRequestInfoMessage] = useState("");
  const [showRequestInfoModal, setShowRequestInfoModal] = useState(false);
  const [assignMenuOpen, setAssignMenuOpen] = useState(false);
  const [isApiMode, setIsApiMode] = useState(false);
  const [exportingJson, setExportingJson] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [adherence, setAdherence] = useState<CaseAdherence | null>(null);
  const [adherenceLoading, setAdherenceLoading] = useState(false);
  const [adherenceError, setAdherenceError] = useState<string | null>(null);
  
  // Scheduled exports state
  const [scheduledExports, setScheduledExports] = useState<ScheduledExport[]>([]);
  const [exportsLoading, setExportsLoading] = useState(false);
  const [showExportForm, setShowExportForm] = useState(false);
  const [exportFormData, setExportFormData] = useState({
    name: '',
    schedule: 'DAILY' as 'DAILY' | 'WEEKLY',
    hour: 9,
    minute: 0,
    export_type: 'both' as 'pdf' | 'json' | 'both',
  });
  
  // Timeline pagination state
  const [timelineLimit, setTimelineLimit] = useState(50);
  const [apiAuditEvents, setApiAuditEvents] = useState<AuditEvent[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditLoading, setAuditLoading] = useState(false);

  const currentUser = getCurrentDemoUser(role);
  const isVerifier = role === "verifier";
  const isAdminRole = role === "admin";
  const hasAdminAccess = checkIsAdmin(); // Check actual admin_unlocked state

  // Check if API mode is available
  useEffect(() => {
    const checkApiMode = async () => {
      try {
        const result = await Promise.race([
          workflowHealth(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 2000)
          ),
        ]);
        setIsApiMode(result?.ok === true);
      } catch {
        setIsApiMode(false);
      }
    };
    checkApiMode();
  }, []);

  // Load case data
  useEffect(() => {
    const item = demoStore.getWorkQueue().find((i) => i.id === caseId);
    setCaseItem(item || null);
    
    if (item) {
      setNotes(notesStore.getNotesByCaseId(caseId));
      setAttachments(attachmentsStore.getAttachmentsByCaseId(caseId));
      
      // Load submission record if available
      if (item.submissionId) {
        const submission = getSubmission(item.submissionId);
        setSubmissionRecord(submission || null);
      }
    }
  }, [caseId]);

  // Load adherence data when Workbench tab is active
  useEffect(() => {
    if (activeTab === 'workbench' && isApiMode) {
      loadAdherence();
      loadScheduledExports();
    }
  }, [activeTab, caseId, isApiMode]);

  const loadAdherence = async () => {
    setAdherenceLoading(true);
    setAdherenceError(null);
    try {
      const data = await getCaseAdherence(caseId);
      setAdherence(data);
    } catch (err) {
      console.error('Failed to load adherence:', err);
      setAdherenceError(err instanceof Error ? err.message : 'Failed to load adherence');
    } finally {
      setAdherenceLoading(false);
    }
  };

  const loadScheduledExports = async () => {
    setExportsLoading(true);
    try {
      const allExports = await listScheduledExports();
      // Filter to exports for this case
      const caseExports = allExports.filter(
        (exp) => exp.mode === 'case' && exp.target_id === caseId
      );
      setScheduledExports(caseExports);
    } catch (err) {
      console.error('Failed to load scheduled exports:', err);
    } finally {
      setExportsLoading(false);
    }
  };

  // Load audit events from API
  const loadAuditEvents = async (limit: number) => {
    if (!isApiMode) return;
    
    setAuditLoading(true);
    try {
      const response = await listAudit(caseId, limit, 0);
      const mappedEvents = response.items.map(mapApiAuditEvent);
      setApiAuditEvents(mappedEvents);
      setAuditTotal(response.total);
    } catch (err) {
      console.error('Failed to load audit events:', err);
    } finally {
      setAuditLoading(false);
    }
  };

  // Load audit events when Timeline tab is active
  useEffect(() => {
    if (activeTab === 'timeline' && isApiMode) {
      loadAuditEvents(timelineLimit);
    }
  }, [activeTab, caseId, timelineLimit, isApiMode]);

  const handleCreateExport = async () => {
    if (!exportFormData.name.trim()) {
      alert('Please enter a name for the export');
      return;
    }

    try {
      await createScheduledExport({
        name: exportFormData.name,
        schedule: exportFormData.schedule,
        hour: exportFormData.hour,
        minute: exportFormData.minute,
        mode: 'case',
        target_id: caseId,
        export_type: exportFormData.export_type,
      });

      // Reset form and reload
      setShowExportForm(false);
      setExportFormData({
        name: '',
        schedule: 'DAILY',
        hour: 9,
        minute: 0,
        export_type: 'both',
      });
      await loadScheduledExports();
      alert('Scheduled export created successfully!');
    } catch (err) {
      console.error('Failed to create export:', err);
      alert('Failed to create scheduled export');
    }
  };

  const handleToggleExport = async (exportId: string, currentEnabled: number) => {
    try {
      await patchScheduledExport(exportId, {
        is_enabled: currentEnabled === 1 ? false : true,
      });
      await loadScheduledExports();
    } catch (err) {
      console.error('Failed to toggle export:', err);
      alert('Failed to update export');
    }
  };

  const handleDeleteExport = async (exportId: string, exportName: string) => {
    if (!confirm(`Delete scheduled export "${exportName}"?`)) return;

    try {
      await deleteScheduledExport(exportId);
      await loadScheduledExports();
      alert('Export deleted successfully!');
    } catch (err) {
      console.error('Failed to delete export:', err);
      alert('Failed to delete export');
    }
  };

  const handleRunNow = async (exportId: string, exportName: string) => {
    if (!confirm(`Run export "${exportName}" now?`)) return;

    try {
      await runNow(exportId);
      alert('Export triggered successfully! Files will be saved to backend/app/data/exports/');
    } catch (err) {
      console.error('Failed to run export:', err);
      alert('Failed to run export');
    }
  };

  if (!caseItem) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-500">Case not found</p>
      </div>
    );
  }

  const overdueStatus = isOverdue(caseItem.dueAt);
  const slaColor = getSlaStatusColor(caseItem.dueAt);
  const age = formatAgeShort(getAgeMs(caseItem.createdAt));
  
  // Use API audit events if in API mode, otherwise fall back to demoStore
  const allAuditEvents = isApiMode ? apiAuditEvents : demoStore.getAuditEvents(caseId);
  const auditEvents = allAuditEvents;
  const hasMoreAuditEvents = isApiMode ? auditEvents.length < auditTotal : false;
  const submission = caseItem.submissionId ? demoStore.getSubmissions().find(s => s.id === caseItem.submissionId) : null;

  // Action handlers
  const handleStatusChange = (newStatus: WorkflowStatus, auditMeta?: any) => {
    if (!canTransition(caseItem.status as WorkflowStatus, newStatus, role)) {
      alert(`Cannot transition from ${caseItem.status} to ${newStatus}`);
      return;
    }

    demoStore.updateWorkQueueItem(caseId, { status: newStatus });

    // Update linked submission
    if (caseItem.submissionId) {
      const submissions = demoStore.getSubmissions();
      const subIndex = submissions.findIndex((s) => s.id === caseItem.submissionId);
      if (subIndex !== -1) {
        submissions[subIndex].status = newStatus;
        demoStore.saveSubmissions(submissions);
      }
    }

    // Log audit event
    const actionMap: Record<string, string> = {
      approved: "APPROVED",
      blocked: "BLOCKED",
      needs_review: "NEEDS_REVIEW",
      request_info: "REQUEST_INFO",
    };

    demoStore.addAuditEvent({
      caseId,
      action: actionMap[newStatus] as any,
      actorName: currentUser?.name || "Unknown",
      actorRole: role as any,
      meta: auditMeta || {
        oldStatus: caseItem.status,
        newStatus,
      },
    });

    setCaseItem({ ...caseItem, status: newStatus });
    onCaseUpdate?.();
  };

  const handleAssign = (userId: string, userName: string) => {
    demoStore.assignWorkQueueItem(caseId, { id: userId, name: userName }, currentUser?.name || "Admin");
    const updatedItem = demoStore.getWorkQueue().find((i) => i.id === caseId);
    setCaseItem(updatedItem || null);
    setAssignMenuOpen(false);
    onCaseUpdate?.();
  };

  const handleUnassign = () => {
    demoStore.unassignWorkQueueItem(caseId, currentUser?.name || "Admin");
    const updatedItem = demoStore.getWorkQueue().find((i) => i.id === caseId);
    setCaseItem(updatedItem || null);
    setAssignMenuOpen(false);
    onCaseUpdate?.();
  };

  const handleRequestInfo = () => {
    if (!requestInfoMessage.trim()) return;

    handleStatusChange("request_info");
    demoStore.addAuditEvent({
      caseId,
      action: "REQUEST_INFO",
      actorName: currentUser?.name || "Unknown",
      actorRole: role as any,
      message: requestInfoMessage,
    });

    setShowRequestInfoModal(false);
    setRequestInfoMessage("");
  };

  const handleExportJson = async () => {
    if (!hasAdminAccess || !isApiMode) return;
    
    setExportingJson(true);
    try {
      const response = await fetch(`${API_BASE}/workflow/cases/${caseId}/export/json`, {
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Export failed: ${response.status} - ${errorText}`);
      }
      
      const bundle = await response.json();
      
      // Download as JSON file
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `case_${caseId}_export.json`;
      document.body.appendChild(a);
      a.click();
      if (a.parentNode === document.body) {
        document.body.removeChild(a);
      }
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export JSON failed:', error);
      alert(`Failed to export JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setExportingJson(false);
    }
  };

  const handleExportPdf = async () => {
    if (!hasAdminAccess || !isApiMode) return;
    
    setExportingPdf(true);
    try {
      const response = await fetch(`${API_BASE}/workflow/cases/${caseId}/export/pdf`, {
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Export failed: ${response.status} - ${errorText}`);
      }
      
      const blob = await response.blob();
      
      // Download as PDF file
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `case_${caseId}_packet.pdf`;
      document.body.appendChild(a);
      a.click();
      if (a.parentNode === document.body) {
        document.body.removeChild(a);
      }
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export PDF failed:', error);
      alert(`Failed to export PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportPacket = () => {
    if (!submission) return;

    const packet = buildDecisionPacket({
      submission,
      caseId: caseItem.id,
      sourceType: 'work_queue',
    });

    downloadJson(packet);
  };

  const handleOpenInRAG = () => {
    const params = new URLSearchParams();
    params.set("mode", "connected");
    params.set("caseId", caseId);
    params.set("autoload", "1"); // Auto-trigger explain on load
    if (caseItem.traceId) {
      params.set("traceId", caseItem.traceId);
    }
    navigate(`/console/rag?${params.toString()}`);
  };

  const handleAddNote = () => {
    if (!newNoteBody.trim()) return;

    notesStore.addNote(caseId, newNoteBody, currentUser?.name || "Unknown", role);
    setNotes(notesStore.getNotesByCaseId(caseId));
    setNewNoteBody("");
  };

  const handleDeleteNote = (noteId: string) => {
    notesStore.deleteNote(noteId);
    setNotes(notesStore.getNotesByCaseId(caseId));
  };

  const handleAddAttachment = () => {
    if (!newAttachmentName.trim()) return;

    attachmentsStore.addAttachment(caseId, newAttachmentName, currentUser?.name || "Unknown");
    setAttachments(attachmentsStore.getAttachmentsByCaseId(caseId));
    setNewAttachmentName("");
  };

  const handleDeleteAttachment = (attachmentId: string) => {
    attachmentsStore.deleteAttachment(attachmentId);
    setAttachments(attachmentsStore.getAttachmentsByCaseId(caseId));
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200">
      {/* Header */}
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-slate-900">{caseItem.title}</h2>
        <p className="text-sm text-slate-600 mt-1">{caseItem.subtitle}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 border-b border-slate-200">
        {(["summary", "submission", "playbook", "workbench", "explainability", "timeline", "notes", "attachments"] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-sky-600 text-sky-600"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Summary Tab */}
        {activeTab === "summary" && (
          <div className="space-y-6">
            {/* Case Header Info */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
              <div>
                <label className="text-xs font-medium text-slate-500">Status</label>
                <p className={`text-sm font-semibold mt-1 ${
                  caseItem.status === "approved" ? "text-green-700" :
                  caseItem.status === "blocked" ? "text-red-700" :
                  caseItem.status === "needs_review" ? "text-amber-700" :
                  caseItem.status === "request_info" ? "text-purple-700" :
                  "text-slate-700"
                }`}>
                  {caseItem.status.replace("_", " ").toUpperCase()}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Priority</label>
                <p className={`text-sm font-semibold mt-1 ${
                  caseItem.priority === "high" ? "text-red-700" :
                  caseItem.priority === "medium" ? "text-amber-700" :
                  "text-slate-700"
                }`}>
                  {caseItem.priority.toUpperCase()}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Assigned To</label>
                <p className="text-sm font-semibold mt-1">
                  {caseItem.assignedTo?.name || "Unassigned"}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">SLA</label>
                <p className={`text-sm font-semibold mt-1 ${slaColor}`}>
                  {overdueStatus && "⚠️ "}
                  {formatDue(caseItem.dueAt)}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Age</label>
                <p className="text-sm font-semibold mt-1">{age}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Case ID</label>
                <p className="text-sm font-mono mt-1">{caseItem.id}</p>
              </div>
            </div>

            {/* Actions Strip */}
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Actions</h3>
              <div className="flex flex-wrap gap-2">
                {/* Status Actions */}
                {getAllowedTransitions(caseItem.status as WorkflowStatus, role).map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
                      status === "approved"
                        ? "bg-green-600 text-white hover:bg-green-700"
                        : status === "blocked"
                        ? "bg-red-600 text-white hover:bg-red-700"
                        : status === "needs_review"
                        ? "bg-amber-600 text-white hover:bg-amber-700"
                        : "bg-purple-600 text-white hover:bg-purple-700"
                    }`}
                  >
                    {status === "approved" ? "✓ Approve" :
                     status === "blocked" ? "⛔ Block" :
                     status === "needs_review" ? "⚠️ Needs Review" :
                     "📝 Request Info"}
                  </button>
                ))}

                {/* Assign - Admin only for reassignment */}
                {(isVerifier || isAdminRole) && (
                  <div className="relative group">
                    <button
                      onClick={() => hasAdminAccess && setAssignMenuOpen(!assignMenuOpen)}
                      disabled={!hasAdminAccess}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${
                        hasAdminAccess
                          ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                          : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                      }`}
                      title={!hasAdminAccess ? "Admin access required" : ""}
                    >
                      👤 Assign
                    </button>
                    {!hasAdminAccess && (
                      <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-30 w-48">
                        <div className="bg-slate-800 text-white text-xs px-2 py-1 rounded shadow-lg">
                          Admin access required
                        </div>
                      </div>
                    )}
                    {assignMenuOpen && hasAdminAccess && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setAssignMenuOpen(false)} />
                        <div className="absolute left-0 top-full mt-1 z-20 w-48 rounded-lg border border-slate-200 bg-white shadow-lg py-1">
                          <button
                            onClick={handleUnassign}
                            className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                          >
                            Unassigned
                          </button>
                          {DEMO_VERIFIERS.map((user) => (
                            <button
                              key={user.id}
                              onClick={() => handleAssign(user.id, user.name)}
                              className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                            >
                              {user.name}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Export Packet - Admin only */}
                <div className="relative group">
                  <button
                    onClick={hasAdminAccess ? handleExportPacket : undefined}
                    disabled={!hasAdminAccess}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${
                      hasAdminAccess
                        ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                    }`}
                    title={!hasAdminAccess ? "Admin access required" : ""}
                  >
                    📦 Export Packet
                  </button>
                  {!hasAdminAccess && (
                    <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-30 w-48">
                      <div className="bg-slate-800 text-white text-xs px-2 py-1 rounded shadow-lg">
                        Admin access required
                      </div>
                    </div>
                  )}
                </div>

                {/* Open in RAG Explorer */}
                <button
                  onClick={handleOpenInRAG}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100"
                >
                  🔍 Open in RAG Explorer
                </button>
              </div>
            </div>

            {/* Submission Snapshot */}
            {submission && (
              <div className="border-t border-slate-200 pt-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Submission Snapshot</h3>
                <div className="p-4 bg-slate-50 rounded-lg space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-500">Submission ID</label>
                      <p className="font-mono text-xs mt-0.5">{submission.id}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500">Type</label>
                      <p className="text-xs mt-0.5">{submission.csfType || submission.kind}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500">Submitted</label>
                      <p className="text-xs mt-0.5">{new Date(submission.submittedAt).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Submission Tab */}
        {activeTab === "submission" && (
          <div className="space-y-6">
            {submissionRecord ? (
              <>
                {/* Submission Header */}
                <div className="border-b border-slate-200 pb-4">
                  <h3 className="text-lg font-semibold text-slate-900">Submission Details</h3>
                  <p className="text-sm text-slate-600 mt-1">Original submission data for this case</p>
                </div>

                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                  <div>
                    <label className="text-xs font-medium text-slate-500">Submission ID</label>
                    <p className="text-sm font-mono mt-1">{submissionRecord.id}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">Submitted At</label>
                    <p className="text-sm mt-1">{new Date(submissionRecord.createdAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">Decision Type</label>
                    <p className="text-sm mt-1">{submissionRecord.decisionType.replace(/_/g, ' ').toUpperCase()}</p>
                  </div>
                  {submissionRecord.submittedBy && (
                    <div>
                      <label className="text-xs font-medium text-slate-500">Submitted By</label>
                      <p className="text-sm mt-1">
                        {submissionRecord.submittedBy.name || submissionRecord.submittedBy.email || 'Unknown'}
                      </p>
                    </div>
                  )}
                  {submissionRecord.evaluatorOutput?.status && (
                    <div>
                      <label className="text-xs font-medium text-slate-500">Evaluator Status</label>
                      <p className={`text-sm font-semibold mt-1 ${
                        submissionRecord.evaluatorOutput.status === 'approved' ? 'text-green-700' :
                        submissionRecord.evaluatorOutput.status === 'blocked' ? 'text-red-700' :
                        'text-amber-700'
                      }`}>
                        {submissionRecord.evaluatorOutput.status.toUpperCase()}
                      </p>
                    </div>
                  )}
                  {submissionRecord.evaluatorOutput?.riskLevel && (
                    <div>
                      <label className="text-xs font-medium text-slate-500">Risk Level</label>
                      <p className={`text-sm font-semibold mt-1 ${
                        submissionRecord.evaluatorOutput.riskLevel === 'high' ? 'text-red-700' :
                        submissionRecord.evaluatorOutput.riskLevel === 'medium' ? 'text-amber-700' :
                        'text-green-700'
                      }`}>
                        {submissionRecord.evaluatorOutput.riskLevel.toUpperCase()}
                      </p>
                    </div>
                  )}
                </div>

                {/* Form Data */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-3">Form Data</h4>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Field</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {Object.entries(submissionRecord.formData).map(([key, value]) => (
                          <tr key={key} className="hover:bg-slate-50">
                            <td className="px-4 py-2 text-xs font-medium text-slate-700 whitespace-nowrap">
                              {key.replace(/_/g, ' ')}
                            </td>
                            <td className="px-4 py-2 text-xs text-slate-900">
                              {typeof value === 'object' && value !== null
                                ? JSON.stringify(value)
                                : String(value || '—')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Evaluator Output */}
                {submissionRecord.evaluatorOutput && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-3">Evaluator Output</h4>
                    <div className="p-4 bg-slate-50 rounded-lg space-y-3 text-sm">
                      {submissionRecord.evaluatorOutput.explanation && (
                        <div>
                          <label className="text-xs font-medium text-slate-500">Explanation</label>
                          <p className="text-xs mt-1">{submissionRecord.evaluatorOutput.explanation}</p>
                        </div>
                      )}
                      {submissionRecord.evaluatorOutput.confidence !== undefined && (
                        <div>
                          <label className="text-xs font-medium text-slate-500">Confidence</label>
                          <p className="text-xs mt-1">{submissionRecord.evaluatorOutput.confidence}%</p>
                        </div>
                      )}
                      {submissionRecord.evaluatorOutput.traceId && (
                        <div>
                          <label className="text-xs font-medium text-slate-500">Trace ID</label>
                          <p className="text-xs font-mono mt-1">{submissionRecord.evaluatorOutput.traceId}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Raw Payload (Collapsible) */}
                {submissionRecord.rawPayload && (
                  <details className="border border-slate-200 rounded-lg">
                    <summary className="px-4 py-3 cursor-pointer bg-slate-50 hover:bg-slate-100 text-sm font-medium text-slate-700">
                      Raw Payload JSON
                    </summary>
                    <div className="p-4 border-t border-slate-200">
                      <pre className="text-xs bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto">
                        {JSON.stringify(submissionRecord.rawPayload, null, 2)}
                      </pre>
                    </div>
                  </details>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-slate-500 text-sm">No submission data available for this case</p>
              </div>
            )}
          </div>
        )}

        {/* Playbook Tab */}
        {activeTab === "playbook" && (
          <PlaybookPanel
            caseItem={caseItem}
            onRequestInfo={(template) => {
              setRequestInfoMessage(template);
              setShowRequestInfoModal(true);
            }}
            onStatusChange={(newStatus, note, meta) => {
              handleStatusChange(newStatus as WorkflowStatus, meta);
              if (note && currentUser) {
                notesStore.addNote(caseId, note, currentUser.name, role);
                setNotes(notesStore.getNotesByCaseId(caseId));
              }
              onCaseUpdate?.();
            }}
            onAddNote={(note) => {
              setNewNoteBody(note);
              setActiveTab("notes");
            }}
          />
        )}

        {/* Workbench Tab */}
        {activeTab === "workbench" && (
          <div className="space-y-6">
            {/* Adherence Panel */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                Playbook Adherence
              </h3>

              {!isApiMode && (
                <div className="text-center py-8 text-slate-500">
                  <p className="mb-2">Workbench features require API mode</p>
                  <p className="text-sm">Start the backend server to enable adherence tracking</p>
                </div>
              )}

              {isApiMode && adherenceLoading && (
                <div className="text-center py-8">
                  <p className="text-slate-600">Loading adherence metrics...</p>
                </div>
              )}

              {isApiMode && adherenceError && (
                <div className="text-center py-8">
                  <p className="text-red-600 mb-2">Failed to load adherence</p>
                  <p className="text-sm text-slate-600">{adherenceError}</p>
                  <button
                    onClick={loadAdherence}
                    className="mt-4 px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-sm"
                  >
                    Retry
                  </button>
                </div>
              )}

              {isApiMode && adherence && !adherenceLoading && !adherenceError && (
                <div className="space-y-6">
                  {/* Adherence Badge */}
                  <div className="flex items-center gap-4">
                    <div className={`inline-flex items-center px-4 py-2 rounded-full text-lg font-semibold ${
                      adherence.adherencePct >= 80 ? 'bg-green-100 text-green-800' :
                      adherence.adherencePct >= 50 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {adherence.adherencePct}% Complete
                    </div>
                    <div className="text-sm text-slate-600">
                      {adherence.completedSteps.length} of {adherence.totalSteps} steps completed
                    </div>
                  </div>

                  {/* Steps Grid */}
                  <div className="grid grid-cols-2 gap-6">
                    {/* Completed Steps */}
                    <div>
                      <h4 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
                        <span className="text-green-600">✓</span>
                        Completed Steps ({adherence.completedSteps.length})
                      </h4>
                      <div className="space-y-2">
                        {adherence.completedSteps.length === 0 ? (
                          <p className="text-sm text-slate-500 italic">No steps completed yet</p>
                        ) : (
                          adherence.completedSteps.map((step) => (
                            <div key={step.id} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                              <div className="font-medium text-sm text-slate-900">{step.title}</div>
                              <div className="text-xs text-slate-600 mt-1">{step.description}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Missing Steps */}
                    <div>
                      <h4 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
                        <span className="text-slate-400">○</span>
                        Missing Steps ({adherence.missingSteps.length})
                      </h4>
                      <div className="space-y-2">
                        {adherence.missingSteps.length === 0 ? (
                          <p className="text-sm text-green-600 italic">All steps completed!</p>
                        ) : (
                          adherence.missingSteps.map((step) => (
                            <div key={step.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                              <div className="font-medium text-sm text-slate-900">{step.title}</div>
                              <div className="text-xs text-slate-600 mt-1">{step.description}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Recommended Actions */}
                  {adherence.recommendedNextActions.length > 0 && (
                    <div className="mt-6 p-4 bg-sky-50 border border-sky-200 rounded-lg">
                      <h4 className="font-medium text-slate-900 mb-3">
                        🎯 Recommended Next Actions
                      </h4>
                      <div className="space-y-3">
                        {adherence.recommendedNextActions.map((rec, idx) => (
                          <div key={idx} className="flex items-start gap-3">
                            <div className="flex-1">
                              <div className="font-medium text-sm text-slate-900">{rec.stepTitle}</div>
                              <div className="text-sm text-slate-600 mt-1">{rec.suggestedAction}</div>
                            </div>
                            <div className="flex gap-2">
                              {rec.stepId.includes('evidence') && (
                                <button
                                  onClick={() => {
                                    setActiveTab('summary');
                                    // Evidence drawer is in summary tab
                                  }}
                                  className="px-3 py-1 text-xs font-medium bg-sky-600 text-white rounded-md hover:bg-sky-700"
                                >
                                  Open Evidence
                                </button>
                              )}
                              {rec.stepId.includes('request_info') && (
                                <button
                                  onClick={() => {
                                    setShowRequestInfoModal(true);
                                  }}
                                  className="px-3 py-1 text-xs font-medium bg-sky-600 text-white rounded-md hover:bg-sky-700"
                                >
                                  Request Info
                                </button>
                              )}
                              {rec.stepId.includes('status') && (
                                <button
                                  onClick={() => {
                                    // Scroll to status section in summary tab
                                    setActiveTab('summary');
                                  }}
                                  className="px-3 py-1 text-xs font-medium bg-sky-600 text-white rounded-md hover:bg-sky-700"
                                >
                                  Update Status
                                </button>
                              )}
                              {rec.stepId.includes('note') && (
                                <button
                                  onClick={() => {
                                    setActiveTab('notes');
                                  }}
                                  className="px-3 py-1 text-xs font-medium bg-sky-600 text-white rounded-md hover:bg-sky-700"
                                >
                                  Add Note
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Message if no playbook */}
                  {adherence.message && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">{adherence.message}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Scheduled Exports Section */}
              <div className="border-t border-slate-200 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">📅 Scheduled Exports</h3>
                  {role === 'admin' && (
                    <button
                      onClick={() => setShowExportForm(!showExportForm)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-sky-600 text-white hover:bg-sky-700"
                    >
                      {showExportForm ? 'Cancel' : '+ New Export'}
                    </button>
                  )}
                </div>

                {/* Admin-only form */}
                {role === 'admin' && showExportForm && (
                  <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <h4 className="text-sm font-semibold text-slate-900 mb-4">Create Scheduled Export</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-medium text-slate-700 block mb-1">Export Name</label>
                        <input
                          type="text"
                          value={exportFormData.name}
                          onChange={(e) => setExportFormData({ ...exportFormData, name: e.target.value })}
                          placeholder="e.g., Daily Case Report"
                          className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium text-slate-700 block mb-1">Schedule</label>
                          <select
                            value={exportFormData.schedule}
                            onChange={(e) => setExportFormData({ ...exportFormData, schedule: e.target.value as 'DAILY' | 'WEEKLY' })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                          >
                            <option value="DAILY">Daily</option>
                            <option value="WEEKLY">Weekly</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-slate-700 block mb-1">Time (HH:MM)</label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min="0"
                              max="23"
                              value={exportFormData.hour}
                              onChange={(e) => setExportFormData({ ...exportFormData, hour: parseInt(e.target.value) || 0 })}
                              className="w-20 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                            <span className="self-center text-slate-600">:</span>
                            <input
                              type="number"
                              min="0"
                              max="59"
                              value={exportFormData.minute}
                              onChange={(e) => setExportFormData({ ...exportFormData, minute: parseInt(e.target.value) || 0 })}
                              className="w-20 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-slate-700 block mb-2">Export Type</label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="radio"
                              name="export_type"
                              value="pdf"
                              checked={exportFormData.export_type === 'pdf'}
                              onChange={(e) => setExportFormData({ ...exportFormData, export_type: e.target.value as 'pdf' | 'json' | 'both' })}
                              className="text-sky-600 focus:ring-sky-500"
                            />
                            <span>PDF</span>
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="radio"
                              name="export_type"
                              value="json"
                              checked={exportFormData.export_type === 'json'}
                              onChange={(e) => setExportFormData({ ...exportFormData, export_type: e.target.value as 'pdf' | 'json' | 'both' })}
                              className="text-sky-600 focus:ring-sky-500"
                            />
                            <span>JSON</span>
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="radio"
                              name="export_type"
                              value="both"
                              checked={exportFormData.export_type === 'both'}
                              onChange={(e) => setExportFormData({ ...exportFormData, export_type: e.target.value as 'pdf' | 'json' | 'both' })}
                              className="text-sky-600 focus:ring-sky-500"
                            />
                            <span>Both</span>
                          </label>
                        </div>
                      </div>

                      <button
                        onClick={handleCreateExport}
                        className="w-full px-4 py-2 text-sm font-medium rounded-lg bg-sky-600 text-white hover:bg-sky-700"
                      >
                        Create Scheduled Export
                      </button>
                    </div>
                  </div>
                )}

                {/* Verifier helper message */}
                {role !== 'admin' && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-700">
                      ℹ️ Admin access required to create and manage scheduled exports.
                    </p>
                  </div>
                )}

                {/* Exports list */}
                {exportsLoading ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-slate-500">Loading scheduled exports...</p>
                  </div>
                ) : scheduledExports.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-500">No scheduled exports for this case yet.</p>
                    {role === 'admin' && (
                      <p className="text-xs text-slate-400 mt-2">Click "+ New Export" to create one.</p>
                    )}
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Schedule</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Next Run</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                          {role === 'admin' && (
                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {scheduledExports.map((exp) => (
                          <tr key={exp.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-sm font-medium text-slate-900">{exp.name}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">
                              {exp.schedule} at {String(exp.hour).padStart(2, '0')}:{String(exp.minute).padStart(2, '0')}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600">
                              {exp.next_run_at ? new Date(exp.next_run_at).toLocaleString() : '—'}
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-md font-medium uppercase">
                                {exp.export_type}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {role === 'admin' ? (
                                <button
                                  onClick={() => handleToggleExport(exp.id, exp.is_enabled)}
                                  className={`px-2 py-1 rounded-md font-medium uppercase ${
                                    exp.is_enabled === 1
                                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                      : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                  }`}
                                >
                                  {exp.is_enabled === 1 ? 'Enabled' : 'Disabled'}
                                </button>
                              ) : (
                                <span className={`px-2 py-1 rounded-md font-medium uppercase ${
                                  exp.is_enabled === 1 ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'
                                }`}>
                                  {exp.is_enabled === 1 ? 'Enabled' : 'Disabled'}
                                </span>
                              )}
                            </td>
                            {role === 'admin' && (
                              <td className="px-4 py-3 text-right text-sm space-x-2">
                                <button
                                  onClick={() => handleRunNow(exp.id, exp.name)}
                                  className="px-2 py-1 text-xs font-medium bg-sky-600 text-white rounded-md hover:bg-sky-700"
                                >
                                  ▶️ Run Now
                                </button>
                                <button
                                  onClick={() => handleDeleteExport(exp.id, exp.name)}
                                  className="px-2 py-1 text-xs font-medium bg-red-600 text-white rounded-md hover:bg-red-700"
                                >
                                  🗑️ Delete
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Explainability Tab */}
        {activeTab === "explainability" && (
          <div className="text-center py-8">
            <p className="text-sm text-slate-600 mb-4">
              Explainability features are available in RAG Explorer (connected mode)
            </p>
            <button
              onClick={handleOpenInRAG}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-sky-600 text-white hover:bg-sky-700"
            >
              🔍 Open in RAG Explorer
            </button>
          </div>
        )}

        {/* Timeline Tab */}
        {activeTab === "timeline" && (
          <div className="space-y-4">
            {auditLoading && auditEvents.length === 0 ? (
              <div className="text-center text-sm text-slate-500 py-8">
                Loading timeline...
              </div>
            ) : (
              <Timeline events={auditEvents} />
            )}
            
            {/* Load More Button */}
            {hasMoreAuditEvents && !auditLoading && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={() => setTimelineLimit(prev => prev + 50)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  📜 Load older events ({auditTotal - auditEvents.length} more)
                </button>
              </div>
            )}
            
            {!hasMoreAuditEvents && auditEvents.length > 0 && !auditLoading && (
              <div className="text-center text-sm text-slate-500 italic pt-4">
                All {auditEvents.length} events loaded
              </div>
            )}
          </div>
        )}

        {/* Notes Tab */}
        {activeTab === "notes" && (
          <div className="space-y-4">
            {/* Add Note */}
            <div className="border border-slate-200 rounded-lg p-4">
              <label className="text-sm font-medium text-slate-900 block mb-2">Add Internal Note</label>
              <textarea
                value={newNoteBody}
                onChange={(e) => setNewNoteBody(e.target.value)}
                placeholder="Enter your note here..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-500"
                rows={3}
              />
              <button
                onClick={handleAddNote}
                disabled={!newNoteBody.trim()}
                className="mt-2 px-4 py-2 text-sm font-medium rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Note
              </button>
            </div>

            {/* Notes List */}
            <div className="space-y-3">
              {notes.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No notes yet</p>
              ) : (
                notes.map((note) => (
                  <div key={note.id} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-semibold text-slate-900">{note.authorName}</span>
                          <span className="text-xs text-slate-500">({note.authorRole})</span>
                          <span className="text-xs text-slate-400">
                            {new Date(note.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.body}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="ml-2 text-xs text-red-600 hover:text-red-800"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Attachments Tab */}
        {activeTab === "attachments" && (
          <div className="space-y-4">
            {/* Export Actions */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">Export Case Packet</h3>
              <div className="flex gap-2">
                {/* Export JSON */}
                <div className="relative group">
                  <button
                    onClick={hasAdminAccess && isApiMode ? handleExportJson : undefined}
                    disabled={!hasAdminAccess || !isApiMode || exportingJson}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border flex items-center gap-1.5 ${
                      hasAdminAccess && isApiMode && !exportingJson
                        ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
                        : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                    }`}
                    title={!hasAdminAccess ? "Admin access required" : !isApiMode ? "Export available in API mode" : ""}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {exportingJson ? 'Exporting...' : 'Export JSON'}
                  </button>
                  {(!hasAdminAccess || !isApiMode) && (
                    <div className="absolute right-0 bottom-full mb-1 hidden group-hover:block z-30 w-48">
                      <div className="bg-slate-800 text-white text-xs px-2 py-1 rounded shadow-lg">
                        {!hasAdminAccess ? 'Admin access required' : 'Export available in API mode'}
                      </div>
                    </div>
                  )}
                </div>

                {/* Export PDF */}
                <div className="relative group">
                  <button
                    onClick={hasAdminAccess && isApiMode ? handleExportPdf : undefined}
                    disabled={!hasAdminAccess || !isApiMode || exportingPdf}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border flex items-center gap-1.5 ${
                      hasAdminAccess && isApiMode && !exportingPdf
                        ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                        : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                    }`}
                    title={!hasAdminAccess ? "Admin access required" : !isApiMode ? "Export available in API mode" : ""}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    {exportingPdf ? 'Exporting...' : 'Export PDF'}
                  </button>
                  {(!hasAdminAccess || !isApiMode) && (
                    <div className="absolute right-0 bottom-full mb-1 hidden group-hover:block z-30 w-48">
                      <div className="bg-slate-800 text-white text-xs px-2 py-1 rounded shadow-lg">
                        {!hasAdminAccess ? 'Admin access required' : 'Export available in API mode'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Demo Notice */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                📎 <strong>Demo Mode:</strong> Attachments are metadata-only in this build. No actual file uploads.
              </p>
            </div>

            {/* Add Attachment */}
            <div className="border border-slate-200 rounded-lg p-4">
              <label className="text-sm font-medium text-slate-900 block mb-2">Add Attachment (Demo)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAttachmentName}
                  onChange={(e) => setNewAttachmentName(e.target.value)}
                  placeholder="Filename (e.g., license-verification.pdf)"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <button
                  onClick={handleAddAttachment}
                  disabled={!newAttachmentName.trim()}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Attachments List */}
            <div className="space-y-2">
              {attachments.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No attachments</p>
              ) : (
                attachments.map((att) => (
                  <div key={att.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">📄</span>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{att.filename}</p>
                        <p className="text-xs text-slate-500">
                          Uploaded by {att.uploadedBy} • {new Date(att.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteAttachment(att.id)}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Request Info Modal */}
      {showRequestInfoModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowRequestInfoModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Request Missing Information</h3>
              <textarea
                value={requestInfoMessage}
                onChange={(e) => setRequestInfoMessage(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                rows={5}
                placeholder="Describe the missing information needed..."
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleRequestInfo}
                  className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
                >
                  Send Request
                </button>
                <button
                  onClick={() => {
                    setShowRequestInfoModal(false);
                    setRequestInfoMessage("");
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

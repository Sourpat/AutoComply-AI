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
import { IntelligencePanel } from "../intelligence/IntelligencePanel";
import { ConfidenceBadge } from "../intelligence/ConfidenceBadge";
import { ConfidenceHistoryPanel } from "../intelligence/ConfidenceHistoryPanel";
import { resolveDecisionType } from "../../utils/decisionType";
import { getCaseIntelligence } from "../../api/intelligenceApi";
import { getCachedIntelligence } from "../../utils/intelligenceCache";
import { buildFieldIssueMap, getFieldIssues, getTopFieldIssue } from "../../utils/mapFieldIssues";
import { FieldIssueBadge } from "../submission/FieldIssueBadge";
import { 
  workflowHealth, 
  getCaseAdherence, 
  listAudit, 
  addAudit, 
  getCase,
  getCaseSubmission,
  makeCaseDecision,
  assignCase,
  unassignCase,
  setCaseStatus,
  getCaseEvents,
  requestCaseInfo,
  type CaseEvent,
  type CaseAdherence, 
  type AuditEvent as ApiAuditEvent, 
  type PaginatedAuditEventsResponse,
  type CaseRecord
} from "../../api/workflowApi";
import { listAttachments, uploadAttachment, deleteAttachment, redactAttachment, getAttachmentDownloadUrl, type AttachmentItem } from "../../api/attachmentsApi";
import type { AuditEvent } from "../../types/audit";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { safeString, safeUpperCase, safeReplace } from "../../utils/stringUtils";
import { 
  listScheduledExports, 
  createScheduledExport, 
  patchScheduledExport, 
  deleteScheduledExport, 
  runNow,
  type ScheduledExport 
} from "../../api/scheduledExportsApi";
import { API_BASE } from "../../lib/api";
import { safeFormatDate, safeFormatRelative } from "../../utils/dateUtils";

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

type TabType = "summary" | "submission" | "playbook" | "workbench" | "explainability" | "timeline" | "notes" | "attachments" | "history";

interface CaseDetailsPanelProps {
  caseId: string;
  onCaseUpdate?: () => void;
}

export const CaseDetailsPanel: React.FC<CaseDetailsPanelProps> = ({ caseId, onCaseUpdate }) => {
  const navigate = useNavigate();
  const { role } = useRole();
  const [activeTab, setActiveTab] = useState<TabType>("summary");
  const [caseItem, setCaseItem] = useState<DemoWorkQueueItem | null>(null);
  const [caseRecord, setCaseRecord] = useState<CaseRecord | null>(null);
  const [loadingCase, setLoadingCase] = useState(true);
  const [caseError, setCaseError] = useState<string | null>(null);
  const [submissionRecord, setSubmissionRecord] = useState<SubmissionRecord | null>(null);
  const [notes, setNotes] = useState<CaseNote[]>([]);
  const [attachments, setAttachments] = useState<CaseAttachment[]>([]);
  const [apiAttachments, setApiAttachments] = useState<AttachmentItem[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentsUploading, setAttachmentsUploading] = useState(false);
  const [attachmentDescription, setAttachmentDescription] = useState("");
  const [attachmentsToast, setAttachmentsToast] = useState<string | null>(null);
  const [attachmentsError, setAttachmentsError] = useState<string | null>(null);
  const [attachmentAction, setAttachmentAction] = useState<'delete' | 'redact' | null>(null);
  const [attachmentActionTarget, setAttachmentActionTarget] = useState<AttachmentItem | null>(null);
  const [attachmentActionReason, setAttachmentActionReason] = useState('');
  const [newNoteBody, setNewNoteBody] = useState("");
  const [newAttachmentName, setNewAttachmentName] = useState("");
  const [requestInfoMessage, setRequestInfoMessage] = useState("");
  const [showRequestInfoModal, setShowRequestInfoModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);
  const [decisionToast, setDecisionToast] = useState<string | null>(null);
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
  
  // Phase 3.1: Case events state
  const [caseEvents, setCaseEvents] = useState<CaseEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);

  // Phase 7.3: Intelligence state
  const [intelligenceData, setIntelligenceData] = useState<{
    confidence_score: number;
    confidence_band: 'high' | 'medium' | 'low';
    explanation_factors: Array<{ factor: string; impact: string }>;
    field_checks_total?: number;
    field_checks_passed?: number;
    field_issues?: Array<{
      field: string;
      severity: 'critical' | 'medium' | 'low';
      check?: string;
      message: string;
    }>;
  } | null>(null);

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

  useEffect(() => {
    if (!decisionToast) return;
    const timeoutId = window.setTimeout(() => setDecisionToast(null), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [decisionToast]);

  useEffect(() => {
    if (!attachmentsToast) return;
    const timeoutId = window.setTimeout(() => setAttachmentsToast(null), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [attachmentsToast]);

  // Load case data from API
  useEffect(() => {
    const loadCase = async () => {
      setLoadingCase(true);
      setCaseError(null);
      
      try {
        // Try API first if available
        if (isApiMode) {
          const apiCase = await getCase(caseId);
          
          // Map CaseRecord to WorkQueueItem format for compatibility
          const mappedItem: DemoWorkQueueItem = {
            id: apiCase.id,
            submissionId: apiCase.submissionId || undefined,
            title: apiCase.title,
            subtitle: apiCase.summary || '',
            status: apiCase.status as any,
            priority: 'medium' as const,
            assignedTo: apiCase.assignedTo ? { id: apiCase.assignedTo, name: apiCase.assignedTo } : undefined,
            createdAt: apiCase.createdAt,
            dueAt: apiCase.dueAt || undefined,
            reason: '',
          };
          
          setCaseRecord(apiCase);
          setCaseItem(mappedItem);
          
          // Load submission if linked
          if (apiCase.submissionId) {
            try {
              const submission = await getCaseSubmission(caseId);
              setSubmissionRecord(submission);
            } catch (err) {
              console.warn('Could not load submission:', err);
              // Continue even if submission fails
            }
          }
        } else {
          // Fallback to demo store
          const item = demoStore.getWorkQueue().find((i) => i.id === caseId);
          if (!item) {
            throw new Error('Case not found in demo store');
          }
          setCaseItem(item);
          
          if (item.submissionId) {
            const submission = getSubmission(item.submissionId);
            setSubmissionRecord(submission || null);
          }
        }
        
        // Load notes and attachments (always from local store for now)
        setNotes(notesStore.getNotesByCaseId(caseId));
        setAttachments(attachmentsStore.getAttachmentsByCaseId(caseId));
        
      } catch (err) {
        console.error('Failed to load case:', err);
        setCaseError(err instanceof Error ? err.message : 'Failed to load case');
      } finally {
        setLoadingCase(false);
      }
    };
    
    loadCase();
  }, [caseId, isApiMode]);

  // Phase 7.3: Load intelligence for header badge
  useEffect(() => {
    if (caseRecord && isApiMode && !isDemoCase) {
      loadIntelligenceHeader();
    }
  }, [caseRecord, submissionRecord, isApiMode, caseId]);

  // Check if current case is a demo case
  const isDemoCase = caseId.startsWith('demo-');

  // Load adherence data when Workbench tab is active
  useEffect(() => {
    // Only load from API if backend is available AND not viewing a demo case
    if (activeTab === 'workbench' && isApiMode && !isDemoCase) {
      loadAdherence();
      loadScheduledExports();
    }
  }, [activeTab, caseId, isApiMode, isDemoCase]);

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

  // Load audit events from API or generate demo events
  const loadAuditEvents = async (limit: number) => {
    if (!isApiMode) {
      if (!caseItem) return;
      
      // Generate demo timeline events from case history
      const demoEvents: AuditEvent[] = [];
      let eventId = 1;
      
      // Case created event
      demoEvents.push({
        id: `demo-${eventId++}`,
        caseId: caseId,
        actorName: 'System',
        actorRole: 'verifier',
        action: 'SUBMITTED',
        message: `Case created from submission ${caseItem.submissionId || 'N/A'}`,
        createdAt: caseItem.createdAt,
      });
      
      // Case assigned event (if assigned)
      if (caseItem.assignedTo) {
        const assignedDate = new Date(new Date(caseItem.createdAt).getTime() + 5 * 60 * 1000); // 5 min after creation
        const assignedToName = typeof caseItem.assignedTo === 'string' ? caseItem.assignedTo : caseItem.assignedTo.name;
        demoEvents.push({
          id: `demo-${eventId++}`,
          caseId: caseId,
          actorName: assignedToName,
          actorRole: 'verifier',
          action: 'ASSIGNED',
          message: `Case assigned to ${assignedToName}`,
          createdAt: assignedDate.toISOString(),
        });
      }
      
      // Status changes based on current status
      if (caseItem.status === 'approved' || caseItem.status === 'request_info') {
        const statusDate = new Date(new Date(caseItem.createdAt).getTime() + 2 * 60 * 60 * 1000); // 2 hours after
        const assignedToName = typeof caseItem.assignedTo === 'string' ? caseItem.assignedTo : (caseItem.assignedTo?.name || 'Verifier');
        const action = caseItem.status === 'approved' ? 'APPROVED' : 'REQUEST_INFO';
        demoEvents.push({
          id: `demo-${eventId++}`,
          caseId: caseId,
          actorName: assignedToName,
          actorRole: 'verifier',
          action: action,
          message: `Status changed to ${caseItem.status}`,
          createdAt: statusDate.toISOString(),
        });
      }
      
      // Add note events from notesStore
      notes.forEach((note, idx) => {
        demoEvents.push({
          id: `demo-${eventId++}`,
          caseId: caseId,
          actorName: note.authorName,
          actorRole: 'verifier',
          action: 'NOTE_ADDED',
          message: `${note.body.substring(0, 100)}${note.body.length > 100 ? '...' : ''}`,
          createdAt: note.createdAt,
        });
      });
      
      // Add attachment events from attachmentsStore (treat as notes)
      attachments.forEach((att, idx) => {
        demoEvents.push({
          id: `demo-${eventId++}`,
          caseId: caseId,
          actorName: att.uploadedBy,
          actorRole: 'verifier',
          action: 'NOTE_ADDED',
          message: `📎 Attached file: ${att.filename}`,
          createdAt: new Date().toISOString(), // Attachments don't have uploadedAt
        });
      });
      
      // Sort events by date (newest first)
      demoEvents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setApiAuditEvents(demoEvents.slice(0, limit));
      setAuditTotal(demoEvents.length);
      return;
    }
    
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

  // Phase 3.1: Load case events from backend
  const loadCaseEvents = async () => {
    setEventsLoading(true);
    setEventsError(null);
    
    try {
      const events = await getCaseEvents(caseId);
      setCaseEvents(events);
      console.log('[CaseDetailsPanel] Loaded case events:', events.length);
    } catch (err) {
      console.error('[CaseDetailsPanel] Failed to load case events:', err);
      setEventsError(err instanceof Error ? err.message : 'Failed to load timeline');
      setCaseEvents([]);
    } finally {
      setEventsLoading(false);
    }
  };

  // Phase 7.3: Load intelligence for header badge
  const loadIntelligenceHeader = async () => {
    if (!caseRecord) return;
    
    try {
      const decisionType = resolveDecisionType(caseRecord, submissionRecord?.csfType || submissionRecord?.kind);
      
      // Check cache first
      const cached = getCachedIntelligence(caseId, decisionType);
      if (cached) {
        setIntelligenceData({
          confidence_score: cached.confidence_score,
          confidence_band: cached.confidence_band,
          explanation_factors: cached.explanation_factors,
        });
        return;
      }
      
      // Fetch from API
      const data = await getCaseIntelligence(caseId, decisionType);
      setIntelligenceData({
        confidence_score: data.confidence_score,
        confidence_band: data.confidence_band,
        explanation_factors: data.explanation_factors,
      });
    } catch (err) {
      // Silently fail for header badge - full panel will show errors
      console.log('[CaseDetailsPanel] Intelligence header not available:', err);
    }
  };

  const loadAttachments = async () => {
    setAttachmentsLoading(true);
    setAttachmentsError(null);
    try {
      const items = await listAttachments(caseId);
      setApiAttachments(items);
    } catch (err) {
      console.error('[CaseDetailsPanel] Failed to load attachments:', err);
      setApiAttachments([]);
      setAttachmentsError(err instanceof Error ? err.message : 'Failed to load attachments');
    } finally {
      setAttachmentsLoading(false);
    }
  };

  const handleAttachmentUpload = async (file: File) => {
    if (!file) return;
    if (caseRecord?.status === 'cancelled' || isResolved) {
      setAttachmentsError('Cannot upload attachments for resolved or cancelled cases');
      return;
    }
    setAttachmentsUploading(true);
    setAttachmentsError(null);
    try {
      await uploadAttachment(caseId, file, {
        submissionId: caseItem?.submissionId || undefined,
        uploadedBy: currentUser?.name,
        description: attachmentDescription.trim() || undefined,
      });
      setAttachmentDescription("");
      setAttachmentsToast("Attachment uploaded");
      await loadAttachments();
      if (activeTab === 'timeline') {
        loadCaseEvents();
      }
      // Phase 7.5: Refresh intelligence after evidence upload
      loadIntelligenceHeader();
    } catch (err) {
      console.error('[CaseDetailsPanel] Failed to upload attachment:', err);
      setAttachmentsError(err instanceof Error ? err.message : 'Failed to upload attachment');
    } finally {
      setAttachmentsUploading(false);
    }
  };

  const handleAttachmentAction = (action: 'delete' | 'redact', attachment: AttachmentItem) => {
    setAttachmentAction(action);
    setAttachmentActionTarget(attachment);
    setAttachmentActionReason('');
  };

  const submitAttachmentAction = async () => {
    if (!attachmentAction || !attachmentActionTarget) return;
    if (!attachmentActionReason.trim()) {
      setAttachmentsError('Reason is required');
      return;
    }

    try {
      if (attachmentAction === 'delete') {
        await deleteAttachment(caseId, attachmentActionTarget.id, attachmentActionReason.trim());
        setApiAttachments((prev) => prev.filter((item) => item.id !== attachmentActionTarget.id));
        setAttachmentsToast('Attachment removed');
      } else {
        await redactAttachment(caseId, attachmentActionTarget.id, attachmentActionReason.trim());
        setApiAttachments((prev) =>
          prev.map((item) =>
            item.id === attachmentActionTarget.id
              ? {
                  ...item,
                  isRedacted: 1,
                  redactedAt: new Date().toISOString(),
                  redactedBy: currentUser?.name || null,
                  redactReason: attachmentActionReason.trim(),
                }
              : item
          )
        );
        setAttachmentsToast('Attachment redacted');
      }

      await loadAttachments();
      if (activeTab === 'timeline') {
        loadCaseEvents();
      }
    } catch (err) {
      console.error('[CaseDetailsPanel] Attachment action failed:', err);
      setAttachmentsError(err instanceof Error ? err.message : 'Attachment action failed');
    } finally {
      setAttachmentAction(null);
      setAttachmentActionTarget(null);
      setAttachmentActionReason('');
    }
  };

  // Load audit events and case events when Timeline tab is active
  useEffect(() => {
    if (activeTab === 'timeline') {
      loadAuditEvents(timelineLimit);
      loadCaseEvents(); // Phase 3.1: Load real case events
    }
  }, [activeTab, caseId, timelineLimit, isApiMode, notes, attachments]);

  // Phase 7.5: Auto-refresh intelligence when decision_intelligence_updated event detected
  useEffect(() => {
    if (!caseEvents || caseEvents.length === 0) return;
    
    // Check if latest event is decision_intelligence_updated
    const latestEvent = caseEvents[0];
    if (latestEvent?.eventType === 'decision_intelligence_updated') {
      console.log('[CaseDetailsPanel] Intelligence updated event detected, refreshing header badge');
      loadIntelligenceHeader();
    }
  }, [caseEvents]);

  useEffect(() => {
    if (activeTab === 'attachments') {
      loadAttachments();
    }
  }, [activeTab, caseId]);

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

  if (loadingCase) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mx-auto mb-4"></div>
          <p className="text-slate-500">Loading case...</p>
        </div>
      </div>
    );
  }

  if (caseError || !caseItem) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Case Not Found</h3>
          <p className="text-slate-500 mb-4">{caseError || 'The requested case could not be loaded.'}</p>
          <div className="bg-slate-50 rounded-lg p-3 mb-4 text-xs text-left">
            <div className="font-mono text-slate-600">
              <div>Case ID: {caseId}</div>
              <div>API Mode: {isApiMode ? 'Yes' : 'No'}</div>
              <div>API Base: {API_BASE}</div>
            </div>
          </div>
          <button
            onClick={() => navigate('/console/cases')}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors"
          >
            ← Back to Cases
          </button>
        </div>
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
  const isResolved = caseRecord?.status === 'approved' || caseRecord?.status === 'blocked' || caseRecord?.status === 'closed';

  // Action handlers
  const handleStatusChange = async (newStatus: WorkflowStatus, auditMeta?: any) => {
    // Block if cancelled
    if (caseRecord?.status === 'cancelled') {
      alert('Cannot change status of cancelled case (submission was deleted)');
      return;
    }

    if (isResolved) {
      alert('This case is already resolved');
      return;
    }
    
    if (!canTransition(caseItem?.status as WorkflowStatus || 'new', newStatus, role)) {
      alert(`Cannot transition from ${caseItem?.status} to ${newStatus}`);
      return;
    }

    // Phase 3.1: Call real API
    try {
      const updated = await setCaseStatus(caseId, newStatus);
      
      // Update local state
      setCaseRecord(updated);
      if (caseItem) {
        setCaseItem({ ...caseItem, status: newStatus });
      }
      
      // Also update demo store for backward compatibility
      demoStore.updateWorkQueueItem(caseId, { status: newStatus });
      
      // Update linked submission
      if (caseItem?.submissionId) {
        const submissions = demoStore.getSubmissions();
        const subIndex = submissions.findIndex((s) => s.id === caseItem.submissionId);
        if (subIndex !== -1) {
          submissions[subIndex].status = newStatus;
          demoStore.saveSubmissions(submissions);
        }
      }
      
      // Phase 7.5: Refresh intelligence after status change
      loadIntelligenceHeader();
      
      // Log audit event (legacy support)
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
          oldStatus: caseItem?.status,
          newStatus,
        },
      });
      
      // Dispatch data-changed event for cross-view sync
      window.dispatchEvent(new CustomEvent('acai:data-changed', {
        detail: { type: 'case', action: 'status_change', id: caseId }
      }));
      
      onCaseUpdate?.();
    } catch (error) {
      console.error('[CaseDetailsPanel] Failed to change status:', error);
      alert(error instanceof Error ? error.message : 'Failed to change status');
    }
  };

  const handleDecision = async (decision: 'APPROVED' | 'REJECTED') => {
    if (caseRecord?.status === 'cancelled') {
      alert('Cannot decide a cancelled case');
      return;
    }
    if (isResolved) {
      alert('This case is already resolved');
      return;
    }
    if (decision === 'REJECTED' && !rejectReason.trim()) {
      alert('Reject reason is required');
      return;
    }

    setDecisionSubmitting(true);
    try {
      await makeCaseDecision(caseId, {
        decision,
        reason: decision === 'REJECTED' ? rejectReason.trim() : undefined,
        decidedByRole: role,
        decidedByName: currentUser?.name,
      });

      const updated = await getCase(caseId);
      setCaseRecord(updated);
      if (caseItem) {
        setCaseItem({ ...caseItem, status: updated.status as any });
      }

      demoStore.updateWorkQueueItem(caseId, { status: updated.status as any });

      if (caseItem?.submissionId) {
        const submissions = demoStore.getSubmissions();
        const subIndex = submissions.findIndex((s) => s.id === caseItem.submissionId);
        if (subIndex !== -1) {
          submissions[subIndex].status = updated.status as any;
          demoStore.saveSubmissions(submissions);
        }
      }

      setDecisionToast(decision === 'APPROVED' ? 'Case approved' : 'Case rejected');
      setShowRejectModal(false);
      setRejectReason('');

      if (activeTab === 'timeline') {
        loadCaseEvents();
      }

      window.dispatchEvent(new CustomEvent('acai:data-changed', {
        detail: { type: 'case', action: 'decision', id: caseId }
      }));

      onCaseUpdate?.();
    } catch (error) {
      console.error('[CaseDetailsPanel] Failed to make decision:', error);
      alert(error instanceof Error ? error.message : 'Failed to make decision');
    } finally {
      setDecisionSubmitting(false);
    }
  };

  const handleAssign = async (userId: string, userName: string) => {
    // Block if cancelled
    if (caseRecord?.status === 'cancelled') {
      alert('Cannot assign cancelled case (submission was deleted)');
      setAssignMenuOpen(false);
      return;
    }
    
    // Phase 3.1: Call real API
    try {
      const updated = await assignCase(caseId, userName);
      
      // Update local state
      setCaseRecord(updated);
      if (caseItem) {
        setCaseItem({ ...caseItem, assignedTo: { id: userId, name: userName } });
      }
      
      // Also update demo store for backward compatibility
      demoStore.assignWorkQueueItem(caseId, { id: userId, name: userName }, currentUser?.name || "Admin");
      
      // Dispatch data-changed event
      window.dispatchEvent(new CustomEvent('acai:data-changed', {
        detail: { type: 'case', action: 'assign', id: caseId }
      }));
      
      setAssignMenuOpen(false);
      onCaseUpdate?.();
    } catch (error) {
      console.error('[CaseDetailsPanel] Failed to assign case:', error);
      alert(error instanceof Error ? error.message : 'Failed to assign case');
      setAssignMenuOpen(false);
    }
  };

  const handleUnassign = async () => {
    // Block if cancelled
    if (caseRecord?.status === 'cancelled') {
      alert('Cannot unassign cancelled case (submission was deleted)');
      setAssignMenuOpen(false);
      return;
    }
    
    // Phase 3.1: Call real API
    try {
      const updated = await unassignCase(caseId);
      
      // Update local state
      setCaseRecord(updated);
      if (caseItem) {
        setCaseItem({ ...caseItem, assignedTo: null });
      }
      
      // Also update demo store for backward compatibility
      demoStore.unassignWorkQueueItem(caseId, currentUser?.name || "Admin");
      
      // Dispatch data-changed event
      window.dispatchEvent(new CustomEvent('acai:data-changed', {
        detail: { type: 'case', action: 'unassign', id: caseId }
      }));
      
      setAssignMenuOpen(false);
      onCaseUpdate?.();
    } catch (error) {
      console.error('[CaseDetailsPanel] Failed to unassign case:', error);
      alert(error instanceof Error ? error.message : 'Failed to unassign case');
      setAssignMenuOpen(false);
    }
  };

  const handleRequestInfo = async () => {
    if (!requestInfoMessage.trim()) {
      alert('Please enter a message');
      return;
    }

    // Block if cancelled
    if (caseRecord?.status === 'cancelled') {
      alert('Cannot request info on cancelled case');
      return;
    }

    // Phase 4.1: Call real API
    try {
      const result = await requestCaseInfo(caseId, {
        message: requestInfoMessage,
        requestedBy: currentUser?.name,
      });
      
      // Update local state
      setCaseRecord(result.case);
      if (caseItem) {
        setCaseItem({ ...caseItem, status: 'needs_info' });
      }
      
      // Dispatch data-changed event
      window.dispatchEvent(new CustomEvent('acai:data-changed', {
        detail: { type: 'case', action: 'request_info', id: caseId }
      }));

      if (activeTab === 'timeline') {
        loadCaseEvents();
      }
      
      // Phase 7.5: Refresh intelligence after request info
      loadIntelligenceHeader();
      
      setShowRequestInfoModal(false);
      setRequestInfoMessage("");
      onCaseUpdate?.();
    } catch (error) {
      console.error('[CaseDetailsPanel] Failed to request info:', error);
      alert(error instanceof Error ? error.message : 'Failed to request info');
    }
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
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      
      // Cleanup with safety check
      setTimeout(() => {
        try {
          if (a.parentNode) {
            a.parentNode.removeChild(a);
          }
          URL.revokeObjectURL(url);
        } catch (e) {
          console.warn('Cleanup error (ignored):', e);
        }
      }, 100);
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
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      
      // Cleanup with safety check
      setTimeout(() => {
        try {
          if (a.parentNode) {
            a.parentNode.removeChild(a);
          }
          URL.revokeObjectURL(url);
        } catch (e) {
          console.warn('Cleanup error (ignored):', e);
        }
      }, 100);
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

  const handleAddNote = async () => {
    if (!newNoteBody.trim()) return;

    const noteBody = newNoteBody;
    notesStore.addNote(caseId, noteBody, currentUser?.name || "Unknown", role);
    setNotes(notesStore.getNotesByCaseId(caseId));
    setNewNoteBody("");

    // Add audit event when in API mode
    if (isApiMode) {
      try {
        await addAudit(caseId, {
          eventType: 'note_added',
          actor: currentUser?.name || "Unknown",
          source: role,
          message: `Added note: ${noteBody.substring(0, 50)}${noteBody.length > 50 ? '...' : ''}`,
        });
        
        // Refresh timeline if on timeline tab
        if (activeTab === 'timeline') {
          loadAuditEvents(timelineLimit);
        }
      } catch (err) {
        console.error('Failed to add audit event for note:', err);
      }
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    notesStore.deleteNote(noteId);
    setNotes(notesStore.getNotesByCaseId(caseId));

    // Add audit event when in API mode
    if (isApiMode && note) {
      try {
        await addAudit(caseId, {
          eventType: 'note_deleted',
          actor: currentUser?.name || "Unknown",
          source: role,
          message: `Deleted note: ${note.body.substring(0, 50)}${note.body.length > 50 ? '...' : ''}`,
          meta: { deletedNoteId: noteId },
        });
        
        // Refresh timeline if on timeline tab
        if (activeTab === 'timeline') {
          loadAuditEvents(timelineLimit);
        }
      } catch (err) {
        console.error('Failed to add audit event for note deletion:', err);
      }
    }
  };

  const handleAddAttachment = async () => {
    if (!newAttachmentName.trim()) return;

    const filename = newAttachmentName;
    attachmentsStore.addAttachment(caseId, filename, currentUser?.name || "Unknown");
    setAttachments(attachmentsStore.getAttachmentsByCaseId(caseId));
    setNewAttachmentName("");

    // Add audit event when in API mode
    if (isApiMode) {
      try {
        await addAudit(caseId, {
          eventType: 'attachment_added',
          actor: currentUser?.name || "Unknown",
          source: role,
          message: `Attached file: ${filename}`,
          meta: { filename },
        });
        
        // Refresh timeline if on timeline tab
        if (activeTab === 'timeline') {
          loadAuditEvents(timelineLimit);
        }
      } catch (err) {
        console.error('Failed to add audit event for attachment:', err);
      }
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    const attachment = attachments.find(a => a.id === attachmentId);
    attachmentsStore.deleteAttachment(attachmentId);
    setAttachments(attachmentsStore.getAttachmentsByCaseId(caseId));

    // Add audit event when in API mode
    if (isApiMode && attachment) {
      try {
        await addAudit(caseId, {
          eventType: 'attachment_deleted',
          actor: currentUser?.name || "Unknown",
          source: role,
          message: `Deleted attachment: ${attachment.filename}`,
          meta: { deletedAttachmentId: attachmentId, filename: attachment.filename },
        });
        
        // Refresh timeline if on timeline tab
        if (activeTab === 'timeline') {
          loadAuditEvents(timelineLimit);
        }
      } catch (err) {
        console.error('Failed to add audit event for attachment deletion:', err);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200">
      {/* Header */}
      <div className="border-b border-slate-200 px-6 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-900">{caseItem.title}</h2>
            <p className="text-sm text-slate-600 mt-1">{caseItem.subtitle}</p>
          </div>
          {/* Phase 7.3: Confidence badge in header */}
          {intelligenceData && (
            <div className="flex-shrink-0">
              <ConfidenceBadge
                score={intelligenceData.confidence_score}
                band={intelligenceData.confidence_band}
                explanationFactors={intelligenceData.explanation_factors}
                size="sm"
              />
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 border-b border-slate-200">
        {(["summary", "submission", "playbook", "workbench", "explainability", "timeline", "notes", "attachments", "history"] as TabType[]).map((tab) => (
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
                  {safeUpperCase(safeReplace(caseItem.status, "_", " "), 'PENDING')}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Priority</label>
                <p className={`text-sm font-semibold mt-1 ${
                  caseItem.priority === "high" ? "text-red-700" :
                  caseItem.priority === "medium" ? "text-amber-700" :
                  "text-slate-700"
                }`}>
                  {safeUpperCase(caseItem.priority, 'MEDIUM')}
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
              
              {/* Cancelled case warning */}
              {caseRecord?.status === 'cancelled' && (
                <div className="mb-3 p-2 bg-slate-100 border border-slate-300 rounded text-xs text-slate-700">
                  ⚠️ Case is read-only (submission was deleted)
                </div>
              )}
              
              {/* Needs info banner - Phase 4.1 */}
              {caseRecord?.status === 'needs_info' && (
                <div className="mb-3 p-3 bg-amber-50 border border-amber-300 rounded text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">⏳</span>
                    <span className="font-semibold text-amber-900">Waiting on Submitter</span>
                  </div>
                  <div className="text-amber-800">
                    Additional information has been requested. The submitter will update and resubmit.
                  </div>
                </div>
              )}

              {decisionToast && (
                <div className="mb-3 p-2 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800">
                  {decisionToast}
                </div>
              )}
              
              <div className="flex flex-wrap gap-2">
                {/* Decision Actions */}
                {isVerifier && (
                  <>
                    <button
                      onClick={() => handleDecision('APPROVED')}
                      disabled={caseRecord?.status === 'cancelled' || isResolved || decisionSubmitting}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
                        caseRecord?.status === 'cancelled' || isResolved || decisionSubmitting
                          ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                          : "bg-green-600 text-white hover:bg-green-700"
                      }`}
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => setShowRejectModal(true)}
                      disabled={caseRecord?.status === 'cancelled' || isResolved || decisionSubmitting}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
                        caseRecord?.status === 'cancelled' || isResolved || decisionSubmitting
                          ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                          : "bg-red-600 text-white hover:bg-red-700"
                      }`}
                    >
                      ✗ Reject
                    </button>
                  </>
                )}

                {/* Status Actions */}
                {getAllowedTransitions(caseItem.status as WorkflowStatus, role)
                  .filter((status) => status !== "approved" && status !== "blocked")
                  .map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    disabled={caseRecord?.status === 'cancelled' || isResolved}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
                      caseRecord?.status === 'cancelled' || isResolved
                        ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                        : status === "needs_review"
                        ? "bg-amber-600 text-white hover:bg-amber-700"
                        : "bg-purple-600 text-white hover:bg-purple-700"
                    }`}
                  >
                    {status === "needs_review" ? "⚠️ Needs Review" :
                     "📝 Request Info"}
                  </button>
                ))}

                {/* Assign - Admin only for reassignment */}
                {(isVerifier || isAdminRole) && (
                  <div className="relative group">
                    <button
                      onClick={() => hasAdminAccess && caseRecord?.status !== 'cancelled' && setAssignMenuOpen(!assignMenuOpen)}
                      disabled={!hasAdminAccess || caseRecord?.status === 'cancelled' || isResolved}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${
                        hasAdminAccess && caseRecord?.status !== 'cancelled' && !isResolved
                          ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                          : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                      }`}
                      title={caseRecord?.status === 'cancelled' ? "Cannot assign cancelled case" : isResolved ? "Cannot assign resolved case" : !hasAdminAccess ? "Admin access required" : ""}
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

                {/* Request Info - Verifier only */}
                {isVerifier && caseRecord?.status === 'in_review' && (
                  <button
                    onClick={() => setShowRequestInfoModal(true)}
                    disabled={isResolved}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${
                      isResolved
                        ? "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                        : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                    }`}
                  >
                    📝 Request Info
                  </button>
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

            {/* Decision Intelligence */}
            {caseRecord && (
              <div className="border-t border-slate-200 pt-4">
                <IntelligencePanel
                  caseId={caseId}
                  decisionType={resolveDecisionType(caseRecord, submissionRecord?.csfType || submissionRecord?.kind)}
                  onRecomputeSuccess={() => {
                    // Optionally trigger case refresh
                    onCaseUpdate?.();
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Submission Tab */}
        {activeTab === "submission" && (() => {
          // Phase 7.16: Build field issue map from intelligence data
          const fieldIssueMap = buildFieldIssueMap(intelligenceData?.field_issues);
          const hasFieldIssues = Object.keys(fieldIssueMap).length > 0;
          
          // Count issues by severity
          const issuesBySeverity = intelligenceData?.field_issues?.reduce(
            (acc, issue) => {
              acc[issue.severity] = (acc[issue.severity] || 0) + 1;
              return acc;
            },
            { critical: 0, medium: 0, low: 0 } as Record<'critical' | 'medium' | 'low', number>
          ) || { critical: 0, medium: 0, low: 0 };
          
          return (
          <ErrorBoundary
            fallback={
              <div className="text-center py-12 px-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
                  <h3 className="text-red-900 font-semibold text-sm mb-2">⚠️ Submission Tab Error</h3>
                  <p className="text-red-700 text-xs mb-4">
                    The submission tab encountered an error. This may be due to missing data or a technical issue.
                  </p>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => window.location.reload()}
                      className="px-3 py-2 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700"
                    >
                      Reload Page
                    </button>
                    <button
                      onClick={() => setActiveTab('summary')}
                      className="px-3 py-2 bg-slate-600 text-white text-xs font-medium rounded-lg hover:bg-slate-700"
                    >
                      ← Back to Summary
                    </button>
                  </div>
                </div>
              </div>
            }
          >
            <div className="space-y-6">
            {/* Phase 7.16: Field Issues Summary Strip */}
            {hasFieldIssues && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-semibold text-amber-900 mb-1">⚠ Field Validation Issues</h4>
                    <p className="text-xs text-amber-700">
                      {intelligenceData?.field_checks_total ? 
                        `${intelligenceData.field_checks_passed}/${intelligenceData.field_checks_total} checks passed` :
                        'Some fields have validation issues'}
                    </p>
                  </div>
                  <div className="flex gap-2 items-center">
                    {issuesBySeverity.critical > 0 && (
                      <div className="flex items-center gap-1 px-2 py-1 rounded bg-red-100 border border-red-300 text-red-700 text-xs font-medium">
                        <span>⚠</span>
                        <span>{issuesBySeverity.critical} Critical</span>
                      </div>
                    )}
                    {issuesBySeverity.medium > 0 && (
                      <div className="flex items-center gap-1 px-2 py-1 rounded bg-amber-100 border border-amber-300 text-amber-700 text-xs font-medium">
                        <span>⚡</span>
                        <span>{issuesBySeverity.medium} Medium</span>
                      </div>
                    )}
                    {issuesBySeverity.low > 0 && (
                      <div className="flex items-center gap-1 px-2 py-1 rounded bg-blue-100 border border-blue-300 text-blue-700 text-xs font-medium">
                        <span>ℹ</span>
                        <span>{issuesBySeverity.low} Low</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
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
                    <p className="text-sm mt-1">{safeUpperCase(safeReplace(submissionRecord.decisionType, /_/g, ' '), 'Unknown')}</p>
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
                        {safeUpperCase(submissionRecord.evaluatorOutput.status, 'UNKNOWN')}
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
                        {safeUpperCase(submissionRecord.evaluatorOutput.riskLevel, 'UNKNOWN')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Form Data */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-3">Form Data</h4>
                  {submissionRecord.formData && typeof submissionRecord.formData === 'object' && Object.keys(submissionRecord.formData).length > 0 ? (
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Field</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {Object.entries(submissionRecord.formData).map(([key, value]) => {
                            // Phase 7.16: Get field issues for this field
                            const fieldIssues = getFieldIssues(fieldIssueMap, key);
                            const topIssue = getTopFieldIssue(fieldIssueMap, key);
                            const hasIssues = fieldIssues.length > 0;
                            
                            return (
                            <tr key={key} className={`hover:bg-slate-50 ${hasIssues ? 'bg-amber-50/30' : ''}`}>
                              <td className="px-4 py-2 text-xs font-medium text-slate-700 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <span>{safeReplace(key, /_/g, ' ')}</span>
                                  {topIssue && (
                                    <FieldIssueBadge
                                      severity={topIssue.severity}
                                      message={topIssue.message}
                                      check={topIssue.check}
                                      count={fieldIssues.length}
                                    />
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-2 text-xs text-slate-900">
                                <div className="space-y-1">
                                  <div>
                                    {typeof value === 'object' && value !== null
                                      ? JSON.stringify(value)
                                      : String(value || '—')}
                                  </div>
                                  {/* Show top issue message as helper text */}
                                  {topIssue && (
                                    <div className={`text-[10px] ${
                                      topIssue.severity === 'critical' ? 'text-red-600' :
                                      topIssue.severity === 'medium' ? 'text-amber-600' :
                                      'text-blue-600'
                                    }`}>
                                      {topIssue.check && <span className="font-semibold">{topIssue.check}: </span>}
                                      {topIssue.message}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 px-4 border border-slate-200 rounded-lg bg-slate-50">
                      <p className="text-sm text-slate-600">No form data available for this submission.</p>
                    </div>
                  )}
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
              <div className="text-center py-12 px-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 max-w-md mx-auto">
                  <p className="text-amber-900 font-semibold text-sm mb-2">⚠️ No Submission Data</p>
                  <p className="text-amber-700 text-xs mb-4">
                    {caseItem?.submissionId ? (
                      <>Submission ID <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">{caseItem.submissionId}</code> not found in store.</>
                    ) : (
                      'This case does not have an associated submission.'
                    )}
                  </p>
                  <div className="flex gap-2 justify-center">
                    {caseItem?.submissionId && (
                      <button
                        onClick={() => navigate(`/submissions/${caseItem.submissionId}`)}
                        className="px-3 py-2 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700"
                      >
                        View Submission →
                      </button>
                    )}
                    <button
                      onClick={() => setActiveTab('summary')}
                      className="px-3 py-2 bg-slate-600 text-white text-xs font-medium rounded-lg hover:bg-slate-700"
                    >
                      ← Back to Summary
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          </ErrorBoundary>
          );
        })()}

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
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                Playbook Adherence
                {(isDemoCase || !isApiMode) && (
                  <span className="text-xs font-normal px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-300 rounded">
                    Demo Mode
                  </span>
                )}
              </h3>

              {/* Show demo data for demo cases OR when API mode is off */}
              {(isDemoCase || !isApiMode) && (() => {
                // Generate demo adherence based on case status
                const demoAdherence: CaseAdherence = {
                  decisionType: caseItem.status || 'needs_review',
                  adherencePct: caseItem.status === 'approved' ? 100 : 
                                caseItem.status === 'blocked' ? 85 :
                                caseItem.status === 'request_info' ? 60 : 50,
                  totalSteps: 6,
                  completedSteps: caseItem.status === 'approved' ? [
                    { id: 'verify_identity', title: 'Identity Verification', description: 'Verified practitioner identity against state license database' },
                    { id: 'check_credentials', title: 'Credential Check', description: 'Validated all required credentials and certifications' },
                    { id: 'review_history', title: 'History Review', description: 'Reviewed practice history and any disciplinary actions' },
                    { id: 'evidence_collection', title: 'Evidence Collection', description: 'Collected all supporting evidence and documentation' },
                    { id: 'decision_rationale', title: 'Decision Rationale', description: 'Documented clear decision rationale' },
                    { id: 'final_status', title: 'Final Status Update', description: 'Updated case status to final decision' },
                  ] : caseItem.status === 'request_info' ? [
                    { id: 'verify_identity', title: 'Identity Verification', description: 'Verified practitioner identity against state license database' },
                    { id: 'check_credentials', title: 'Credential Check', description: 'Validated all required credentials and certifications' },
                    { id: 'review_history', title: 'History Review', description: 'Reviewed practice history and any disciplinary actions' },
                  ] : [
                    { id: 'verify_identity', title: 'Identity Verification', description: 'Verified practitioner identity against state license database' },
                    { id: 'check_credentials', title: 'Credential Check', description: 'Validated all required credentials and certifications' },
                    { id: 'review_history', title: 'History Review', description: 'Reviewed practice history and any disciplinary actions' },
                  ],
                  missingSteps: caseItem.status === 'approved' ? [] :
                                caseItem.status === 'request_info' ? [
                    { id: 'evidence_collection', title: 'Evidence Collection', description: 'Collect all supporting evidence and documentation' },
                    { id: 'decision_rationale', title: 'Decision Rationale', description: 'Document clear decision rationale' },
                    { id: 'final_status', title: 'Final Status Update', description: 'Update case status to final decision' },
                  ] : [
                    { id: 'evidence_collection', title: 'Evidence Collection', description: 'Collect all supporting evidence and documentation' },
                    { id: 'decision_rationale', title: 'Decision Rationale', description: 'Document clear decision rationale' },
                    { id: 'final_status', title: 'Final Status Update', description: 'Update case status to final decision' },
                  ],
                  recommendedNextActions: caseItem.status === 'approved' ? [] :
                                         caseItem.status === 'request_info' ? [
                    { stepId: 'request_info', stepTitle: 'Request Additional Information', suggestedAction: 'Request missing documentation from submitter' },
                    { stepId: 'evidence_collection', stepTitle: 'Continue Evidence Collection', suggestedAction: 'Review available evidence and identify gaps' },
                  ] : [
                    { stepId: 'evidence_collection', stepTitle: 'Collect Evidence', suggestedAction: 'Attach relevant evidence to support decision' },
                    { stepId: 'note_review', stepTitle: 'Add Review Notes', suggestedAction: 'Document your review findings and rationale' },
                  ],
                  message: caseItem.status === 'approved' ? 'All playbook steps completed' : undefined,
                };
                
                return (
                  <>
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs text-amber-800">
                        📊 <strong>Demo Mode:</strong> Showing sample adherence metrics based on case status. Connect to backend for real-time adherence tracking.
                      </p>
                    </div>
                    
                    <div className="space-y-6">
                      {/* Adherence Badge */}
                      <div className="flex items-center gap-4">
                        <div className={`inline-flex items-center px-4 py-2 rounded-full text-lg font-semibold ${
                          demoAdherence.adherencePct >= 80 ? 'bg-green-100 text-green-800' :
                          demoAdherence.adherencePct >= 50 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {demoAdherence.adherencePct}% Complete
                        </div>
                        <div className="text-sm text-slate-600">
                          {demoAdherence.completedSteps.length} of {demoAdherence.totalSteps} steps completed
                        </div>
                      </div>

                      {/* Steps Grid */}
                      <div className="grid grid-cols-2 gap-6">
                        {/* Completed Steps */}
                        <div>
                          <h4 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
                            <span className="text-green-600">✓</span>
                            Completed Steps ({demoAdherence.completedSteps.length})
                          </h4>
                          <div className="space-y-2">
                            {demoAdherence.completedSteps.length === 0 ? (
                              <p className="text-sm text-slate-500 italic">No steps completed yet</p>
                            ) : (
                              demoAdherence.completedSteps.map((step) => (
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
                            Missing Steps ({demoAdherence.missingSteps.length})
                          </h4>
                          <div className="space-y-2">
                            {demoAdherence.missingSteps.length === 0 ? (
                              <p className="text-sm text-green-600 italic">All steps completed!</p>
                            ) : (
                              demoAdherence.missingSteps.map((step) => (
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
                      {demoAdherence.recommendedNextActions.length > 0 && (
                        <div className="mt-6 p-4 bg-sky-50 border border-sky-200 rounded-lg">
                          <h4 className="font-medium text-slate-900 mb-3">
                            🎯 Recommended Next Actions
                          </h4>
                          <div className="space-y-3">
                            {demoAdherence.recommendedNextActions.map((rec, idx) => (
                              <div key={idx} className="flex items-start gap-3">
                                <div className="flex-1">
                                  <div className="font-medium text-sm text-slate-900">{rec.stepTitle}</div>
                                  <div className="text-sm text-slate-600 mt-1">{rec.suggestedAction}</div>
                                </div>
                                <div className="flex gap-2">
                                  {rec.stepId.includes('evidence') && (
                                    <button
                                      onClick={() => setActiveTab('summary')}
                                      className="px-3 py-1 text-xs font-medium bg-sky-600 text-white rounded-md hover:bg-sky-700"
                                    >
                                      Open Evidence
                                    </button>
                                  )}
                                  {rec.stepId.includes('request_info') && (
                                    <button
                                      onClick={() => setShowRequestInfoModal(true)}
                                      className="px-3 py-1 text-xs font-medium bg-sky-600 text-white rounded-md hover:bg-sky-700"
                                    >
                                      Request Info
                                    </button>
                                  )}
                                  {rec.stepId.includes('note') && (
                                    <button
                                      onClick={() => setActiveTab('notes')}
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

                      {/* Message if all completed */}
                      {demoAdherence.message && (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-sm text-green-800">✅ {demoAdherence.message}</p>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}

              {/* Show loading/error/data for API cases ONLY (not demo cases) */}
              {!isDemoCase && isApiMode && adherenceLoading && (
                <div className="text-center py-8">
                  <p className="text-slate-600">Loading adherence metrics...</p>
                </div>
              )}

              {!isDemoCase && isApiMode && adherenceError && (
                <div className="text-center py-8 px-4">
                  <div className="inline-block p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <p className="text-slate-800 font-medium mb-2">⚠️ Adherence data unavailable</p>
                    <p className="text-sm text-slate-600 mb-4">
                      {adherenceError.includes('404') || adherenceError.includes('not found')
                        ? 'This case does not have adherence tracking configured yet.'
                        : adherenceError}
                    </p>
                    <button
                      onClick={loadAdherence}
                      className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-sm font-medium"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {!isDemoCase && isApiMode && adherence && !adherenceLoading && !adherenceError && (
                <div className="space-y-6">
                  {/* Show message if no playbook is defined */}
                  {adherence.message && adherence.totalSteps === 0 && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800">
                        ℹ️ {adherence.message}
                      </p>
                      <p className="text-xs text-amber-700 mt-2">
                        No playbook has been configured for this decision type yet. Adherence tracking will be available once a playbook is defined.
                      </p>
                    </div>
                  )}

                  {/* Only show adherence metrics if there are steps */}
                  {adherence.totalSteps > 0 && (
                    <>
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

                      {/* Message for completed playbooks */}
                      {adherence.message && adherence.totalSteps > 0 && (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-sm text-green-800">✓ {adherence.message}</p>
                        </div>
                      )}
                    </>
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
          <div className="space-y-6">
            {/* Decision Summary */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                Decision Summary
                <span className={`ml-auto text-xs font-semibold px-3 py-1 rounded-full ${
                  caseItem.status === 'approved' ? 'bg-green-100 text-green-800' :
                  caseItem.status === 'blocked' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {caseItem.status?.toUpperCase() || 'PENDING'}
                </span>
              </h3>
              
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-xs font-medium text-slate-600 mb-1">Case ID</div>
                  <div className="text-sm font-mono text-slate-900">{caseItem.id}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-xs font-medium text-slate-600 mb-1">Decision Type</div>
                  <div className="text-sm font-medium text-slate-900">{caseItem.decisionType || 'CSF Practitioner'}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-xs font-medium text-slate-600 mb-1">Confidence</div>
                  <div className="text-sm font-semibold text-sky-700">
                    {caseItem.status === 'approved' ? '92%' : caseItem.status === 'blocked' ? '88%' : '—'}
                  </div>
                </div>
              </div>

              <div className="prose prose-sm max-w-none">
                <p className="text-slate-700 leading-relaxed">
                  {caseItem.status === 'approved' 
                    ? `This case was approved based on comprehensive verification of credentials, qualifications, and compliance with regulatory requirements. All required evidence was provided and validated against established criteria.`
                    : caseItem.status === 'blocked'
                    ? `This case was blocked due to missing or invalid credentials, incomplete documentation, or failure to meet minimum requirements. Key deficiencies were identified during the review process.`
                    : `This case is currently under review. The decision will be finalized after completing all required verification steps and evidence collection.`
                  }
                </p>
              </div>
            </div>

            {/* Key Drivers */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h4 className="text-md font-semibold text-slate-900 mb-4">🎯 Key Decision Drivers</h4>
              <div className="space-y-3">
                {caseItem.status === 'approved' ? (
                  <>
                    <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <span className="text-lg">✓</span>
                      <div className="flex-1">
                        <div className="font-medium text-sm text-green-900">Valid License & Credentials</div>
                        <div className="text-xs text-green-700 mt-1">State license verified and in good standing with no disciplinary actions</div>
                      </div>
                      <div className="text-xs font-semibold text-green-700">+35%</div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <span className="text-lg">✓</span>
                      <div className="flex-1">
                        <div className="font-medium text-sm text-green-900">Complete Documentation</div>
                        <div className="text-xs text-green-700 mt-1">All required forms, certifications, and supporting evidence provided</div>
                      </div>
                      <div className="text-xs font-semibold text-green-700">+30%</div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <span className="text-lg">✓</span>
                      <div className="flex-1">
                        <div className="font-medium text-sm text-green-900">Clean Practice History</div>
                        <div className="text-xs text-green-700 mt-1">No malpractice claims or regulatory violations on record</div>
                      </div>
                      <div className="text-xs font-semibold text-green-700">+27%</div>
                    </div>
                  </>
                ) : caseItem.status === 'blocked' ? (
                  <>
                    <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <span className="text-lg">✗</span>
                      <div className="flex-1">
                        <div className="font-medium text-sm text-red-900">Missing Credentials</div>
                        <div className="text-xs text-red-700 mt-1">Required board certification not provided or expired</div>
                      </div>
                      <div className="text-xs font-semibold text-red-700">-42%</div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <span className="text-lg">✗</span>
                      <div className="flex-1">
                        <div className="font-medium text-sm text-red-900">Incomplete Forms</div>
                        <div className="text-xs text-red-700 mt-1">Key sections of application left blank or improperly filled</div>
                      </div>
                      <div className="text-xs font-semibold text-red-700">-28%</div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <span className="text-lg">⚠</span>
                      <div className="flex-1">
                        <div className="font-medium text-sm text-red-900">Disciplinary Actions</div>
                        <div className="text-xs text-red-700 mt-1">Active or recent disciplinary actions found in state database</div>
                      </div>
                      <div className="text-xs font-semibold text-red-700">-18%</div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6 text-slate-500 text-sm">
                    Decision drivers will appear here once the case is finalized
                  </div>
                )}
              </div>
            </div>

            {/* Evidence Snapshot */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h4 className="text-md font-semibold text-slate-900 mb-4">📄 Evidence Snapshot</h4>
              <div className="space-y-2">
                {caseItem.status === 'approved' || caseItem.status === 'blocked' ? (
                  <>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">🪪</span>
                        <div>
                          <div className="text-sm font-medium text-slate-900">State Medical License</div>
                          <div className="text-xs text-slate-600">License #MD-123456 • Verified via NPDB</div>
                        </div>
                      </div>
                      <span className="text-xs font-semibold px-2 py-1 bg-green-100 text-green-700 rounded">Verified</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">🎓</span>
                        <div>
                          <div className="text-sm font-medium text-slate-900">Board Certification</div>
                          <div className="text-xs text-slate-600">ABMS Certified • Expires 2026-12-31</div>
                        </div>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${
                        caseItem.status === 'approved' 
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {caseItem.status === 'approved' ? 'Verified' : 'Missing'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">📋</span>
                        <div>
                          <div className="text-sm font-medium text-slate-900">Malpractice Insurance</div>
                          <div className="text-xs text-slate-600">$1M/$3M Coverage • Policy #MP-789012</div>
                        </div>
                      </div>
                      <span className="text-xs font-semibold px-2 py-1 bg-green-100 text-green-700 rounded">Current</span>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6 text-slate-500 text-sm">
                    Evidence details will appear here once review is complete
                  </div>
                )}
              </div>
            </div>

            {/* What Would Change Decision */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h4 className="text-md font-semibold text-slate-900 mb-4">🔄 Counterfactual Analysis</h4>
              <div className="space-y-3">
                {caseItem.status === 'approved' ? (
                  <>
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="text-sm font-medium text-amber-900 mb-1">Decision would change to BLOCKED if:</div>
                      <ul className="text-xs text-amber-800 space-y-1 ml-4 list-disc">
                        <li>State license becomes inactive or suspended</li>
                        <li>Malpractice claim filed within review period</li>
                        <li>Board certification expires without renewal</li>
                      </ul>
                    </div>
                  </>
                ) : caseItem.status === 'blocked' ? (
                  <>
                    <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg">
                      <div className="text-sm font-medium text-sky-900 mb-1">Decision would change to APPROVED if:</div>
                      <ul className="text-xs text-sky-800 space-y-1 ml-4 list-disc">
                        <li>Missing board certification provided and verified</li>
                        <li>Incomplete forms resubmitted with all required fields</li>
                        <li>Disciplinary actions resolved or adequately explained</li>
                      </ul>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6 text-slate-500 text-sm">
                    Counterfactual analysis will appear here once decision is finalized
                  </div>
                )}
              </div>
            </div>

            {/* Deep Dive CTA */}
            <div className="bg-gradient-to-r from-sky-50 to-blue-50 rounded-lg border border-sky-200 p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="text-md font-semibold text-slate-900 mb-2">🔍 Deep Dive with RAG Explorer</h4>
                  <p className="text-sm text-slate-700 mb-4">
                    Explore the full decision graph, trace evidence chains, and query the knowledge base in context of this specific case.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleOpenInRAG}
                      className="px-4 py-2 text-sm font-medium rounded-lg bg-sky-600 text-white hover:bg-sky-700 flex items-center gap-2"
                    >
                      <span>🔍</span>
                      <span>Open in RAG Explorer</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('timeline')}
                      className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-white flex items-center gap-2"
                    >
                      <span>📜</span>
                      <span>View Timeline</span>
                    </button>
                  </div>
                </div>
                <div className="ml-4 text-4xl">🧠</div>
              </div>
            </div>
          </div>
        )}

        {/* Timeline Tab */}
        {activeTab === "timeline" && (
          <div className="space-y-4">
            {eventsLoading && caseEvents.length === 0 ? (
              <div className="text-center text-sm text-slate-500 py-8">
                Loading timeline...
              </div>
            ) : eventsError ? (
              <div className="text-center text-sm text-red-600 py-8">
                {eventsError}
              </div>
            ) : caseEvents.length === 0 ? (
              <div className="text-center text-sm text-slate-500 py-8 italic">
                No timeline events yet
              </div>
            ) : (
              <div className="space-y-3">
                {caseEvents.map((event) => {
                  const payload = event.payloadJson ? JSON.parse(event.payloadJson) : {};
                  
                  // Format event label and icon
                  let icon = "📝";
                  let label = event.eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                  
                  if (event.eventType === 'case_created') icon = "🆕";
                  else if (event.eventType === 'assigned') icon = "👤";
                  else if (event.eventType === 'unassigned') icon = "🚫";
                  else if (event.eventType === 'status_changed' || event.eventType === 'case_status_changed') {
                    icon = "🔄";
                    if (payload.to === 'approved') icon = "✅";
                    else if (payload.to === 'blocked') icon = "⛔";
                    else if (payload.to === 'needs_info') icon = "📋";
                  }
                  else if (event.eventType === 'case_decision_created') {
                    icon = payload.decisionType === 'REJECTED' ? "⛔" : "✅";
                    label = "Decision Recorded";
                  }
                  else if (event.eventType === 'attachment_added') {
                    icon = "📎";
                    label = "Attachment Added";
                  }
                  else if (event.eventType === 'attachment_downloaded') {
                    icon = "⬇️";
                    label = "Attachment Downloaded";
                  }
                  else if (event.eventType === 'attachment_removed') {
                    icon = "🗑️";
                    label = "Attachment Removed";
                  }
                  else if (event.eventType === 'attachment_redacted') {
                    icon = "🚫";
                    label = "Attachment Redacted";
                  }
                  else if (event.eventType === 'submission_updated') icon = "✏️";
                  else if (event.eventType === 'submission_cancelled') icon = "🗑️";
                  
                  return (
                    <div
                      key={event.id}
                      className="border border-slate-200 rounded-lg p-4 bg-white hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-2xl flex-shrink-0">{icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2 mb-1">
                            <h4 className="text-sm font-semibold text-slate-900">{label}</h4>
                            <span className="text-xs text-slate-500 whitespace-nowrap">
                              {safeFormatRelative(event.createdAt)}
                            </span>
                          </div>
                          
                          {event.message && (
                            <p className="text-sm text-slate-700 mb-2">{event.message}</p>
                          )}
                          
                          <div className="flex items-center gap-3 text-xs text-slate-600">
                            <span className="flex items-center gap-1">
                              <span className="font-medium">Actor:</span>
                              {event.actorId || event.actorRole}
                              {event.actorRole === 'system' && ' (System)'}
                            </span>
                            <span className="text-slate-400">•</span>
                            <span>{safeFormatDate(event.createdAt)}</span>
                          </div>
                          
                          {/* Show payload details for specific event types */}
                          {(event.eventType === 'status_changed' || event.eventType === 'case_status_changed') && payload.from && payload.to && (
                            <div className="mt-2 text-xs text-slate-600 bg-slate-100 rounded px-2 py-1">
                              <span className="font-mono">{payload.from}</span>
                              <span className="mx-1">→</span>
                              <span className="font-mono">{payload.to}</span>
                              {payload.reason && <span className="ml-2 italic">({payload.reason})</span>}
                            </div>
                          )}

                          {event.eventType === 'case_decision_created' && payload.decisionType && (
                            <div className="mt-2 text-xs text-slate-600 bg-slate-100 rounded px-2 py-1">
                              <span className="font-medium">Decision:</span> {payload.decisionType}
                              {payload.reason && <span className="ml-2 italic">({payload.reason})</span>}
                            </div>
                          )}
                          
                          {event.eventType === 'assigned' && payload.assignee && (
                            <div className="mt-2 text-xs text-slate-600 bg-slate-100 rounded px-2 py-1">
                              Assigned to: <span className="font-medium">{payload.assignee}</span>
                            </div>
                          )}

                          {event.eventType === 'attachment_added' && payload.filename && (
                            <div className="mt-2 text-xs text-slate-600 bg-slate-100 rounded px-2 py-1">
                              <span className="font-medium">File:</span> {payload.filename}
                              {payload.size && <span className="ml-2">({(payload.size / 1024).toFixed(1)} KB)</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {caseEvents.length > 0 && !eventsLoading && (
              <div className="text-center text-sm text-slate-500 italic pt-4">
                {caseEvents.length} event{caseEvents.length === 1 ? '' : 's'} loaded
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

            {/* Attachments */}
            <div className="space-y-3">
              {attachmentsToast && (
                <div className="p-2 text-xs rounded border border-emerald-200 bg-emerald-50 text-emerald-800">
                  {attachmentsToast}
                </div>
              )}
              {attachmentsError && (
                <div className="p-2 text-xs rounded border border-red-200 bg-red-50 text-red-700">
                  {attachmentsError}
                </div>
              )}

              {(caseRecord?.status === 'cancelled' || isResolved) && (
                <div className="p-2 text-xs rounded border border-slate-200 bg-slate-50 text-slate-600">
                  Attachments are read-only for resolved or cancelled cases.
                </div>
              )}

              <div
                className={`border border-dashed rounded-lg p-4 text-center text-sm ${
                  caseRecord?.status === 'cancelled' || isResolved
                    ? 'border-slate-200 text-slate-400 bg-slate-50'
                    : 'border-slate-300 text-slate-600'
                }`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file && !(caseRecord?.status === 'cancelled' || isResolved)) {
                    handleAttachmentUpload(file);
                  }
                }}
              >
                <div className="mb-2 font-medium text-slate-700">Drag & drop a file here</div>
                <div className="text-xs text-slate-500 mb-3">PDF, PNG, or JPG up to 10 MB</div>
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && !(caseRecord?.status === 'cancelled' || isResolved)) {
                      handleAttachmentUpload(file);
                    }
                    e.currentTarget.value = '';
                  }}
                  className="text-xs"
                  disabled={caseRecord?.status === 'cancelled' || isResolved}
                />
                <input
                  type="text"
                  value={attachmentDescription}
                  onChange={(e) => setAttachmentDescription(e.target.value)}
                  placeholder="Optional description"
                  className="mt-3 w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  disabled={caseRecord?.status === 'cancelled' || isResolved}
                />
                {attachmentsUploading && (
                  <div className="mt-2 text-xs text-slate-500">Uploading...</div>
                )}
              </div>

              {attachmentsLoading ? (
                <p className="text-sm text-slate-500 italic">Loading attachments...</p>
              ) : apiAttachments.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No attachments uploaded yet</p>
              ) : (
                apiAttachments.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">📎</span>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{item.filename}</p>
                        <p className="text-xs text-slate-500">
                          {item.contentType} • {(item.sizeBytes / 1024).toFixed(1)} KB • {new Date(item.createdAt).toLocaleString()}
                        </p>
                        {item.description && (
                          <p className="text-xs text-slate-500">{item.description}</p>
                        )}
                        {item.isRedacted === 1 && (
                          <p className="mt-1 text-xs text-amber-700">Redacted: {item.redactReason || 'No reason provided'}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={getAttachmentDownloadUrl(caseId, item.id)}
                        target="_blank"
                        rel="noreferrer"
                        className={`text-xs ${item.isRedacted === 1 || item.isDeleted === 1 ? 'text-slate-400 cursor-not-allowed' : 'text-sky-600 hover:text-sky-700'}`}
                        onClick={(e) => {
                          if (item.isRedacted === 1 || item.isDeleted === 1) {
                            e.preventDefault();
                          }
                        }}
                      >
                        Download
                      </a>
                      <button
                        onClick={() => handleAttachmentAction('redact', item)}
                        disabled={item.isRedacted === 1 || item.isDeleted === 1}
                        className={`text-xs ${item.isRedacted === 1 || item.isDeleted === 1 ? 'text-slate-300' : 'text-amber-700 hover:text-amber-800'}`}
                      >
                        Redact
                      </button>
                      <button
                        onClick={() => handleAttachmentAction('delete', item)}
                        disabled={item.isDeleted === 1}
                        className={`text-xs ${item.isDeleted === 1 ? 'text-slate-300' : 'text-red-600 hover:text-red-700'}`}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <ConfidenceHistoryPanel caseId={caseId} limit={50} role={role} />
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

      {/* Reject Modal */}
      {showRejectModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowRejectModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Reject Case</h3>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
                rows={4}
                placeholder="Provide a reason for rejection..."
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => handleDecision('REJECTED')}
                  disabled={decisionSubmitting || !rejectReason.trim()}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reject Case
                </button>
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectReason("");
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

      {/* Attachment Action Modal */}
      {attachmentAction && attachmentActionTarget && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setAttachmentAction(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                {attachmentAction === 'delete' ? 'Remove Attachment' : 'Redact Attachment'}
              </h3>
              <p className="text-xs text-slate-600 mb-2">
                {attachmentActionTarget.filename}
              </p>
              <textarea
                value={attachmentActionReason}
                onChange={(e) => setAttachmentActionReason(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
                rows={4}
                placeholder="Provide a reason..."
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={submitAttachmentAction}
                  disabled={!attachmentActionReason.trim()}
                  className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white ${
                    attachmentActionReason.trim()
                      ? attachmentAction === 'delete'
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-slate-300 cursor-not-allowed'
                  }`}
                >
                  {attachmentAction === 'delete' ? 'Remove' : 'Redact'}
                </button>
                <button
                  onClick={() => {
                    setAttachmentAction(null);
                    setAttachmentActionTarget(null);
                    setAttachmentActionReason('');
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

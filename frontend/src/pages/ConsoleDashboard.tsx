import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import "./ConsoleDashboard.css";
import { TraceReplayDrawer, TraceData, TraceStep } from "../components/TraceReplayDrawer";
import { apiFetch } from "../lib/api";
import { demoStore } from "../lib/demoStore";
import * as submissionSelector from "../submissions/submissionStoreSelector";
import type { SubmissionRecord } from "../submissions/submissionTypes";
import { deleteSubmission, updateSubmission } from "../api/submissionsApi";
import { listCases, getCaseInfoRequest, resubmitCase } from "../api/workflowApi";
import { uploadEvidence, listEvidence, type EvidenceUploadItem, getEvidenceDownloadUrl } from "../api/evidenceApi";
import type { WorkQueueItem as DemoWorkQueueItem } from "../types/workQueue";
import { buildDecisionPacket } from "../utils/buildDecisionPacket";
import { downloadJson } from "../utils/exportPacket";
import { useRole } from "../context/RoleContext";
import { canViewWorkQueue, canViewRecentDecisions, canClearDemoData, canSeedDemoData, getConsoleInstructions } from "../auth/permissions";
import { CaseDetailsDrawer } from "../components/CaseDetailsDrawer";
import { canTransition, getAllowedTransitions, type WorkflowStatus } from "../workflow/statusTransitions";
import type { AuditAction } from "../types/audit";
import { DEMO_VERIFIERS, getCurrentDemoUser, type DemoUser } from "../demo/users";
import { getAgeMs, formatAgeShort, isOverdue, formatDue, getSlaStatusColor } from "../workflow/sla";
import { viewStore } from "../lib/viewStore";
import type { QueueView, SortField, SortDirection } from "../types/views";
import { AdminResetPanel } from "../features/admin/AdminResetPanel";
import { BackendHealthBanner } from "../components/BackendHealthBanner";

type DecisionStatus = "ok_to_ship" | "blocked" | "needs_review";
type ActiveSection = "dashboard" | "csf" | "licenses" | "orders" | "settings" | "about";

// ============================================================================
// localStorage Cache Helpers
// ============================================================================
const SUBMISSIONS_CACHE_KEY = "acai.submissions.cache.v1";
const WORK_QUEUE_CACHE_KEY = "acai.workQueue.cache.v1";

function getCachedSubmissions(): SubmissionRecord[] {
  try {
    const cached = localStorage.getItem(SUBMISSIONS_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    console.warn('[Cache] Failed to load cached submissions:', err);
  }
  return [];
}

function setCachedSubmissions(submissions: SubmissionRecord[]): void {
  try {
    // Don't cache empty list unless it's a valid backend response
    if (submissions.length === 0) return;
    localStorage.setItem(SUBMISSIONS_CACHE_KEY, JSON.stringify(submissions));
  } catch (err) {
    console.warn('[Cache] Failed to cache submissions:', err);
  }
}

function getCachedWorkQueue(): any[] {
  try {
    const cached = localStorage.getItem(WORK_QUEUE_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    console.warn('[Cache] Failed to load cached work queue:', err);
  }
  return [];
}

function setCachedWorkQueue(items: any[]): void {
  try {
    if (items.length === 0) return;
    localStorage.setItem(WORK_QUEUE_CACHE_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn('[Cache] Failed to cache work queue:', err);
  }
}

// Backend submission interface
interface BackendSubmission {
  submission_id: string;
  csf_type: string;
  tenant: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  title: string;
  subtitle: string;
  summary?: string;
  trace_id: string;
  payload: Record<string, unknown>;
  decision_status?: string;
  risk_level?: string;
}

interface RecentDecisionRow {
  id: string;
  timestamp: string;
  scenario: string;
  status: DecisionStatus;
  riskLevel: "Low" | "Medium" | "High";
  csfType: "Practitioner" | "Hospital" | "Researcher";
  traceId: string;
}

interface ExpiringLicenseRow {
  id: string;
  accountName: string;
  jurisdiction: string;
  licenseType: string;
  expiresOn: string;
  daysRemaining: number;
}

interface WorkQueueItem {
  id: string;
  trace_id: string;
  facility: string;
  reason: string;
  age: string;
  priority: "High" | "Medium" | "Low";
  priorityColor: string;
  policyOverride?: boolean;
  policyOverrideLabel?: string;
  // Fields from API CaseRecord - no need to look up demoStore
  status: 'new' | 'in_review' | 'needs_info' | 'approved' | 'blocked' | 'closed';
  assignedTo: string | null;
  decisionType: string;
  dueAt: string;
  createdAt: string;
  age_hours?: number;
  sla_status?: 'ok' | 'warning' | 'breach';
}

// Seed demo data on first load
if (!demoStore.hasData()) {
  console.log('[ConsoleDashboard] First load - seeding demo data');
  demoStore.seedDemoDataIfEmpty();
}

const MOCK_DECISIONS: RecentDecisionRow[] = [
  {
    id: "AUTO-2025-00124",
    timestamp: "2025-01-15 10:12",
    scenario: "Ohio Hospital – Morphine ampoules",
    status: "ok_to_ship",
    riskLevel: "Low",
    csfType: "Hospital",
    traceId: "trace-hospital-morphine-124",
  },
  {
    id: "AUTO-2025-00123",
    timestamp: "2025-01-15 09:58",
    scenario: "NY Pharmacy – Oxycodone tablets",
    status: "blocked",
    riskLevel: "High",
    csfType: "Practitioner",
    traceId: "trace-pharmacy-oxy-123",
  },
  {
    id: "AUTO-2025-00122",
    timestamp: "2025-01-15 09:42",
    scenario: "Practitioner CSF – Ohio TDDD renewal",
    status: "needs_review",
    riskLevel: "Medium",
    csfType: "Practitioner",
    traceId: "trace-practitioner-tddd-122",
  },
];

const MOCK_EXPIRING_LICENSES: ExpiringLicenseRow[] = [
  {
    id: "LIC-001",
    accountName: "Ohio Hospital – Main Campus",
    jurisdiction: "OH",
    licenseType: "TDDD – Category II",
    expiresOn: "2025-02-10",
    daysRemaining: 26,
  },
  {
    id: "LIC-002",
    accountName: "NY Pharmacy – Broadway",
    jurisdiction: "NY",
    licenseType: "NY Pharmacy License",
    expiresOn: "2025-02-01",
    daysRemaining: 17,
  },
];

// Mock trace data - 3 unique traces for work queue items
const TRACE_REPLAYS: Record<string, TraceData> = {
  "trace-2025-12-19-08-30-00-abc123": {
    trace_id: "trace-2025-12-19-08-30-00-abc123",
    tenant: "ohio-hospital-main",
    created_at: "2025-12-19 08:30:14",
    final_status: "needs_review",
    risk_level: "High",
    scenario: "Ohio Hospital – Missing TDDD license renewal",
    csf_type: "Hospital",
    total_duration_ms: 428,
    steps: [
      {
        id: "step-1",
        timestamp: "08:30:14.102",
        label: "TDDD license verification initiated",
        type: "api",
        status: "success",
        duration_ms: 12,
        details: {
          endpoint: "POST /api/license/ohio-tddd/verify",
          payload: {
            facility_id: "OH-HOSP-001",
            license_number: "TDDD-OH-12345",
          },
        },
      },
      {
        id: "step-2",
        timestamp: "08:30:14.256",
        label: "License database check",
        type: "engine",
        status: "warning",
        duration_ms: 187,
        details: {
          engine: "Ohio TDDD License Validator v2.1",
          result: "License expires 2025-12-25 - renewal documentation missing",
        },
      },
      {
        id: "step-3",
        timestamp: "08:30:14.398",
        label: "RAG query for renewal requirements",
        type: "rag",
        status: "success",
        duration_ms: 94,
        details: {
          query: "What documents are required for Ohio TDDD Category II renewal?",
          result: "Per Ohio Admin Code 4729:5-3-01, renewal requires Form TDDD-R2, current DEA registration, and facility inspection report",
        },
      },
      {
        id: "step-4",
        timestamp: "08:30:14.489",
        label: "Final decision: needs_review",
        type: "decision",
        status: "warning",
        duration_ms: 41,
        details: {
          response: {
            decision: "needs_review",
            risk: "High",
            license_expiring: true,
            renewal_docs_missing: true,
            reasons: ["License expires in 6 days", "Renewal documentation not on file", "Manual intervention required"],
          },
        },
      },
    ],
  },
  "trace-2025-12-21-14-20-00-def456": {
    trace_id: "trace-2025-12-21-14-20-00-def456",
    tenant: "ny-pharmacy-broadway",
    created_at: "2025-12-21 14:20:08",
    final_status: "needs_review",
    risk_level: "Medium",
    scenario: "NY Pharmacy – Practitioner DEA expiring soon",
    csf_type: "Practitioner",
    total_duration_ms: 312,
    steps: [
      {
        id: "step-1",
        timestamp: "14:20:08.045",
        label: "DEA registration check initiated",
        type: "api",
        status: "success",
        duration_ms: 9,
        details: {
          endpoint: "POST /api/csf/practitioner/verify-dea",
          payload: {
            practitioner_id: "PRACT-NY-5678",
            dea_number: "BP1234567",
          },
        },
      },
      {
        id: "step-2",
        timestamp: "14:20:08.178",
        label: "DEA database validation",
        type: "engine",
        status: "warning",
        duration_ms: 156,
        details: {
          engine: "DEA Registry Validator v3.0",
          result: "DEA registration valid but expires 2026-01-04 (14 days remaining)",
        },
      },
      {
        id: "step-3",
        timestamp: "14:20:08.289",
        label: "RAG query for DEA renewal process",
        type: "rag",
        status: "success",
        duration_ms: 68,
        details: {
          query: "What is the DEA renewal process for practitioners in NY?",
          result: "Per 21 CFR 1301.13, practitioners must submit DEA Form 224 renewal at least 30 days before expiration. Failure to renew results in immediate prescription authority suspension.",
        },
      },
      {
        id: "step-4",
        timestamp: "14:20:08.357",
        label: "Final decision: needs_review",
        type: "decision",
        status: "warning",
        duration_ms: 79,
        details: {
          response: {
            decision: "needs_review",
            risk: "Medium",
            dea_expiring_soon: true,
            renewal_window_active: true,
            reasons: ["DEA expires in 14 days", "No renewal submission detected", "Notify practitioner immediately"],
          },
        },
      },
    ],
  },
  "trace-2025-12-21-11-15-00-ghi789": {
    trace_id: "trace-2025-12-21-11-15-00-ghi789",
    tenant: "researcher-university-lab",
    created_at: "2025-12-21 11:15:22",
    final_status: "blocked",
    risk_level: "Medium",
    scenario: "Researcher CSF – Schedule I attestation pending",
    csf_type: "Researcher",
    total_duration_ms: 267,
    steps: [
      {
        id: "step-1",
        timestamp: "11:15:22.089",
        label: "Researcher CSF evaluation initiated",
        type: "api",
        status: "success",
        duration_ms: 11,
        details: {
          endpoint: "POST /api/csf/researcher/evaluate",
          payload: {
            researcher_id: "RES-UNI-9012",
            substance: "LSD (Schedule I)",
            quantity: 50,
            research_protocol: "PROTO-2025-045",
          },
        },
      },
      {
        id: "step-2",
        timestamp: "11:15:22.201",
        label: "Schedule I attestation check",
        type: "engine",
        status: "error",
        duration_ms: 134,
        details: {
          engine: "Researcher CSF Rules v2.8",
          result: "Supervisor attestation required for Schedule I substances - status: PENDING",
        },
      },
      {
        id: "step-3",
        timestamp: "11:15:22.298",
        label: "RAG query for attestation requirements",
        type: "rag",
        status: "success",
        duration_ms: 58,
        details: {
          query: "What are the attestation requirements for Schedule I research?",
          result: "Per 21 CFR 1301.18, Schedule I research requires written attestation from principal investigator and institutional review board approval. Attestation must be renewed annually.",
        },
      },
      {
        id: "step-4",
        timestamp: "11:15:22.356",
        label: "Final decision: blocked",
        type: "decision",
        status: "error",
        duration_ms: 64,
        details: {
          response: {
            decision: "blocked",
            risk: "Medium",
            attestation_pending: true,
            supervisor_action_required: true,
            reasons: ["Schedule I substance", "Supervisor attestation pending", "Cannot proceed until approved"],
          },
        },
      },
    ],
  },
};

// Work queue items with unique trace_ids
const WORK_QUEUE_ITEMS: WorkQueueItem[] = [
  {
    id: "WQ-001",
    trace_id: "trace-2025-12-19-08-30-00-abc123",
    facility: "Ohio Hospital – Main Campus",
    reason: "Missing TDDD license renewal documentation",
    age: "Flagged 2 days ago",
    priority: "High",
    priorityColor: "text-amber-700",
  },
  {
    id: "WQ-002",
    trace_id: "trace-2025-12-21-14-20-00-def456",
    facility: "NY Pharmacy – Broadway",
    reason: "Practitioner DEA registration expiring in 14 days",
    age: "Flagged 1 hour ago",
    priority: "Medium",
    priorityColor: "text-slate-600",
  },
  {
    id: "WQ-003",
    trace_id: "trace-2025-12-21-11-15-00-ghi789",
    facility: "Researcher CSF – University Lab",
    reason: "Schedule I attestation pending supervisor approval",
    age: "Flagged 3 hours ago",
    priority: "Low",
    priorityColor: "text-slate-600",
  },
];

// Helper: Get decision type display properties
function getDecisionTypeDisplay(decisionType?: string): { label: string; colorClass: string } {
  if (!decisionType) {
    return { label: 'CSF Practitioner', colorClass: 'bg-sky-100 text-sky-700' };
  }
  
  switch (decisionType) {
    case 'csf_practitioner':
      return { label: 'CSF Practitioner', colorClass: 'bg-sky-100 text-sky-700' };
    case 'ohio_tddd':
      return { label: 'Ohio TDDD', colorClass: 'bg-orange-100 text-orange-700' };
    case 'ny_pharmacy_license':
      return { label: 'NY Pharmacy', colorClass: 'bg-purple-100 text-purple-700' };
    case 'csf_facility':
      return { label: 'CSF Facility', colorClass: 'bg-green-100 text-green-700' };
    default:
      return { label: decisionType, colorClass: 'bg-slate-100 text-slate-700' };
  }
}

const ConsoleDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, isSubmitter, isVerifier, isAdmin } = useRole();
  
  // Step 2.4: Redirect verifier/admin to CaseWorkspace if viewing dashboard section
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const section = searchParams.get('section');
    
    // If verifier/admin is on dashboard (not RAG or other section), redirect to CaseWorkspace
    if ((isVerifier || isAdmin) && location.pathname === '/console' && !section) {
      navigate('/console/cases', { replace: true });
    }
  }, [isVerifier, isAdmin, location, navigate]);
  
  // Derive active section from URL
  const getActiveSectionFromPath = (): ActiveSection => {
    const path = location.pathname;
    if (path === "/console" || path === "/console/") return "dashboard";
    if (path.startsWith("/console/csf")) return "csf";
    if (path.startsWith("/console/licenses")) return "licenses";
    if (path.startsWith("/console/orders")) return "orders";
    if (path.startsWith("/console/settings")) return "settings";
    if (path.startsWith("/console/about")) return "about";
    return "dashboard";
  };
  
  const activeSection = getActiveSectionFromPath();
  
  const setActiveSection = (section: ActiveSection) => {
    const pathMap: Record<ActiveSection, string> = {
      dashboard: "/console",
      csf: "/console/csf",
      licenses: "/console/licenses",
      orders: "/console/orders",
      settings: "/console/settings",
      about: "/console/about",
    };
    navigate(pathMap[section]);
  };
  const [isTraceOpen, setIsTraceOpen] = useState(false);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [selectedTrace, setSelectedTrace] = useState<TraceData | null>(null);
  const [isLoadingTrace, setIsLoadingTrace] = useState(false);
  const [workQueueItems, setWorkQueueItems] = useState<WorkQueueItem[]>(() => {
    // Load from cache immediately to prevent flash
    return getCachedWorkQueue();
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTenant, setSelectedTenant] = useState("ohio");
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Submission state - loaded from submissionStoreSelector
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>(() => {
    // Load from cache immediately to prevent flash
    return getCachedSubmissions();
  });
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Case requests for submitter (Phase 4.1)
  const [caseRequests, setCaseRequests] = useState<Map<string, any>>(new Map());
  const [caseMap, setCaseMap] = useState<Map<string, string>>(new Map());
  const [caseStatusMap, setCaseStatusMap] = useState<Map<string, string>>(new Map());
  const [evidenceMap, setEvidenceMap] = useState<Map<string, EvidenceUploadItem[]>>(new Map());
  const [uploadingMap, setUploadingMap] = useState<Map<string, boolean>>(new Map());

  // Refresh submissions function
  const refreshSubmissions = async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setIsLoadingSubmissions(true);
    }
    try {
      const list = await submissionSelector.listSubmissions();
      setSubmissions(list);
      setCachedSubmissions(list); // Cache successful response
      console.log('[ConsoleDashboard] Loaded submissions:', list.length);
      
      // Phase 4.1: Fetch case requests for submitter
      if (isSubmitter) {
        await fetchCaseRequestsForSubmissions(list);
      }
    } catch (err) {
      console.error('[ConsoleDashboard] Failed to load submissions:', err);
      // Keep cached data on error
    } finally {
      if (!options?.silent) {
        setIsLoadingSubmissions(false);
      }
    }
  };
  
  // Phase 4.1: Fetch case requests for submitter's submissions
  const fetchCaseRequestsForSubmissions = async (submissionList: SubmissionRecord[]) => {
    try {
      // Get all cases for these submissions
      const allCases = await listCases({ limit: 1000 });
      const submissionIdSet = new Set(submissionList.map(s => s.id));
      const relevantCases = allCases.items.filter(c => c.submissionId && submissionIdSet.has(c.submissionId));
      const nextCaseMap = new Map<string, string>();
      const nextStatusMap = new Map<string, string>();
      relevantCases.forEach((c) => {
        if (c.submissionId) {
          nextCaseMap.set(c.submissionId, c.id);
          nextStatusMap.set(c.submissionId, c.status);
        }
      });
      setCaseMap(nextCaseMap);
      setCaseStatusMap(nextStatusMap);
      
      // Fetch open requests for each case
      const requestsMap = new Map();
      await Promise.all(
        relevantCases.map(async (caseItem) => {
          try {
            const result = await getCaseInfoRequest(caseItem.id);
            if (result.request) {
              requestsMap.set(caseItem.submissionId, {
                caseId: caseItem.id,
                request: result.request,
              });
            }
          } catch (err) {
            // Ignore errors for individual requests
            console.warn(`[ConsoleDashboard] Failed to fetch request for case ${caseItem.id}:`, err);
          }
        })
      );
      
      setCaseRequests(requestsMap);
      await fetchEvidenceForCases(nextCaseMap);
      console.log('[ConsoleDashboard] Loaded case requests:', requestsMap.size);
    } catch (err) {
      console.error('[ConsoleDashboard] Failed to fetch case requests:', err);
    }
  };

  const fetchEvidenceForCases = async (caseIdMap: Map<string, string>) => {
    try {
      const evidenceEntries = await Promise.all(
        Array.from(caseIdMap.entries()).map(async ([submissionId, caseId]) => {
          try {
            const items = await listEvidence(caseId);
            return [submissionId, items] as const;
          } catch (err) {
            console.warn(`[ConsoleDashboard] Failed to list evidence for case ${caseId}:`, err);
            return [submissionId, []] as const;
          }
        })
      );
      const nextMap = new Map<string, EvidenceUploadItem[]>();
      evidenceEntries.forEach(([submissionId, items]) => {
        nextMap.set(submissionId, items);
      });
      setEvidenceMap(nextMap);
    } catch (err) {
      console.error('[ConsoleDashboard] Failed to fetch evidence lists:', err);
    }
  };

  // Load submissions on mount and refresh events
  useEffect(() => {
    // Refresh from API (cache already loaded in useState initializer)
    refreshSubmissions();

    // Listen for explicit refresh events
    const handleRefresh = () => {
      setIsRefreshing(true);
      refreshSubmissions().finally(() => setIsRefreshing(false));
    };

    // Listen for data change events from other parts of the app
    const handleDataChanged = (e: CustomEvent) => {
      if (e.detail?.type === 'submission' || e.detail?.type === 'case') {
        console.log('[ConsoleDashboard] Data changed, refreshing submissions...');
        refreshSubmissions({ silent: true });
      }
    };

    // Refresh on window focus (user returning to tab)
    const handleFocus = () => {
      console.log('[ConsoleDashboard] Window focused, refreshing submissions...');
      refreshSubmissions({ silent: true });
    };

    window.addEventListener('console-refresh-submissions', handleRefresh);
    window.addEventListener('acai:data-changed', handleDataChanged as EventListener);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('console-refresh-submissions', handleRefresh);
      window.removeEventListener('acai:data-changed', handleDataChanged as EventListener);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Handle submission deletion
  const handleDeleteSubmission = async (submissionId: string) => {
    setDeletingId(submissionId);
    try {
      await deleteSubmission(submissionId);
      
      // Remove from local state immediately (optimistic update)
      const updatedSubmissions = submissions.filter(s => s.id !== submissionId);
      setSubmissions(updatedSubmissions);
      setCachedSubmissions(updatedSubmissions);
      
      // Refresh work queue to remove cancelled case
      await refreshWorkQueue();
      
      // Dispatch data changed event for other components
      window.dispatchEvent(new CustomEvent('acai:data-changed', {
        detail: { type: 'submission', action: 'delete', id: submissionId }
      }));
      
      console.log('[ConsoleDashboard] Submission deleted and queue refreshed:', submissionId);
    } catch (err) {
      console.error('[ConsoleDashboard] Failed to delete submission:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete submission');
      // Revert optimistic update on error
      await refreshSubmissions();
    } finally {
      setDeletingId(null);
      setDeleteConfirmId(null);
    }
  };

  // Handle edit button click - navigate to form or open edit modal
  const handleEditSubmission = (submission: SubmissionRecord) => {
    const caseStatus = caseStatusMap.get(submission.id);
    if (caseStatus === 'approved' || caseStatus === 'blocked' || caseStatus === 'closed') {
      alert('This submission is finalized and cannot be edited.');
      return;
    }

    // Store case ID for potential resubmit after editing
    const requestInfo = caseRequests.get(submission.id);
    if (requestInfo) {
      sessionStorage.setItem('pendingResubmit', JSON.stringify({
        submissionId: submission.id,
        caseId: requestInfo.caseId,
      }));
    }
    
    // For now, show a simple alert - you can implement a modal or navigation
    // Navigation approach:
    if (submission.decisionType === 'csf_facility') {
      navigate(`/submit/csf-facility?submissionId=${submission.id}`);
    } else {
      // Generic approach: show alert for forms we haven't implemented edit for yet
      alert(`Edit functionality for ${submission.decisionType} coming soon.\nSubmission ID: ${submission.id}`);
    }
  };
  
  // Phase 4.1: Handle resubmit after editing
  const handleResubmit = async (submissionId: string, caseId: string) => {
    const caseStatus = caseStatusMap.get(submissionId);
    if (caseStatus === 'approved' || caseStatus === 'blocked' || caseStatus === 'closed') {
      alert('This submission is finalized and cannot be resubmitted.');
      return;
    }
    try {
      await resubmitCase(caseId, {
        submissionId: submissionId,
        note: 'Addressed requested information',
      });
      
      // Clear from session storage
      sessionStorage.removeItem('pendingResubmit');
      
      // Refresh data
      await refreshSubmissions();
      
      // Dispatch data-changed event
      window.dispatchEvent(new CustomEvent('acai:data-changed', {
        detail: { type: 'case', action: 'resubmit', id: caseId }
      }));
      window.dispatchEvent(new CustomEvent('acai:data-changed', {
        detail: { type: 'submission', action: 'resubmit', id: submissionId }
      }));
      
      showSuccess('Submission resubmitted successfully');
    } catch (error) {
      console.error('[ConsoleDashboard] Failed to resubmit:', error);
      alert(error instanceof Error ? error.message : 'Failed to resubmit');
    }
  };

  const handleUploadEvidence = async (submissionId: string, caseId: string, file: File) => {
    const nextUploading = new Map(uploadingMap);
    nextUploading.set(submissionId, true);
    setUploadingMap(nextUploading);

    try {
      await uploadEvidence(caseId, submissionId, file, currentUser?.name);
      showSuccess('Attachment uploaded');

      // Refresh evidence list for this submission
      const items = await listEvidence(caseId);
      const nextMap = new Map(evidenceMap);
      nextMap.set(submissionId, items);
      setEvidenceMap(nextMap);

      window.dispatchEvent(new CustomEvent('acai:data-changed', {
        detail: { type: 'case', action: 'evidence_uploaded', id: caseId }
      }));
    } catch (err) {
      console.error('[ConsoleDashboard] Failed to upload evidence:', err);
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      const doneMap = new Map(uploadingMap);
      doneMap.set(submissionId, false);
      setUploadingMap(doneMap);
    }
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };
  
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [requestInfoCaseId, setRequestInfoCaseId] = useState<string | null>(null);
  const [requestInfoMessage, setRequestInfoMessage] = useState("");
  const [queueFilter, setQueueFilter] = useState<"all" | "mine" | "unassigned" | "overdue">("all");
  const [slaFilter, setSlaFilter] = useState<"all" | "aging" | "breach">("all");
  const [assignMenuOpen, setAssignMenuOpen] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionOpen, setBulkActionOpen] = useState<string | null>(null);
  const [bulkRequestInfoMessage, setBulkRequestInfoMessage] = useState("");
  const [showBulkRequestInfoModal, setShowBulkRequestInfoModal] = useState(false);
  const [bulkActionSummary, setBulkActionSummary] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [policyOverrideOnly, setPolicyOverrideOnly] = useState(false);
  
  // Step 2.3: Queue search, sorting, and saved views
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [sortField, setSortField] = useState<SortField>((searchParams.get('sort') as SortField) || 'overdue');
  const [sortDirection, setSortDirection] = useState<SortDirection>((searchParams.get('dir') as SortDirection) || 'desc');
  const [decisionTypeFilter, setDecisionTypeFilter] = useState<string>(searchParams.get('decisionType') || 'all'); // Step 2.15
  const [savedViews, setSavedViews] = useState<QueueView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [showSaveViewModal, setShowSaveViewModal] = useState(false);
  const [showManageViewsModal, setShowManageViewsModal] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [setNewViewAsDefault, setSetNewViewAsDefault] = useState(false);
  
  // Get current user based on role
  const currentUser = getCurrentDemoUser(role);
  
  // Load work queue from API on mount
  useEffect(() => {
    // Refresh from API (cache already loaded in useState initializer)
    loadWorkQueue();

    // Listen for data change events
    const handleDataChanged = (e: CustomEvent) => {
      if (e.detail?.type === 'submission') {
        console.log('[ConsoleDashboard] Submission changed, refreshing work queue...');
        loadWorkQueue();
      }
    };

    // Refresh on window focus
    const handleFocus = () => {
      console.log('[ConsoleDashboard] Window focused, refreshing work queue...');
      loadWorkQueue();
    };

    window.addEventListener('acai:data-changed', handleDataChanged as EventListener);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('acai:data-changed', handleDataChanged as EventListener);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const loadWorkQueue = async () => {
    setIsLoading(true);
    try {
      // Fetch from API (excludes cancelled by default, ordered by created_at DESC)
      const response = await listCases({ limit: 1000 });

      let policyOverridesByTrace = new Map<string, { policy_action?: string; summary?: string }>();
      try {
        const safeFailures = await apiFetch<Array<{ trace_id: string; safe_failure: { policy_action?: string; summary?: string } }>>(
          "/api/policy/safe-failures/recent?limit=200"
        );
        policyOverridesByTrace = new Map(
          safeFailures.map((item) => [item.trace_id, item.safe_failure])
        );
      } catch (err) {
        console.warn("[ConsoleDashboard] Failed to load policy safe failures:", err);
      }
      
      // Map CaseRecord[] to WorkQueueItem[] display format - includes all fields, no need for demoStore lookup
      const displayItems: WorkQueueItem[] = response.items.map(caseRecord => {
        const traceId = caseRecord.submissionId || '';
        const override = policyOverridesByTrace.get(traceId);
        let overrideLabel: string | undefined;
        if (override?.policy_action === "block") {
          overrideLabel = "Policy blocked AI";
        } else if (override?.policy_action === "require_human") {
          overrideLabel = "Policy forced review";
        } else if (override?.policy_action === "escalate") {
          overrideLabel = "Policy escalated AI";
        } else if (override) {
          overrideLabel = "Policy override";
        }

        return {
        id: caseRecord.id, // STABLE KEY - use case.id not index
        trace_id: traceId,
        facility: caseRecord.title,
        reason: caseRecord.summary || '',
        age: formatAgeShort(new Date(caseRecord.createdAt)),
        priority: 'Medium', // Cases don't have priority field yet
        priorityColor: 'text-slate-600',
        policyOverride: Boolean(override),
        policyOverrideLabel: overrideLabel,
        // API fields - prevents need to look up demoStore
        status: caseRecord.status,
        assignedTo: caseRecord.assignedTo,
        decisionType: caseRecord.decisionType,
        dueAt: caseRecord.dueAt,
        createdAt: caseRecord.createdAt,
        age_hours: caseRecord.age_hours,
        sla_status: caseRecord.sla_status
      };
      });
      
      // Ensure no duplicates by using Map with id as key
      const deduped = Array.from(
        new Map(displayItems.map(item => [item.id, item])).values()
      );
      
      setWorkQueueItems(deduped);
      setCachedWorkQueue(deduped); // Cache successful response
      console.log(`[ConsoleDashboard] Loaded ${deduped.length} work queue items from API`);
    } catch (err) {
      console.error('[ConsoleDashboard] Failed to load work queue:', err);
      setError(err instanceof Error ? err.message : 'Failed to load work queue');
      // Keep cached data on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewTrace = async (traceId: string) => {
    if (!traceId) {
      console.error("[ConsoleDashboard] No trace_id provided");
      setError("Cannot open trace: missing trace ID");
      return;
    }
    
    setSelectedTraceId(traceId);
    setIsTraceOpen(true);
    setIsLoadingTrace(true);
    setSelectedTrace(null);

    try {
      const decisions = await apiFetch<Array<{
        trace_id: string;
        engine_family: string;
        decision_type: string;
        status: string;
        reason: string;
        risk_level?: string;
        created_at: string;
        decision: {
          status: string;
          reason: string;
          risk_level?: string;
        };
      }>>(`/decisions/trace/${traceId}`);

      if (!decisions || decisions.length === 0) {
        setError("No trace data found");
        return;
      }

      // Transform backend decision audit entries to TraceData format
      const firstDecision = decisions[0];
      const lastDecision = decisions[decisions.length - 1];
      
      const traceData: TraceData = {
        trace_id: traceId,
        tenant: "console",
        created_at: firstDecision.created_at,
        final_status: (lastDecision.status as "ok_to_ship" | "blocked" | "needs_review") || "needs_review",
        risk_level: (lastDecision.risk_level as "Low" | "Medium" | "High") || "Medium",
        scenario: `${firstDecision.decision_type} evaluation`,
        csf_type: (firstDecision.decision_type.includes("hospital") ? "Hospital" :
                   firstDecision.decision_type.includes("practitioner") ? "Practitioner" :
                   firstDecision.decision_type.includes("ems") ? "EMS" :
                   firstDecision.decision_type.includes("facility") ? "Facility" : "Researcher") as "Practitioner" | "Hospital" | "Researcher" | "Facility" | "EMS",
        total_duration_ms: 0,
        steps: decisions.map((dec, idx) => ({
          id: `step-${idx}`,
          timestamp: dec.created_at,
          label: `${dec.engine_family} - ${dec.decision_type}`,
          type: "decision" as const,
          status: (dec.status === "ok_to_ship" ? "success" : 
                   dec.status === "blocked" ? "error" : "warning") as "success" | "warning" | "error",
          details: {
            engine: dec.engine_family,
            result: dec.reason,
            response: dec.decision as unknown as Record<string, unknown>
          }
        }))
      };

      setSelectedTrace(traceData);
    } catch (err) {
      console.error("Failed to fetch trace:", err);
      setError(err instanceof Error ? err.message : "Failed to load trace");
    } finally {
      setIsLoadingTrace(false);
    }
  };

  const handleCloseTrace = () => {
    setIsTraceOpen(false);
    setSelectedTraceId(null);
    setSelectedTrace(null);
  };

  // Status transition handlers
  const handleStatusChange = (caseId: string, newStatus: WorkflowStatus) => {
    const item = demoStore.getWorkQueue().find((i) => i.id === caseId);
    if (!item) return;

    // Check if transition is allowed
    if (!canTransition(item.status as WorkflowStatus, newStatus, role)) {
      alert(`Cannot transition from ${item.status} to ${newStatus}`);
      return;
    }

    // Update work queue item status
    demoStore.updateWorkQueueItem(caseId, { status: newStatus });

    // Update submission status if linked
    if (item.submissionId) {
      const submissions = demoStore.getSubmissions();
      const subIndex = submissions.findIndex((s) => s.id === item.submissionId);
      if (subIndex !== -1) {
        submissions[subIndex].status = newStatus;
        demoStore.saveSubmissions(submissions);
      }
    }

    // Add audit event
    const actionMap: Record<WorkflowStatus, AuditAction> = {
      approved: "APPROVED",
      blocked: "BLOCKED",
      needs_review: "NEEDS_REVIEW",
      request_info: "REQUEST_INFO",
      submitted: "SUBMITTED",
    };

    demoStore.addAuditEvent({
      caseId,
      submissionId: item.submissionId,
      actorRole: role,
      actorName: role === "admin" ? "Admin" : "Verifier",
      action: actionMap[newStatus],
      message: newStatus === "approved" ? "All requirements met" : 
               newStatus === "blocked" ? "Missing required information" :
               newStatus === "needs_review" ? "Flagged for manual review" : undefined,
    });

    // Refresh work queue
    refreshWorkQueue();
  };

  const handleRequestInfo = () => {
    if (!requestInfoCaseId) return;

    handleStatusChange(requestInfoCaseId, "request_info");

    // Add note with request message
    if (requestInfoMessage.trim()) {
      demoStore.addAuditEvent({
        caseId: requestInfoCaseId,
        submissionId: demoStore.getWorkQueue().find((i) => i.id === requestInfoCaseId)?.submissionId,
        actorRole: role,
        actorName: role === "admin" ? "Admin" : "Verifier",
        action: "REQUEST_INFO",
        message: requestInfoMessage,
      });
    }

    setRequestInfoCaseId(null);
    setRequestInfoMessage("");
  };

  // Step 2.3: Load saved views on mount
  useEffect(() => {
    setSavedViews(viewStore.listViews());
  }, []);

  // Step 2.3: URL synchronization - update URL when state changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (sortField !== 'overdue') params.set('sort', sortField);
    if (sortDirection !== 'desc') params.set('dir', sortDirection);
    if (queueFilter !== 'all') params.set('filter', queueFilter);
    if (decisionTypeFilter !== 'all') params.set('decisionType', decisionTypeFilter); // Step 2.15
    
    // Use replace to avoid polluting history
    setSearchParams(params, { replace: true });
  }, [searchQuery, sortField, sortDirection, queueFilter, decisionTypeFilter, setSearchParams]);

  // Step 2.3: Filter, search, and sort work queue items
  const filteredAndSortedItems = useMemo(() => {
    let items = [...workQueueItems];
    
    // Apply queue filter (all, mine, unassigned, overdue)
    if (queueFilter === "mine" && currentUser) {
      items = items.filter((i) => i.assignedTo === currentUser.id);
    } else if (queueFilter === "unassigned") {
      items = items.filter((i) => !i.assignedTo);
    } else if (queueFilter === "overdue") {
      items = items.filter((i) => isOverdue(i.dueAt));
    } else if (queueFilter === "all") {
      items = items.filter((i) => !["approved", "blocked", "closed"].includes(i.status));
    }
    
    // Apply SLA filter
    if (slaFilter === "aging") {
      items = items.filter((i) => i.sla_status === "warning" || i.sla_status === "breach");
    } else if (slaFilter === "breach") {
      items = items.filter((i) => i.sla_status === "breach");
    }
    
    // Step 2.15: Apply decision type filter
    if (decisionTypeFilter !== 'all') {
      items = items.filter((i) => i.decisionType === decisionTypeFilter);
    }

    if (policyOverrideOnly) {
      items = items.filter((i) => i.policyOverride);
    }
    
    // Apply search query (multi-token AND logic)
    if (searchQuery.trim()) {
      const tokens = searchQuery.toLowerCase().trim().split(/\s+/);
      items = items.filter((item) => {
        const searchableText = [
          item.id,
          item.facility,
          item.reason,
          item.status,
          item.priority,
          item.assignedTo || '',
          item.trace_id || '',
        ].join(' ').toLowerCase();
        
        // All tokens must match
        return tokens.every((token) => searchableText.includes(token));
      });
    }
    
    // Apply sorting
    items.sort((a, b) => {
      let compareResult = 0;
      
      switch (sortField) {
        case 'overdue':
          const aOverdue = isOverdue(a.dueAt);
          const bOverdue = isOverdue(b.dueAt);
          if (aOverdue && !bOverdue) compareResult = -1;
          else if (!aOverdue && bOverdue) compareResult = 1;
          else {
            // Secondary: age
            compareResult = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          }
          break;
        case 'priority':
          const priorityOrder: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
          compareResult = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        case 'age':
          // Use age_hours if available, otherwise use createdAt
          if (a.age_hours !== undefined && b.age_hours !== undefined) {
            compareResult = a.age_hours - b.age_hours;
          } else {
            compareResult = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          }
          break;
        case 'status':
          compareResult = a.status.localeCompare(b.status);
          break;
        case 'assignee':
          const aAssignee = a.assignedTo || '';
          const bAssignee = b.assignedTo || '';
          compareResult = aAssignee.localeCompare(bAssignee);
          break;
      }
      
      return sortDirection === 'asc' ? compareResult : -compareResult;
    });

    return items;
  }, [workQueueItems, queueFilter, slaFilter, decisionTypeFilter, policyOverrideOnly, searchQuery, sortField, sortDirection, currentUser]);

  // Helper to refresh work queue display from API
  const refreshWorkQueue = async () => {
    console.log('[ConsoleDashboard] Refreshing work queue from API...');
    await loadWorkQueue();
  };

  // Assignment handlers
  const handleAssign = (caseId: string, user: DemoUser) => {
    demoStore.assignWorkQueueItem(
      caseId,
      { id: user.id, name: user.name },
      currentUser?.name || "Admin"
    );
    setAssignMenuOpen(null);
    refreshWorkQueue();
  };

  const handleUnassign = (caseId: string) => {
    demoStore.unassignWorkQueueItem(caseId, currentUser?.name || "Admin");
    setAssignMenuOpen(null);
    refreshWorkQueue();
  };

  // Selection helpers
  const toggleRowSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectAllVisible = () => {
    const visibleIds = new Set(workQueueItems.map((item) => item.id));
    setSelectedIds(visibleIds);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setBulkActionSummary(null);
  };

  const isAllVisibleSelected = workQueueItems.length > 0 && workQueueItems.every((item) => selectedIds.has(item.id));
  const isSomeSelected = selectedIds.size > 0 && !isAllVisibleSelected;

  // Bulk operations
  const handleBulkAssign = (user: DemoUser | null) => {
    let success = 0;
    selectedIds.forEach((caseId) => {
      if (user) {
        demoStore.assignWorkQueueItem(caseId, { id: user.id, name: user.name }, currentUser?.name || "Admin");
      } else {
        demoStore.unassignWorkQueueItem(caseId, currentUser?.name || "Admin");
      }
      success++;
    });
    setBulkActionOpen(null);
    refreshWorkQueue();
    clearSelection();
    setBulkActionSummary({ success, failed: 0, errors: [] });
    setTimeout(() => setBulkActionSummary(null), 5000);
  };

  const handleBulkStatusChange = (newStatus: WorkflowStatus) => {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    selectedIds.forEach((caseId) => {
      const item = demoStore.getWorkQueue().find((i) => i.id === caseId);
      if (!item) return;

      // Check transition validity
      if (!canTransition(item.status as WorkflowStatus, newStatus, role)) {
        failed++;
        errors.push(`${item.title}: Cannot transition from ${item.status} to ${newStatus}`);
        return;
      }

      // Update status
      demoStore.updateWorkQueueItem(caseId, { status: newStatus });

      // Update linked submission
      if (item.submissionId) {
        const submissions = demoStore.getSubmissions();
        const subIndex = submissions.findIndex((s) => s.id === item.submissionId);
        if (subIndex !== -1) {
          submissions[subIndex].status = newStatus;
          demoStore.saveSubmissions(submissions);
        }
      }

      // Add audit event
      const actionMap: Record<WorkflowStatus, AuditAction> = {
        approved: "APPROVED",
        blocked: "BLOCKED",
        needs_review: "NEEDS_REVIEW",
        request_info: "REQUEST_INFO",
        submitted: "SUBMITTED",
      };

      demoStore.addAuditEvent({
        caseId,
        submissionId: item.submissionId,
        actorRole: role,
        actorName: currentUser?.name || "Admin",
        action: actionMap[newStatus],
        message: `Bulk status change to ${newStatus}`,
      });

      success++;
    });

    setBulkActionOpen(null);
    refreshWorkQueue();
    clearSelection();
    setBulkActionSummary({ success, failed, errors });
    setTimeout(() => setBulkActionSummary(null), 5000);
  };

  const handleBulkRequestInfo = () => {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    selectedIds.forEach((caseId) => {
      const item = demoStore.getWorkQueue().find((i) => i.id === caseId);
      if (!item) return;

      // Check if transition to request_info is allowed
      if (!canTransition(item.status as WorkflowStatus, "request_info", role)) {
        failed++;
        errors.push(`${item.title}: Cannot request info from ${item.status} state`);
        return;
      }

      // Update status
      demoStore.updateWorkQueueItem(caseId, { status: "request_info" });

      // Update linked submission
      if (item.submissionId) {
        const submissions = demoStore.getSubmissions();
        const subIndex = submissions.findIndex((s) => s.id === item.submissionId);
        if (subIndex !== -1) {
          submissions[subIndex].status = "request_info";
          demoStore.saveSubmissions(submissions);
        }
      }

      // Add audit event
      demoStore.addAuditEvent({
        caseId,
        submissionId: item.submissionId,
        actorRole: role,
        actorName: currentUser?.name || "Admin",
        action: "REQUEST_INFO",
        message: bulkRequestInfoMessage || "Please provide the following missing information:",
      });

      success++;
    });

    setShowBulkRequestInfoModal(false);
    setBulkRequestInfoMessage("");
    refreshWorkQueue();
    clearSelection();
    setBulkActionSummary({ success, failed, errors });
    setTimeout(() => setBulkActionSummary(null), 5000);
  };

  const handleBulkExport = async () => {
    const packets: any[] = [];
    let success = 0;

    for (const caseId of Array.from(selectedIds)) {
      const item = demoStore.getWorkQueue().find((i) => i.id === caseId);
      if (!item || !item.submissionId) continue;

      const submission = demoStore.getSubmission(item.submissionId);
      if (!submission) continue;

      const packet = buildDecisionPacket(
        submission.decisionTrace || {},
        submission.payload || {},
        {
          submission_id: submission.id,
          trace_id: submission.traceId || "",
          tenant: submission.tenantId || "demo",
          csf_type: submission.csfType || submission.kind,
        }
      );

      packets.push(packet);
      success++;
    }

    // Download combined JSON file
    if (packets.length > 0) {
      const combined = {
        generatedAt: new Date().toISOString(),
        exportedBy: currentUser?.name || "Admin",
        totalPackets: packets.length,
        packets,
      };

      downloadJson(combined, `bulk-export-${packets.length}-packets-${Date.now()}.json`);
      setBulkActionSummary({ success, failed: 0, errors: [] });
      setTimeout(() => setBulkActionSummary(null), 5000);
    }

    clearSelection();
  };

  // Refresh queue when filter changes
  useEffect(() => {
    refreshWorkQueue();
    // Clear selection when filter changes
    clearSelection();
  }, [queueFilter]);

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedIds.size > 0) {
        clearSelection();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds]);

  // Step 2.3: View management handlers
  const handleSaveView = () => {
    if (!newViewName.trim()) return;

    const newView = viewStore.saveView({
      name: newViewName,
      query: searchQuery,
      filters: {
        status: queueFilter === 'all' ? undefined : [queueFilter],
        decisionType: decisionTypeFilter === 'all' ? undefined : decisionTypeFilter, // Step 2.15
      },
      sort: { field: sortField, direction: sortDirection },
      isDefault: setNewViewAsDefault,
    });

    setSavedViews(viewStore.listViews());
    setShowSaveViewModal(false);
    setNewViewName('');
    setSetNewViewAsDefault(false);
    setActiveViewId(newView.id);
  };

  const handleLoadView = (view: QueueView) => {
    setSearchQuery(view.query);
    setSortField(view.sort.field);
    setSortDirection(view.sort.direction);
    if (view.filters.status && view.filters.status.length > 0) {
      setQueueFilter(view.filters.status[0] as "all" | "mine" | "unassigned" | "overdue");
    }
    // Step 2.15: Restore decisionType filter
    if (view.filters.decisionType) {
      setDecisionTypeFilter(view.filters.decisionType);
    } else {
      setDecisionTypeFilter('all');
    }
    setActiveViewId(view.id);
  };

  const handleDeleteView = (viewId: string) => {
    viewStore.deleteView(viewId);
    setSavedViews(viewStore.listViews());
    if (activeViewId === viewId) {
      setActiveViewId(null);
    }
  };

  const handleSetDefaultView = (viewId: string) => {
    viewStore.setDefaultView(viewId);
    setSavedViews(viewStore.listViews());
  };

  // Step 2.3: Search handler with debouncing
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
  };

  return (
    <div className="console-shell">
      {/* Backend Health Banner */}
      <BackendHealthBanner className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-2xl" />
      
      {successMessage && (
        <div className="fixed top-16 right-6 z-50 rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {successMessage}
        </div>
      )}
      <TraceReplayDrawer
        isOpen={isTraceOpen}
        onClose={handleCloseTrace}
        trace={selectedTrace}
        isLoading={isLoadingTrace}
      />
      <CaseDetailsDrawer
        caseId={selectedCaseId}
        onClose={() => setSelectedCaseId(null)}
      />
      {/* Sidebar */}
      <aside className="console-sidebar">
        <div className="console-sidebar-logo">
          <div className="console-logo-circle">A</div>
          <div>
            <div className="console-logo-title">AutoComply AI</div>
            <div className="console-logo-subtitle">Compliance Console</div>
          </div>
        </div>

        <nav className="console-nav">
          <div className="console-nav-section">Overview</div>
          <button 
            className={`console-nav-item ${activeSection === "dashboard" ? "console-nav-item--active" : ""}`}
            onClick={() => setActiveSection("dashboard")}
          >
            Dashboard
          </button>
          <button 
            className={`console-nav-item ${activeSection === "csf" ? "console-nav-item--active" : ""}`}
            onClick={() => setActiveSection("csf")}
          >
            CSF Forms
          </button>
          <button 
            className={`console-nav-item ${activeSection === "licenses" ? "console-nav-item--active" : ""}`}
            onClick={() => setActiveSection("licenses")}
          >
            Licenses
          </button>
          <button 
            className={`console-nav-item ${activeSection === "orders" ? "console-nav-item--active" : ""}`}
            onClick={() => setActiveSection("orders")}
          >
            Orders & Approvals
          </button>
          <a 
            href="/console/rag"
            className="console-nav-item"
          >
            RAG Explorer
          </a>

          <div className="console-nav-section">Admin</div>
          <a 
            href="/coverage"
            className="console-nav-item"
          >
            Coverage
          </a>
          <a 
            href="/analytics"
            className="console-nav-item"
          >
            Analytics
          </a>
          <button 
            className={`console-nav-item ${activeSection === "settings" ? "console-nav-item--active" : ""}`}
            onClick={() => setActiveSection("settings")}
          >
            Settings
          </button>
          <button 
            className={`console-nav-item ${activeSection === "about" ? "console-nav-item--active" : ""}`}
            onClick={() => setActiveSection("about")}
          >
            About AutoComply
          </button>
        </nav>

        <div className="console-sidebar-footer">
          <div className="console-sidebar-pill">
            <span className="console-sidebar-pill-label">
              Environment
            </span>
            <span className="console-sidebar-pill-value">Sandbox</span>
          </div>
          <div className="console-sidebar-footer-text">
            Safe to demo. Decisions are simulated using test accounts and
            mock DEA data.
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="console-main">
        {/* Top header */}
        <header className="console-header">
          <div>
            <h1 className="console-page-title">
              {activeSection === "csf" ? "CSF Forms" :
               activeSection === "licenses" ? "License Management" :
               activeSection === "orders" ? "Orders & Approvals" :
               activeSection === "settings" ? "Settings" :
               activeSection === "about" ? "About AutoComply" :
               "Compliance snapshot"}
            </h1>
            <p className="console-page-subtitle">
              {activeSection === "csf" ? "Manage Practitioner, Hospital, and Researcher controlled substance forms." :
               activeSection === "licenses" ? "Monitor DEA, TDDD, and state pharmacy licenses for expiry windows." :
               activeSection === "orders" ? "View and manage controlled substance orders and approvals." :
               activeSection === "settings" ? "Configure your AutoComply AI environment." :
               activeSection === "about" ? "Learn more about AutoComply AI." :
               "One place to monitor controlled-substance risk, CSF pipeline, and license health across your accounts."}
            </p>
            {activeSection === "dashboard" && (
              <p className="mt-1 text-xs text-slate-500">
                Last updated: {new Date().toLocaleString("en-US", { 
                  month: "short", 
                  day: "numeric", 
                  year: "numeric", 
                  hour: "numeric", 
                  minute: "2-digit",
                  hour12: true 
                })}
              </p>
            )}
          </div>

          <div className="console-header-right">
            {isRefreshing && (
              <span className="text-xs text-slate-500">Refreshing...</span>
            )}
          </div>
        </header>

        {/* Dashboard Content */}
        {activeSection === "dashboard" && (
          <>
        {/* Hero row */}
        <section className="console-hero-row">
          <div className="console-hero-card">
            <div className="console-hero-top">
              <div>
                <div className="console-hero-label">
                  Today’s compliance posture
                </div>
                <div className="console-hero-score">Low risk</div>
              </div>
              <div className="console-hero-badge">
                98.5% of orders auto-cleared
              </div>
            </div>

            <div className="console-hero-metrics">
              <div className="console-hero-metric">
                <div className="console-hero-metric-label">
                  CSF decisions (24h)
                </div>
                <div className="console-hero-metric-value">42</div>
                <div className="console-hero-metric-sub">4 blocked</div>
              </div>
              <div className="console-hero-metric">
                <div className="console-hero-metric-label">
                  Licenses near expiry
                </div>
                <div className="console-hero-metric-value">2</div>
                <div className="console-hero-metric-sub">
                  Both flagged to admin
                </div>
              </div>
              <div className="console-hero-metric">
                <div className="console-hero-metric-label">
                  RAG explainer coverage
                </div>
                <div className="console-hero-metric-value">93%</div>
                <div className="console-hero-metric-sub">
                  Decisions with explainable reasons
                </div>
              </div>
            </div>

            <div className="console-hero-footer">
              <span className="console-hero-footer-pill">
                Uses Ohio TDDD + DEA rules
              </span>
              <span className="console-hero-footer-pill">
                Built-in audit trail for every CSF decision
              </span>
            </div>

            {/* Top drivers today */}
            <div className="mt-4 space-y-2">
              <h3 className="text-xs font-semibold text-slate-700">Top drivers today</h3>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
                  Valid DEA registrations: 38
                </span>
                <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800">
                  Missing TDDD license: 3
                </span>
                <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                  Pending attestations: 7
                </span>
                <span className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-800">
                  Schedule II orders: 12
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* KPI row */}
        <section className="console-kpis-row">
          <div className="console-kpi-card">
            <div className="console-kpi-title">Controlled substance orders</div>
            <div className="console-kpi-main">
              <span className="console-kpi-value">134</span>
              <span className="console-kpi-chip console-kpi-chip--positive">
                +12.8% vs yesterday
              </span>
            </div>
            <p className="console-kpi-subtext">
              Orders that flowed through AutoComply’s decision engine in the last 24 hours.
            </p>
          </div>

          <div className="console-kpi-card">
            <div className="console-kpi-title">CSF pipeline</div>
            <div className="console-kpi-tags">
              <span className="console-kpi-tag">Approved: 32</span>
              <span className="console-kpi-tag">In review: 7</span>
              <span className="console-kpi-tag console-kpi-tag--warn">
                Blocked: 3
              </span>
            </div>
            <p className="console-kpi-subtext">
              Real-time view of Practitioner, Hospital, and Researcher CSF forms.
            </p>
          </div>

          <div className="console-kpi-card">
            <div className="console-kpi-title">License health</div>
            <div className="console-kpi-main">
              <span className="console-kpi-value">24</span>
              <span className="console-kpi-chip console-kpi-chip--neutral">
                2 near expiry
              </span>
            </div>
            <p className="console-kpi-subtext">
              DEA, TDDD, and state pharmacy licenses monitored for expiry windows.
            </p>
          </div>
        </section>

        {/* Verification work queue - Verifier/Admin only */}
        {canViewWorkQueue(role) && (
          <section className="console-section">
            <div className="console-card">
              <div className="console-card-header">
                <div>
                  <h2 className="console-card-title">Verification work queue</h2>
                  <p className="console-card-subtitle">
                    Items flagged for manual review or compliance verification.
                  </p>
                </div>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                  {workQueueItems.length} items
                </span>
              </div>

              {/* Step 2.3: Search, Sort, and Saved Views */}
              <div className="flex flex-col gap-3 pt-4 pb-2 border-b border-slate-200">
                {/* Search Bar */}
                <div className="flex gap-2 items-center">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={handleSearchChange}
                      placeholder="Search cases (e.g., hospital ohio morphine)"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Sort Dropdown */}
                  <div className="relative">
                    <select
                      value={`${sortField}-${sortDirection}`}
                      onChange={(e) => {
                        const [field, dir] = e.target.value.split('-') as [SortField, SortDirection];
                        setSortField(field);
                        setSortDirection(dir);
                      }}
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="overdue-desc">⚠️ Overdue First</option>
                      <option value="priority-desc">🔴 Priority (High→Low)</option>
                      <option value="priority-asc">🔵 Priority (Low→High)</option>
                      <option value="age-desc">⏰ Newest First</option>
                      <option value="age-asc">⏰ Oldest First</option>
                      <option value="status-asc">📊 Status (A→Z)</option>
                      <option value="status-desc">📊 Status (Z→A)</option>
                      <option value="assignee-asc">👤 Assignee (A→Z)</option>
                      <option value="assignee-desc">👤 Assignee (Z→A)</option>
                    </select>
                  </div>

                  {/* Saved Views Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setShowManageViewsModal(!showManageViewsModal)}
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white hover:bg-slate-50 font-medium"
                    >
                      📁 Views
                    </button>
                    {showManageViewsModal && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowManageViewsModal(false)} />
                        <div className="absolute right-0 top-full mt-1 z-20 w-64 rounded-lg border border-slate-200 bg-white shadow-lg py-1">
                          {savedViews.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-slate-500 italic">No saved views</div>
                          ) : (
                            savedViews.map((view) => (
                              <div key={view.id} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50">
                                <button
                                  onClick={() => {
                                    handleLoadView(view);
                                    setShowManageViewsModal(false);
                                  }}
                                  className="flex-1 text-left text-xs font-medium text-slate-700"
                                >
                                  {view.isDefault && "⭐ "}
                                  {view.name}
                                </button>
                                <button
                                  onClick={() => handleDeleteView(view.id)}
                                  className="ml-2 text-xs text-red-600 hover:text-red-800"
                                >
                                  🗑️
                                </button>
                              </div>
                            ))
                          )}
                          <div className="border-t border-slate-200 mt-1 pt-1">
                            <button
                              onClick={() => {
                                setShowManageViewsModal(false);
                                setShowSaveViewModal(true);
                              }}
                              className="w-full text-left px-3 py-2 text-xs font-medium text-sky-600 hover:bg-sky-50"
                            >
                              + Save Current View
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Queue Filters */}
              <div className="flex gap-2 pt-2 pb-2 border-b border-slate-200">
                <button
                  onClick={() => setQueueFilter("all")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    queueFilter === "all"
                      ? "bg-sky-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  All
                </button>
                {currentUser && (
                  <button
                    onClick={() => setQueueFilter("mine")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      queueFilter === "mine"
                        ? "bg-sky-600 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    My Cases
                  </button>
                )}
                <button
                  onClick={() => setQueueFilter("unassigned")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    queueFilter === "unassigned"
                      ? "bg-sky-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Unassigned
                </button>
                <button
                  onClick={() => setQueueFilter("overdue")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    queueFilter === "overdue"
                      ? "bg-sky-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Overdue
                </button>
                <button
                  onClick={() => setPolicyOverrideOnly((prev) => !prev)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    policyOverrideOnly
                      ? "bg-amber-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Policy overrides
                </button>
              </div>
              
              {/* Step 2.15: Decision Type Filters */}
              <div className="flex gap-2 pt-2 pb-2 border-b border-slate-200">
                <span className="text-xs font-medium text-slate-600 flex items-center pr-2">Decision Type:</span>
                <button
                  onClick={() => setDecisionTypeFilter("all")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    decisionTypeFilter === "all"
                      ? "bg-sky-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  All Types
                </button>
                <button
                  onClick={() => setDecisionTypeFilter("csf_practitioner")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    decisionTypeFilter === "csf_practitioner"
                      ? "bg-sky-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  CSF Practitioner
                </button>
                <button
                  onClick={() => setDecisionTypeFilter("ohio_tddd")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    decisionTypeFilter === "ohio_tddd"
                      ? "bg-sky-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Ohio TDDD
                </button>
                <button
                  onClick={() => setDecisionTypeFilter("ny_pharmacy_license")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    decisionTypeFilter === "ny_pharmacy_license"
                      ? "bg-sky-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  NY Pharmacy
                </button>
                <button
                  onClick={() => setDecisionTypeFilter("csf_facility")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    decisionTypeFilter === "csf_facility"
                      ? "bg-sky-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  CSF Facility
                </button>
              </div>
              
              {/* SLA Filters */}
              <div className="flex gap-2 pt-2 pb-2 border-b border-slate-200">
                <span className="text-xs font-medium text-slate-600 flex items-center pr-2">SLA Status:</span>
                <button
                  onClick={() => setSlaFilter("all")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    slaFilter === "all"
                      ? "bg-sky-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setSlaFilter("aging")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    slaFilter === "aging"
                      ? "bg-amber-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Aging (Warning/Breach)
                </button>
                <button
                  onClick={() => setSlaFilter("breach")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    slaFilter === "breach"
                      ? "bg-red-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Breach Only
                </button>
              </div>

              {/* Bulk Action Bar */}
              {selectedIds.size > 0 && (
                <div className="sticky top-0 z-10 bg-sky-50 border-b border-sky-200 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-sky-900">
                      {selectedIds.size} selected
                    </span>
                    {bulkActionSummary && (
                      <span className="text-xs text-sky-700">
                        ✓ Updated {bulkActionSummary.success}
                        {bulkActionSummary.failed > 0 && `, skipped ${bulkActionSummary.failed}`}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {/* Bulk Assign */}
                    {(isVerifier || isAdmin) && (
                      <div className="relative">
                        <button
                          onClick={() => setBulkActionOpen(bulkActionOpen === "assign" ? null : "assign")}
                          className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-50"
                        >
                          👤 Assign
                        </button>
                        {bulkActionOpen === "assign" && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setBulkActionOpen(null)} />
                            <div className="absolute left-0 top-full mt-1 z-20 w-48 rounded-lg border border-slate-200 bg-white shadow-lg py-1">
                              <button
                                onClick={() => handleBulkAssign(null)}
                                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                              >
                                Unassigned
                              </button>
                              {DEMO_VERIFIERS.map((user) => (
                                <button
                                  key={user.id}
                                  onClick={() => handleBulkAssign(user)}
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

                    {/* Bulk Status */}
                    {(isVerifier || isAdmin) && (
                      <div className="relative">
                        <button
                          onClick={() => setBulkActionOpen(bulkActionOpen === "status" ? null : "status")}
                          className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-50"
                        >
                          📋 Set Status
                        </button>
                        {bulkActionOpen === "status" && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setBulkActionOpen(null)} />
                            <div className="absolute left-0 top-full mt-1 z-20 w-48 rounded-lg border border-slate-200 bg-white shadow-lg py-1">
                              <button
                                onClick={() => handleBulkStatusChange("approved")}
                                className="w-full text-left px-3 py-2 text-xs text-green-700 hover:bg-green-50"
                              >
                                ✓ Approved
                              </button>
                              <button
                                onClick={() => handleBulkStatusChange("needs_review")}
                                className="w-full text-left px-3 py-2 text-xs text-amber-700 hover:bg-amber-50"
                              >
                                ⚠ Needs Review
                              </button>
                              <button
                                onClick={() => handleBulkStatusChange("blocked")}
                                className="w-full text-left px-3 py-2 text-xs text-red-700 hover:bg-red-50"
                              >
                                ✕ Blocked
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Bulk Request Info */}
                    {(isVerifier || isAdmin) && (
                      <button
                        onClick={() => {
                          setBulkRequestInfoMessage("Please provide the following missing information:");
                          setShowBulkRequestInfoModal(true);
                        }}
                        className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-50"
                      >
                        📝 Request Info
                      </button>
                    )}

                    {/* Bulk Export */}
                    <button
                      onClick={handleBulkExport}
                      className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-50"
                    >
                      💾 Export
                    </button>

                    {/* Clear Selection */}
                    <button
                      onClick={clearSelection}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {/* Select All Header */}
              {workQueueItems.length > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200">
                  <input
                    type="checkbox"
                    checked={isAllVisibleSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isSomeSelected;
                    }}
                    onChange={(e) => {
                      if (e.target.checked) {
                        selectAllVisible();
                      } else {
                        clearSelection();
                      }
                    }}
                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <span className="text-xs text-slate-600">
                    {isAllVisibleSelected ? "All selected" : isSomeSelected ? "Some selected" : "Select all"}
                  </span>
                </div>
              )}

            <div className="max-h-[520px] overflow-y-auto pr-2 space-y-3 pt-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-sm text-slate-500">Loading work queue...</div>
                </div>
              ) : error && workQueueItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 max-w-md">
                    <div className="text-sm font-semibold text-red-700 mb-1">Failed to load work queue</div>
                    <div className="text-xs text-red-600">{error}</div>
                  </div>
                  <button
                    onClick={() => window.location.reload()}
                    className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
                  >
                    Retry
                  </button>
                </div>
              ) : filteredAndSortedItems.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-sm text-slate-500">No items in verification queue</div>
                </div>
              ) : (
                filteredAndSortedItems.map((item) => {
                  // Use item fields directly from API - no demoStore lookup needed
                  const allowedTransitions = getAllowedTransitions(item.status as WorkflowStatus, role);
                  
                  return (
                  <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start gap-3 mb-3">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleRowSelection(item.id)}
                        className="mt-1 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      />
                      
                      <div className="flex-1 flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-slate-900">
                              {item.facility}
                            </span>
                            {/* Decision Type Badge - from API */}
                            {(() => {
                              const typeDisplay = getDecisionTypeDisplay(item.decisionType);
                              return (
                                <span className={`px-2 py-0.5 text-xs font-medium rounded ${typeDisplay.colorClass}`}>
                                  {typeDisplay.label}
                                </span>
                              );
                            })()}
                            {/* SLA Status Badge */}
                            {item.sla_status && item.sla_status !== 'ok' && (
                              <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                                item.sla_status === 'breach' ? 'bg-red-100 text-red-800' :
                                item.sla_status === 'warning' ? 'bg-amber-100 text-amber-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {item.sla_status === 'breach' ? '🔴 Breach' :
                                 item.sla_status === 'warning' ? '⚠️ Aging' :
                                 '✓ OK'}
                              </span>
                            )}
                            {item.policyOverride && (
                              <span className="px-2 py-0.5 text-xs font-medium rounded bg-amber-100 text-amber-800" title={item.policyOverrideLabel}>
                                {item.policyOverrideLabel ?? "Policy override"}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-600">
                          {item.reason}
                        </div>
                        
                        {/* Info Grid: Age, SLA, Priority, Assignee */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs pt-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500">Age:</span>
                            <span className="font-medium text-slate-700">
                              {item.age_hours !== undefined 
                                ? `${Math.floor(item.age_hours)}h` 
                                : item.age}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500">SLA:</span>
                            <span className={getSlaStatusColor(item.dueAt)}>
                              {formatDue(item.dueAt)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500">Priority:</span>
                            <span className={item.priorityColor}>{item.priority}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500">Assigned:</span>
                            {item.assignedTo ? (
                              <span className="font-medium text-slate-700">{item.assignedTo}</span>
                            ) : (
                              <span className="text-slate-400 italic">Unassigned</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedCaseId(item.id)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        title="View case details and timeline"
                      >
                        View Details
                      </button>
                      </div>
                    </div>
                    
                    {/* Action Buttons - Verifier/Admin only */}
                    {(isVerifier || isAdmin) && (
                      <div className="flex gap-2 pt-3 border-t border-slate-200 ml-9">
                        {/* Assignment Dropdown */}
                        <div className="relative">
                          <button
                            onClick={() => setAssignMenuOpen(assignMenuOpen === item.id ? null : item.id)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                          >
                            👤 Assign
                          </button>
                          {assignMenuOpen === item.id && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setAssignMenuOpen(null)}
                              />
                              <div className="absolute left-0 top-full mt-1 z-20 w-48 rounded-lg border border-slate-200 bg-white shadow-lg py-1">
                                <button
                                  onClick={() => handleUnassign(item.id)}
                                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                                >
                                  Unassigned
                                </button>
                                {DEMO_VERIFIERS.map((user) => (
                                  <button
                                    key={user.id}
                                    onClick={() => handleAssign(item.id, user)}
                                    className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                                  >
                                    {user.name}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                        
                        {/* Status Transition Buttons */}
                        {allowedTransitions.length > 0 && (
                          <>
                        {allowedTransitions.includes("approved") && (
                          <button
                            onClick={() => handleStatusChange(item.id, "approved")}
                            className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700"
                          >
                            ✓ Approve
                          </button>
                        )}
                        {allowedTransitions.includes("needs_review") && (
                          <button
                            onClick={() => handleStatusChange(item.id, "needs_review")}
                            className="flex-1 rounded-lg bg-amber-600 px-3 py-2 text-xs font-medium text-white hover:bg-amber-700"
                          >
                            ⚠ Needs Review
                          </button>
                        )}
                        {allowedTransitions.includes("blocked") && (
                          <button
                            onClick={() => handleStatusChange(item.id, "blocked")}
                            className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700"
                          >
                            ✕ Block
                          </button>
                        )}
                        {allowedTransitions.includes("request_info") && (
                          <button
                            onClick={() => {
                              setRequestInfoCaseId(item.id);
                              setRequestInfoMessage("Please provide the following missing information:");
                            }}
                            className="flex-1 rounded-lg bg-purple-600 px-3 py-2 text-xs font-medium text-white hover:bg-purple-700"
                          >
                            📝 Request Info
                          </button>
                        )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
        )}

        {/* My Submissions - Submitter only */}
        {isSubmitter && (
          <section className="console-section">
            <div className="console-card">
              <div className="console-card-header">
                <div>
                  <h2 className="console-card-title">My submissions</h2>
                  <p className="console-card-subtitle">
                    Track your submitted CSFs and see their current status.
                  </p>
                </div>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                  {submissions.length} total
                </span>
              </div>

              <div className="max-h-[520px] overflow-y-auto pr-2 space-y-3 pt-4">
                {isLoadingSubmissions ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-2">
                    <div className="text-sm text-slate-500">Loading submissions...</div>
                  </div>
                ) : submissions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-2">
                    <div className="text-sm text-slate-500">No submissions yet</div>
                    <div className="text-xs text-slate-400">Submit a CSF form to see it here</div>
                  </div>
                ) : (
                  submissions.slice(0, 10).map((submission) => {
                    const requestInfo = caseRequests.get(submission.id);
                    const caseId = caseMap.get(submission.id);
                    const caseStatus = caseStatusMap.get(submission.id);
                    const isFinalDecision = caseStatus === 'approved' || caseStatus === 'blocked' || caseStatus === 'closed';
                    const evidenceItems = evidenceMap.get(submission.id) || [];
                    const isUploading = uploadingMap.get(submission.id) || false;
                    
                    return (
                    <div key={submission.id} className="space-y-2">
                      {/* Info Request Banner - Phase 4.1 */}
                      {requestInfo && (
                        <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-3">
                          <div className="flex items-start gap-2">
                            <span className="text-lg">📝</span>
                            <div className="flex-1">
                              <div className="font-semibold text-amber-900 text-sm mb-1">
                                Action Required: Additional Information Requested
                              </div>
                              <div className="text-xs text-amber-800 mb-2">
                                {requestInfo.request.message}
                              </div>
                              {requestInfo.request.requiredFields && requestInfo.request.requiredFields.length > 0 && (
                                <div className="text-xs text-amber-700 mb-2">
                                  <span className="font-medium">Required fields:</span> {requestInfo.request.requiredFields.join(', ')}
                                </div>
                              )}
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleEditSubmission(submission)}
                                  disabled={isFinalDecision}
                                  className={`rounded-lg px-3 py-1.5 text-xs font-medium text-white ${
                                    isFinalDecision ? 'bg-slate-300 cursor-not-allowed' : 'bg-slate-600 hover:bg-slate-700'
                                  }`}
                                >
                                  1. Edit Submission
                                </button>
                                <button
                                  onClick={() => handleResubmit(submission.id, requestInfo.caseId)}
                                  disabled={isFinalDecision}
                                  className={`rounded-lg px-3 py-1.5 text-xs font-medium text-white ${
                                    isFinalDecision ? 'bg-slate-300 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-700'
                                  }`}
                                >
                                  2. Resubmit to Verifier
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Submission Card */}
                      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="flex-1 space-y-1">
                        <div className="text-sm font-medium text-slate-900">
                          {submission.decisionType === 'practitioner_csf' 
                            ? `Dr. ${submission.formData?.practitioner?.lastName || 'Unknown'} - ${submission.formData?.practitioner?.facilityName || 'Unknown Facility'}`
                            : submission.decisionType === 'hospital_csf'
                            ? submission.formData?.hospital?.facilityName || 'Unknown Hospital'
                            : `Submission ${submission.id}`
                          }
                        </div>
                        <div className="text-xs text-slate-600">
                          Type: {submission.decisionType === 'practitioner_csf' ? 'Practitioner CSF' : 'Hospital CSF'}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span>{new Date(submission.createdAt).toLocaleDateString()}</span>
                          <span>•</span>
                          <span className={
                            caseStatus === 'approved' ? 'text-green-600 font-medium' :
                            caseStatus === 'blocked' ? 'text-red-600 font-medium' :
                            'text-amber-600 font-medium'
                          }>
                            {caseStatus === 'approved' ? '✓ Approved' :
                             caseStatus === 'blocked' ? '✗ Rejected' :
                             '⏳ Under Review'}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditSubmission(submission)}
                          disabled={submission.isDeleted || isFinalDecision}
                          className={`rounded-lg px-3 py-2 text-sm font-medium text-white ${
                            submission.isDeleted || isFinalDecision ? 'bg-slate-300 cursor-not-allowed' : 'bg-slate-600 hover:bg-slate-700'
                          }`}
                          title="Edit submission"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(submission.id)}
                          className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete submission"
                          disabled={deletingId === submission.id || submission.isDeleted}
                        >
                          {deletingId === submission.id ? 'Deleting...' : 'Delete'}
                        </button>
                        <a
                          href={`/console/rag?mode=connected&submissionId=${submission.id}&autoload=1`}
                          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 inline-block text-center"
                          title="View decision details"
                        >
                          View details
                        </a>
                      </div>
                    </div>
                    
                    {/* Attachments */}
                    {caseId && (
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs font-semibold text-slate-700">Attachments</div>
                          <div className="text-xs text-slate-500">{evidenceItems.length} files</div>
                        </div>
                        {evidenceItems.length === 0 ? (
                          <div className="text-xs text-slate-500">No attachments yet</div>
                        ) : (
                          <div className="space-y-1">
                            {evidenceItems.map((item) => (
                              <div key={item.id} className="flex items-center justify-between text-xs text-slate-700">
                                <span className="truncate">{item.filename}</span>
                                <a
                                  href={getEvidenceDownloadUrl(item.id)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sky-600 hover:text-sky-700"
                                >
                                  Download
                                </a>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="file"
                            accept="application/pdf,image/jpeg,image/png"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file && caseId) {
                                handleUploadEvidence(submission.id, caseId, file);
                              }
                              e.currentTarget.value = '';
                            }}
                            className="text-xs"
                            disabled={isUploading}
                          />
                          {isUploading && (
                            <span className="text-xs text-slate-500">Uploading...</span>
                          )}
                        </div>
                      </div>
                    )}
                    </div>
                  );
                  })
                )}
              </div>
            </div>
          </section>
        )}

        {/* Lower row: table + alerts */}
        <section className="console-lower-row">
          {/* Recent decisions - Verifier/Admin only */}
          {canViewRecentDecisions(role) && (
            <div className="console-card console-decisions-card">
            <div className="console-card-header">
              <div>
                <h2 className="console-card-title">Recent decisions</h2>
                <p className="console-card-subtitle">
                  Traceable CSF and license decisions, ready for audit.
                </p>
              </div>
              <button className="console-ghost-button console-card-button">
                View full decision log
              </button>
            </div>

            <div className="console-table-wrapper">
              <table className="console-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Scenario</th>
                    <th>Status</th>
                    <th>Risk</th>
                    <th>CSF Type</th>
                    <th>Trace</th>
                    <th>Export</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_DECISIONS.map((row) => (
                    <tr key={row.id}>
                      <td>{row.timestamp}</td>
                      <td>{row.scenario}</td>
                      <td>
                        <span
                          className={`console-status-pill console-status-pill--${row.status}`}
                        >
                          {row.status === "ok_to_ship"
                            ? "Ok to ship"
                            : row.status === "blocked"
                            ? "Blocked"
                            : "Needs review"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`console-risk-pill console-risk-pill--${row.riskLevel.toLowerCase()}`}
                        >
                          {row.riskLevel}
                        </span>
                      </td>
                      <td>{row.csfType}</td>
                      <td>
                        <a
                          href={`/console/rag?mode=connected&traceId=${row.traceId}`}
                          className="console-link-button"
                        >
                          Open trace
                        </a>
                      </td>
                      <td>
                        <button
                          onClick={() => {
                            const packet = buildDecisionPacket({
                              trace: {
                                trace_id: row.traceId,
                                submission_id: row.id,
                                status: row.status,
                                risk_level: row.riskLevel,
                                csf_type: row.csfType,
                                scenario_name: row.scenario,
                                tenant: 'demo',
                                outcome: row.status === 'ok_to_ship' ? 'approved' : row.status === 'blocked' ? 'blocked' : 'needs_review',
                                fired_rules: [],
                                source_type: 'recent_decision'
                              }
                            });
                            downloadJson(packet);
                          }}
                          className="console-link-button"
                          title="Download decision packet as JSON"
                        >
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          )}

          {/* Submitter Guidance - Submitter only */}
          {isSubmitter && (
            <div className="console-card console-decisions-card">
              <div className="console-card-header">
                <div>
                  <h2 className="console-card-title">📋 Submitter guidance</h2>
                  <p className="console-card-subtitle">
                    Tips for successful CSF submissions
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <div className="text-sm font-semibold text-blue-900 mb-2">✅ What makes a good submission?</div>
                  <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                    <li>Complete practitioner information (name, NPI, DEA, licenses)</li>
                    <li>Valid facility details with address and TDDD</li>
                    <li>Current license expiration dates (within compliance window)</li>
                    <li>Accurate controlled substance schedules if applicable</li>
                  </ul>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div className="text-sm font-semibold text-amber-900 mb-2">⚠️ Common reasons for review</div>
                  <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
                    <li>Missing NPI, DEA, or state license numbers</li>
                    <li>License expiring within 90 days</li>
                    <li>Schedule II controlled substances without valid DEA</li>
                    <li>Out-of-state practitioners needing reciprocity check</li>
                  </ul>
                </div>

                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <div className="text-sm font-semibold text-green-900 mb-2">💡 Pro tips</div>
                  <ul className="text-xs text-green-800 space-y-1 list-disc list-inside">
                    <li>Double-check license numbers before submitting</li>
                    <li>Verify facility TDDD is current and valid</li>
                    <li>Review expiration dates to avoid delays</li>
                    <li>Submit early to allow time for any needed corrections</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Alerts & tasks */}
          <div className="console-card console-alerts-card">
            <div className="console-card-header">
              <div>
                <h2 className="console-card-title">Alerts & tasks</h2>
                <p className="console-card-subtitle">
                  What compliance teams should focus on next.
                </p>
              </div>
            </div>

            <div className="console-alerts-section">
              <h3 className="console-alerts-title">
                Licenses expiring in 30 days
              </h3>
              <ul className="console-alert-list">
                {MOCK_EXPIRING_LICENSES.map((row) => (
                  <li key={row.id} className="console-alert-item">
                    <div>
                      <div className="console-alert-main">
                        {row.accountName}
                      </div>
                      <div className="console-alert-meta">
                        {row.licenseType} · {row.jurisdiction}
                      </div>
                    </div>
                    <div className="console-alert-right">
                      <span className="console-alert-date">
                        {row.expiresOn}
                      </span>
                      <span className="console-alert-pill">
                        {row.daysRemaining} days left
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="console-alerts-section">
              <h3 className="console-alerts-title">
                Missing CSF attestations
              </h3>
              <p className="console-alerts-body">
                3 practitioner forms and 1 hospital form have missing or
                outdated attestations. These are already blocked in the CSF
                pipeline and surfaced here so admins can follow up before
                orders are placed.
              </p>
            </div>

            <div className="console-alerts-section">
              <h3 className="console-alerts-title">RAG source review</h3>
              <p className="console-alerts-body">
                2 regulatory artifacts were updated in the last 7 days.
                Use the RAG Explorer to validate that explanations still
                match Ohio TDDD and DEA language.
              </p>
              <a href="/console/rag" className="console-ghost-button console-card-button">
                Open RAG Explorer
              </a>
            </div>
          </div>
        </section>
          </>
        )}

        {/* Placeholder sections for other nav items */}
        {activeSection === "csf" && (
          <div className="console-section">
            <div className="console-card">
              <div className="p-8 text-center text-slate-500">
                <p className="text-lg font-medium">CSF Forms section coming soon</p>
                <p className="mt-2 text-sm">This will show Practitioner, Hospital, and Researcher CSF form management.</p>
              </div>
            </div>
          </div>
        )}
        {activeSection === "licenses" && (
          <div className="console-section">
            <div className="console-card">
              <div className="p-8 text-center text-slate-500">
                <p className="text-lg font-medium">License Management section coming soon</p>
                <p className="mt-2 text-sm">This will show DEA, TDDD, and state pharmacy license monitoring.</p>
              </div>
            </div>
          </div>
        )}
        {activeSection === "orders" && (
          <div className="console-section">
            <div className="console-card">
              <div className="p-8 text-center text-slate-500">
                <p className="text-lg font-medium">Orders & Approvals section coming soon</p>
                <p className="mt-2 text-sm">This will show controlled substance order tracking and approval workflows.</p>
              </div>
            </div>
          </div>
        )}
        {activeSection === "settings" && (
          <div className="console-section">
            <div className="console-card">
              <div className="p-8 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Console Settings</h3>
                  <p className="text-sm text-slate-600">Configure your AutoComply AI environment and preferences.</p>
                </div>
                
                {/* Admin Reset Panel - Only for Admin Users */}
                {role === "admin" && (
                  <div className="border-t border-slate-200 pt-6">
                    <h4 className="text-md font-semibold text-slate-900 mb-4">Admin Tools</h4>
                    <AdminResetPanel 
                      onResetComplete={() => {
                        // Refresh the page or reload work queue
                        window.location.reload();
                      }} 
                    />
                  </div>
                )}
                
                {role !== "admin" && (
                  <div className="text-center text-slate-500 pt-8">
                    <p className="text-sm">Additional settings coming soon...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {activeSection === "about" && (
          <div className="console-section">
            <div className="console-card">
              <div className="p-8 text-center text-slate-500">
                <p className="text-lg font-medium">About AutoComply section coming soon</p>
                <p className="mt-2 text-sm">Learn more about AutoComply AI architecture and capabilities.</p>
              </div>
            </div>
          </div>
        )}
      </main>
      
      {/* Request Info Modal */}
      {requestInfoCaseId && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setRequestInfoCaseId(null)}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                Request Missing Information
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                Provide a message to the submitter explaining what information is needed.
              </p>
              <textarea
                value={requestInfoMessage}
                onChange={(e) => setRequestInfoMessage(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                rows={5}
                placeholder="Example: Please provide the following missing information:&#10;- Valid DEA number&#10;- Current state medical license&#10;- Facility TDDD verification"
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
                    setRequestInfoCaseId(null);
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

      {/* Bulk Request Info Modal */}
      {showBulkRequestInfoModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowBulkRequestInfoModal(false)}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                Bulk Request Missing Information
              </h3>
              <p className="text-sm text-slate-600 mb-2">
                Send a request for missing information to {selectedIds.size} selected case{selectedIds.size > 1 ? 's' : ''}.
              </p>
              <p className="text-xs text-slate-500 mb-4">
                This message will be sent to all selected cases. Cases that cannot transition to "request_info" will be skipped.
              </p>
              <textarea
                value={bulkRequestInfoMessage}
                onChange={(e) => setBulkRequestInfoMessage(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                rows={5}
                placeholder="Example: Please provide the following missing information:&#10;- Valid DEA number&#10;- Current state medical license&#10;- Facility TDDD verification"
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleBulkRequestInfo}
                  className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
                >
                  Send to {selectedIds.size} Case{selectedIds.size > 1 ? 's' : ''}
                </button>
                <button
                  onClick={() => {
                    setShowBulkRequestInfoModal(false);
                    setBulkRequestInfoMessage("");
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

      {/* Step 2.3: Save View Modal */}
      {showSaveViewModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowSaveViewModal(false)}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                Save Current View
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                Save your current search, filters, and sort settings as a reusable view.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  View Name
                </label>
                <input
                  type="text"
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  placeholder="e.g., Overdue Hospital Cases"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="mb-4">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={setNewViewAsDefault}
                    onChange={(e) => setSetNewViewAsDefault(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Set as default view
                </label>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSaveView}
                  disabled={!newViewName.trim()}
                  className="flex-1 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save View
                </button>
                <button
                  onClick={() => {
                    setShowSaveViewModal(false);
                    setNewViewName('');
                    setSetNewViewAsDefault(false);
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

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setDeleteConfirmId(null)}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Delete Submission?</h3>
              <p className="text-sm text-slate-600 mb-4">
                This will permanently delete the submission and cancel the linked case. This action cannot be undone.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-amber-800">
                  <strong>Note:</strong> You can only delete submissions that haven't been assigned to a reviewer yet.
                </p>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
                  disabled={deletingId !== null}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteSubmission(deleteConfirmId)}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                  disabled={deletingId !== null}
                >
                  {deletingId ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ConsoleDashboard;

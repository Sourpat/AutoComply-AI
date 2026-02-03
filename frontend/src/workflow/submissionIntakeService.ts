/**
 * Submission Intake Service
 * 
 * ============================================================================
 * Step 2.8: End-to-End Submission -> Case Creation -> Connected RAG Evidence
 * WITH BACKEND API INTEGRATION (Auto-fallback to localStorage)
 * ============================================================================
 * 
 * PURPOSE:
 * Orchestrates the intake of a compliance submission into the verification
 * workflow. Creates a work queue case, attaches RAG evidence, and writes
 * comprehensive audit events.
 * 
 * WORKFLOW (Backend Mode - when API available):
 * 1. Check backend health (2s timeout)
 * 2. Retrieve submission from backend/localStorage
 * 3. POST /workflow/cases (creates case with submission_id, SLA, due_at)
 * 4. Query RAG API for evidence
 * 5. POST /workflow/cases/{caseId}/evidence/attach (persists evidence)
 * 6. Backend auto-creates audit events (case_created, evidence_attached)
 * 7. Return caseId for navigation
 * 
 * WORKFLOW (LocalStorage Mode - when backend unavailable):
 * 1. Retrieve submission from localStorage
 * 2. Create WorkQueueItem via demoStore
 * 3. Query RAG API for evidence
 * 4. Store evidence in case metadata
 * 5. Manually write audit events (SUBMITTED, NOTE_ADDED x2)
 * 6. Return caseId for navigation
 * 
 * INTEGRATION POINTS:
 * - Backend API: /workflow/health, /workflow/cases, /workflow/cases/{id}/evidence/attach
 * - submissionStore: Read/create SubmissionRecord (via selector with fallback)
 * - workflowStore: Create WorkQueueItem (localStorage fallback)
 * - RAG API: /rag/regulatory/search for evidence (unchanged)
 * - SLA calculation: Auto-set due dates
 * 
 * ============================================================================
 * BACKEND INTEGRATION VERIFICATION CHECKLIST:
 * ============================================================================
 * 
 * SETUP:
 * [ ] Backend running: cd backend && .venv\Scripts\python -m uvicorn src.api.main:app --host 127.0.0.1 --port 8001
 * [ ] Frontend running: cd frontend && npm run dev
 * [ ] Health check works: curl <API_BASE_URL>/workflow/health → {"ok": true}
 * 
 * TEST 1: Backend Mode (Connected)
 * [ ] Submit CSF Practitioner form
 * [ ] Console logs: "[SubmissionIntake] Using backend API to create case"
 * [ ] Network tab shows:
 *     - POST /submissions → 200 OK
 *     - POST /workflow/cases → 200 OK
 *     - POST /workflow/cases/{id}/evidence/attach → 200 OK
 * [ ] Case appears in Console work queue
 * [ ] Refresh page → case still visible (backend persistence)
 * [ ] Timeline tab shows backend-created audit events
 * [ ] Evidence tab shows attached RAG evidence
 * [ ] Submission tab shows form data
 * 
 * TEST 2: Status/Assignment Updates (Backend Persistence)
 * [ ] Change case status → refresh → change persists
 * [ ] Assign case to reviewer → refresh → assignment persists
 * [ ] Timeline shows new audit events from PATCH hooks
 * [ ] Packet evidence selection → refresh → selection persists
 * 
 * TEST 3: LocalStorage Fallback (Offline Mode)
 * [ ] Stop backend server
 * [ ] Refresh frontend → app continues working
 * [ ] Submit CSF form
 * [ ] Console logs: "[SubmissionIntake] Backend unavailable, using localStorage"
 * [ ] Network tab shows failed health check (timeout)
 * [ ] Case appears in Console work queue
 * [ ] Refresh page → case visible in localStorage
 * [ ] Timeline shows 3 manually-created audit events
 * [ ] Evidence stored in case metadata
 * 
 * TEST 4: Failover Behavior
 * [ ] Backend running → submit form → case in backend
 * [ ] Stop backend → submit form → case in localStorage
 * [ ] Restart backend → submit form → case in backend
 * [ ] First and third cases persist in backend
 * [ ] Second case only in localStorage (expected)
 * 
 * TEST 5: Deep Links
 * [ ] "Open Case" button navigates to Console with case selected
 * [ ] RAG drill link (/rag?mode=connected&caseId={id}) works in both modes
 * [ ] Case details panel loads correctly
 * 
 * ============================================================================
 */

import { getSubmission, createSubmission as createSubmissionViaSelector } from '../submissions/submissionStoreSelector';
import type { SubmissionRecord, CreateSubmissionInput } from '../submissions/submissionTypes';
import { getWorkflowStore } from './workflowStoreSelector';
import type { WorkQueueItem, ItemKind, WorkQueueStatus, Priority } from '../types/workQueue';
import type { AuditEventCreateInput } from '../types/audit';
import { getDefaultSlaHours, calculateDueDate } from './sla';
import { API_BASE } from '../lib/api';
import { workflowHealth } from '../api/workflowApi';
import { createCase, attachEvidence } from '../api/workflowApi';

/**
 * Evidence item attached to case from RAG search
 */
interface AttachedEvidence {
  id: string;
  source: string;
  snippet: string;
  citation?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Response from RAG regulatory search endpoint
 */
interface RagSearchResponse {
  results?: Array<{
    doc_id?: string;
    doc_title?: string;
    snippet?: string;
    jurisdiction?: string;
    citation?: string;
    tags?: string[];
    score?: number;
    metadata?: Record<string, unknown>;
  }>;
  message?: string;
  error?: string;
}

/**
 * Map decision type to ItemKind
 */
function getItemKind(decisionType: string): ItemKind {
  if (decisionType.startsWith('csf_')) {
    return 'csf';
  }
  if (decisionType.includes('license') || decisionType.includes('tddd') || decisionType.includes('pharmacy')) {
    return 'license';
  }
  return 'csf'; // Default fallback
}

/**
 * Map decision type to human-readable title
 */
function getSubmissionTitle(decisionType: string, submissionId: string): string {
  const typeLabels: Record<string, string> = {
    csf_practitioner: 'Practitioner CSF',
    csf_facility: 'Facility CSF',
    csf_hospital: 'Hospital CSF', // legacy support
    csf_researcher: 'Researcher CSF',
    ohio_tddd: 'Ohio TDDD License',
    ny_pharmacy_license: 'NY Pharmacy License',
    ny_pharmacy: 'NY Pharmacy License', // legacy support
  };
  
  const label = typeLabels[decisionType] || 'Compliance Submission';
  const timestamp = new Date().toLocaleString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  return `${label} – ${timestamp}`;
}

/**
 * Determine initial case status from evaluator output
 */
function getInitialStatus(submission: SubmissionRecord): WorkQueueStatus {
  const evaluatorStatus = submission.evaluatorOutput?.status;
  
  switch (evaluatorStatus) {
    case 'approved':
      return 'approved';
    case 'blocked':
      return 'blocked';
    case 'needs_review':
      return 'needs_review';
    default:
      return 'submitted'; // Default for new submissions
  }
}

/**
 * Determine priority from risk level
 */
function getPriority(submission: SubmissionRecord): Priority {
  const riskLevel = submission.evaluatorOutput?.riskLevel;
  
  switch (riskLevel) {
    case 'high':
      return 'high';
    case 'medium':
      return 'medium';
    case 'low':
      return 'low';
    default:
      return 'medium'; // Default priority
  }
}

/**
 * Generate search query for RAG evidence
 */
function generateRagSearchQuery(submission: SubmissionRecord): string {
  const { decisionType, formData, evaluatorOutput } = submission;
  
  // Build query from decision type and key form fields
  const parts: string[] = [];
  
  // Add decision type context
  parts.push(decisionType.replace(/_/g, ' '));
  
  // Add missing evidence if known
  if (evaluatorOutput?.missingEvidence && evaluatorOutput.missingEvidence.length > 0) {
    parts.push(...evaluatorOutput.missingEvidence);
  }
  
  // Add jurisdiction from form data
  if (formData.state) {
    parts.push(String(formData.state));
  }
  if (formData.jurisdiction) {
    parts.push(String(formData.jurisdiction));
  }
  
  // Add specific requirements
  if (formData.facility_type) {
    parts.push(String(formData.facility_type));
  }
  if (formData.practitioner_type) {
    parts.push(String(formData.practitioner_type));
  }
  
  return parts.join(' ').trim() || decisionType;
}

/**
 * Fetch RAG evidence for submission
 * 
 * Calls /rag/regulatory/search to get relevant regulatory snippets
 */
async function fetchRagEvidence(submission: SubmissionRecord): Promise<AttachedEvidence[]> {
  try {
    const query = generateRagSearchQuery(submission);
    const jurisdiction = submission.formData.state || submission.formData.jurisdiction || 'federal';
    
    console.log('[SubmissionIntake] Searching RAG for evidence:', { query, jurisdiction });
    
    const response = await fetch(`${API_BASE}/rag/regulatory/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        jurisdiction,
        top_k: 5, // Get top 5 most relevant evidence items
      }),
    });
    
    if (!response.ok) {
      console.warn('[SubmissionIntake] RAG search failed:', response.status);
      return [];
    }
    
    const data: RagSearchResponse = await response.json();
    
    if (!data.results || data.results.length === 0) {
      console.log('[SubmissionIntake] No RAG evidence found');
      return [];
    }
    
    // Transform RAG results to AttachedEvidence format
    const evidence: AttachedEvidence[] = data.results.map((result, index) => ({
      id: result.doc_id || `rag-evidence-${index}`,
      source: result.doc_title || result.doc_id || 'Regulatory Knowledge Base',
      snippet: result.snippet || '',
      citation: result.citation,
      tags: result.tags || [result.jurisdiction || ''].filter(Boolean),
      metadata: {
        jurisdiction: result.jurisdiction,
        score: result.score,
        ...result.metadata,
      },
    }));
    
    console.log('[SubmissionIntake] Found RAG evidence:', evidence.length);
    return evidence;
    
  } catch (error) {
    console.error('[SubmissionIntake] Failed to fetch RAG evidence:', error);
    // Graceful fallback - return empty array
    return [];
  }
}

/**
 * Write audit event to workflow store
 */
async function writeAuditEvent(event: AuditEventCreateInput): Promise<void> {
  try {
    const store = await getWorkflowStore();
    await store.addAuditEvent(event);
  } catch (error) {
    console.error('[SubmissionIntake] Failed to write audit event:', error);
    // Don't fail the entire intake if audit logging fails
  }
}

/**
 * Main intake function: Converts submission into work queue case
 * 
 * @param submissionId - ID of submission to intake
 * @returns Object with caseId for navigation
 * @throws Error if submission not found or intake fails
 */
export async function intakeSubmissionToCase(submissionId: string): Promise<{ caseId: string }> {
  console.log('[SubmissionIntake] Starting intake for submission:', submissionId);
  
  // 1. Retrieve submission
  const submission = await getSubmission(submissionId);
  if (!submission) {
    throw new Error(`Submission not found: ${submissionId}`);
  }
  
  // 2. Prepare case data
  const kind = getItemKind(submission.decisionType);
  const status = getInitialStatus(submission);
  const priority = getPriority(submission);
  const title = getSubmissionTitle(submission.decisionType, submissionId);
  const createdAt = new Date().toISOString();
  const slaHours = getDefaultSlaHours(kind);
  const dueAt = calculateDueDate(createdAt, slaHours);
  
  // 3. Fetch RAG evidence
  const evidence = await fetchRagEvidence(submission);
  
  // 4. Try to create case via backend API first
  let caseId: string;
  let useBackend = false;
  
  try {
    const healthCheck = await Promise.race([
      workflowHealth(),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 2000))
    ]);
    
    if (healthCheck?.ok) {
      useBackend = true;
      console.log('[SubmissionIntake] Using backend API to create case');
      
      // Create case via backend
      const caseRecord = await createCase({
        submissionId: submissionId,
        decisionType: submission.decisionType,
        title: `${submission.decisionType} - ${submissionId.slice(0, 8)}`,
        summary: `Automated case for ${submission.decisionType} submission`,
        dueAt: dueAt,
      });
      
      caseId = caseRecord.id;
      console.log('[SubmissionIntake] Created case via backend:', caseId);
      
      // Attach evidence if any
      if (evidence.length > 0) {
        await attachEvidence(caseId, {
          evidence: evidence.map(e => ({
            id: e.id,
            source: e.source,
            snippet: e.snippet,
            citation: e.citation,
            tags: e.tags,
            metadata: e.metadata,
          })),
        });
        console.log('[SubmissionIntake] Attached evidence via backend:', evidence.length);
      }
    } else {
      throw new Error('Backend health check failed');
    }
  } catch (error) {
    // Fall back to localStorage
    console.warn('[SubmissionIntake] Backend unavailable, using localStorage:', error);
    useBackend = false;
    
    const caseItem: Omit<WorkQueueItem, 'id'> = {
      kind,
      status,
      priority,
      title,
      subtitle: submission.decisionType.replace(/_/g, ' ').toUpperCase(),
      createdAt,
      submissionId,
      traceId: submission.evaluatorOutput?.traceId,
      reason: submission.evaluatorOutput?.explanation || 
              `${submission.decisionType} submission requires verification`,
      slaHours,
      dueAt,
      assignedTo: null,
      assignedAt: null,
    };
    
    const store = await getWorkflowStore();
    const workQueueItem = await store.addWorkQueueItem(caseItem);
    caseId = workQueueItem.id;
    
    console.log('[SubmissionIntake] Created case via localStorage:', caseId);
  }
  
  // 5. Write audit events (only for localStorage mode - backend auto-creates them)
  if (!useBackend) {
    // Event 1: Submission received
    await writeAuditEvent({
      caseId,
      submissionId,
      actorRole: 'submitter',
      actorName: submission.submittedBy?.name || 'System',
      action: 'SUBMITTED',
      message: `Submission received: ${title}`,
      meta: {
        firedRuleIds: submission.evaluatorOutput?.firedRules?.map(r => r.id),
      },
    });
    
    // Event 2: Case created
    await writeAuditEvent({
      caseId,
      submissionId,
      actorRole: 'admin',
      actorName: 'AutoComply System',
      action: 'NOTE_ADDED',
      message: `Case created with ${status} status. SLA: ${slaHours}h, due ${new Date(dueAt).toLocaleString()}`,
    });
    
    // Event 3: Evidence attached (if any found)
    if (evidence.length > 0) {
      await writeAuditEvent({
        caseId,
        submissionId,
        actorRole: 'admin',
        actorName: 'RAG Evidence System',
        action: 'NOTE_ADDED',
        message: `Auto-attached ${evidence.length} evidence item(s) from regulatory knowledge base`,
        meta: {
          evidenceDocIds: evidence.map(e => e.id),
        },
      });
      
      console.log('[SubmissionIntake] Attached evidence to localStorage case:', {
        count: evidence.length,
        sources: evidence.map(e => e.source),
      });
    }
  }
  
  // Log intake completion
  console.log('[SubmissionIntake] Intake complete:', {
    submissionId,
    caseId,
    status,
    priority,
    evidenceCount: evidence.length,
    slaHours,
    dueAt,
  });
  
  return { caseId };
}

/**
 * Batch intake multiple submissions
 * 
 * @param submissionIds - Array of submission IDs to intake
 * @returns Array of results with caseId or error for each
 */
export async function batchIntakeSubmissions(
  submissionIds: string[]
): Promise<Array<{ submissionId: string; caseId?: string; error?: string }>> {
  const results = [];
  
  for (const submissionId of submissionIds) {
    try {
      const { caseId } = await intakeSubmissionToCase(submissionId);
      results.push({ submissionId, caseId });
    } catch (error) {
      results.push({ 
        submissionId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
  
  return results;
}

/**
 * Check if submission has already been intaken
 * 
 * @param submissionId - Submission ID to check
 * @returns true if case exists for this submission
 */
export async function isSubmissionIntaken(submissionId: string): Promise<boolean> {
  const store = await getWorkflowStore();
  const workQueue = await store.getWorkQueue();
  return workQueue.some(item => item.submissionId === submissionId);
}

/**
 * Get case ID for submission (if intaken)
 * 
 * @param submissionId - Submission ID
 * @returns caseId or undefined if not intaken
 */
export async function getCaseIdForSubmission(submissionId: string): Promise<string | undefined> {
  const store = await getWorkflowStore();
  const workQueue = await store.getWorkQueue();
  const item = workQueue.find(item => item.submissionId === submissionId);
  return item?.id;
}

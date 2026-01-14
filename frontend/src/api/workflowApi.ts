/**
 * Workflow API Client
 * 
 * HTTP client functions for /workflow endpoints.
 * Handles all API communication with the backend workflow service.
 */

import { API_BASE } from '../lib/api';
import { getAuthHeaders, getJsonHeaders } from '../lib/authHeaders';
import { cachedFetchJson } from './apiCache';

const WORKFLOW_BASE = `${API_BASE}/workflow`;

// ============================================================================
// Types
// ============================================================================

export interface CaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  decisionType: string;
  title: string;
  summary: string;
  status: 'new' | 'in_review' | 'needs_info' | 'approved' | 'blocked' | 'closed';
  assignedTo: string | null;
  dueAt: string;
  submissionId: string | null;
  evidence: EvidenceItem[];
  packetEvidenceIds: string[];
  notesCount: number;
  attachmentsCount: number;
}

export interface CaseCreateInput {
  decisionType: string;
  title: string;
  summary: string;
  respondentName?: string;
  submittedAt?: string;
  dueAt?: string;
  submissionId?: string;
}

export interface CasePatchInput {
  title?: string;
  summary?: string;
  status?: 'new' | 'in_review' | 'needs_info' | 'approved' | 'blocked' | 'closed';
  assignedTo?: string | null;
  dueAt?: string;
  notesCount?: number;
  attachmentsCount?: number;
}

export interface EvidenceItem {
  id: string;
  source: string;
  snippet: string;
  citation?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface AuditEvent {
  id: string;
  caseId: string;
  eventType: string;
  createdAt: string;
  actor: string;
  source: string;
  message: string;
  meta?: Record<string, unknown>;
}

export interface AuditEventCreateInput {
  eventType: string;
  actor: string;
  source: string;
  message: string;
  meta?: Record<string, unknown>;
}

export interface CaseFilters {
  status?: string;
  assignedTo?: string;
  decisionType?: string;
  q?: string;
  overdue?: boolean;
  unassigned?: boolean;
  limit?: number;
  offset?: number;
}

export interface PaginatedCasesResponse {
  items: CaseRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface PaginatedAuditEventsResponse {
  items: AuditEvent[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdherenceStep {
  id: string;
  title: string;
  description: string;
}

export interface AdherenceRecommendation {
  stepId: string;
  stepTitle: string;
  suggestedAction: string;
}

export interface CaseAdherence {
  decisionType: string;
  adherencePct: number;
  totalSteps: number;
  completedSteps: AdherenceStep[];
  missingSteps: AdherenceStep[];
  recommendedNextActions: AdherenceRecommendation[];
  message?: string;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Health check
 */
export async function workflowHealth(): Promise<{ ok: boolean }> {
  return cachedFetchJson<{ ok: boolean }>(`${WORKFLOW_BASE}/health`, {
    headers: getAuthHeaders(),
  });
}

/**
 * List cases with optional filters (paginated)
 */
export async function listCases(filters?: CaseFilters): Promise<PaginatedCasesResponse> {
  const params = new URLSearchParams();
  
  if (filters?.status) params.set('status', filters.status);
  if (filters?.assignedTo) params.set('assignedTo', filters.assignedTo);
  if (filters?.decisionType) params.set('decisionType', filters.decisionType);
  if (filters?.q) params.set('q', filters.q);
  if (filters?.overdue !== undefined) params.set('overdue', String(filters.overdue));
  if (filters?.unassigned !== undefined) params.set('unassigned', String(filters.unassigned));
  // Default to high limit to show all cases (matches backend default of 100)
  if (filters?.limit !== undefined) params.set('limit', String(filters.limit));
  else params.set('limit', '1000');
  if (filters?.offset !== undefined) params.set('offset', String(filters.offset));
  
  const url = params.toString() 
    ? `${WORKFLOW_BASE}/cases?${params}` 
    : `${WORKFLOW_BASE}/cases?limit=1000`;
  
  return cachedFetchJson<PaginatedCasesResponse>(url, {
    headers: getAuthHeaders(),
  });
}

/**
 * Get a case by ID
 */
export async function getCase(caseId: string): Promise<CaseRecord> {
  return cachedFetchJson<CaseRecord>(`${WORKFLOW_BASE}/cases/${caseId}`, {
    headers: getAuthHeaders(),
  });
}

/**
 * Get the submission linked to a case
 */
export async function getCaseSubmission(caseId: string): Promise<any> {
  const response = await fetch(`${WORKFLOW_BASE}/cases/${caseId}/submission`, {
    headers: getAuthHeaders(),
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Submission not found');
    }
    throw new Error(`Failed to get case submission: ${response.status}`);
  }
  return response.json();
}

/**
 * Create a new case
 */
export async function createCase(payload: CaseCreateInput): Promise<CaseRecord> {
  const response = await fetch(`${WORKFLOW_BASE}/cases`, {
    method: 'POST',
    headers: getJsonHeaders(),
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create case: ${response.status}`);
  }
  return response.json();
}

/**
 * Update a case (PATCH)
 */
export async function patchCase(caseId: string, patch: CasePatchInput): Promise<CaseRecord> {
  const response = await fetch(`${WORKFLOW_BASE}/cases/${caseId}`, {
    method: 'PATCH',
    headers: getJsonHeaders(),
    body: JSON.stringify(patch),
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Case not found: ${caseId}`);
    }
    throw new Error(`Failed to update case: ${response.status}`);
  }
  return response.json();
}

/**
 * Get audit timeline for a case (paginated)
 */
export async function listAudit(
  caseId: string,
  limit?: number,
  offset?: number
): Promise<PaginatedAuditEventsResponse> {
  const params = new URLSearchParams();
  if (limit !== undefined) params.set('limit', String(limit));
  if (offset !== undefined) params.set('offset', String(offset));
  
  const url = params.toString()
    ? `${WORKFLOW_BASE}/cases/${caseId}/audit?${params}`
    : `${WORKFLOW_BASE}/cases/${caseId}/audit`;
  
  return cachedFetchJson<PaginatedAuditEventsResponse>(url, {
    headers: getAuthHeaders(),
  });
}

/**
 * Add a custom audit event
 */
export async function addAudit(
  caseId: string, 
  event: AuditEventCreateInput
): Promise<AuditEvent> {
  const response = await fetch(`${WORKFLOW_BASE}/cases/${caseId}/audit`, {
    method: 'POST',
    headers: getJsonHeaders(),
    body: JSON.stringify(event),
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Case not found: ${caseId}`);
    }
    throw new Error(`Failed to add audit event: ${response.status}`);
  }
  return response.json();
}

/**
 * Attach evidence to a case
 */
export async function attachEvidence(
  caseId: string, 
  evidencePayload: { evidence: EvidenceItem[]; source?: string }
): Promise<CaseRecord> {
  const response = await fetch(`${WORKFLOW_BASE}/cases/${caseId}/evidence/attach`, {
    method: 'POST',
    headers: getJsonHeaders(),
    body: JSON.stringify(evidencePayload.evidence),
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Case not found: ${caseId}`);
    }
    throw new Error(`Failed to attach evidence: ${response.status}`);
  }
  return response.json();
}

/**
 * Get playbook adherence metrics for a case
 */
export async function getCaseAdherence(caseId: string): Promise<CaseAdherence> {
  return cachedFetchJson<CaseAdherence>(`${WORKFLOW_BASE}/cases/${caseId}/adherence`, {
    headers: getAuthHeaders(),
  });
}

/**
 * Update evidence packet selection
 */
export async function updateEvidencePacket(
  caseId: string,
  packetEvidenceIds: string[]
): Promise<CaseRecord> {
  const response = await fetch(`${WORKFLOW_BASE}/cases/${caseId}/evidence/packet`, {
    method: 'PATCH',
    headers: getJsonHeaders(),
    body: JSON.stringify(packetEvidenceIds),
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Case not found: ${caseId}`);
    }
    throw new Error(`Failed to update evidence packet: ${response.status}`);
  }
  return response.json();
}


// ============================================================================
// Phase 2: Case Lifecycle API Functions
// ============================================================================

export interface CaseNote {
  id: string;
  caseId: string;
  createdAt: string;
  authorRole: string;
  authorName: string | null;
  noteText: string;
  metadata: Record<string, unknown>;
}

export interface CaseNoteCreateInput {
  noteText: string;
  authorRole?: string;
  authorName?: string;
  metadata?: Record<string, unknown>;
}

export interface CaseDecision {
  id: string;
  caseId: string;
  createdAt: string;
  decision: 'APPROVED' | 'REJECTED';
  reason: string | null;
  details: Record<string, unknown>;
  decidedByRole: string | null;
  decidedByName: string | null;
}

export interface CaseDecisionCreateInput {
  decision: 'APPROVED' | 'REJECTED';
  reason?: string;
  details?: Record<string, unknown>;
  decidedByRole?: string;
  decidedByName?: string;
}

export interface TimelineItem {
  id: string;
  caseId: string;
  createdAt: string;
  itemType: 'note' | 'event';
  authorRole: string | null;
  authorName: string | null;
  content: string;
  metadata: Record<string, unknown>;
}

/**
 * Update case status, assignee, or other fields
 */
export async function updateCaseStatus(
  caseId: string,
  updates: CasePatchInput
): Promise<CaseRecord> {
  const response = await fetch(`${WORKFLOW_BASE}/cases/${caseId}`, {
    method: 'PATCH',
    headers: getJsonHeaders(),
    body: JSON.stringify(updates),
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Case not found: ${caseId}`);
    }
    if (response.status === 400) {
      const error = await response.json();
      throw new Error(error.detail || 'Invalid status transition');
    }
    throw new Error(`Failed to update case: ${response.status}`);
  }
  return response.json();
}

/**
 * Add a note to a case
 */
export async function addCaseNote(
  caseId: string,
  noteInput: CaseNoteCreateInput
): Promise<CaseNote> {
  const response = await fetch(`${WORKFLOW_BASE}/cases/${caseId}/notes`, {
    method: 'POST',
    headers: getJsonHeaders(),
    body: JSON.stringify(noteInput),
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Case not found: ${caseId}`);
    }
    throw new Error(`Failed to add note: ${response.status}`);
  }
  return response.json();
}

/**
 * Get all notes for a case
 */
export async function getCaseNotes(caseId: string): Promise<CaseNote[]> {
  return cachedFetchJson<CaseNote[]>(`${WORKFLOW_BASE}/cases/${caseId}/notes`, {
    headers: getAuthHeaders(),
  });
}

/**
 * Get combined timeline (notes + events) for a case
 */
export async function getCaseTimeline(caseId: string): Promise<TimelineItem[]> {
  return cachedFetchJson<TimelineItem[]>(`${WORKFLOW_BASE}/cases/${caseId}/timeline`, {
    headers: getAuthHeaders(),
  });
}

/**
 * Make a decision on a case (approve or reject)
 */
export async function makeCaseDecision(
  caseId: string,
  decisionInput: CaseDecisionCreateInput
): Promise<CaseDecision> {
  const response = await fetch(`${WORKFLOW_BASE}/cases/${caseId}/decision`, {
    method: 'POST',
    headers: getJsonHeaders(),
    body: JSON.stringify(decisionInput),
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Case not found: ${caseId}`);
    }
    throw new Error(`Failed to make decision: ${response.status}`);
  }
  return response.json();
}

/**
 * Get the most recent decision for a case
 */
export async function getCaseDecision(caseId: string): Promise<CaseDecision | null> {
  try {
    return await cachedFetchJson<CaseDecision>(`${WORKFLOW_BASE}/cases/${caseId}/decision`, {
      headers: getAuthHeaders(),
    });
  } catch (error) {
    // Return null if no decision exists (404)
    if (error instanceof Error && error.message.includes('404')) {
      return null;
    }
    throw error;
  }
}
